import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request } from "./helpers.mjs";

const itemId = "11111111-1111-1111-1111-111111111111";
const start = 1_800_000_000_000;
function setup(role = "owner") {
  let now = start;
  class Clock extends Date { static now() { return now; } }
  const uploads = [];
  const control = { failStorage: false };
  const storage = { async upload(path, bytes) {
    uploads.push({ path, size: bytes.length });
    return { error: control.failStorage ? new Error("private storage detail") : null };
  }, getPublicUrl(path) { return { data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/menu-photos/" + path } }; }, async remove() { return { error: null }; } };
  const f = fixture(role, { "@/utils/supabase/admin": { createAdminClient: () => ({ storage: { from: () => storage } }) } },
    { Date: Clock, console: { ...console, error() {} } });
  f.state.menuItems.push({ id: itemId, storeId: "shop-a", name: "Existing", price: "20.00", imageUrl: null, isAvailable: true });
  // The in-memory fixture needs serial transactions to model the production advisory lock.
  const transaction = f.db.transaction; let queue = Promise.resolve();
  f.db.transaction = fn => { const result = queue.then(() => transaction(fn)); queue = result.catch(() => {}); return result; };
  const upload = f.load("app/api/upload/route.ts").POST;
  const create = f.load("app/api/menu/route.ts").POST;
  const edit = f.load("app/actions/menu.ts").updateMenuItem;
  async function call(kind, file = image(), fields = {}) {
    const form = new FormData();
    if (kind === "upload") form.set("bucket", "menu-photos");
    else { form.set("name", "Coffee"); form.set("price", "50"); form.set("isAvailable", "true"); }
    if (file !== null) form.set(kind === "upload" ? "file" : "image", file);
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    if (kind === "edit") {
      const result = await edit(itemId, form);
      return { status: result.success ? 200 : result.status, body: result };
    }
    const response = await (kind === "upload" ? upload : create)(new Request("http://localhost/api/" + kind, { method: "POST", body: form }));
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  return { ...f, uploads, control, call, upload, create, edit, advance(ms) { now += ms; } };
}
function image(size = 12, type = "image/png") { return new File([new Uint8Array(size)], "photo.png", { type }); }

test("create, edit and direct upload share one account quota and reject before changing menu or Storage", async () => {
  const f = setup();
  for (let i = 0; i < 10; i++) assert.ok([200, 201].includes((await f.call(["upload", "create", "edit"][i % 3])).status));
  const before = structuredClone(f.state.menuItems);
  for (const kind of ["upload", "create", "edit"]) {
    const result = await f.call(kind);
    assert.equal(result.status, 429); assert.equal(result.body.retryAfter, 60);
    if (result.headers) { assert.equal(result.headers.get("retry-after"), "60"); assert.equal(result.headers.get("cache-control"), "private, no-store"); }
  }
  assert.equal(f.uploads.length, 10); assert.deepEqual(f.state.menuItems, before);
  assert.equal(f.state.chatRateLimits.length, 2);
  assert.ok(f.state.chatRateLimits.every(row => row.count === 10 && row.id.startsWith("write:uploads:user:owner:")));
});

test("metadata-only menu create and edit work after image quota is exhausted without charging twice", async () => {
  const f = setup(); for (let i = 0; i < 10; i++) await f.call("upload");
  assert.equal((await f.call("create", null)).status, 201);
  assert.equal((await f.call("edit", null, { name: "New name", price: "75" })).status, 200);
  assert.equal(f.state.menuItems.find(item => item.id === itemId).price, "75.00");
  assert.equal(f.uploads.length, 10); assert.ok(f.state.chatRateLimits.every(row => row.count === 10));
  const emptyInput = new File([], "", { type: "application/octet-stream" });
  assert.equal((await f.call("edit", emptyInput)).status, 200);
  assert.ok(f.state.chatRateLimits.every(row => row.count === 10));
});

test("minute rollover does not reset the shared daily upload cap", async () => {
  const f = setup(); await f.call("create");
  f.state.chatRateLimits.find(row => row.id.endsWith(":86400000")).count = 100;
  f.advance(60_000);
  for (const kind of ["upload", "create", "edit"]) {
    const result = await f.call(kind); assert.equal(result.status, 429); assert.equal(result.body.retryAfter, 86_340);
  }
  assert.equal(f.uploads.length, 1);
  f.advance(86_340_000);
  assert.equal((await f.call("edit")).status, 200);
  assert.ok(f.state.chatRateLimits.every(row => row.count === 1));
});

test("concurrent mixed entry points do not exceed the shared upload allowance", async () => {
  const f = setup();
  const results = await Promise.all(Array.from({ length: 15 }, (_, i) => f.call(["upload", "create", "edit"][i % 3])));
  assert.equal(results.filter(result => result.status === 429).length, 5);
  assert.equal(f.uploads.length, 10); assert.ok(f.state.chatRateLimits.every(row => row.count === 10));
});

test("failed Storage and invalid image attempts consume the same quota without saving a menu", async () => {
  for (const kind of ["create", "edit"]) {
    const f = setup(), before = structuredClone(f.state.menuItems);
    assert.equal((await f.call(kind, image(12, "image/svg+xml"))).status, 400);
    assert.equal(f.uploads.length, 0);
    f.control.failStorage = true;
    const failed = await f.call(kind);
    assert.ok([500, 503].includes(failed.status)); assert.ok(!JSON.stringify(failed.body).includes("private storage detail"));
    assert.deepEqual(f.state.menuItems, before);
    assert.ok(f.state.chatRateLimits.every(row => row.count === 2));
    f.control.failStorage = false;
    for (let i = 0; i < 8; i++) await f.call("upload");
    assert.equal((await f.call(kind)).status, 429);
  }
});

test("non-owners and foreign menu edits cannot consume quota or write files", async () => {
  for (const role of ["anonymous", "cashier", "kitchen"]) {
    const f = setup(role);
    for (const kind of ["create", "edit"]) assert.equal((await f.call(kind)).status, role === "anonymous" ? 401 : 403);
    assert.equal(f.uploads.length, 0); assert.equal(f.state.chatRateLimits.length, 0);
  }
  const f = setup(); f.state.menuItems[0].storeId = "shop-b";
  assert.equal((await f.call("edit")).status, 404);
  assert.equal(f.uploads.length, 0); assert.equal(f.state.chatRateLimits.length, 0);
  const req = new Request("http://localhost/api/menu", { method: "POST", body: new FormData() });
  const anonymous = setup("anonymous"); assert.equal((await anonymous.create(req)).status, 401); assert.equal(req.bodyUsed, false);
});

test("quota outage blocks both menu upload paths without changing menu records", async () => {
  for (const kind of ["create", "edit"]) {
    const f = setup(), before = structuredClone(f.state.menuItems);
    f.db.transaction = async () => { throw new Error("private quota failure"); };
    const result = await f.call(kind);
    assert.equal(result.status, 500); assert.ok(!JSON.stringify(result.body).includes("private quota"));
    assert.equal(f.uploads.length, 0); assert.deepEqual(f.state.menuItems, before);
  }
});

test("menu payloads are bounded including non-file fields and forged Content-Length", async () => {
  const f = setup(), limit = 5 * 1024 * 1024 + 64 * 1024;
  const form = new FormData(); form.set("name", "Coffee"); form.set("price", "50"); form.set("extra", "x".repeat(limit));
  const req = new Request("http://localhost/api/menu", { method: "POST", body: form }); req.headers.set("content-length", "1");
  assert.equal((await f.create(req)).status, 413);
  assert.equal((await f.create(request({ name: "Coffee", price: "50", description: "x".repeat(64 * 1024) }))).status, 413);
  const denied = await f.call("edit", image(), { extra: "ก".repeat(Math.ceil(limit / 3)) });
  assert.equal(denied.status, 413); assert.equal(f.uploads.length, 0); assert.equal(f.state.chatRateLimits.length, 0);
});

test("both menu paths use the same image type and 5 MiB application file limit", async () => {
  for (const kind of ["create", "edit"]) {
    const f = setup();
    // Direct action invocation tests application validation, not Next/Vercel transport limits.
    assert.ok([200, 201].includes((await f.call(kind, image(5 * 1024 * 1024))).status));
    assert.equal((await f.call(kind, image(5 * 1024 * 1024 + 1))).status, 400);
    assert.equal((await f.call(kind, image(12, "constructor"))).status, 400);
    assert.equal(f.uploads.length, 1);
  }
});

test("an account cannot reset the quota through request fields, while another owner is independent", async () => {
  const f = setup(); for (let i = 0; i < 10; i++) await f.call("create");
  assert.equal((await f.call("edit", image(), { userId: "owner-b", ownerId: "owner-b" })).status, 429);
  f.context.user = { ...f.context.user, id: "owner-b" };
  assert.equal((await f.call("create")).status, 201);
  assert.equal(f.uploads.at(-1).path.startsWith("owner-b/"), true);
  assert.equal(f.state.chatRateLimits.length, 4);
});
