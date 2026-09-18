import { and, eq, gt } from "drizzle-orm";
import { MEDIA_LIMITS } from "@umbul-nogo/contracts/media";
import type { MediaDto } from "@umbul-nogo/contracts/media";
import { operationKeySchema } from "@umbul-nogo/contracts/primitives";
import type { Database } from "../db/client";
import { mediaAssets } from "../db/schema";
import type { StoredImageVariant } from "../db/schema";
import { requireTransactionSession } from "../auth/transaction";
import { authTimeouts } from "../auth/locks";
import { failure, HttpError } from "../http/errors";
import { bytesHash, normalizeImage } from "./images";
import { createMediaLibrary, manifestSchema, mediaDatabaseOperation } from "./library";
import type { MediaStorage } from "./storage";

export const MEDIA_LEASE_MS = 90_000;
let occupied = false;
export function createMediaService({
  db,
  storage,
  baseUrl,
  now = Date.now,
}: {
  db: Database;
  storage: MediaStorage | undefined;
  baseUrl: string | undefined;
  now?: () => number;
}) {
  const library = createMediaLibrary(db, baseUrl, now);
  return {
    ...library,
    async upload(request: {
      token: string | undefined;
      key: string;
      file: File;
      signal: AbortSignal;
    }): Promise<{ data: MediaDto; status: 200 | 201 | 202 }> {
      if (!operationKeySchema.safeParse(request.key).success) throw failure("INVALID_REQUEST");
      if (request.file.size > MEDIA_LIMITS.fileBytes) throw failure("FILE_TOO_LARGE");
      if (!request.file.size) throw failure("IMAGE_INVALID");
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
      const bytes = Buffer.from(await request.file.arrayBuffer());
      const hash = bytesHash(bytes);
      let slot = false;
      let owned: { id: string; attemptId: string; userId: string } | undefined;
      try {
        const reservation = await mediaDatabaseOperation(() =>
          db.transaction(async (tx) => {
            await authTimeouts(tx);
            const userId = await requireTransactionSession(tx, request.token, now, signal);
            const [previous] = await tx
              .select()
              .from(mediaAssets)
              .where(
                and(eq(mediaAssets.uploaderId, userId), eq(mediaAssets.uploadKey, request.key)),
              )
              .for("update");
            if (previous) {
              if (previous.sourceSha256 !== hash) throw failure("UPLOAD_KEY_REUSED");
              if (["deleted", "deleting"].includes(previous.status))
                throw failure("MEDIA_NOT_REUSABLE");
              if (previous.status === "ready")
                return { id: previous.id, userId, status: 200 as const };
              if (
                previous.status === "processing" &&
                previous.leaseUntil &&
                Date.parse(previous.leaseUntil) > now()
              )
                return { id: previous.id, userId, status: 202 as const };
              if (previous.failureCode === "IMAGE_INVALID") throw failure("IMAGE_INVALID");
            }
            if (!storage || !baseUrl) throw failure("STORAGE_UNAVAILABLE");
            if (occupied)
              throw new HttpError(
                {
                  code: "MEDIA_CAPACITY_EXCEEDED",
                  message: "Pemrosesan gambar sedang penuh. Coba kembali nanti.",
                },
                { "Retry-After": "5" },
              );
            occupied = true;
            slot = true;
            const attemptId = crypto.randomUUID();
            const time = new Date(now()).toISOString();
            const values = {
              status: "processing" as const,
              attemptId,
              leaseUntil: new Date(now() + MEDIA_LEASE_MS).toISOString(),
              variants: [],
              failureCode: null,
              updatedAt: time,
            };
            const [row] = previous
              ? await tx
                  .update(mediaAssets)
                  .set(values)
                  .where(eq(mediaAssets.id, previous.id))
                  .returning()
              : await tx
                  .insert(mediaAssets)
                  .values({
                    ...values,
                    uploaderId: userId,
                    uploadKey: request.key,
                    sourceSha256: hash,
                    createdAt: time,
                  })
                  .returning();
            if (!row) throw failure("INTERNAL_ERROR");
            signal.throwIfAborted();
            return { id: row.id, userId, attemptId, status: 201 as const };
          }),
        );
        if (reservation.status !== 201) {
          const data = await library.detail(reservation.userId, reservation.id, signal);
          if (data.status === "ready") return { status: 200, data };
          if (data.status === "processing") return { status: 202, data };
          if (data.status === "deleting" || data.status === "deleted")
            throw failure("MEDIA_NOT_REUSABLE");
          throw failure(
            data.failureCode === "IMAGE_INVALID" ? "IMAGE_INVALID" : "STORAGE_UNAVAILABLE",
          );
        }
        owned = {
          id: reservation.id,
          attemptId: reservation.attemptId,
          userId: reservation.userId,
        };
        const owner = owned;
        const condition = () =>
          and(
            eq(mediaAssets.id, owner.id),
            eq(mediaAssets.attemptId, owner.attemptId),
            eq(mediaAssets.status, "processing"),
            gt(mediaAssets.leaseUntil, new Date(now()).toISOString()),
          );
        const finalize = (variants: StoredImageVariant[], ready: boolean) =>
          mediaDatabaseOperation(() =>
            db.transaction(async (tx) => {
              await authTimeouts(tx);
              await requireTransactionSession(tx, request.token, now, signal);
              const rows = await tx
                .update(mediaAssets)
                .set({
                  variants,
                  ...(ready ? { status: "ready" as const, leaseUntil: null } : {}),
                  updatedAt: new Date(now()).toISOString(),
                })
                .where(condition())
                .returning({ id: mediaAssets.id });
              if (!rows.length) throw failure("MEDIA_BUSY");
              signal.throwIfAborted();
            }),
          );
        const outputs = await normalizeImage(bytes, owner.id, owner.attemptId, signal);
        const manifest = manifestSchema.parse(outputs.map((output) => output.manifest));
        await finalize(manifest, false);
        if (!storage) throw failure("STORAGE_UNAVAILABLE");
        for (const output of outputs) {
          signal.throwIfAborted();
          await storage.put(output.manifest.objectKey, output.bytes, signal);
        }
        for (const variant of manifest) {
          signal.throwIfAborted();
          await storage.verify(variant, signal);
        }
        await finalize(manifest, true);
        return { status: 201, data: await library.detail(owner.userId, owner.id, signal) };
      } catch (error) {
        if (owned) {
          const owner = owned;
          const code =
            error instanceof HttpError && error.detail.code === "IMAGE_INVALID"
              ? "IMAGE_INVALID"
              : error instanceof HttpError &&
                  error.detail.code === "STORAGE_UNAVAILABLE" &&
                  !signal.aborted
                ? "STORAGE_UNAVAILABLE"
                : "UPLOAD_INTERRUPTED";
          // Internal failure bookkeeping never promotes media and cannot overwrite a new lease.
          // If DB is down, leave processing for expiry/reconciliation instead of claiming cleanup.
          await mediaDatabaseOperation(() =>
            db.transaction(async (tx) => {
              await authTimeouts(tx);
              await tx
                .update(mediaAssets)
                .set({
                  status: "failed",
                  failureCode: code,
                  leaseUntil: null,
                  updatedAt: new Date(now()).toISOString(),
                })
                .where(
                  and(
                    eq(mediaAssets.id, owner.id),
                    eq(mediaAssets.attemptId, owner.attemptId),
                    eq(mediaAssets.status, "processing"),
                    gt(mediaAssets.leaseUntil, new Date(now()).toISOString()),
                  ),
                );
            }),
          ).catch(() => {});
        }
        if (error instanceof HttpError) throw error;
        throw failure("SERVICE_UNAVAILABLE");
      } finally {
        if (slot) occupied = false;
      }
    },
  };
}
export type MediaService = ReturnType<typeof createMediaService>;
