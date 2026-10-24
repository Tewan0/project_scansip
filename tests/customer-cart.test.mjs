import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";

const lib = fixture().load("lib/customer-cart.ts");
const key = lib.cartStorageKey("cafe", "3", "round-one");
function storageFixture() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const draft = { items: [{ menuItemId: "coffee", name: "กาแฟ", quantity: 2, note: "หวานน้อย" }], customerNote: "ขอจานแบ่ง" };

test("cart quantities and notes survive reload, remain separate across shops/tables/QR rounds", () => {
  const storage = storageFixture();
  lib.createCartStore(storage, key).update(() => draft);
  assert.deepEqual(structuredClone(lib.createCartStore(storage, key).getSnapshot().draft), draft);
  for (const args of [["other", "3", "round-one"], ["cafe", "4", "round-one"], ["cafe", "3", "round-two"]]) {
    assert.equal(lib.createCartStore(storage, lib.cartStorageKey(...args)).getSnapshot().draft.items.length, 0);
  }
  assert.equal(storage.data.size, 1, "opening a different context must not erase an old cart");
});

test("successful checkout clearing removes persisted draft and notes", () => {
  const storage = storageFixture(), cart = lib.createCartStore(storage, key);
  cart.update(() => draft);
  cart.update(() => ({ items: [], customerNote: "" }));
  assert.equal(storage.getItem(key), null);
  assert.equal(lib.createCartStore(storage, key).getSnapshot().draft.items.length, 0);
});

test("corrupt storage cannot crash the menu or inject saved prices", () => {
  for (const value of ["broken-json", "null", '{"version":100,"items":[]}', '{"version":1,"items":null}']) {
    assert.equal(lib.parseCartDraft(value).items.length, 0);
  }
  const result = lib.parseCartDraft(JSON.stringify({ version: 1, items: [null,
    { menuItemId: "bad", quantity: -1 }, { menuItemId: "fraction", quantity: 0.5 },
    { menuItemId: "coffee", name: "กาแฟ", quantity: 1000, price: 0.01, note: "a".repeat(400) },
    { menuItemId: "coffee", quantity: 1 }], customerNote: "b".repeat(600) }));
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 99);
  assert.equal(result.items[0].note.length, 300);
  assert.equal(result.customerNote.length, 500);
  assert.equal("price" in result.items[0], false);
});

test("blocked browser storage still supports editing in memory and reports no persistence", () => {
  const blocked = { getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); }, removeItem() { throw Error("denied"); } };
  const cart = lib.createCartStore(blocked, key);
  cart.update(() => draft);
  assert.equal(cart.getSnapshot().persistent, false);
  assert.deepEqual(cart.getSnapshot().draft, draft);
});

// Execute the actual page handlers with mocked browser/network APIs, without a DOM.
function customerPage(storage, { checkoutStatus = 201, valid = true, menuAvailable = true, loseResponse = false, invalidReason = "session_expired" } = {}) {
  const slots = [], effects = [];
  let cursor = 0;
  const requests = [];
  const browser = Object.assign(new EventTarget(), { localStorage: storage });
  const react = {
    use: value => value,
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }];
    },
    useRef(value) { return react.useState(() => ({ current: value }))[0]; },
    useCallback(fn, deps) {
      const i = cursor++, old = slots[i];
      if (!old || deps.some((dep, index) => dep !== old.deps[index])) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++, old = slots[i];
      if (!old || deps.some((dep, index) => dep !== old.deps[index])) {
        old?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); });
      }
    },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  const ui = names => Object.fromEntries(names.map(name => [name, name]));
  const f = fixture("anonymous", {
    react,
    "next/navigation": { useSearchParams: () => new URLSearchParams("token=round-one") },
    "@/components/theme-toggle": ui(["ThemeToggle"]),
    "@/components/customer-session-panel": ui(["CustomerSessionPanel"]),
    "@/components/customer-chatbot": ui(["CustomerChatbot"]),
    "@/components/ui/button": ui(["Button"]), "@/components/ui/badge": ui(["Badge"]),
    "@/components/ui/card": ui(["Card", "CardHeader", "CardTitle", "CardContent", "CardFooter"]),
    "@/components/ui/separator": ui(["Separator"]), "@/components/ui/skeleton": ui(["Skeleton"]),
    "@/components/ui/dialog": ui(["Dialog", "DialogContent", "DialogDescription", "DialogTitle"]),
  }, {
    window: browser, setInterval: () => 1, clearInterval() {},
    fetch: async (url, options) => {
      if (url.startsWith("/api/tables/validate")) return Response.json({ success: true, valid, reason: valid ? undefined : invalidReason });
      if (url.startsWith("/api/store")) return Response.json({ success: true, data: { id: "shop-a", name: "Cafe", openingTime: "08:00", closingTime: "18:00" } });
      if (url.startsWith("/api/categories")) return Response.json({ success: true, data: [] });
      if (url.startsWith("/api/menu")) return Response.json({ success: true, data: menuAvailable ? [{ id: "coffee", name: "กาแฟใหม่", price: "75.00", isAvailable: true }] : [] });
      if (url === "/api/orders") {
        requests.push(JSON.parse(options.body));
        if (loseResponse) throw new Error("Network lost after commit");
        return Response.json(checkoutStatus === 201 ? { success: true, data: { id: "order-a", orderNumber: "#A", status: "pending", items: [], totalAmount: "150" } } : { success: false, error: "ลองใหม่" }, { status: checkoutStatus });
      }
      throw Error("Unexpected request " + url);
    },
  });
  const Page = f.load("app/r/[storeSlug]/table/[tableNumber]/page.tsx").default;
  function render() {
    cursor = 0;
    const root = Page({ params: { storeSlug: "cafe", tableNumber: "3" } });
    return root.type(root.props);
  }
  return { render, requests, async ready() { render(); effects.splice(0).forEach(fn => fn()); await new Promise(resolve => setTimeout(resolve, 10)); return render(); },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); } };
}

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function textContent(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  return node?.props ? textContent(node.props.children) : "";
}

