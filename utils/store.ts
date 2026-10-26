import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";

export const DEFAULT_STORE_CATEGORIES = [
  { name: "เครื่องดื่มกาแฟ", sortOrder: 1 },
  { name: "เครื่องดื่มที่ไม่ใช่กาแฟ", sortOrder: 2 },
  { name: "เบเกอรี่และของหวาน", sortOrder: 3 },
  { name: "อาหารว่างและทานเล่น", sortOrder: 4 },
  { name: "อาหารจานหลัก", sortOrder: 5 },
];

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
