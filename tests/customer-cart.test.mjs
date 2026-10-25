import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";

const lib = fixture().load("lib/customer-cart.ts");
const key = lib.cartStorageKey("cafe", "3", "round-one");
function storageFixture() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const draft = { items: [{ lineId: "coffee-line", menuItemId: "coffee", name: "กาแฟ", quantity: 2, note: "หวานน้อย" }], customerNote: "ขอจานแบ่ง" };

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
  assert.equal(result.items.length, 2);
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


test("adding the same menu merges only matching notes, including quick-add without a note", () => {
  const coffee = { menuItemId: "coffee", name: "กาแฟ", quantity: 1, note: "หวานน้อย" };
  let current = lib.addCartLine({ items: [], customerNote: "" }, coffee);
  const firstId = current.items[0].lineId;
  current = lib.addCartLine(current, { ...coffee, note: " หวานน้อย ", quantity: 2 });
  assert.equal(current.items.length, 1);
  assert.equal(current.items[0].quantity, 3);
  assert.equal(current.items[0].lineId, firstId);
  current = lib.addCartLine(current, { ...coffee, note: "หวานปกติ" });
  current = lib.addCartLine(current, { ...coffee, note: "" });
  current = lib.addCartLine(current, { ...coffee, note: "  " });
  assert.deepEqual(structuredClone(current.items.map(({ note, quantity }) => ({ note, quantity }))), [
    { note: "หวานน้อย", quantity: 3 }, { note: "หวานปกติ", quantity: 1 }, { note: "", quantity: 2 },
  ]);
  assert.equal(new Set(current.items.map(line => line.lineId)).size, 3);
});

test("distinct notes count toward the 50-line limit and quantities remain capped per line", () => {
  const coffee = { menuItemId: "coffee", name: "กาแฟ", quantity: 1, note: "" };
  let current = { items: [], customerNote: "" };
  for (let i = 0; i < lib.MAX_CART_LINES; i++) current = lib.addCartLine(current, { ...coffee, note: String(i) });
  assert.equal(current.items.length, 50);
  assert.equal(lib.addCartLine(current, { ...coffee, note: "one more" }), null);
  current = lib.addCartLine(current, { ...coffee, note: "0", quantity: 98 });
  assert.equal(current.items[0].quantity, 99);
  assert.equal(lib.addCartLine(current, { ...coffee, note: "0" }), null);
  assert.equal(current.items[1].quantity, 1);
  for (const quantity of [0, -1, 0.5, 100, NaN]) assert.equal(lib.addCartLine(current, { ...coffee, quantity }), null);
  assert.equal(lib.addCartLine({ ...current, requestId: "pending" }, coffee), null);
});