test("empty customer page always has a cart button and cannot submit an empty order", async () => {
  const page = customerPage(storageFixture());
  try {
    let tree = await page.ready();
    const button = nodes(tree).find(node => node.props?.["aria-label"] === "เปิดตะกร้า 0 รายการ");
    assert.ok(button); button.props.onClick(); tree = page.render();
    assert.equal(nodes(tree).find(node => node.type === "Dialog").props.open, true);
    assert.ok(textContent(tree).includes("ตะกร้ายังว่างอยู่"));
    const checkout = nodes(tree).find(node => node.type === "Button" && textContent(node).includes("ยืนยันส่งคำสั่งซื้อ"));
    assert.equal(checkout.props.disabled, true); await checkout.props.onClick();
    assert.equal(page.requests.length, 0);
  } finally { page.dispose(); }
});

test("restored cart uses current prices, failed checkout keeps it, success clears it", async () => {
  const storage = storageFixture();
  lib.createCartStore(storage, key).update(() => draft);
  for (const status of [500, 201]) {
    const page = customerPage(storage, { checkoutStatus: status });
    try {
      const tree = await page.ready();
      assert.ok(textContent(tree).includes("150.00"));
      const checkout = nodes(tree).find(node => node.type === "Button" && /ยืนยันส่งคำสั่งซื้อ|ตรวจสอบการส่งอีกครั้ง/.test(textContent(node)));
      assert.equal(checkout.props.disabled, false);
      await checkout.props.onClick();
      assert.equal(page.requests[0].items[0].unitPrice, "75.00");
      assert.equal(page.requests[0].items[0].specialInstruction, "หวานน้อย");
      assert.equal(lib.createCartStore(storage, key).getSnapshot().draft.items.length, status === 201 ? 0 : 1);
    } finally { page.dispose(); }
  }
});

test("adding and editing from the page is saved immediately and restored after refreshing", async () => {
  const storage = storageFixture(), first = customerPage(storage);
  try {
    let tree = await first.ready();
    nodes(tree).find(node => node.props?.["aria-label"] === "เพิ่ม กาแฟใหม่ ลงตะกร้า").props.onClick();
    tree = first.render();
    nodes(tree).find(node => node.props?.["aria-label"] === "เพิ่มจำนวน กาแฟใหม่").props.onClick();
    tree = first.render();
    nodes(tree).find(node => node.props?.["aria-label"] === "หมายเหตุสำหรับ กาแฟใหม่").props.onChange({ target: { value: "ไม่ใส่น้ำแข็ง" } });
    tree = first.render();
    nodes(tree).find(node => node.props?.id === "customer-note").props.onChange({ target: { value: "ขอช้อน" } });
  } finally { first.dispose(); }
  const refreshed = customerPage(storage);
  try {
    const tree = await refreshed.ready();
    assert.ok(nodes(tree).some(node => node.props?.["aria-label"] === "เปิดตะกร้า 2 รายการ"));
    assert.equal(nodes(tree).find(node => node.props?.id === "customer-note").props.value, "ขอช้อน");
    assert.equal(nodes(tree).find(node => node.props?.["aria-label"] === "หมายเหตุสำหรับ กาแฟใหม่").props.value, "ไม่ใส่น้ำแข็ง");
  } finally { refreshed.dispose(); }
});

test("removed menu items remain visible for removal and cannot be submitted", async () => {
  const storage = storageFixture(); lib.createCartStore(storage, key).update(() => draft);
  const page = customerPage(storage, { menuAvailable: false });
  try {
    const tree = await page.ready();
    assert.ok(textContent(tree).includes("เมนูนี้หมดหรือไม่มีในร้านแล้ว"));
    const checkout = nodes(tree).find(node => node.type === "Button" && textContent(node).includes("ยืนยันส่งคำสั่งซื้อ"));
    assert.equal(checkout.props.disabled, true); await checkout.props.onClick();
    assert.equal(page.requests.length, 0);
    assert.equal(lib.createCartStore(storage, key).getSnapshot().draft.items.length, 1);
  } finally { page.dispose(); }
});

