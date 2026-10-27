import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";

// Invoke the real component handlers with an isolated hook/runtime and network.
function panel(file, name, props, fetch, globals = {}) {
  const slots = [], effects = []; let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(value) { return react.useState(() => ({ current: value }))[0]; },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
    useCallback(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((dep, n) => dep !== old.deps[n])) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((dep, n) => dep !== old.deps[n])) {
      old?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); });
    } },
  };
  const router = { replace() {} };
  const f = fixture("anonymous", { react, "next/navigation": { useRouter: () => router }, "next/link": { default: "Link" },
    "@/components/service-request-board": { ServiceRequestBoard: "ServiceRequestBoard" },
    "@/components/ui/card": Object.fromEntries(["Card", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"].map(name => [name, name])),
    "@/components/ui/table": Object.fromEntries(["Table", "TableHeader", "TableBody", "TableHead", "TableRow", "TableCell"].map(name => [name, name])),
    "@/components/ui/skeleton": { Skeleton: "Skeleton" },
    "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"].map(name => [name, name])),
    "@/components/ui/button": { Button: "Button" }, "@/components/ui/badge": { Badge: "Badge" }, "qrcode.react": { QRCodeSVG: "QRCodeSVG" } }, {
    fetch, AbortController, setInterval: () => 1, clearInterval() {}, ...globals,
  });
  const Component = f.load(file)[name];
  const render = () => {
    cursor = 0;
    const tree = Component(props);
    return name === "OrderBoard" && props.mode === "kitchen" ? tree.type(tree.props) : tree;
  };
  return { render, async ready() { render(); effects.splice(0).forEach(fn => fn()); await new Promise(resolve => setTimeout(resolve, 10)); return render(); },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); } };
}
function text(node) { if (typeof node === "string" || typeof node === "number") return String(node); if (Array.isArray(node)) return node.map(text).join(""); return node?.props ? text(node.props.children) : ""; }
function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); return node?.props ? [node, ...nodes(node.props.children)] : []; }
function button(tree, label) { return nodes(tree).find(node => node.type === "Button" && text(node) === label); }
const sampleBill = { id: "bill-a", number: "B06-ABCDEF", tableNumber: 6, current: true, openedAt: "2026-10-20T13:40:00Z", firstOrderedAt: "2026-10-20T13:41:00Z", lastOrderedAt: "2026-10-20T13:45:00Z",
  totalCents: 7000, paidCents: 0, unpaidCents: 7000, refundedCents: 0, unfinishedCount: 0, unpaidOrderIds: ["a", "b"], anchorOrderId: "a",
  orders: [{ id: "a", orderNumber: "#A", status: "served", paymentStatus: "unpaid", totalAmount: "40.00", createdAt: "2026-10-20T13:41:00Z", items: [] },
    { id: "b", orderNumber: "#B", status: "served", paymentStatus: "unpaid", totalAmount: "30.00", createdAt: "2026-10-20T13:45:00Z", items: [] }] };
const props = { storeSlug: "cafe-a", tableNumber: "1", sessionToken: "round-a", enabled: true, refreshKey: 0, onSessionExpired() {}, promptPayNumber: null };
const order = { id: "order-a", orderNumber: "#ONE", status: "preparing", paymentStatus: "unpaid", totalAmount: "75", createdAt: "2026-10-20T10:00:00Z", items: [
  { id: "line-a", menuName: "ชา", quantity: 1, unitPrice: "75", status: "preparing", specialInstruction: "หวานน้อย" },
] };

