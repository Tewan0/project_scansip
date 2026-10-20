import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { orders, orderItems, tables, stores, menuItems } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireStoreAccess, apiError, AccessError } from "@/lib/auth";
import { getStoreBySlugOrId } from "@/utils/store";
import { billIdentity } from "@/lib/bills-server";

export async function GET() {
  try {
    const { store, role } = await requireStoreAccess();
    // Never drop unfinished tickets just because newer orders filled the history limit.
    const [active, history] = await Promise.all([
      db.query.orders.findMany({
        where: and(eq(orders.storeId, store.id), inArray(orders.status, ["pending", "preparing", "served"])),
        with: { items: true }, orderBy: [desc(orders.createdAt)],
      }),
      role === "kitchen" ? Promise.resolve([]) : db.query.orders.findMany({
        where: and(eq(orders.storeId, store.id), inArray(orders.status, ["completed", "cancelled"])),
        with: { items: true }, orderBy: [desc(orders.createdAt)], limit: 200,
      }),
    ]);
    const data = [...active, ...history].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    return NextResponse.json({ success: true, data: data.map((order) => role === "kitchen" ? {
      id: order.id, orderNumber: order.orderNumber, billNumber: billIdentity(order).number, tableNumber: order.tableNumber, status: order.status,
      customerNote: order.customerNote, createdAt: order.createdAt,
      items: order.items.map(({ id, menuName, quantity, specialInstruction, status }) => ({ id, menuName, quantity, specialInstruction, status })),
    } : { ...order, sessionToken: undefined }) });
  } catch (error) { return apiError(error); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") throw new AccessError("ข้อมูลคำขอไม่ถูกต้อง", 400);
    const { tableNumber, sessionToken, items } = body;
    if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 50 ||
      typeof sessionToken !== "string" || !sessionToken || typeof (body.storeSlug || body.storeId) !== "string") {
      throw new AccessError("กรุณาสแกน QR Code ของรอบโต๊ะปัจจุบันก่อนสั่งอาหาร", 403);
    }
    if (!Array.isArray(items) || !items.length || items.length > 50 || items.some((item) =>
      !item || typeof item.menuItemId !== "string" || !/^[0-9a-f-]{36}$/i.test(item.menuItemId) ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 ||
      (item.specialInstruction != null && (typeof item.specialInstruction !== "string" || item.specialInstruction.length > 300))
    )) throw new AccessError("รายการอาหารหรือจำนวนไม่ถูกต้อง", 400);
    if (body.customerNote != null && (typeof body.customerNote !== "string" || body.customerNote.length > 500)) throw new AccessError("หมายเหตุยาวเกินไป", 400);
    const store = await getStoreBySlugOrId(body.storeSlug || body.storeId);
    if (!store) throw new AccessError("ไม่พบร้านค้า", 404);
    const data = await db.transaction(async (tx) => {
      // Same lock order as opening/closing tables: store, then table.
      await tx.select({ id: stores.id }).from(stores).where(eq(stores.id, store.id)).for("update");
      const [table] = await tx.select().from(tables).where(and(eq(tables.storeId, store.id), eq(tables.tableNumber, tableNumber))).for("update");
      if (!table || table.status !== "occupied" || table.currentSessionToken !== sessionToken) throw new AccessError("รอบโต๊ะหมดอายุแล้ว กรุณาสแกน QR ใหม่", 403);
      const menu = await tx.select().from(menuItems).where(and(eq(menuItems.storeId, store.id), inArray(menuItems.id, items.map((item) => item.menuItemId))));
      const lines = items.map((item) => {
        const product = menu.find((product) => product.id === item.menuItemId);
        if (!product || !product.isAvailable) throw new AccessError("บางเมนูไม่มีในร้านหรือหมดแล้ว กรุณาเลือกใหม่", 400);
        return { menuItemId: product.id, menuName: product.name, unitPrice: product.price, quantity: item.quantity as number, specialInstruction: item.specialInstruction?.trim() || null };
      });
      const cents = lines.reduce((sum, line) => sum + Math.round(Number(line.unitPrice) * 100) * line.quantity, 0);
      if (cents > 9999999999) throw new AccessError("ยอดสั่งอาหารสูงเกินกำหนด", 400);
      const [order] = await tx.insert(orders).values({
        storeId: store.id, tableId: table.id, tableNumber, sessionToken, orderNumber: "#" + randomUUID().slice(0, 8).toUpperCase(),
        totalAmount: (cents / 100).toFixed(2), customerNote: body.customerNote?.trim() || null,
      }).returning();
      const saved = await tx.insert(orderItems).values(lines.map((line) => ({ ...line, orderId: order.id }))).returning();
      return { ...order, items: saved };
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError && error.status === 403) return NextResponse.json({ success: false, error: error.message, sessionExpired: true }, { status: 403 });
    return apiError(error);
  }
}
