import { z } from "zod";
import { contentResponseSchema, listSchema, mutationResponseSchema } from "./envelopes";
import {
  contentVersionSchema,
  entityMetadataShape,
  textSchema,
  moneyIdrSchema,
} from "./primitives";
export const ticketRateFieldsSchema = z.strictObject({
  name: textSchema(100),
  priceIdr: moneyIdrSchema,
  unit: textSchema(60),
  terms: textSchema(3000),
  applicabilityNote: textSchema(500).nullable(),
  isVisible: z.boolean(),
});
export const ticketRateCreateSchema = ticketRateFieldsSchema.extend({
  isVisible: z.boolean().default(false),
  expectedContentVersion: contentVersionSchema,
});
export const ticketRateUpdateSchema = ticketRateFieldsSchema.extend({
  expectedContentVersion: contentVersionSchema,
});
export const ticketRateDtoSchema = ticketRateFieldsSchema.extend({ ...entityMetadataShape });
export const ticketRateResponseSchema = contentResponseSchema(ticketRateDtoSchema);
export const ticketRateListResponseSchema = contentResponseSchema(listSchema(ticketRateDtoSchema));
export const ticketRateMutationResponseSchema = mutationResponseSchema(ticketRateDtoSchema);
export type TicketRateFields = z.infer<typeof ticketRateFieldsSchema>;
export type TicketRateCreate = z.input<typeof ticketRateCreateSchema>;
export type TicketRateUpdate = z.input<typeof ticketRateUpdateSchema>;
export type TicketRateDto = z.infer<typeof ticketRateDtoSchema>;
