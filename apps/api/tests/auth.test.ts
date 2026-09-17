import { expect, test } from "bun:test";
import { apiFailureSchema } from "@umbul-nogo/contracts/errors";
import { sessionResponseSchema } from "@umbul-nogo/contracts/auth";
import type { SessionDto } from "@umbul-nogo/contracts/auth";
import { createApp } from "../src/app";
import { createAuthHttp } from "../src/auth/http";
import { readSessionToken, sessionCookie } from "../src/auth/cookie";
import type { AuthService } from "../src/auth/service";
import { failure } from "../src/http/errors";
import type { RequestLog } from "../src/http/transport";

const token = "a".repeat(43);
const origin = "https://example.test";
const session: SessionDto = {
  user: {
    id: "8fb7c8ae-7b48-4dd2-8253-b312c1d86d38",
    email: "fixture@example.test",
    role: "admin",
  },
  expiresAt: "2026-09-17T08:00:00Z",
  idleExpiresAt: "2026-09-17T00:30:00Z",
};
function fixture(options: { failLogout?: boolean; missingSource?: boolean } = {}) {
  const calls: string[] = [];
  const logs: RequestLog[] = [];
  const service: AuthService = {
    login: (email, password, source) => {
      calls.push(`login:${email}:${password}:${source}`);
      return Promise.resolve({ token, session });
    },
    authenticate: (value) => {
      calls.push("authenticate");
      return value === token ? Promise.resolve(session) : Promise.reject(failure("AUTH_REQUIRED"));
    },
    logout: () => {
      calls.push("logout");
      return options.failLogout
        ? Promise.reject(failure("SERVICE_UNAVAILABLE"))
        : Promise.resolve();
    },
  };
  const auth = createAuthHttp({
    service,
    production: true,
    siteOrigin: origin,
    sourceAddress: () => (options.missingSource ? undefined : "127.0.0.1"),
  });
  const app = createApp({
    ...auth,
    readProfile: () => Promise.resolve({ name: "UMBUL NOGO", region: "Wonogiri" }),
    ready: () => Promise.resolve(true),
    log: (entry) => logs.push(entry),
    routes: [
      ...auth.routes,
      {
        method: "POST",
        path: "/api/v1/admin/media/uploads",
        body: "multipart",
        handle: () => {
          calls.push("upload");
          return Response.json({ success: true });
        },
      },
      {
        method: "GET",
        path: "/api/v1/admin/mutation-receipts/:key",
        handle: () => {
          calls.push("receipt");
          return Response.json({ success: true });
        },
      },
    ],
  });
  return { app, calls, logs };
}
const headers = { origin, "x-umbul-client": "admin-web", "content-type": "application/json" };
const credentials = { email: " FIXTURE@EXAMPLE.TEST ", password: "  fixture password  " };
async function code(response: Response) {
  return apiFailureSchema.parse(await response.json()).error.code;
}

