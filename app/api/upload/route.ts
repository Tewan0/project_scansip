import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
    const form = await req.formData();
    const bucket = form.get("bucket") || "menu-photos";
    if (bucket !== "menu-photos" && bucket !== "restaurant-logos") throw new AccessError("ชนิดรูปภาพไม่ถูกต้อง", 400);
    const access = await getAccessForUser(user);
    if ((access && access.role !== "owner") || (!access && bucket !== "restaurant-logos")) throw new AccessError("คุณไม่มีสิทธิ์อัปโหลดรูปภาพ");
    const file = form.get("file");
    const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
    if (!(file instanceof File) || !types[file.type] || !file.size || file.size > 5 * 1024 * 1024) throw new AccessError("กรุณาใช้รูป JPG, PNG, WebP หรือ GIF ขนาดไม่เกิน 5 MB", 400);
    const path = `${user.id}/${randomUUID()}.${types[file.type]}`;
    const client = createAdminClient();
    const { error } = await client.storage.from(bucket).upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) throw error;
    // Deletion happens only after saving the record or an explicit authorized DELETE.
    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ success: true, url: data.publicUrl, path });
  } catch (error) { return apiError(error); }
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
