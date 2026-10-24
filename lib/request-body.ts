import "server-only";
import { Buffer } from "node:buffer";
import { AccessError } from "@/lib/auth";

export const ORDER_BODY_BYTES = 80 * 1024;
export const UPLOAD_FILE_BYTES = 5 * 1024 * 1024;
export const UPLOAD_BODY_BYTES = UPLOAD_FILE_BYTES + 64 * 1024;

export function checkBodyHeaders(req: Request, contentType: string, maxBytes: number) {
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== contentType) {
    throw new AccessError("รูปแบบข้อมูลไม่ถูกต้อง", 415);
  }
  const length = req.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) {
    throw new AccessError("ขนาดข้อมูลไม่ถูกต้อง", 400);
  }
  if (length !== null && Number(length) > maxBytes) throw new AccessError("ข้อมูลที่ส่งมีขนาดใหญ่เกินไป", 413);
}

// Count the stream itself: Content-Length may be missing or dishonest.
async function readBoundedBody(req: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!req.body) throw new AccessError("ไม่พบข้อมูลคำขอ", 400);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new AccessError("ข้อมูลที่ส่งมีขนาดใหญ่เกินไป", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function readLimitedJson(req: Request, maxBytes: number) {
  checkBodyHeaders(req, "application/json", maxBytes);
  const bytes = await readBoundedBody(req, maxBytes);
  try { return JSON.parse(Buffer.from(bytes).toString("utf8")); }
  catch { throw new AccessError("ข้อมูลคำขอไม่ถูกต้อง", 400); }
}

export async function readLimitedForm(req: Request) {
  checkBodyHeaders(req, "multipart/form-data", UPLOAD_BODY_BYTES);
  const bytes = await readBoundedBody(req, UPLOAD_BODY_BYTES);
  try { return await new Response(bytes, { headers: { "Content-Type": req.headers.get("content-type")! } }).formData(); }
  catch { throw new AccessError("ข้อมูลไฟล์ไม่ถูกต้อง", 400); }
}
