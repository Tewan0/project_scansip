// Run with: node --test tests/*.test.mjs
// Exercise the actual route handlers using an in-memory database and Auth stub.
// No requests or writes are made to the shared Supabase project.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadTs(file, dependencies = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: (name) => dependencies[name] ?? require(name), console, ...globals,
  }, { filename: file });
  return exports;
}

function fixture({ role = "owner", tableCount = 8 } = {}) {
  const schema = Object.fromEntries(["stores", "tables", "orders", "staff", "serviceRequests"].map((name) => [name,
    Object.fromEntries(["id", "storeId", "ownerId", "tableId", "tableNumber", "status", "sessionToken", "paymentStatus", "totalAmount", "userId", "email", "role", "servingRequired", "deliveredAt"]
      .map((key) => [key, { key }]).concat([["tableName", name]])),
  ]));
  const state = {
    stores: [{ id: "shop-a", ownerId: "owner", slug: "cafe-a" }, { id: "shop-b", ownerId: "other-owner", slug: "cafe-b" }],
    tables: Array.from({ length: tableCount }, (_, i) => ({ id: "table-" + (i + 1), storeId: "shop-a", tableNumber: i + 1, status: "available", currentSessionToken: null })),
    orders: [], serviceRequests: [],
    staff: role === "cashier" ? [{ storeId: "shop-a", userId: "cashier", email: "staff@example.com", role: "cashier" }] : [],
  };
  const user = role === "anonymous" ? null : { id: role, email: "STAFF@example.com", email_confirmed_at: "2026-01-01" };
  const operations = [];
  const orm = {
    eq: (column, value) => (row) => row[column.key] === value,
    isNull: (column) => (row) => row[column.key] == null,
    ne: (column, value) => (row) => row[column.key] !== value,
    gt: (column, value) => (row) => row[column.key] > value,
    inArray: (column, values) => (row) => values.includes(row[column.key]),
    and: (...conditions) => (row) => conditions.filter(Boolean).every((predicate) => predicate(row)),
    or: (...conditions) => (row) => conditions.filter(Boolean).some((predicate) => predicate(row)),
    asc: (column) => column,
    sql: (_strings, column, value) => (row) => row[column.key].toLowerCase() === value,
  };
  function database(data) {
    return {
      query: Object.fromEntries(Object.keys(schema).map((name) => [name, {
        findFirst: async ({ where }) => data[name].find(where),
        findMany: async ({ where, limit }) => data[name].filter(where).slice(0, limit),
      }])),
      select(fields) {
        let name, predicate = () => true;
        const query = {
          from(table) { name = table.tableName; return query; },
          where(condition) { predicate = condition; return query; },
          orderBy() { return query; },
          for(mode) { operations.push(["lock", name, mode]); return query; },
          then(resolve, reject) {
            const rows = data[name].filter(predicate).sort((a, b) => (a.tableNumber || 0) - (b.tableNumber || 0));
            return Promise.resolve(fields ? rows.map((row) => Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column.key]]))) : rows).then(resolve, reject);
          },
        };
        return query;
      },
      delete(table) {
        return { where: async (predicate) => {
          const removedIds = data[table.tableName].filter(predicate).map((row) => row.id);
          data[table.tableName] = data[table.tableName].filter((row) => !predicate(row));
          data.orders.forEach((order) => { if (removedIds.includes(order.tableId)) order.tableId = null; });
        } };
      },
      insert(table) {
        return { values: async (rows) => data[table.tableName].push(...rows.map((row) => ({ id: "new-" + row.tableNumber, currentSessionToken: null, ...row }))) };
      },
      update(table) {
        return { set: (values) => ({ where: (predicate) => {
          const execute = () => {
            const rows = data[table.tableName].filter(predicate);
            rows.forEach((row) => Object.assign(row, values));
            return rows;
          };
          return { returning: async () => execute(), then: (resolve, reject) => Promise.resolve(execute()).then(resolve, reject) };
        } }) };
      },
      async transaction(callback) {
        const draft = structuredClone(data);
        const result = await callback(database(draft));
        Object.assign(data, draft);
        return result;
      },
    };
  }
  const dependencies = {
    "next/server": { NextResponse: { json: (body, init = {}) => ({ status: init.status || 200, body: JSON.parse(JSON.stringify(body)) }) } },
    "@/db": { db: database(state) }, "@/db/schema": schema, "drizzle-orm": orm,
    "@/utils/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) },
    "@/lib/table-settings": loadTs("lib/table-settings.ts"),
    "@/lib/customer-qr": loadTs("lib/customer-qr.ts"),
    "@/lib/payments": loadTs("lib/payments.ts"),
  };
  dependencies["@/lib/auth"] = loadTs("lib/auth.ts", {
    ...dependencies, "server-only": {}, "@/lib/permissions": loadTs("lib/permissions.ts"),
  });
  const route = loadTs("app/api/tables/route.ts", dependencies);
  return { state, operations, get: route.GET, post: (body) => route.POST({ json: async () => body }) };
}

