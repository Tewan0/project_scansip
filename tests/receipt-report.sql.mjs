// Generate a rollback-only check of the actual report query using temporary rows.
// node tests/receipt-report.sql.mjs
import assert from "node:assert/strict";
import * as orm from "drizzle-orm";
import { drizzle } from "drizzle-orm/pg-proxy";
import { fixture } from "./helpers.mjs";

const schema = fixture("anonymous", { "drizzle-orm": orm }).load("db/schema.ts");
const statements = [];
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const database = drizzle(async (query, params) => {
  statements.push(query.replace(/\$(\d+)/g, (_, index) => quote(params[Number(index) - 1])));
  return { rows: [] };
}, { schema });
const store = "11111111-1111-4111-8111-111111111111";
class Clock extends Date { static now() { return Date.parse("2026-01-01T17:30:00Z"); } }
const f = fixture("owner", {
  "drizzle-orm": orm, "@/db/schema": schema,
  "@/db": { db: { query: { orders: { findMany: async () => [] }, billPayments: database.query.billPayments } } },
  "@/lib/auth": { requireStoreAccess: async () => ({ store: { id: store } }), apiError: error => { throw error; } },
}, { Date: Clock });
const response = await f.load("app/api/reports/route.ts").GET(new Request("http://localhost/api/reports?range=7d"));
assert.equal(response.status, 200);
assert.equal(statements.length, 1);
const query = statements[0];
assert.match(query, />=/);
assert.match(query, / < /);
assert.equal(query.includes('"received_by"'), false);
const sql = [
  "begin;",
  "create temp table bill_payments (like public.bill_payments including all) on commit drop;",
  "do $$ begin if (select n.nspname not like 'pg_temp_%' from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid='bill_payments'::regclass) then raise exception 'Test must only write temporary receipts'; end if; end $$;",
  "insert into pg_temp.bill_payments (store_id, bill_id, method, amount_cents, received_cents, change_cents, received_by, created_at) values",
  "('" + store + "', 'sql-check', 'cash', 100, 500, 400, '" + store + "', '2025-12-26T17:00:00Z'),",
  "('" + store + "', 'sql-check', 'cash', 999, 999, 0, '" + store + "', '2025-12-26T16:59:59.999999Z'),",
  "('" + store + "', 'sql-check', 'transfer', 200, 200, 0, '" + store + "', '2026-01-02T16:59:59.999999Z'),",
  "('" + store + "', 'sql-check', 'cash', 999, 999, 0, '" + store + "', '2026-01-02T17:00:00Z'),",
  "('22222222-2222-4222-8222-222222222222', 'sql-check', 'cash', 999, 999, 0, '" + store + "', '2026-01-01T17:00:00Z');",
  "create temp table receipt_report_check on commit drop as " + query + ";",
  "do $$ begin if (select count(*) from pg_temp.receipt_report_check) <> 2 or (select sum(amount_cents) from pg_temp.receipt_report_check) <> 300 then raise exception 'Receipt date/store filtering mismatch'; end if; end $$;",
  "select 'PASS: actual report SQL, Bangkok range boundaries including microseconds, store isolation, receipt amounts' as verification;",
  "rollback;",
].join("\n");
console.log(JSON.stringify({ sql }));
