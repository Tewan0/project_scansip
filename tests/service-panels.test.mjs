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
    useCallback(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((dep, n) => dep !== old.deps[n])) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((dep, n) => dep !== old.deps[n])) {
      old?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); });
    } },
  };
  const router = { replace() {} };
  const f = fixture("anonymous", { react, "next/navigation": { useRouter: () => router }, "next/link": { default: "Link" },
    "@/components/service-request-board": { ServiceRequestBoard: "ServiceRequestBoard" },
    "@/components/ui/card": Object.fromEntries(["Card", "CardHeader", "CardTitle", "CardContent", "CardFooter"].map(name => [name, name])),
    "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"].map(name => [name, name])),
    "@/components/ui/button": { Button: "Button" }, "@/components/ui/badge": { Badge: "Badge" } }, {
    fetch, setInterval: () => 1, clearInterval() {}, ...globals,
  });
  const Component = f.load(file)[name];
  const render = () => { cursor = 0; return Component(props); };
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
    if (options.method === "POST") { payments.push(JSON.parse(options.body)); paid = true; return Response.json({ success: true, data: { paidCents: 7000 } }); }
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
    button(tree, "ยืนยันว่าได้รับเงินแล้ว").props.onClick(); await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render();
    assert.deepEqual(payments, [{ anchorOrderId: "a", expectedOrderIds: ["a", "b"], expectedTotalCents: 7000 }]);
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
    button(tree, "ยืนยันว่าได้รับเงินแล้ว").props.onClick(); await new Promise(resolve => setTimeout(resolve, 0)); tree = page.render();
    assert.equal(submissions, 1); assert.match(text(tree), /รายการหรือยอดบิลเปลี่ยนแล้ว/);
    assert.equal(nodes(tree).find(node => node.type === "Dialog").props.open, false);
    assert.ok(button(tree, "รับเงินรวมทั้งบิล ฿80.00"));
    assert.equal(button(tree, "รับเงินรวมทั้งบิล ฿80.00").props.disabled, false);
  } finally { page.dispose(); }
});

