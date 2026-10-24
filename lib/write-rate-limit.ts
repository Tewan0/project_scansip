import "server-only";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chatRateLimits } from "@/db/schema";
import { AccessError, apiError } from "@/lib/auth";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Limit = { windowMs: number; max: number };
export const ORDER_LIMITS: readonly Limit[] = [{ windowMs: 60_000, max: 6 }, { windowMs: 3_600_000, max: 60 }];
export const OWNER_UPLOAD_LIMITS: readonly Limit[] = [{ windowMs: 60_000, max: 10 }, { windowMs: 86_400_000, max: 100 }];
export const ONBOARDING_UPLOAD_LIMITS: readonly Limit[] = [{ windowMs: 60_000, max: 3 }, { windowMs: 86_400_000, max: 10 }];

export class WriteRateLimitError extends AccessError {
  constructor(public retryAfter: number) {
    super("ทำรายการถี่เกินไป กรุณารอ " + retryAfter + " วินาทีแล้วลองใหม่", 429);
  }
}

// Reuse the existing private counter table with an isolated namespace.
// Stable keys bound storage to two rows per account/table, even across QR rotations.
export async function consumeWriteQuota(tx: Transaction, scope: string, limits: readonly Limit[]) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"scansip:write-quota:" + scope}, 0))`);
  const now = Date.now();
  const updates = [];
  let retryAfter = 0;
  for (const limit of limits) {
    const id = "write:" + scope + ":" + limit.windowMs;
    const [previous] = await tx.select().from(chatRateLimits).where(eq(chatRateLimits.id, id)).for("update");
    const startedAt = Number(previous?.windowKey);
    const sameWindow = previous && Number.isFinite(startedAt) && now < startedAt + limit.windowMs;
    if (sameWindow && previous.count >= limit.max) {
      retryAfter = Math.max(retryAfter, Math.ceil((startedAt + limit.windowMs - now) / 1000));
    }
    updates.push({ id, previous, values: {
      windowKey: sameWindow ? previous.windowKey : String(now),
      count: sameWindow ? previous.count + 1 : 1, lastUsedAt: new Date(now),
    } });
  }
  if (retryAfter) throw new WriteRateLimitError(retryAfter);
  for (const { id, previous, values } of updates) {
    if (previous) await tx.update(chatRateLimits).set(values).where(eq(chatRateLimits.id, id));
    else await tx.insert(chatRateLimits).values({ id, ...values });
  }
}

export function writeErrorResponse(error: unknown) {
  if (!(error instanceof WriteRateLimitError)) return apiError(error);
  return NextResponse.json({ success: false, error: error.message, retryAfter: error.retryAfter }, {
    status: 429, headers: { "Retry-After": String(error.retryAfter), "Cache-Control": "private, no-store" },
  });
}
