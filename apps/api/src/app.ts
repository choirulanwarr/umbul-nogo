import { errorResponse, failure } from "./http/errors";
import { Elysia } from "elysia";
import { bootstrapResponseSchema } from "@umbul-nogo/contracts/bootstrap";
import type { BootstrapSite } from "@umbul-nogo/contracts/bootstrap";
import { handleRequest, jsonResponse } from "./http/transport";
import type { HttpRoute, RequestLog } from "./http/transport";

export type AppDependencies = {
  readProfile: (signal: AbortSignal) => Promise<BootstrapSite>;
  ready: (signal: AbortSignal) => Promise<boolean>;
  log: (entry: RequestLog) => void;
  routes?: readonly HttpRoute[];
  // Injectable only for deterministic tests; not configurable by HTTP clients.
  deadlineMs?: number;
};
export function createApp(dependencies: AppDependencies) {
  const routes: HttpRoute[] = [
    { method: "GET", path: "/health/live", handle: () => Response.json({ status: "ok" }) },
    {
      method: "GET",
      path: "/health/ready",
      handle: async ({ signal }) => {
        let ready = false;
        try {
          ready = await dependencies.ready(signal);
        } catch {
          /* Dependency diagnostics stay private. */
        }
        return Response.json(
          { status: ready ? "ok" : "unavailable" },
          { status: ready ? 200 : 503 },
        );
      },
    },
    {
      method: "GET",
      path: "/internal/bootstrap",
      handle: async ({ requestId, signal }) =>
        jsonResponse(bootstrapResponseSchema, {
          success: true,
          data: await dependencies.readProfile(signal),
          meta: { requestId },
        }),
    },
    ...(dependencies.routes ?? []),
  ];
  for (const route of dependencies.routes ?? []) {
    if (!route.path.startsWith("/api/v1/") || route.path.endsWith("/"))
      throw new Error("Route API harus memakai path /api/v1 kanonis.");
  }
  const app = new Elysia({ strictPath: true, normalize: false });
  app.onError(({ request, code }) => {
    const requestId = crypto.randomUUID();
    const mapped = errorResponse(
      failure(code === "NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_ERROR"),
      requestId,
    );
    mapped.response.headers.set("x-request-id", requestId);
    mapped.response.headers.set(
      "cache-control",
      /^\/api\/v1\/(admin|auth)(\/|$)/.test(new URL(request.url).pathname)
        ? "private, no-store"
        : "no-store",
    );
    dependencies.log({
      time: new Date().toISOString(),
      level: "error",
      requestId,
      route: "framework",
      method: "OTHER",
      status: mapped.response.status,
      durationMs: 0,
      code: mapped.code,
    });
    return request.method === "HEAD"
      ? new Response(null, { status: mapped.response.status, headers: mapped.response.headers })
      : mapped.response;
  });
  const paths = new Set(routes.map((route) => route.path));
  for (const path of paths) {
    const methods = routes.filter((route) => route.path === path);
    if (new Set(methods.map((route) => route.method)).size !== methods.length)
      throw new Error("Route duplikat.");
    app.all(
      path,
      ({ request, params }) =>
        handleRequest(request, methods, params, dependencies.log, dependencies.deadlineMs),
      { parse: "none" },
    );
  }
  app.all(
    "/*",
    ({ request }) => handleRequest(request, [], {}, dependencies.log, dependencies.deadlineMs),
    { parse: "none" },
  );
  return app;
}
