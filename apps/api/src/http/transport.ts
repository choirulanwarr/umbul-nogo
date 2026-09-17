import { toFieldErrors } from "@umbul-nogo/contracts/errors";
import type { ErrorCode } from "@umbul-nogo/contracts/errors";
import type { ZodType } from "zod";
import { parseBody } from "./body";
import { errorResponse, failure, HttpError } from "./errors";

export type RequestLog = {
  time: string;
  level: "info" | "error";
  requestId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  code?: ErrorCode;
};
export type RequestContext = {
  request: Request;
  requestId: string;
  signal: AbortSignal;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
};
export type HttpRoute = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: "json" | "multipart";
  queryKeys?: readonly string[];
  authorize?: (context: RequestContext) => Promise<void>;
  handle: (context: RequestContext) => Promise<Response> | Response;
};
export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new HttpError({
      code: "VALIDATION_ERROR",
      message: "Periksa kembali data yang diisi.",
      fieldErrors: toFieldErrors(result.error),
    });
  return result.data;
}
export function jsonResponse<T>(schema: ZodType<T>, input: unknown, status = 200): Response {
  const result = schema.safeParse(input);
  if (!result.success) throw failure("INTERNAL_ERROR");
  return Response.json(result.data, { status });
}
export async function handleRequest(
  request: Request,
  routes: readonly HttpRoute[],
  params: Record<string, string>,
  log: (entry: RequestLog) => void,
  deadlineOverride?: number,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  const url = new URL(request.url);
  const isPrivate = /^\/api\/v1\/(admin|auth)(\/|$)/.test(url.pathname);
  const route = routes.find(
    (entry) => entry.method === (request.method === "HEAD" ? "GET" : request.method),
  );
  const controller = new AbortController();
  const deadline =
    deadlineOverride ??
    (route?.body === "multipart"
      ? 60_000
      : ["GET", "HEAD"].includes(request.method)
        ? 3000
        : 10_000);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectDeadline: ((error: Error) => void) | undefined;
  const abort = () => {
    controller.abort();
    rejectDeadline?.(failure("SERVICE_UNAVAILABLE"));
  };
  const expired = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
    timer = setTimeout(abort, deadline);
  });
  request.signal.addEventListener("abort", abort, { once: true });
  let code: ErrorCode | undefined;
  let response: Response;
  try {
    const work = async () => {
      if (request.signal.aborted) throw failure("SERVICE_UNAVAILABLE");
      if (!routes.length) throw failure("NOT_FOUND");
      if (!route) {
        const allowed = routes.flatMap((entry) =>
          entry.method === "GET" ? ["GET", "HEAD"] : [entry.method],
        );
        throw new HttpError(
          { code: "METHOD_NOT_ALLOWED", message: "Metode tidak diizinkan." },
          { Allow: [...new Set(allowed)].join(", ") },
        );
      }
      const context: RequestContext = {
        request,
        requestId,
        signal: controller.signal,
        params,
        query: {},
        body: undefined,
      };
      // Authentication/Origin hooks run before parsing; T-06 supplies real checks.
      if (route.authorize) await route.authorize(context);
      controller.signal.throwIfAborted();
      for (const [key, value] of url.searchParams) {
        if (Object.hasOwn(context.query, key)) throw failure("INVALID_REQUEST");
        if (!route.queryKeys?.includes(key)) throw failure("INVALID_REQUEST");
        Object.defineProperty(context.query, key, { value, enumerable: true });
      }
      context.body = await parseBody(request, route.body ?? "none", controller.signal);
      controller.signal.throwIfAborted();
      return route.handle(context);
    };
    response = await Promise.race([work(), expired]);
    if (response.status === 503) code = "SERVICE_UNAVAILABLE";
  } catch (error) {
    const mapped = errorResponse(
      controller.signal.aborted ? failure("SERVICE_UNAVAILABLE") : error,
      requestId,
    );
    response = mapped.response;
    code = mapped.code;
    if (route?.path === "/health/ready" && response.status >= 500)
      response = Response.json({ status: "unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    if (request.body && !request.bodyUsed) void request.body.cancel().catch(() => {});
  }
  response.headers.set("x-request-id", requestId);
  response.headers.set("cache-control", isPrivate ? "private, no-store" : "no-store");
  response.headers.set("x-content-type-options", "nosniff");
  log({
    time: new Date().toISOString(),
    level: response.status >= 500 ? "error" : "info",
    requestId,
    route: route?.path ?? routes[0]?.path ?? "unmatched",
    method: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"].includes(request.method)
      ? request.method
      : "OTHER",
    status: response.status,
    durationMs: Math.round(performance.now() - started),
    ...(code ? { code } : {}),
  });
  return request.method === "HEAD"
    ? new Response(null, { status: response.status, headers: response.headers })
    : response;
}
