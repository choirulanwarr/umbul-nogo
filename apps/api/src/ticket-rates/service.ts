import { eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import { contentStateSchema, orderRequestSchema } from "@umbul-nogo/contracts/envelopes";
import { contentVersionSchema, uuidSchema } from "@umbul-nogo/contracts/primitives";
import { publicSiteSchema } from "@umbul-nogo/contracts/public-site";
import {
  ticketRateCreateSchema,
  ticketRateUpdateSchema,
  ticketRateDtoSchema,
} from "@umbul-nogo/contracts/ticket-rates";
import type { TicketRateFields } from "@umbul-nogo/contracts/ticket-rates";
import type { Database } from "../db/client";
import { siteState, ticketRates } from "../db/schema";
import { authTimeouts } from "../auth/locks";
import { createContentService } from "../content/service";
import type { MutationRequest, MutationResult } from "../content/service";
import { failure, HttpError } from "../http/errors";
import { parseInput } from "../http/transport";

export const TICKET_PATH = "/api/v1/admin/ticket-rates";
function dto(row: typeof ticketRates.$inferSelect) {
  const parsed = ticketRateDtoSchema.safeParse({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  });
  if (!parsed.success) throw failure("INTERNAL_ERROR");
  return parsed.data;
}
function fields(input: TicketRateFields): TicketRateFields {
  return {
    name: input.name,
    priceIdr: input.priceIdr,
    unit: input.unit,
    terms: input.terms,
    applicabilityNote: input.applicabilityNote,
    isVisible: input.isVisible,
  };
}
// The exact public DTO fields, in public order. Position numbers and admin
// timestamps are intentionally absent: moving hidden items is not a public edit.
export async function ticketProjection(tx: Database) {
  const rows = await tx
    .select({
      id: ticketRates.id,
      name: ticketRates.name,
      priceIdr: ticketRates.priceIdr,
      unit: ticketRates.unit,
      terms: ticketRates.terms,
      applicabilityNote: ticketRates.applicabilityNote,
    })
    .from(ticketRates)
    .where(eq(ticketRates.isVisible, true))
    .orderBy(ticketRates.sortOrder, ticketRates.id);
  const parsed = publicSiteSchema.shape.tickets.shape.items.safeParse(rows);
  if (!parsed.success) throw failure("INTERNAL_ERROR");
  return { public: parsed.data, tickets: parsed.data };
}
export function createTicketRateService({
  db,
  now = Date.now,
}: {
  db: Database;
  now?: () => number;
}) {
  const content = createContentService({ db, now });
  async function read(id: string | undefined, signal: AbortSignal) {
    try {
      return await db.transaction(
        async (tx) => {
          await authTimeouts(tx);
          signal.throwIfAborted();
          const [state] = await tx.select().from(siteState).where(eq(siteState.id, 1));
          if (!state) throw failure("INTERNAL_ERROR");
          const rows = await tx
            .select()
            .from(ticketRates)
            .where(id ? eq(ticketRates.id, id) : undefined)
            .orderBy(ticketRates.sortOrder, ticketRates.id);
          if (id && !rows.length) throw failure("NOT_FOUND");
          signal.throwIfAborted();
          return {
            items: rows.map(dto),
            state: contentStateSchema.parse({
              contentVersion: state.contentVersion,
              publicUpdatedAt: new Date(state.publicUpdatedAt).toISOString(),
              ticketsUpdatedAt: state.ticketsUpdatedAt
                ? new Date(state.ticketsUpdatedAt).toISOString()
                : null,
            }),
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw failure("SERVICE_UNAVAILABLE");
    }
  }
  return {
    list: (signal: AbortSignal) => read(undefined, signal),
    detail: (id: string, signal: AbortSignal) => read(parseInput(uuidSchema, id), signal),
    async mutate(request: MutationRequest): Promise<MutationResult> {
      if (request.method === "POST" && request.path === TICKET_PATH)
        return content.mutate(request, {
          schema: ticketRateCreateSchema,
          project: ticketProjection,
          apply: async (tx, input) => {
            const [position] = await tx
              .select({ last: max(ticketRates.sortOrder) })
              .from(ticketRates);
            const sortOrder = (position?.last ?? -1) + 1;
            if (sortOrder > 2_147_483_647) throw failure("INTERNAL_ERROR");
            const time = new Date(now()).toISOString();
            const [row] = await tx
              .insert(ticketRates)
              .values({ ...fields(input), sortOrder, createdAt: time, updatedAt: time })
              .returning();
            if (!row) throw failure("INTERNAL_ERROR");
            return { data: dto(row), resourceId: row.id };
          },
        });
      if (request.method === "PUT" && request.path === `${TICKET_PATH}/order`)
        return content.mutate(request, {
          schema: orderRequestSchema,
          project: ticketProjection,
          apply: async (tx, input) => {
            const current = await tx.select({ id: ticketRates.id }).from(ticketRates);
            const ids = new Set(input.ids);
            if (
              ids.size !== input.ids.length ||
              current.length !== ids.size ||
              current.some((row) => !ids.has(row.id))
            )
              throw failure("INVALID_ORDER");
            if (input.ids.length) {
              const positions = sql.join(
                input.ids.map((id, index) => sql`(${id}::uuid, ${index}::integer)`),
                sql`, `,
              );
              await tx.execute(
                sql`UPDATE ticket_rates SET sort_order = positions.position FROM (VALUES ${positions}) AS positions(id, position) WHERE ticket_rates.id = positions.id`,
              );
            }
            return { data: { ids: input.ids }, resourceId: null };
          },
        });
      if (!request.path.startsWith(`${TICKET_PATH}/`)) throw failure("NOT_FOUND");
      const id = parseInput(uuidSchema, request.path.slice(TICKET_PATH.length + 1));
      if (request.method === "PUT")
        return content.mutate(request, {
          schema: ticketRateUpdateSchema,
          project: ticketProjection,
          apply: async (tx, input) => {
            const [row] = await tx
              .update(ticketRates)
              .set({ ...fields(input), updatedAt: new Date(now()).toISOString() })
              .where(eq(ticketRates.id, id))
              .returning();
            if (!row) throw failure("NOT_FOUND");
            return { data: dto(row), resourceId: id };
          },
        });
      if (request.method === "DELETE")
        return content.mutate(request, {
          schema: z.strictObject({ expectedContentVersion: contentVersionSchema }),
          project: ticketProjection,
          apply: async (tx) => {
            const rows = await tx
              .delete(ticketRates)
              .where(eq(ticketRates.id, id))
              .returning({ id: ticketRates.id });
            if (!rows.length) throw failure("NOT_FOUND");
            await tx.execute(
              sql`WITH positions AS (SELECT id, (row_number() OVER (ORDER BY sort_order, id) - 1)::integer AS position FROM ticket_rates) UPDATE ticket_rates SET sort_order = positions.position FROM positions WHERE ticket_rates.id = positions.id AND ticket_rates.sort_order <> positions.position`,
            );
            return { data: { id, deleted: true }, resourceId: id };
          },
        });
      throw failure("METHOD_NOT_ALLOWED");
    },
  };
}
export type TicketRateService = ReturnType<typeof createTicketRateService>;
