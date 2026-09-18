import { expect, test } from "bun:test";
import sharp from "sharp";
import { normalizeImage, bytesHash } from "../src/media/images";
import { decodeCursor } from "../src/media/library";
import { readMediaEnvironment } from "../src/media/config";
import { HttpError } from "../src/http/errors";
const id = "8fb7c8ae-7b48-4dd2-8253-b312c1d86d38";
const attempt = "13c10cd4-226c-4efb-95e5-591781a79ce3";
async function errorCode(action: Promise<unknown>) {
  try {
    await action;
  } catch (error) {
    if (error instanceof HttpError) return error.detail.code;
    throw error;
  }
  throw new Error("Expected media error.");
}
test("T-10 format nyata, varian WebP tanpa upscale, checksum dan pembuangan metadata", async () => {
  for (const width of [120, 320, 700, 2100]) {
    const source = await sharp({ create: { width, height: 80, channels: 3, background: "green" } })
      .jpeg()
      .withMetadata()
      .toBuffer();
    const outputs = await normalizeImage(source, id, attempt, new AbortController().signal);
    expect(outputs.map((v) => v.manifest.width)).toEqual([
      ...new Set([320, 640, 1280, 1920].map((target) => Math.min(width, target))),
    ]);
    for (const output of outputs) {
      const metadata = await sharp(output.bytes).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      expect(output.manifest.sha256).toBe(bytesHash(output.bytes));
      expect(output.manifest.byteSize).toBe(output.bytes.length);
      expect(output.manifest.objectKey).toBe(`media/${id}/${attempt}/${metadata.width}.webp`);
    }
  }
  const rotated = await sharp({
    create: { width: 640, height: 100, channels: 3, background: "green" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const result = await normalizeImage(rotated, id, attempt, new AbortController().signal);
  expect(result.map((v) => [v.manifest.width, v.manifest.height])).toEqual([[100, 640]]);
});
test("T-10 gambar rusak, APNG, animasi WebP, SVG, ukuran dan piksel berlebihan ditolak", async () => {
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } })
    .png()
    .toBuffer();
  const chunk = Buffer.alloc(20);
  chunk.writeUInt32BE(8);
  chunk.write("acTL", 4);
  chunk.writeUInt32BE(2, 8);
  const apng = Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
  const webp = Buffer.alloc(30);
  webp.write("RIFF");
  webp.writeUInt32LE(22, 4);
  webp.write("WEBPVP8X", 8);
  webp.writeUInt32LE(10, 16);
  webp[20] = 2;
  for (const source of [
    Buffer.from("broken"),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    apng,
    webp,
    png.subarray(0, 25),
  ])
    expect(await errorCode(normalizeImage(source, id, attempt, new AbortController().signal))).toBe(
      "IMAGE_INVALID",
    );
  expect(
    await errorCode(
      normalizeImage(Buffer.alloc(5_242_881), id, attempt, new AbortController().signal),
    ),
  ).toBe("FILE_TOO_LARGE");
  const huge = await sharp({
    create: { width: 5001, height: 5000, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  expect(await errorCode(normalizeImage(huge, id, attempt, new AbortController().signal))).toBe(
    "IMAGE_INVALID",
  );
});
test("T-10 cursor mempertahankan mikrodetik, filter dan bentuk tervalidasi", () => {
  const payload = { id, createdAt: "2026-09-18T00:00:00.123456Z", status: "ready" as const };
  const cursor = Buffer.from(JSON.stringify(payload)).toString("base64url");
  expect(decodeCursor(cursor, "ready")).toEqual(payload);
  for (const invalid of ["%%%", cursor + "=", Buffer.from("{}").toString("base64url")])
    expect(() => decodeCursor(invalid, "ready")).toThrow();
  expect(() => decodeCursor(cursor, undefined)).toThrow();
});
test("T-10 konfigurasi opsional seluruhnya kosong, parsial/unsafe ditolak tanpa secret", () => {
  expect(readMediaEnvironment({})).toEqual({ baseUrl: undefined, storage: undefined });
  expect(
    readMediaEnvironment({ MEDIA_BASE_URL: "https://assets.example.test/media" }).baseUrl,
  ).toBe("https://assets.example.test/media");
  const env = {
    MEDIA_BASE_URL: "https://assets.example.test",
    S3_ENDPOINT: "http://127.0.0.1:9000",
    S3_BUCKET: "fixture-media",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY_ID: "fixture-key",
    S3_SECRET_ACCESS_KEY: "fixture-secret",
  };
  expect(readMediaEnvironment(env).storage?.endpoint).toBe(env.S3_ENDPOINT);
  for (const bad of [
    { ...env, NODE_ENV: "production" },
    { ...env, S3_BUCKET: "" },
    { MEDIA_BASE_URL: "http://assets.example.test" },
    { ...env, S3_ENDPOINT: "https://user:password@example.test" },
  ])
    expect(() => readMediaEnvironment(bad)).toThrow("Konfigurasi media tidak sah");
});
