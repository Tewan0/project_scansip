import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireStoreAccess, requireUser } from "@/lib/auth";

export const DEFAULT_STORE_CATEGORIES = [
  { name: "เครื่องดื่มกาแฟ", sortOrder: 1 },
  { name: "เครื่องดื่มที่ไม่ใช่กาแฟ", sortOrder: 2 },
  { name: "เบเกอรี่และของหวาน", sortOrder: 3 },
  { name: "อาหารว่างและทานเล่น", sortOrder: 4 },
  { name: "อาหารจานหลัก", sortOrder: 5 },
];


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
  try { return (await requireUser()).id; } catch { return null; }
}

// Kept for existing owner API callers. Reading data must never create a store.
export async function getOrCreateStore() {
  return (await requireStoreAccess(["owner"])).store;
}

/**
 * ค้นหาด้วยรหัสร้านภายในโดยไม่ค้นในช่อง slug
 */
export async function getStoreById(id: string) {
  return db.query.stores.findFirst({ where: eq(stores.id, id) });
}

// Keep slug-first lookup for existing public links. Internal IDs must use getStoreById.
export async function getStoreBySlugOrId(identifier: string) {
  // ลองหาจาก slug ก่อน
  let store = await db.query.stores.findFirst({
    where: eq(stores.slug, identifier),
  });

  // ถ้าไม่เจอ ลองหาจาก id
  if (!store) {
    try {
      store = await getStoreById(identifier);
    } catch {
      // id อาจจะไม่ใช่ uuid รูปแบบถูกต้อง
    }
  }

  return store;
}
