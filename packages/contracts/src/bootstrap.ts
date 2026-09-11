import { z } from "zod";

// Temporary T-01 contract; the database-backed public snapshot belongs to T-03/T-14.
export const bootstrapSiteSchema = z.strictObject({
  name: z.string().min(1).max(120),
  region: z.string().min(1).max(160),
});

export const bootstrapResponseSchema = z.strictObject({
  success: z.literal(true),
  data: bootstrapSiteSchema,
  meta: z.strictObject({ requestId: z.uuid() }),
});

export type BootstrapSite = z.infer<typeof bootstrapSiteSchema>;
