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
    RECEIPT_NOT_FOUND:
      "Receipt belum tersedia atau retensinya berakhir; hasil simpan belum dapat dipastikan.",
    IDEMPOTENCY_KEY_REUSED: "Kunci operasi sudah dipakai untuk data yang berbeda.",
    UPLOAD_NOT_FOUND: "Reservasi unggahan belum ditemukan; hasil unggahan belum dapat dipastikan.",
    UPLOAD_KEY_REUSED: "Kunci unggahan sudah dipakai untuk berkas yang berbeda.",
    MEDIA_NOT_REUSABLE: "Media yang dihapus tidak dapat diunggah ulang dengan kunci lama.",
    MEDIA_BUSY: "Percobaan media sudah berubah atau masih diproses. Periksa status unggahan.",
    IMAGE_INVALID: "Gunakan gambar JPEG, PNG, atau WebP statis yang valid, maksimal 25 megapiksel.",
    FILE_TOO_LARGE: "Ukuran gambar maksimal 5 MiB.",
    STORAGE_UNAVAILABLE: "Penyimpanan gambar belum tersedia. Coba kembali nanti.",
    INVALID_CURSOR: "Cursor pustaka tidak sah atau filter sudah berubah.",
    INVALID_ORDER:
      "Urutan harus memuat seluruh ID item tepat satu kali, termasuk item tersembunyi.",
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
