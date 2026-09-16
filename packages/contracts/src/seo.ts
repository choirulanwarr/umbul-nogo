import { z } from "zod";
import { contentResponseSchema, mutationResponseSchema } from "./envelopes";
import { imageSchema } from "./images";
import { contentVersionSchema, textSchema, uuidSchema } from "./primitives";
export const seoFieldsSchema = z.strictObject({
  title: textSchema(120).nullable(),
  description: textSchema(320).nullable(),
  imageMediaId: uuidSchema.nullable(),
});
export const seoRequestSchema = seoFieldsSchema.extend({
  expectedContentVersion: contentVersionSchema,
});
export const seoDtoSchema = seoFieldsSchema.extend({ imagePreview: imageSchema.nullable() });
export const seoResponseSchema = contentResponseSchema(seoDtoSchema);
export const seoMutationResponseSchema = mutationResponseSchema(seoDtoSchema);
export type SeoFields = z.infer<typeof seoFieldsSchema>;
export type SeoRequest = z.input<typeof seoRequestSchema>;
export type SeoDto = z.infer<typeof seoDtoSchema>;
