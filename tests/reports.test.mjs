import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request, params } from "./helpers.mjs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ["2026-01-01T17:30:00Z"])); }
  static now() { return Date.parse("2026-01-01T17:30:00Z"); }
}
function setup() {
  const f = fixture("owner", {}, { Date: FixedDate });
  f.state.orders.push(
    { id: "yesterday", storeId: "shop-a", createdAt: "2026-01-01T16:59:59Z", totalAmount: "100", status: "completed" },
    { id: "today", storeId: "shop-a", createdAt: "2026-01-01T17:00:00Z", totalAmount: "40", status: "served", servingRequired: true, deliveredAt: null },
    { id: "cancel", storeId: "shop-a", createdAt: "2026-01-01T17:10:00Z", totalAmount: "500", status: "cancelled" },
    { id: "foreign", storeId: "shop-b", createdAt: "2026-01-01T17:10:00Z", totalAmount: "999", status: "completed" },
    { id: "dec", storeId: "shop-a", createdAt: "2025-12-31T16:59:59Z", totalAmount: "70", status: "completed" },
  );
  f.state.orderItems.push({ orderId: "today", menuName: "__proto__", quantity: 1, unitPrice: "40" });
  return f;
}
test("reports split days at Bangkok midnight, exclude cancelled and foreign orders", async () => {
  const f = setup();
  const { data } = await (await f.load("app/api/reports/route.ts").GET(new Request("http://localhost/api/reports?range=7d"))).json();
  assert.equal(data.dailySales.at(-1).dateStr, "2026-01-02");
  assert.equal(data.dailySales.at(-1).rawAmount, 40);
  assert.equal(data.dailySales.at(-2).rawAmount, 100);
  assert.equal(data.totalRevenue, 210);
  assert.equal(data.topItems[0].name, "__proto__");
  assert.equal(data.topItems[0].qty, 1);
});
test("monthly ranges work across year boundary and invalid ranges normalize", async () => {
  const f = setup(), GET = f.load("app/api/reports/route.ts").GET;
  const get = async range => (await (await GET(new Request(`http://localhost/api/reports?range=${range}`))).json()).data;
  assert.equal((await get("month")).totalRevenue, 140);
  const previous = await get("month-1");
  assert.equal(previous.dailySales.length, 31);
  assert.equal(previous.totalRevenue, 70);
  assert.equal(previous.dailySales[0].dateStr, "2025-12-01");
  assert.equal((await get("3m")).dailySales.length, 3);
  assert.equal((await get("invalid")).range, "7d");
});
test("dashboard uses Thai date, negative growth and accurate serving state", async () => {
  const f = setup();
  const { data } = await (await f.load("app/api/dashboard/stats/route.ts").GET()).json();
  assert.equal(data.todaySales, 40);
  assert.equal(data.yesterdaySales, 100);
  assert.equal(data.growthPercent, -60);
  assert.equal(data.chartData.at(-1).sales, 40);
  assert.equal(data.recentOrders.find(o => o.statusKey === "served").status, "รอเสิร์ฟ");
  assert.equal(data.topMenu.name, "__proto__");
});
test("daily bestseller does not fall back to old sales and zero baseline has no fabricated percentage", async () => {
  const f = setup();
  f.state.orders = f.state.orders.filter(o => o.id === "dec");
  f.state.orderItems = [{ orderId: "dec", menuName: "old menu", quantity: 99, unitPrice: "1" }];
  const GET = f.load("app/api/dashboard/stats/route.ts").GET;
  assert.equal((await (await GET()).json()).data.topMenu.count, 0);
  f.state.orders.push({ id: "new", storeId: "shop-a", createdAt: "2026-01-01T17:00:00Z", totalAmount: "40", status: "completed" });
  assert.equal((await (await GET()).json()).data.growthPercent, null);
});
test("CSV preserves Thai, quotes, newlines, hashes and neutralizes formula names", () => {
  const { reportCsv, csvCell } = fixture().load("lib/report-export.ts");
  const csv = reportCsv({ range: "7d", dailySales: [{ dateStr: "2026-01-02", day: "ศ.", rawAmount: 10.5 }], topItems: [{ name: 'ชา "เย็น", #1\nพิเศษ', qty: 1, revenue: "฿10.50" }] });
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes('"ชา ""เย็น"", #1\nพิเศษ"'));
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.ok(csv.includes('"10.5"'));
});


function payment(overrides = {}) {
  return { id: "receipt-a", storeId: "shop-a", billId: "bill-one", method: "cash", amountCents: 15025,
    receivedCents: 50000, changeCents: 34975, receivedBy: "cashier-private",
    createdAt: new Date("2026-01-01T17:00:00Z"), ...overrides };
}
async function report(f, range = "7d") {
  const response = await f.load("app/api/reports/route.ts").GET(new Request("http://localhost/api/reports?range=" + range));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  return (await response.json()).data;
}

