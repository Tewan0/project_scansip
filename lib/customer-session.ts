import "server-only";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { stores, tables } from "@/db/schema";
import { AccessError, apiError } from "@/lib/auth";
import { getStoreById, getStoreBySlugOrId } from "@/utils/store";
import { customerQrProblem, QR_PROBLEM_MESSAGES } from "@/lib/customer-qr";

export function assertCustomerQr(table: typeof tables.$inferSelect | undefined, token: unknown): asserts table is typeof tables.$inferSelect {
  const problem = customerQrProblem(table, token);
  if (problem) throw new AccessError(QR_PROBLEM_MESSAGES[problem], 403);
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SessionFields = { tableNumber: unknown; sessionToken: unknown };
type SessionInput = SessionFields & { storeSlug: unknown };
type SessionWork<T> = (tx: Transaction, table: typeof tables.$inferSelect) => Promise<T>;

export async function withCustomerSession<T>(input: SessionInput,
  work: SessionWork<T>, write = false) {
  return withStoreSession({ ...input, identifier: input.storeSlug }, work, write, getStoreBySlugOrId);
}

// Use only the ID column when the caller already has an internal store ID.
export async function withCustomerSessionByStoreId<T>(input: SessionFields & { storeId: unknown },
  work: SessionWork<T>, write = false) {
  return withStoreSession({ ...input, identifier: input.storeId }, work, write, getStoreById);
}

async function withStoreSession<T>(input: SessionFields & { identifier: unknown }, work: SessionWork<T>,
  write: boolean, findStore: typeof getStoreById) {
  const { identifier, tableNumber, sessionToken } = input;
  if (typeof identifier !== "string" || !identifier || identifier.length > 200 ||
    typeof tableNumber !== "number" || !Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 50 ||
    typeof sessionToken !== "string" || !sessionToken || sessionToken.length > 200) {
    throw new AccessError("กรุณาสแกน QR ของโต๊ะที่กำลังใช้งาน", 403);
  }
  const store = await findStore(identifier);
  if (!store) throw new AccessError("ไม่พบร้านค้า", 404);
  return db.transaction(async (tx) => {
    // Writes use the same lock order as table close/open and order creation.
    if (write) await tx.select({ id: stores.id }).from(stores).where(eq(stores.id, store.id)).for("update");
    const [table] = await tx.select().from(tables).where(and(eq(tables.storeId, store.id), eq(tables.tableNumber, tableNumber))).for(write ? "update" : "share");
    assertCustomerQr(table, sessionToken);
    return work(tx, table);
  });
}

export function customerError(error: unknown) {
  const response = error instanceof AccessError && error.status === 403
    ? NextResponse.json({ success: false, error: error.message, sessionExpired: true }, { status: 403 })
    : apiError(error);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