test("customer panel restores history after mounting again and shows updated item status", async () => {
  let status = "preparing";
  const fetch = async (url, options) => {
    assert.match(url, /^\/api\/customer\/session\?/); assert.equal(options.headers.Authorization, "Bearer round-a");
    return Response.json({ success: true, data: { orders: [{ ...order, items: [{ ...order.items[0], status }] }], requests: [] } });
  };
  for (let refresh = 0; refresh < 2; refresh++) {
    const page = panel("components/customer-session-panel.tsx", "CustomerSessionPanel", props, fetch);
    try {
      let tree = await page.ready(); assert.match(text(tree), /#ONE/); assert.match(text(tree), /หวานน้อย/);
      assert.match(text(tree), refresh ? /ทำเสร็จแล้ว/ : /กำลังทำ/);
      status = "ready"; await button(tree, "อัปเดตสถานะ").props.onClick();
      await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render(); assert.match(text(tree), /ทำเสร็จแล้ว/);
    } finally { page.dispose(); }
  }
});

test("customer requests display pending state after send, deduplicate rapid clicks, and recover after staff resolves", async () => {
  let sent = 0, requests = [];
  const page = panel("components/customer-session-panel.tsx", "CustomerSessionPanel", props, async (url, options) => {
    if (url === "/api/customer/requests") {
      sent++; assert.equal(JSON.parse(options.body).kind, "assistance");
      requests = [{ id: "r-a", kind: "assistance", status: "pending", createdAt: new Date().toISOString() }];
      return Response.json({ success: true, data: requests[0] });
    }
    return Response.json({ success: true, data: { orders: [], requests } });
  });
  try {
    let tree = await page.ready(); const call = button(tree, "เรียกพนักงาน"); call.props.onClick(); call.props.onClick();
    await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render();
    assert.equal(sent, 1); assert.equal(button(tree, "เรียกพนักงานแล้ว").props.disabled, true);
    assert.match(text(tree), /รอพนักงาน/);
    requests = [{ ...requests[0], status: "resolved" }]; button(tree, "อัปเดตสถานะ").props.onClick();
    await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render();
    assert.match(text(tree), /พนักงานดำเนินการแล้ว/); assert.equal(button(tree, "เรียกพนักงาน").props.disabled, false);
  } finally { page.dispose(); }
});

test("history failure keeps displayed orders, expired session removes them and notifies the parent", async () => {
  let mode = "ok", expired = 0;
  const page = panel("components/customer-session-panel.tsx", "CustomerSessionPanel", { ...props, onSessionExpired() { expired++; } }, async () => {
    if (mode === "fail") return Response.json({ success: false, error: "โหลดไม่สำเร็จ" }, { status: 500 });
    if (mode === "expired") return Response.json({ success: false, sessionExpired: true }, { status: 403 });
    return Response.json({ success: true, data: { orders: [order], requests: [] } });
  });
  try {
    let tree = await page.ready(); mode = "fail"; button(tree, "อัปเดตสถานะ").props.onClick();
    await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render();
    assert.match(text(tree), /#ONE/); assert.match(text(tree), /โหลดไม่สำเร็จ/);
    mode = "expired"; button(tree, "อัปเดตสถานะ").props.onClick();
    await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render();
    assert.equal(expired, 1); assert.equal(text(tree).includes("#ONE"), false);
  } finally { page.dispose(); }
});

test("frontdesk board shows table requests, keeps failed updates visible and removes resolved requests", async () => {
  let pending = true, fail = true;
  const page = panel("components/service-request-board.tsx", "ServiceRequestBoard", {}, async (url, options) => {
    if (options.method === "PATCH") {
      assert.equal(JSON.parse(options.body).status, "resolved");
      if (fail) return Response.json({ success: false, error: "บันทึกไม่สำเร็จ" }, { status: 500 });
      pending = false; return Response.json({ success: true });
    }
    return Response.json({ success: true, data: pending ? [{ id: "r-a", kind: "bill", tableNumber: 3, createdAt: new Date().toISOString() }] : [] });
  });
  try {
    let tree = await page.ready(); assert.match(text(tree), /โต๊ะ 3 · ขอเช็กบิล/);
    button(tree, "ดำเนินการแล้ว").props.onClick(); await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render();
    assert.match(text(tree), /บันทึกไม่สำเร็จ/); assert.match(text(tree), /โต๊ะ 3/);
    fail = false; button(tree, "ดำเนินการแล้ว").props.onClick(); await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render();
    assert.match(text(tree), /ไม่มีคำขอที่รออยู่/); assert.equal(text(tree).includes("โต๊ะ 3"), false);
  } finally { page.dispose(); }
});

test("bill board groups repeated orders, hides history initially and requires explicit review before bulk receipt", async () => {
  let paid = false; const payments = [], views = [];
  const page = panel("components/bill-board.tsx", "BillBoard", {}, async (url, options) => {
    if (options.method === "POST") { payments.push(JSON.parse(options.body)); paid = true; return Response.json({ success: true, data: { paidCents: 7000, changeCents: 3000 } }); }
    const history = new URL(url, "http://localhost").searchParams.get("view") === "history"; views.push(history);
    return Response.json({ success: true, currentCount: 1, historyCount: 1, page: 1, pageCount: 1, data: history ? [{ ...sampleBill, id: "older", number: "B06-OLDER", current: false, unpaidCents: 0, unpaidOrderIds: [] }] : [{ ...sampleBill, unpaidCents: paid ? 0 : 7000, paidCents: paid ? 7000 : 0, unpaidOrderIds: paid ? [] : sampleBill.unpaidOrderIds }] });
  });
  try {
    let tree = await page.ready(); assert.equal(views[0], false); assert.equal(text(tree).includes("B06-OLDER"), false);
    assert.equal(nodes(tree).filter(node => node.type === "Card").length, 1);
    assert.match(text(tree), /สั่งครั้งที่ 1/); assert.match(text(tree), /สั่งครั้งที่ 2/);
    button(tree, "รับเงินรวมทั้งบิล ฿70.00").props.onClick(); tree = page.render();
    assert.equal(payments.length, 0); assert.equal(nodes(tree).find(node => node.type === "Dialog").props.open, true);
    button(tree, "ย้อนกลับ").props.onClick(); assert.equal(payments.length, 0);
    button(page.render(), "รับเงินรวมทั้งบิล ฿70.00").props.onClick(); tree = page.render();
    assert.equal(button(tree, "ยืนยันว่าได้รับเงินแล้ว").props.disabled, true);
    nodes(tree).find(node => node.props["aria-label"] === "รับเงินสด (บาท)").props.onChange({ target: { value: "100" } }); tree = page.render();
    assert.match(text(tree), /เงินทอน ฿30.00/);
    button(tree, "ยืนยันว่าได้รับเงินแล้ว").props.onClick(); await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render();
    assert.deepEqual(payments, [{ anchorOrderId: "a", expectedOrderIds: ["a", "b"], expectedTotalCents: 7000, method: "cash", receivedCents: 10000 }]);
    assert.match(text(tree), /ปิดโต๊ะได้จากผังโต๊ะ/); assert.equal(button(tree, "รับเงินรวมทั้งบิล ฿70.00"), undefined);
    button(tree, "ประวัติบิล (1)").props.onClick(); tree = await page.ready();
    assert.match(text(tree), /B06-OLDER/); assert.equal(text(tree).includes("B06-ABCDEF"), false);
  } finally { page.dispose(); }
});

test("stale payment closes review, loads the changed total and requires a new confirmation", async () => {
  let changed = false, submissions = 0;
  const page = panel("components/bill-board.tsx", "BillBoard", {}, async (_url, options) => {
    if (options.method === "POST") { changed = true; submissions++; return Response.json({ success: false, error: "รายการหรือยอดบิลเปลี่ยนแล้ว" }, { status: 409 }); }
    return Response.json({ success: true, currentCount: 1, historyCount: 0, page: 1, pageCount: 1, data: [{ ...sampleBill, totalCents: changed ? 8000 : 7000, unpaidCents: changed ? 8000 : 7000 }] });
  });
  try {
    let tree = await page.ready(); button(tree, "รับเงินรวมทั้งบิล ฿70.00").props.onClick(); tree = page.render();
    nodes(tree).find(node => node.props["aria-label"] === "รับเงินสด (บาท)").props.onChange({ target: { value: "100" } }); tree = page.render();
    button(tree, "ยืนยันว่าได้รับเงินแล้ว").props.onClick(); await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render();
    assert.equal(submissions, 1); assert.match(text(tree), /รายการหรือยอดบิลเปลี่ยนแล้ว/);
    assert.equal(nodes(tree).find(node => node.type === "Dialog").props.open, false);
    assert.ok(button(tree, "รับเงินรวมทั้งบิล ฿80.00"));
    assert.equal(button(tree, "รับเงินรวมทั้งบิล ฿80.00").props.disabled, false);
  } finally { page.dispose(); }
});

test("transfer receipt requires explicit bank confirmation and sends the exact current total", async () => {
  const payments = [];
  const page = panel("components/bill-board.tsx", "BillBoard", {}, async (_url, options) => {
    if (options.method === "POST") { payments.push(JSON.parse(options.body)); return Response.json({ success: true, data: { paidCents: 7000, changeCents: 0 } }); }
    return Response.json({ success: true, currentCount: 1, historyCount: 0, page: 1, pageCount: 1, data: [sampleBill] });
  });
  try {
    let tree = await page.ready(); button(tree, "รับเงินรวมทั้งบิล ฿70.00").props.onClick(); tree = page.render();
    nodes(tree).find(node => node.type === "input" && node.props.value === "transfer").props.onChange(); tree = page.render();
    assert.equal(button(tree, "ยืนยันว่าได้รับเงินแล้ว").props.disabled, true);
    button(tree, "ยืนยันว่าได้รับเงินแล้ว").props.onClick(); assert.equal(payments.length, 0);
    nodes(tree).find(node => node.props.type === "checkbox").props.onChange({ target: { checked: true } }); tree = page.render();
    button(tree, "ยืนยันว่าได้รับเงินแล้ว").props.onClick(); await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(payments[0].method, "transfer"); assert.equal(payments[0].receivedCents, 7000);
  } finally { page.dispose(); }
});

test("chatbot retains a failed question, prevents double sends and only adds a menu after a customer clicks", async () => {
  let fail = true, sent = 0; const added = [];
  const page = panel("components/customer-chatbot.tsx", "CustomerChatbot", { ...props, onAdd: id => { added.push(id); return true; } }, async (url, options) => {
    sent++; assert.equal(url, "/api/customer/chat"); assert.equal(options.headers.Authorization, "Bearer round-a");
    assert.equal(JSON.parse(options.body).messages.at(-1).content, "อยากดื่มชา");
    return fail ? Response.json({ success: false, error: "AI ไม่พร้อม" }, { status: 503 }) : Response.json({ success: true, data: { answer: "ลองชาดูครับ", recommendations: [{ id: "tea", name: "ชา", price: "35.00" }] } });
  }, { AbortController });
  try {
    let tree = await page.ready(); nodes(tree).find(node => node.type === "Button" && text(node).includes("ถาม AI ช่วยเลือกเมนู")).props.onClick();
    nodes(tree).find(node => node.type === "textarea").props.onChange({ target: { value: "อยากดื่มชา" } }); tree = page.render();
    const submit = nodes(tree).find(node => node.type === "form").props.onSubmit;
    submit({ preventDefault() {} }); submit({ preventDefault() {} }); await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render();
    assert.equal(sent, 1); assert.match(text(tree), /AI ไม่พร้อม/); assert.equal(nodes(tree).find(node => node.type === "textarea").props.value, "อยากดื่มชา");
    fail = false; nodes(tree).find(node => node.type === "form").props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render();
    assert.match(text(tree), /ลองชาดูครับ/); assert.equal(added.length, 0);
    button(tree, "เพิ่มในตะกร้า").props.onClick(); assert.deepEqual(added, ["tea"]);
    assert.equal(nodes(page.render()).find(node => node.type === "textarea").props.value, "");
  } finally { page.dispose(); }
});



test("report failure shows an error instead of zero revenue and disables export", async () => {
  const page = panel("app/dashboard/reports/page.tsx", "default", {}, async () => Response.json({ success: false }, { status: 500 }), { AbortController });
  try {
    const tree = await page.ready();
    assert.match(text(tree), /โหลดรายงานไม่สำเร็จ/);
    assert.equal(button(tree, "ส่งออก CSV (เปิดใน Excel ได้)").props.disabled, true);
    assert.equal(text(tree).includes("฿0.00"), false);
  } finally { page.dispose(); }
});

test("switching report ranges ignores late responses even when transport ignores abort", async () => {
  const pending = [];
  const page = panel("app/dashboard/reports/page.tsx", "default", {}, (url, options) => new Promise(resolve => pending.push({ url, options, resolve })), { AbortController });
  try {
    let tree = await page.ready();
    nodes(tree).find(n => n.type === "select").props.onChange({ target: { value: "month" } });
    tree = await page.ready();
    assert.equal(pending[0].options.signal.aborted, true);
    const data = (range, totalRevenue) => ({ range, totalRevenue, totalOrdersCount: 1, dailySales: [], topItems: [] });
    pending[1].resolve(Response.json({ success: true, data: data("month", 222) }));
    await new Promise(resolve => setTimeout(resolve, 0));
    pending[0].resolve(Response.json({ success: true, data: data("7d", 111) }));
    await new Promise(resolve => setTimeout(resolve, 0));
    tree = page.render();
    assert.match(text(tree), /222/);
    assert.equal(text(tree).includes("111"), false);
  } finally { page.dispose(); }
});


test("kitchen waiting time advances on the polling clock even when a refresh fails, and its timer is cleaned up", async () => {
  let now = Date.parse("2026-10-25T10:00:00Z"), tick, cleared = false, fail = false;
  class Clock extends Date { static now() { return now; } }
  const pending = { ...order, status: "pending", tableNumber: 1, billNumber: "B01",
    createdAt: new Date(now - 14 * 60000 - 59000).toISOString() };
  const page = panel("components/order-board.tsx", "OrderBoard", { mode: "kitchen" }, async () => {
    if (fail) throw Error("offline");
    return Response.json({ success: true, data: [pending] });
  }, { Date: Clock, setInterval(fn) { tick = fn; return 11; }, clearInterval(id) { assert.equal(id, 11); cleared = true; } });
  try {
    let tree = await page.ready();
    assert.match(text(tree), /รอแล้ว 14 นาที/);
    assert.equal(nodes(tree).some(node => node.type === "Card" && node.props.className.includes("ring-rose-500")), false);
    now += 2000; fail = true; tick();
    await new Promise(resolve => setTimeout(resolve, 0));
    tree = page.render();
    assert.match(text(tree), /รอแล้ว 15 นาที/);
    assert.match(text(tree), /เชื่อมต่อไม่สำเร็จ/);
    assert.ok(nodes(tree).some(node => node.type === "Card" && node.props.className.includes("ring-rose-500")));
  } finally { page.dispose(); }
  assert.equal(cleared, true);
});

test("manual report refresh keeps the selected range and existing data while disabling repeated refresh", async () => {
  let finish, count = 0;
  const report = { range: "7d", totalRevenue: 75, totalOrdersCount: 1, dailySales: [], topItems: [] };
  const page = panel("app/dashboard/reports/page.tsx", "default", {}, async url => {
    assert.equal(url, "/api/reports?range=7d");
    if (++count === 1) return Response.json({ success: true, data: report });
    return new Promise(resolve => { finish = resolve; });
  });
  try {
    let tree = await page.ready();
    const refresh = nodes(tree).find(node => node.type === "Button" && text(node).includes("รีเฟรช"));
    assert.ok(refresh);
    const pending = refresh.props.onClick();
    tree = page.render();
    assert.equal(nodes(tree).find(node => node.type === "Button" && text(node).includes("รีเฟรช")).props.disabled, true);
    assert.equal(nodes(tree).find(node => node.type === "select").props.value, "7d");
    assert.ok(text(tree).includes("75"));
    finish(Response.json({ success: true, data: { ...report, totalRevenue: 90 } }));
    await pending;
    tree = page.render();
    assert.ok(text(tree).includes("90"));
    assert.equal(nodes(tree).find(node => node.type === "Button" && text(node).includes("รีเฟรช")).props.disabled, false);
  } finally { page.dispose(); }
});


test("cancellation dialog requires a reason, blocks duplicate sends and preserves the reason on failure", async () => {
  const sent = []; let finish;
  const page = panel("components/bill-board.tsx", "BillBoard", {}, async (url, options) => {
    if (options.method === "PATCH") { sent.push(JSON.parse(options.body)); return new Promise(resolve => { finish = resolve; }); }
    return Response.json({ success: true, data: [sampleBill], currentCount: 1, historyCount: 0, page: 1, pageCount: 1 });
  });
  try {
    let tree = await page.ready();
    button(tree, "ยกเลิกครั้งที่ 1").props.onClick();
    tree = page.render();
    assert.equal(button(tree, "ยืนยันยกเลิกออเดอร์").props.disabled, true);
    assert.equal(sent.length, 0);
    nodes(tree).find(node => node.props["aria-label"] === "เหตุผลการยกเลิก").props.onChange({ target: { value: "ลูกค้าเปลี่ยนใจ" } });
    tree = page.render();
    const send = button(tree, "ยืนยันยกเลิกออเดอร์").props.onClick;
    send(); send();
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], { status: "cancelled", cancellationReason: "ลูกค้าเปลี่ยนใจ" });
    finish(Response.json({ success: false, error: "ลองใหม่" }, { status: 500 }));
    await new Promise(resolve => setTimeout(resolve, 0));
    tree = page.render();
    assert.equal(nodes(tree).find(node => node.props["aria-label"] === "เหตุผลการยกเลิก").props.value, "ลูกค้าเปลี่ยนใจ");
    button(tree, "ยืนยันยกเลิกออเดอร์").props.onClick();
    finish(Response.json({ success: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(nodes(page.render()).some(node => node.props["aria-label"] === "เหตุผลการยกเลิก"), false);
  } finally { page.dispose(); }
});

test("PromptPay QR payload is generated locally with valid EMVCo TLV and CRC16 for mobile and national IDs", async () => {
  const { crc16Ccitt, generatePromptPayPayload } = fixture().load("lib/promptpay.ts");
  assert.equal(crc16Ccitt("123456789"), "29B1");

  const mobilePayload = generatePromptPayPayload("098-955-1686", 80);
  assert.ok(mobilePayload.startsWith("00020101021229370016A000000677010111011300669895516865802TH5303764540580.006304"));
  assert.equal(mobilePayload.slice(-4), crc16Ccitt(mobilePayload.slice(0, -4)));

  const citizenPayload = generatePromptPayPayload("1234567890123", 150.5);
  assert.ok(citizenPayload.startsWith("00020101021229370016A000000677010111021312345678901235802TH53037645406150.506304"));
  assert.equal(citizenPayload.slice(-4), crc16Ccitt(citizenPayload.slice(0, -4)));

  assert.equal(generatePromptPayPayload("invalid", 80), null);
  assert.equal(generatePromptPayPayload("0989551686", 0), null);
  assert.equal(generatePromptPayPayload("0989551686", -10), null);

  const page = panel("components/customer-session-panel.tsx", "CustomerSessionPanel", { ...props, promptPayNumber: "0989551686" },
    async () => Response.json({ success: true, data: { orders: [{ ...order, totalAmount: "80.00", items: [{ ...order.items[0], unitPrice: "80.00" }] }], requests: [] } }));
  try {
    const tree = await page.ready();
    const qrNode = nodes(tree).find(node => node.type === "QRCodeSVG");
    assert.ok(qrNode);
    assert.equal(qrNode.props.value, mobilePayload);
    assert.equal(text(tree).includes("โหลด QR ไม่สำเร็จ"), false);
  } finally { page.dispose(); }
});


const flushReads = () => new Promise(resolve => setTimeout(resolve, 0));
const billResult = (bill = sampleBill) => ({ success: true, data: [bill], currentCount: 1, historyCount: 0, page: 1, pageCount: 1 });
for (const scenario of [
  { file: "customer-session-panel", name: "CustomerSessionPanel", props, result: { success: true, data: { orders: [order], requests: [] } }, expected: "#ONE" },
  { file: "bill-board", name: "BillBoard", props: {}, result: billResult(), expected: "B06-ABCDEF" },
  { file: "order-board", name: "OrderBoard", props: { mode: "kitchen" }, result: { success: true, data: [{ ...order, tableNumber: 1, billNumber: "B01" }] }, expected: "#ONE" },
  { file: "service-request-board", name: "ServiceRequestBoard", props: {}, result: { success: true, data: [{ id: "slow-request", kind: "bill", tableNumber: 3, createdAt: order.createdAt }] }, expected: "โต๊ะ 3" },
]) {
  test(scenario.name + " accepts slow responses without overlapping polls and recovers after failure", async () => {
    let tick; const pending = [];
    const page = panel("components/" + scenario.file + ".tsx", scenario.name, scenario.props,
      () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
      { setInterval(fn) { tick = fn; return 1; } });
    try {
      await page.ready();
      tick(); tick(); tick();
      assert.equal(pending.length, 1, "polls must not replace an unfinished read");
      // Reading the response body is also part of the pending request.
      let finishBody;
      pending[0].resolve({ ok: true, status: 200, json: () => new Promise(resolve => { finishBody = resolve; }) });
      await flushReads(); tick();
      assert.equal(pending.length, 1);
      finishBody(scenario.result); await flushReads();
      assert.ok(text(page.render()).includes(scenario.expected));
      tick(); assert.equal(pending.length, 2);
      pending[1].reject(Error("temporary outage")); await flushReads();
      assert.ok(text(page.render()).includes(scenario.expected), "retain existing data on failure");
      tick(); assert.equal(pending.length, 3, "failed reads must release the polling guard");
      pending[2].resolve(Response.json(scenario.result)); await flushReads();
      assert.equal(text(page.render()).includes("temporary outage"), false);
    } finally { page.dispose(); }
  });
}

test("changing the bill view bypasses an old pending read without accepting its late result", async () => {
  let tick; const pending = [];
  const page = panel("components/bill-board.tsx", "BillBoard", {},
    url => new Promise(resolve => pending.push({ url, resolve })),
    { setInterval(fn) { tick = fn; return 1; } });
  try {
    let tree = await page.ready();
    nodes(tree).find(node => node.type === "Button" && text(node).startsWith("ประวัติบิล")).props.onClick();
    await page.ready();
    assert.equal(pending.length, 2, "new filters must not wait for the old request");
    assert.match(pending[1].url, /view=history/);
    pending[0].resolve(Response.json(billResult())); await flushReads();
    assert.equal(text(page.render()).includes("B06-ABCDEF"), false);
    tick(); assert.equal(pending.length, 2, "old completion must not unlock the newer pending request");
    pending[1].resolve(Response.json(billResult({ ...sampleBill, number: "HISTORY-ONLY", current: false })));
    await flushReads();
    assert.ok(text(page.render()).includes("HISTORY-ONLY"));
  } finally { page.dispose(); }
});

test("customer mutation refresh bypasses a stale poll and rejects its late response", async () => {
  let tick; const pending = [];
  const service = { id: "request-new", kind: "assistance", status: "pending", createdAt: order.createdAt };
  const page = panel("components/customer-session-panel.tsx", "CustomerSessionPanel", props, (url, options) => {
    if (options.method === "POST") return Promise.resolve(Response.json({ success: true, data: service }));
    return new Promise(resolve => pending.push(resolve));
  }, { setInterval(fn) { tick = fn; return 1; } });
  try {
    await page.ready();
    pending[0](Response.json({ success: true, data: { orders: [order], requests: [] } })); await flushReads();
    tick(); assert.equal(pending.length, 2);
    button(page.render(), "เรียกพนักงาน").props.onClick(); await flushReads();
    assert.equal(pending.length, 3, "refresh after mutation must bypass the old poll");
    pending[1](Response.json({ success: true, data: { orders: [], requests: [] } })); await flushReads();
    assert.ok(text(page.render()).includes("#ONE"));
    assert.ok(text(page.render()).includes("เรียกพนักงานแล้ว"));
    pending[2](Response.json({ success: true, data: { orders: [order], requests: [service] } })); await flushReads();
    tick(); assert.equal(pending.length, 4);
    page.dispose();
    pending[3](Response.json({ success: false, sessionExpired: true })); await flushReads();
    assert.ok(text(page.render()).includes("#ONE"), "late responses after unmount must be ignored");
  } finally { page.dispose(); }
});


test("each completed staff mutation refreshes even while another mutation refresh is pending", async () => {
  const reads = [], writes = [];
  const requests = [1, 2].map(n => ({ id: "request-" + n, kind: "bill", tableNumber: n, createdAt: order.createdAt }));
  const page = panel("components/service-request-board.tsx", "ServiceRequestBoard", {}, (_url, options) => {
    if (options.method === "PATCH") return new Promise(resolve => writes.push(resolve));
    return new Promise(resolve => reads.push(resolve));
  });
  try {
    await page.ready();
    reads[0](Response.json({ success: true, data: requests })); await flushReads();
    const actions = nodes(page.render()).filter(node => node.type === "Button" && text(node) === "ดำเนินการแล้ว");
    actions[0].props.onClick(); actions[1].props.onClick();
    assert.equal(writes.length, 2);
    writes[0](Response.json({ success: true })); await flushReads();
    assert.equal(reads.length, 2);
    writes[1](Response.json({ success: true })); await flushReads();
    assert.equal(reads.length, 3, "second mutation requires a read after its own commit");
    reads[2](Response.json({ success: true, data: [] })); await flushReads();
    reads[1](Response.json({ success: true, data: [requests[1]] })); await flushReads();
    assert.ok(text(page.render()).includes("ไม่มีคำขอที่รออยู่"));
  } finally { page.dispose(); }
});