test("owner increases table count without touching another store", async () => {
  const f = fixture();
  f.state.tables.push({ id: "other", storeId: "shop-b", tableNumber: 20, status: "occupied" });
  const response = await f.post({ action: "sync_tables", count: 10 });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 10);
  assert.equal(f.state.tables.find((row) => row.id === "other").status, "occupied");
  assert.deepEqual(f.operations.slice(0, 2), [["lock", "stores", "update"], ["lock", "tables", "update"]]);
});

test("reducing idle tables keeps historical paid orders and their table numbers", async () => {
  const f = fixture();
  f.state.orders.push({ storeId: "shop-a", tableId: "table-8", tableNumber: 8, status: "completed", paymentStatus: "paid" });
  const response = await f.post({ action: "sync_tables", count: 6 });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map((table) => table.tableNumber), [1, 2, 3, 4, 5, 6]);
  assert.equal(f.state.orders.length, 1);
  assert.equal(f.state.orders[0].tableNumber, 8);
  assert.equal(f.state.orders[0].tableId, null);
});

for (const state of [{ status: "occupied" }, { status: "reserved" }, { status: "available", currentSessionToken: "active-token" }]) {
  test("refuses removal and leaves all tables intact: " + JSON.stringify(state), async () => {
    const f = fixture();
    Object.assign(f.state.tables[7], state);
    const before = structuredClone(f.state);
    assert.equal((await f.post({ action: "sync_tables", count: 6 })).status, 409);
    assert.deepEqual(f.state, before);
  });
}

for (const order of [{ status: "served", paymentStatus: "unpaid" }, { status: "preparing", paymentStatus: "paid" }]) {
  test("refuses removal with outstanding order: " + JSON.stringify(order), async () => {
    const f = fixture();
    f.state.orders.push({ storeId: "shop-a", tableNumber: 8, ...order });
    assert.equal((await f.post({ action: "sync_tables", count: 6 })).status, 409);
    assert.equal(f.state.tables.length, 8);
  });
}

test("cancelled orders and another store's unpaid orders do not block resizing", async () => {
  const f = fixture();
  f.state.orders.push({ storeId: "shop-a", tableNumber: 8, status: "cancelled", paymentStatus: "unpaid" },
    { storeId: "shop-b", tableNumber: 8, status: "pending", paymentStatus: "unpaid" });
  assert.equal((await f.post({ action: "sync_tables", count: 6 })).status, 200);
});

test("orders linked only by table ID also prevent deletion", async () => {
  const f = fixture();
  f.state.orders.push({ storeId: "shop-a", tableId: "table-8", tableNumber: null, status: "served", paymentStatus: "unpaid" });
  assert.equal((await f.post({ action: "sync_tables", count: 6 })).status, 409);
  assert.equal(f.state.tables.length, 8);
});

test("invalid counts are rejected without changing data", async () => {
  for (const count of [0, -1, 51, 1.5, "8", null, true]) {
    const f = fixture();
    assert.equal((await f.post({ action: "sync_tables", count })).status, 400, String(count));
    assert.equal(f.state.tables.length, 8);
  }
});

test("anonymous visitors cannot read session tokens or resize tables", async () => {
  const f = fixture({ role: "anonymous" });
  assert.equal((await f.get()).status, 401);
  assert.equal((await f.post({ action: "sync_tables", count: 6 })).status, 401);
});

test("cashier can open a table but cannot change the number of tables", async () => {
  const f = fixture({ role: "cashier" });
  assert.equal((await f.get()).body.canManageTables, false);
  assert.equal((await f.post({ action: "sync_tables", count: 6 })).status, 403);
  assert.equal((await f.post({ action: "open_session", tableNumber: 1 })).status, 200);
});

test("kitchen and arbitrary store selectors cannot modify tables", async () => {
  assert.equal((await fixture({ role: "kitchen" }).post({ action: "open_session", tableNumber: 1 })).status, 403);
  assert.equal((await fixture().post({ action: "sync_tables", count: 6, storeSlug: "cafe-b" })).status, 403);
});

