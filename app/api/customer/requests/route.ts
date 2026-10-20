import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { serviceRequests } from "@/db/schema";
import { AccessError } from "@/lib/auth";
import { withCustomerSession, customerError } from "@/lib/customer-session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || !["assistance", "bill"].includes(body.kind)) throw new AccessError("ประเภทคำขอไม่ถูกต้อง", 400);
    const data = await withCustomerSession(body, async (tx, table) => {
      const scope = and(eq(serviceRequests.storeId, table.storeId), eq(serviceRequests.tableId, table.id),
        eq(serviceRequests.sessionToken, table.currentSessionToken!), eq(serviceRequests.kind, body.kind));
      const [pending] = await tx.select().from(serviceRequests).where(and(scope, eq(serviceRequests.status, "pending"))).limit(1);
      if (pending) return pending;
      const [last] = await tx.select().from(serviceRequests).where(scope).orderBy(desc(serviceRequests.createdAt)).limit(1);
      if (last && Date.now() - last.createdAt.getTime() < 30_000) throw new AccessError("ส่งคำขอแล้ว กรุณารอสักครู่ก่อนเรียกซ้ำ", 429);
      const [saved] = await tx.insert(serviceRequests).values({ storeId: table.storeId, tableId: table.id,
        tableNumber: table.tableNumber, sessionToken: table.currentSessionToken!, kind: body.kind }).returning();
      return saved;
    }, true);
    const { id, kind, status, createdAt, resolvedAt } = data;
    return NextResponse.json({ success: true, data: { id, kind, status, createdAt, resolvedAt } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return customerError(error); }
}
