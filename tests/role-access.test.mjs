import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request, params } from "./helpers.mjs";

test("roles resolve from verified identity and current DB membership, never user metadata", async () => {
  for (const role of ["owner", "cashier", "kitchen"]) {
    const f = fixture(role); f.context.user.user_metadata = { role: "owner" };
    assert.equal((await f.load("lib/auth.ts").requireStoreAccess()).role, role);
  }
  const f = fixture("stranger"); f.context.user.user_metadata = { role: "owner" };
  await assert.rejects(f.load("lib/auth.ts").requireStoreAccess(), { status: 403 });
  assert.equal(f.state.stores.length, 2);
});

test("email invitation needs verified email and cannot override another bound user", async () => {
  for (const scenario of ["unverified", "bound", "anonymous", "duplicates"]) {
    const f = fixture("cashier");
    if (scenario === "unverified") f.context.user.email_confirmed_at = null;
    if (scenario === "bound") f.state.staff[0].userId = "someone-else";
    if (scenario === "anonymous") f.context.user.is_anonymous = true;
    if (scenario === "duplicates") f.state.staff.push({ ...f.state.staff[0], storeId: "shop-b" });
    await assert.rejects(f.load("lib/auth.ts").requireStoreAccess());
  }
});

test("revoked invitations and changed roles take effect on next request", async () => {
  const f = fixture("cashier"), auth = f.load("lib/auth.ts");
  await auth.requireStoreAccess(["cashier"]);
  f.state.staff[0].role = "kitchen";
  await assert.rejects(auth.requireStoreAccess(["cashier"]), { status: 403 });
  assert.equal((await auth.requireStoreAccess(["kitchen"])).role, "kitchen");
  f.state.staff.length = 0;
  await assert.rejects(auth.requireStoreAccess(), { status: 403 });
});

test("staff owner/manager records do not grant ownership", async () => {
  for (const role of ["owner", "manager"]) {
    const f = fixture("cashier"); f.state.staff[0].role = role;
    await assert.rejects(f.load("lib/auth.ts").requireStoreAccess(), { status: 403 });
  }
});

const endpoints = [
  ["app/api/staff/route.ts", "GET"], ["app/api/staff/route.ts", "POST"],
  ["app/api/staff/[id]/route.ts", "DELETE"], ["app/api/staff/[id]/route.ts", "PATCH"],
  ["app/api/store/route.ts", "PUT"], ["app/api/dashboard/stats/route.ts", "GET"], ["app/api/reports/route.ts", "GET"],
  ["app/api/menu/route.ts", "POST"], ["app/api/menu/[id]/route.ts", "PATCH"], ["app/api/menu/[id]/route.ts", "DELETE"],
  ["app/api/categories/route.ts", "POST"],
];
for (const role of ["anonymous", "cashier", "kitchen"]) {
  test(role + " cannot call owner-only APIs", async () => {
    for (const [file, method] of endpoints) {
      const f = fixture(role), response = await f.load(file)[method](request({ role: "owner", name: "Forged", price: 1 }), params("other-id"));
      assert.equal(response.status, role === "anonymous" ? 401 : 403, file + " " + method);
      assert.equal(f.writes.length, 0);
    }
  });
}

test("owners cannot edit menus, categories or staff belonging to another store", async () => {
  const f = fixture();
  f.state.menuItems.push({ id: "other-item", storeId: "shop-b", name: "Original" });
  const response = await f.load("app/api/menu/[id]/route.ts").PATCH(request({ name: "Hacked" }), params("other-item"));
  assert.equal(response.status, 404);
  assert.equal(f.state.menuItems[0].name, "Original");
  f.state.staff.push({ id: "other-staff", storeId: "shop-b", role: "cashier" });
  assert.equal((await f.load("app/api/staff/[id]/route.ts").DELETE(request({}), params("other-staff"))).status, 404);
  assert.equal(f.state.staff.length, 1);
  const categoryId = "12345678-1234-1234-1234-123456789012";
  f.state.categories.push({ id: categoryId, storeId: "shop-b" });
  assert.equal((await f.load("app/api/menu/route.ts").POST(request({ name: "Coffee", price: 50, categoryId }))).status, 400);
});

test("owner role cannot be invited or removed; duplicate emails are rejected", async () => {
  const f = fixture(), route = f.load("app/api/staff/route.ts");
  assert.equal((await route.POST(request({ email: "test@example.com", role: "owner" }))).status, 400);
  assert.equal((await route.POST(request({ email: "test@example.com", role: "manager" }))).status, 400);
  assert.equal((await route.POST(request({ email: "test@example.com", role: "cashier" }))).status, 201);
  assert.equal((await route.POST(request({ email: " TEST@example.com ", role: "kitchen" }))).status, 409);
  f.state.staff.push({ id: "owner-staff", storeId: "shop-a", role: "owner", userId: "owner" });
  assert.equal((await f.load("app/api/staff/[id]/route.ts").DELETE(request({}), params("owner-staff"))).status, 404);
});

test("route destinations restrict each role, owners may help both teams", () => {
  const { canAccessPath, homeForRole } = fixture().load("lib/permissions.ts");
  assert.equal(homeForRole("cashier"), "/frontdesk"); assert.equal(homeForRole("kitchen"), "/kitchen");
  for (const route of ["/dashboard", "/dashboard/staff", "/owner/dashboard", "/owner/onboarding"]) {
    assert.equal(canAccessPath("cashier", route), false); assert.equal(canAccessPath("kitchen", route), false);
  }
  assert.equal(canAccessPath("cashier", "/kitchen"), false); assert.equal(canAccessPath("kitchen", "/frontdesk"), false);
  assert.equal(canAccessPath("owner", "/frontdesk"), true); assert.equal(canAccessPath("owner", "/kitchen"), true);
});

test("malformed staff requests return 400 and leave membership unchanged", async () => {
  for (const body of [null, [], "cashier"]) {
    const f = fixture();
    assert.equal((await f.load("app/api/staff/route.ts").POST(request(body))).status, 400);
    assert.equal((await f.load("app/api/staff/[id]/route.ts").PATCH(request(body), params("staff-a"))).status, 400);
    assert.equal(f.writes.length, 0);
  }
});

test("server actions enforce owner roles and reject foreign menu IDs", async () => {
  for (const role of ["anonymous", "cashier", "kitchen"]) {
    const f = fixture(role), actions = f.load("app/actions/menu.ts");
    assert.equal((await actions.deleteMenuItem("foreign-item")).success, false);
    assert.equal((await actions.updateMenuItem("foreign-item", new FormData())).success, false);
    assert.equal((await f.load("app/actions/table.ts").updateStoreTableCount(4)).success, false);
    assert.equal(f.writes.length, 0);
  }
  const f = fixture();
  f.state.menuItems.push({ id: "foreign-item", storeId: "shop-b" });
  assert.equal((await f.load("app/actions/menu.ts").deleteMenuItem("foreign-item")).status, 404);
  assert.equal(f.state.menuItems.length, 1);
});
