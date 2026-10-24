import { NextResponse } from "next/server";
import { db } from "@/db";
import { staff, stores } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireStoreAccess, apiError, AccessError } from "@/lib/auth";

export async function GET() {
  try {
    const { store } = await requireStoreAccess(["owner"]);
    const data = await db.select().from(staff).where(eq(staff.storeId, store.id)).orderBy(desc(staff.createdAt));
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiError(error); }
}
export async function POST(req: Request) {
  try {
    const { store, user } = await requireStoreAccess(["owner"]);
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccessError("ข้อมูลคำขอไม่ถูกต้อง", 400);
    if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || body.email.length > 254) throw new AccessError("อีเมลไม่ถูกต้อง", 400);
    const email = body.email.trim().toLowerCase();
    if (email === user.email?.toLowerCase()) throw new AccessError("บัญชีนี้เป็นเจ้าของร้านอยู่แล้ว", 400);
    if (!["cashier", "kitchen"].includes(body.role)) throw new AccessError("เลือกบทบาทหน้าร้านหรือครัวเท่านั้น", 400);
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : email.split("@")[0];
    if (name.length > 200) throw new AccessError("ชื่อยาวเกินไป", 400);
    const data = await db.transaction(async (tx) => {
      await tx.select({ id: stores.id }).from(stores).where(eq(stores.id, store.id)).for("update");
      const existing = await tx.query.staff.findFirst({ where: and(eq(staff.storeId, store.id), sql`lower(trim(${staff.email})) = ${email}`) });
      if (existing) throw new AccessError("อีเมลนี้อยู่ในรายชื่อร้านแล้ว", 409);
      const [created] = await tx.insert(staff).values({ storeId: store.id, email, name, role: body.role, userId: null }).returning();
      return created;
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) { return apiError(error); }
}
