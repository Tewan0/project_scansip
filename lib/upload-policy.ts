import "server-only";
import { Buffer } from "node:buffer";
import sharp from "sharp";
import { db } from "@/db";
import { AccessError } from "@/lib/auth";
import { UPLOAD_FILE_BYTES } from "@/lib/request-body";
import { consumeWriteQuota, OWNER_UPLOAD_LIMITS, ONBOARDING_UPLOAD_LIMITS } from "@/lib/write-rate-limit";

// Call only after authorization. All upload entry points share this account key.
// Commit before contacting Storage so failures still consume an attempt.
export async function reserveUploadQuota(userId: string, owner = true) {
  await db.transaction(tx => consumeWriteQuota(tx, "uploads:user:" + userId,
    owner ? OWNER_UPLOAD_LIMITS : ONBOARDING_UPLOAD_LIMITS));
}

const imageExtensions = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/gif", "gif"],
]);

export const MAX_IMAGE_PIXELS = 25_000_000;
export const MAX_IMAGE_DIMENSION = 10_000;
export const MAX_IMAGE_FRAMES = 100;

function matchesImageSignature(bytes: Buffer, mime: string) {
  switch (mime) {
    case "image/jpeg": return bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    case "image/png": return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/gif": return ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
    case "image/webp": return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    default: return false;
  }
}

export async function validateImageUpload(value: unknown) {
  if (!(value instanceof File) || !value.size || value.size > UPLOAD_FILE_BYTES || !imageExtensions.has(value.type)) {
    throw new AccessError("กรุณาใช้รูป JPG, PNG, WebP หรือ GIF ขนาดไม่เกิน 5 MB", 400);
  }
  const bytes = Buffer.from(await value.arrayBuffer());
  // Only pass supported raster formats to the decoder, never SVG or arbitrary files.
  if (!matchesImageSignature(bytes, value.type)) throw new AccessError("เนื้อไฟล์ไม่ตรงกับชนิดรูปภาพ กรุณาเลือกไฟล์รูปจริง", 400);
  const image = sharp(bytes, { animated: true, limitInputPixels: MAX_IMAGE_PIXELS, failOn: "warning" });
  try {
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.pageHeight ?? metadata.height ?? 0;
    const frames = metadata.pages ?? 1;
    if (metadata.format !== value.type.slice("image/".length)) throw new AccessError("ชนิดรูปภาพไม่ถูกต้อง", 400);
    if (!width || !height || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION
      || frames > MAX_IMAGE_FRAMES || width * height * frames > MAX_IMAGE_PIXELS) {
      throw new AccessError("รูปต้องมีด้านยาวไม่เกิน 10,000 พิกเซล รวมไม่เกิน 25 ล้านพิกเซล และไม่เกิน 100 เฟรม", 400);
    }
    // Metadata alone accepts some truncated files. Decode every frame with bounded work.
    await image.timeout({ seconds: 5 }).raw().toBuffer();
  } catch (error) {
    if (error instanceof AccessError) throw error;
    throw new AccessError("อ่านรูปภาพไม่ได้ ไฟล์อาจเสียหรือมีขนาดภาพใหญ่เกินกำหนด กรุณาเลือกรูปใหม่", 400);
  } finally {
    image.destroy();
  }
  return { file: value, bytes, extension: imageExtensions.get(value.type)! };
}
