import "server-only";
import type { User } from "@supabase/supabase-js";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { staff, stores } from "@/db/schema";
import { AccessError, getAccessForUser } from "@/lib/auth";
import { lockAccount } from "@/lib/account-lock";
import { homeForRole } from "@/lib/permissions";

function verifiedEmail(user: User) {
  if (user.is_anonymous || !user.email || !user.email_confirmed_at) {
    throw new AccessError("กรุณาเข้าสู่ระบบด้วยบัญชีที่ยืนยันอีเมลแล้ว", 403);
  }
  return user.email.trim().toLowerCase();
}

function pendingForEmail(email: string) {
  return and(isNull(staff.userId), sql`lower(trim(${staff.email})) = ${email}`, inArray(staff.role, ["cashier", "kitchen"]));
}

export async function listStaffInvitations(user: User) {
  if (user.is_anonymous || !user.email || !user.email_confirmed_at) return [];
  const pending = await db.select({ id: staff.id, storeId: staff.storeId, role: staff.role })
    .from(staff).where(pendingForEmail(verifiedEmail(user)));
  if (!pending.length) return [];
  const shops = await db.select({ id: stores.id, name: stores.name, slug: stores.slug })
    .from(stores).where(inArray(stores.id, [...new Set(pending.map(member => member.storeId))]));
  return pending.flatMap(member => {
    const shop = shops.find(shop => shop.id === member.storeId);
    if (!shop || (member.role !== "cashier" && member.role !== "kitchen")) return [];
    return [{ id: member.id, storeId: shop.id, storeName: shop.name, storeSlug: shop.slug, role: member.role }];
  });
}

export async function acceptStaffInvitation(user: User, invitationId: string, expectedStoreId: string, expectedRole: string) {
  const email = verifiedEmail(user);
  return db.transaction(async tx => {
    await lockAccount(tx, user.id);
    const access = await getAccessForUser(user, tx);
    if (access) throw new AccessError("บัญชีนี้มีร้านที่เข้าใช้งานอยู่แล้ว กรุณากลับไปหน้าทำงาน", 409);
    const scope = and(eq(staff.id, invitationId), pendingForEmail(email));
    // Lock the selected invitation so revoke/role updates cannot race acceptance.
    const [invitation] = await tx.select().from(staff).where(scope).for("update");
    if (!invitation) throw new AccessError("ไม่พบคำเชิญที่ยังรอยืนยันสำหรับบัญชีนี้", 404);
    if (invitation.storeId !== expectedStoreId || invitation.role !== expectedRole) {
      throw new AccessError("ข้อมูลคำเชิญเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่ก่อนยืนยัน", 409);
    }
    const shop = await tx.query.stores.findFirst({ where: eq(stores.id, invitation.storeId) });
    if (!shop) throw new AccessError("ไม่พบร้านของคำเชิญนี้", 404);
    if (invitation.role !== "cashier" && invitation.role !== "kitchen") throw new AccessError("บทบาทคำเชิญไม่ถูกต้อง", 400);
    const [accepted] = await tx.update(staff).set({ userId: user.id }).where(scope).returning();
    if (!accepted) throw new AccessError("คำเชิญนี้ไม่พร้อมใช้งานแล้ว กรุณาโหลดหน้าใหม่", 409);
    return { redirectUrl: homeForRole(invitation.role) };
  });
}

export async function declineStaffInvitation(user: User, invitationId: string) {
  const [removed] = await db.delete(staff)
    .where(and(eq(staff.id, invitationId), pendingForEmail(verifiedEmail(user)))).returning();
  if (!removed) throw new AccessError("ไม่พบคำเชิญที่ยังรอยืนยันสำหรับบัญชีนี้", 404);
}
