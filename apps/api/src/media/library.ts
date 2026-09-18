import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { mediaCursorSchema, mediaDtoSchema } from "@umbul-nogo/contracts/media";
import type {
  MediaCursor,
  MediaDto,
  MediaListQuery,
  MediaReference,
} from "@umbul-nogo/contracts/media";
import { uuidSchema } from "@umbul-nogo/contracts/primitives";
import type { Database } from "../db/client";
import { attractions, galleryItems, mediaAssets, siteProfile } from "../db/schema";
import { failure, HttpError } from "../http/errors";
import { authTimeouts } from "../auth/locks";
import { objectKeyPattern } from "./images";

export const manifestSchema = z
  .array(
    z.strictObject({
      objectKey: z.string().regex(objectKeyPattern),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      mimeType: z.literal("image/webp"),
      byteSize: z.number().int().positive(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  )
  .min(1)
  .max(4);
export function decodeCursor(
  cursor: string | undefined,
  status: MediaListQuery["status"],
): MediaCursor | undefined {
  if (cursor === undefined) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const bytes = Buffer.from(cursor, "base64url");
    if (bytes.toString("base64url") !== cursor) throw new Error();
    const result = mediaCursorSchema.parse(JSON.parse(bytes.toString("utf8")) as unknown);
    if (result.status !== (status ?? null)) throw new Error();
    return result;
  } catch {
    throw failure("INVALID_CURSOR");
  }
}
export async function mediaReferences(tx: Database, id: string): Promise<MediaReference[]> {
  const refs: MediaReference[] = [];
  const [profile] = await tx.select().from(siteProfile).where(eq(siteProfile.id, 1));
  if (!profile) throw failure("INTERNAL_ERROR");
  if (profile.heroMediaId === id)
    refs.push({ resource: "destination", id: null, field: "heroMediaId", label: profile.name });
  if (profile.logoMediaId === id)
    refs.push({ resource: "destination", id: null, field: "logoMediaId", label: profile.name });
  if (profile.seoMediaId === id)
    refs.push({ resource: "seo", id: null, field: "imageMediaId", label: profile.name });
  for (const row of await tx.select().from(attractions).where(eq(attractions.mediaId, id)))
    refs.push({ resource: "attractions", id: row.id, field: "mediaId", label: row.name });
  for (const row of await tx.select().from(galleryItems).where(eq(galleryItems.mediaId, id)))
    refs.push({
      resource: "gallery-items",
      id: row.id,
      field: "mediaId",
      label: row.caption ?? row.altText,
    });
  return refs;
}
export async function mediaDto(
  tx: Database,
  row: typeof mediaAssets.$inferSelect,
  userId: string,
  baseUrl: string | undefined,
  time: number,
): Promise<MediaDto> {
  let variants: MediaDto["variants"] = [];
  if (row.status === "ready") {
    if (!baseUrl) throw failure("SERVICE_UNAVAILABLE");
    const manifest = manifestSchema.safeParse(row.variants);
    if (
      !manifest.success ||
      !row.attemptId ||
      manifest.data.some((v) => !v.objectKey.startsWith(`media/${row.id}/${row.attemptId}/`))
    )
      throw failure("INTERNAL_ERROR");
    variants = manifest.data.map((v) => ({
      url: `${baseUrl}/${v.objectKey}`,
      width: v.width,
      height: v.height,
      mimeType: v.mimeType,
      byteSize: v.byteSize,
    }));
  }
  const parsed = mediaDtoSchema.safeParse({
    id: row.id,
    status: row.status,
    variants,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
    failureCode: row.failureCode,
    references: await mediaReferences(tx, row.id),
    canRetryUpload:
      row.uploaderId === userId &&
      row.failureCode !== "IMAGE_INVALID" &&
      (row.status === "failed" ||
        (row.status === "processing" && (!row.leaseUntil || Date.parse(row.leaseUntil) <= time))),
  });
  if (!parsed.success) throw failure("INTERNAL_ERROR");
  return parsed.data;
}
export async function mediaDatabaseOperation<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw failure("SERVICE_UNAVAILABLE");
  }
}
export function createMediaLibrary(db: Database, baseUrl: string | undefined, now = Date.now) {
  return {
    async detail(userId: string, id: string, signal: AbortSignal, uploadKey = false) {
      return mediaDatabaseOperation(() =>
        db.transaction(
          async (tx) => {
            await authTimeouts(tx);
            signal.throwIfAborted();
            const [row] = await tx
              .select()
              .from(mediaAssets)
              .where(
                uploadKey
                  ? and(eq(mediaAssets.uploaderId, userId), eq(mediaAssets.uploadKey, id))
                  : eq(mediaAssets.id, uuidSchema.parse(id)),
              );
            if (!row) throw failure(uploadKey ? "UPLOAD_NOT_FOUND" : "NOT_FOUND");
            const dto = await mediaDto(tx, row, userId, baseUrl, now());
            signal.throwIfAborted();
            return dto;
          },
          { isolationLevel: "repeatable read", accessMode: "read only" },
        ),
      );
    },
    async list(userId: string, query: MediaListQuery, signal: AbortSignal) {
      const cursor = decodeCursor(query.cursor, query.status);
      return mediaDatabaseOperation(() =>
        db.transaction(
          async (tx) => {
            await authTimeouts(tx);
            signal.throwIfAborted();
            const rows = await tx
              .select({
                row: mediaAssets,
                cursorAt: sql<string>`to_char(${mediaAssets.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
              })
              .from(mediaAssets)
              .where(
                and(
                  query.status
                    ? eq(mediaAssets.status, query.status)
                    : ne(mediaAssets.status, "deleted"),
                  cursor
                    ? sql`(${mediaAssets.createdAt}, ${mediaAssets.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
                    : undefined,
                ),
              )
              .orderBy(desc(mediaAssets.createdAt), desc(mediaAssets.id))
              .limit(query.limit + 1);
            const page = rows.slice(0, query.limit);
            const items: MediaDto[] = [];
            for (const entry of page) {
              signal.throwIfAborted();
              items.push(await mediaDto(tx, entry.row, userId, baseUrl, now()));
            }
            const last = page.at(-1);
            return {
              items,
              nextCursor:
                rows.length > query.limit && last
                  ? Buffer.from(
                      JSON.stringify({
                        createdAt: last.cursorAt,
                        id: last.row.id,
                        status: query.status ?? null,
                      }),
                    ).toString("base64url")
                  : null,
            };
          },
          { isolationLevel: "repeatable read", accessMode: "read only" },
        ),
      );
    },
  };
}
