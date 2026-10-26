import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request, params } from "./helpers.mjs";

const victim = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const orderId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const productId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
function setup(role = "anonymous", collision = false) {
  const f = fixture(role, {}, { console: { ...console, error() {} } });
  f.state.stores[0].id = victim;
  f.state.stores[1].id = other;
  if (collision) f.state.stores[1].slug = victim;
  f.state.tables.push({ id: "table-a", storeId: victim, tableNumber: 1, status: "occupied",
    currentSessionToken: "round-a", currentQrToken: "qr-a", qrExpiresAt: new Date(Date.now() + 3600000) });
  f.state.orders.push({ id: orderId, storeId: victim, tableId: "table-a", tableNumber: 1,
    sessionToken: "round-a", status: "pending", paymentStatus: "unpaid", totalAmount: "50.00", createdAt: new Date() });
  f.state.menuItems.push({ id: productId, storeId: victim, name: "Coffee", price: "50.00", isAvailable: true });
  return f;
}
const detail = (f, token = "qr-a") => f.load("app/api/orders/[id]/route.ts").GET(
  new Request("http://localhost/api/orders/" + orderId + "?token=" + token), params(orderId));

for (const slug of [victim, "  " + victim.toUpperCase() + "  ", "00000000-0000-0000-0000-000000000000"]) {
  test("UUID slug is rejected consistently before any writes: " + slug, async () => {
    const f = setup("new-user");
    const actions = f.load("app/actions/owner-auth.ts");
    assert.equal((await actions.checkSlugAvailability(slug)).available, false);
    const before = JSON.stringify(f.state);
    for (const input of [{ name: "Other cafe", slug }, { name: slug, slug: "" }]) {
      const result = await actions.createStoreOnboarding(input);
      assert.equal(result.success, false);
      assert.match(result.error, /UUID/);
    }
    assert.equal(JSON.stringify(f.state), before);
    assert.equal(f.writes.length, 0);
    const owner = setup("owner");
    const response = await owner.load("app/api/store/route.ts").PUT(request({ slug }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /UUID/);
    assert.equal(owner.state.stores[0].slug, "cafe-a");
    assert.equal(owner.writes.length, 0);
  });
}

test("internal ID lookup and order QR remain correct even with pre-existing colliding slug", async () => {
  const f = setup("anonymous", true);
  const stores = f.load("utils/store.ts");
  assert.equal((await stores.getStoreById(victim)).id, victim);
  // Existing public slug links retain their previous meaning.
  assert.equal((await stores.getStoreBySlugOrId(victim)).id, other);
  const response = await detail(f);
  assert.equal(response.status, 200);
  const data = (await response.json()).data;
  assert.equal(data.id, orderId);
  assert.equal(data.storeId, victim);
  assert.equal(data.sessionToken, undefined);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(f.writes.length, 0);
});

test("ID-based order read still rejects another store QR, expired QR and previous rounds", async () => {
  const f = setup("anonymous", true);
  f.state.tables.push({ id: "table-b", storeId: other, tableNumber: 1, status: "occupied",
    currentSessionToken: "round-b", currentQrToken: "qr-b", qrExpiresAt: new Date(Date.now() + 3600000) });
  assert.equal((await detail(f, "qr-b")).status, 403);
  assert.equal((await detail(f, "round-a")).status, 403);
  f.state.tables[0].qrExpiresAt = new Date(Date.now() - 1000);
  assert.equal((await detail(f)).status, 403);
  f.state.tables[0].qrExpiresAt = new Date(Date.now() + 3600000);
  f.state.tables[0].currentSessionToken = "new-round";
  assert.equal((await detail(f)).status, 404);
  assert.equal(f.writes.length, 0);
});

test("normal slugs and legacy ID links still return the correct customer session", async () => {
  const f = setup();
  for (const identifier of ["cafe-a", victim]) {
    const response = await f.load("app/api/customer/session/route.ts").GET(new Request(
      "http://localhost/api/customer/session?store=" + identifier + "&table=1", { headers: { Authorization: "Bearer qr-a" } }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.orders[0].id, orderId);
  }
  const stores = f.load("utils/store.ts");
  assert.equal(await stores.getStoreById("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"), undefined);
});

test("order creation treats explicit storeId as an ID despite a colliding slug", async () => {
  for (const identifier of [{ storeId: victim }, { storeSlug: "cafe-a" }]) {
    const f = setup("anonymous", true);
    const response = await f.load("app/api/orders/route.ts").POST(request({ ...identifier,
      tableNumber: 1, sessionToken: "qr-a", items: [{ menuItemId: productId, quantity: 1 }] }));
    assert.equal(response.status, 201);
    assert.equal((await response.json()).data.storeId, victim);
    assert.equal(f.state.orders.at(-1).storeId, victim);
  }
});

test("blocking an attempted colliding slug leaves the victim order readable", async () => {
  const f = setup("new-user");
  assert.equal((await detail(f)).status, 200);
  const result = await f.load("app/actions/owner-auth.ts").createStoreOnboarding({ name: "Other cafe", slug: victim });
  assert.equal(result.success, false);
  assert.equal((await detail(f)).status, 200);
  assert.equal(f.writes.length, 0);
});

test("shop names may repeat while ordinary Thai and ASCII slugs remain supported", async () => {
  for (const slug of ["ร้านกาแฟ", "cafe-123", "cafe_123"]) {
    const f = setup("new-user");
    f.state.stores[0].name = "Same name";
    const actions = f.load("app/actions/owner-auth.ts");
    assert.equal((await actions.checkSlugAvailability(slug)).available, true);
    assert.equal((await actions.createStoreOnboarding({ name: "Same name", slug })).success, true);
    assert.equal(f.state.stores.at(-1).slug, slug);
  }
});