test("reopening the same active table preserves its QR token", async () => {
  const f = fixture();
  const first = await f.post({ action: "open_session", tableNumber: 1 });
  const second = await f.post({ action: "open_session", tableNumber: 1 });
  assert.equal(second.body.data.currentSessionToken, first.body.data.currentSessionToken);
  assert.match(first.body.data.currentSessionToken, /^tk_[a-f0-9]{32}$/);
});

test("duplicate table numbers never report a successful close of the wrong row", async () => {
  const f = fixture({ role: "cashier" });
  f.state.tables.push({ ...f.state.tables[2], id: "duplicate-3", status: "occupied", currentSessionToken: "active-session" });
  const before = structuredClone(f.state);
  assert.equal((await f.get()).status, 409);
  for (const action of ["close_session", "open_session"]) {
    assert.equal((await f.post({ action, tableNumber: 3 })).status, 409);
    assert.deepEqual(f.state, before);
  }
});

test("cashier closes an empty session and refresh shows it available while other stores stay unchanged", async () => {
  const f = fixture({ role: "cashier" });
  f.state.tables.push({ id: "other-3", storeId: "shop-b", tableNumber: 3, status: "occupied", currentSessionToken: "other-session" });
  await f.post({ action: "open_session", tableNumber: 3 });
  const response = await f.post({ action: "close_session", tableNumber: 3 });
  assert.equal(response.status, 200);
  const closed = (await f.get()).body.data.find(table => table.tableNumber === 3);
  assert.equal(closed.status, "available");
  assert.equal(closed.currentSessionToken, null);
  assert.equal(closed.sessionStartedAt, null);
  assert.equal(f.state.tables.find(table => table.id === "other-3").currentSessionToken, "other-session");
});

test("an empty floor plan stays empty on GET and can be configured", async () => {
  const f = fixture({ tableCount: 0 });
  assert.deepEqual((await f.get()).body.data, []);
  assert.equal((await f.post({ action: "sync_tables", count: 3 })).body.data.length, 3);
});

test("theme initialization honors saved choice, system preference, and blocked storage", () => {
  const { themeInitScript } = loadTs("lib/theme.ts");
  for (const [saved, systemDark, expected, blocked] of [
    ["dark", false, true], ["light", true, false], [null, true, true], [null, false, false],
    ["invalid", true, true], [null, true, true, true],
  ]) {
    const result = { style: {}, classList: { toggle: (_name, value) => { result.dark = value; } } };
    vm.runInNewContext(themeInitScript, {
      localStorage: { getItem: () => { if (blocked) throw new Error("blocked"); return saved; } },
      window: { matchMedia: () => ({ matches: systemDark }) }, document: { documentElement: result },
    });
    assert.equal(result.dark, expected);
    assert.equal(result.style.colorScheme, expected ? "dark" : "light");
  }
});

for (const storageBlocked of [false, true]) {
  test("theme toggle persists and follows system/cross-tab changes; blocked storage=" + storageBlocked, () => {
    const saved = new Map();
    const classes = new Set();
    const media = Object.assign(new EventTarget(), { matches: true });
    const browser = Object.assign(new EventTarget(), { matchMedia: () => media });
    const root = { style: {}, classList: {
      contains: (name) => classes.has(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    } };
    let cleanup;
    const { ThemeController, ThemeToggle } = loadTs("components/theme-toggle.tsx", {
      react: {
        useEffect: (effect) => { cleanup = effect(); },
        useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
      },
      "@/components/ui/button": { Button: () => null },
      "@/lib/theme": loadTs("lib/theme.ts"),
    }, {
      Event, window: browser, document: { documentElement: root },
      localStorage: {
        getItem: (key) => { if (storageBlocked) throw new Error("blocked"); return saved.get(key) ?? null; },
        setItem: (key, value) => { if (storageBlocked) throw new Error("blocked"); saved.set(key, value); },
      },
    });
    ThemeController();
    assert.equal(root.style.colorScheme, "dark");
    ThemeToggle({}).props.onClick();
    assert.equal(root.style.colorScheme, "light");
    assert.equal(ThemeToggle({}).props["aria-pressed"], false);
    media.dispatchEvent(new Event("change"));
    assert.equal(root.style.colorScheme, "light", "manual choice takes precedence over system");
    if (!storageBlocked) {
      assert.equal(saved.get("scansip-theme"), "light");
      saved.set("scansip-theme", "dark");
      browser.dispatchEvent(Object.assign(new Event("storage"), { key: "scansip-theme" }));
      assert.equal(root.style.colorScheme, "dark");
      saved.clear();
      media.matches = false;
      browser.dispatchEvent(Object.assign(new Event("storage"), { key: null }));
      assert.equal(root.style.colorScheme, "light");
    }
    cleanup();
  });
}
