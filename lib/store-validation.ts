import "server-only";
import { AccessError } from "@/lib/auth";

export function validateStoreSettings(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AccessError("ข้อมูลตั้งค่าร้านไม่ถูกต้อง", 400);
  const body = input as Record<string, unknown>;
  const values: { name?: string; slug?: string; promptPayNumber?: string | null; openingTime?: string; closingTime?: string; currency?: string } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 200) throw new AccessError("กรุณาระบุชื่อร้าน 1–200 ตัวอักษร", 400);
    values.name = body.name.trim();
  }
  if (body.slug !== undefined) {
    if (typeof body.slug !== "string" || body.slug.length > 200) throw new AccessError("URL ร้านต้องยาวไม่เกิน 200 ตัวอักษร", 400);
    const slug = body.slug.trim().toLowerCase().replace(/[^\u0E00-\u0E7Fa-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) throw new AccessError("กรุณาระบุ URL ร้าน", 400);
    values.slug = slug;
  }
  for (const key of ["openingTime", "closingTime"] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body[key])) throw new AccessError("กรุณาระบุเวลาเปิดและปิดในรูปแบบ HH:mm", 400);
    values[key] = body[key];
  }
  // Validate the identifier's format only; this does not verify its registered bank account.
  if (body.promptPayNumber !== undefined) {
    if (body.promptPayNumber === null || body.promptPayNumber === "") values.promptPayNumber = null;
    else {
      if (typeof body.promptPayNumber !== "string" || body.promptPayNumber.length > 30) throw new AccessError("หมายเลขพร้อมเพย์ไม่ถูกต้อง", 400);
      const number = body.promptPayNumber.replace(/[\s-]/g, "");
      if (number && !/^(0\d{9}|\d{13})$/.test(number)) throw new AccessError("พร้อมเพย์ต้องเป็นเบอร์โทร 10 หลักขึ้นต้นด้วย 0 หรือเลขประจำตัว 13 หลัก", 400);
      values.promptPayNumber = number || null;
    }
  }
  if (body.currency !== undefined) {
    if (body.currency !== "THB") throw new AccessError("ระบบรองรับสกุลเงินบาท (THB) เท่านั้น", 400);
    values.currency = "THB";
  }
  return values;
}

// Onboarding uses the same field rules as settings, with required fields and defaults.
export function validateStoreOnboarding(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AccessError("ข้อมูลร้านไม่ถูกต้อง", 400);
  const body = input as Record<string, unknown>;
  const fields = validateStoreSettings({
    name: body.name ?? "",
    promptPayNumber: body.promptpayNumber,
    openingTime: body.openingTime === undefined ? "08:00" : body.openingTime,
    closingTime: body.closingTime === undefined ? "18:00" : body.closingTime,
  });
  const name = fields.name!;
  let rawSlug = body.slug;
  if (rawSlug === undefined || (typeof rawSlug === "string" && !rawSlug.trim())) {
    rawSlug = name.toLowerCase().replace(/[^\u0E00-\u0E7Fa-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")
      || "store-" + Math.random().toString(36).substring(2, 7);
  }
  // Validate after generation as well, so every stored slug fits customer routes.
  const slug = validateStoreSettings({ slug: rawSlug }).slug!;
  return {
    name,
    slug,
    promptPayNumber: fields.promptPayNumber ?? null,
    openingTime: fields.openingTime!,
    closingTime: fields.closingTime!,
    logoUrl: body.logoUrl,
  };
}