test("receipt totals use payment dates and amounts after change, counting each payment once across orders and top-ups", async () => {
  const f = setup();
  f.state.billPayments.push(payment(),
    payment({ id: "top-up", method: "transfer", amountCents: 3050, receivedCents: 3050, changeCents: 0 }),
    payment({ id: "before-midnight", amountCents: 10, createdAt: new Date("2026-01-01T16:59:59.999Z") }),
    payment({ id: "foreign", storeId: "shop-b", amountCents: 999999 }),
    payment({ id: "future", createdAt: new Date("2026-01-02T17:00:00Z") }),
    payment({ id: "too-old", createdAt: new Date("2025-12-26T16:59:59.999Z") }));
  // Several orders point to the same receipt, including one ordered before the report range.
  for (const id of ["yesterday", "dec"]) Object.assign(f.state.orders.find(order => order.id === id), { paymentStatus: "paid", paymentId: "receipt-a" });
  f.state.orders.push({ id: "very-old-order", storeId: "shop-a", createdAt: new Date("2025-01-01T00:00:00Z"), totalAmount: "10", status: "completed", paymentId: "receipt-a", paymentStatus: "paid" });
  const data = await report(f);
  assert.equal(data.totalRevenue, 210, "order sales retain their existing order-date definition");
  assert.deepEqual({ ...data.receipts, periods: undefined }, {
    cashCents: 15035, transferCents: 3050, totalCents: 18085, paymentCount: 3, periods: undefined,
  });
  assert.deepEqual(data.receipts.periods.at(-1), { dateStr: "2026-01-02", cashCents: 15025, transferCents: 3050, totalCents: 18075, paymentCount: 2 });
  assert.equal(data.receipts.periods.at(-2).totalCents, 10);
  assert.equal(data.receipts.periods.length, 7);
  for (const secret of ["cashier-private", "receipt-a", "bill-one", "receivedCents"]) assert.equal(JSON.stringify(data.receipts).includes(secret), false);
});

test("receipt ranges use Bangkok month boundaries and the same selected periods across New Year", async () => {
  const f = setup();
  const times = ["2025-10-31T17:00:00Z", "2025-11-30T16:59:59.999Z", "2025-11-30T17:00:00Z",
    "2025-12-31T16:59:59.999Z", "2025-12-31T17:00:00Z", "2026-01-02T16:59:59.999Z", "2026-01-02T17:00:00Z"];
  f.state.billPayments.push(...times.map((createdAt, i) => payment({ id: String(i), amountCents: i + 1, createdAt: new Date(createdAt) })));
  const current = await report(f, "month");
  assert.equal(current.receipts.totalCents, 11);
  assert.equal(current.receipts.periods.length, 2);
  assert.equal((await report(f, "month-1")).receipts.totalCents, 7);
  assert.equal((await report(f, "month-2")).receipts.totalCents, 3);
  assert.equal((await report(f, "month-3")).receipts.totalCents, 0);
  const quarterly = await report(f, "3m");
  assert.deepEqual(quarterly.receipts.periods.map(period => period.totalCents), [3, 7, 11]);
  assert.equal(quarterly.receipts.totalCents, 21);
  assert.equal(quarterly.receipts.periods[0].dateStr, "พฤศจิกายน 2025");
  const fallback = await report(f, "invalid");
  assert.equal(fallback.range, "7d");
  assert.equal(fallback.receipts.periods.length, 7);
});

test("unpaid orders and legacy paid flags without receipts do not invent received money", async () => {
  const f = setup();
  f.state.orders[0].paymentStatus = "paid";
  const data = await report(f);
  assert.ok(data.totalRevenue > 0);
  assert.equal(data.receipts.totalCents, 0);
  assert.equal(data.receipts.paymentCount, 0);
  assert.ok(data.receipts.periods.every(period => period.cashCents === 0 && period.transferCents === 0));
});

test("receipts remain owner-only and ignore client supplied store identifiers", async () => {
  for (const role of ["anonymous", "cashier", "kitchen"]) {
    const f = fixture(role);
    f.db.query.billPayments.findMany = async () => assert.fail("Unauthorized receipt read");
    const response = await f.load("app/api/reports/route.ts").GET(new Request("http://localhost/api/reports?storeId=shop-a"));
    assert.equal(response.status, role === "anonymous" ? 401 : 403);
    assert.equal(f.writes.length, 0);
  }
  const f = setup();
  f.state.billPayments.push(payment(), payment({ storeId: "shop-b", amountCents: 999999 }));
  const response = await f.load("app/api/reports/route.ts").GET(new Request("http://localhost/api/reports?storeId=shop-b"));
  assert.equal((await response.json()).data.receipts.totalCents, 15025);
});

test("a failed receipt lookup fails the report rather than returning a fabricated zero", async () => {
  const f = setup();
  f.db.query.billPayments.findMany = async () => { throw Error("private database details"); };
  const response = await f.load("app/api/reports/route.ts").GET(new Request("http://localhost/api/reports"));
  assert.equal(response.status, 500);
  const result = await response.json();
  assert.equal(result.success, false);
  assert.equal(result.data, undefined);
  assert.equal(JSON.stringify(result).includes("private database details"), false);
});

