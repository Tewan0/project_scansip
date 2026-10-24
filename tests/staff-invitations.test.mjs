import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request, params } from "./helpers.mjs";

const idA = "11111111-1111-4111-8111-111111111111";
const idB = "22222222-2222-4222-8222-222222222222";
function invite(id = idA, storeId = "shop-a", extra = {}) {
  return { id, storeId, userId: null, email: "staff@example.com", role: "cashier", name: "Staff", ...extra };
}
const accept = (id = idA, storeId = "shop-a", role = "cashier") => request({ invitationId: id, storeId, role });

test("another store's invitation cannot revoke or replace an accepted membership", async () => {
  const f = fixture("cashier"), victim = { ...f.context.user };
  const auth = f.load("lib/auth.ts");
  assert.equal((await auth.getAccessForUser(victim)).store.id, "shop-a");
  f.context.user = { id: "owner-b", email: "owner-b@example.com", email_confirmed_at: "2026-01-01" };
  const res = await f.load("app/api/staff/route.ts").POST(request({ email: victim.email, role: "kitchen", userId: victim.id }));
  assert.equal(res.status, 201);
  assert.equal((await res.json()).data.userId, null);
  f.context.user = victim;
  const access = await auth.requireStoreAccess();
  assert.equal(access.store.id, "shop-a");
  assert.equal(access.role, "cashier");
  assert.equal((await f.load("app/api/orders/route.ts").GET()).status, 200);
});

test("multiple pending invitations grant no access until the user chooses a store", async () => {
  const f = fixture("new-user");
  f.state.staff.push(invite(), invite(idB, "shop-b", { role: "kitchen" }));
  const auth = f.load("lib/auth.ts"), route = f.load("app/api/staff/invitations/route.ts");
  assert.equal(await auth.getAccessForUser(f.context.user), null);
  assert.equal((await f.load("app/api/orders/route.ts").GET()).status, 403);
  const response = await route.POST(accept(idB, "shop-b", "kitchen"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.redirectUrl, "/kitchen");
  assert.equal(f.state.staff.find(s => s.id === idA).userId, null);
  assert.equal(f.state.staff.find(s => s.id === idB).userId, "new-user");
  assert.equal((await auth.requireStoreAccess()).store.id, "shop-b");
  assert.equal((await route.POST(accept())).status, 409);
  assert.equal((await route.POST(accept(idB, "shop-b", "kitchen"))).status, 409);
  assert.equal(f.state.staff.filter(s => s.userId === "new-user").length, 1);
});

test("invitation list uses verified email, excludes bound records and exposes only display fields", async () => {
  const f = fixture("new-user");
  f.state.staff.push(invite(idA, "shop-a", { email: " STAFF@example.com " }), invite(idB, "shop-b", { email: "else@example.com" }),
    invite("already-bound", "shop-b", { userId: "other" }), invite("legacy", "shop-b", { role: "manager" }));
  const service = f.load("lib/staff-invitations.ts");
  const list = await service.listStaffInvitations(f.context.user);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, idA);
  assert.deepEqual(Object.keys(list[0]).sort(), ["id", "role", "storeId", "storeName", "storeSlug"]);
  f.context.user.email_confirmed_at = null;
  assert.equal((await service.listStaffInvitations(f.context.user)).length, 0);
});

for (const scenario of ["signed-out", "anonymous", "unverified", "other-email", "already-bound", "owner-role", "manager-role", "revoked", "changed-role", "wrong-store", "existing-member", "existing-owner"]) {
  test("rejects unsafe invitation acceptance: " + scenario, async () => {
    const f = fixture(scenario === "existing-owner" ? "owner" : scenario === "existing-member" ? "cashier" : "new-user");
    f.state.staff.push(invite());
    const item = f.state.staff.at(-1);
    if (scenario === "signed-out") f.context.user = null;
    if (scenario === "anonymous") f.context.user.is_anonymous = true;
    if (scenario === "unverified") f.context.user.email_confirmed_at = null;
    if (scenario === "other-email") item.email = "else@example.com";
    if (scenario === "already-bound") item.userId = "other";
    if (scenario === "owner-role") item.role = "owner";
    if (scenario === "manager-role") item.role = "manager";
    if (scenario === "revoked") f.state.staff = [];
    if (scenario === "changed-role") item.role = "kitchen";
    const before = JSON.stringify(f.state.staff);
    const res = await f.load("app/api/staff/invitations/route.ts").POST(accept(idA, scenario === "wrong-store" ? "shop-b" : "shop-a"));
    assert.ok(res.status >= 400, scenario);
    assert.equal(JSON.stringify(f.state.staff), before);
  });
}

