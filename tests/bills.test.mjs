import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request, params } from "./helpers.mjs";

const id = number => `11111111-1111-4111-8111-${String(number).padStart(12, "0")}`;
function setup(role = "cashier") {
  const f = fixture(role);
  f.state.tables.push({ id: "table-6", storeId: "shop-a", tableNumber: 6, status: "occupied", currentSessionToken: "new-round", sessionStartedAt: new Date("2026-10-20T13:40:00Z") });
  function add(n, token, amount, overrides = {}) {
    const order = { id: id(n), storeId: "shop-a", tableId: "table-6", tableNumber: 6, sessionToken: token, orderNumber: "#" + n,
      status: "served", paymentStatus: "unpaid", totalAmount: amount, customerNote: "note", createdAt: new Date(`2026-10-20T13:${token === "new-round" ? "4" : "1"}${n % 10}:00Z`), ...overrides };
    f.state.orders.push(order);
    f.state.orderItems.push({ id: "line-" + n, orderId: order.id, menuName: "Tea", quantity: 1, unitPrice: amount, status: "ready" });
    return order;
  }
  add(1, "old-round", "100.00", { status: "completed", paymentStatus: "paid" });
  add(2, "old-round", "70.00", { status: "completed", paymentStatus: "paid" });
  add(3, "new-round", "20.00"); add(4, "new-round", "40.00"); add(5, "new-round", "10.00");
  const bills = f.load("lib/bills-server.ts");
  const get = async (query = "") => f.load("app/api/bills/route.ts").GET(new Request("http://localhost/api/bills" + query));
  const bill = () => bills.buildBills(f.state.orders, f.state.tables).find(b => b.current);
  const pay = (snapshot = bill(), extra = {}) => f.load("app/api/bills/[id]/payment/route.ts").POST(request({
    anchorOrderId: snapshot.anchorOrderId, expectedOrderIds: snapshot.unpaidOrderIds, expectedTotalCents: snapshot.unpaidCents, method: "cash", receivedCents: snapshot.unpaidCents, ...extra,
  }), params(snapshot.id));
  return { ...f, add, get, bill, pay, bills };
}

test("one table's two rounds form two bills; current includes all repeat orders, history keeps the older round", async () => {
  const f = setup();
  const current = await (await f.get()).json(), history = await (await f.get("?view=history")).json();
  assert.equal(current.data.length, 1); assert.equal(current.data[0].orders.length, 3);
  assert.equal(current.data[0].totalCents, 7000); assert.equal(current.data[0].unpaidCents, 7000);
  assert.equal(current.data[0].orders[0].items.length, 1);
  assert.equal(history.data.length, 1); assert.equal(history.data[0].orders.length, 2); assert.equal(history.data[0].totalCents, 17000);
  assert.notEqual(current.data[0].number, history.data[0].number);
  assert.equal(current.currentCount, 1); assert.equal(current.historyCount, 1);
  assert.equal(JSON.stringify(current).includes("new-round"), false);
  const before = current.data[0].number; f.add(6, "new-round", "15.00");
  assert.equal((await (await f.get()).json()).data[0].number, before);
});

test("paid current rounds remain current until closing; reopen creates a new empty bill and preserves history", async () => {
  const f = setup(); const snapshot = f.bill(); assert.equal((await f.pay(snapshot)).status, 200);
  const paid = (await (await f.get()).json()).data[0]; assert.equal(paid.unpaidCents, 0); assert.equal(paid.current, true);
  const tables = f.load("app/api/tables/route.ts");
  assert.equal((await tables.POST(request({ action: "close_session", tableNumber: 6 }))).status, 200);
  assert.equal((await (await f.get()).json()).data.length, 0);
  assert.equal((await (await f.get("?view=history")).json()).data.length, 2);
  await tables.POST(request({ action: "open_session", tableNumber: 6 }));
  const next = (await (await f.get()).json()).data[0]; assert.equal(next.orders.length, 0); assert.notEqual(next.id, snapshot.id);
});

test("bill totals exclude cancellation and already-paid amounts; grouped payment updates only unpaid orders", async () => {
  const f = setup(); f.state.orders[2].paymentStatus = "paid";
  f.state.orders[4].status = "cancelled";
  const snapshot = f.bill(); assert.equal(snapshot.totalCents, 6000); assert.equal(snapshot.paidCents, 2000); assert.equal(snapshot.unpaidCents, 4000);
  const result = await f.pay(snapshot); assert.equal(result.status, 200); assert.equal((await result.json()).data.paidOrderCount, 1);
  assert.equal(f.state.orders[3].paymentStatus, "paid"); assert.equal(f.state.orders[3].status, "completed");
  assert.equal(f.state.orders[4].status, "cancelled"); assert.equal(f.state.orders[4].paymentStatus, "unpaid");
  assert.equal((await f.pay(snapshot)).status, 409);
});

