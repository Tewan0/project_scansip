import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { imageFile } from "./image-fixtures.mjs";

const itemId = "11111111-1111-4111-8111-111111111111";
function setup(mode) {
  const uploads = [], removed = [], oldRemoved = [];
  let f, lookupCount = 0;
  const url = path => "https://example.supabase.co/storage/v1/object/public/menu-photos/" + path;
  const storage = {
    async upload(path) { uploads.push(path); return { error: mode === "upload-error" ? new Error("private upload error") : null }; },
    getPublicUrl(path) { return { data: { publicUrl: url(path) } }; },
    async remove(paths) {
      removed.push(...paths);
      if (mode === "cleanup-throw") throw new Error("private cleanup failure");
      return { error: mode === "cleanup-error" ? new Error("private cleanup failure") : null };
    },
  };
  f = fixture("owner", {
    "@/utils/supabase/admin": { createAdminClient: () => ({ storage: { from: () => storage } }) },
    "@/utils/supabase/storage": { async deleteStorageFile(oldUrl) { oldRemoved.push(oldUrl); return true; } },
    "next/cache": { revalidatePath() { if (mode === "revalidate-error") throw new Error("private cache failure"); } },
  }, { console: { ...console, error() {} } });
  f.state.menuItems.push({ id: itemId, storeId: "shop-a", name: "Old coffee", price: "50.00", imageUrl: "old-image", isAvailable: true });
  const originalFind = f.db.query.menuItems.findFirst;
  f.db.query.menuItems.findFirst = async query => {
    lookupCount++;
    if (mode === "verify-error" && lookupCount > 1) throw new Error("private verification error");
    return originalFind(query);
  };
  if (!["success", "upload-error", "revalidate-error"].includes(mode)) {
    f.db.update = () => ({ set: values => ({ where: () => ({ returning: async () => {
      if (mode === "committed") Object.assign(f.state.menuItems[0], values);
      if (mode === "referenced-elsewhere") f.state.menuItems.push({ id: "other-menu", storeId: "shop-a", imageUrl: values.imageUrl });
      if (mode === "deleted") { f.state.menuItems = []; return []; }
      throw new Error("private database failure");
    } }) }) });
  }
  async function edit(withImage = true) {
    const form = new FormData();
    form.set("name", "New coffee"); form.set("price", "60"); form.set("isAvailable", "true");
    if (withImage) form.set("image", imageFile());
    return f.load("app/actions/menu.ts").updateMenuItem(itemId, form);
  }
  return { ...f, uploads, removed, oldRemoved, edit, url };
}

test("failed menu save removes only its newly uploaded unused image and preserves the old image", async () => {
  const f = setup("failed");
  const result = await f.edit();
  assert.equal(result.success, false); assert.equal(result.status, 500);
  assert.equal(f.uploads.length, 1); assert.deepEqual(f.removed, f.uploads);
  assert.deepEqual(f.oldRemoved, []);
  assert.equal(f.state.menuItems[0].imageUrl, "old-image");
  assert.equal(f.state.menuItems[0].name, "Old coffee");
  assert.doesNotMatch(result.error, /private|database/);
});

test("an ambiguous save retains the new image if the database actually committed it", async () => {
  const f = setup("committed");
  assert.equal((await f.edit()).success, false);
  assert.equal(f.state.menuItems[0].imageUrl, f.url(f.uploads[0]));
  assert.deepEqual(f.removed, []); assert.deepEqual(f.oldRemoved, []);
});

test("failed save retains a new upload referenced by another menu in the store", async () => {
  const f = setup("referenced-elsewhere");
  assert.equal((await f.edit()).success, false);
  assert.deepEqual(f.removed, []); assert.deepEqual(f.oldRemoved, []);
});

test("verification outage retains the upload and preserves the original save error", async () => {
  const f = setup("verify-error");
  const result = await f.edit();
  assert.equal(result.status, 500); assert.equal(f.uploads.length, 1);
  assert.deepEqual(f.removed, []); assert.deepEqual(f.oldRemoved, []);
  assert.doesNotMatch(result.error, /private|verification/);
});

test("cleanup failures do not hide the failed save or delete the old image", async () => {
  for (const mode of ["cleanup-error", "cleanup-throw"]) {
    const f = setup(mode), result = await f.edit();
    assert.equal(result.success, false); assert.equal(result.status, 500);
    assert.deepEqual(f.removed, f.uploads); assert.deepEqual(f.oldRemoved, []);
    assert.doesNotMatch(result.error, /private|cleanup/);
  }
});

test("menu deleted during upload reports 404 and cleans the new upload", async () => {
  const f = setup("deleted"), result = await f.edit();
  assert.equal(result.success, false); assert.equal(result.status, 404);
  assert.deepEqual(f.removed, f.uploads); assert.deepEqual(f.oldRemoved, []);
});

test("successful replacement keeps the new file and removes the old image after saving", async () => {
  const f = setup("success"), result = await f.edit();
  assert.equal(result.success, true);
  assert.equal(result.data.imageUrl, f.url(f.uploads[0]));
  assert.equal(f.state.menuItems[0].imageUrl, result.data.imageUrl);
  assert.deepEqual(f.removed, []); assert.deepEqual(f.oldRemoved, ["old-image"]);
});

test("post-save revalidation failure must not remove the committed new image", async () => {
  const f = setup("revalidate-error");
  assert.equal((await f.edit()).success, false);
  assert.equal(f.state.menuItems[0].imageUrl, f.url(f.uploads[0]));
  assert.deepEqual(f.removed, []);
});

test("metadata-only and upload failures do not trigger cleanup of any existing image", async () => {
  const metadata = setup("failed");
  assert.equal((await metadata.edit(false)).success, false);
  assert.deepEqual(metadata.uploads, []); assert.deepEqual(metadata.removed, []); assert.deepEqual(metadata.oldRemoved, []);
  const upload = setup("upload-error");
  assert.equal((await upload.edit()).success, false);
  assert.deepEqual(upload.removed, []); assert.deepEqual(upload.oldRemoved, []);
});
