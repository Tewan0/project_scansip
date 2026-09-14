import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";

// Fallback owner UID ในกรณีที่ไม่พบ session (เช่น การทดสอบเบื้องต้น)
export const DEFAULT_OWNER_ID = "a4261258-4a0c-4e17-80a5-4780a879d8f2";

/**
 * แปลงชื่อร้านค้าเป็น slug เช่น "My Coffee Shop" -> "my-coffee-shop"
 */
export function generateSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `store-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * ดึง User ID จาก Session ของผู้ใช้ที่กำลังล็อกอินอยู่
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

/**
 * ดึงร้านค้าของ Owner ปัจจุบันตาม Session ของผู้ใช้ที่ล็อกอินจริง
 */
export async function getOrCreateStore(customOwnerId?: string) {
  // 1. ตรวจหา Owner ID จาก Session ก่อน หากไม่มีจึงใช้ fallback
  let ownerId = customOwnerId;
  if (!ownerId) {
    const sessionUserId = await getCurrentUserId();
    ownerId = sessionUserId || DEFAULT_OWNER_ID;
  }

  // 2. ค้นหาร้านค้าที่เป็นของ Owner ID นี้
  let store = await db.query.stores.findFirst({
    where: eq(stores.ownerId, ownerId),
  });

  // 3. หากยังไม่มีร้าน ให้สร้างร้านเริ่มต้นผูกกับ ownerId นี้
  if (!store) {
    const defaultName = "ScanSip Cafe & Roastery";
    const [newStore] = await db
      .insert(stores)
      .values({
        ownerId,
        name: defaultName,
        slug: "scansip",
        promptPayNumber: "081-234-5678",
        openingTime: "08:00",
        closingTime: "18:00",
        currency: "THB",
      })
      .returning();
    store = newStore;
  } else if (!store.slug) {
    // ถ้ามีร้านแล้วแต่ยังไม่มี slug ให้อัปเดต
    const slug = generateSlug(store.name);
    const [updated] = await db
      .update(stores)
      .set({ slug })
      .where(eq(stores.id, store.id))
      .returning();
    store = updated;
  }

  return store;
}

/**
 * ดึงร้านค้าจาก slug หรือ id (สำหรับหน้าสั่งอาหารของลูกค้า)
 */
export async function getStoreBySlugOrId(identifier: string) {
  // ลองหาจาก slug ก่อน
  let store = await db.query.stores.findFirst({
    where: eq(stores.slug, identifier),
  });

  // ถ้าไม่เจอ ลองหาจาก id
  if (!store) {
    try {
      store = await db.query.stores.findFirst({
        where: eq(stores.id, identifier),
      });
    } catch {
      // id อาจจะไม่ใช่ uuid รูปแบบถูกต้อง
    }
  }

  return store;
}
