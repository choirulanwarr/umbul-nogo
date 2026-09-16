import { z } from "zod";
import { contentResponseSchema, listSchema, mutationResponseSchema } from "./envelopes";
import { imageSchema } from "./images";
import { contentVersionSchema, entityMetadataShape, textSchema, uuidSchema } from "./primitives";
export const galleryItemFieldsSchema = z.strictObject({
  mediaId: uuidSchema,
  altText: textSchema(200),
  caption: textSchema(500).nullable(),
  isVisible: z.boolean(),
});
export const galleryItemCreateSchema = galleryItemFieldsSchema.extend({
  isVisible: z.boolean().default(false),
  expectedContentVersion: contentVersionSchema,
});
export const galleryItemUpdateSchema = galleryItemFieldsSchema.extend({
  expectedContentVersion: contentVersionSchema,
});
export const galleryItemDtoSchema = galleryItemFieldsSchema
  .extend({ ...entityMetadataShape, imagePreview: imageSchema })
  .refine(
    (value) => value.imagePreview.alt === value.altText,
    "Alt preview tidak sesuai penggunaan.",
  );
export const galleryItemResponseSchema = contentResponseSchema(galleryItemDtoSchema);
export const galleryItemListResponseSchema = contentResponseSchema(
  listSchema(galleryItemDtoSchema),
);
export const galleryItemMutationResponseSchema = mutationResponseSchema(galleryItemDtoSchema);
export type GalleryItemFields = z.infer<typeof galleryItemFieldsSchema>;
export type GalleryItemCreate = z.input<typeof galleryItemCreateSchema>;
export type GalleryItemUpdate = z.input<typeof galleryItemUpdateSchema>;
export type GalleryItemDto = z.infer<typeof galleryItemDtoSchema>;
