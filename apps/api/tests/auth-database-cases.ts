import { expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adminSessions, adminUsers, authThrottles } from "../src/db/schema";
import type { createDatabase } from "../src/db/client";
import { createAuthService, cleanupAuth, THROTTLE_WINDOW_MS } from "../src/auth/service";
import { createPasswordVerifier, hashPassword, sha256 } from "../src/auth/crypto";
import { ABSOLUTE_SESSION_MS, IDLE_SESSION_MS } from "../src/auth/cookie";
import { HttpError } from "../src/http/errors";
import { createApp } from "../src/app";
import { createAuthHttp } from "../src/auth/http";
import { lockAccounts } from "../src/auth/locks";

type Connections = {
  migration: ReturnType<typeof createDatabase>;
  runtime: ReturnType<typeof createDatabase>;
};
async function captureFailure<T>(action: Promise<T>): Promise<HttpError> {
  try {
    await action;
  } catch (error) {
    if (error instanceof HttpError) return error;
    throw error;
  }
  throw new Error("Expected auth failure.");
}
async function withAccount(
  connections: Connections,
  action: (fixture: {
    email: string;
    password: string;
    userId: string;
    source: string;
    signal: AbortSignal;
    service: ReturnType<typeof createAuthService>;
    now: () => number;
    setTime: (time: number) => void;
    trackEmail: (email: string) => void;
    verify: Awaited<ReturnType<typeof createPasswordVerifier>>;
  }) => Promise<void>,
): Promise<void> {
  const email = `auth-${crypto.randomUUID()}@example.test`;
  const password = "Fixture password — bukan akun produksi";
  const source = "127.0.0.1";
  const emails = [email];
  let time = Date.parse("2026-09-17T00:00:00Z");
  const verify = await createPasswordVerifier();
  const [user] = await connections.migration.db
    .insert(adminUsers)
    .values({ email, passwordHash: await hashPassword(password) })
    .returning();
  if (!user) throw new Error("Fixture akun gagal.");
  const service = createAuthService({
    db: connections.runtime.db,
    verifyPassword: verify,
    now: () => time,
  });
  try {
    await action({
      email,
      password,
      userId: user.id,
      source,
      signal: new AbortController().signal,
      service,
      now: () => time,
      setTime: (next) => {
        time = next;
      },
      trackEmail: (value) => emails.push(value),
      verify,
    });
  } finally {
    await connections.migration.db
      .delete(adminSessions)
      .where(eq(adminSessions.adminUserId, user.id));
    await connections.migration.db.delete(adminUsers).where(eq(adminUsers.id, user.id));
    await connections.migration.db
      .delete(authThrottles)
      .where(
        inArray(authThrottles.bucketKey, [
          ...emails.map((value) => `email:${sha256(value)}`),
          `source:${sha256(source)}`,
        ]),
      );
  }
}

