import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";

function screen(fetch) {
  const state = [], destinations = []; let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },
  };
  const f = fixture("new-user", { react, "next/link": { default: "Link" },
    "@/components/ui/button": { Button: "Button" },
    "@/components/logout-button": { LogoutButton: "LogoutButton" },
    "@/components/theme-toggle": { ThemeToggle: "ThemeToggle" },
  }, { fetch, window: { location: { assign(path) { destinations.push(path); }, reload() {} } } });
  const Component = f.load("components/staff-invitations.tsx").StaffInvitations;
  const invitations = [{ id: "11111111-1111-4111-8111-111111111111", storeId: "shop-a", storeName: "Cafe A", storeSlug: "cafe-a", role: "cashier" }];
  return { render() { cursor = 0; return Component({ email: "staff@example.com", invitations }); }, destinations };
}
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : []; }
function text(tree) { return typeof tree === "string" ? tree : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : ""; }
const button = (page, label) => nodes(page.render()).find(node => node.type === "Button" && text(node).includes(label));
const tick = () => new Promise(resolve => setImmediate(resolve));

test("invitation UI requires a click, submits the displayed store/role once and redirects on success", async () => {
  let calls = 0, resolve;
  const page = screen((_url, init) => { calls++; assert.equal(init.method, "POST"); assert.equal(JSON.parse(init.body).role, "cashier");
    assert.equal(JSON.parse(init.body).storeId, "shop-a"); return new Promise(done => { resolve = done; }); });
  assert.match(text(page.render()), /Cafe A/);
  assert.equal(calls, 0);
  button(page, "ยืนยันเข้าร้าน").props.onClick();
  button(page, "ยืนยันเข้าร้าน").props.onClick();
  assert.equal(calls, 1);
  assert.equal(button(page, "ปฏิเสธ").props.disabled, true);
  resolve(Response.json({ success: true, data: { redirectUrl: "/frontdesk" } })); await tick();
  assert.deepEqual(page.destinations, ["/frontdesk"]);
});

test("invitation UI leaves failed/revoked requests retryable and refuses external redirects", async () => {
  let calls = 0;
  const page = screen(async () => { calls++; return calls === 1 ? Response.json({ success: false, error: "คำเชิญถูกยกเลิก" }, { status: 404 })
    : Response.json({ success: true, data: { redirectUrl: "https://other.example" } }); });
  button(page, "ยืนยันเข้าร้าน").props.onClick(); await tick();
  assert.match(text(page.render()), /คำเชิญถูกยกเลิก/);
  assert.equal(button(page, "ยืนยันเข้าร้าน").props.disabled, false);
  button(page, "ยืนยันเข้าร้าน").props.onClick(); await tick();
  assert.equal(page.destinations.length, 0);
  assert.equal(button(page, "ยืนยันเข้าร้าน").props.disabled, false);
});

test("declining uses DELETE and returns to the invitation list", async () => {
  const page = screen(async (_url, init) => { assert.equal(init.method, "DELETE"); return Response.json({ success: true }); });
  button(page, "ปฏิเสธ").props.onClick(); await tick();
  assert.deepEqual(page.destinations, ["/workspace"]);
});
