import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");

export function fixture(role = "owner", overrides = {}, globals = {}) {
  const tableNames = ["stores", "staff", "tables", "orders", "orderItems", "menuItems", "categories", "serviceRequests"];
  const schema = Object.fromEntries(tableNames.map((name) => [name, Object.fromEntries([
    ...["id", "storeId", "ownerId", "userId", "email", "role", "orderId", "tableId", "tableNumber", "sessionToken", "currentSessionToken", "status", "kind", "paymentStatus", "totalAmount", "createdAt", "slug"].map((key) => [key, { key }]), ["tableName", name],
  ])]));
  const state = { stores: [{ id: "shop-a", ownerId: "owner", slug: "cafe-a" }, { id: "shop-b", ownerId: "owner-b", slug: "cafe-b" }],
    staff: ["cashier", "kitchen"].includes(role) ? [{ id: "member-a", storeId: "shop-a", role, userId: null, email: "staff@example.com" }] : [],
    tables: [], orders: [], orderItems: [], menuItems: [], categories: [], serviceRequests: [],
  };
  const context = { user: role === "anonymous" ? null : { id: role, email: "STAFF@example.com", email_confirmed_at: "2026-01-01", is_anonymous: false }, state, writes: [] };
  const orm = {
    eq: (column, value) => row => row[column.key] === value,
    ne: (column, value) => row => row[column.key] !== value,
    isNull: column => row => row[column.key] == null,
    gt: (column, value) => row => row[column.key] > value,
    gte: (column, value) => row => row[column.key] >= value,
    inArray: (column, values) => row => values.includes(row[column.key]),
    and: (...predicates) => row => predicates.filter(Boolean).every(fn => fn(row)),
    or: (...predicates) => row => predicates.filter(Boolean).some(fn => fn(row)),
    asc: c => c, desc: c => c,
    sql: (_strings, column, value) => row => row[column.key]?.trim().toLowerCase() === value,
  };
  let nextId = 1;
  function database(data) {
    function rows(name, predicate = () => true, withItems = false) {
      return data[name].filter(predicate).map(row => structuredClone(withItems ? { ...row, items: data.orderItems.filter(item => item.orderId === row.id) } : row));
    }
    return {
      query: Object.fromEntries(tableNames.map(name => [name, {
        findFirst: async ({ where, with: related } = {}) => rows(name, where, related?.items)[0],
        findMany: async ({ where, limit, with: related } = {}) => rows(name, where, related?.items).slice(0, limit ?? Infinity),
      }])),
      select(fields) {
        let name, predicate, limit = Infinity;
        const q = { from: table => { name = table.tableName; return q; }, where: p => { predicate = p; return q; },
          for: () => q, orderBy: () => q, limit: n => { limit = n; return q; },
          then: (resolve, reject) => Promise.resolve(rows(name, predicate).slice(0, limit).map(row => fields ? Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column.key]])) : row)).then(resolve, reject) };
        return q;
      },
      update(table) { return { set: values => ({ where: predicate => {
        const execute = () => {
          context.writes.push(["update", table.tableName]);
          const targets = data[table.tableName].filter(predicate); targets.forEach(row => Object.assign(row, values)); return structuredClone(targets);
        };
        return { returning: async () => execute(), then: (resolve, reject) => Promise.resolve(execute()).then(resolve, reject) };
      } }) }; },
      insert(table) { return { values: values => {
        const execute = () => {
          context.writes.push(["insert", table.tableName]);
          const saved = (Array.isArray(values) ? values : [values]).map(row => ({ id: "new-" + nextId++, ...(table.tableName === "serviceRequests" ? { status: "pending", createdAt: new Date(), resolvedAt: null } : {}), ...(table.tableName === "orderItems" ? { status: "pending" } : {}), ...(table.tableName === "orders" ? { status: "pending", paymentStatus: "unpaid" } : {}), ...row }));
          data[table.tableName].push(...saved); return structuredClone(saved);
        };
        return { returning: async () => execute(), then: (resolve, reject) => Promise.resolve(execute()).then(resolve, reject) };
      } }; },
      delete(table) { return { where: predicate => {
        const execute = () => { context.writes.push(["delete", table.tableName]); const targets = rows(table.tableName, predicate); data[table.tableName] = data[table.tableName].filter(row => !predicate(row)); return targets; };
        return { returning: async () => execute(), then: (resolve, reject) => Promise.resolve(execute()).then(resolve, reject) };
      } }; },
      async transaction(fn) { const draft = structuredClone(data); const result = await fn(database(draft)); Object.assign(data, draft); return result; },
    };
  }
  const db = database(state), cache = new Map();
  const dependencies = {
    "server-only": {}, "@/db": { db }, "@/db/schema": schema, "drizzle-orm": orm,
    "next/cache": { revalidatePath() {} },
    "@/utils/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: context.user }, error: null }) } }) },
    "@/utils/supabase/admin": { createAdminClient() { throw new Error("Unexpected storage access in permission test"); } },
    ...overrides,
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(code, { exports, require: name => {
      if (name in dependencies) return dependencies[name];
      if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
      if (name.startsWith(".")) return load(path.posix.join(path.posix.dirname(file), name + ".ts"));
      return require(name);
    }, console, Request, Response, URL, URLSearchParams, File, FormData, process, setTimeout, clearTimeout, setInterval, clearInterval, ...globals }, { filename: file });
    return exports;
  }
  return { ...context, context, db, load, orm, schema };
}

export const request = (body, url = "http://localhost/api/test") => new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const params = id => ({ params: Promise.resolve({ id }) });
