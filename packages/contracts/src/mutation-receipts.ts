import { z } from "zod";
import { deleteContentResponseSchema, orderResponseSchema, successSchema } from "./envelopes";
import { operationKeySchema, timestampSchema, uuidSchema } from "./primitives";
import { destinationMutationResponseSchema } from "./destination";
import { seoMutationResponseSchema } from "./seo";
import { operationsMutationResponseSchema } from "./operations";
import { attractionMutationResponseSchema } from "./attractions";
import { ticketRateMutationResponseSchema } from "./ticket-rates";
import { facilityMutationResponseSchema } from "./facilities";
import { galleryItemMutationResponseSchema } from "./gallery-items";

const receiptBase = { key: operationKeySchema, expiresAt: timestampSchema };
const prefix = "/api/v1/admin/";
function itemPath(collection: string) {
  const start = `${prefix}${collection}/`;
  return z
    .string()
    .refine(
      (path) => path.startsWith(start) && uuidSchema.safeParse(path.slice(start.length)).success,
      "Gunakan path item kanonis.",
    );
}
export const mutationReceiptQuerySchema = z.union([
  z.strictObject({ method: z.literal("PUT"), path: z.literal(prefix + "destination") }),
  z.strictObject({ method: z.literal("PUT"), path: z.literal(prefix + "seo") }),
  z.strictObject({ method: z.literal("PUT"), path: z.literal(prefix + "operations") }),
  z.strictObject({ method: z.literal("POST"), path: z.literal(prefix + "attractions") }),
  z.strictObject({ method: z.literal("PUT"), path: itemPath("attractions") }),
  z.strictObject({ method: z.literal("DELETE"), path: itemPath("attractions") }),
  z.strictObject({ method: z.literal("PUT"), path: z.literal(prefix + "attractions/order") }),
  z.strictObject({ method: z.literal("POST"), path: z.literal(prefix + "ticket-rates") }),
  z.strictObject({ method: z.literal("PUT"), path: itemPath("ticket-rates") }),
  z.strictObject({ method: z.literal("DELETE"), path: itemPath("ticket-rates") }),
  z.strictObject({ method: z.literal("PUT"), path: z.literal(prefix + "ticket-rates/order") }),
  z.strictObject({ method: z.literal("POST"), path: z.literal(prefix + "facilities") }),
  z.strictObject({ method: z.literal("PUT"), path: itemPath("facilities") }),
  z.strictObject({ method: z.literal("DELETE"), path: itemPath("facilities") }),
  z.strictObject({ method: z.literal("PUT"), path: z.literal(prefix + "facilities/order") }),
  z.strictObject({ method: z.literal("POST"), path: z.literal(prefix + "gallery-items") }),
  z.strictObject({ method: z.literal("PUT"), path: itemPath("gallery-items") }),
  z.strictObject({ method: z.literal("DELETE"), path: itemPath("gallery-items") }),
  z.strictObject({ method: z.literal("PUT"), path: z.literal(prefix + "gallery-items/order") }),
]);
export const mutationReceiptSchema = z
  .union([
    z.strictObject({
      ...receiptBase,
      method: z.literal("PUT"),
      path: z.literal(prefix + "destination"),
      responseStatus: z.literal(200),
      responseBody: destinationMutationResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("PUT"),
      path: z.literal(prefix + "seo"),
      responseStatus: z.literal(200),
      responseBody: seoMutationResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("PUT"),
      path: z.literal(prefix + "operations"),
      responseStatus: z.literal(200),
      responseBody: operationsMutationResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("POST"),
      path: z.literal(prefix + "attractions"),
      responseStatus: z.literal(201),
      responseBody: attractionMutationResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("PUT"),
      path: itemPath("attractions"),
      responseStatus: z.literal(200),
      responseBody: attractionMutationResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("DELETE"),
      path: itemPath("attractions"),
      responseStatus: z.literal(200),
      responseBody: deleteContentResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("PUT"),
      path: z.literal(prefix + "attractions/order"),
      responseStatus: z.literal(200),
      responseBody: orderResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("POST"),
      path: z.literal(prefix + "ticket-rates"),
      responseStatus: z.literal(201),
      responseBody: ticketRateMutationResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("PUT"),
      path: itemPath("ticket-rates"),
      responseStatus: z.literal(200),
      responseBody: ticketRateMutationResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("DELETE"),
      path: itemPath("ticket-rates"),
      responseStatus: z.literal(200),
      responseBody: deleteContentResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("PUT"),
      path: z.literal(prefix + "ticket-rates/order"),
      responseStatus: z.literal(200),
      responseBody: orderResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("POST"),
      path: z.literal(prefix + "facilities"),
      responseStatus: z.literal(201),
      responseBody: facilityMutationResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("PUT"),
      path: itemPath("facilities"),
      responseStatus: z.literal(200),
      responseBody: facilityMutationResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("DELETE"),
      path: itemPath("facilities"),
      responseStatus: z.literal(200),
      responseBody: deleteContentResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("PUT"),
      path: z.literal(prefix + "facilities/order"),
      responseStatus: z.literal(200),
      responseBody: orderResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("POST"),
      path: z.literal(prefix + "gallery-items"),
      responseStatus: z.literal(201),
      responseBody: galleryItemMutationResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("PUT"),
      path: itemPath("gallery-items"),
      responseStatus: z.literal(200),
      responseBody: galleryItemMutationResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("DELETE"),
      path: itemPath("gallery-items"),
      responseStatus: z.literal(200),
      responseBody: deleteContentResponseSchema,
    }),
    z.strictObject({
      ...receiptBase,
      method: z.literal("PUT"),
      path: z.literal(prefix + "gallery-items/order"),
      responseStatus: z.literal(200),
      responseBody: orderResponseSchema,
    }),
  ])
  .superRefine((receipt, ctx) => {
    const meta = receipt.responseBody.meta;
    if (
      receipt.key !== meta.idempotency.key ||
      receipt.expiresAt !== meta.idempotency.expiresAt ||
      meta.idempotency.replayed ||
      meta.requestId !== meta.idempotency.originalRequestId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["responseBody", "meta"],
        message: "Receipt harus memuat metadata sukses asli.",
      });
    }
    if (receipt.method === "PUT" || receipt.method === "DELETE") {
      const data = receipt.responseBody.data;
      if ("id" in data && !receipt.path.endsWith(`/${data.id}`))
        ctx.addIssue({
          code: "custom",
          path: ["responseBody", "data", "id"],
          message: "ID hasil tidak sesuai path.",
        });
    }
  });
export const mutationReceiptResponseSchema = successSchema(mutationReceiptSchema);
export type MutationReceiptQuery = z.infer<typeof mutationReceiptQuerySchema>;
export type MutationReceiptDto = z.infer<typeof mutationReceiptSchema>;
