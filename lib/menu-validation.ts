import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { AccessError } from "@/lib/auth";

export async function validateCategory(categoryId: unknown, storeId: string) {
  if (categoryId === null || categoryId === "" || categoryId === undefined) return null;
  if (typeof categoryId !== "string" || !/^[0-9a-f-]{36}$/i.test(categoryId)) throw new AccessError("หมวดหมู่ไม่ถูกต้อง", 400);
  const category = await db.query.categories.findFirst({ where: and(eq(categories.id, categoryId), eq(categories.storeId, storeId)) });
  if (!category) throw new AccessError("ไม่พบหมวดหมู่ในร้านนี้", 400);
  return category.id;
}

export function validatePrice(value: unknown) {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") throw new AccessError("ราคาไม่ถูกต้อง", 400);
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0 || price > 99999999.99) throw new AccessError("ราคาไม่ถูกต้อง", 400);
  return price.toFixed(2);
}

export function validateName(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > 200) throw new AccessError("กรุณาระบุชื่อไม่เกิน 200 ตัวอักษร", 400);
  return value.trim();
}
