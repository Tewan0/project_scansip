import sharp from "sharp";

export const pngBytes = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 40, g: 100, b: 180, alpha: 0.5 } } }).png().toBuffer();

// Padding preserves a decodable image while exercising exact upload byte boundaries.
export function imageFile({ size = pngBytes.length, type = "image/png" } = {}) {
  const bytes = Buffer.alloc(size);
  pngBytes.copy(bytes);
  return new File([bytes], "photo.png", { type });
}
