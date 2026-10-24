import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { checkBodyHeaders, readLimitedForm, UPLOAD_BODY_BYTES, UPLOAD_FILE_BYTES } from "@/lib/request-body";
import { consumeWriteQuota, OWNER_UPLOAD_LIMITS, ONBOARDING_UPLOAD_LIMITS, writeErrorResponse } from "@/lib/write-rate-limit";
import { requireUser, getAccessForUser, AccessError, apiError } from "@/lib/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { deleteStorageFile, extractStoragePath } from "@/utils/supabase/storage";

async function uploadAccess(bucket: string) {
  const user = await requireUser();
  const access = await getAccessForUser(user);
  if ((access && access.role !== "owner") || (!access && bucket !== "restaurant-logos")) throw new AccessError("คุณไม่มีสิทธิ์จัดการรูปภาพนี้");
  return user;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const access = await getAccessForUser(user);
    if (access && access.role !== "owner") throw new AccessError("คุณไม่มีสิทธิ์อัปโหลดรูปภาพ");
    checkBodyHeaders(req, "multipart/form-data", UPLOAD_BODY_BYTES);
    // Reserve before reading multipart data; malformed/failed attempts also count.
    // Commit before contacting Storage so parallel uploads cannot overshoot.
    await db.transaction(tx => consumeWriteQuota(tx, "uploads:user:" + user.id, access ? OWNER_UPLOAD_LIMITS : ONBOARDING_UPLOAD_LIMITS));
    const form = await readLimitedForm(req);
    const bucket = form.get("bucket") || "menu-photos";
    if (bucket !== "menu-photos" && bucket !== "restaurant-logos") throw new AccessError("ชนิดรูปภาพไม่ถูกต้อง", 400);
    if ((access && access.role !== "owner") || (!access && bucket !== "restaurant-logos")) throw new AccessError("คุณไม่มีสิทธิ์อัปโหลดรูปภาพ");
    const file = form.get("file");
    const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
    if (!(file instanceof File) || !types[file.type] || !file.size || file.size > UPLOAD_FILE_BYTES) throw new AccessError("กรุณาใช้รูป JPG, PNG, WebP หรือ GIF ขนาดไม่เกิน 5 MB", 400);
    const path = `${user.id}/${randomUUID()}.${types[file.type]}`;
    const client = createAdminClient();
    const { error } = await client.storage.from(bucket).upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) throw error;
    // Deletion happens only after saving the record or an explicit authorized DELETE.
    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ success: true, url: data.publicUrl, path });
  } catch (error) { return writeErrorResponse(error); }
}
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const bucket = body.bucket || "restaurant-logos";
    if (bucket !== "menu-photos" && bucket !== "restaurant-logos") throw new AccessError("ชนิดรูปภาพไม่ถูกต้อง", 400);
    const user = await uploadAccess(bucket);
    const path = extractStoragePath(body.url, bucket);
    if (!path?.startsWith(user.id + "/")) throw new AccessError("คุณไม่มีสิทธิ์ลบรูปภาพนี้");
    return NextResponse.json({ success: await deleteStorageFile(body.url, bucket, user.id) });
  } catch (error) { return apiError(error); }
}
