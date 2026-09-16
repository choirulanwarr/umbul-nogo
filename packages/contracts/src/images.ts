import { z } from "zod";
import { httpsUrlSchema, textSchema } from "./primitives";

export const imageVariantSchema = z.strictObject({
  url: httpsUrlSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mimeType: z.literal("image/webp"),
  byteSize: z.number().int().positive(),
});
export const imageVariantsSchema = z
  .array(imageVariantSchema)
  .min(1)
  .refine(
    (variants) =>
      variants.every((variant, index) => index === 0 || variant.width > variants[index - 1]!.width),
    "Lebar varian harus unik dan terurut menaik.",
  );
export const imageSchema = z.strictObject({ alt: textSchema(200), variants: imageVariantsSchema });
export type ImageVariantDto = z.infer<typeof imageVariantSchema>;
export type ImageDto = z.infer<typeof imageSchema>;
