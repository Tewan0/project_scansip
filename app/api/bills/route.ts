import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, tables, billPayments } from "@/db/schema";
import { requireStoreAccess, AccessError, apiError } from "@/lib/auth";
import { buildBills, buildBillIndex } from "@/lib/bills-server";

export async function GET(req: Request) {
  try {
    const { store } = await requireStoreAccess(["owner", "cashier"]);
    const search = new URL(req.url).searchParams;
    const view = search.get("view") || "current", table = search.get("table"), date = search.get("date");
    const page = Number(search.get("page") || 1);
    if (!["current", "history"].includes(view) || !Number.isInteger(page) || page < 1 || page > 100000 ||
      (table && (!/^\d+$/.test(table) || Number(table) < 1 || Number(table) > 50)) ||
      (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))))) throw new AccessError("ตัวกรองบิลไม่ถูกต้อง", 400);
    // Read complete round metadata before pagination; never truncate a bill's totals
    // at an arbitrary order limit. Only fetch item details for the displayed bills.
    const [tickets, floor] = await Promise.all([
      db.query.orders.findMany({ columns: { id: true, storeId: true, tableNumber: true, sessionToken: true, createdAt: true }, where: and(eq(orders.storeId, store.id), table ? eq(orders.tableNumber, Number(table)) : undefined) }),
      db.query.tables.findMany({ where: eq(tables.storeId, store.id) }),
    ]);
    const bills = buildBillIndex(tickets, floor).filter((bill) => {
      if (table && bill.tableNumber !== Number(table)) return false;
      const timestamp = bill.openedAt || bill.firstOrderedAt;
      return !date || (timestamp && new Date(timestamp).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) === date);
    });
    const currentCount = bills.filter((bill) => bill.current).length;
    const historyCount = bills.length - currentCount;
    const filtered = bills.filter((bill) => bill.current === (view === "current"));
    const pageCount = Math.max(1, Math.ceil(filtered.length / 20)), currentPage = Math.min(page, pageCount);
    const selected = filtered.slice((currentPage - 1) * 20, currentPage * 20);
    const ids = selected.flatMap(bill => bill.orderIds);
    const detailed = ids.length ? await db.query.orders.findMany({
      where: and(eq(orders.storeId, store.id), inArray(orders.id, ids)),
    }) : [];
    const selectedIds = new Set(selected.map(bill => bill.id));
    const data = buildBills(detailed, floor).filter(bill => selectedIds.has(bill.id));
    const payments = data.length ? await db.query.billPayments.findMany({ where: and(eq(billPayments.storeId, store.id), inArray(billPayments.billId, data.map((bill) => bill.id))) }) : [];
    for (const bill of data) bill.payments = payments.filter((payment) => payment.billId === bill.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(({ id, method, amountCents, receivedCents, changeCents, createdAt }) => ({ id, method, amountCents, receivedCents, changeCents, createdAt: createdAt.toISOString() }));
    const items = ids.length ? await db.query.orderItems.findMany({ where: inArray(orderItems.orderId, ids) }) : [];
    for (const bill of data) for (const order of bill.orders) order.items = items.filter((item) => item.orderId === order.id).map(({ id, menuName, quantity, unitPrice, specialInstruction, status }) => ({ id, menuName, quantity, unitPrice, specialInstruction, status }));
    return NextResponse.json({ success: true, data, currentCount, historyCount, page: currentPage, pageCount }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
