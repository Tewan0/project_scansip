import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, request } from "./helpers.mjs";
import { imageFile } from "./image-fixtures.mjs";

const product = "11111111-1111-1111-1111-111111111111";
const body = { storeSlug: "cafe-a", tableNumber: 1, sessionToken: "round-a", items: [{ menuItemId: product, quantity: 1 }] };
const start = 1_800_000_000_000;
function setupOrders() {
  let now = start;
  class Clock extends Date { static now() { return now; } }
  const f = fixture("anonymous", {}, { Date: Clock });
  f.state.tables.push({ id: "table-a", storeId: "shop-a", tableNumber: 1, status: "occupied", currentSessionToken: "round-a", sessionStartedAt: new Date(start) });
  f.state.menuItems.push({ id: product, storeId: "shop-a", name: "Coffee", price: "50.00", isAvailable: true });
  return { ...f, post: f.load("app/api/orders/route.ts").POST, advance(ms) { now += ms; } };
}
function setupUpload(role = "owner", failStorage = false) {
  const calls = [];
  const f = fixture(role, { "@/utils/supabase/admin": { createAdminClient: () => ({ storage: { from: bucket => ({
    async upload(path, bytes, options) { calls.push({ bucket, path, size: bytes.length, options }); return { error: failStorage ? new Error("Storage unavailable") : null }; },
    getPublicUrl: path => ({ data: { publicUrl: "https://storage.example/" + bucket + "/" + path } }),
  }) } }) } }, { console: { ...console, error() {} } });
  return { ...f, calls, post: f.load("app/api/upload/route.ts").POST };
}
function upload(bucket = "menu-photos", size, type = "image/png") {
  const form = new FormData(); form.set("bucket", bucket);
  form.set("file", imageFile({ size, type }));
  return new Request("http://localhost/api/upload", { method: "POST", body: form });
}
function streamRequest(chunks, headers, onCancel = () => {}) {
  let index = 0;
  return new Request("http://localhost/api/test", { method: "POST", headers, duplex: "half", body: new ReadableStream({
    pull(controller) { if (index < chunks.length) controller.enqueue(chunks[index++]); else controller.close(); },
    cancel: onCancel,
  }) });
}

test("new orders are capped per table; retries replay before quota/menu validation", async () => {
  const f = setupOrders(), requestId = randomUUID();
  assert.equal((await f.post(request({ ...body, requestId }))).status, 201);
  for (let i = 1; i < 6; i++) assert.equal((await f.post(request({ ...body, requestId: randomUUID() }))).status, 201);
  const req = request({ ...body, requestId: randomUUID(), userId: "forged", ip: "different" });
  req.headers.set("x-forwarded-for", "1.2.3.4");
  const denied = await f.post(req), json = await denied.json();
  assert.equal(denied.status, 429); assert.equal(denied.headers.get("retry-after"), "60");
  assert.equal(json.retryAfter, 60); assert.equal(json.sessionExpired, undefined);
  assert.equal(denied.headers.get("cache-control"), "private, no-store");
  f.state.menuItems[0].isAvailable = false;
  const replay = await f.post(request({ ...body, requestId }));
  assert.equal(replay.status, 201); assert.equal(f.state.orders.length, 6);
  assert.equal(f.state.chatRateLimits.length, 2);
  assert.ok(f.state.chatRateLimits.every(row => row.count === 6));
});

test("orders share quota across instances and new QR rounds, but isolate other tables and stores", async () => {
  const f = setupOrders();
  for (let i = 0; i < 6; i++) await f.post(request(body));
  f.state.tables[0].currentSessionToken = "round-b";
  const second = fixture("anonymous", { "@/db": { db: f.db } });
  assert.equal((await second.load("app/api/orders/route.ts").POST(request({ ...body, sessionToken: "round-b" }))).status, 429);
  f.state.tables.push({ id: "table-b", storeId: "shop-a", tableNumber: 2, status: "occupied", currentSessionToken: "round-c", sessionStartedAt: new Date(start) });
  assert.equal((await f.post(request({ ...body, tableNumber: 2, sessionToken: "round-c" }))).status, 201);
  f.state.tables.push({ id: "table-other", storeId: "shop-b", tableNumber: 1, status: "occupied", currentSessionToken: "round-other", sessionStartedAt: new Date(start) });
  f.state.menuItems.push({ ...f.state.menuItems[0], storeId: "shop-b" });
  assert.equal((await f.post(request({ ...body, storeSlug: "cafe-b", sessionToken: "round-other" }))).status, 201);
});

