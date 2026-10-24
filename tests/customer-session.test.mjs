import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request, params } from "./helpers.mjs";

const requestId = "11111111-1111-4111-8111-111111111111";
function setup(role = "anonymous") {
  const f = fixture(role);
  f.state.tables.push({ id: "table-a", storeId: "shop-a", tableNumber: 1, status: "occupied", currentSessionToken: "round-a", sessionStartedAt: new Date() },
    { id: "table-b", storeId: "shop-a", tableNumber: 2, status: "occupied", currentSessionToken: "round-b", sessionStartedAt: new Date() },
    { id: "table-other", storeId: "shop-b", tableNumber: 1, status: "occupied", currentSessionToken: "round-other", sessionStartedAt: new Date() });
  f.state.orders.push(...[
    ["current", "shop-a", "table-a", "round-a"], ["old", "shop-a", "table-a", "round-old"],
    ["other-table", "shop-a", "table-b", "round-b"], ["other-shop", "shop-b", "table-other", "round-other"],
  ].map(([id, storeId, tableId, sessionToken]) => ({ id, storeId, tableId, sessionToken, orderNumber: id, status: "preparing", paymentStatus: "unpaid", totalAmount: "150.00", createdAt: new Date() })));
  f.state.orderItems.push({ id: "line-a", orderId: "current", menuName: "ชา", quantity: 2, unitPrice: "75.00", status: "preparing", specialInstruction: "หวานน้อย" });
  return f;
}
const getRequest = (token = "round-a", store = "cafe-a", table = "1") => new Request(`http://localhost/api/customer/session?store=${store}&table=${table}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
const input = { storeSlug: "cafe-a", tableNumber: 1, sessionToken: "round-a", kind: "assistance" };

test("customer history reloads every order in exactly the active store/table/QR round, without tokens", async () => {
  const f = setup(), route = f.load("app/api/customer/session/route.ts");
  f.state.orders.push({ ...f.state.orders[0], id: "second", status: "cancelled" });
  for (let reload = 0; reload < 2; reload++) {
    const res = await route.GET(getRequest());
    assert.equal(res.status, 200); assert.match(res.headers.get("cache-control"), /no-store/);
    const body = await res.json();
    assert.deepEqual(body.data.orders.map(order => order.id), ["current", "second"]);
    assert.equal(body.data.orders[0].items[0].status, "preparing");
    assert.equal(JSON.stringify(body).includes("round-a"), false);
    assert.equal("storeId" in body.data.orders[0], false);
  }
});

test("missing, wrong, old, cross-table and cross-store QR tokens cannot read history or send requests", async () => {
  const f = setup(), history = f.load("app/api/customer/session/route.ts"), send = f.load("app/api/customer/requests/route.ts");
  for (const [token, store, table] of [["", "cafe-a", "1"], ["round-old", "cafe-a", "1"], ["round-a", "cafe-a", "2"], ["round-a", "cafe-b", "1"]]) {
    assert.equal((await history.GET(getRequest(token, store, table))).status, 403);
    assert.equal((await send.POST(request({ ...input, sessionToken: token, storeSlug: store, tableNumber: Number(table) }))).status, 403);
  }
  f.state.tables[0].status = "available";
  assert.equal((await history.GET(getRequest())).status, 403);
  assert.equal((await send.POST(request(input))).status, 403);
  assert.equal(f.state.serviceRequests.length, 0);
});

test("repeated calls reuse a pending request, bill requests stay separate and never change payment", async () => {
  const f = setup(), route = f.load("app/api/customer/requests/route.ts");
  const first = await (await route.POST(request(input))).json();
  const repeated = await (await route.POST(request(input))).json();
  assert.equal(first.data.id, repeated.data.id);
  assert.equal("sessionToken" in first.data, false);
  const bill = await route.POST(request({ ...input, kind: "bill", status: "resolved", storeId: "shop-b" }));
  assert.equal(bill.status, 200); assert.equal(f.state.serviceRequests.length, 2);
  assert.ok(f.state.serviceRequests.every(row => row.storeId === "shop-a" && row.status === "pending"));
  assert.equal(f.state.orders[0].paymentStatus, "unpaid");
  assert.equal(f.state.tables[0].status, "occupied");
});

test("invalid request kinds fail and recently resolved calls are throttled", async () => {
  const f = setup(), route = f.load("app/api/customer/requests/route.ts");
  assert.equal((await route.POST(request({ ...input, kind: "pay" }))).status, 400);
  await route.POST(request(input));
  f.state.serviceRequests[0].status = "resolved";
  assert.equal((await route.POST(request(input))).status, 429);
  f.state.serviceRequests[0].createdAt = new Date(Date.now() - 60_000);
  assert.equal((await route.POST(request(input))).status, 200);
  assert.equal(f.state.serviceRequests.length, 2);
});

test("only frontdesk and owner can read and resolve their own store requests", async () => {
  for (const role of ["owner", "cashier", "kitchen", "anonymous"]) {
    const f = setup(role);
    const row = { id: requestId, storeId: "shop-a", tableId: "table-a", tableNumber: 1, sessionToken: "round-a", kind: "bill", status: "pending", createdAt: new Date() };
    f.state.serviceRequests.push(row, { ...row, id: "22222222-2222-4222-8222-222222222222", storeId: "shop-b" });
    const get = f.load("app/api/service-requests/route.ts");
    const patch = f.load("app/api/service-requests/[id]/route.ts");
    const allowed = ["owner", "cashier"].includes(role);
    const res = await get.GET();
    assert.equal(res.status, allowed ? 200 : role === "anonymous" ? 401 : 403);
    if (allowed) {
      const body = await res.json(); assert.equal(body.data.length, 1); assert.equal("sessionToken" in body.data[0], false);
      assert.equal((await patch.PATCH(request({ status: "resolved" }), params("22222222-2222-4222-8222-222222222222"))).status, 409);
    }
    const resolved = await patch.PATCH(request({ status: "resolved" }), params(requestId));
    assert.equal(resolved.status, allowed ? 200 : role === "anonymous" ? 401 : 403);
    assert.equal(f.state.serviceRequests[0].status, allowed ? "resolved" : "pending");
    assert.equal(f.state.serviceRequests[1].status, "pending");
    assert.equal(f.state.orders[0].paymentStatus, "unpaid");
  }
});

test("closing a table resolves only requests for that round; reopening cannot expose old history", async () => {
  const f = setup("cashier"); f.state.orders = [];
  f.state.serviceRequests.push({ id: requestId, storeId: "shop-a", tableId: "table-a", sessionToken: "round-a", kind: "bill", status: "pending" },
    { id: "other", storeId: "shop-a", tableId: "table-b", sessionToken: "round-b", kind: "bill", status: "pending" });
  const tables = f.load("app/api/tables/route.ts");
  assert.equal((await tables.POST(request({ action: "close_session", tableNumber: 1 }))).status, 200);
  assert.equal(f.state.serviceRequests[0].status, "resolved");
  assert.equal(f.state.serviceRequests[1].status, "pending");
  const history = f.load("app/api/customer/session/route.ts");
  assert.equal((await history.GET(getRequest())).status, 403);
  await tables.POST(request({ action: "open_session", tableNumber: 1 }));
  const nextToken = f.state.tables[0].currentQrToken;
  assert.notEqual(nextToken, "round-a");
  assert.equal((await history.GET(getRequest())).status, 403);
  const fresh = await (await history.GET(getRequest(nextToken))).json();
  assert.equal(fresh.data.orders.length, 0); assert.equal(fresh.data.requests.length, 0);
});

test("customer item labels respect cancellation and totals exclude cancelled and already-paid amounts", () => {
  const { customerItemStatus, sessionTotals } = fixture().load("lib/customer-session-view.ts");
  assert.equal(customerItemStatus("preparing", "ready"), "ทำเสร็จแล้ว");
  assert.equal(customerItemStatus("cancelled", "ready"), "ยกเลิกแล้ว");
  assert.equal(customerItemStatus("completed", "pending"), "เสร็จสิ้น");
  const totals = sessionTotals([{ status: "preparing", paymentStatus: "unpaid", totalAmount: "10.10" },
    { status: "served", paymentStatus: "unpaid", totalAmount: "20.20" },
    { status: "cancelled", paymentStatus: "unpaid", totalAmount: "999" },
    { status: "completed", paymentStatus: "paid", totalAmount: "30.30" }]);
  assert.equal(totals.total, 60.6); assert.equal(totals.unpaid, 30.3);
});