test("legacy drafts acquire stable line identities without changing pending checkout selections", () => {
  const legacy = { version: 1, items: [
    { menuItemId: "coffee", name: "กาแฟ", quantity: 2, note: " หวานน้อย " },
    { menuItemId: "coffee", name: "กาแฟ", quantity: 1, note: "หวานปกติ" },
    { menuItemId: "coffee", name: "กาแฟ", quantity: 3, note: "หวานปกติ" },
  ], customerNote: " ขอช้อน ", requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
  const storage = storageFixture();
  storage.setItem(key, JSON.stringify(legacy));
  const first = lib.createCartStore(storage, key);
  const attempt = first.beginCheckout();
  assert.equal(attempt.requestId, legacy.requestId);
  assert.equal(attempt.customerNote, legacy.customerNote);
  assert.deepEqual(structuredClone(attempt.items.map(({ lineId, ...line }) => { assert.ok(lineId); return line; })), legacy.items);
  assert.deepEqual(structuredClone(lib.createCartStore(storage, key).beginCheckout()), structuredClone(attempt));
  first.releaseCheckout();
  const saved = lib.createCartStore(storage, key).getSnapshot().draft;
  assert.deepEqual(structuredClone(saved.items), structuredClone(attempt.items));
  assert.equal(saved.requestId, undefined);
});

test("missing or duplicate stored line identities are repaired without dropping selections", () => {
  const result = lib.parseCartDraft(JSON.stringify({ version: 1, items: [
    { ...draft.items[0], lineId: "restored-1" },
    { ...draft.items[0], lineId: null, note: "normal" },
    { ...draft.items[0], lineId: "restored-1", note: "no ice" },
  ] }));
  assert.equal(result.items.length, 3);
  assert.equal(new Set(result.items.map(line => line.lineId)).size, 3);
  assert.deepEqual(structuredClone(lib.parseCartDraft(JSON.stringify({ version: 1, ...result }))), structuredClone(result));
});

const savedCart = storage => lib.createCartStore(storage, key).getSnapshot().draft;
const byLabel = (tree, label) => nodes(tree).filter(node => node.props?.["aria-label"] === label);
function detailAdd(page, note) {
  nodes(page.render()).find(node => node.type === "Card" && node.props.onClick).props.onClick();
  let tree = page.render();
  nodes(tree).find(node => node.props?.id === "item-detail-note").props.onChange({ target: { value: note } });
  tree = page.render();
  nodes(tree).find(node => node.type === "Button" && textContent(node).startsWith("เพิ่มลงตะกร้า")).props.onClick();
}

test("detail dialog, quick-add and chatbot all keep note variants separate and survive reload", async () => {
  const storage = storageFixture(), page = customerPage(storage);
  try {
    await page.ready();
    detailAdd(page, "หวานน้อย");
    detailAdd(page, "หวานปกติ");
    detailAdd(page, " หวานน้อย ");
    byLabel(page.render(), "เพิ่ม กาแฟใหม่ ลงตะกร้า")[0].props.onClick();
    assert.equal(nodes(page.render()).find(node => node.type === "CustomerChatbot").props.onAdd("coffee"), true);
    const saved = savedCart(storage);
    assert.deepEqual(structuredClone(saved.items.map(line => [line.note, line.quantity])), [["หวานน้อย", 2], ["หวานปกติ", 1], ["", 2]]);
    assert.equal(new Set(saved.items.map(line => line.lineId)).size, 3);
    assert.match(textContent(page.render()), /375\.00/);
  } finally { page.dispose(); }
  const refreshed = customerPage(storage);
  try {
    const tree = await refreshed.ready();
    assert.deepEqual(byLabel(tree, "หมายเหตุสำหรับ กาแฟใหม่").map(node => node.props.value), ["หวานน้อย", "หวานปกติ", ""]);
    assert.match(textContent(tree), /375\.00/);
  } finally { refreshed.dispose(); }
});

test("quantity, note edits and removal affect only the selected row, even after notes become equal", async () => {
  const storage = storageFixture();
  lib.createCartStore(storage, key).update(() => ({ ...draft, items: [
    draft.items[0], { ...draft.items[0], lineId: "second", quantity: 1, note: "หวานปกติ" },
  ] }));
  const page = customerPage(storage);
  try {
    let tree = await page.ready();
    const keysBefore = nodes(tree).filter(node => node.props?.role === "group").map(node => node.key);
    byLabel(tree, "เพิ่มจำนวน กาแฟใหม่")[1].props.onClick();
    assert.deepEqual(structuredClone(savedCart(storage).items.map(line => line.quantity)), [2, 2]);
    tree = page.render();
    byLabel(tree, "หมายเหตุสำหรับ กาแฟใหม่")[1].props.onChange({ target: { value: "หวานน้อย" } });
    tree = page.render();
    assert.deepEqual(nodes(tree).filter(node => node.props?.role === "group").map(node => node.key), keysBefore, "typing must not remount or merge rows");
    assert.deepEqual(structuredClone(savedCart(storage).items.map(line => line.note)), ["หวานน้อย", "หวานน้อย"]);
    byLabel(tree, "ลดจำนวน กาแฟใหม่")[1].props.onClick();
    tree = page.render();
    byLabel(tree, "นำ กาแฟใหม่ ออกจากตะกร้า")[0].props.onClick();
    assert.deepEqual(structuredClone(savedCart(storage).items.map(line => [line.lineId, line.quantity])), [["second", 1]]);
    byLabel(page.render(), "ลดจำนวน กาแฟใหม่")[0].props.onClick();
    assert.equal(savedCart(storage).items.length, 0);
  } finally { page.dispose(); }
});

test("repeated add callbacks before a rerender use the latest cart and respect quantity limits", async () => {
  const storage = storageFixture(), page = customerPage(storage);
  try {
    const tree = await page.ready();
    const add = byLabel(tree, "เพิ่ม กาแฟใหม่ ลงตะกร้า")[0].props.onClick;
    for (let i = 0; i < 101; i++) add();
    assert.equal(savedCart(storage).items.length, 1);
    assert.equal(savedCart(storage).items[0].quantity, 99);
    assert.ok(nodes(page.render()).some(node => node.props?.role === "alert" && textContent(node).includes("เพิ่มรายการไม่ได้")));
  } finally { page.dispose(); }
});

test("a rejected detail addition keeps the dialog and its note instead of silently closing", async () => {
  const storage = storageFixture();
  lib.createCartStore(storage, key).update(() => ({ items: [{ ...draft.items[0], quantity: 99 }], customerNote: "" }));
  const page = customerPage(storage);
  try {
    await page.ready();
    detailAdd(page, "หวานน้อย");
    const tree = page.render();
    const dialog = nodes(tree).find(node => node.type === "Dialog" && nodes(node).some(child => child.props?.id === "item-detail-note"));
    assert.equal(dialog.props.open, true);
    assert.equal(nodes(dialog).find(node => node.props?.id === "item-detail-note").props.value, "หวานน้อย");
    assert.ok(nodes(dialog).some(node => node.props?.role === "alert"));
    assert.equal(savedCart(storage).items[0].quantity, 99);
  } finally { page.dispose(); }
});

test("multi-line checkout retries identical ordered selections and the same request key after a lost response", async () => {
  const storage = storageFixture();
  lib.createCartStore(storage, key).update(() => ({ ...draft, items: [
    draft.items[0], { ...draft.items[0], lineId: "second", quantity: 1, note: "หวานปกติ" },
  ] }));
  const first = customerPage(storage, { loseResponse: true });
  let original;
  try {
    const tree = await first.ready();
    await nodes(tree).find(node => node.type === "Button" && textContent(node).includes("ยืนยันส่งคำสั่งซื้อ")).props.onClick();
    original = first.requests[0];
    assert.equal(original.items.length, 2);
    assert.equal(original.items.some(line => "lineId" in line), false);
    for (const label of ["เพิ่มจำนวน กาแฟใหม่", "ลดจำนวน กาแฟใหม่", "หมายเหตุสำหรับ กาแฟใหม่", "นำ กาแฟใหม่ ออกจากตะกร้า"]) {
      assert.ok(byLabel(first.render(), label).every(node => node.props.disabled));
    }
  } finally { first.dispose(); }
  const refreshed = customerPage(storage);
  try {
    const tree = await refreshed.ready();
    await nodes(tree).find(node => node.type === "Button" && textContent(node).includes("ตรวจสอบการส่งอีกครั้ง")).props.onClick();
    assert.deepEqual(refreshed.requests[0], original);
    assert.equal(storage.getItem(key), null);
  } finally { refreshed.dispose(); }
});