test("declining an invitation cannot delete another person's or an accepted membership", async () => {
  const f = fixture("new-user"), route = f.load("app/api/staff/invitations/route.ts");
  f.state.staff.push(invite(), invite(idB, "shop-b", { userId: "other" }));
  assert.equal((await route.DELETE(accept(idB))).status, 404);
  assert.equal((await route.DELETE(accept())).status, 200);
  assert.equal(f.state.staff.length, 1);
  assert.equal(f.state.staff[0].userId, "other");
  assert.equal((await route.DELETE(accept())).status, 404);
});

test("revoking accepted membership never silently activates a different pending invitation", async () => {
  const f = fixture("cashier"), victim = { ...f.context.user };
  f.state.staff.push(invite(idB, "shop-b", { role: "kitchen" }));
  f.context.user = { id: "owner", email: "owner@example.com", email_confirmed_at: "2026-01-01" };
  assert.equal((await f.load("app/api/staff/[id]/route.ts").DELETE(request({}), params("member-a"))).status, 200);
  f.context.user = victim;
  assert.equal(await f.load("lib/auth.ts").getAccessForUser(victim), null);
  assert.equal((await f.load("app/api/orders/route.ts").GET()).status, 403);
});

test("invitation endpoints reject malformed and cross-origin writes", async () => {
  const f = fixture("new-user"), route = f.load("app/api/staff/invitations/route.ts");
  f.state.staff.push(invite());
  for (const body of [null, [], {}, { invitationId: "invalid" }, { invitationId: idA, storeId: "shop-a", role: "owner" }]) {
    assert.equal((await route.POST(request(body))).status, 400);
  }
  const foreign = accept(); foreign.headers.set("origin", "https://other.example");
  assert.equal((await route.POST(foreign)).status, 403);
  const form = accept(); form.headers.set("content-type", "text/plain");
  assert.equal((await route.POST(form)).status, 415);
  assert.equal(f.writes.length, 0);
});

test("account membership is rechecked inside onboarding transaction", async () => {
  const f = fixture("new-user");
  const transaction = f.db.transaction;
  f.db.transaction = async fn => {
    f.state.staff.push(invite(idB, "shop-b", { userId: "new-user" }));
    return transaction(fn);
  };
  const result = await f.load("app/actions/owner-auth.ts").createStoreOnboarding({ name: "New shop", slug: "new-shop" });
  assert.equal(result.success, false);
  assert.equal(f.state.stores.length, 2);
  assert.equal(f.state.categories.length, 0);
});


for (const method of ["POST", "DELETE"]) {
  test(method + " accepts the browser Host when Next.js uses an internal bind address", async () => {
    for (const [url, host, origin] of [
      ["http://0.0.0.0:3000/api/staff/invitations", "localhost:3000", "http://localhost:3000"],
      ["http://0.0.0.0:3000/api/staff/invitations", "127.0.0.1:3000", "http://127.0.0.1:3000"],
      ["http://0.0.0.0:3000/api/staff/invitations", "192.168.1.5:3000", "http://192.168.1.5:3000"],
      ["https://internal.example/api/staff/invitations", "project-scansip.vercel.app", "https://project-scansip.vercel.app"],
    ]) {
      const f = fixture("new-user"); f.state.staff.push(invite());
      const req = request({ invitationId: idA, storeId: "shop-a", role: "cashier" }, url);
      req.headers.set("host", host); req.headers.set("origin", origin);
      const response = await f.load("app/api/staff/invitations/route.ts")[method](req);
      assert.equal(response.status, 200, origin);
      if (method === "POST") assert.equal(f.state.staff[0].userId, "new-user");
      else assert.equal(f.state.staff.length, 0);
    }
  });

  test(method + " rejects foreign origins, forged forwarding headers and malformed authorities", async () => {
    for (const headers of [
      { host: "localhost:3000", origin: "https://other.example" },
      { host: "localhost:3000", origin: "http://localhost:3001" },
      { host: "localhost:3000", origin: "https://localhost:3000" },
      { host: "localhost:3000", origin: "null" },
      { host: "localhost:3000", origin: "http://0.0.0.0:3000" },
      { host: "localhost:3000", origin: "http://evil.example", "x-forwarded-host": "evil.example" },
      { host: "localhost:3000", origin: "https://localhost:3000", "x-forwarded-proto": "https" },
      { host: "localhost:3000@evil.example", origin: "http://evil.example" },
      { host: "localhost:3000/path", origin: "http://localhost:3000" },
      { host: "localhost:3000,evil.example", origin: "http://localhost:3000" },
      { host: "localhost:3000", origin: "http://localhost:3000/" },
    ]) {
      const f = fixture("new-user"); f.state.staff.push(invite());
      const req = request({ invitationId: idA, storeId: "shop-a", role: "cashier" }, "http://0.0.0.0:3000/api/staff/invitations");
      Object.entries(headers).forEach(([name, value]) => req.headers.set(name, value));
      assert.equal((await f.load("app/api/staff/invitations/route.ts")[method](req)).status, 403, JSON.stringify(headers));
      assert.equal(f.writes.length, 0);
    }
  });
}
