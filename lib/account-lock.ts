import "server-only";
import { sql } from "drizzle-orm";
import type { db } from "@/db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// All account membership grants use this lock, including owner onboarding.
export async function lockAccount(tx: Transaction, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"scansip:account:" + userId}, 0))`);
}
