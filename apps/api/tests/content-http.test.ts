import { expect, test } from "bun:test";
import { apiFailureSchema } from "@umbul-nogo/contracts/errors";
import {
  mutationReceiptResponseSchema,
  mutationReceiptSchema,
} from "@umbul-nogo/contracts/mutation-receipts";
import { createApp } from "../src/app";
import { createAuthHttp } from "../src/auth/http";
import { createContentHttp, mutationResponse } from "../src/content/http";
import { failure } from "../src/http/errors";
import type { RequestLog } from "../src/http/transport";

const origin = "https://example.test";
const token = "a".repeat(43);
const key = "13c10cd4-226c-4efb-95e5-591781a79ce3";
const requestId = "8fb7c8ae-7b48-4dd2-8253-b312c1d86d38";
const expiresAt = "2030-01-02T00:00:00.000Z";
const receipt = mutationReceiptSchema.parse({
  key,
  method: "PUT",
  path: "/api/v1/admin/operations",
  expiresAt,
  responseStatus: 200,
  responseBody: {
    success: true,
    data: {
      monthlyBudgetIdr: 0,
      destinationManagerName: null,
      destinationManagerPhone: null,
      destinationManagerEmail: null,
      technicalOperatorName: null,
      technicalOperatorPhone: null,
      technicalOperatorEmail: null,
      internalNotes: "private fixture",
    },
    meta: {
      requestId,
      contentVersion: 1,
      publicUpdatedAt: "2030-01-01T00:00:00.000Z",
      ticketsUpdatedAt: null,
      idempotency: { key, originalRequestId: requestId, replayed: false, expiresAt },
    },
  },
});
function fixture(missing = false) {
  const calls: unknown[] = [];
  const logs: RequestLog[] = [];
  const auth = createAuthHttp({
    production: true,
    siteOrigin: origin,
    sourceAddress: () => "127.0.0.1",
    service: {
      login: () => Promise.reject(failure("AUTH_REQUIRED")),
      logout: () => Promise.resolve(),
      authenticate: (value) =>
        value === token
          ? Promise.resolve({
              user: { id: requestId, email: "fixture@example.test", role: "admin" },
              expiresAt,
              idleExpiresAt: expiresAt,
            })
          : Promise.reject(failure("AUTH_REQUIRED")),
    },
  });
  const app = createApp({
    ...auth,
    ready: () => Promise.resolve(true),
    readProfile: () => Promise.resolve({ name: "UMBUL NOGO", region: "Wonogiri" }),
    log: (entry) => logs.push(entry),
    routes: [
      ...auth.routes,
      ...createContentHttp({
        production: true,
        service: {
          lookup: (request) => {
            calls.push(request);
            return missing
              ? Promise.reject(failure("RECEIPT_NOT_FOUND"))
              : Promise.resolve(receipt);
          },
        },
      }),
    ],
  });
  return { app, calls, logs };
}
const headers = { "x-umbul-client": "admin-web", cookie: `__Host-umbul_session=${token}` };
const path = `/api/v1/admin/mutation-receipts/${key}?method=PUT&path=%2Fapi%2Fv1%2Fadmin%2Foperations`;
test("T-08 receipt HTTP menjaga body asli, private cache, request ID dan log tanpa isi", async () => {
  const { app, calls, logs } = fixture();
  const response = await app.handle(new Request(origin + path, { headers }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  const result = mutationReceiptResponseSchema.parse(await response.json());
  expect(result.data).toEqual(receipt);
  expect(result.meta.requestId).toBe(response.headers.get("x-request-id")!);
  expect(result.meta.requestId).not.toBe(requestId);
  expect(calls).toHaveLength(1);
  for (const secret of [token, "private fixture", "monthlyBudgetIdr", key])
    expect(JSON.stringify(logs)).not.toContain(secret);
  const head = await app.handle(new Request(origin + path, { method: "HEAD", headers }));
  expect(head.status).toBe(200);
  expect(await head.text()).toBe("");
});
test("T-08 lookup menolak sesi, katalog path asing, key dan query invalid sebelum service", async () => {
  const { app, calls } = fixture();
  expect((await app.handle(new Request(origin + path))).status).toBe(403);
  expect(
    (await app.handle(new Request(origin + path, { headers: { "x-umbul-client": "admin-web" } })))
      .status,
  ).toBe(401);
  for (const invalid of [
    path.replace(key, "not-a-key"),
    path + "&method=PUT",
    path + "&extra=1",
    path.replace("operations", "auth%2Flogin"),
    path.replace("method=PUT", "method=GET"),
    path.replace("operations", "operations%2F"),
  ]) {
    const response = await app.handle(new Request(origin + invalid, { headers }));
    expect([400, 422]).toContain(response.status);
  }
  expect(calls).toHaveLength(0);
});
test("T-08 lookup 404 menyatakan hasil belum pasti; create response memuat Location", async () => {
  const { app } = fixture(true);
  const response = await app.handle(new Request(origin + path, { headers }));
  expect(response.status).toBe(404);
  const error = apiFailureSchema.parse(await response.json());
  expect(error.error.code).toBe("RECEIPT_NOT_FOUND");
  expect(error.error.message).toContain("belum dapat dipastikan");
  const created = mutationResponse({
    status: 201,
    body: receipt.responseBody,
    location: `/api/v1/admin/ticket-rates/${requestId}`,
  });
  expect(created.status).toBe(201);
  expect(created.headers.get("location")).toBe(`/api/v1/admin/ticket-rates/${requestId}`);
});
