import { z } from "zod";
import { contactsDtoSchema, contactsInputSchema } from "./contacts";
import { contentResponseSchema, mutationResponseSchema } from "./envelopes";
import { imageSchema } from "./images";
import { openingHoursSchema } from "./opening-hours";
import { contentVersionSchema, httpsUrlSchema, textSchema, uuidSchema } from "./primitives";

export const destinationFieldsSchema = z
  .strictObject({
    name: textSchema(120),
    introduction: textSchema(2000).nullable(),
    region: textSchema(160),
    address: textSchema(1000).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    mapUrl: httpsUrlSchema.nullable(),
    visitNotes: textSchema(3000).nullable(),
    heroMediaId: uuidSchema.nullable(),
    heroAlt: textSchema(200).nullable(),
    logoMediaId: uuidSchema.nullable(),
    openingHours: openingHoursSchema,
    contacts: contactsInputSchema,
  })
  .superRefine((value, ctx) => {
    if ((value.latitude === null) !== (value.longitude === null))
      ctx.addIssue({
        code: "custom",
        path: ["longitude"],
        message: "Isi kedua koordinat atau kosongkan keduanya.",
        params: { fieldCode: "INVALID_COMBINATION" },
      });
    if ((value.heroMediaId === null) !== (value.heroAlt === null))
      ctx.addIssue({
        code: "custom",
        path: ["heroAlt"],
        message: "Gambar hero dan alt wajib berpasangan.",
        params: { fieldCode: "INVALID_COMBINATION" },
      });
  });
export const destinationRequestSchema = destinationFieldsSchema.safeExtend({
  expectedContentVersion: contentVersionSchema,
});
export const destinationDtoSchema = destinationFieldsSchema
  .safeExtend({
    contacts: contactsDtoSchema,
    heroPreview: imageSchema.nullable(),
    logoPreview: imageSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.heroMediaId === null) !== (value.heroPreview === null) ||
      (value.heroPreview && value.heroPreview.alt !== value.heroAlt)
    )
      ctx.addIssue({
        code: "custom",
        path: ["heroPreview"],
        message: "Preview hero tidak sesuai penggunaan.",
      });
    if (
      (value.logoMediaId === null) !== (value.logoPreview === null) ||
      (value.logoPreview && value.logoPreview.alt !== `Logo ${value.name}`)
    )
      ctx.addIssue({
        code: "custom",
        path: ["logoPreview"],
        message: "Preview logo tidak sesuai penggunaan.",
      });
  });
export const destinationResponseSchema = contentResponseSchema(destinationDtoSchema);
export const destinationMutationResponseSchema = mutationResponseSchema(destinationDtoSchema);
export type DestinationFields = z.infer<typeof destinationFieldsSchema>;
export type DestinationRequest = z.input<typeof destinationRequestSchema>;
export type DestinationDto = z.infer<typeof destinationDtoSchema>;
