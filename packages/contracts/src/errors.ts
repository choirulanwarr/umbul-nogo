import { z } from "zod";
import { requestMetaSchema } from "./envelopes";
import { mediaReferenceSchema } from "./media";
import { contentVersionSchema, textSchema } from "./primitives";

export const ERROR_HTTP_STATUS = {
  INVALID_REQUEST: 400,
  AUTH_REQUIRED: 401,
  INVALID_CREDENTIALS: 401,
  ORIGIN_NOT_ALLOWED: 403,
  CLIENT_HEADER_REQUIRED: 403,
  NOT_FOUND: 404,
  RECEIPT_NOT_FOUND: 404,
  UPLOAD_NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONTENT_VERSION_CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  UPLOAD_KEY_REUSED: 409,
  OPERATION_IN_PROGRESS: 409,
  MEDIA_IN_USE: 409,
  MEDIA_NOT_READY: 409,
  MEDIA_BUSY: 409,
  MEDIA_NOT_REUSABLE: 409,
  PAYLOAD_TOO_LARGE: 413,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_ERROR: 422,
  INVALID_ORDER: 422,
  INVALID_CURSOR: 422,
  IMAGE_INVALID: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  STORAGE_UNAVAILABLE: 503,
  MEDIA_CAPACITY_EXCEEDED: 503,
} as const;
export const errorCodeSchema = z.enum(
  Object.keys(ERROR_HTTP_STATUS) as [
    keyof typeof ERROR_HTTP_STATUS,
    ...(keyof typeof ERROR_HTTP_STATUS)[],
  ],
);
export const fieldErrorCodeSchema = z.enum([
  "REQUIRED",
  "INVALID_TYPE",
  "INVALID_FORMAT",
  "OUT_OF_RANGE",
  "TOO_LONG",
  "UNKNOWN_FIELD",
  "INVALID_COMBINATION",
]);
export const fieldErrorSchema = z.strictObject({
  path: z.string(),
  code: fieldErrorCodeSchema,
  message: textSchema(1000),
});
const errorBase = { message: textSchema(1000) };
export const apiErrorSchema = z.discriminatedUnion("code", [
  z.strictObject({
    ...errorBase,
    code: z.enum([
      "INVALID_REQUEST",
      "AUTH_REQUIRED",
      "ORIGIN_NOT_ALLOWED",
      "CLIENT_HEADER_REQUIRED",
      "NOT_FOUND",
      "RECEIPT_NOT_FOUND",
      "UPLOAD_NOT_FOUND",
      "METHOD_NOT_ALLOWED",
      "IDEMPOTENCY_KEY_REUSED",
      "UPLOAD_KEY_REUSED",
      "OPERATION_IN_PROGRESS",
      "MEDIA_NOT_READY",
      "MEDIA_BUSY",
      "MEDIA_NOT_REUSABLE",
      "PAYLOAD_TOO_LARGE",
      "FILE_TOO_LARGE",
      "UNSUPPORTED_MEDIA_TYPE",
      "INVALID_ORDER",
      "INVALID_CURSOR",
      "IMAGE_INVALID",
      "RATE_LIMITED",
      "INTERNAL_ERROR",
      "SERVICE_UNAVAILABLE",
      "STORAGE_UNAVAILABLE",
      "MEDIA_CAPACITY_EXCEEDED",
    ]),
  }),
  z.strictObject({
    code: z.literal("INVALID_CREDENTIALS"),
    message: z.literal("Email atau kata sandi tidak sesuai."),
  }),
  z.strictObject({
    ...errorBase,
    code: z.literal("VALIDATION_ERROR"),
    fieldErrors: z.array(fieldErrorSchema).min(1),
  }),
  z.strictObject({
    ...errorBase,
    code: z.literal("CONTENT_VERSION_CONFLICT"),
    details: z.strictObject({
      expectedContentVersion: contentVersionSchema,
      currentContentVersion: contentVersionSchema,
    }),
  }),
  z.strictObject({
    ...errorBase,
    code: z.literal("MEDIA_IN_USE"),
    details: z.strictObject({ references: z.array(mediaReferenceSchema).min(1) }),
  }),
]);
export const apiFailureSchema = z.strictObject({
  success: z.literal(false),
  error: apiErrorSchema,
  meta: requestMetaSchema,
});
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type FieldError = z.infer<typeof fieldErrorSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiFailure = z.infer<typeof apiFailureSchema>;

// Never forward Zod input, raw provider errors, or unknown object keys to clients.
export function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => {
    let code: FieldError["code"];
    switch (issue.code) {
      case "invalid_type":
        code = issue.message.includes("received undefined") ? "REQUIRED" : "INVALID_TYPE";
        break;
      case "too_small":
        code = "OUT_OF_RANGE";
        break;
      case "too_big":
        code = issue.origin === "string" ? "TOO_LONG" : "OUT_OF_RANGE";
        break;
      case "unrecognized_keys":
        code = "UNKNOWN_FIELD";
        break;
      case "custom": {
        const parsed = fieldErrorCodeSchema.safeParse(issue.params?.fieldCode);
        code = parsed.success ? parsed.data : "INVALID_FORMAT";
        break;
      }
      default:
        code = "INVALID_FORMAT";
    }
    const messages: Record<FieldError["code"], string> = {
      REQUIRED: "Field wajib diisi.",
      INVALID_TYPE: "Tipe nilai tidak sesuai.",
      INVALID_FORMAT: "Format nilai tidak sesuai.",
      OUT_OF_RANGE: "Nilai di luar rentang yang diizinkan.",
      TOO_LONG: "Teks terlalu panjang.",
      UNKNOWN_FIELD: "Ada field yang tidak dikenal.",
      INVALID_COMBINATION: "Kombinasi nilai tidak sesuai.",
    };
    return { path: issue.path.map(String).join("."), code, message: messages[code] };
  });
}
