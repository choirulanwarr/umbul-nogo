import { apiFailureSchema, ERROR_HTTP_STATUS } from "@umbul-nogo/contracts/errors";
import type { ApiError, ErrorCode } from "@umbul-nogo/contracts/errors";

export class HttpError extends Error {
  constructor(
    readonly detail: ApiError,
    readonly headers: Record<string, string> = {},
  ) {
    super(detail.code);
  }
}
export function failure(
  code: Exclude<
    ErrorCode,
    "CONTENT_VERSION_CONFLICT" | "MEDIA_IN_USE" | "VALIDATION_ERROR" | "INVALID_CREDENTIALS"
  >,
): HttpError {
  const messages: Partial<Record<ErrorCode, string>> = {
    INVALID_REQUEST: "Request tidak sah.",
    NOT_FOUND: "Resource tidak ditemukan.",
    METHOD_NOT_ALLOWED: "Metode tidak diizinkan.",
    PAYLOAD_TOO_LARGE: "Ukuran request terlalu besar.",
    UNSUPPORTED_MEDIA_TYPE: "Tipe konten tidak didukung.",
    SERVICE_UNAVAILABLE: "Layanan sementara tidak tersedia.",
    INTERNAL_ERROR: "Terjadi kesalahan internal.",
    AUTH_REQUIRED: "Silakan masuk terlebih dahulu.",
  };
  return new HttpError({ code, message: messages[code] ?? "Request tidak dapat diproses." });
}
export function errorResponse(
  error: unknown,
  requestId: string,
): { response: Response; code: ErrorCode } {
  const safe = error instanceof HttpError ? error : failure("INTERNAL_ERROR");
  const body = apiFailureSchema.parse({ success: false, error: safe.detail, meta: { requestId } });
  return {
    response: Response.json(body, {
      status: ERROR_HTTP_STATUS[safe.detail.code],
      headers: safe.headers,
    }),
    code: safe.detail.code,
  };
}