export function registerAuthDatabaseTests(getConnections: () => Connections): void {
  test("T-06 Argon2, hash token, rotasi, idle/absolut dan logout", async () => {
    const connections = getConnections();
    await withAccount(connections, async (f) => {
      const first = await f.service.login(f.email, f.password, f.source, undefined, f.signal);
      const [stored] = await connections.runtime.db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.adminUserId, f.userId));
      expect(stored?.tokenHash).toBe(sha256(first.token));
      expect(stored?.tokenHash).not.toBe(first.token);
      const second = await f.service.login(f.email, f.password, f.source, first.token, f.signal);
      expect(
        (await captureFailure(f.service.authenticate(first.token, f.signal))).detail.code,
      ).toBe("AUTH_REQUIRED");
      const created = f.now();
      f.setTime(created + IDLE_SESSION_MS - 1);
      expect((await f.service.authenticate(second.token, f.signal)).user.id).toBe(f.userId);
      f.setTime(created + 2 * IDLE_SESSION_MS - 1);
      expect(
        (await captureFailure(f.service.authenticate(second.token, f.signal))).detail.code,
      ).toBe("AUTH_REQUIRED");
      f.setTime(created + THROTTLE_WINDOW_MS * 4);
      const third = await f.service.login(f.email, f.password, f.source, undefined, f.signal);
      const absolute = f.now() + ABSOLUTE_SESSION_MS;
      for (let time = f.now() + IDLE_SESSION_MS - 1; time < absolute; time += IDLE_SESSION_MS - 1) {
        f.setTime(time);
        await f.service.authenticate(third.token, f.signal);
      }
      f.setTime(absolute);
      expect(
        (await captureFailure(f.service.authenticate(third.token, f.signal))).detail.code,
      ).toBe("AUTH_REQUIRED");
      const fourth = await f.service.login(f.email, f.password, f.source, undefined, f.signal);
      await f.service.logout(fourth.token, f.signal);
      await f.service.logout(fourth.token, f.signal);
      await f.service.logout(undefined, f.signal);
      expect(
        (await captureFailure(f.service.authenticate(fourth.token, f.signal))).detail.code,
      ).toBe("AUTH_REQUIRED");
    });
  }, 30_000);
  test("T-06 akun hilang, password salah dan akun nonaktif memiliki pesan sama", async () => {
    const connections = getConnections();
    await withAccount(connections, async (f) => {
      const missing = `missing-${f.email}`;
      f.trackEmail(missing);
      const absent = await captureFailure(
        f.service.login(missing, f.password, f.source, undefined, f.signal),
      );
      const wrong = await captureFailure(
        f.service.login(f.email, "wrong fixture password", f.source, undefined, f.signal),
      );
      await connections.migration.db.transaction(async (tx) => {
        await lockAccounts(tx, [f.userId]);
        await tx.update(adminUsers).set({ isActive: false }).where(eq(adminUsers.id, f.userId));
      });
      const disabled = await captureFailure(
        f.service.login(f.email, f.password, f.source, undefined, f.signal),
      );
      expect(absent.detail).toEqual({
        code: "INVALID_CREDENTIALS",
        message: "Email atau kata sandi tidak sesuai.",
      });
      expect(wrong.detail).toEqual(absent.detail);
      expect(disabled.detail).toEqual(absent.detail);
    });
  }, 30_000);
  test("T-06 reserve serentak tepat lima per email dan counter bertahan pada service baru", async () => {
    const connections = getConnections();
    await withAccount(connections, async (f) => {
      // This test isolates PostgreSQL throttle concurrency; hashing is covered above.
      const service = createAuthService({
        db: connections.runtime.db,
        verifyPassword: () => Promise.resolve(false),
        now: f.now,
      });
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          captureFailure(service.login(f.email, f.password, f.source, undefined, f.signal)),
        ),
      );
      expect(results.filter((result) => result.detail.code === "INVALID_CREDENTIALS")).toHaveLength(
        5,
      );
      expect(results.filter((result) => result.detail.code === "RATE_LIMITED")).toHaveLength(1);
      const restarted = createAuthService({
        db: connections.runtime.db,
        verifyPassword: f.verify,
        now: f.now,
      });
      const blocked = await captureFailure(
        restarted.login(f.email, f.password, f.source, undefined, f.signal),
      );
      expect(blocked.detail.code).toBe("RATE_LIMITED");
      expect(blocked.headers["Retry-After"]).toBe("900");
      f.setTime(f.now() + THROTTLE_WINDOW_MS);
      expect(
        (await restarted.login(f.email, f.password, f.source, undefined, f.signal)).session.user.id,
      ).toBe(f.userId);
    });
  }, 30_000);
  test("T-06 tiga puluh percobaan per sumber berlaku lintas email", async () => {
    const connections = getConnections();
    await withAccount(connections, async (f) => {
      const service = createAuthService({
        db: connections.runtime.db,
        verifyPassword: () => Promise.resolve(false),
        now: f.now,
      });
      for (let index = 0; index < 31; index++) {
        const email = `${index}-${f.email}`;
        f.trackEmail(email);
        const result = await captureFailure(
          service.login(email, f.password, f.source, undefined, f.signal),
        );
        expect(result.detail.code).toBe(index < 30 ? "INVALID_CREDENTIALS" : "RATE_LIMITED");
      }
    });
  }, 30_000);
  test("T-06 disable, reset hash selama login, revokasi dan cleanup", async () => {
    const connections = getConnections();
    await withAccount(connections, async (f) => {
      const login = await f.service.login(f.email, f.password, f.source, undefined, f.signal);
      await connections.migration.db.transaction(async (tx) => {
        await lockAccounts(tx, [f.userId]);
        await tx.update(adminUsers).set({ isActive: false }).where(eq(adminUsers.id, f.userId));
      });
      expect(
        (await captureFailure(f.service.authenticate(login.token, f.signal))).detail.code,
      ).toBe("AUTH_REQUIRED");
      await connections.migration.db
        .update(adminUsers)
        .set({ isActive: true })
        .where(eq(adminUsers.id, f.userId));
      const replacement = await hashPassword("Replacement fixture password");
      const resetDuringVerify = createAuthService({
        db: connections.runtime.db,
        now: f.now,
        verifyPassword: async () => {
          await connections.migration.db.transaction(async (tx) => {
            await lockAccounts(tx, [f.userId]);
            await tx
              .update(adminUsers)
              .set({ passwordHash: replacement })
              .where(eq(adminUsers.id, f.userId));
            await tx.delete(adminSessions).where(eq(adminSessions.adminUserId, f.userId));
          });
          return true;
        },
      });
      expect(
        (
          await captureFailure(
            resetDuringVerify.login(f.email, f.password, f.source, undefined, f.signal),
          )
        ).detail.code,
      ).toBe("INVALID_CREDENTIALS");
      expect(
        (await captureFailure(f.service.authenticate(login.token, f.signal))).detail.code,
      ).toBe("AUTH_REQUIRED");
      f.setTime(f.now() + ABSOLUTE_SESSION_MS + 1);
      const counts = await cleanupAuth(connections.runtime.db, f.now());
      expect(counts.counters).toBeGreaterThanOrEqual(2);
    });
  }, 30_000);
  test("T-06 cookie login/sesi/logout dikirim melalui HTTPS lokal nyata", async () => {
    const connections = getConnections();
    await withAccount(connections, async (f) => {
      const directory = await mkdtemp(join(tmpdir(), "umbul-auth-tls-"));
      let server: ReturnType<typeof Bun.serve> | undefined;
      try {
        const key = join(directory, "key.pem");
        const cert = join(directory, "cert.pem");
        const process = Bun.spawn(
          [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-keyout",
            key,
            "-out",
            cert,
            "-subj",
            "/CN=localhost",
            "-addext",
            "subjectAltName=DNS:localhost,IP:127.0.0.1",
            "-days",
            "1",
          ],
          { stdout: "ignore", stderr: "ignore" },
        );
        if ((await process.exited) !== 0)
          throw new Error("Sertifikat HTTPS fixture tidak dapat dibuat.");
        const sources = new WeakMap<Request, string>();
        server = Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          tls: { key: Bun.file(key), cert: Bun.file(cert) },
          fetch: async (request, listener) => {
            const address = listener.requestIP(request)?.address;
            if (address) sources.set(request, address);
            try {
              return await app.handle(request);
            } finally {
              sources.delete(request);
            }
          },
        });
        const origin = `https://127.0.0.1:${server.port}`;
        const auth = createAuthHttp({
          service: f.service,
          production: true,
          siteOrigin: origin,
          sourceAddress: (request) => sources.get(request),
        });
        const app = createApp({
          ...auth,
          ready: () => Promise.resolve(true),
          readProfile: () => Promise.resolve({ name: "UMBUL NOGO", region: "Wonogiri" }),
          log: () => {},
        });
        const headers = {
          origin,
          "x-umbul-client": "admin-web",
          "content-type": "application/json",
        };
        const login = await fetch(`${origin}/api/v1/auth/login`, {
          method: "POST",
          headers,
          body: JSON.stringify({ email: f.email, password: f.password }),
          tls: { rejectUnauthorized: false },
        });
        expect(login.status).toBe(200);
        const cookie = login.headers.get("set-cookie");
        expect(cookie).toContain("__Host-umbul_session=");
        expect(cookie).toContain("Secure");
        expect(cookie).toContain("HttpOnly");
        expect(cookie).not.toContain("Domain=");
        if (!cookie) throw new Error("Cookie fixture tidak tersedia.");
        const sessionHeaders = { ...headers, cookie: cookie.split(";")[0]! };
        await login.arrayBuffer();
        const current = await fetch(`${origin}/api/v1/auth/session`, {
          headers: sessionHeaders,
          tls: { rejectUnauthorized: false },
        });
        expect(current.status).toBe(200);
        await current.arrayBuffer();
        const logout = await fetch(`${origin}/api/v1/auth/logout`, {
          method: "POST",
          headers: sessionHeaders,
          body: "{}",
          tls: { rejectUnauthorized: false },
        });
        expect(logout.status).toBe(200);
        expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
        await logout.arrayBuffer();
        const revoked = await fetch(`${origin}/api/v1/auth/session`, {
          headers: sessionHeaders,
          tls: { rejectUnauthorized: false },
        });
        expect(revoked.status).toBe(401);
        await revoked.arrayBuffer();
      } finally {
        await server?.stop(true);
        await rm(directory, { recursive: true, force: true });
      }
    });
  }, 30_000);
}
