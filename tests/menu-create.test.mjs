import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request } from "./helpers.mjs";
import { imageFile, pngBytes } from "./image-fixtures.mjs";

const categoryId = "11111111-1111-1111-1111-111111111111";
function formRequest(values = {}, image) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: " Coffee ", price: "50", categoryId, description: " Fresh ", ...values })) form.set(key, value);
  if (image !== undefined) form.set("image", image);
  return new Request("http://localhost/api/menu", { method: "POST", body: form });
}
function setup(role = "owner", uploadError = null) {
  const uploads = [], removed = [];
  const storage = {
    async upload(path, bytes, options) { uploads.push({ path, bytes, options }); return { error: uploadError }; },
    getPublicUrl(path) { return { data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/menu-photos/${path}` } }; },
    async remove(paths) { removed.push(...paths); return { error: null }; },
  };
  const f = fixture(role, {
    "@/utils/supabase/admin": { createAdminClient: () => ({ storage: { from(bucket) { assert.equal(bucket, "menu-photos"); return storage; } } }) },
  });
  f.state.categories.push({ id: categoryId, storeId: "shop-a", name: "Drinks" });
  return { ...f, uploads, removed, post: f.load("app/api/menu/route.ts").POST };
}

test("create menu accepts the browser multipart form without an image and returns its category", async () => {
  const f = setup();
  const response = await f.post(formRequest());
  assert.equal(response.status, 201);
  const { data } = await response.json();
  assert.equal(data.name, "Coffee"); assert.equal(data.price, "50.00");
  assert.equal(data.description, "Fresh"); assert.equal(data.imageUrl, null);
  assert.equal(data.category.name, "Drinks"); assert.equal(data.isAvailable, true);
  assert.equal(f.state.menuItems.length, 1); assert.equal(f.uploads.length, 0);
});

test("multipart image is uploaded into the owner's folder and saved on the created menu", async () => {
  const f = setup();
  const response = await f.post(formRequest({}, imageFile()));
  assert.equal(response.status, 201);
  const { data } = await response.json();
  assert.match(f.uploads[0].path, /^owner\/[\da-f-]+\.png$/);
  assert.deepEqual(f.uploads[0].bytes, pngBytes); assert.equal(f.uploads[0].options.upsert, false);
  assert.ok(data.imageUrl.endsWith(f.uploads[0].path)); assert.equal(f.removed.length, 0);
});

test("JSON clients still create menus, including no category and unavailable status", async () => {
  const f = setup();
  const response = await f.post(request({ name: "Tea", price: 0, isAvailable: false }));
  assert.equal(response.status, 201);
  const { data } = await response.json();
  assert.equal(data.category, null); assert.equal(data.price, "0.00"); assert.equal(data.isAvailable, false);
  for (const invalid of [null, [], "menu"]) assert.equal((await f.post(request(invalid))).status, 400);
});

test("invalid menu fields, foreign categories and invalid images never upload or insert", async () => {
  const cases = [
    [{ name: " " }], [{ price: "-1" }], [{ categoryId: "22222222-2222-2222-2222-222222222222" }], [{ isAvailable: "yes" }],
    [{}, "not a file"], [{}, new File(["svg"], "photo.svg", { type: "image/svg+xml" })],
    [{}, new File([], "empty.png", { type: "image/png" })],
    [{}, new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })],
  ];
  for (const [values, image] of cases) {
    const f = setup();
    assert.equal((await f.post(formRequest(values, image))).status, 400);
    assert.equal(f.uploads.length, 0); assert.equal(f.state.menuItems.length, 0);
  }
});

test("failed upload leaves no menu and does not disclose the storage error", async () => {
  const f = setup("owner", { message: "private storage details" });
  const response = await f.post(formRequest({}, imageFile()));
  assert.equal(response.status, 503); assert.equal(f.state.menuItems.length, 0);
  assert.ok(!(await response.text()).includes("private storage details"));
});

test("failed database insert cleans up only the image uploaded by that request", async () => {
  const f = setup();
  f.db.insert = () => { throw new Error("simulated insert failure"); };
  const response = await f.post(formRequest({}, imageFile()));
  assert.equal(response.status, 500); assert.equal(f.state.menuItems.length, 0);
  assert.deepEqual(f.removed, [f.uploads[0].path]);
});

test("non-owners cannot upload or create a menu through multipart", async () => {
  for (const role of ["anonymous", "cashier", "kitchen"]) {
    const f = setup(role);
    assert.equal((await f.post(formRequest())).status, role === "anonymous" ? 401 : 403);
    assert.equal(f.uploads.length, 0); assert.equal(f.state.menuItems.length, 0);
  }
});

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree?.props ? [tree, ...nodes(tree.props.children)] : [];
}
function text(tree) {
  if (typeof tree === "string") return tree;
  if (Array.isArray(tree)) return tree.map(text).join("");
  return tree?.props ? text(tree.props.children) : "";
}

test("real add-menu form reaches the route with and without an image, preserves failures, and blocks double submit", async () => {
  for (const withImage of [false, true]) {
    const backend = setup();
    const slots = []; let cursor = 0, sent = 0;
    const react = {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
        return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
      },
      useRef(value) { return react.useState(() => ({ current: value }))[0]; },
      useEffect() {},
    };
    const ui = names => Object.fromEntries(names.map(name => [name, name]));
    const f = fixture("owner", {
      react, "./EditMenuItemModal": { default: "EditMenuItemModal" },
      "@/components/ui/dialog": ui(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"]),
      "@/components/ui/button": ui(["Button"]), "@/components/ui/badge": ui(["Badge"]),
      "@/components/ui/card": ui(["Card", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"]),
      "@/components/ui/input": ui(["Input"]), "@/components/ui/label": ui(["Label"]), "@/components/ui/skeleton": ui(["Skeleton"]),
    }, {
      fetch: async (url, options) => {
        assert.equal(url, "/api/menu"); sent++;
        return backend.post(new Request("http://localhost/api/menu", options));
      },
    });
    const Page = f.load("app/dashboard/menu/page.tsx").default;
    const render = () => { cursor = 0; return Page(); };
    const find = predicate => nodes(render()).find(predicate);
    find(node => node.type === "Button" && text(node).includes("เพิ่มเมนู")).props.onClick();
    find(node => node.props.id === "menu-name").props.onChange({ target: { value: "Test coffee" } });
    find(node => node.props.id === "menu-price").props.onChange({ target: { value: "-1" } });
    if (withImage) find(node => node.props.type === "file").props.onChange({ target: { files: [imageFile()] } });
    await find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
    assert.ok(find(node => node.props.role === "alert"));
    assert.equal(find(node => node.props.id === "menu-name").props.value, "Test coffee");
    assert.equal(backend.uploads.length, 0);
    find(node => node.props.id === "menu-price").props.onChange({ target: { value: "50" } });
    const description = find(node => node.props.id === "menu-desc");
    assert.equal(description.props.maxLength, 1000);
    description.props.onChange({ target: { value: "ก".repeat(1001) } });
    await find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
    assert.equal(sent, 1); assert.equal(backend.uploads.length, 0);
    assert.equal(find(node => node.props.id === "menu-desc").props.value.length, 1001);
    description.props.onChange({ target: { value: "ก".repeat(1000) } });
    const submit = find(node => node.type === "form").props.onSubmit;
    await Promise.all([submit({ preventDefault() {} }), submit({ preventDefault() {} })]);
    assert.equal(sent, 2); assert.equal(backend.state.menuItems.length, 1);
    assert.equal(backend.uploads.length, withImage ? 1 : 0);
    assert.ok(!find(node => node.type === "form"));
  }
});


test("ambiguous menu insert keeps the image when the row actually committed", async () => {
  const f = setup();
  const insert = f.db.insert;
  f.db.insert = table => ({ values: values => ({ returning: async () => {
    await insert(table).values(values).returning();
    throw Error("private acknowledgement lost");
  } }) });
  const response = await f.post(formRequest({}, imageFile()));
  assert.equal(response.status, 500);
  assert.equal(f.state.menuItems.length, 1);
  assert.ok(f.state.menuItems[0].imageUrl.endsWith(f.uploads[0].path));
  assert.deepEqual(f.removed, []);
  assert.doesNotMatch(await response.text(), /private|acknowledgement/);
});

test("failed menu insert retains its image if checking references is unavailable", async () => {
  const f = setup();
  f.db.insert = () => { throw Error("private insert failure"); };
  f.db.query.menuItems.findFirst = async () => { throw Error("private verification outage"); };
  const response = await f.post(formRequest({}, imageFile()));
  assert.equal(response.status, 500);
  assert.equal(f.uploads.length, 1);
  assert.deepEqual(f.removed, []);
  assert.doesNotMatch(await response.text(), /private|verification/);
});
