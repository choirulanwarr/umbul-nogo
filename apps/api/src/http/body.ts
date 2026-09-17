import { failure } from "./errors";

export const JSON_BODY_BYTES = 65_536;
export const MULTIPART_BODY_BYTES = 6_291_456;
export async function readBody(
  request: Request,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const length = request.headers.get("content-length");
  if (
    length !== null &&
    (!/^(0|[1-9][0-9]*)$/.test(length) || !Number.isSafeInteger(Number(length)))
  )
    throw failure("INVALID_REQUEST");
  if (length !== null && Number(length) > maxBytes) throw failure("PAYLOAD_TOO_LARGE");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    signal.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        cancel();
        throw failure("PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
    if (length !== null && Number(length) !== size) throw failure("INVALID_REQUEST");
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
export async function parseBody(
  request: Request,
  mode: "none" | "json" | "multipart",
  signal: AbortSignal,
): Promise<unknown> {
  if (mode === "none") {
    await readBody(request, 0, signal);
    return undefined;
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (
    request.headers.has("content-encoding") &&
    request.headers.get("content-encoding") !== "identity"
  )
    throw failure("UNSUPPORTED_MEDIA_TYPE");
  if (mode === "json" && !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType))
    throw failure("UNSUPPORTED_MEDIA_TYPE");
  if (mode === "multipart" && !/^multipart\/form-data\s*;.*\bboundary=/i.test(contentType))
    throw failure("UNSUPPORTED_MEDIA_TYPE");
  const bytes = await readBody(
    request,
    mode === "json" ? JSON_BODY_BYTES : MULTIPART_BODY_BYTES,
    signal,
  );
  try {
    if (mode === "json")
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    const data = await new Response(new Blob([bytes]), {
      headers: { "content-type": contentType },
    }).formData();
    if ([...data.keys()].length !== 1 || !(data.get("file") instanceof File))
      throw failure("INVALID_REQUEST");
    return { file: data.get("file") };
  } catch {
    throw failure("INVALID_REQUEST");
  }
}
