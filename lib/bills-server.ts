import "server-only";
import { createHash } from "node:crypto";
import type { Bill } from "@/lib/billing";
import { needsServing } from "@/lib/payments";

type OrderRow = {
  id: string; storeId: string; tableNumber: number | null; sessionToken: string | null;
  orderNumber: string; status: string; paymentStatus: string; totalAmount: string;
  cancelledBy?: string | null; cancelledByLabel?: string | null; cancelledAt?: Date | null; cancellationReason?: string | null;
  customerNote: string | null; createdAt: Date; servingRequired?: boolean; deliveredAt?: Date | null;
};
type TableRow = { storeId: string; tableNumber: number; currentSessionToken: string | null; status: string; sessionStartedAt: Date | null };

// Use a one-way display identifier, never expose the customer's QR credential.
// Legacy orders with no round token stay separate instead of guessing a round.
export function billIdentity(order: Pick<OrderRow, "id" | "storeId" | "tableNumber" | "sessionToken">) {
  const id = createHash("sha256").update(JSON.stringify([order.storeId, order.tableNumber, order.sessionToken || `legacy:${order.id}`])).digest("hex");
  return { id, number: `B${String(order.tableNumber ?? 0).padStart(2, "0")}-${id.slice(0, 10).toUpperCase()}` };
}

export function buildBills(rows: OrderRow[], tables: TableRow[]): Bill[] {
  const groups = new Map<string, Bill>();
  for (const table of tables) {
    if (table.status !== "occupied" || !table.currentSessionToken) continue;
    const identity = billIdentity({ id: "", storeId: table.storeId, tableNumber: table.tableNumber, sessionToken: table.currentSessionToken });
    groups.set(identity.id, { ...identity, tableNumber: table.tableNumber, current: true,
      openedAt: table.sessionStartedAt?.toISOString() ?? null, firstOrderedAt: null, lastOrderedAt: null,
      totalCents: 0, paidCents: 0, unpaidCents: 0, refundedCents: 0, unfinishedCount: 0, unservedCount: 0, unpaidOrderIds: [], anchorOrderId: null, orders: [], payments: [] });
  }
  const ordered = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  for (const order of ordered) {
    const identity = billIdentity(order);
    let bill = groups.get(identity.id);
    if (!bill) {
      bill = { ...identity, tableNumber: order.tableNumber, current: false, openedAt: null, firstOrderedAt: null, lastOrderedAt: null,
        totalCents: 0, paidCents: 0, unpaidCents: 0, refundedCents: 0, unfinishedCount: 0, unservedCount: 0, unpaidOrderIds: [], anchorOrderId: null, orders: [], payments: [] };
      groups.set(identity.id, bill);
    }
    bill.anchorOrderId ??= order.id;
    bill.firstOrderedAt ??= order.createdAt.toISOString(); bill.lastOrderedAt = order.createdAt.toISOString();
    bill.orders.push({ id: order.id, orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus,
      cancelledBy: order.cancelledBy ?? null, cancelledByLabel: order.cancelledByLabel ?? null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null, cancellationReason: order.cancellationReason ?? null,
      totalAmount: order.totalAmount, customerNote: order.customerNote, createdAt: order.createdAt.toISOString(),
      servingRequired: order.servingRequired === true, deliveredAt: order.deliveredAt?.toISOString() ?? null, items: [] });
    if (order.status === "cancelled") continue;
    const cents = Math.round(Number(order.totalAmount) * 100);
    bill.totalCents += cents;
    if (order.paymentStatus === "paid") bill.paidCents += cents;
    if (order.paymentStatus === "refunded") bill.refundedCents += cents;
    if (order.paymentStatus === "unpaid") { bill.unpaidCents += cents; bill.unpaidOrderIds.push(order.id); }
    if (["pending", "preparing"].includes(order.status)) bill.unfinishedCount++;
    if (needsServing(order)) bill.unservedCount++;
  }
  return [...groups.values()].sort((a, b) => (b.openedAt || b.firstOrderedAt || "").localeCompare(a.openedAt || a.firstOrderedAt || "") || a.id.localeCompare(b.id));
}

export function buildBillIndex(rows: Pick<OrderRow, "id" | "storeId" | "tableNumber" | "sessionToken" | "createdAt">[], tables: TableRow[]) {
  const groups = new Map<string, { id: string; current: boolean; tableNumber: number | null; openedAt: string | null; firstOrderedAt: string | null; orderIds: string[] }>();
  for (const table of tables) {
    if (table.status !== "occupied" || !table.currentSessionToken) continue;
    const { id } = billIdentity({ id: "", storeId: table.storeId, tableNumber: table.tableNumber, sessionToken: table.currentSessionToken });
    groups.set(id, { id, current: true, tableNumber: table.tableNumber, openedAt: table.sessionStartedAt?.toISOString() ?? null, firstOrderedAt: null, orderIds: [] });
  }
  for (const row of rows) {
    const { id } = billIdentity(row);
    const group = groups.get(id) ?? { id, current: false, tableNumber: row.tableNumber, openedAt: null, firstOrderedAt: null, orderIds: [] };
    const date = row.createdAt.toISOString();
    if (!group.firstOrderedAt || date < group.firstOrderedAt) group.firstOrderedAt = date;
    group.orderIds.push(row.id);
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => (b.openedAt || b.firstOrderedAt || "").localeCompare(a.openedAt || a.firstOrderedAt || "") || a.id.localeCompare(b.id));
}