test("order minute and hour windows expire independently and reuse stable counter rows", async () => {
  const f = setupOrders();
  for (let minute = 0; minute < 10; minute++) {
    for (let i = 0; i < 6; i++) assert.equal((await f.post(request(body))).status, 201);
    f.advance(60_000);
  }
  const denied = await f.post(request(body));
  assert.equal(denied.status, 429); assert.equal(denied.headers.get("retry-after"), "3000");
  assert.ok(f.state.chatRateLimits.find(row => row.id.endsWith(":3600000")).count === 60);
  f.advance(3_000_000);
  assert.equal((await f.post(request(body))).status, 201);
  assert.equal(f.state.chatRateLimits.length, 2);
  assert.ok(f.state.chatRateLimits.every(row => row.count === 1));
});

test("invalid QR/menu and a failed order transaction never consume successful-order quota", async () => {
  const f = setupOrders();
  assert.equal((await f.post(request({ ...body, sessionToken: "wrong" }))).status, 403);
  f.state.menuItems[0].isAvailable = false;
  assert.equal((await f.post(request(body))).status, 400);
  assert.equal(f.state.chatRateLimits.length, 0);
  f.state.menuItems[0].isAvailable = true;
  const transaction = f.db.transaction;
  f.db.transaction = fn => transaction(tx => {
    const insert = tx.insert;
    tx.insert = table => { if (table.tableName === "orders") throw new Error("Simulated database failure"); return insert(table); };
    return fn(tx);
  });
  assert.equal((await f.post(request(body))).status, 500);
  assert.equal(f.state.chatRateLimits.length, 0); assert.equal(f.state.orders.length, 0);
});

test("orders reject oversized real streams despite missing/forged lengths, before database access", async () => {
  for (const length of [undefined, "1", String(81 * 1024)]) {
    const f = setupOrders(); let cancelled = false;
    const headers = { "content-type": "application/json", ...(length === undefined ? {} : { "content-length": length }) };
    const req = streamRequest([new Uint8Array(40 * 1024), new Uint8Array(41 * 1024), new Uint8Array(1)], headers, () => { cancelled = true; });
    assert.equal((await f.post(req)).status, 413); assert.equal(f.writes.length, 0);
    if (length !== String(81 * 1024)) assert.equal(cancelled, true);
  }
  const f = setupOrders();
  assert.equal((await f.post(new Request("http://localhost", { method: "POST", body: "{}" }))).status, 415);
  assert.equal((await f.post(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }))).status, 400);
});

test("order payload cap still accepts 50 lines with maximum Thai notes", async () => {
  const f = setupOrders();
  const req = request({ ...body, customerNote: "ก".repeat(500), items: Array.from({ length: 50 }, () => ({ menuItemId: product, quantity: 1, specialInstruction: "ก".repeat(300) })) });
  assert.equal((await f.post(req)).status, 201); assert.equal(f.state.orderItems.length, 50);
});

test("upload attempts share account quota across buckets and cannot spoof identity", async () => {
  const f = setupUpload();
  for (let i = 0; i < 10; i++) assert.equal((await f.post(upload(i % 2 ? "restaurant-logos" : "menu-photos"))).status, 200);
  const req = upload(); req.headers.set("x-forwarded-for", "9.9.9.9"); req.headers.set("x-user-id", "someone-else");
  const denied = await f.post(req); assert.equal(denied.status, 429);
  assert.ok(Number(denied.headers.get("retry-after")) > 0); assert.equal(f.calls.length, 10);
  assert.equal(f.state.chatRateLimits.length, 2);
  assert.ok(f.calls.every(call => call.path.startsWith("owner/") && call.options.upsert === false));
  f.context.user = { ...f.context.user, id: "owner-b" };
  assert.equal((await f.post(upload())).status, 200);
});

test("onboarding has lower upload limits, permits only logos and cannot reset quota by becoming owner", async () => {
  const f = setupUpload("new-user");
  assert.equal((await f.post(upload())).status, 403);
  for (let i = 0; i < 2; i++) assert.equal((await f.post(upload("restaurant-logos"))).status, 200);
  assert.equal((await f.post(upload("restaurant-logos"))).status, 429);
  assert.equal(f.calls.length, 2);
  f.state.stores.push({ id: "new-store", ownerId: "new-user", slug: "new" });
  assert.equal((await f.post(upload())).status, 200);
  assert.ok(f.state.chatRateLimits.every(row => row.count === 4));
});

