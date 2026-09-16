import { z } from "zod";
import { successSchema } from "./envelopes";
import { imageVariantsSchema } from "./images";
import { textSchema, timestampSchema, uuidSchema } from "./primitives";

export const MEDIA_LIMITS = {
  fileBytes: 5_242_880,
  multipartBytes: 6_291_456,
  pixels: 25_000_000,
} as const;
export const mediaStatusSchema = z.enum(["processing", "ready", "failed", "deleting", "deleted"]);
export const mediaFailureCodeSchema = z.enum([
  "IMAGE_INVALID",
  "STORAGE_UNAVAILABLE",
  "UPLOAD_INTERRUPTED",
]);
export const mediaReferenceSchema = z.discriminatedUnion("resource", [
  z.strictObject({
    resource: z.literal("destination"),
    id: z.null(),
    field: z.enum(["heroMediaId", "logoMediaId"]),
    label: textSchema(120),
  }),
  z.strictObject({
    resource: z.literal("seo"),
    id: z.null(),
    field: z.literal("imageMediaId"),
    label: textSchema(120),
  }),
  z.strictObject({
    resource: z.literal("attractions"),
    id: uuidSchema,
    field: z.literal("mediaId"),
    label: textSchema(120),
  }),
  z.strictObject({
    resource: z.literal("gallery-items"),
    id: uuidSchema,
    field: z.literal("mediaId"),
    label: textSchema(500),
  }),
]);
const mediaBaseSchema = z.strictObject({
  id: uuidSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable(),
  canRetryUpload: z.boolean(),
  failureCode: mediaFailureCodeSchema.nullable(),
  references: z.array(mediaReferenceSchema),
});
export const mediaDtoSchema = z
  .discriminatedUnion("status", [
    mediaBaseSchema.extend({
      status: z.literal("ready"),
      variants: imageVariantsSchema,
      canRetryUpload: z.literal(false),
      deletedAt: z.null(),
      failureCode: z.null(),
    }),
    mediaBaseSchema.extend({
      status: z.enum(["processing", "failed"]),
      variants: z.array(z.never()),
      deletedAt: z.null(),
    }),
    mediaBaseSchema.extend({
      status: z.literal("deleting"),
      variants: z.array(z.never()),
      canRetryUpload: z.literal(false),
      deletedAt: z.null(),
    }),
    mediaBaseSchema.extend({
      status: z.literal("deleted"),
      variants: z.array(z.never()),
      canRetryUpload: z.literal(false),
      deletedAt: timestampSchema,
    }),
  ])
  .superRefine((media, ctx) => {
    if (media.failureCode === "IMAGE_INVALID" && media.canRetryUpload)
      ctx.addIssue({
        code: "custom",
        path: ["canRetryUpload"],
        message: "Berkas invalid memerlukan upload key baru.",
      });
  });
export const mediaResponseSchema = successSchema(mediaDtoSchema);
export const mediaListQuerySchema = z.strictObject({
  status: mediaStatusSchema.optional(),
  limit: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default(24),
  cursor: textSchema(2048).optional(),
});
// Opaque cursor transport encoding/decoding belongs to the HTTP adapter. Validate
// decoded data here, then compare status to the request (including null = default).
export const mediaCursorSchema = z.strictObject({
  createdAt: timestampSchema,
  id: uuidSchema,
  status: mediaStatusSchema.nullable(),
});
export const mediaListResponseSchema = successSchema(
  z.strictObject({ items: z.array(mediaDtoSchema), nextCursor: textSchema(2048).nullable() }),
);
export const mediaDeleteResultSchema = z.strictObject({
  id: uuidSchema,
  status: z.enum(["deleting", "deleted"]),
});
export const mediaDeleteResponseSchema = successSchema(mediaDeleteResultSchema);
export const mediaReadyResponseSchema = successSchema(
  mediaDtoSchema.refine((media) => media.status === "ready", "Media harus ready."),
);
export const mediaPendingResponseSchema = successSchema(
  mediaDtoSchema.refine((media) => media.status === "processing", "Media harus processing."),
);
// The HTTP adapter must reject duplicate/extra multipart parts before constructing
// this object. File signature, decoded format, frames and pixels belong to Sharp.
export const mediaUploadRequestSchema = z.strictObject({
  file: z.file().min(1).max(MEDIA_LIMITS.fileBytes),
});
export type MediaUploadRequest = z.input<typeof mediaUploadRequestSchema>;
export type MediaDto = z.infer<typeof mediaDtoSchema>;
export type MediaReference = z.infer<typeof mediaReferenceSchema>;
export type MediaListQuery = z.output<typeof mediaListQuerySchema>;
export type MediaCursor = z.infer<typeof mediaCursorSchema>;
