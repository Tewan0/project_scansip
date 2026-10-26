import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, stores, tables, serviceRequests } from "@/db/schema";
import { and, asc, eq, gt, inArray, isNull, ne, or } from "drizzle-orm";
import { needsServing } from "@/lib/payments";
import { requireStoreAccess, apiError } from "@/lib/auth";
import { isValidTableCount, MAX_TABLE_COUNT } from "@/lib/table-settings";
import { randomBytes } from "node:crypto";
import { CUSTOMER_QR_LIFETIME_MS, customerQrToken } from "@/lib/customer-qr";

class TableError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function assertUniqueTables(data: { tableNumber: number }[]) {
  const seen = new Set<number>();
  for (const table of data) {
    if (seen.has(table.tableNumber)) {
      throw new TableError(`พบข้อมูลโต๊ะ ${table.tableNumber} ซ้ำ กรุณาให้ผู้ดูแลแก้ข้อมูลก่อนเปิดหรือปิดโต๊ะ`, 409);
    }
    seen.add(table.tableNumber);
  }
}

async function getTableAccess() {
  const { store, role } = await requireStoreAccess(["owner", "cashier"]);
  return { store, canManageTables: role === "owner" };
}

function errorResponse(error: unknown) {
  if (error instanceof TableError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  return apiError(error);
}

export async function GET() {
  try {
    const { store, canManageTables } = await getTableAccess();
    const data = await db.select().from(tables)
      .where(eq(tables.storeId, store.id)).orderBy(asc(tables.tableNumber));
    assertUniqueTables(data);
    return NextResponse.json({
      success: true, data, canManageTables,
      store: { id: store.id, name: store.name, slug: store.slug },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { store, canManageTables } = await getTableAccess();
    let body;
    try { body = await req.json(); } catch { throw new TableError("ข้อมูลคำขอไม่ถูกต้อง", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new TableError("ข้อมูลคำขอไม่ถูกต้อง", 400);
    }
    const { action, tableNumber, count, storeSlug } = body;
    if (storeSlug && storeSlug !== store.slug) throw new TableError("คุณไม่มีสิทธิ์จัดการโต๊ะของร้านนี้", 403);
    if (!["sync_tables", "open_session", "close_session", "renew_qr"].includes(action)) {
      throw new TableError("ไม่พบคำสั่งที่ต้องการ", 400);
    }
    if (action === "sync_tables") {
      if (!canManageTables) throw new TableError("เฉพาะเจ้าของร้านเท่านั้นที่ปรับจำนวนโต๊ะได้", 403);
      if (!isValidTableCount(count)) {
        throw new TableError(`กรุณาระบุจำนวนโต๊ะเป็นจำนวนเต็มตั้งแต่ 1–${MAX_TABLE_COUNT}`, 400);
      }
    } else if (!isValidTableCount(tableNumber)) {
      throw new TableError("หมายเลขโต๊ะไม่ถูกต้อง", 400);
    }

    const data = await db.transaction(async (tx) => {
      // Serialize resize/open/close for this store, including an empty floor plan.
      await tx.select({ id: stores.id }).from(stores)
        .where(eq(stores.id, store.id)).for("update");
      const currentTables = await tx.select().from(tables)
        .where(eq(tables.storeId, store.id)).orderBy(asc(tables.tableNumber)).for("update");
      assertUniqueTables(currentTables);

      if (action === "sync_tables") {
        const removing = currentTables.filter((table) => table.tableNumber > count);
        const busy = removing.filter((table) => table.status !== "available" || table.currentSessionToken);
        if (busy.length) {
          throw new TableError(`ลดจำนวนโต๊ะไม่ได้: โต๊ะ ${busy.map((t) => t.tableNumber).join(", ")} ยังใช้งานหรือจองอยู่`, 409);
        }
        const outstandingOrders = removing.length ? await tx.select({ tableNumber: orders.tableNumber, tableId: orders.tableId }).from(orders)
          .where(and(
            eq(orders.storeId, store.id),
            or(inArray(orders.tableNumber, removing.map((table) => table.tableNumber)), inArray(orders.tableId, removing.map((table) => table.id))),
            ne(orders.status, "cancelled"),
            or(eq(orders.paymentStatus, "unpaid"), inArray(orders.status, ["pending", "preparing"]), and(eq(orders.servingRequired, true), isNull(orders.deliveredAt))),
          )) : [];
        if (outstandingOrders.length) {
          const numbers = [...new Set(outstandingOrders.map((o) => o.tableNumber ?? removing.find((table) => table.id === o.tableId)?.tableNumber ?? null))]
            .sort((a, b) => (a ?? 0) - (b ?? 0));
          throw new TableError(`ลดจำนวนโต๊ะไม่ได้: โต๊ะ ${numbers.join(", ")} ยังมีออเดอร์หรือยอดค้างชำระ`, 409);
        }
        if (removing.length) {
          // Historical orders retain their table-number snapshot (FK SET NULL).
          await tx.delete(tables).where(and(eq(tables.storeId, store.id), gt(tables.tableNumber, count)));
        }
        const existingNumbers = new Set(currentTables.map((t) => t.tableNumber));
        const adding = Array.from({ length: count }, (_, i) => i + 1)
          .filter((number) => !existingNumbers.has(number))
          .map((number) => ({ storeId: store.id, tableNumber: number, status: "available" as const }));
        if (adding.length) await tx.insert(tables).values(adding);
        return tx.select().from(tables).where(eq(tables.storeId, store.id)).orderBy(asc(tables.tableNumber));
      }

      const table = currentTables.find((item) => item.tableNumber === tableNumber);
      if (!table) throw new TableError("ไม่พบโต๊ะนี้ กรุณาโหลดผังโต๊ะใหม่", 404);
      if (action === "renew_qr") {
        if (table.status !== "occupied" || !table.currentSessionToken) throw new TableError("ต้องเปิดโต๊ะก่อนออก QR ใหม่", 409);
        // Reject stale screens/repeated requests instead of invalidating a QR just issued.
        if (typeof body.expectedQrToken !== "string" || body.expectedQrToken !== customerQrToken(table)) {
          throw new TableError("QR ของโต๊ะเปลี่ยนแล้ว กรุณาโหลดผังโต๊ะใหม่", 409);
        }
        const [renewed] = await tx.update(tables).set({
          currentQrToken: "qr_" + randomBytes(32).toString("hex"),
          qrExpiresAt: new Date(Date.now() + CUSTOMER_QR_LIFETIME_MS),
        }).where(eq(tables.id, table.id)).returning();
        return renewed;
      }
      if (action === "open_session") {
        // Repeated clicks must not replace the QR of an existing session.
        if (table.status === "occupied" && table.currentSessionToken) return table;
        const [opened] = await tx.update(tables).set({
          status: "occupied", currentSessionToken: "tk_" + randomBytes(16).toString("hex"),
          sessionStartedAt: new Date(),
          currentQrToken: "qr_" + randomBytes(32).toString("hex"),
          qrExpiresAt: new Date(Date.now() + CUSTOMER_QR_LIFETIME_MS),
        }).where(eq(tables.id, table.id)).returning();
        return opened;
      }
      // Match the round shown when closing was requested, after locking the table.
      if (!table.currentSessionToken || typeof body.expectedSessionToken !== "string"
        || body.expectedSessionToken !== table.currentSessionToken) {
        throw new TableError("รอบโต๊ะนี้เปลี่ยนไปแล้ว กรุณาตรวจสอบข้อมูลล่าสุดก่อนปิดโต๊ะอีกครั้ง", 409);
      }
      const outstanding = await tx.select({ id: orders.id, status: orders.status, paymentStatus: orders.paymentStatus, totalAmount: orders.totalAmount, servingRequired: orders.servingRequired, deliveredAt: orders.deliveredAt }).from(orders).where(and(
        eq(orders.storeId, store.id), eq(orders.sessionToken, table.currentSessionToken ?? ""),
        ne(orders.status, "cancelled"),
        or(eq(orders.paymentStatus, "unpaid"), inArray(orders.status, ["pending", "preparing"]), and(eq(orders.servingRequired, true), isNull(orders.deliveredAt))),
      ));
      if (outstanding.length) {
        const unpaid = outstanding.filter((order) => order.paymentStatus === "unpaid");
        const unfinished = outstanding.filter((order) => ["pending", "preparing"].includes(order.status));
        const unserved = outstanding.filter((order) => order.status === "served" && needsServing(order));
        const amount = unpaid.reduce((sum, order) => sum + Math.round(Number(order.totalAmount) * 100), 0) / 100;
        const reasons = [unpaid.length ? `ยังไม่ได้บันทึกรับเงิน ${unpaid.length} ออเดอร์ รวม ฿${amount.toFixed(2)} กรุณาไปที่ “ตรวจออเดอร์ / รับเงิน”` : "",
          unfinished.length ? `มีอาหารที่ยังทำไม่เสร็จ ${unfinished.length} ออเดอร์ กรุณาให้ครัวอัปเดตสถานะ` : "",
          unserved.length ? `ยังไม่ยืนยันเสิร์ฟ ${unserved.length} ออเดอร์ กรุณากด “เสิร์ฟแล้ว” ในหน้าบิล` : ""].filter(Boolean);
        throw new TableError(`ยังปิดโต๊ะ ${tableNumber} ไม่ได้: ${reasons.join(" · ")}`, 409);
      }
      await tx.update(serviceRequests).set({ status: "resolved", resolvedAt: new Date() }).where(and(
        eq(serviceRequests.storeId, store.id), eq(serviceRequests.tableId, table.id),
        eq(serviceRequests.sessionToken, table.currentSessionToken ?? ""), eq(serviceRequests.status, "pending"),
      ));
      const [closed] = await tx.update(tables).set({
        status: "available", currentSessionToken: null, sessionStartedAt: null, currentQrToken: null, qrExpiresAt: null,
      }).where(eq(tables.id, table.id)).returning();
      return closed;
    });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
