"use server";

import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireStoreAccess, AccessError } from "@/lib/auth";
import { validateCategory, validateName, validatePrice } from "@/lib/menu-validation";
import { createAdminClient } from "@/utils/supabase/admin";
import { deleteStorageFile } from "@/utils/supabase/storage";
import { reserveUploadQuota, validateImageUpload } from "@/lib/upload-policy";
import { checkFormSize } from "@/lib/request-body";
import { WriteRateLimitError } from "@/lib/write-rate-limit";

export async function deleteMenuItem(menuItemId: string) {
  try {
    const { store, user } = await requireStoreAccess(["owner"]);
    const [item] = await db.delete(menuItems).where(and(eq(menuItems.id, menuItemId), eq(menuItems.storeId, store.id))).returning();
    if (!item) throw new AccessError("ไม่พบเมนูในร้านนี้", 404);
    await deleteStorageFile(item.imageUrl, "menu-photos", user.id).catch(console.error);
    revalidatePath("/dashboard/menu");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof AccessError ? error.message : "ไม่สามารถลบเมนูได้", status: error instanceof AccessError ? error.status : 500 };
  }
}

export async function updateMenuItem(menuItemId: string, form: FormData) {
  try {
    const { store, user } = await requireStoreAccess(["owner"]);
    const item = await db.query.menuItems.findFirst({ where: and(eq(menuItems.id, menuItemId), eq(menuItems.storeId, store.id)) });
    if (!item) throw new AccessError("ไม่พบเมนูในร้านนี้", 404);
    checkFormSize(form);
    const name = validateName(form.get("name"));
    const price = validatePrice(form.get("unitPrice") ?? form.get("price"));
    const categoryId = await validateCategory(form.get("categoryId") === "none" ? null : form.get("categoryId"), store.id);
    let imageUrl = form.get("removeImage") === "true" ? null : item.imageUrl;
    const file = form.get("image") || form.get("file") || form.get("photo");
    // An empty unnamed file is the browser's unselected file input.
    if (file !== null && !(file instanceof File && !file.size && !file.name)) {
      await reserveUploadQuota(user.id);
      const validated = validateImageUpload(file);
      const path = `${user.id}/${randomUUID()}.${validated.extension}`;
      const client = createAdminClient();
      const { error } = await client.storage.from("menu-photos").upload(path, new Uint8Array(await validated.file.arrayBuffer()), { contentType: validated.file.type, upsert: false });
      if (error) throw error;
      imageUrl = client.storage.from("menu-photos").getPublicUrl(path).data.publicUrl;
    }
    const [updated] = await db.update(menuItems).set({
      name, price, categoryId, imageUrl, description: String(form.get("description") || "").trim() || null,
      isAvailable: ["true", "on", "1"].includes(String(form.get("isAvailable"))), updatedAt: new Date(),
    }).where(and(eq(menuItems.id, item.id), eq(menuItems.storeId, store.id))).returning();
    if (imageUrl !== item.imageUrl) await deleteStorageFile(item.imageUrl, "menu-photos", user.id).catch(console.error);
    revalidatePath("/dashboard/menu");
    return { success: true as const, data: updated };
  } catch (error) {
    return { success: false as const, error: error instanceof AccessError ? error.message : "ไม่สามารถแก้ไขเมนูได้",
      status: error instanceof AccessError ? error.status : 500,
      ...(error instanceof WriteRateLimitError ? { retryAfter: error.retryAfter } : {}),
    };
  }
}
