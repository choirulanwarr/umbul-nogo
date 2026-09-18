import { expect, test } from "bun:test";
import { S3Client } from "bun";
import sharp from "sharp";
import { readMediaEnvironment } from "../src/media/config";
import { createMediaStorage } from "../src/media/storage";
import { normalizeImage } from "../src/media/images";

// Separate opt-in: never silently writes to the application's bucket.
test("T-10 upload dan verifikasi checksum S3 nyata pada bucket test terisolasi", async () => {
  if (process.env.ALLOW_MEDIA_STORAGE_TESTS !== "umbul-media-test")
    throw new Error("Tes storage belum disetujui/diaktifkan.");
  const config = readMediaEnvironment({
    NODE_ENV: "test",
    MEDIA_BASE_URL: "https://assets.example.test",
    S3_ENDPOINT: process.env.TEST_S3_ENDPOINT,
    S3_REGION: process.env.TEST_S3_REGION,
    S3_BUCKET: process.env.TEST_S3_BUCKET,
    S3_ACCESS_KEY_ID: process.env.TEST_S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.TEST_S3_SECRET_ACCESS_KEY,
  });
  if (!config.storage || !config.storage.bucket.startsWith("umbul-media-test-"))
    throw new Error("Gunakan bucket khusus berawalan umbul-media-test-.");
  const storage = createMediaStorage(config.storage);
  const client = new S3Client(config.storage);
  const source = await sharp({
    create: { width: 700, height: 120, channels: 3, background: "green" },
  })
    .png()
    .toBuffer();
  const signal = AbortSignal.timeout(55_000);
  const variants = await normalizeImage(source, crypto.randomUUID(), crypto.randomUUID(), signal);
  const keys: string[] = [];
  try {
    for (const variant of variants) {
      keys.push(variant.manifest.objectKey);
      await storage.put(variant.manifest.objectKey, variant.bytes, signal);
      await storage.verify(variant.manifest, signal);
    }
    expect(variants.map((v) => v.manifest.width)).toEqual([320, 640, 700]);
    const first = variants[0]!;
    await storage.put(first.manifest.objectKey, Buffer.from("corrupted fixture"), signal);
    let rejected = false;
    try {
      await storage.verify(first.manifest, signal);
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  } finally {
    for (const key of keys) await client.delete(key);
  }
}, 60_000);
