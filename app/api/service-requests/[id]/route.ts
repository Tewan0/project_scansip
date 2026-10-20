import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceRequests } from "@/db/schema";
import { requireStoreAccess, AccessError, apiError } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { store } = await requireStoreAccess(["owner", "cashier"]);
    const { id } = await params;
    const body = await req.json();
    if (!/^[0-9a-f-]{36}$/i.test(id) || body?.status !== "resolved") throw new AccessError("ข้อมูลคำขอไม่ถูกต้อง", 400);
    const [updated] = await db.update(serviceRequests).set({ status: "resolved", resolvedAt: new Date() })
      .where(and(eq(serviceRequests.id, id), eq(serviceRequests.storeId, store.id), eq(serviceRequests.status, "pending"))).returning({ id: serviceRequests.id });
    if (!updated) throw new AccessError("คำขอนี้ถูกดำเนินการแล้วหรือไม่พบในร้านนี้ กรุณาอัปเดตข้อมูล", 409);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) { return apiError(error); }
}
