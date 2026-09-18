import {
  ticketRateListResponseSchema,
  ticketRateResponseSchema,
} from "@umbul-nogo/contracts/ticket-rates";
import { deleteContentQuerySchema, idParamsSchema } from "@umbul-nogo/contracts/primitives";
import { mutationRequest, mutationResponse } from "../content/http";
import { jsonResponse, parseInput } from "../http/transport";
import type { HttpRoute, RequestContext } from "../http/transport";
import { failure } from "../http/errors";
import { TICKET_PATH } from "./service";
import type { TicketRateService } from "./service";

export function createTicketRateHttp({
  service,
  production,
}: {
  service: TicketRateService;
  production: boolean;
}): HttpRoute[] {
  const mutate = async (context: RequestContext, input = context.body) =>
    mutationResponse(await service.mutate(mutationRequest(context, production, input)));
  return [
    {
      method: "GET",
      path: TICKET_PATH,
      handle: async (context) => {
        if (!context.session) throw failure("AUTH_REQUIRED");
        const result = await service.list(context.signal);
        return jsonResponse(ticketRateListResponseSchema, {
          success: true,
          data: { items: result.items },
          meta: { requestId: context.requestId, ...result.state },
        });
      },
    },
    { method: "POST", path: TICKET_PATH, body: "json", handle: (context) => mutate(context) },
    {
      method: "PUT",
      path: `${TICKET_PATH}/order`,
      body: "json",
      handle: (context) => mutate(context),
    },
    {
      method: "GET",
      path: `${TICKET_PATH}/:id`,
      handle: async (context) => {
        if (!context.session) throw failure("AUTH_REQUIRED");
        const { id } = parseInput(idParamsSchema, context.params);
        const result = await service.detail(id, context.signal);
        return jsonResponse(ticketRateResponseSchema, {
          success: true,
          data: result.items[0],
          meta: { requestId: context.requestId, ...result.state },
        });
      },
    },
    {
      method: "PUT",
      path: `${TICKET_PATH}/:id`,
      body: "json",
      handle: (context) => {
        parseInput(idParamsSchema, context.params);
        return mutate(context);
      },
    },
    {
      method: "DELETE",
      path: `${TICKET_PATH}/:id`,
      queryKeys: ["expectedContentVersion"],
      handle: (context) => {
        parseInput(idParamsSchema, context.params);
        return mutate(context, parseInput(deleteContentQuerySchema, context.query));
      },
    },
  ];
}
