import { z } from "zod";

// Length limits are Unicode code points, not UTF-16 code units.
export function textSchema(max: number, min = 1) {
  return z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const length = [...value].length;
      if (length < min || length > max) {
        ctx.addIssue({
          code: "custom",
          message: `Isi ${min}–${max} karakter.`,
          params: { fieldCode: length < min ? "REQUIRED" : "TOO_LONG" },
        });
      }
    });
}

export const uuidSchema = z.uuid().regex(/^[0-9a-f-]+$/, "Gunakan UUID huruf kecil.");
export const operationKeySchema = z.uuidv4().regex(/^[0-9a-f-]+$/);
export const timestampSchema = z.iso.datetime({ offset: false });
export const contentVersionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const moneyIdrSchema = z.number().int().min(0).max(2_147_483_647);
export const phoneSchema = textSchema(16).pipe(z.string().regex(/^\+[1-9][0-9]{7,14}$/));
export const emailSchema = textSchema(254).pipe(z.email());
export const httpsUrlSchema = textSchema(2048).refine((value) => {
  try {
    const url = new URL(value);
    return (
      /^https:\/\//i.test(value) &&
      url.protocol === "https:" &&
      url.hostname !== "" &&
      !url.username &&
      !url.password &&
      !/[\s\\]/u.test(value)
    );
  } catch {
    return false;
  }
}, "Gunakan URL HTTPS absolut tanpa kredensial.");
export const instagramUrlSchema = httpsUrlSchema.pipe(
  z.string().refine((value) => {
    const host = new URL(value).hostname;
    return host === "instagram.com" || host === "www.instagram.com";
  }, "Gunakan URL Instagram."),
);
export const healthResponseSchema = z.strictObject({ status: z.enum(["ok", "unavailable"]) });
export const emptyRequestSchema = z.strictObject({});
export const idParamsSchema = z.strictObject({ id: uuidSchema });
export const keyParamsSchema = z.strictObject({ key: operationKeySchema });
export const deleteContentQuerySchema = z.strictObject({
  expectedContentVersion: z
    .string()
    .regex(/^(0|[1-9][0-9]*)$/)
    .transform(Number)
    .pipe(contentVersionSchema),
});
export const entityMetadataShape = {
  id: uuidSchema,
  sortOrder: contentVersionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
};
export type DeleteContentQuery = z.output<typeof deleteContentQuerySchema>;
