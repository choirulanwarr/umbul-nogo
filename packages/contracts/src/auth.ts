import { z } from "zod";
import { successSchema } from "./envelopes";
import { emailSchema, emptyRequestSchema, timestampSchema, uuidSchema } from "./primitives";
export const loginRequestSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(emailSchema),
  // Passwords remain byte-for-byte unchanged; provisioning uses the same code-point limits.
  password: z
    .string()
    .refine(
      (value) => [...value].length >= 15 && [...value].length <= 128,
      "Kata sandi harus 15–128 karakter.",
    ),
});
export const logoutRequestSchema = emptyRequestSchema;
export const sessionSchema = z.strictObject({
  user: z.strictObject({ id: uuidSchema, email: emailSchema, role: z.literal("admin") }),
  expiresAt: timestampSchema,
  idleExpiresAt: timestampSchema,
});
export const sessionResponseSchema = successSchema(sessionSchema);
export const logoutResponseSchema = successSchema(z.strictObject({ loggedOut: z.literal(true) }));
export type LoginRequest = z.input<typeof loginRequestSchema>;
export type SessionDto = z.infer<typeof sessionSchema>;