test("a new order, cancelled order or prior payment after review rejects stale bulk payment without partial writes", async () => {
  for (const change of [f => f.add(6, "new-round", "10.00"), f => { f.state.orders[3].status = "cancelled"; }, f => { f.state.orders[3].paymentStatus = "paid"; }]) {
    const f = setup(), snapshot = f.bill(); change(f); const before = structuredClone(f.state.orders);
    assert.equal((await f.pay(snapshot)).status, 409); assert.deepEqual(f.state.orders, before);
  }
  const f = setup(); assert.equal((await f.pay(f.bill(), { expectedTotalCents: 1 })).status, 409);
  assert.equal(f.state.orders[2].paymentStatus, "unpaid");
});

test("bulk receipt never marks unfinished food complete and table close remains blocked", async () => {
  const f = setup(); f.state.orders[2].status = "preparing";
  assert.equal((await f.pay()).status, 200); assert.equal(f.state.orders[2].status, "preparing");
  assert.equal((await f.load("app/api/tables/route.ts").POST(request({ action: "close_session", tableNumber: 6 }))).status, 409);
});

test("bill endpoints enforce staff roles and store scope; unrelated or forged anchors cannot receive money", async () => {
  for (const role of ["anonymous", "kitchen"]) {
    const f = setup(role), expected = role === "anonymous" ? 401 : 403;
    assert.equal((await f.get()).status, expected); assert.equal((await f.pay()).status, expected);
  }
  const f = setup(); const foreign = f.add(6, "foreign-round", "300.00", { storeId: "shop-b" });
  const foreignIdentity = f.bills.billIdentity(foreign);
  const response = await f.load("app/api/bills/[id]/payment/route.ts").POST(request({ anchorOrderId: foreign.id, expectedOrderIds: [foreign.id], expectedTotalCents: 30000, method: "transfer", receivedCents: 30000 }), params(foreignIdentity.id));
  assert.equal(response.status, 404);
  assert.equal((await f.pay(f.bill(), { anchorOrderId: f.state.orders[0].id })).status, 404);
  assert.equal((await f.pay(f.bill(), { anchorOrderId: "not-a-uuid" })).status, 400);
  assert.equal(JSON.stringify(await (await f.get("?view=history")).json()).includes("300.00"), false);
});

test("legacy orders never merge without round tokens and deleted table rows do not change bill numbers", () => {
  const f = setup(); const oldId = f.bills.billIdentity(f.state.orders[0]).id;
  f.state.orders[0].tableId = null; assert.equal(f.bills.billIdentity(f.state.orders[0]).id, oldId);
  f.add(7, null, "10.00"); f.add(8, null, "15.00");
  const old = f.bills.buildBills(f.state.orders, f.state.tables).filter(bill => !bill.current);
  assert.equal(old.length, 3); assert.equal(new Set(old.map(bill => bill.id)).size, 3);
});

test("history pagination never truncates rounds and table/date filters use Bangkok dates", async () => {
  const f = setup();
  for (let n = 10; n < 35; n++) f.add(n, "round-" + n, "1.00");
  for (let n = 100; n < 305; n++) f.add(n, "old-round", "1.00");
  const first = await (await f.get("?view=history")).json(), second = await (await f.get("?view=history&page=2")).json();
  assert.equal(first.pageCount, 2); assert.equal(first.data.length + second.data.length, 26);
  const old = [...first.data, ...second.data].find(bill => bill.orders.some(order => order.id === id(1)));
  assert.equal(old.orders.length, 207); assert.equal(old.totalCents, 37500);
  assert.equal((await (await f.get("?table=5")).json()).data.length, 0);
  assert.equal((await (await f.get("?date=2026-10-20")).json()).data.length, 1);
  assert.equal((await (await f.get("?date=2026-10-19")).json()).data.length, 0);
});

test("kitchen tickets remain separate but carry the same bill number as the frontdesk round", async () => {
  const f = setup("kitchen"); const round = f.bill();
  const kitchen = await (await f.load("app/api/orders/route.ts").GET()).json();
  assert.equal(kitchen.data.length, 3);
  assert.ok(kitchen.data.every(order => order.billNumber === round.number));
  assert.equal("sessionToken" in kitchen.data[0], false); assert.equal("paymentStatus" in kitchen.data[0], false);
});


test("bill index reads only grouping metadata and loads full orders only for the displayed page", async () => {
  const f = setup(), calls = [], find = f.db.query.orders.findMany;
  for (let n = 10; n < 40; n++) f.add(n, "round-" + n, "1");
  f.db.query.orders.findMany = async options => { const rows = await find(options); calls.push({ options, rows }); return rows; };
  const data = (await (await f.get("?view=history&page=2")).json()).data;
  assert.deepEqual(Object.keys(calls[0].options.columns).sort(), ["createdAt", "id", "sessionToken", "storeId", "tableNumber"]);
  assert.equal(calls.length, 2);
  const shown = data.flatMap(bill => bill.orders.map(order => order.id)).sort();
  assert.deepEqual(calls[1].rows.map(row => row.id).sort(), shown);
  assert.ok(calls[1].rows.length < calls[0].rows.length);
});
