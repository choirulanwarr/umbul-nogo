import { S3Client } from "bun";
import type { MediaConfig } from "./config";
import { bytesHash, objectKeyPattern } from "./images";
import type { StoredImageVariant } from "../db/schema";
import { failure } from "../http/errors";
export type MediaStorage = {
  put: (key: string, bytes: Buffer, signal: AbortSignal) => Promise<void>;
  verify: (variant: StoredImageVariant, signal: AbortSignal) => Promise<void>;
};
export function createMediaStorage(config: NonNullable<MediaConfig["storage"]>): MediaStorage {
  const client = new S3Client(config);
  async function request(key: string, method: "PUT" | "GET", signal: AbortSignal, bytes?: Buffer) {
    if (!objectKeyPattern.test(key)) throw failure("INTERNAL_ERROR");
    try {
      const response = await fetch(client.presign(key, { method, expiresIn: 120 }), {
        method,
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        redirect: "error",
        ...(bytes
          ? {
              body: new Uint8Array(bytes),
              headers: {
                "Content-Type": "image/webp",
                "Cache-Control": "public, max-age=31536000, immutable",
              },
            }
          : {}),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw failure("STORAGE_UNAVAILABLE");
      }
      return response;
    } catch {
      throw failure("STORAGE_UNAVAILABLE");
    }
  }
  return {
    put: async (key, bytes, signal) => {
      const response = await request(key, "PUT", signal, bytes);
      await response.body?.cancel();
    },
    verify: async (variant, signal) => {
      const response = await request(variant.objectKey, "GET", signal);
      const reader = response.body?.getReader();
      if (!reader) throw failure("STORAGE_UNAVAILABLE");
      try {
        if (response.headers.get("content-type")?.split(";")[0] !== "image/webp")
          throw failure("STORAGE_UNAVAILABLE");
        const parts: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          signal.throwIfAborted();
          size += value.length;
          if (size > variant.byteSize) throw failure("STORAGE_UNAVAILABLE");
          parts.push(value);
        }
        if (size !== variant.byteSize || bytesHash(Buffer.concat(parts)) !== variant.sha256)
          throw failure("STORAGE_UNAVAILABLE");
      } catch {
        throw failure("STORAGE_UNAVAILABLE");
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    },
  };
}
