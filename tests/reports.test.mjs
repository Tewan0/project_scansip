import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";

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
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"ชา ""เย็น"", #1\nพิเศษ"'));
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.ok(csv.includes('"10.5"'));
});
