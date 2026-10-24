// Generate a rollback-only PostgreSQL smoke check from the actual quota helper
// and Drizzle SQL. No credentials or application writes are involved.
// node tests/write-rate-limit.sql.mjs
import assert from "node:assert/strict";
import * as orm from "drizzle-orm";
import { drizzle } from "drizzle-orm/pg-proxy";
import { fixture } from "./helpers.mjs";

const schema = fixture("anonymous", { "drizzle-orm": orm }).load("db/schema.ts");
const rows = new Map(), statements = [];
const quote = value => typeof value === "number" ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
const database = drizzle(async (query, params) => {
  statements.push(query.replace(/\$(\d+)/g, (_, index) => quote(params[Number(index) - 1])) + ";");
  if (query.startsWith('select "id"')) return { rows: rows.has(params[0]) ? [rows.get(params[0])] : [] };
  if (query.startsWith('insert into "chat_rate_limits"')) rows.set(params[0], [...params]);
  else if (query.startsWith('update "chat_rate_limits"')) rows.set(params[3], [params[3], params[0], params[1], params[2]]);
  else if (!query.includes("pg_advisory_xact_lock") && !query.startsWith('select "id"')) throw new Error("Unexpected query shape");
  return { rows: [] };
}, { schema });
let now = 1_800_000_000_000;
class Clock extends Date { static now() { return now; } }
const f = fixture("anonymous", { "drizzle-orm": orm, "@/db/schema": schema, "@/db": { db: database } }, { Date: Clock });
const { consumeWriteQuota } = f.load("lib/write-rate-limit.ts");
const limits = [{ windowMs: 60_000, max: 2 }, { windowMs: 86_400_000, max: 3 }];
const consume = () => consumeWriteQuota(database, "sql-check", limits);
await consume(); await consume();
await assert.rejects(consume, error => error.status === 429 && error.retryAfter === 60);
now += 60_000;
await consume();
await assert.rejects(consume, error => error.status === 429 && error.retryAfter === 86_340);
assert.equal(rows.get("write:sql-check:60000")[2], 1);
assert.equal(rows.get("write:sql-check:86400000")[2], 3);
const sql = [
  "begin;",
  "create temp table chat_rate_limits (like public.chat_rate_limits including all) on commit drop;",
  "do $$ begin if (select n.nspname not like 'pg_temp_%' from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid='chat_rate_limits'::regclass) then raise exception 'Test must only write temporary counters'; end if; end $$;",
  ...statements,
  "do $$ begin if (select count(*) from pg_temp.chat_rate_limits) <> 2 or (select count from pg_temp.chat_rate_limits where id='write:sql-check:60000') <> 1 or (select count from pg_temp.chat_rate_limits where id='write:sql-check:86400000') <> 3 then raise exception 'Quota SQL result mismatch'; end if; end $$;",
  "select 'PASS: actual Drizzle quota SQL, counter increments and rollover in temporary tables' as verification;",
  "rollback;",
].join("\n");
console.log(JSON.stringify({ sql }));
