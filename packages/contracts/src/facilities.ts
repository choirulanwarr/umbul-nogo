import { z } from "zod";
import { contentResponseSchema, listSchema, mutationResponseSchema } from "./envelopes";
import { contentVersionSchema, entityMetadataShape, textSchema } from "./primitives";
export const facilityFieldsSchema = z.strictObject({
  name: textSchema(100),
  description: textSchema(1000).nullable(),
  isVisible: z.boolean(),
});
export const facilityCreateSchema = facilityFieldsSchema.extend({
  isVisible: z.boolean().default(false),
  expectedContentVersion: contentVersionSchema,
});
export const facilityUpdateSchema = facilityFieldsSchema.extend({
  expectedContentVersion: contentVersionSchema,
});
export const facilityDtoSchema = facilityFieldsSchema.extend({ ...entityMetadataShape });
export const facilityResponseSchema = contentResponseSchema(facilityDtoSchema);
export const facilityListResponseSchema = contentResponseSchema(listSchema(facilityDtoSchema));
export const facilityMutationResponseSchema = mutationResponseSchema(facilityDtoSchema);
export type FacilityFields = z.infer<typeof facilityFieldsSchema>;
export type FacilityCreate = z.input<typeof facilityCreateSchema>;
export type FacilityUpdate = z.input<typeof facilityUpdateSchema>;
export type FacilityDto = z.infer<typeof facilityDtoSchema>;
