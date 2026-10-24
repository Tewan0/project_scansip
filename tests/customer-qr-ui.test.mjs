import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => typeof tree === "string" || typeof tree === "number" ? String(tree) : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";
function screen({ expired = true } = {}) {
  const slots = [], effects = [], requests = [], confirmations = []; let cursor = 0;
  const table = { id: "table-a", tableNumber: 1, status: "occupied", currentSessionToken: "private-round",
    currentQrToken: "public-qr-old", sessionStartedAt: new Date(Date.now() - 86_400_000).toISOString(), qrExpiresAt: new Date(Date.now() + (expired ? -1000 : 86_400_000)).toISOString() };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { return react.useState(() => ({ current: initial }))[0]; },
    useCallback(fn) { cursor++; return fn; },
    useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = {}; effects.push(() => { slots[i].cleanup = fn(); }); } },
  };
  const ui = names => Object.fromEntries(names.map(name => [name, name]));
  const f = fixture("owner", { react,
    "next/link": { default: "Link" }, "qrcode.react": { QRCodeSVG: "QRCode" },
    "@/hooks/use-confirmation": { useConfirmation: () => ({ confirmationDialog: null, confirm: async options => { confirmations.push(options); return true; } }) },
    "@/components/service-request-board": { ServiceRequestBoard: "ServiceRequestBoard" },
    "@/components/ui/button": ui(["Button"]), "@/components/ui/badge": ui(["Badge"]),
    "@/components/ui/card": ui(["Card", "CardContent", "CardHeader", "CardTitle"]),
    "@/components/ui/dialog": ui(["Dialog", "DialogContent", "DialogDescription", "DialogHeader", "DialogTitle"]),
    "@/components/ui/input": ui(["Input"]), "@/components/ui/skeleton": ui(["Skeleton"]),
  }, { window: { location: { origin: "http://localhost:3000" } }, fetch: async (_url, init) => {
    if (init?.method !== "POST") return Response.json({ success: true, data: [table], store: { slug: "cafe", name: "Cafe" }, canManageTables: true });
    requests.push(JSON.parse(init.body));
    throw new Error("Unexpected table mutation");
  } });
  const Page = f.load("app/dashboard/tables/page.tsx").default;
  const page = { render() { cursor = 0; return Page(); }, requests, confirmations,
    async ready() { page.render(); effects.splice(0).forEach(fn => fn()); await new Promise(resolve => setTimeout(resolve, 20)); },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); },
  };
  return page;
}
const button = (page, label) => nodes(page.render()).find(node => node.type === "Button" && text(node).includes(label));

test("expired QR hides the code and directs staff to finish the bill before reopening", async () => {
  const page = screen(); try {
    await page.ready(); button(page, "ดู QR").props.onClick();
    assert.match(text(page.render()), /QR หมดอายุ/);
    assert.match(text(page.render()), /24 ชั่วโมง/);
    assert.match(text(page.render()), /รับเงินให้เรียบร้อย แล้วปิดโต๊ะก่อนเปิดรอบใหม่/);
    assert.equal(nodes(page.render()).some(node => node.type === "QRCode"), false);
    assert.equal(button(page, "ออก QR ใหม่"), undefined);
    assert.equal(button(page, "เปิดหน้าสั่งอาหาร"), undefined);
    assert.equal(page.requests.length, 0);
  } finally { page.dispose(); }
});

test("valid QR remains viewable and uses only the customer credential without a renewal control", async () => {
  const page = screen({ expired: false }); try {
    await page.ready(); button(page, "ดู QR").props.onClick();
    const qr = nodes(page.render()).find(node => node.type === "QRCode");
    assert.ok(qr.props.value.endsWith("token=public-qr-old"));
    assert.equal(qr.props.value.includes("private-round"), false);
    assert.ok(button(page, "เปิดหน้าสั่งอาหาร"));
    assert.equal(button(page, "ออก QR ใหม่"), undefined);
    assert.equal(page.requests.length, 0);
  } finally { page.dispose(); }
});

test("closing the QR dialog does not close the table or change its credential", async () => {
  const page = screen(); try {
    await page.ready(); button(page, "ดู QR").props.onClick();
    button(page, "ปิดหน้าต่าง").props.onClick();
    assert.equal(nodes(page.render()).find(node => node.type === "Dialog").props.open, false);
    assert.equal(page.requests.length, 0);
    assert.equal(page.confirmations.length, 0);
    assert.ok(button(page, "ปิดโต๊ะ"));
  } finally { page.dispose(); }
});
