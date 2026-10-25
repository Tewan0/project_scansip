import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";

function chatbot(fetch) {
  const slots = [], effects = [], timers = new Map(); let cursor = 0, timerId = 0, expired = 0, added = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(value) { return react.useState(() => ({ current: value }))[0]; },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((dep, n) => dep !== old.deps[n])) {
      old?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); });
    } },
  };
  const f = fixture("anonymous", { react,
    "@/components/ui/button": { Button: "Button" },
    "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"].map(name => [name, name])),
  }, { fetch, AbortController,
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const Component = f.load("components/customer-chatbot.tsx").CustomerChatbot;
  const render = () => { cursor = 0; const tree = Component({ storeSlug: "cafe", tableNumber: "1", sessionToken: "round", enabled: true,
    onSessionExpired() { expired++; }, onAdd() { added++; return true; } }); effects.splice(0).forEach(fn => fn()); return tree; };
  return { render, timers, get expired() { return expired; }, get added() { return added; },
    fire(delay) { for (const [id, timer] of timers) if (timer.delay === delay) { timers.delete(id); timer.fn(); } },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); } };
}
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : []; }
function text(tree) { return typeof tree === "string" ? tree : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : ""; }
const tick = () => new Promise(resolve => setImmediate(resolve));
const find = (page, predicate) => nodes(page.render()).find(predicate);
const button = (page, label) => find(page, node => node.type === "Button" && text(node).includes(label));
const input = page => find(page, node => node.type === "textarea");
function ask(page, value = "ชาไม่หวาน") {
  input(page).props.onChange({ target: { value } });
  find(page, node => node.type === "form").props.onSubmit({ preventDefault() {} });
}
const reply = () => Response.json({ success: true, data: { answer: "ลองชานี้ครับ", recommendations: [{ id: "tea", name: "ชา", price: "35.00" }] } });

test("chat preserves failed questions, retries manually, blocks rapid sends and adds only on click", async () => {
  let calls = 0, resolve;
  const page = chatbot(async () => { calls++; if (calls === 1) throw new Error("private network details"); return new Promise(done => { resolve = done; }); });
  ask(page); await tick();
  assert.equal(input(page).props.value, "ชาไม่หวาน");
  assert.match(text(page.render()), /เชื่อมต่อ AI ไม่สำเร็จ/);
  assert.ok(!text(page.render()).includes("private network"));
  button(page, "ลองส่งอีกครั้ง").props.onClick();
  button(page, "ลองส่งอีกครั้ง")?.props.onClick();
  find(page, node => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(calls, 2); assert.equal(input(page).props.disabled, true);
  assert.match(text(page.render()), /ชาไม่หวาน/);
  resolve(reply()); await tick();
  assert.equal(input(page).props.value, ""); assert.match(text(page.render()), /฿35.00/);
  assert.equal(page.added, 0);
  button(page, "เพิ่มในตะกร้า").props.onClick(); assert.equal(page.added, 1);
  assert.match(text(page.render()), /เพิ่ม ชา แล้ว/); assert.equal(page.timers.size, 0);
  page.dispose();
});

test("slow chat times out and keeps the prompt; leaving the dialog never blocks the menu", async () => {
  let calls = 0;
  const page = chatbot((_url, options) => { calls++; return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })); });
  button(page, "ถาม AI")?.props.onClick();
  ask(page); page.fire(8000); assert.match(text(page.render()), /กำลังรอคำตอบ/);
  button(page, "กลับไปเลือกเมนู").props.onClick();
  assert.equal(find(page, node => node.type === "Dialog").props.open, false);
  page.fire(25000); await tick();
  assert.match(text(page.render()), /ใช้เวลาตอบนานเกินไป/);
  assert.equal(input(page).props.value, "ชาไม่หวาน"); assert.equal(input(page).props.disabled, false);
  assert.equal(calls, 1); assert.equal(page.timers.size, 0); page.dispose();
});

test("quota errors do not retry automatically and expired QR disables further requests", async () => {
  for (const expired of [false, true]) {
    let calls = 0;
    const page = chatbot(async () => { calls++; return Response.json({ success: false, sessionExpired: expired, error: "ถึงขีดจำกัด กรุณาลองภายหลัง" }, { status: expired ? 403 : 429 }); });
    ask(page); await tick();
    assert.equal(calls, 1); assert.equal(input(page).props.value, "ชาไม่หวาน");
    if (expired) {
      assert.equal(page.expired, 1); assert.equal(input(page).props.disabled, true);
      assert.equal(button(page, "ลองส่งอีกครั้ง"), undefined);
      ask(page); assert.equal(calls, 1);
    } else { assert.match(text(page.render()), /ขีดจำกัด/); assert.ok(button(page, "ลองส่งอีกครั้ง")); }
    page.dispose();
  }
});

test("unmount aborts the outstanding request and discards a late response", async () => {
  let resolve, signal;
  const page = chatbot((_url, options) => { signal = options.signal; return new Promise(done => { resolve = done; }); });
  ask(page); page.dispose(); assert.equal(signal.aborted, true);
  resolve(reply()); await tick(); assert.equal(page.timers.size, 0);
  assert.ok(!text(page.render()).includes("ลองชานี้ครับ"));
});


test("chat keeps message identity when trimming history and sends only conversation fields", async () => {
  let payload;
  const page = chatbot(async (_url, options) => { payload = JSON.parse(options.body); return reply(); });
  const messages = () => nodes(page.render()).filter(node => node.type === "div" && node.key !== null && node.props.className?.includes("rounded-2xl p-3.5"));
  for (let i = 0; i < 10; i++) { ask(page, "question " + i); await tick(); }
  const before = messages();
  assert.equal(before.length, 20);
  ask(page, "question 10"); await tick();
  const after = messages();
  assert.equal(after.length, 20);
  assert.deepEqual(after.slice(0, 18).map(node => node.key), before.slice(2).map(node => node.key));
  assert.ok(after.slice(-2).every(node => !before.some(old => old.key === node.key)));
  assert.equal(new Set(after.map(node => node.key)).size, 20);
  assert.equal(payload.messages.length, 9);
  assert.ok(payload.messages.every(message => Object.keys(message).sort().join(",") === "content,role"));
  page.dispose();
});