test("confirmed expired QR clears only its own cart", async () => {
  const storage = storageFixture(); lib.createCartStore(storage, key).update(() => draft);
  const otherKey = lib.cartStorageKey("cafe", "3", "new-round"); lib.createCartStore(storage, otherKey).update(() => draft);
  const page = customerPage(storage, { valid: false });
  try {
    await page.ready();
    assert.equal(storage.getItem(key), null);
    assert.equal(lib.createCartStore(storage, otherKey).getSnapshot().draft.items.length, 1);
  } finally { page.dispose(); }
});

test("lost checkout response survives reload, locks edits, and retries the same key even when the menu disappears", async () => {
  const storage=storageFixture();lib.createCartStore(storage,key).update(()=>draft);
  const first=customerPage(storage,{loseResponse:true});
  let firstId;
  try {
    let tree=await first.ready();
    await nodes(tree).find(n=>n.type==="Button"&&textContent(n).includes("ยืนยันส่งคำสั่งซื้อ")).props.onClick();
    firstId=first.requests[0].requestId;assert.match(firstId,/^[0-9a-f-]{36}$/);
    tree=first.render();
    assert.equal(nodes(tree).find(n=>n.props.id==="customer-note").props.disabled,true);
    assert.equal(nodes(tree).find(n=>n.props["aria-label"]==="นำ กาแฟใหม่ ออกจากตะกร้า").props.disabled,true);
    assert.equal(lib.createCartStore(storage,key).getSnapshot().draft.requestId,firstId);
  } finally {first.dispose();}
  const refreshed=customerPage(storage,{menuAvailable:false});
  try {
    const tree=await refreshed.ready();
    const retry=nodes(tree).find(n=>n.type==="Button"&&textContent(n).includes("ตรวจสอบการส่งอีกครั้ง"));
    assert.equal(retry.props.disabled,false);await retry.props.onClick();
    assert.equal(refreshed.requests[0].requestId,firstId);
    assert.equal(refreshed.requests[0].items[0].specialInstruction,"หวานน้อย");
    assert.equal(storage.getItem(key),null);
    const next=lib.createCartStore(storage,key);next.update(()=>draft);
    assert.notEqual(next.beginCheckout().requestId,firstId);
  } finally {refreshed.dispose();}
});

test("a definitive rejected checkout unlocks the retained draft for corrections",async()=>{
  const storage=storageFixture();lib.createCartStore(storage,key).update(()=>draft);
  const page=customerPage(storage,{checkoutStatus:400});
  try {
    const tree=await page.ready();
    await nodes(tree).find(n=>n.type==="Button"&&textContent(n).includes("ยืนยันส่งคำสั่งซื้อ")).props.onClick();
    assert.equal(lib.createCartStore(storage,key).getSnapshot().draft.requestId,undefined);
    assert.equal(nodes(page.render()).find(n=>n.props.id==="customer-note").props.disabled,false);
  }finally{page.dispose();}
});

test("rate-limited checkout preserves cart and allows a later manual retry",async()=>{
  const storage=storageFixture();lib.createCartStore(storage,key).update(()=>draft);
  const page=customerPage(storage,{checkoutStatus:429});
  try {
    const tree=await page.ready();
    await nodes(tree).find(n=>n.type==="Button"&&textContent(n).includes("ยืนยันส่งคำสั่งซื้อ")).props.onClick();
    const saved=lib.createCartStore(storage,key).getSnapshot().draft;
    assert.deepEqual(structuredClone(saved.items),draft.items);assert.equal(saved.customerNote,draft.customerNote);
    assert.equal(saved.requestId,page.requests[0].requestId);
    const retry=nodes(page.render()).find(n=>n.type==="Button"&&textContent(n).includes("ตรวจสอบการส่งอีกครั้ง"));
    assert.equal(retry.props.disabled,false);
    await retry.props.onClick();
    assert.equal(page.requests.length,2);assert.equal(page.requests[1].requestId,saved.requestId);
  } finally {page.dispose();}
});

test("blocked storage still reuses an in-memory request key",()=>{
  const cart=lib.createCartStore(null,key);cart.update(()=>draft);
  const attempt=cart.beginCheckout();assert.equal(cart.beginCheckout().requestId,attempt.requestId);
  assert.equal(cart.getSnapshot().persistent,false);
});

test("24-hour QR expiry shows a blocked screen and retains the unsent cart", async () => {
  const storage = storageFixture(); lib.createCartStore(storage, key).update(() => draft);
  const page = customerPage(storage, { valid: false, invalidReason: "qr_expired" });
  try {
    const tree = await page.ready(); assert.match(textContent(tree), /QR หมดอายุ/);
    assert.equal(nodes(tree).some(node => node.type === "Button" && textContent(node).includes("ยืนยันส่งคำสั่งซื้อ")), false);
    assert.equal(lib.createCartStore(storage, key).getSnapshot().draft.items.length, 1);
    assert.equal(page.requests.length, 0);
  } finally { page.dispose(); }
});
