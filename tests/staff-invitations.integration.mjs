// Explicit opt-in: node --env-file=.env.local tests/staff-invitations.integration.mjs
// Uses transaction-local temporary copies; never writes public application tables.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as orm from "drizzle-orm";
import { fixture, request } from "./helpers.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for this explicit integration check");
const client = postgres(process.env.DATABASE_URL, { max: 2, prepare: false, connect_timeout: 10 });
const schema = fixture("anonymous", { "drizzle-orm": orm }).load("db/schema.ts");
const database = drizzle(client, { schema });
const rollback = new Error("rollback temporary test data");
try {
  try {
    await database.transaction(async tx => {
      await tx.execute(orm.sql`create temp table stores (like public.stores including defaults) on commit drop`);
      await tx.execute(orm.sql`create temp table staff (like public.staff including defaults) on commit drop`);
      const scope = await tx.execute(orm.sql`select n.nspname from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.oid in ('stores'::regclass, 'staff'::regclass)`);
      assert.equal(scope.length, 2);
      assert.ok(scope.every(row => row.nspname.startsWith("pg_temp_")), "Temporary tables must shadow public tables before writes");
      const user = { id: randomUUID(), email: "security-check@example.invalid", email_confirmed_at: new Date().toISOString() };
      const shopA = randomUUID(), shopB = randomUUID(), inviteA = randomUUID(), inviteB = randomUUID();
      await tx.insert(schema.stores).values([
        { id: shopA, ownerId: randomUUID(), name: "Temporary A", slug: "temporary-a" },
        { id: shopB, ownerId: randomUUID(), name: "Temporary B", slug: "temporary-b" },
      ]);
      await tx.insert(schema.staff).values([
        { id: inviteA, storeId: shopA, userId: null, name: "Temporary user", email: " SECURITY-CHECK@example.invalid ", role: "cashier" },
        { id: inviteB, storeId: shopB, userId: null, name: "Temporary user", email: user.email, role: "kitchen" },
      ]);
      const f = fixture("new-user", { "@/db": { db: tx }, "@/db/schema": schema, "drizzle-orm": orm });
      f.context.user = user;
      const auth = f.load("lib/auth.ts"), service = f.load("lib/staff-invitations.ts");
      const route = f.load("app/api/staff/invitations/route.ts");
      assert.equal(await auth.getAccessForUser(user), null);
      assert.equal((await service.listStaffInvitations(user)).length, 2);
      assert.equal((await route.POST(request({ invitationId: inviteA, storeId: shopA, role: "cashier" }))).status, 200);
      assert.equal((await auth.getAccessForUser(user)).store.id, shopA);
      assert.equal((await route.POST(request({ invitationId: inviteB, storeId: shopB, role: "kitchen" }))).status, 409);
      assert.equal((await auth.getAccessForUser(user)).store.id, shopA);
      assert.equal((await route.DELETE(request({ invitationId: inviteA }))).status, 404);
      await tx.delete(schema.staff).where(orm.eq(schema.staff.id, inviteA));
      assert.equal(await auth.getAccessForUser(user), null);
      assert.equal((await route.DELETE(request({ invitationId: inviteB }))).status, 200);
      assert.equal((await service.listStaffInvitations(user)).length, 0);
      console.log("PASS: invitation routes and membership queries with real PostgreSQL temporary tables");
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }

  const lockAccount = fixture("anonymous", { "drizzle-orm": orm }).load("lib/account-lock.ts").lockAccount;
  const accountId = randomUUID();
  let secondTransaction, acquired = false, secondStarted;
  const started = new Promise(resolve => { secondStarted = resolve; });
  await database.transaction(async first => {
    await lockAccount(first, accountId);
    secondTransaction = database.transaction(async second => {
      await second.execute(orm.sql`set local lock_timeout = '5s'`);
      secondStarted();
      await lockAccount(second, accountId);
      acquired = true;
    });
    await Promise.race([started, secondTransaction]);
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(acquired, false);
  });
  await secondTransaction;
  assert.equal(acquired, true);
  console.log("PASS: account transaction lock serializes independent PostgreSQL connections");
} catch (error) {
  // Do not print connection credentials or query parameters from driver errors.
  console.error("Integration check failed:", error.name, error instanceof assert.AssertionError ? error.message : error.code ?? "see local test setup");
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
