import assert from "node:assert/strict";
import sharp from "sharp";

// A fixed, non-destination 1x1 PNG, independently encoded before Sharp runs.
const fixture = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const metadata = await sharp(fixture).metadata();
assert.equal(metadata.format, "png");
assert.equal(metadata.width, 1);
assert.equal(metadata.height, 1);
const { data, info } = await sharp(fixture).raw().toBuffer({ resolveWithObject: true });
assert.equal(info.width, 1);
assert.equal(info.height, 1);
assert.equal(data.length, info.channels);
await assert.rejects(sharp(Buffer.from("not an image")).raw().toBuffer());

console.info(
  JSON.stringify({
    check: "sharp-decode",
    result: "passed",
    platform: process.platform,
    arch: process.arch,
    bun: Bun.version,
    sharp: sharp.versions.sharp,
    vips: sharp.versions.vips,
  }),
);
