import "server-only";
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { staff, stores } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { homeForRole, type StaffRole } from "@/lib/permissions";

export class AccessError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}

export type StoreAccess = { user: User; store: typeof stores.$inferSelect; role: StaffRole };

export async function requireUser() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.is_anonymous) throw new AccessError("กรุณาเข้าสู่ระบบก่อนทำรายการ", 401);
  return user;
}

// Resolve against current DB records on every request. Never trust a requested role,
// user_metadata, a fallback owner, or an invitation already bound to a different user.
export async function getAccessForUser(user: User): Promise<StoreAccess | null> {
  if (user.is_anonymous) throw new AccessError("กรุณาเข้าสู่ระบบด้วยบัญชี Google", 401);
  const owned = await db.query.stores.findFirst({ where: eq(stores.ownerId, user.id) });
  if (owned) return { user, store: owned, role: "owner" };
  const members = await db.query.staff.findMany({
    where: or(eq(staff.userId, user.id),
      user.email && user.email_confirmed_at
        ? and(isNull(staff.userId), sql`lower(trim(${staff.email})) = ${user.email.trim().toLowerCase()}`)
        : undefined),
    limit: 2,
  });
  if (!members.length) return null;
  if (members.length !== 1) throw new AccessError("บัญชีนี้มีสิทธิ์พนักงานซ้ำ กรุณาให้เจ้าของร้านตรวจรายชื่อพนักงาน");
  const member = members[0];
  if (member.role !== "cashier" && member.role !== "kitchen") {
    throw new AccessError("กรุณาให้เจ้าของร้านกำหนดบทบาทเป็นหน้าร้านหรือครัวใหม่");
  }
  const store = await db.query.stores.findFirst({ where: eq(stores.id, member.storeId) });
  if (!store) throw new AccessError("ไม่พบร้านค้าที่คุณมีสิทธิ์เข้าใช้งาน");
  return { user, store, role: member.role };
}

export async function requireStoreAccess(allowed: readonly StaffRole[] = ["owner", "cashier", "kitchen"]) {
  const access = await getAccessForUser(await requireUser());
  if (!access) throw new AccessError("บัญชีนี้ยังไม่มีร้านหรือสิทธิ์พนักงาน");
  if (!allowed.includes(access.role)) throw new AccessError("คุณไม่มีสิทธิ์ทำรายการนี้");
  return access;
}

export async function requirePageAccess(allowed: readonly StaffRole[]) {
  let access: StoreAccess | null;
  try { access = await getAccessForUser(await requireUser()); }
  catch (error) {
    if (error instanceof AccessError) redirect(error.status === 401 ? "/owner/login" : "/access-denied");
    throw error;
  }
  if (!access) redirect("/owner/onboarding");
  if (!allowed.includes(access.role)) redirect(homeForRole(access.role));
  return access;
}

export function apiError(error: unknown) {
  if (error instanceof AccessError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
  console.error("Request failed:", error);
  return NextResponse.json({ success: false, error: "ไม่สามารถทำรายการได้ กรุณาลองใหม่" }, { status: 500 });
}
