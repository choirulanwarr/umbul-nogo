import { expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { mediaListResponseSchema, mediaResponseSchema } from "@umbul-nogo/contracts/media";
import { apiFailureSchema } from "@umbul-nogo/contracts/errors";
import type { createDatabase } from "../src/db/client";
import { mediaAssets, adminUsers, adminSessions, attractions, siteState } from "../src/db/schema";
import { createApp } from "../src/app";
import { createAuthService } from "../src/auth/service";
import { createAuthHttp } from "../src/auth/http";
import { newSessionToken, sha256, hashPassword } from "../src/auth/crypto";
import { createMediaService } from "../src/media/service";
import { createMediaHttp } from "../src/media/http";
import { bytesHash } from "../src/media/images";
import type { MediaStorage } from "../src/media/storage";
import { failure } from "../src/http/errors";

type Connections = {
  migration: ReturnType<typeof createDatabase>;
  runtime: ReturnType<typeof createDatabase>;
};
const origin = "https://example.test";
const path = "/api/v1/admin/media";
async function code(response: Response) {
  return apiFailureSchema.parse(await response.json()).error.code;
}
function gate() {
  let release: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function withMedia(
  connections: Connections,
  run: (f: {
    upload: (bytes: Buffer, key?: string, actor?: number) => Promise<Response>;
    get: (path: string, actor?: number) => Promise<Response>;
    objects: Map<string, Buffer>;
    source: Buffer;
    users: string[];
    hooks: { put?: () => Promise<void>; verify?: () => Promise<void> };
  }) => Promise<void>,
) {
  const db = connections.migration.db;
  const time = Date.parse("2032-01-01T00:00:00Z");
  const passwordHash = await hashPassword("Media fixture password only");
  const users = await db
    .insert(adminUsers)
    .values(
      [0, 1].map(() => ({ email: `media-${crypto.randomUUID()}@example.test`, passwordHash })),
    )
    .returning({ id: adminUsers.id });
  const ids = users.map((user) => user.id);
  const tokens = users.map(() => newSessionToken());
  const objects = new Map<string, Buffer>();
  const hooks: { put?: () => Promise<void>; verify?: () => Promise<void> } = {};
  const storage: MediaStorage = {
    put: async (key, bytes) => {
      await hooks.put?.();
      objects.set(key, bytes);
    },
    verify: async (variant) => {
      await hooks.verify?.();
      const bytes = objects.get(variant.objectKey);
      if (!bytes || bytes.length !== variant.byteSize || bytesHash(bytes) !== variant.sha256)
        throw failure("STORAGE_UNAVAILABLE");
    },
  };
  try {
    await db.insert(adminSessions).values(
      users.map((user, index) => ({
        adminUserId: user.id,
        tokenHash: sha256(tokens[index]!),
        createdAt: new Date(time).toISOString(),
        lastSeenAt: new Date(time).toISOString(),
        expiresAt: new Date(time + 8 * 60 * 60 * 1000).toISOString(),
      })),
    );
    const auth = createAuthHttp({
      service: createAuthService({
        db: connections.runtime.db,
        now: () => time,
        verifyPassword: () => Promise.resolve(false),
      }),
      siteOrigin: origin,
      production: true,
      sourceAddress: () => "127.0.0.1",
    });
    const app = createApp({
      ...auth,
      readProfile: () => Promise.resolve({ name: "UMBUL NOGO", region: "Wonogiri" }),
      ready: () => Promise.resolve(true),
      log: () => {},
      routes: [
        ...auth.routes,
        ...createMediaHttp(
          createMediaService({
            db: connections.runtime.db,
            storage,
            baseUrl: "https://assets.example.test",
            now: () => time,
          }),
          true,
        ),
      ],
    });
    const headers = (actor: number) => ({
      origin,
      "x-umbul-client": "admin-web",
      cookie: `__Host-umbul_session=${tokens[actor]}`,
    });
    await run({
      users: ids,
      objects,
      hooks,
      source: await sharp({ create: { width: 700, height: 120, channels: 3, background: "green" } })
        .png()
        .toBuffer(),
      upload: (bytes, key = crypto.randomUUID(), actor = 0) => {
        const form = new FormData();
        form.set(
          "file",
          new File([new Uint8Array(bytes)], "../../not-trusted.svg", { type: "text/plain" }),
        );
        return app.handle(
          new Request(origin + path + "/uploads", {
            method: "POST",
            headers: { ...headers(actor), "idempotency-key": key },
            body: form,
          }),
        );
      },
      get: (suffix, actor = 0) =>
        app.handle(new Request(origin + path + suffix, { headers: headers(actor) })),
    });
  } finally {
    const media = await db
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(inArray(mediaAssets.uploaderId, ids));
    if (media.length)
      await db.delete(attractions).where(
        inArray(
          attractions.mediaId,
          media.map((m) => m.id),
        ),
      );
    await db.delete(mediaAssets).where(inArray(mediaAssets.uploaderId, ids));
    await db.delete(adminSessions).where(inArray(adminSessions.adminUserId, ids));
    await db.delete(adminUsers).where(inArray(adminUsers.id, ids));
  }
}
export function registerMediaDatabaseTests(getConnections: () => Connections): void {
  test("T-10 upload/retry, signature vs MIME, manifest privat, references dan pagination", async () => {
    await withMedia(getConnections(), async (f) => {
      const before = (await getConnections().runtime.db.select().from(siteState))[0];
      const key = crypto.randomUUID();
      const response = await f.upload(f.source, key);
      expect(response.status).toBe(201);
      const first = mediaResponseSchema.parse(await response.json()).data;
      expect(first.status).toBe("ready");
      expect(first.variants.map((v) => v.width)).toEqual([320, 640, 700]);
      expect(response.headers.get("location")).toBe(`${path}/${first.id}`);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(JSON.stringify(first)).not.toContain('"objectKey"');
      expect(JSON.stringify(first)).not.toContain('"sha256"');
      expect((await f.upload(f.source, key)).status).toBe(200);
      expect(f.objects.size).toBe(3);
      expect(await code(await f.upload(Buffer.from("different"), key))).toBe("UPLOAD_KEY_REUSED");
      expect(mediaResponseSchema.parse(await (await f.get(`/uploads/${key}`)).json()).data.id).toBe(
        first.id,
      );
      expect(await code(await f.get(`/uploads/${key}`, 1))).toBe("UPLOAD_NOT_FOUND");
      expect((await f.get(`/${first.id}`, 1)).status).toBe(200);
      await getConnections().migration.db.insert(attractions).values({
        name: "Hidden reference fixture",
        mediaId: first.id,
        imageAlt: "Fixture",
        sortOrder: 0,
      });
      const referenced = mediaResponseSchema.parse(await (await f.get(`/${first.id}`)).json()).data;
      expect(referenced.references.map((r) => r.resource)).toEqual(["attractions"]);
      expect((await f.upload(f.source)).status).toBe(201);
      const page = mediaListResponseSchema.parse(
        await (await f.get("?limit=1&status=ready")).json(),
      ).data;
      expect(page.items).toHaveLength(1);
      expect(page.nextCursor).not.toBeNull();
      const next = mediaListResponseSchema.parse(
        await (await f.get(`?limit=1&status=ready&cursor=${page.nextCursor}`)).json(),
      ).data;
      expect(next.items).toHaveLength(1);
      expect(next.items[0]?.id).not.toBe(page.items[0]?.id);
      expect(next.nextCursor).toBeNull();
      expect(await code(await f.get(`?status=failed&cursor=${page.nextCursor}`))).toBe(
        "INVALID_CURSOR",
      );
      expect(await code(await f.get("?cursor=%%%"))).toBe("INVALID_CURSOR");
      expect((await getConnections().runtime.db.select().from(siteState))[0]).toEqual(before);
    });
  });
  test("T-10 reservasi mendahului slot; duplikat 202 dan kapasitas proses 503", async () => {
    await withMedia(getConnections(), async (f) => {
      const entered = gate();
      const release = gate();
      f.hooks.put = async () => {
        entered.release();
        await release.promise;
      };
      const key = crypto.randomUUID();
      const active = f.upload(f.source, key);
      try {
        await Promise.race([
          entered.promise,
          active.then(() => {
            throw new Error("Upload ended before reaching the storage barrier.");
          }),
        ]);
        const pending = await f.upload(f.source, key);
        expect(pending.status).toBe(202);
        expect(pending.headers.get("retry-after")).toBe("2");
        expect(mediaResponseSchema.parse(await pending.json()).data.variants).toEqual([]);
        expect(await code(await f.upload(Buffer.from("different"), key))).toBe("UPLOAD_KEY_REUSED");
        const busy = await f.upload(f.source, crypto.randomUUID(), 1);
        expect(busy.status).toBe(503);
        expect(busy.headers.get("retry-after")).toBe("5");
        expect(await code(busy)).toBe("MEDIA_CAPACITY_EXCEEDED");
      } finally {
        release.release();
        await active;
      }
    });
  });
  test("T-10 kegagalan verifikasi tidak ready, retry memakai attempt baru dan file invalid permanen", async () => {
    await withMedia(getConnections(), async (f) => {
      const key = crypto.randomUUID();
      f.hooks.verify = () => Promise.reject(failure("STORAGE_UNAVAILABLE"));
      expect(await code(await f.upload(f.source, key))).toBe("STORAGE_UNAVAILABLE");
      const failed = mediaResponseSchema.parse(await (await f.get(`/uploads/${key}`)).json()).data;
      expect(failed.status).toBe("failed");
      expect(failed.canRetryUpload).toBe(true);
      expect(failed.variants).toEqual([]);
      expect(
        mediaResponseSchema.parse(await (await f.get(`/${failed.id}`, 1)).json()).data
          .canRetryUpload,
      ).toBe(false);
      const keys = [...f.objects.keys()];
      delete f.hooks.verify;
      const retry = mediaResponseSchema.parse(await (await f.upload(f.source, key)).json()).data;
      expect(retry.id).toBe(failed.id);
      expect(retry.status).toBe("ready");
      expect(f.objects.size).toBe(keys.length * 2);
      const invalidKey = crypto.randomUUID();
      expect(await code(await f.upload(Buffer.from("invalid"), invalidKey))).toBe("IMAGE_INVALID");
      expect(
        mediaResponseSchema.parse(await (await f.get(`/uploads/${invalidKey}`)).json()).data
          .canRetryUpload,
      ).toBe(false);
      expect(await code(await f.upload(Buffer.from("invalid"), invalidKey))).toBe("IMAGE_INVALID");
      await getConnections()
        .migration.db.update(mediaAssets)
        .set({ status: "deleting" })
        .where(eq(mediaAssets.id, retry.id));
      expect(await code(await f.upload(f.source, key))).toBe("MEDIA_NOT_REUSABLE");
    });
  });
  test("T-10 lease expired dapat diretry; pencabutan sesi mencegah ready", async () => {
    await withMedia(getConnections(), async (f) => {
      const key = crypto.randomUUID();
      const ready = mediaResponseSchema.parse(await (await f.upload(f.source, key)).json()).data;
      await getConnections()
        .migration.db.update(mediaAssets)
        .set({ status: "processing", leaseUntil: "2031-12-31T23:59:59.000Z" })
        .where(eq(mediaAssets.id, ready.id));
      expect(
        mediaResponseSchema.parse(await (await f.get(`/uploads/${key}`)).json()).data
          .canRetryUpload,
      ).toBe(true);
      const retry = mediaResponseSchema.parse(await (await f.upload(f.source, key)).json()).data;
      expect(retry.id).toBe(ready.id);
      expect(retry.status).toBe("ready");
      const revokedKey = crypto.randomUUID();
      f.hooks.verify = async () => {
        await getConnections()
          .migration.db.delete(adminSessions)
          .where(eq(adminSessions.adminUserId, f.users[0]!));
      };
      expect(await code(await f.upload(f.source, revokedKey))).toBe("AUTH_REQUIRED");
      const [row] = await getConnections()
        .migration.db.select()
        .from(mediaAssets)
        .where(eq(mediaAssets.uploadKey, revokedKey));
      expect(row?.status).toBe("failed");
      expect(row?.failureCode).toBe("UPLOAD_INTERRUPTED");
    });
  });
  test("T-10 worker yang kehilangan attempt tidak boleh commit ready", async () => {
    await withMedia(getConnections(), async (f) => {
      const key = crypto.randomUUID();
      let replaced = false;
      f.hooks.verify = async () => {
        if (replaced) return;
        replaced = true;
        await getConnections()
          .migration.db.update(mediaAssets)
          .set({ attemptId: crypto.randomUUID() })
          .where(eq(mediaAssets.uploadKey, key));
      };
      expect(await code(await f.upload(f.source, key))).toBe("MEDIA_BUSY");
      expect(
        mediaResponseSchema.parse(await (await f.get(`/uploads/${key}`)).json()).data.status,
      ).toBe("processing");
    });
  });
}
