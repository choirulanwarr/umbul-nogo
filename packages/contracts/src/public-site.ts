import { z } from "zod";
import { publicContactSchema } from "./contacts";
import { successSchema } from "./envelopes";
import { imageSchema } from "./images";
import { openingHoursSchema } from "./opening-hours";
import {
  httpsUrlSchema,
  moneyIdrSchema,
  textSchema,
  timestampSchema,
  uuidSchema,
} from "./primitives";

export const publicSiteSchema = z.strictObject({
  name: textSchema(120),
  introduction: textSchema(2000).nullable(),
  region: textSchema(160),
  hero: imageSchema.nullable(),
  logo: imageSchema.nullable(),
  attractions: z.array(
    z.strictObject({
      id: uuidSchema,
      name: textSchema(120),
      description: textSchema(3000),
      image: imageSchema.nullable(),
    }),
  ),
  tickets: z.strictObject({
    currency: z.literal("IDR"),
    updatedAt: timestampSchema.nullable(),
    items: z.array(
      z.strictObject({
        id: uuidSchema,
        name: textSchema(100),
        priceIdr: moneyIdrSchema,
        unit: textSchema(60),
        terms: textSchema(3000),
        applicabilityNote: textSchema(500).nullable(),
      }),
    ),
  }),
  facilities: z.array(
    z.strictObject({
      id: uuidSchema,
      name: textSchema(100),
      description: textSchema(1000).nullable(),
    }),
  ),
  gallery: z.array(
    z.strictObject({ id: uuidSchema, image: imageSchema, caption: textSchema(500).nullable() }),
  ),
  visit: z.strictObject({
    timezone: z.literal("Asia/Jakarta"),
    address: textSchema(1000).nullable(),
    coordinates: z
      .strictObject({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .nullable(),
    mapUrl: httpsUrlSchema.nullable(),
    notes: textSchema(3000).nullable(),
    openingHours: openingHoursSchema,
    contacts: z.array(publicContactSchema),
  }),
  // Description may fall back to the full 2,000-code-point introduction.
  seo: z.strictObject({
    title: textSchema(120),
    description: textSchema(2000),
    image: imageSchema.nullable(),
  }),
  publicUpdatedAt: timestampSchema,
});
export const publicSiteResponseSchema = successSchema(publicSiteSchema);
export type PublicSiteDto = z.infer<typeof publicSiteSchema>;
