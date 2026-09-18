import { createHash } from "node:crypto";
import sharp from "sharp";
import { MEDIA_LIMITS } from "@umbul-nogo/contracts/media";
import type { StoredImageVariant } from "../db/schema";
import { failure } from "../http/errors";

export const bytesHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export type EncodedVariant = { bytes: Buffer; manifest: StoredImageVariant };
export const objectKeyPattern = /^media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[1-9][0-9]*\.webp$/;
// APNG must be rejected even when the installed PNG loader only exposes frame 1.
function format(bytes: Buffer): "jpeg" | "png" | "webp" {
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = bytes.readUInt32BE(offset);
      if (offset + size + 12 > bytes.length) throw failure("IMAGE_INVALID");
      if (bytes.toString("ascii", offset + 4, offset + 8) === "acTL")
        throw failure("IMAGE_INVALID");
      offset += size + 12;
    }
    return "png";
  }
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const size = bytes.readUInt32LE(offset + 4);
      const type = bytes.toString("ascii", offset, offset + 4);
      if (["ANIM", "ANMF"].includes(type) || (type === "VP8X" && (bytes[offset + 8] ?? 0) & 2))
        throw failure("IMAGE_INVALID");
      if (offset + size + 8 > bytes.length) throw failure("IMAGE_INVALID");
      offset += 8 + size + (size % 2);
    }
    return "webp";
  }
  throw failure("IMAGE_INVALID");
}
export async function normalizeImage(
  bytes: Buffer,
  mediaId: string,
  attemptId: string,
  signal: AbortSignal,
): Promise<EncodedVariant[]> {
  if (bytes.length > MEDIA_LIMITS.fileBytes) throw failure("FILE_TOO_LARGE");
  if (!bytes.length) throw failure("IMAGE_INVALID");
  const options = { limitInputPixels: MEDIA_LIMITS.pixels, failOn: "warning" as const };
  try {
    signal.throwIfAborted();
    const signature = format(bytes);
    const metadata = await sharp(bytes, options).metadata();
    if (
      metadata.format !== signature ||
      (metadata.pages ?? 1) !== 1 ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > MEDIA_LIMITS.pixels
    )
      throw failure("IMAGE_INVALID");
    const width = metadata.autoOrient.width;
    const widths = [...new Set([320, 640, 1280, 1920].map((target) => Math.min(target, width)))];
    const results: EncodedVariant[] = [];
    for (const target of widths) {
      signal.throwIfAborted();
      const pipeline = sharp(bytes, options)
        .autoOrient()
        .resize({ width: target, withoutEnlargement: true })
        .webp({ quality: 82 })
        .timeout({ seconds: 10 });
      // Wait for native work to settle before the caller releases its slot.
      const abort = () => {
        pipeline.destroy();
      };
      signal.addEventListener("abort", abort, { once: true });
      try {
        const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
        signal.throwIfAborted();
        results.push({
          bytes: data,
          manifest: {
            objectKey: `media/${mediaId}/${attemptId}/${info.width}.webp`,
            width: info.width,
            height: info.height,
            mimeType: "image/webp",
            byteSize: data.length,
            sha256: bytesHash(data),
          },
        });
      } finally {
        signal.removeEventListener("abort", abort);
        pipeline.destroy();
      }
    }
    return results;
  } catch {
    if (signal.aborted) throw failure("SERVICE_UNAVAILABLE");
    throw failure("IMAGE_INVALID");
  }
}
