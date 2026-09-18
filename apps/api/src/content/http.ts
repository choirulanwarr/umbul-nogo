import {
  mutationReceiptQuerySchema,
  mutationReceiptResponseSchema,
} from "@umbul-nogo/contracts/mutation-receipts";
import { keyParamsSchema } from "@umbul-nogo/contracts/primitives";
import { readSessionToken } from "../auth/cookie";
import { failure } from "../http/errors";
import { jsonResponse, parseInput } from "../http/transport";
import type { HttpRoute, RequestContext } from "../http/transport";
import type { ContentService, MutationRequest, MutationResult } from "./service";

// Future content routes call this only behind the mandatory namespace guard.
export function mutationRequest(
  context: RequestContext,
  production: boolean,
  input = context.body,
): MutationRequest {
  if (!context.session) throw failure("AUTH_REQUIRED");
  return {
    token: readSessionToken(context.request, production),
    signal: context.signal,
    method: context.request.method,
    path: new URL(context.request.url).pathname,
    key: context.request.headers.get("idempotency-key") ?? "",
    requestId: context.requestId,
    input,
  };
}
export function mutationResponse(result: MutationResult): Response {
  return Response.json(result.body, {
    status: result.status,
    headers: result.location ? { Location: result.location } : {},
  });
}
export function createContentHttp(options: {
  service: Pick<ContentService, "lookup">;
  production: boolean;
}): HttpRoute[] {
  return [
    {
      method: "GET",
      path: "/api/v1/admin/mutation-receipts/:key",
      queryKeys: ["method", "path"],
      handle: async (context) => {
        if (!context.session) throw failure("AUTH_REQUIRED");
        const { key } = parseInput(keyParamsSchema, context.params);
        const query = parseInput(mutationReceiptQuerySchema, context.query);
        const receipt = await options.service.lookup({
          ...query,
          key,
          token: readSessionToken(context.request, options.production),
          signal: context.signal,
        });
        return jsonResponse(mutationReceiptResponseSchema, {
          success: true,
          data: receipt,
          meta: { requestId: context.requestId },
        });
      },
    },
  ];
}
