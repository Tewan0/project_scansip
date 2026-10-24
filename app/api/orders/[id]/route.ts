import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireStoreAccess, apiError, AccessError } from "@/lib/auth";
import { canAdvanceItem, aggregateCookingStatus, type CookingStatus } from "@/lib/permissions";
import { needsServing } from "@/lib/payments";
import { withCustomerSession, customerError } from "@/lib/customer-session";
type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = new URL(req.url).searchParams.get("token");
    const access = token ? null : await requireStoreAccess(["owner", "cashier"]);
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), access ? eq(orders.storeId, access.store.id) : undefined), with: { items: true },
    });
    if (!order) throw new AccessError("ไม่พบออเดอร์", 404);
    if (token) {
      return await withCustomerSession({ storeSlug: order.storeId, tableNumber: order.tableNumber, sessionToken: token }, async (tx, table) => {
        if (order.sessionToken !== table.currentSessionToken) throw new AccessError("ไม่พบออเดอร์ในรอบโต๊ะนี้", 404);
        const current = await tx.query.orders.findFirst({ where: and(eq(orders.id, id), eq(orders.storeId, table.storeId), eq(orders.sessionToken, table.currentSessionToken!)), with: { items: true } });
        if (!current) throw new AccessError("ไม่พบออเดอร์", 404);
        return NextResponse.json({ success: true, data: { ...current, sessionToken: undefined, requestKey: undefined, requestHash: undefined } }, { headers: { "Cache-Control": "private, no-store" } });
      });
    }
    return NextResponse.json({ success: true, data: { ...order, sessionToken: undefined, requestKey: undefined, requestHash: undefined } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return customerError(error); }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { store, role } = await requireStoreAccess();
    const { id } = await params;
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccessError("ข้อมูลคำขอไม่ถูกต้อง", 400);
    if ("delivered" in body && (body.delivered !== true || role === "kitchen" || Object.keys(body).some((key) => key !== "delivered"))) {
      throw new AccessError("เฉพาะหน้าร้านและเจ้าของร้านเท่านั้นที่ยืนยันเสิร์ฟได้", 403);
    }
    const cooking = "itemId" in body || "itemStatus" in body || "finishAll" in body;
    if (cooking && (role === "cashier" || "paymentStatus" in body || "status" in body)) throw new AccessError("เฉพาะครัวและเจ้าของร้านเท่านั้นที่ปรับสถานะการทำอาหารได้");
    if ("paymentStatus" in body && role === "kitchen") throw new AccessError("ครัวไม่มีสิทธิ์รับเงิน");
    if (body.status && role === "kitchen" && !["preparing", "served"].includes(body.status)) throw new AccessError("ครัวไม่มีสิทธิ์ปิดบิลหรือยกเลิกออเดอร์");
    if (body.status && role === "cashier" && ["pending", "preparing", "served"].includes(body.status)) throw new AccessError("หน้าร้านไม่มีสิทธิ์เปลี่ยนสถานะการทำอาหาร");
    const data = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, id), eq(orders.storeId, store.id))).for("update");
      if (!order) throw new AccessError("ไม่พบออเดอร์ในร้านนี้", 404);
      if (body.delivered === true) {
        if (order.deliveredAt) return { id: order.id, status: order.status, deliveredAt: order.deliveredAt };
        if (order.status !== "served" || !needsServing(order)) throw new AccessError("ต้องรอครัวทำอาหารครบก่อนยืนยันเสิร์ฟ", 409);
        const [updated] = await tx.update(orders).set({ deliveredAt: new Date(),
          status: order.paymentStatus === "paid" ? "completed" : "served", updatedAt: new Date() }).where(eq(orders.id, order.id)).returning();
        return { id: updated.id, status: updated.status, deliveredAt: updated.deliveredAt };
      }
      if (["cancelled", "completed"].includes(order.status)) throw new AccessError("ออเดอร์สิ้นสุดแล้ว กรุณาโหลดข้อมูลใหม่", 409);
      if (cooking) {
        if (body.finishAll !== true && (!["pending", "preparing", "ready"].includes(body.itemStatus) || typeof body.itemId !== "string")) throw new AccessError("สถานะรายการไม่ถูกต้อง", 400);
        const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        const targets = body.finishAll === true ? lines : lines.filter((line) => line.id === body.itemId);
        if (!targets.length) throw new AccessError("ไม่พบรายการในออเดอร์นี้", 404);
        const next: CookingStatus = body.finishAll === true ? "ready" : body.itemStatus;
        if (targets.some((line) => !canAdvanceItem(line.status, next))) throw new AccessError("ไม่สามารถย้อนสถานะรายการที่ทำแล้วได้", 409);
        for (const line of targets) {
          await tx.update(orderItems).set({ status: next }).where(and(eq(orderItems.id, line.id), eq(orderItems.orderId, order.id)));
          line.status = next;
        }
        const [updated] = await tx.update(orders).set({ status: aggregateCookingStatus(lines), updatedAt: new Date() }).where(eq(orders.id, order.id)).returning();
        return { id: updated.id, status: updated.status };
      }
      if (!body.status && !body.paymentStatus) throw new AccessError("ไม่มีรายการที่ต้องการเปลี่ยน", 400);
      if (body.paymentStatus !== undefined && body.paymentStatus !== "paid") throw new AccessError("สถานะการชำระเงินไม่ถูกต้อง", 400);
      if (body.status && !["preparing", "served", "completed", "cancelled"].includes(body.status)) throw new AccessError("สถานะออเดอร์ไม่ถูกต้อง", 400);
      if (body.status === "cancelled" && (order.paymentStatus === "paid" || body.paymentStatus || order.deliveredAt)) throw new AccessError("ยกเลิกออเดอร์ที่รับเงินหรือเสิร์ฟแล้วไม่ได้", 409);
      if (body.paymentStatus && order.servingRequired) throw new AccessError("กรุณารับเงินจากหน้าบิลเพื่อบันทึกช่องทางและเงินทอน", 400);
      if (body.status === "completed" && (order.status !== "served" || needsServing(order) || (order.paymentStatus !== "paid" && body.paymentStatus !== "paid"))) throw new AccessError("ต้องทำอาหารเสร็จ เสิร์ฟ และรับเงินก่อนปิดออเดอร์", 409);
      if (body.status === "preparing" && !["pending", "preparing"].includes(order.status)) throw new AccessError("ไม่สามารถย้อนสถานะได้", 409);
      if (body.status === "preparing" || body.status === "served") {
        const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        for (const line of lines) {
          const status = body.status === "served" ? "ready" : line.status === "pending" ? "preparing" : line.status;
          await tx.update(orderItems).set({ status }).where(eq(orderItems.id, line.id));
        }
      }
      const [updated] = await tx.update(orders).set({
        ...(body.status ? { status: body.status } : {}), ...(body.paymentStatus ? { paymentStatus: body.paymentStatus } : {}), updatedAt: new Date(),
      }).where(and(eq(orders.id, order.id), eq(orders.storeId, store.id))).returning();
      return { id: updated.id, status: updated.status };
    });
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiError(error); }
}
