import { z } from "zod";
import {
  contentVersionSchema,
  operationKeySchema,
  timestampSchema,
  uuidSchema,
} from "./primitives";

export const requestMetaSchema = z.strictObject({ requestId: uuidSchema });
export const contentStateSchema = z.strictObject({
  contentVersion: contentVersionSchema,
  publicUpdatedAt: timestampSchema,
  ticketsUpdatedAt: timestampSchema.nullable(),
});
export const idempotencySchema = z.strictObject({
  key: operationKeySchema,
  replayed: z.boolean(),
  originalRequestId: uuidSchema,
  expiresAt: timestampSchema,
});
export const contentMetaSchema = requestMetaSchema.extend(contentStateSchema.shape);
export const mutationMetaSchema = contentMetaSchema.extend({ idempotency: idempotencySchema });
function envelopeSchema<T extends z.ZodType, M extends z.ZodType>(data: T, meta: M) {
  return z.strictObject({ success: z.literal(true), data, meta });
}
export function successSchema<T extends z.ZodType>(data: T) {
  return envelopeSchema(data, requestMetaSchema);
}
export function contentResponseSchema<T extends z.ZodType>(data: T) {
  return envelopeSchema(data, contentMetaSchema);
}
export function mutationResponseSchema<T extends z.ZodType>(data: T) {
  return envelopeSchema(data, mutationMetaSchema);
}
export function listSchema<T extends z.ZodType>(item: T) {
  return z.strictObject({ items: z.array(item) });
}
export const deletedItemSchema = z.strictObject({ id: uuidSchema, deleted: z.literal(true) });
export const orderResultSchema = z.strictObject({ ids: z.array(uuidSchema) });
// Membership and duplicates are checked after the version check by the service (INVALID_ORDER).
export const orderRequestSchema = orderResultSchema.extend({
  expectedContentVersion: contentVersionSchema,
});
export const deleteContentResponseSchema = mutationResponseSchema(deletedItemSchema);
export const orderResponseSchema = mutationResponseSchema(orderResultSchema);
export type ContentState = z.infer<typeof contentStateSchema>;
export type MutationMeta = z.infer<typeof mutationMetaSchema>;
export type ApiSuccess<T, M extends object = object> = {
  success: true;
  data: T;
  meta: z.infer<typeof requestMetaSchema> & M;
};
export type OrderRequest = z.infer<typeof orderRequestSchema>;
