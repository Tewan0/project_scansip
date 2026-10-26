import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request } from "./helpers.mjs";

function setup(role = "cashier") {
  const f = fixture(role);
  f.state.tables.push({ id: "table-a", storeId: "shop-a", tableNumber: 1, status: "occupied",
    currentSessionToken: "round-a", currentQrToken: "qr-a", sessionStartedAt: new Date(), qrExpiresAt: new Date(Date.now() + 86400000) });
  const route = f.load("app/api/tables/route.ts");
  return { ...f, route, close: token => route.POST(request({ action: "close_session", tableNumber: 1, expectedSessionToken: token })) };
}

for (const role of ["owner", "cashier"]) {
  for (const settled of [false, true]) {
    test(role + " stale close leaves a reopened round and service requests intact; settled=" + settled, async () => {
      const f = setup(role);
      assert.equal((await f.close("round-a")).status, 200);
      assert.equal((await f.route.POST(request({ action: "open_session", tableNumber: 1 }))).status, 200);
      const token = f.state.tables[0].currentSessionToken;
      if (settled) f.state.orders.push({ id: "paid", storeId: "shop-a", tableId: "table-a", tableNumber: 1,
        sessionToken: token, status: "completed", paymentStatus: "paid", totalAmount: "50.00" });
      f.state.serviceRequests.push({ id: "request-b", storeId: "shop-a", tableId: "table-a", sessionToken: token, status: "pending" });
      const before = structuredClone(f.state), writes = f.writes.length;
      const response = await f.close("round-a");
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, /รอบโต๊ะนี้เปลี่ยนไปแล้ว/);
      assert.deepEqual(f.state, before);
      assert.equal(f.writes.length, writes);
      assert.equal((await f.close(token)).status, 200);
      assert.equal(f.state.tables[0].currentSessionToken, null);
      assert.equal(f.state.serviceRequests[0].status, "resolved");
    });
  }
}

test("missing, malformed and QR tokens cannot authorize a round close", async () => {
  for (const token of [undefined, null, "", 123, [], {}, "wrong-round", "qr-a"]) {
    const f = setup(), before = structuredClone(f.state);
    assert.equal((await f.close(token)).status, 409);
    assert.deepEqual(f.state, before);
    assert.equal(f.writes.length, 0);
  }
});

test("repeated close of an already closed round is rejected without side effects", async () => {
  const f = setup();
  assert.equal((await f.close("round-a")).status, 200);
  const before = structuredClone(f.state), writes = f.writes.length;
  assert.equal((await f.close("round-a")).status, 409);
  assert.deepEqual(f.state, before);
  assert.equal(f.writes.length, writes);
});

test("close compares against the state loaded inside the transaction", async () => {
  const f = setup(), transaction = f.db.transaction;
  f.db.transaction = async callback => {
    Object.assign(f.state.tables[0], { currentSessionToken: "round-b", currentQrToken: "qr-b" });
    return transaction(callback);
  };
  assert.equal((await f.close("round-a")).status, 409);
  assert.equal(f.state.tables[0].currentSessionToken, "round-b");
  assert.equal(f.state.tables[0].currentQrToken, "qr-b");
  assert.equal(f.writes.length, 0);
});

test("QR rotation and expiration do not prevent closing the same settled bill round", async () => {
  const f = setup();
  Object.assign(f.state.tables[0], { currentQrToken: "rotated-qr", qrExpiresAt: new Date(0) });
  assert.equal((await f.close("round-a")).status, 200);
  assert.equal(f.state.tables[0].status, "available");
});

function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : []; }
const flush = () => new Promise(resolve => setImmediate(resolve));

test("table UI retains the confirmed round across polling and refreshes after a stale close", async () => {
  const backend = setup();
  const slots = [], effects = [], timers = [], intervals = [], posts = [];
  let cursor = 0, getCalls = 0, confirmClose;
  const confirmation = new Promise(resolve => { confirmClose = resolve; });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(value) { return react.useState(() => ({ current: value }))[0]; },
    useCallback(fn) { return react.useState(() => fn)[0]; },
    useEffect(fn, deps) { const i = cursor++, old = slots[i];
      if (!old || deps.some((dep, n) => dep !== old.deps[n])) { old?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); } },
  };
  const ui = names => Object.fromEntries(names.map(name => [name, name]));
  const f = fixture("cashier", {
    react,
    "next/link": { default: "a" },
    "@/hooks/use-confirmation": { useConfirmation: () => ({ confirm: () => confirmation, confirmationDialog: null }) },
    "@/components/service-request-board": { ServiceRequestBoard: "ServiceRequestBoard" },
    "@/components/loading-skeletons": { TableCardsSkeleton: "Skeleton" },
    "@/components/ui/button": ui(["Button"]), "@/components/ui/badge": ui(["Badge"]),
    "@/components/ui/card": ui(["Card", "CardContent", "CardHeader", "CardTitle"]),
    "@/components/ui/dialog": ui(["Dialog", "DialogContent", "DialogDescription", "DialogHeader", "DialogTitle"]),
    "@/components/ui/input": ui(["Input"]), "qrcode.react": ui(["QRCodeSVG"]),
  }, {
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    setInterval: fn => { intervals.push(fn); return intervals.length; }, clearInterval() {},
    fetch: async (_url, options) => {
      if (options?.method === "POST") { const body = JSON.parse(options.body); posts.push(body); return backend.route.POST(request(body)); }
      getCalls++; return backend.route.GET();
    },
  });
  const Page = f.load("app/dashboard/tables/page.tsx").default;
  const render = () => { cursor = 0; const tree = Page(); while (effects.length) effects.shift()(); return tree; };
  const closeButton = tree => nodes(tree).find(node => node.type === "Button" && node.props.variant === "destructive");
  render(); timers[0](); await flush();
  const pending = closeButton(render()).props.onClick();
  // Another worker closes and opens the table while this confirmation is pending.
  await backend.close("round-a");
  await backend.route.POST(request({ action: "open_session", tableNumber: 1 }));
  const nextToken = backend.state.tables[0].currentSessionToken;
  intervals[0](); await flush(); render();
  const beforeConfirm = getCalls;
  confirmClose(true); await pending; await flush();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].expectedSessionToken, "round-a");
  assert.equal(backend.state.tables[0].currentSessionToken, nextToken);
  assert.ok(getCalls > beforeConfirm, "conflict triggers a fresh GET");
  const tree = render();
  const alert = nodes(tree).find(node => node.props.role === "alert");
  assert.ok(alert);
  assert.match(JSON.stringify(alert.props.children), /รอบโต๊ะนี้เปลี่ยนไปแล้ว/);
  // A fresh click now uses the refreshed round and can close it normally.
  await closeButton(tree).props.onClick(); await flush();
  assert.equal(posts[1].expectedSessionToken, nextToken);
  assert.equal(backend.state.tables[0].currentSessionToken, null);
});
