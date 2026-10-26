import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, request, params } from "./helpers.mjs";
const lifetime = 86_400_000, start = 1_800_000_000_000;
const product = "11111111-1111-4111-8111-111111111111";
function setup(role = "owner") {
  let now = start, providerCalls = 0, duringAnswer = () => {};
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const f = fixture(role, { "@/lib/customer-ai": {
    CustomerAiError: class extends Error {},
    validateMessages: input => input,
    async answerMenuQuestion() { providerCalls++; duringAnswer(); return { answer: "Coffee", recommendations: [] }; },
  } }, { Date: Clock, process: { env: { GEMINI_AI_API_KEY: "mock-only" } }, TextEncoder });
  f.state.tables.push({ id: "table-a", storeId: "shop-a", tableNumber: 1, status: "available", currentSessionToken: null, sessionStartedAt: null, currentQrToken: null, qrExpiresAt: null });
  f.state.menuItems.push({ id: product, storeId: "shop-a", name: "Coffee", price: "50.00", isAvailable: true });
  const tables = f.load("app/api/tables/route.ts");
  const act = (action, extra = {}) => tables.POST(request({ action, tableNumber: 1, ...extra }));
  const validate = token => f.load("app/api/tables/validate/route.ts").GET(new Request("http://localhost/api/tables/validate?store=cafe-a&table=1&token=" + token));
  const history = token => f.load("app/api/customer/session/route.ts").GET(new Request("http://localhost/api/customer/session?store=cafe-a&table=1", { headers: { Authorization: "Bearer " + token } }));
  const order = (token, requestId = randomUUID()) => f.load("app/api/orders/route.ts").POST(request({ storeSlug: "cafe-a", tableNumber: 1, sessionToken: token, requestId, items: [{ menuItemId: product, quantity: 1 }] }));
  const service = token => f.load("app/api/customer/requests/route.ts").POST(request({ storeSlug: "cafe-a", tableNumber: 1, sessionToken: token, kind: "assistance" }));
  const chat = token => f.load("app/api/customer/chat/route.ts").POST(new Request("http://localhost/api/customer/chat", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ storeSlug: "cafe-a", tableNumber: 1, messages: [{ role: "user", content: "Coffee?" }] }) }));
  return { ...f, act, validate, history, order, service, chat, tables, setTime(value) { now = value; },
    providerCalls: () => providerCalls, duringAnswer(fn) { duringAnswer = fn; } };
}

test("opening creates a separate 24-hour QR; GET and repeated open never extend its expiry", async () => {
  const f = setup(); const first = await f.act("open_session"); assert.equal(first.status, 200);
  const opened = (await first.json()).data;
  assert.notEqual(opened.currentQrToken, opened.currentSessionToken);
  assert.match(opened.currentQrToken, /^qr_[0-9a-f]{64}$/);
  assert.equal(Date.parse(opened.qrExpiresAt), start + lifetime);
  f.setTime(start + 30_000);
  await f.tables.GET();
  const repeated = (await (await f.act("open_session")).json()).data;
  assert.deepEqual(repeated, opened);
  const valid = await f.validate(opened.currentQrToken);
  assert.equal(valid.headers.get("cache-control"), "private, no-store");
  const json = await valid.json(); assert.equal(json.valid, true); assert.equal(json.table.qrExpiresAt, opened.qrExpiresAt);
  assert.equal(JSON.stringify(json).includes(opened.currentSessionToken), false);
  assert.equal((await f.order(opened.currentSessionToken)).status, 403, "bill round ID is not a QR credential");
});

test("QR works just before 24 hours and fails at the exact boundary without changing orders or bills", async () => {
  const f = setup(); await f.act("open_session"); const token = f.state.tables[0].currentQrToken;
  f.setTime(start + lifetime - 1); assert.equal((await f.order(token)).status, 201);
  const before = structuredClone(f.state);
  f.setTime(start + lifetime);
  const validation = await (await f.validate(token)).json();
  assert.equal(validation.valid, false); assert.equal(validation.reason, "qr_expired");
  for (const action of [f.order, f.history, f.service, f.chat]) {
    const response = await action(token); assert.equal(response.status, 403);
    assert.equal((await response.json()).sessionExpired, true);
  }
  const orderResponse = await f.load("app/api/orders/[id]/route.ts").GET(new Request("http://localhost?token=" + token), params(f.state.orders[0].id));
  assert.equal(orderResponse.status, 403); assert.equal(f.providerCalls(), 0);
  assert.deepEqual(structuredClone(f.state), before);
  assert.equal(f.state.tables[0].status, "occupied"); assert.equal(f.state.orders[0].paymentStatus, "unpaid");
});