test("upload daily cap survives minute rollover and module reload, without blocking other accounts", async () => {
  for (const [role, max] of [["owner", 100], ["new-user", 10]]) {
    const f = setupUpload(role);
    await f.post(upload("restaurant-logos"));
    const daily = f.state.chatRateLimits.find(row => row.id.endsWith(":86400000")); daily.count = max;
    f.state.chatRateLimits.find(row => row.id.endsWith(":60000")).windowKey = String(Date.now() - 60_001);
    const fresh = fixture(role, { "@/db": { db: f.db } });
    assert.equal((await fresh.load("app/api/upload/route.ts").POST(upload("restaurant-logos"))).status, 429);
    assert.equal(f.calls.length, 1);
    assert.equal(f.state.chatRateLimits.find(row => row.id.endsWith(":60000")).count, 1);
    daily.windowKey = String(Date.now() - 86_400_001);
    assert.equal((await f.post(upload("restaurant-logos"))).status, 200);
    assert.equal(f.state.chatRateLimits.length, 2);
    assert.ok(f.state.chatRateLimits.every(row => row.count === 1));
  }
});

test("upload rejects unauthenticated/staff callers before reading their multipart body", async () => {
  for (const role of ["anonymous", "cashier", "kitchen"]) {
    const f = setupUpload(role), req = upload();
    assert.equal((await f.post(req)).status, role === "anonymous" ? 401 : 403);
    assert.equal(req.bodyUsed, false); assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0);
  }
});

test("upload bounds the entire multipart stream, not just its file field", async () => {
  const f = setupUpload();
  const form = new FormData(); form.set("bucket", "menu-photos");
  form.set("file", new File(["small"], "photo.png", { type: "image/png" }));
  form.set("extra", "x".repeat(5 * 1024 * 1024 + 64 * 1024));
  const req = new Request("http://localhost", { method: "POST", body: form }); req.headers.set("content-length", "1");
  assert.equal((await f.post(req)).status, 413); assert.equal(f.calls.length, 0);
  const oversized = upload(); oversized.headers.set("content-length", String(6 * 1024 * 1024));
  assert.equal((await f.post(oversized)).status, 413); assert.equal(oversized.bodyUsed, false);
  assert.equal((await f.post(upload("menu-photos", 5 * 1024 * 1024 + 1))).status, 400);
  assert.equal(f.calls.length, 0);
});

test("malformed multipart and failed Storage attempts consume quota without returning a success URL", async () => {
  const f = setupUpload("owner", true);
  const malformed = new Request("http://localhost", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=wrong" }, body: "broken" });
  assert.equal((await f.post(malformed)).status, 400);
  const failure = await f.post(upload()); assert.equal(failure.status, 500); assert.equal((await failure.json()).url, undefined);
  assert.ok(f.state.chatRateLimits.every(row => row.count === 2));
  for (let i = 0; i < 8; i++) await f.post(upload());
  assert.equal((await f.post(upload())).status, 429); assert.equal(f.calls.length, 9);
});

test("write counters cannot change existing chatbot quota", async () => {
  const f = setupOrders();
  const chat = { id: "table:table-a", windowKey: "chat-round-hash", count: 40, lastUsedAt: new Date() };
  f.state.chatRateLimits.push(chat);
  await f.post(request(body));
  assert.deepEqual(f.state.chatRateLimits.find(row => row.id === chat.id), chat);
});

test("exhausted or unavailable upload quota never reads the body or contacts Storage", async () => {
  const f = setupUpload(); await f.post(upload());
  f.state.chatRateLimits.forEach(row => { row.count = 100; });
  const blocked = upload(); assert.equal((await f.post(blocked)).status, 429);
  assert.equal(blocked.bodyUsed, false); assert.equal(f.calls.length, 1);
  f.db.transaction = async () => { throw new Error("Quota database unavailable"); };
  const failed = upload(); assert.equal((await f.post(failed)).status, 500);
  assert.equal(failed.bodyUsed, false); assert.equal(f.calls.length, 1);
});

test("upload accepts a file at the existing 5 MiB boundary with multipart overhead", async () => {
  const f = setupUpload();
  assert.equal((await f.post(upload("menu-photos", 5 * 1024 * 1024))).status, 200);
  assert.equal(f.calls[0].size, 5 * 1024 * 1024);
});
