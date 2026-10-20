import { NextResponse } from "next/server";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { and, eq, ne, isNull, or } from "drizzle-orm";
import { requireStoreAccess, apiError, AccessError } from "@/lib/auth";
type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { store } = await requireStoreAccess(["owner"]);
    const { id } = await params;
    const [deleted] = await db.delete(staff).where(and(
      eq(staff.id, id), eq(staff.storeId, store.id), ne(staff.role, "owner"),
      or(isNull(staff.userId), ne(staff.userId, store.ownerId)),
    )).returning();
    if (!deleted) throw new AccessError("ไม่พบพนักงาน หรือบัญชีนี้เป็นเจ้าของร้าน", 404);
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { store } = await requireStoreAccess(["owner"]);
    const { id } = await params;
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccessError("ข้อมูลคำขอไม่ถูกต้อง", 400);
    if (!["cashier", "kitchen"].includes(body.role)) throw new AccessError("เลือกบทบาทหน้าร้านหรือครัวเท่านั้น", 400);
    const [updated] = await db.update(staff).set({ role: body.role }).where(and(
      eq(staff.id, id), eq(staff.storeId, store.id), ne(staff.role, "owner"),
      or(isNull(staff.userId), ne(staff.userId, store.ownerId)),
    )).returning();
    if (!updated) throw new AccessError("ไม่พบพนักงาน หรือบัญชีนี้เป็นเจ้าของร้าน", 404);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) { return apiError(error); }
}
