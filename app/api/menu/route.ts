import { cleanupFailedMenuUpload } from "@/lib/menu-upload-cleanup";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { menuItems, categories } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getStoreBySlugOrId } from "@/utils/store";
import { requireStoreAccess, apiError, AccessError } from "@/lib/auth";
import { validateCategory, validateDescription, validateName, validatePrice } from "@/lib/menu-validation";
import { validateImageUrl } from "@/utils/supabase/storage";
import { createAdminClient } from "@/utils/supabase/admin";
import { readLimitedForm, readLimitedJson, MENU_BODY_BYTES } from "@/lib/request-body";
import { reserveUploadQuota, validateImageUpload } from "@/lib/upload-policy";
import { writeErrorResponse } from "@/lib/write-rate-limit";

export async function GET(req: Request) {
  try {
    const storeParam = new URL(req.url).searchParams.get("store");
    const store = storeParam ? await getStoreBySlugOrId(storeParam) : (await requireStoreAccess(["owner"])).store;
    if (!store) throw new AccessError("ไม่พบร้านค้า", 404);
    const items = await db.query.menuItems.findMany({
      where: eq(menuItems.storeId, store.id), with: { category: true }, orderBy: [desc(menuItems.createdAt)],
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) { return apiError(error); }
}

export async function POST(req: Request) {
  try {
    const { store, user } = await requireStoreAccess(["owner"]);
    let body: Record<string, unknown>;
    let image: FormDataEntryValue | null = null;
    if (req.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
      const form = await readLimitedForm(req);
      body = Object.fromEntries(form.entries());
      const available = form.get("isAvailable");
      if (available !== null && available !== "true" && available !== "false") throw new AccessError("สถานะเมนูไม่ถูกต้อง", 400);
      body.isAvailable = available === null ? undefined : available === "true";
      image = form.get("image");
    } else {
      body = await readLimitedJson(req, MENU_BODY_BYTES);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccessError("ข้อมูลเมนูไม่ถูกต้อง", 400);
    const description = validateDescription(body.description);
    const name = validateName(body.name);
    const price = validatePrice(body.price);
    const categoryId = await validateCategory(body.categoryId, store.id);
    const category = categoryId ? await db.query.categories.findFirst({ where: and(eq(categories.id, categoryId), eq(categories.storeId, store.id)) }) : null;
    if (body.isAvailable !== undefined && typeof body.isAvailable !== "boolean") throw new AccessError("สถานะเมนูไม่ถูกต้อง", 400);
    let imageUrl = validateImageUrl(body.imageUrl, "menu-photos", user.id);
    let uploadedPath: string | null = null;
    if (image !== null) {
      await reserveUploadQuota(user.id);
      const validated = await validateImageUpload(image);
      const path = `${user.id}/${randomUUID()}.${validated.extension}`;
      const storage = createAdminClient().storage.from("menu-photos");
      const { error } = await storage.upload(path, validated.bytes, { contentType: validated.file.type, upsert: false });
      if (error) throw new AccessError("อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง", 503);
      uploadedPath = path;
      imageUrl = storage.getPublicUrl(path).data.publicUrl;
    }
    let created;
    try {
      const [item] = await db.insert(menuItems).values({
        storeId: store.id, name, price, categoryId,
        description,
        imageUrl,
        isAvailable: body.isAvailable ?? true,
      }).returning();
      created = item;
    } catch (error) {
      if (uploadedPath && imageUrl) await cleanupFailedMenuUpload(uploadedPath, imageUrl, store.id);
      throw error;
    }
    return NextResponse.json({ success: true, data: { ...created, category } }, { status: 201 });
  } catch (error) { return writeErrorResponse(error); }
}
