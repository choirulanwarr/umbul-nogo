import { z } from "zod";
import {
  mediaListQuerySchema,
  mediaListResponseSchema,
  mediaResponseSchema,
  mediaReadyResponseSchema,
  mediaPendingResponseSchema,
} from "@umbul-nogo/contracts/media";
import { idParamsSchema, keyParamsSchema } from "@umbul-nogo/contracts/primitives";
import { readSessionToken } from "../auth/cookie";
import { failure } from "../http/errors";
import { jsonResponse, parseInput } from "../http/transport";
import type { HttpRoute, RequestContext } from "../http/transport";
import type { MediaService } from "./service";
export function createMediaHttp(service: MediaService, production: boolean): HttpRoute[] {
  const actor = (context: RequestContext) => {
    if (!context.session) throw failure("AUTH_REQUIRED");
    return context.session.user.id;
  };
  const path = "/api/v1/admin/media";
  return [
    {
      method: "GET",
      path,
      queryKeys: ["status", "limit", "cursor"],
      handle: async (c) => {
        const userId = actor(c);
        if (c.query.cursor !== undefined && !c.query.cursor.trim()) throw failure("INVALID_CURSOR");
        const query = parseInput(mediaListQuerySchema, c.query);
        return jsonResponse(mediaListResponseSchema, {
          success: true,
          data: await service.list(
            userId,
            { ...query, ...(c.query.cursor !== undefined ? { cursor: c.query.cursor } : {}) },
            c.signal,
          ),
          meta: { requestId: c.requestId },
        });
      },
    },
    {
      method: "GET",
      path: `${path}/uploads/:key`,
      handle: async (c) =>
        jsonResponse(mediaResponseSchema, {
          success: true,
          data: await service.detail(
            actor(c),
            parseInput(keyParamsSchema, c.params).key,
            c.signal,
            true,
          ),
          meta: { requestId: c.requestId },
        }),
    },
    {
      method: "POST",
      path: `${path}/uploads`,
      body: "multipart",
      handle: async (c) => {
        actor(c);
        const { file } = parseInput(z.strictObject({ file: z.file() }), c.body);
        const result = await service.upload({
          token: readSessionToken(c.request, production),
          key: c.request.headers.get("idempotency-key") ?? "",
          file,
          signal: c.signal,
        });
        const response = jsonResponse(
          result.status === 202 ? mediaPendingResponseSchema : mediaReadyResponseSchema,
          { success: true, data: result.data, meta: { requestId: c.requestId } },
          result.status,
        );
        response.headers.set("location", `${path}/${result.data.id}`);
        if (result.status === 202) response.headers.set("retry-after", "2");
        return response;
      },
    },
    {
      method: "GET",
      path: `${path}/:id`,
      handle: async (c) =>
        jsonResponse(mediaResponseSchema, {
          success: true,
          data: await service.detail(actor(c), parseInput(idParamsSchema, c.params).id, c.signal),
          meta: { requestId: c.requestId },
        }),
    },
  ];
}
