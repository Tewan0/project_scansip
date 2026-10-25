import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request, params } from "./helpers.mjs";

function orderFixture(role = "kitchen") {
  const f = fixture(role);
  f.state.orders.push({ id: "order-a", storeId: "shop-a", tableNumber: 1, sessionToken: "token-a", status: "pending", paymentStatus: "unpaid", totalAmount: "120.00" });
  f.state.orderItems.push({ id: "line-a", orderId: "order-a", menuName: "Coffee", quantity: 2, unitPrice: "50", status: "pending" }, { id: "line-b", orderId: "order-a", menuName: "Cake", quantity: 1, unitPrice: "20", status: "pending" });
  f.state.tables.push({ id: "table-a", storeId: "shop-a", tableNumber: 1, status: "occupied", currentSessionToken: "token-a", sessionStartedAt: new Date() });
  return f;
}

test("kitchen updates separate lines and derives order status only when all ready", async () => {
  const f = orderFixture(), route = f.load("app/api/orders/[id]/route.ts");
  assert.equal((await route.PATCH(request({ itemId: "line-a", itemStatus: "preparing" }), params("order-a"))).status, 200);
  assert.equal(f.state.orders[0].status, "preparing"); assert.equal(f.state.orderItems[1].status, "pending");
  await route.PATCH(request({ itemId: "line-a", itemStatus: "ready" }), params("order-a"));
  assert.equal(f.state.orders[0].status, "preparing");
  assert.equal((await route.PATCH(request({ itemId: "line-a", itemStatus: "pending" }), params("order-a"))).status, 409);
  await route.PATCH(request({ itemId: "line-b", itemStatus: "ready" }), params("order-a"));
  assert.equal(f.state.orders[0].status, "served"); assert.equal(f.state.orders[0].paymentStatus, "unpaid");
});

test("finish all is idempotent and preserves already-ready items", async () => {
  const f = orderFixture(), route = f.load("app/api/orders/[id]/route.ts");
  f.state.orderItems[0].status = "ready";
  for (let i = 0; i < 2; i++) assert.equal((await route.PATCH(request({ finishAll: true }), params("order-a"))).status, 200);
  assert.equal(f.state.orderItems.every(item => item.status === "ready"), true);
  assert.equal(f.state.orders[0].status, "served");
});

test("kitchen cannot take money, cancel orders or close bills even with mixed payloads", async () => {
  for (const body of [{ paymentStatus: "paid" }, { status: "cancelled" }, { status: "completed" }, { finishAll: true, paymentStatus: "paid" }, { itemId: "line-a", itemStatus: "ready", status: "cancelled" }]) {
    const f = orderFixture(), before = structuredClone(f.state);
    assert.equal((await f.load("app/api/orders/[id]/route.ts").PATCH(request(body), params("order-a"))).status, 403);
    assert.deepEqual(f.state, before);
  }
});

test("cashier cannot change cooking status, can cancel unpaid orders, cannot cancel paid ones", async () => {
  const f = orderFixture("cashier"), route = f.load("app/api/orders/[id]/route.ts");
  for (const body of [{ finishAll: true }, { itemId: "line-a", itemStatus: "ready" }, { status: "preparing" }, { status: "served" }]) assert.equal((await route.PATCH(request(body), params("order-a"))).status, 403);
  f.state.orders[0].paymentStatus = "paid";
  assert.equal((await route.PATCH(request({ status: "cancelled" }), params("order-a"))).status, 409);
  f.state.orders[0].paymentStatus = "unpaid";
  assert.equal((await route.PATCH(request({ status: "cancelled", cancellationReason: "ลูกค้าเปลี่ยนใจ" }), params("order-a"))).status, 200);
  assert.equal((await route.PATCH(request({ paymentStatus: "paid" }), params("order-a"))).status, 409);
});

test("cross-store order and cross-order line IDs never mutate data", async () => {
  for (const role of ["owner", "cashier", "kitchen"]) {
    const f = orderFixture(role), route = f.load("app/api/orders/[id]/route.ts");
    f.state.orders.push({ id: "other-order", storeId: "shop-b", status: "pending", paymentStatus: "unpaid" });
    f.state.orderItems.push({ id: "other-line", orderId: "other-order", status: "pending" });
    const before = structuredClone(f.state);
    assert.equal((await route.PATCH(request(role === "cashier" ? { status: "cancelled" } : { finishAll: true }), params("other-order"))).status, 404);
    if (role !== "cashier") assert.equal((await route.PATCH(request({ itemId: "other-line", itemStatus: "ready" }), params("order-a"))).status, 404);
    assert.deepEqual(f.state, before);
  }
});

test("kitchen feed excludes money and session tokens; private orders reject anonymous callers", async () => {
  const f = orderFixture(), response = await f.load("app/api/orders/route.ts").GET();
  const { data } = await response.json();
  assert.equal(data.length, 1); assert.equal("paymentStatus" in data[0], false);
  assert.equal("totalAmount" in data[0], false); assert.equal("sessionToken" in data[0], false); assert.equal("unitPrice" in data[0].items[0], false);
  assert.equal((await fixture("anonymous").load("app/api/orders/route.ts").GET()).status, 401);
});

