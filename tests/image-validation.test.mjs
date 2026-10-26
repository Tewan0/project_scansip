import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import sharp from "sharp";
import { fixture } from "./helpers.mjs";
import { pngBytes, imageFile } from "./image-fixtures.mjs";

const validate = () => fixture().load("lib/upload-policy.ts").validateImageUpload;
const file = (bytes, type = "image/png") => new File([bytes], "untrusted.html", { type });
const rejected = error => error.status === 400 && typeof error.message === "string";
function pngDimensions(width, height) {
  const bytes = Buffer.from(pngBytes);
  bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
  bytes.writeUInt32BE(crc32(bytes.subarray(12, 29)), 29);
  return bytes;
}
async function animation(format, frames) {
  const bytes = Buffer.alloc(frames * 3);
  for (let frame = 0; frame < frames; frame++) { bytes[frame * 3] = (frame % 2) * 255; bytes[frame * 3 + 1] = 255 - (frame % 2) * 255; }
  return sharp(bytes, { raw: { width: 1, height: frames, channels: 3, pageHeight: 1 } }).toFormat(format, { delay: 100, loop: 0 }).toBuffer();
}

for (const format of ["jpeg", "png", "webp", "gif"]) {
  test("decodes real " + format + " and preserves uploaded bytes", async () => {
    const bytes = await sharp(pngBytes).toFormat(format).toBuffer();
    const input = file(bytes, "image/" + format);
    const result = await validate()(input);
    assert.equal(result.file, input);
    assert.equal(result.extension, format === "jpeg" ? "jpg" : format);
    assert.deepEqual(result.bytes, bytes);
  });
}

test("valid GIF and WebP animations keep all frames and original bytes", async () => {
  for (const format of ["gif", "webp"]) {
    const bytes = await animation(format, 3);
    assert.equal((await sharp(bytes, { animated: true }).metadata()).pages, 3);
    const result = await validate()(file(bytes, "image/" + format));
    assert.deepEqual(result.bytes, bytes);
  }
});

test("rejects text, HTML, SVG, signatures without image data and a mismatched MIME", async () => {
  for (const [bytes, type] of [
    ["not an image", "image/png"], ["<html><script>alert(1)</script></html>", "image/jpeg"],
    ['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>', "image/png"],
    [pngBytes, "image/jpeg"], [pngBytes.subarray(0, 8), "image/png"],
    [Buffer.from([255, 216, 255]), "image/jpeg"], ["GIF89a", "image/gif"],
    ["RIFF0000WEBP", "image/webp"], [pngBytes, "image/svg+xml"],
  ]) await assert.rejects(validate()(file(bytes, type)), rejected);
});

test("rejects corrupt compressed pixels even when image metadata can be read", async () => {
  const corrupt = Buffer.from(pngBytes);
  const typeOffset = corrupt.indexOf(Buffer.from("IDAT"));
  const length = corrupt.readUInt32BE(typeOffset - 4);
  corrupt[typeOffset + 4] = 255;
  corrupt.writeUInt32BE(crc32(corrupt.subarray(typeOffset, typeOffset + 4 + length)), typeOffset + 4 + length);
  assert.equal((await sharp(corrupt).metadata()).width, 2);
  await assert.rejects(validate()(file(corrupt)), rejected);
});

test("rejects oversized dimensions, total pixels, and excessive animation frames", async () => {
  for (const bytes of [pngDimensions(10001, 1), pngDimensions(1, 10001), pngDimensions(5001, 5000)]) {
    await assert.rejects(validate()(file(bytes)), rejected);
  }
  const bytes = await animation("gif", 101);
  assert.equal((await sharp(bytes, { animated: true }).metadata()).pages, 101);
  await assert.rejects(validate()(file(bytes, "image/gif")), rejected);
});

test("accepts exact dimension and frame boundaries without changing formats", async () => {
  const wide = await sharp({ create: { width: 10000, height: 1, channels: 3, background: "white" } }).png().toBuffer();
  assert.equal((await validate()(file(wide))).extension, "png");
  const animated = await animation("gif", 100);
  assert.equal((await sharp(animated, { animated: true }).metadata()).pages, 100);
  assert.equal((await validate()(file(animated, "image/gif"))).extension, "gif");
});

test("rejects invalid file objects, empty and oversized files before reading their bytes", async () => {
  const check = validate();
  for (const value of [null, "image", new File([], "empty.png", { type: "image/png" })]) await assert.rejects(check(value), rejected);
  const oversized = imageFile({ size: 4 * 1024 * 1024 + 1 });
  let read = false;
  oversized.arrayBuffer = async () => { read = true; throw new Error("must not read"); };
  await assert.rejects(check(oversized), rejected);
  assert.equal(read, false);
});
