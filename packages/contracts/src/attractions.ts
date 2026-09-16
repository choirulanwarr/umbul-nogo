import { z } from "zod";
import { contentResponseSchema, listSchema, mutationResponseSchema } from "./envelopes";
import { imageSchema } from "./images";
import { contentVersionSchema, entityMetadataShape, textSchema, uuidSchema } from "./primitives";
const attractionBaseSchema = z.strictObject({
  name: textSchema(120),
  description: textSchema(3000).nullable(),
  mediaId: uuidSchema.nullable(),
  imageAlt: textSchema(200).nullable(),
  isVisible: z.boolean(),
});
function refineAttraction(value: z.infer<typeof attractionBaseSchema>, ctx: z.RefinementCtx) {
  if (value.isVisible && value.description === null)
    ctx.addIssue({
      code: "custom",
      path: ["description"],
      message: "Deskripsi wajib saat ditampilkan.",
      params: { fieldCode: "REQUIRED" },
    });
  if ((value.mediaId === null) !== (value.imageAlt === null))
    ctx.addIssue({
      code: "custom",
      path: ["imageAlt"],
      message: "Media dan alt harus berpasangan.",
      params: { fieldCode: "INVALID_COMBINATION" },
    });
}
export const attractionFieldsSchema = attractionBaseSchema.superRefine(refineAttraction);
export const attractionCreateSchema = attractionBaseSchema
  .extend({
    isVisible: z.boolean().default(false),
    expectedContentVersion: contentVersionSchema,
  })
  .superRefine(refineAttraction);
export const attractionUpdateSchema = attractionFieldsSchema.safeExtend({
  expectedContentVersion: contentVersionSchema,
});
export const attractionDtoSchema = attractionFieldsSchema
  .safeExtend({ ...entityMetadataShape, imagePreview: imageSchema.nullable() })
  .superRefine((value, ctx) => {
    if (
      (value.mediaId === null) !== (value.imagePreview === null) ||
      (value.imagePreview && value.imagePreview.alt !== value.imageAlt)
    )
      ctx.addIssue({
        code: "custom",
        path: ["imagePreview"],
        message: "Preview tidak sesuai penggunaan.",
      });
  });
export const attractionResponseSchema = contentResponseSchema(attractionDtoSchema);
export const attractionListResponseSchema = contentResponseSchema(listSchema(attractionDtoSchema));
export const attractionMutationResponseSchema = mutationResponseSchema(attractionDtoSchema);
export type AttractionFields = z.infer<typeof attractionFieldsSchema>;
export type AttractionCreate = z.input<typeof attractionCreateSchema>;
export type AttractionUpdate = z.input<typeof attractionUpdateSchema>;
export type AttractionDto = z.infer<typeof attractionDtoSchema>;