test("login normalize email tanpa mengubah password, cookie host-only dan DTO tanpa token", async () => {
  const { app, calls, logs } = fixture();
  const response = await app.handle(
    new Request(`${origin}/api/v1/auth/login`, {
      method: "POST",
      headers: { ...headers, "x-forwarded-for": "203.0.113.12" },
      body: JSON.stringify(credentials),
    }),
  );
  expect(response.status).toBe(200);
  expect(calls).toEqual(["login:fixture@example.test:  fixture password  :127.0.0.1"]);
  expect(response.headers.get("set-cookie")).toBe(
    `__Host-umbul_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800; Secure`,
  );
  const body = sessionResponseSchema.parse(await response.json());
  expect(body.data).toEqual(session);
  expect(JSON.stringify(body)).not.toContain(token);
  expect(JSON.stringify(logs)).not.toContain("fixture@example.test");
  expect(JSON.stringify(logs)).not.toContain("fixture password");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
test("Origin kosong/null/asing dan header salah ditolak sebelum body/sesi/upload", async () => {
  for (const path of ["/api/v1/auth/login", "/api/v1/auth/logout", "/api/v1/admin/media/uploads"]) {
    for (const value of [undefined, "null", "https://foreign.test"]) {
      const { app, calls } = fixture();
      const requestHeaders: Record<string, string> = { "x-umbul-client": "admin-web" };
      if (value !== undefined) requestHeaders.origin = value;
      const response = await app.handle(
        new Request(`${origin}${path}`, {
          method: "POST",
          headers: requestHeaders,
          body: "INVALID PRIVATE JSON",
        }),
      );
      expect(response.status).toBe(403);
      expect(await code(response)).toBe("ORIGIN_NOT_ALLOWED");
      expect(calls).toEqual([]);
    }
    const { app } = fixture();
    const response = await app.handle(
      new Request(`${origin}${path}`, { method: "POST", headers: { origin }, body: "{}" }),
    );
    expect(await code(response)).toBe("CLIENT_HEADER_REQUIRED");
  }
});
test("GET sesi/receipt tetap memerlukan header aplikasi serta sesi aktif", async () => {
  for (const path of ["/api/v1/auth/session", "/api/v1/admin/mutation-receipts/key"]) {
    const { app, calls } = fixture();
    expect((await app.handle(new Request(`${origin}${path}`))).status).toBe(403);
    const response = await app.handle(
      new Request(`${origin}${path}`, { headers: { "x-umbul-client": "admin-web" } }),
    );
    expect(response.status).toBe(401);
    expect(calls).not.toContain("receipt");
    const valid = await app.handle(
      new Request(`${origin}${path}`, {
        headers: { "x-umbul-client": "admin-web", cookie: `__Host-umbul_session=${token}` },
      }),
    );
    expect(valid.status).toBe(200);
  }
});
test("upload tanpa sesi ditolak sebelum parser multipart", async () => {
  const { app, calls } = fixture();
  const response = await app.handle(
    new Request(`${origin}/api/v1/admin/media/uploads`, {
      method: "POST",
      headers,
      body: "invalid multipart",
    }),
  );
  expect(response.status).toBe(401);
  expect(calls).toEqual(["authenticate"]);
});
test("logout berhasil menghapus cookie, kegagalan DB tidak mengklaim logout", async () => {
  for (const failLogout of [false, true]) {
    const { app } = fixture({ failLogout });
    const response = await app.handle(
      new Request(`${origin}/api/v1/auth/logout`, {
        method: "POST",
        headers: { ...headers, cookie: `__Host-umbul_session=${token}` },
        body: "{}",
      }),
    );
    expect(response.status).toBe(failLogout ? 503 : 200);
    if (failLogout) expect(response.headers.get("set-cookie")).toBeNull();
    else
      expect(response.headers.get("set-cookie")).toBe(
        "__Host-umbul_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure",
      );
  }
});
test("cookie development terpisah, malformed ditolak dan duplicate ambigu gagal", () => {
  expect(sessionCookie(token, false)).toContain("umbul_session_dev=");
  expect(sessionCookie(token, false)).not.toContain("Secure");
  expect(
    readSessionToken(
      new Request(origin, { headers: { cookie: "__Host-umbul_session=bad" } }),
      true,
    ),
  ).toBeUndefined();
  expect(
    readSessionToken(
      new Request(origin, { headers: { cookie: `umbul_session_dev=${token}` } }),
      true,
    ),
  ).toBeUndefined();
  expect(() =>
    readSessionToken(
      new Request(origin, {
        headers: { cookie: `__Host-umbul_session=${token}; __Host-umbul_session=${token}` },
      }),
      true,
    ),
  ).toThrow();
});
test("namespace privat fail closed bila guard tidak dipasang", async () => {
  const app = createApp({
    readProfile: () => Promise.resolve({ name: "UMBUL NOGO", region: "Wonogiri" }),
    ready: () => Promise.resolve(true),
    log: () => {},
    routes: [
      {
        method: "GET",
        path: "/api/v1/admin/missing-guard",
        handle: () => Response.json({ shouldNotRun: true }),
      },
    ],
  });
  expect((await app.handle(new Request(`${origin}/api/v1/admin/missing-guard`))).status).toBe(401);
});
test("header forwarded tidak menggantikan identitas koneksi yang hilang", async () => {
  const { app, calls } = fixture({ missingSource: true });
  const response = await app.handle(
    new Request(`${origin}/api/v1/auth/login`, {
      method: "POST",
      headers: { ...headers, "x-forwarded-for": "192.0.2.1" },
      body: JSON.stringify(credentials),
    }),
  );
  expect(response.status).toBe(503);
  expect(calls).toEqual([]);
});
