import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { billPayments, orders, stores, tables } from "@/db/schema";
import { requireStoreAccess, AccessError, apiError } from "@/lib/auth";
import { billIdentity } from "@/lib/bills-server";
import { MAX_PAYMENT_CENTS, needsServing } from "@/lib/payments";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { store, user } = await requireStoreAccess(["owner", "cashier"]);
    const { id } = await params;
    const body = await req.json();
    if (!/^[0-9a-f]{64}$/.test(id) || !body || typeof body.anchorOrderId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.anchorOrderId) ||
      !Number.isSafeInteger(body.expectedTotalCents) || body.expectedTotalCents < 0 ||
      !Array.isArray(body.expectedOrderIds) || !body.expectedOrderIds.length || body.expectedOrderIds.length > 10000 ||
      body.expectedOrderIds.some((value: unknown) => typeof value !== "string") || new Set(body.expectedOrderIds).size !== body.expectedOrderIds.length) {
      throw new AccessError("ข้อมูลยืนยันยอดไม่ถูกต้อง กรุณาโหลดบิลใหม่", 400);
    }
    if (!["cash", "transfer"].includes(body.method) || !Number.isSafeInteger(body.receivedCents) ||
      body.receivedCents < 0 || body.receivedCents > MAX_PAYMENT_CENTS) {
      throw new AccessError("กรุณาเลือกเงินสดหรือโอน และระบุยอดรับเงินให้ถูกต้อง", 400);
    }
    const data = await db.transaction(async (tx) => {
      // Serializes with order placement and close/reopen; the client must review a
      // new snapshot when a new order, cancellation or payment changes the bill.
      await tx.select({ id: stores.id }).from(stores).where(eq(stores.id, store.id)).for("update");
      const anchor = await tx.query.orders.findFirst({ where: and(eq(orders.id, body.anchorOrderId), eq(orders.storeId, store.id)) });
      if (!anchor || billIdentity(anchor).id !== id) throw new AccessError("ไม่พบบิลในร้านนี้", 404);
      if (anchor.tableNumber !== null) await tx.select({ id: tables.id }).from(tables).where(and(eq(tables.storeId, store.id), eq(tables.tableNumber, anchor.tableNumber))).for("update");
      const round = anchor.sessionToken ? and(eq(orders.sessionToken, anchor.sessionToken), anchor.tableNumber === null ? isNull(orders.tableNumber) : eq(orders.tableNumber, anchor.tableNumber)) : eq(orders.id, anchor.id);
      const tickets = await tx.select().from(orders).where(and(eq(orders.storeId, store.id), round)).orderBy(asc(orders.id)).for("update");
      const unpaid = tickets.filter((order) => order.status !== "cancelled" && order.paymentStatus === "unpaid");
      const amount = unpaid.reduce((sum, order) => sum + Math.round(Number(order.totalAmount) * 100), 0);
      const expected = new Set<string>(body.expectedOrderIds);
      if (!unpaid.length || unpaid.length !== expected.size || unpaid.some((order) => !expected.has(order.id)) || amount !== body.expectedTotalCents) {
        throw new AccessError("รายการหรือยอดบิลเปลี่ยนแล้ว กรุณาตรวจยอดล่าสุดและยืนยันรับเงินอีกครั้ง", 409);
      }
      if (amount > MAX_PAYMENT_CENTS || body.receivedCents < amount || (body.method === "transfer" && body.receivedCents !== amount)) {
        throw new AccessError("เงินสดต้องไม่น้อยกว่ายอดบิล และยอดโอนต้องตรงกับยอดบิล", 400);
      }
      const changeCents = body.receivedCents - amount;
      const [receipt] = await tx.insert(billPayments).values({ storeId: store.id, billId: id, method: body.method,
        amountCents: amount, receivedCents: body.receivedCents, changeCents, receivedBy: user.id }).returning();
      for (const order of unpaid) await tx.update(orders).set({ paymentStatus: "paid", paymentId: receipt.id,
        ...(order.status === "served" && !needsServing(order) ? { status: "completed" as const } : {}), updatedAt: new Date() }).where(and(eq(orders.id, order.id), eq(orders.storeId, store.id)));
      return { billId: id, paidOrderCount: unpaid.length, paidCents: amount, method: body.method, receivedCents: body.receivedCents, changeCents };
    });
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiError(error); }
}
