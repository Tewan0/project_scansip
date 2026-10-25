import "server-only";
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

export function validateImageUpload(value: unknown) {
  if (!(value instanceof File) || !value.size || value.size > UPLOAD_FILE_BYTES || !imageExtensions.has(value.type)) {
    throw new AccessError("กรุณาใช้รูป JPG, PNG, WebP หรือ GIF ขนาดไม่เกิน 5 MB", 400);
  }
  return { file: value, extension: imageExtensions.get(value.type)! };
}
