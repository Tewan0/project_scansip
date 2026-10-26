import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { reserveUploadQuota, validateImageUpload } from "@/lib/upload-policy";
import { checkBodyHeaders, readLimitedForm, readLimitedJson, UPLOAD_BODY_BYTES, UPLOAD_DELETE_BODY_BYTES } from "@/lib/request-body";
import { writeErrorResponse } from "@/lib/write-rate-limit";
import { requireUser, getAccessForUser, AccessError, apiError } from "@/lib/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { deleteStorageFile, extractStoragePath } from "@/utils/supabase/storage";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const access = await getAccessForUser(user);
    if (access && access.role !== "owner") throw new AccessError("คุณไม่มีสิทธิ์อัปโหลดรูปภาพ");
    checkBodyHeaders(req, "multipart/form-data", UPLOAD_BODY_BYTES);
    // Reserve before reading multipart data; malformed/failed attempts also count.
    // Commit before contacting Storage so parallel uploads cannot overshoot.
    await reserveUploadQuota(user.id, Boolean(access));
    const form = await readLimitedForm(req);
    const bucket = form.get("bucket") || "menu-photos";
    if (bucket !== "menu-photos" && bucket !== "restaurant-logos") throw new AccessError("ชนิดรูปภาพไม่ถูกต้อง", 400);
    if ((access && access.role !== "owner") || (!access && bucket !== "restaurant-logos")) throw new AccessError("คุณไม่มีสิทธิ์อัปโหลดรูปภาพ");
    const { file, bytes, extension } = await validateImageUpload(form.get("file"));
    const path = `${user.id}/${randomUUID()}.${extension}`;
    const client = createAdminClient();
    const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) throw error;
    // Deletion happens only after saving the record or an explicit authorized DELETE.
    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ success: true, url: data.publicUrl, path });
  } catch (error) { return writeErrorResponse(error); }
}
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const access = await getAccessForUser(user);
    if (access && access.role !== "owner") throw new AccessError("คุณไม่มีสิทธิ์ลบรูปภาพ");
    const body = await readLimitedJson(req, UPLOAD_DELETE_BODY_BYTES);
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.url !== "string") {
      throw new AccessError("ข้อมูลที่ส่งไม่ถูกต้อง", 400);
    }
    const bucket = body.bucket || "restaurant-logos";
    if (bucket !== "menu-photos" && bucket !== "restaurant-logos") throw new AccessError("ชนิดรูปภาพไม่ถูกต้อง", 400);
    if (!access && bucket !== "restaurant-logos") throw new AccessError("คุณไม่มีสิทธิ์ลบรูปภาพ");
    const path = extractStoragePath(body.url, bucket);
    if (!path?.startsWith(user.id + "/")) throw new AccessError("คุณไม่มีสิทธิ์ลบรูปภาพนี้");
    return NextResponse.json({ success: await deleteStorageFile(body.url, bucket, user.id) });
  } catch (error) { return apiError(error); }
}
