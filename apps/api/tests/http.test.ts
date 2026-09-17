import { expect, test } from "bun:test";
import { bootstrapResponseSchema } from "@umbul-nogo/contracts/bootstrap";
import { apiFailureSchema } from "@umbul-nogo/contracts/errors";
import { ticketRateCreateSchema } from "@umbul-nogo/contracts/ticket-rates";
import { createApp } from "../src/app";
import { readEnvironment } from "../src/env";
import { createShutdown } from "../src/lifecycle";
import { jsonResponse, parseInput } from "../src/http/transport";
import type { HttpRoute, RequestLog } from "../src/http/transport";
import { failure } from "../src/http/errors";

const site = { name: "UMBUL NOGO", region: "Wonogiri, Jawa Tengah" };
const ticket = {
  name: "Contoh — data uji",
  priceIdr: 0,
  unit: "orang",
  terms: "Data uji",
  applicabilityNote: null,
  expectedContentVersion: 0,
};
function fixture(routes: HttpRoute[] = [], ready = true) {
  const logs: RequestLog[] = [];
  const app = createApp({
    readProfile: () => Promise.resolve(site),
    ready: () => Promise.resolve(ready),
    log: (entry) => logs.push(entry),
    routes,
  });
  return { app, logs };
}
function success(requestId: string) {
  return jsonResponse(bootstrapResponseSchema, { success: true, data: site, meta: { requestId } });
}
const jsonRoute: HttpRoute = {
  method: "POST",
  path: "/api/v1/admin/fixture",
  body: "json",
  handle: ({ body, requestId }) => {
    parseInput(ticketRateCreateSchema, body);
    return success(requestId);
  },
};
async function errorCode(response: Response) {
  return apiFailureSchema.parse(await response.json()).error.code;
}