test("customer order status requires matching token and a still-open table session", async () => {
  const f = orderFixture("anonymous"), route = f.load("app/api/orders/[id]/route.ts");
  assert.equal((await route.GET(new Request("http://localhost/api/orders/order-a"), params("order-a"))).status, 401);
  assert.equal((await route.GET(new Request("http://localhost/api/orders/order-a?token=wrong"), params("order-a"))).status, 403);
  assert.equal((await route.GET(new Request("http://localhost/api/orders/order-a?token=token-a"), params("order-a"))).status, 200);
  f.state.tables[0].currentSessionToken = "replacement";
  assert.equal((await route.GET(new Request("http://localhost/api/orders/order-a?token=token-a"), params("order-a"))).status, 403);
});

test("customer prices/names are taken from same-store menu, and a QR is always required", async () => {
  const f = orderFixture("anonymous"), route = f.load("app/api/orders/route.ts");
  const menuId = "12345678-1234-1234-1234-123456789012";
  f.state.menuItems.push({ id: menuId, storeId: "shop-a", name: "Real coffee", price: "70.50", isAvailable: true });
  const body = { storeSlug: "cafe-a", tableNumber: 1, sessionToken: "token-a", items: [{ menuItemId: menuId, quantity: 2, unitPrice: 0.01, menuName: "Forged" }] };
  const response = await route.POST(request(body));
  assert.equal(response.status, 201);
  const { data } = await response.json();
  assert.equal(data.totalAmount, "141.00"); assert.equal(data.items[0].menuName, "Real coffee"); assert.equal(data.tableId, "table-a");
  assert.equal((await route.POST(request({ ...body, tableNumber: null }))).status, 403);
  assert.equal((await route.POST(request({ ...body, sessionToken: "old" }))).status, 403);
  f.state.menuItems[0].storeId = "shop-b";
  const before = structuredClone(f.state);
  assert.equal((await route.POST(request(body))).status, 400);
  assert.deepEqual(f.state, before);
});

test("invalid quantities and unavailable menu items do not create partial orders", async () => {
  for (const quantity of [0, -1, 0.5, 100, "1"]) {
    const f = orderFixture("anonymous");
    const response = await f.load("app/api/orders/route.ts").POST(request({ storeSlug: "cafe-a", tableNumber: 1, sessionToken: "token-a", items: [{ menuItemId: "12345678-1234-1234-1234-123456789012", quantity }] }));
    assert.equal(response.status, 400); assert.equal(f.state.orders.length, 1);
  }
});

test("closing a table cannot discard an unpaid or unfinished order", async () => {
  const f = orderFixture("cashier"), route = f.load("app/api/tables/route.ts");
  assert.equal((await route.POST(request({ action: "close_session", tableNumber: 1 }))).status, 409);
  assert.equal(f.state.tables[0].currentSessionToken, "token-a");
  f.state.orders[0].paymentStatus = "paid"; f.state.orders[0].status = "preparing";
  assert.equal((await route.POST(request({ action: "close_session", tableNumber: 1 }))).status, 409);
  f.state.orders[0].status = "served";
  assert.equal((await route.POST(request({ action: "close_session", tableNumber: 1 }))).status, 200);
  assert.equal(f.state.tables[0].currentSessionToken, null);
});

test("cashier records each payment, close explains the remainder and only succeeds once all are settled", async () => {
  const f = orderFixture("cashier");
  f.state.orders[0].status = "served"; f.state.orders[0].totalAmount = "100.00";
  f.state.orders.push({ ...f.state.orders[0], id: "order-b", totalAmount: "70.00" });
  const tables = f.load("app/api/tables/route.ts"), orders = f.load("app/api/orders/[id]/route.ts");
  const close = () => tables.POST(request({ action: "close_session", tableNumber: 1 }));
  let response = await close(); assert.equal(response.status, 409);
  assert.match((await response.json()).error, /2 ออเดอร์ รวม ฿170.00/);
  assert.equal(f.state.orders[0].paymentStatus, "unpaid");
  assert.equal((await orders.PATCH(request({ paymentStatus: "paid", status: "completed" }), params("order-a"))).status, 200);
  response = await close(); assert.equal(response.status, 409); assert.match((await response.json()).error, /1 ออเดอร์ รวม ฿70.00/);
  assert.equal((await orders.PATCH(request({ paymentStatus: "paid", status: "completed" }), params("order-b"))).status, 200);
  assert.equal((await close()).status, 200); assert.equal(f.state.tables[0].status, "available");
});

