import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceRequests } from "@/db/schema";
import { requireStoreAccess, apiError } from "@/lib/auth";

export async function GET() {
  try {
    const { store } = await requireStoreAccess(["owner", "cashier"]);
    const requests = await db.query.serviceRequests.findMany({ where: and(eq(serviceRequests.storeId, store.id), eq(serviceRequests.status, "pending")), orderBy: [asc(serviceRequests.createdAt)] });
    return NextResponse.json({ success: true, data: requests.map(({ id, kind, tableNumber, createdAt }) => ({ id, kind, tableNumber, createdAt })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