test("bootstrap DB dependency, request ID server, HEAD, Allow dan query strict", async () => {
  const { app } = fixture();
  const response = await app.handle(
    new Request("http://localhost/internal/bootstrap", {
      headers: { "x-request-id": "untrusted" },
    }),
  );
  const body = bootstrapResponseSchema.parse(await response.json());
  expect(body.data).toEqual(site);
  expect(response.headers.get("x-request-id")).toBe(body.meta.requestId);
  expect(body.meta.requestId).not.toBe("untrusted");
  expect(response.headers.get("cache-control")).toBe("no-store");
  const head = await app.handle(
    new Request("http://localhost/internal/bootstrap", { method: "HEAD" }),
  );
  expect(head.status).toBe(200);
  expect(await head.text()).toBe("");
  const method = await app.handle(
    new Request("http://localhost/internal/bootstrap", { method: "PUT" }),
  );
  expect(method.status).toBe(405);
  expect(method.headers.get("allow")).toBe("GET, HEAD");
  for (const path of ["/internal/bootstrap?unknown=1", "/internal/bootstrap?x=1&x=2"])
    expect((await app.handle(new Request(`http://localhost${path}`))).status).toBe(400);
  expect((await app.handle(new Request("http://localhost/internal/bootstrap/"))).status).toBe(404);
});
test("JSON invalid, field tambahan, nominal string, content type, dan cache error privat", async () => {
  const { app } = fixture([jsonRoute]);
  for (const [body, status] of [
    [JSON.stringify(ticket), 200],
    ["{", 400],
    [JSON.stringify({ ...ticket, priceIdr: "0" }), 422],
    [JSON.stringify({ ...ticket, injected: true }), 422],
  ] as const) {
    const response = await app.handle(
      new Request("http://localhost/api/v1/admin/fixture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    );
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  }
  const badType = await app.handle(
    new Request("http://localhost/api/v1/admin/fixture", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    }),
  );
  expect(badType.status).toBe(415);
  expect(await errorCode(badType)).toBe("UNSUPPORTED_MEDIA_TYPE");
});
test("batas byte JSON termasuk stream tanpa Content-Length dan UTF-8 invalid", async () => {
  const { app } = fixture([{ ...jsonRoute, handle: ({ requestId }) => success(requestId) }]);
  for (const [size, status] of [
    [65_536, 200],
    [65_537, 413],
  ] as const) {
    const encoded = new TextEncoder().encode('"' + "a".repeat(size - 2) + '"');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, 100));
        controller.enqueue(encoded.slice(100));
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/v1/admin/fixture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
    });
    expect(request.headers.has("content-length")).toBe(false);
    expect((await app.handle(request)).status).toBe(status);
  }
  const bad = await app.handle(
    new Request("http://localhost/api/v1/admin/fixture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new Uint8Array([0xff]),
    }),
  );
  expect(bad.status).toBe(400);
  const length = await app.handle(
    new Request("http://localhost/api/v1/admin/fixture", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "65537" },
      body: "{}",
    }),
  );
  expect(length.status).toBe(413);
});
test("multipart hanya satu file, lebih dari batas ditolak sebelum parsing", async () => {
  const { app } = fixture([
    {
      method: "POST",
      path: "/api/v1/admin/upload-fixture",
      body: "multipart",
      handle: ({ requestId }) => success(requestId),
    },
  ]);
  const form = new FormData();
  form.append("file", new File(["fixture"], "fixture.txt"));
  expect(
    (
      await app.handle(
        new Request("http://localhost/api/v1/admin/upload-fixture", { method: "POST", body: form }),
      )
    ).status,
  ).toBe(200);
  form.append("file", new File(["second"], "second.txt"));
  expect(
    (
      await app.handle(
        new Request("http://localhost/api/v1/admin/upload-fixture", { method: "POST", body: form }),
      )
    ).status,
  ).toBe(400);
  const request = new Request("http://localhost/api/v1/admin/upload-fixture", {
    method: "POST",
    headers: {
      "content-type": "multipart/form-data; boundary=fixture",
      "content-length": "6291457",
    },
    body: "x",
  });
  expect((await app.handle(request)).status).toBe(413);
});
test("query berulang ditolak, parameter path tidak masuk log", async () => {
  const { app, logs } = fixture([
    {
      method: "GET",
      path: "/api/v1/public/items/:id",
      queryKeys: ["limit"],
      handle: ({ requestId }) => success(requestId),
    },
  ]);
  expect(
    (await app.handle(new Request("http://localhost/api/v1/public/items/PRIVATE?limit=1&limit=2")))
      .status,
  ).toBe(400);
  expect(JSON.stringify(logs)).not.toContain("PRIVATE");
  expect(logs[0]?.route).toBe("/api/v1/public/items/:id");
});
test("otorisasi mendahului parsing, tidak mencetak body/cookie atau error provider", async () => {
  const { app, logs } = fixture([
    { ...jsonRoute, authorize: () => Promise.reject(failure("AUTH_REQUIRED")) },
  ]);
  const response = await app.handle(
    new Request("http://localhost/api/v1/admin/fixture?PRIVATE=secret", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "PRIVATE=secret" },
      body: "PRIVATE invalid JSON",
    }),
  );
  expect(response.status).toBe(401);
  expect(JSON.stringify(logs)).not.toContain("PRIVATE");
  const broken = fixture([
    {
      method: "GET",
      path: "/api/v1/public/broken",
      handle: () => {
        throw new Error("PRIVATE SQL connection string");
      },
    },
  ]);
  const failureResponse = await broken.app.handle(
    new Request("http://localhost/api/v1/public/broken"),
  );
  expect(failureResponse.status).toBe(500);
  expect(await errorCode(failureResponse)).toBe("INTERNAL_ERROR");
  expect(JSON.stringify(broken.logs)).not.toContain("PRIVATE");
});
test("readiness DB gagal menghasilkan 503 tanpa detail dan liveness tetap 200", async () => {
  const { app } = fixture([], false);
  expect((await app.handle(new Request("http://localhost/health/live"))).status).toBe(200);
  const ready = await app.handle(new Request("http://localhost/health/ready"));
  expect(ready.status).toBe(503);
  expect(await ready.json()).toEqual({ status: "unavailable" });
});
test("deadline membatalkan dependency dan tidak mengubah gagal menjadi sukses", async () => {
  let aborted = false;
  const app = createApp({
    ready: () => Promise.resolve(true),
    log: () => {},
    deadlineMs: 5,
    readProfile: (signal) =>
      new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(new Error("PRIVATE timeout"));
          },
          { once: true },
        );
      }),
  });
  const response = await app.handle(new Request("http://localhost/internal/bootstrap"));
  expect(response.status).toBe(503);
  expect(aborted).toBe(true);
  expect(await errorCode(response)).toBe("SERVICE_UNAVAILABLE");
});
test("output invalid diperlakukan sebagai internal error", async () => {
  const { app } = fixture([
    {
      method: "GET",
      path: "/api/v1/public/invalid-output",
      handle: () => jsonResponse(bootstrapResponseSchema, { success: true, data: {} }),
    },
  ]);
  expect(
    (await app.handle(new Request("http://localhost/api/v1/public/invalid-output"))).status,
  ).toBe(500);
});
test("environment wajib, HTTPS produksi, role runtime dan pesan tanpa secret", () => {
  const env = {
    NODE_ENV: "production",
    SITE_ORIGIN: "https://example.test",
    DATABASE_URL: "postgresql://umbul_runtime:PRIVATE@127.0.0.1:5434/umbul_nogo_test",
  };
  expect(readEnvironment(env).port).toBe(3001);
  for (const change of [
    { SITE_ORIGIN: "http://example.test" },
    { SITE_ORIGIN: undefined },
    { DATABASE_URL: undefined },
    { DATABASE_URL: "postgresql://umbul_migrator:PRIVATE@localhost/db" },
    { API_PORT: "1.5" },
    { API_PORT: "65536" },
  ]) {
    let caught: unknown;
    try {
      readEnvironment({ ...env, ...change });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(String(caught)).not.toContain("PRIVATE");
  }
});
test("shutdown idempotent menutup pool setelah drain", async () => {
  const calls: string[] = [];
  const stop = createShutdown({
    drain: () => {
      calls.push("drain");
      return Promise.resolve();
    },
    force: () => {
      calls.push("force");
      return Promise.resolve();
    },
    closeDatabase: () => {
      calls.push("close");
      return Promise.resolve();
    },
  });
  await Promise.all([stop(), stop()]);
  expect(calls).toEqual(["drain", "close"]);
});
test("shutdown memaksa penutupan setelah grace period", async () => {
  const calls: string[] = [];
  const stop = createShutdown({
    graceMs: 5,
    drain: () => new Promise(() => {}),
    force: () => {
      calls.push("force");
      return Promise.resolve();
    },
    closeDatabase: () => {
      calls.push("close");
      return Promise.resolve();
    },
  });
  await stop();
  expect(calls).toEqual(["force", "close"]);
});