test("receiving payment while cooking does not close the unfinished order or table", async () => {
  const f = orderFixture("cashier"), orders = f.load("app/api/orders/[id]/route.ts");
  assert.equal((await orders.PATCH(request({ paymentStatus: "paid", status: "completed" }), params("order-a"))).status, 409);
  assert.equal(f.state.orders[0].paymentStatus, "unpaid");
  assert.equal((await orders.PATCH(request({ paymentStatus: "paid" }), params("order-a"))).status, 200);
  assert.equal(f.state.orders[0].status, "pending");
  const response = await f.load("app/api/tables/route.ts").POST(request({ action: "close_session", tableNumber: 1 }));
  assert.equal(response.status, 409); assert.match((await response.json()).error, /อาหารที่ยังทำไม่เสร็จ 1 ออเดอร์/);
});

test("busy queues keep every unfinished order and still isolate stores", async () => {
  for (const role of ["kitchen", "cashier", "owner"]) {
    const f = orderFixture(role);
    for (let i = 0; i < 205; i++) {
      f.state.orders.push({ id: "pending-" + i, storeId: "shop-a", status: "pending", createdAt: new Date(2026, 0, 1, 0, i) });
      f.state.orders.push({ id: "closed-" + i, storeId: "shop-a", status: "completed", createdAt: new Date(2026, 0, 2, 0, i) });
    }
    f.state.orders.push({ id: "foreign", storeId: "shop-b", status: "pending", createdAt: new Date() });
    const { data } = await (await f.load("app/api/orders/route.ts").GET()).json();
    assert.equal(data.filter(order => order.status === "pending").length, 206);
    assert.equal(data.some(order => order.id === "foreign"), false);
    assert.equal(data.filter(order => order.status === "completed").length, role === "kitchen" ? 0 : 200);
  }
});


test("cancellation requires a meaningful bounded reason without changing the order on rejection", async () => {
  for (const reason of [undefined, null, "", "   ", 123, "ก".repeat(301)]) {
    const f = orderFixture("owner"), before = structuredClone(f.state);
    const response = await f.load("app/api/orders/[id]/route.ts").PATCH(request({ status: "cancelled", cancellationReason: reason }), params("order-a"));
    assert.equal(response.status, 400);
    assert.deepEqual(f.state, before);
  }
});

test("cancellation records the authenticated actor and server time, ignoring forged audit fields", async () => {
  for (const role of ["owner", "cashier"]) {
    const f = orderFixture(role), route = f.load("app/api/orders/[id]/route.ts");
    const before = Date.now();
    const response = await route.PATCH(request({ status: "cancelled", cancellationReason: "  วัตถุดิบหมด  ",
      cancelledBy: "forged", cancelledByLabel: "forged", cancelledAt: "1990-01-01" }), params("order-a"));
    assert.equal(response.status, 200);
    const order = f.state.orders[0];
    assert.equal(order.cancelledBy, role);
    assert.equal(order.cancelledByLabel, f.user.email);
    assert.equal(order.cancellationReason, "วัตถุดิบหมด");
    assert.ok(order.cancelledAt.getTime() >= before && order.cancelledAt.getTime() <= Date.now());
    const audit = structuredClone(order);
    assert.equal((await route.PATCH(request({ status: "cancelled", cancellationReason: "เปลี่ยนเหตุผล" }), params("order-a"))).status, 409);
    assert.deepEqual(f.state.orders[0], audit);
  }
});

test("paid, delivered, foreign and kitchen cancellation attempts cannot create audit records", async () => {
  for (const kind of ["paid", "delivered", "foreign", "kitchen"]) {
    const f = orderFixture(kind === "kitchen" ? "kitchen" : "owner");
    if (kind === "paid") f.state.orders[0].paymentStatus = "paid";
    if (kind === "delivered") f.state.orders[0].deliveredAt = new Date();
    if (kind === "foreign") f.state.orders[0].storeId = "shop-b";
    const before = structuredClone(f.state);
    const response = await f.load("app/api/orders/[id]/route.ts").PATCH(request({ status: "cancelled", cancellationReason: "reason" }), params("order-a"));
    assert.equal(response.status, kind === "kitchen" ? 403 : kind === "foreign" ? 404 : 409);
    assert.deepEqual(f.state, before);
  }
});

test("cancellation audit is shown to frontdesk but hidden from customer order status", async () => {
  const f = orderFixture("owner");
  Object.assign(f.state.orders[0], { tableNumber: 1, status: "cancelled", cancelledBy: "private-user", cancelledByLabel: "private@example.com",
    cancelledAt: new Date(), cancellationReason: "private note", createdAt: new Date() });
  const bills = f.load("lib/bills-server.ts").buildBills(f.state.orders, f.state.tables);
  assert.equal(bills[0].orders[0].cancelledByLabel, "private@example.com");
  const response = await f.load("app/api/orders/[id]/route.ts").GET(new Request("http://localhost/api/orders/order-a?token=token-a"), params("order-a"));
  assert.equal(response.status, 200);
  const body = await response.text();
  for (const value of ["private-user", "private@example.com", "private note", "cancelledAt"]) assert.equal(body.includes(value), false);
});