test("renewal invalidates old QR but keeps the same bill, payment records, requests and retry identity", async () => {
  const f = setup(); await f.act("open_session"); const original = structuredClone(f.state.tables[0]);
  const requestId = randomUUID(); const first = await (await f.order(original.currentQrToken, requestId)).json();
  f.state.orders[0].createdAt = new Date(start); f.state.orders[0].customerNote = null;
  await f.service(original.currentQrToken);
  f.state.billPayments.push({ id: "receipt-a", billId: f.load("lib/bills-server.ts").billIdentity(f.state.orders[0]).id, amountCents: 0 });
  const oldOrders = structuredClone(f.state.orders), receipts = structuredClone(f.state.billPayments), pending = structuredClone(f.state.serviceRequests);
  f.setTime(start + lifetime);
  assert.equal((await f.act("renew_qr", { expectedQrToken: original.currentQrToken })).status, 200);
  const renewed = f.state.tables[0]; assert.notEqual(renewed.currentQrToken, original.currentQrToken);
  assert.equal(renewed.currentSessionToken, original.currentSessionToken);
  assert.equal(renewed.sessionStartedAt.getTime(), original.sessionStartedAt.getTime());
  assert.equal(renewed.qrExpiresAt.getTime(), start + 2 * lifetime);
  assert.deepEqual(f.state.orders, oldOrders); assert.deepEqual(f.state.billPayments, receipts); assert.deepEqual(f.state.serviceRequests, pending);
  for (const action of [f.order, f.history, f.service, f.chat]) assert.equal((await action(original.currentQrToken)).status, 403);
  const replay = await (await f.order(renewed.currentQrToken, requestId)).json(); assert.equal(replay.data.id, first.data.id);
  assert.equal(f.state.orders.length, 1);
  assert.equal((await f.order(renewed.currentQrToken)).status, 201); f.state.orders[1].createdAt = new Date(start + lifetime);
  assert.equal(f.state.orders[1].sessionToken, original.currentSessionToken);
  const bills = f.load("lib/bills-server.ts").buildBills(f.state.orders, f.state.tables);
  assert.equal(bills.length, 1); assert.equal(bills[0].current, true); assert.equal(bills[0].totalCents, 10000);
  assert.equal(bills[0].id, receipts[0].billId);
  const history = await (await f.history(renewed.currentQrToken)).json(); assert.equal(history.data.orders.length, 2); assert.equal(history.data.requests.length, 1);
  const oldTicket = await f.load("app/api/orders/[id]/route.ts").GET(new Request("http://localhost?token=" + renewed.currentQrToken), params(first.data.id));
  assert.equal(oldTicket.status, 200); assert.equal((await oldTicket.json()).data.sessionToken, undefined);
});

test("only the store owner/cashier may renew; stale screens and duplicate requests cannot rotate twice", async () => {
  for (const role of ["owner", "cashier", "kitchen", "anonymous", "new-user", "owner-b"]) {
    const f = setup(); await f.act("open_session"); const token = f.state.tables[0].currentQrToken;
    if (["cashier", "kitchen"].includes(role)) f.state.staff.push({ id: role, storeId: "shop-a", userId: role, role });
    f.context.user = role === "anonymous" ? null : { id: role, email: "staff@example.com", email_confirmed_at: "2026-01-01" };
    const before = structuredClone(f.state);
    const response = await f.act("renew_qr", { expectedQrToken: token });
    if (["owner", "cashier"].includes(role)) {
      assert.equal(response.status, 200); const next = f.state.tables[0].currentQrToken;
      assert.equal((await f.act("renew_qr", { expectedQrToken: token })).status, 409);
      assert.equal(f.state.tables[0].currentQrToken, next);
    } else { assert.ok([401, 403, 404].includes(response.status)); assert.deepEqual(structuredClone(f.state), before); }
  }
  const f = setup();
  assert.equal((await f.act("renew_qr", { expectedQrToken: "wrong" })).status, 409);
  await f.act("open_session"); assert.equal((await f.act("renew_qr")).status, 409);
});

