import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { orders, serviceRequests } from "@/db/schema";
import { withCustomerSession, customerError } from "@/lib/customer-session";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const input = { storeSlug: url.searchParams.get("store"), tableNumber: Number(url.searchParams.get("table")),
      sessionToken: req.headers.get("authorization")?.replace(/^Bearer /, "") };
    const data = await withCustomerSession(input, async (tx, table) => {
      const round = and(eq(orders.storeId, table.storeId), eq(orders.tableId, table.id), eq(orders.sessionToken, table.currentSessionToken!));
      const requestRound = and(eq(serviceRequests.storeId, table.storeId), eq(serviceRequests.tableId, table.id), eq(serviceRequests.sessionToken, table.currentSessionToken!));
      const [tickets, pending, resolved] = await Promise.all([
        tx.query.orders.findMany({ where: round, with: { items: true }, orderBy: [desc(orders.createdAt)] }),
        tx.query.serviceRequests.findMany({ where: and(requestRound, eq(serviceRequests.status, "pending")), orderBy: [desc(serviceRequests.createdAt)] }),
        tx.query.serviceRequests.findMany({ where: and(requestRound, eq(serviceRequests.status, "resolved")), orderBy: [desc(serviceRequests.createdAt)], limit: 10 }),
      ]);
      return {
        orders: tickets.map((order) => ({ id: order.id, orderNumber: order.orderNumber, status: order.status,
          paymentStatus: order.paymentStatus, totalAmount: order.totalAmount, customerNote: order.customerNote, createdAt: order.createdAt,
          items: order.items.map(({ id, menuName, quantity, unitPrice, specialInstruction, status }) => ({ id, menuName, quantity, unitPrice, specialInstruction, status })),
        })),
        requests: [...pending, ...resolved].map(({ id, kind, status, createdAt, resolvedAt }) => ({ id, kind, status, createdAt, resolvedAt })),
      };
    });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return customerError(error); }
}
