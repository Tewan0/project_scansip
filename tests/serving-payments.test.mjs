import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request, params } from "./helpers.mjs";

function setup(role = "cashier", overrides = {}) {
  const f = fixture(role);
  const id = "11111111-1111-4111-8111-111111111111";
  f.state.tables.push({ id: "table-a", storeId: "shop-a", tableNumber: 1, status: "occupied", currentSessionToken: "round-a", sessionStartedAt: new Date() });
  f.state.orders.push({ id, storeId: "shop-a", tableId: "table-a", tableNumber: 1, sessionToken: "round-a", orderNumber: "#A",
    status: "served", paymentStatus: "unpaid", servingRequired: true, deliveredAt: null, totalAmount: "70.50", createdAt: new Date(), customerNote: null, ...overrides });
  f.state.orderItems.push({ id: "line-a", orderId: id, status: "ready", menuName: "Coffee", quantity: 1, unitPrice: "70.50" });
  const identity = f.load("lib/bills-server.ts").billIdentity(f.state.orders[0]);
  return { ...f, id, identity,
    pay: (extra = {}) => f.load("app/api/bills/[id]/payment/route.ts").POST(request({ anchorOrderId: id, expectedOrderIds: [id], expectedTotalCents: 7050, method: "cash", receivedCents: 10000, ...extra }), params(identity.id)),
    update: body => f.load("app/api/orders/[id]/route.ts").PATCH(request(body), params(id)),
    close: () => f.load("app/api/tables/route.ts").POST(request({ action: "close_session", tableNumber: 1 })),
  };
}

test("cash receipt stores one payment and exact change; paid food cannot close before delivery", async () => {
  const f = setup();
  const paid = await f.pay(); assert.equal(paid.status, 200); assert.equal((await paid.json()).data.changeCents, 2950);
  assert.equal(f.state.billPayments.length, 1); assert.equal(f.state.billPayments[0].method, "cash");
  assert.equal(f.state.billPayments[0].receivedBy, "cashier"); assert.equal(f.state.orders[0].paymentId, f.state.billPayments[0].id);
  assert.equal(f.state.orders[0].status, "served");
  const blocked = await f.close(); assert.equal(blocked.status, 409); assert.match((await blocked.json()).error, /เสิร์ฟ/);
  assert.equal((await f.pay()).status, 409); assert.equal(f.state.billPayments.length, 1);
  assert.equal((await f.update({ delivered: true })).status, 200);
  assert.equal(f.state.orders[0].status, "completed"); const time = f.state.orders[0].deliveredAt;
  assert.equal((await f.update({ delivered: true })).status, 200); assert.equal(f.state.orders[0].deliveredAt.getTime(), time.getTime());
  assert.equal((await f.close()).status, 200);
});

test("serve before payment preserves unpaid balance, blocks cancellation, then transfer completes", async () => {
  const f = setup(); assert.equal((await f.update({ delivered: true })).status, 200);
  assert.equal(f.state.orders[0].paymentStatus, "unpaid"); assert.equal((await f.close()).status, 409);
  assert.equal((await f.update({ status: "cancelled" })).status, 409);
  assert.equal((await f.pay({ method: "transfer", receivedCents: 7050 })).status, 200);
  assert.equal(f.state.billPayments[0].changeCents, 0); assert.equal(f.state.orders[0].status, "completed");
  assert.equal((await f.close()).status, 200);
});

test("cash validation rejects underpayment, fractions, overflow and invalid methods without a receipt", async () => {
  for (const extra of [{ receivedCents: 7049 }, { receivedCents: 10000.5 }, { receivedCents: -1 }, { receivedCents: 2_000_000_001 },
    { receivedCents: "10000" }, { method: "unknown" }, { method: "transfer", receivedCents: 10000 }]) {
    const f = setup(); assert.equal((await f.pay(extra)).status, 400);
    assert.equal(f.state.billPayments.length, 0); assert.equal(f.state.orders[0].paymentStatus, "unpaid");
  }
});

test("only frontdesk/owner can deliver; unfinished, cancelled and foreign orders are rejected", async () => {
  assert.equal((await setup("kitchen").update({ delivered: true })).status, 403);
  assert.equal((await setup("anonymous").update({ delivered: true })).status, 401);
  for (const status of ["pending", "preparing", "cancelled"]) assert.equal((await setup("cashier", { status }).update({ delivered: true })).status, 409);
  assert.equal((await setup("cashier", { storeId: "shop-b" }).update({ delivered: true })).status, 404);
  assert.equal((await setup().update({ delivered: true, paymentStatus: "paid" })).status, 403);
  assert.equal((await setup().update({ paymentStatus: "paid" })).status, 400);
});

test("prepay -> cook -> deliver -> close requires all steps and exposes delivery in customer history", async () => {
  const f = setup("owner", { status: "pending" }); f.state.orderItems[0].status = "pending";
  assert.equal((await f.pay()).status, 200); assert.equal((await f.close()).status, 409);
  assert.equal((await f.update({ finishAll: true })).status, 200); assert.equal((await f.close()).status, 409);
  assert.equal((await f.update({ delivered: true })).status, 200);
  const history = await f.load("app/api/customer/session/route.ts").GET(new Request("http://localhost/api/customer/session?store=cafe-a&table=1", { headers: { Authorization: "Bearer round-a" } }));
  assert.ok((await history.json()).data.orders[0].deliveredAt);
  assert.equal((await f.close()).status, 200);
});

test("legacy orders do not acquire invented delivery times, and receipt history is store-scoped", async () => {
  const f = setup("cashier", { servingRequired: false });
  assert.equal((await f.pay()).status, 200); assert.equal(f.state.orders[0].deliveredAt, null);
  f.state.billPayments.push({ id: "foreign", storeId: "shop-b", billId: f.identity.id, method: "cash", amountCents: 99999, createdAt: new Date() });
  const result = await f.load("app/api/bills/route.ts").GET(new Request("http://localhost/api/bills"));
  const bill = (await result.json()).data[0]; assert.equal(bill.payments.length, 1); assert.equal(bill.payments[0].amountCents, 7050);
  assert.equal(bill.unservedCount, 0); assert.equal((await f.close()).status, 200);
});

test("money parsing avoids fractional-cent rounding and malformed amounts", () => {
  const { parseBaht } = fixture().load("lib/payments.ts");
  assert.equal(parseBaht("70.50"), 7050); assert.equal(parseBaht("0.1"), 10); assert.equal(parseBaht(" 100 "), 10000);
  for (const value of ["", "-1", "10.999", "1e3", "100,00", "NaN", "20000001"]) assert.equal(parseBaht(value), null);
});

test("new customer orders opt into delivery even though old deployments keep the legacy database default", async () => {
  const f = setup("anonymous");
  const menuId = "22222222-2222-4222-8222-222222222222";
  f.state.menuItems.push({ id: menuId, storeId: "shop-a", name: "Tea", price: "35.00", isAvailable: true });
  const response = await f.load("app/api/orders/route.ts").POST(request({ storeSlug: "cafe-a", tableNumber: 1, sessionToken: "round-a", servingRequired: false, items: [{ menuItemId: menuId, quantity: 1 }] }));
  assert.equal(response.status, 201); assert.equal(f.state.orders.at(-1).servingRequired, true); assert.equal(f.state.orders.at(-1).deliveredAt, null);
});
