import { isIP } from "node:net";
import {
  loginRequestSchema,
  logoutRequestSchema,
  logoutResponseSchema,
  sessionResponseSchema,
} from "@umbul-nogo/contracts/auth";
import { failure } from "../http/errors";
import { jsonResponse, parseInput } from "../http/transport";
import type { HttpRoute, RequestContext } from "../http/transport";
import type { AuthService } from "./service";
import { readSessionToken, sessionCookie } from "./cookie";

export function createAuthHttp(options: {
  service: AuthService;
  siteOrigin: string;
  production: boolean;
  sourceAddress: (request: Request) => string | undefined;
}) {
  const { service, siteOrigin, production } = options;
  const authorizePrivate = async (context: RequestContext): Promise<void> => {
    const { request } = context;
    if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== siteOrigin)
      throw failure("ORIGIN_NOT_ALLOWED");
    if (request.headers.get("x-umbul-client") !== "admin-web")
      throw failure("CLIENT_HEADER_REQUIRED");
    const path = new URL(request.url).pathname;
    if (request.method === "POST" && ["/api/v1/auth/login", "/api/v1/auth/logout"].includes(path))
      return;
    context.session = await service.authenticate(
      readSessionToken(request, production),
      context.signal,
    );
  };
  const routes: HttpRoute[] = [
    {
      method: "POST",
      path: "/api/v1/auth/login",
      body: "json",
      handle: async (context) => {
        const input = parseInput(loginRequestSchema, context.body);
        const source = options.sourceAddress(context.request);
        if (!source || !isIP(source)) throw failure("SERVICE_UNAVAILABLE");
        const result = await service.login(
          input.email,
          input.password,
          source,
          readSessionToken(context.request, production),
          context.signal,
        );
        const response = jsonResponse(sessionResponseSchema, {
          success: true,
          data: result.session,
          meta: { requestId: context.requestId },
        });
        response.headers.set("set-cookie", sessionCookie(result.token, production));
        return response;
      },
    },
    {
      method: "GET",
      path: "/api/v1/auth/session",
      handle: (context) => {
        if (!context.session) throw failure("AUTH_REQUIRED");
        return jsonResponse(sessionResponseSchema, {
          success: true,
          data: context.session,
          meta: { requestId: context.requestId },
        });
      },
    },
    {
      method: "POST",
      path: "/api/v1/auth/logout",
      body: "json",
      handle: async (context) => {
        parseInput(logoutRequestSchema, context.body);
        await service.logout(readSessionToken(context.request, production), context.signal);
        const response = jsonResponse(logoutResponseSchema, {
          success: true,
          data: { loggedOut: true },
          meta: { requestId: context.requestId },
        });
        response.headers.set("set-cookie", sessionCookie(undefined, production));
        return response;
      },
    },
  ];
  return { routes, authorizePrivate };
}
