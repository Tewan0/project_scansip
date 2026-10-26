// Shared by browser validation, server validation and Next.js transport config.
export const UPLOAD_FILE_BYTES = 4 * 1024 * 1024;
// Leave multipart room while staying below Vercel's 4.5 MB request limit.
export const UPLOAD_BODY_BYTES = UPLOAD_FILE_BYTES + 64 * 1024;
export const IMAGE_MIME_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(",");
export const IMAGE_UPLOAD_HINT = "JPG, PNG, WebP หรือ GIF ขนาดไม่เกิน 4 MB";
export const IMAGE_UPLOAD_ERROR = "กรุณาใช้รูป " + IMAGE_UPLOAD_HINT;

// Client checks improve feedback; server decoding remains authoritative.
export function imageUploadProblem(file: { size: number; type: string }): string | null {
  return !IMAGE_MIME_TYPES.includes(file.type) || !file.size || file.size > UPLOAD_FILE_BYTES
    ? IMAGE_UPLOAD_ERROR : null;
}
