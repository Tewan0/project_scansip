import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request, params } from "./helpers.mjs";
import { imageFile } from "./image-fixtures.mjs";

const id = "11111111-1111-1111-1111-111111111111";
function setup() {
  let storageCalls = 0;
  const f = fixture("owner", {
    "@/utils/supabase/admin": { createAdminClient() { storageCalls++; throw new Error("Unexpected storage access"); } },
  });
  f.state.menuItems.push({ id, storeId: "shop-a", name: "Coffee", price: "50.00", description: "Original", imageUrl: null, isAvailable: true });
  return { ...f, storageCalls: () => storageCalls };
}
function form(description, image = false) {
  const data = new FormData();
  data.set("name", "Coffee"); data.set("price", "50");
  if (description !== undefined) data.set("description", description);
  if (image) data.set("image", imageFile());
  return data;
}
async function save(f, path, description, image = false) {
  if (path === "action") return f.load("app/actions/menu.ts").updateMenuItem(id, form(description, image));
  const response = path === "patch"
    ? await f.load("app/api/menu/[id]/route.ts").PATCH(request({ description }), params(id))
    : await f.load("app/api/menu/route.ts").POST(path === "multipart"
      ? new Request("http://localhost/api/menu", { method: "POST", body: form(description, image) })
      : request({ name: "Coffee", price: 50, description }));
  return { ...await response.json(), status: response.status };
}

for (const path of ["json", "multipart", "patch", "action"]) {
  test(path + " accepts exactly 1,000 Thai characters without truncation", async () => {
    const f = setup(), description = "ก".repeat(1000);
    const result = await save(f, path, description);
    assert.equal(result.success, true); assert.equal(result.data.description, description);
    assert.equal(f.state.menuItems.at(-1).description, description);
  });
  test(path + " rejects 1,001 characters before writes or image upload", async () => {
    const f = setup();
    const result = await save(f, path, "ก".repeat(1001), true);
    assert.equal(result.status, 400); assert.equal(result.success, false);
    assert.match(result.error, /1,000/);
    assert.equal(f.writes.length, 0); assert.equal(f.storageCalls(), 0);
    assert.equal(f.state.menuItems.length, 1); assert.equal(f.state.menuItems[0].description, "Original");
  });
  test(path + " trims descriptions and permits clearing the optional field", async () => {
    for (const [input, expected] of [["  หวานน้อย ", "หวานน้อย"], ["", null], [" \n ", null]]) {
      const result = await save(setup(), path, input);
      assert.equal(result.success, true); assert.equal(result.data.description, expected);
    }
  });
  test(path + " rejects non-text descriptions without side effects", async () => {
    const invalid = ["action", "multipart"].includes(path) ? [new File(["text"], "description.txt")] : [42, false, {}, []];
    for (const input of invalid) {
      const f = setup(), result = await save(f, path, input, true);
      assert.equal(result.status, 400); assert.equal(f.writes.length, 0); assert.equal(f.storageCalls(), 0);
    }
  });
}

test("omitted PATCH description preserves existing text; null explicitly clears it", async () => {
  const f = setup();
  assert.equal((await save(f, "patch", undefined)).data.description, "Original");
  assert.equal((await save(f, "patch", null)).data.description, null);
});

test("validator permits omitted descriptions and counts raw input like textarea maxLength", () => {
  const { validateDescription } = setup().load("lib/menu-validation.ts");
  assert.equal(validateDescription(undefined), null); assert.equal(validateDescription(null), null);
  assert.equal(validateDescription("😀".repeat(500)).length, 1000);
  for (const value of [" ".repeat(1001), "ก".repeat(1000) + " ", "😀".repeat(501)]) {
    assert.throws(() => validateDescription(value), error => error.status === 400);
  }
});