test("legacy QR expires from its original opening time; missing dates fail closed and can be renewed", async () => {
  for (const started of [new Date(start), null, new Date("invalid")]) {
    const f = setup(); Object.assign(f.state.tables[0], { status: "occupied", currentSessionToken: "legacy", sessionStartedAt: started });
    if (started?.getTime() === start) {
      f.setTime(start + lifetime - 1); assert.equal((await (await f.validate("legacy")).json()).valid, true);
    }
    f.setTime(start + lifetime); assert.equal((await f.order("legacy")).status, 403);
    assert.equal((await (await f.validate("legacy")).json()).reason, "qr_expired");
    assert.equal((await f.act("renew_qr", { expectedQrToken: "legacy" })).status, 200);
    assert.equal((await f.order(f.state.tables[0].currentQrToken)).status, 201);
    assert.equal(f.state.orders[0].sessionToken, "legacy");
  }
});

test("expiry never prevents kitchen, payment, serving or a valid staff table close", async () => {
  const f = setup(); await f.act("open_session"); const token = f.state.tables[0].currentQrToken;
  await f.order(token); const ticket = f.state.orders[0]; ticket.createdAt = new Date(start);
  const oldId = ticket.id; ticket.id = randomUUID(); f.state.orderItems.filter(line => line.orderId === oldId).forEach(line => { line.orderId = ticket.id; });
  f.setTime(start + lifetime);
  assert.equal((await f.act("close_session", { expectedSessionToken: f.state.tables[0].currentSessionToken })).status, 409, "unpaid/unfinished bills still block closing");
  const id = ticket.id, update = f.load("app/api/orders/[id]/route.ts").PATCH;
  assert.equal((await update(request({ finishAll: true }), params(id))).status, 200);
  assert.equal((await update(request({ delivered: true }), params(id))).status, 200);
  const bill = f.load("lib/bills-server.ts").billIdentity(f.state.orders[0]);
  assert.equal((await f.load("app/api/bills/[id]/payment/route.ts").POST(request({ anchorOrderId: id, expectedOrderIds: [id], expectedTotalCents: 5000, method: "cash", receivedCents: 5000 }), params(bill.id))).status, 200);
  assert.equal((await f.act("close_session", { expectedSessionToken: f.state.tables[0].currentSessionToken })).status, 200);
  assert.equal(f.state.tables[0].currentQrToken, null); assert.equal(f.state.tables[0].qrExpiresAt, null);
  assert.equal((await (await f.validate(token)).json()).valid, false);
  await f.act("open_session"); assert.notEqual(f.state.tables[0].currentQrToken, token);
  const history = await (await f.history(f.state.tables[0].currentQrToken)).json(); assert.equal(history.data.orders.length, 0);
});

test("rotating QR cannot reset chatbot or order quotas", async () => {
  const f = setup(); await f.act("open_session"); let token = f.state.tables[0].currentQrToken;
  assert.equal((await f.chat(token)).status, 200);
  const chatRows = f.state.chatRateLimits.filter(row => !row.id.startsWith("write:"));
  const chatBefore = structuredClone(chatRows);
  for (let i = 0; i < 6; i++) assert.equal((await f.order(token)).status, 201);
  assert.equal((await f.act("renew_qr", { expectedQrToken: token })).status, 200); token = f.state.tables[0].currentQrToken;
  assert.equal((await f.order(token)).status, 429); assert.equal((await f.chat(token)).status, 429);
  assert.deepEqual(f.state.chatRateLimits.filter(row => !row.id.startsWith("write:")), chatBefore);
  assert.equal(f.providerCalls(), 1);
});

test("AI answer is discarded if QR expires while waiting for the provider", async () => {
  const f = setup(); await f.act("open_session");
  f.duringAnswer(() => f.setTime(start + lifetime));
  assert.equal((await f.chat(f.state.tables[0].currentQrToken)).status, 403);
  assert.equal(f.providerCalls(), 1);
});

test("QR remains usable after the former two-hour limit and before the 24-hour deadline", async () => {
  const f = setup(); await f.act("open_session"); const token = f.state.tables[0].currentQrToken;
  f.setTime(start + 2 * 60 * 60 * 1000 + 1);
  assert.equal((await (await f.validate(token)).json()).valid, true);
  assert.equal((await f.order(token)).status, 201);
  assert.equal((await f.history(token)).status, 200);
  assert.equal((await f.service(token)).status, 200);
  assert.equal((await f.chat(token)).status, 200);
  f.setTime(start + lifetime);
  assert.equal((await f.order(token)).status, 403);
  assert.equal((await (await f.validate(token)).json()).reason, "qr_expired");
  assert.equal(f.state.orders.length, 1);
  assert.equal(f.state.tables[0].status, "occupied");
});
