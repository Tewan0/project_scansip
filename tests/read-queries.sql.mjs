import assert from "node:assert/strict";
import * as orm from "drizzle-orm";
import { drizzle } from "drizzle-orm/pg-proxy";
import { fixture } from "./helpers.mjs";
const schema = fixture("anonymous", { "drizzle-orm": orm }).load("db/schema.ts");
const statements = [];
const quote = value => typeof value === "number" ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
const db = drizzle(async (query, params) => {
  statements.push(query.replace(/\$(\d+)/g, (_, n) => quote(params[Number(n) - 1])));
  return { rows: query.includes("count(*)") ? [[0]] : [] };
}, { schema });
const f = fixture("owner", { "drizzle-orm": orm, "@/db/schema": schema, "@/db": { db },
  "@/lib/auth": { requireStoreAccess: async () => ({ store: { id: "11111111-1111-4111-8111-111111111111" } }), apiError: error => { throw error; } } });
for (const route of ["app/api/reports/route.ts", "app/api/dashboard/stats/route.ts", "app/api/bills/route.ts"]) {
  const response = await f.load(route).GET(new Request("http://localhost/api/test"));
  assert.equal(response.status, 200);
}
console.log(JSON.stringify({ sql: "begin read only;\n" + statements.map(query => "explain " + query + ";").join("\n") + "\nrollback;" }));