test("a real bill payment and later top-up appear once each in receipts despite retrying payment", async () => {
  const f = setup();
  f.state.orders = [{ id: "11111111-1111-4111-8111-111111111111", storeId: "shop-a", tableNumber: 1,
    sessionToken: "round-a", status: "served", paymentStatus: "unpaid", totalAmount: "0.10", createdAt: new Date("2025-01-01T00:00:00Z") }];
  const anchor = f.state.orders[0];
  const bill = f.load("lib/bills-server.ts").billIdentity(anchor);
  const pay = f.load("app/api/bills/[id]/payment/route.ts").POST;
  const input = { anchorOrderId: anchor.id, expectedOrderIds: [anchor.id], expectedTotalCents: 10, method: "cash", receivedCents: 10000 };
  assert.equal((await pay(request(input), params(bill.id))).status, 200);
  assert.equal((await pay(request(input), params(bill.id))).status, 409);
  const second = { ...anchor, id: "22222222-2222-4222-8222-222222222222", paymentStatus: "unpaid", totalAmount: "0.20" };
  f.state.orders.push(second);
  assert.equal((await pay(request({ ...input, expectedOrderIds: [second.id], expectedTotalCents: 20, method: "transfer", receivedCents: 20 }), params(bill.id))).status, 200);
  // Fix the receipt timestamps to exercise reporting independently of the host clock.
  f.state.billPayments.forEach(receipt => { receipt.createdAt = new Date("2026-01-01T17:00:00Z"); });
  const data = await report(f);
  assert.equal(data.totalRevenue, 0, "old orders must not move to the payment date in the sales report");
  assert.equal(data.receipts.cashCents, 10);
  assert.equal(data.receipts.transferCents, 20);
  assert.equal(data.receipts.totalCents, 30);
  assert.equal(data.receipts.paymentCount, 2);
});

test("receipt CSV matches the selected daily or monthly totals with exact two-decimal baht amounts", async () => {
  const f = setup(), { reportCsv } = f.load("lib/report-export.ts");
  f.state.billPayments.push(payment({ amountCents: 10 }), payment({ method: "transfer", amountCents: 20 }));
  for (const range of ["7d", "3m"]) {
    const data = await report(f, range);
    const csv = reportCsv(data);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.ok(csv.includes("ยอดขายตามวันที่สั่ง (รวมที่ยังไม่ชำระ)"));
    assert.ok(csv.includes("ยอดรับเงินจริงตามวันที่รับเงิน (เวลาไทย)"));
    assert.ok(csv.includes('"รวม","0.10","0.20","0.30","2"'));
    assert.ok(csv.includes(range === "3m" ? '"เดือนที่รับเงิน"' : '"วันที่รับเงิน"'));
  }
});

test("receipt summary renders neutral cash/transfer totals, a dated table and an honest empty state", async () => {
  const f = setup();
  const Summary = f.load("components/receipt-summary.tsx").ReceiptSummary;
  let receipts = (await report(f)).receipts;
  let html = renderToStaticMarkup(createElement(Summary, { receipts, monthly: false }));
  assert.ok(html.includes("ยังไม่มีรายการรับเงินในช่วงเวลานี้"));
  assert.ok(html.includes("ออเดอร์เก่าที่ไม่มีประวัติรับเงิน"));
  assert.equal(html.includes("<table"), false);
  f.state.billPayments.push(payment());
  receipts = (await report(f)).receipts;
  html = renderToStaticMarkup(createElement(Summary, { receipts, monthly: false }));
  assert.ok(html.includes("฿150.25"));
  assert.ok(html.includes("ยอดหลังหักเงินทอน"));
  assert.ok(html.includes("2026-01-02"));
  assert.ok(html.includes('aria-label="ยอดรับเงินแยกตามวันที่และวิธีชำระ"'));
  assert.equal(html.includes("500.00"), false);
});


test("report queries filter old orders before loading items; dashboard counts history separately", async () => {
  const f = setup(), seen = [];
  const find = f.db.query.orders.findMany;
  f.db.query.orders.findMany = async options => { const rows = await find(options); seen.push({ options, rows }); return rows; };
  await report(f, "month");
  assert.equal(seen.length, 1);
  assert.ok(!seen[0].rows.some(row => row.id === "dec" || row.id === "foreign"));
  seen.length = 0;
  const response = await f.load("app/api/dashboard/stats/route.ts").GET();
  const data = (await response.json()).data;
  assert.equal(data.totalOrdersCount, 4);
  assert.equal(seen.length, 2);
  assert.equal(seen.find(call => call.options.limit === 5).options.with, undefined);
  assert.equal(seen.find(call => call.options.with?.items).rows.some(row => row.id === "foreign"), false);
});
