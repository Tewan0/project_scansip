import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";

function setup(role = "new-user") {
  const f = fixture(role, {}, { console: { ...console, error() {} } });
  return { ...f, ...f.load("app/actions/owner-auth.ts") };
}
function form(input) {
  const data = new FormData();
  for (const [key, value] of Object.entries(input)) data.set(key, value);
  return data;
}
const valid = { name: "Cafe", slug: "new-cafe" };

for (const [field, value] of [
  ["name", " "], ["name", "a".repeat(101)], ["name", 123],
  ["slug", "a".repeat(101)], ["slug", 123], ["slug", null], ["slug", "!!!"],
  ["openingTime", "25:99"], ["openingTime", "9:30"], ["openingTime", ""],
  ["closingTime", "invalid"], ["closingTime", null], ["closingTime", 1800],
  ["promptpayNumber", "not-a-number"], ["promptpayNumber", "1234567890"], ["promptpayNumber", 123],
  ["logoUrl", 123], ["logoUrl", "https://other.example/logo.png"],
]) {
  test("onboarding rejects invalid " + field + ": " + JSON.stringify(value), async () => {
    const f = setup();
    const before = JSON.stringify(f.state);
    const result = await f.createStoreOnboarding({ ...valid, [field]: value });
    assert.equal(result.success, false);
    assert.ok(result.error);
    assert.equal(JSON.stringify(f.state), before);
    assert.equal(f.writes.length, 0);
  });
}

test("onboarding rejects malformed payloads and File values in FormData", async () => {
  for (const input of [null, undefined, [], "Cafe", {}, form({ ...valid, slug: "a".repeat(101) }),
    form({ ...valid, openingTime: "25:99" }), form({ ...valid, promptpayNumber: "abc" }),
    ...["name", "slug", "openingTime", "closingTime", "promptpayNumber", "logoUrl"].map(key =>
      form({ ...valid, [key]: new File(["abc"], "value.txt") }))]) {
    const f = setup();
    assert.equal((await f.createStoreOnboarding(input)).success, false);
    assert.equal(f.writes.length, 0);
  }
});

test("object and FormData creation normalize valid values and allow overnight hours", async () => {
  for (const convert of [input => input, form]) {
    const f = setup();
    const result = await f.createStoreOnboarding(convert({ name: "  Cafe  ", slug: " My Cafe ",
      promptpayNumber: "089-123-4567", openingTime: "18:00", closingTime: "02:00" }));
    assert.equal(result.success, true);
    const store = f.state.stores.at(-1);
    assert.equal(store.name, "Cafe");
    assert.equal(store.slug, "my-cafe");
    assert.equal(store.promptPayNumber, "0891234567");
    assert.equal(store.openingTime, "18:00");
    assert.equal(store.closingTime, "02:00");
    assert.equal(store.currency, "THB");
    assert.equal(store.ownerId, "new-user");
    assert.equal(f.state.staff.at(-1).role, "owner");
    assert.ok(f.state.categories.length > 0);
    assert.equal(result.redirectUrl, "/owner/dashboard");
  }
});

test("100-character names and explicit or generated slugs work with onboarding defaults", async () => {
  for (const slug of ["a".repeat(100), "", undefined]) {
    const f = setup();
    const result = await f.createStoreOnboarding({ name: "a".repeat(100), slug });
    assert.equal(result.success, true);
    const store = f.state.stores.at(-1);
    assert.equal(store.slug, "a".repeat(100));
    assert.equal(store.openingTime, "08:00");
    assert.equal(store.closingTime, "18:00");
    assert.equal(store.promptPayNumber, null);
  }
  const f = setup();
  assert.equal((await f.createStoreOnboarding({ name: "a".repeat(101), slug: "" })).success, false);
  assert.equal(f.writes.length, 0);
});

test("Thai names, generated fallback slugs and optional PromptPay identifiers remain supported", async () => {
  for (const [name, promptpayNumber] of [["ร้านกาแฟ", "1234567890123"], ["!!!", null], ["Cafe", ""]]) {
    const f = setup();
    const result = await f.createStoreOnboarding({ name, slug: "", promptpayNumber });
    assert.equal(result.success, true);
    assert.ok(result.store.slug.length > 0 && result.store.slug.length <= 100);
    assert.equal(result.store.promptPayNumber, promptpayNumber || null);
    if (name === "ร้านกาแฟ") assert.equal(result.store.slug, name);
  }
});

test("slug availability uses the same limit and normalization as creation", async () => {
  const f = setup();
  for (const slug of ["a".repeat(101), "", "!!!", null, undefined, 123]) {
    assert.equal((await f.checkSlugAvailability(slug)).available, false);
  }
  assert.equal((await f.checkSlugAvailability("a".repeat(100))).available, true);
  assert.equal((await f.checkSlugAvailability(" CAFE A ")).available, false);
  assert.equal((await f.checkSlugAvailability(" My Cafe ")).slug, "my-cafe");
});

test("duplicate slugs, existing owners and unauthorized users cannot create another store", async () => {
  for (const [role, slug] of [["new-user", "cafe-a"], ["owner", "new-cafe"], ["anonymous", "new-cafe"], ["cashier", "new-cafe"]]) {
    const f = setup(role);
    assert.equal((await f.createStoreOnboarding({ ...valid, slug })).success, false);
    assert.equal(f.writes.length, 0);
  }
});

test("database failures are not returned to onboarding or slug availability callers", async () => {
  const f = setup();
  f.db.transaction = async () => { throw new Error("SQL INSERT stores secret-parameters internal-constraint"); };
  const result = await f.createStoreOnboarding(valid);
  assert.equal(result.success, false);
  assert.ok(result.error);
  assert.doesNotMatch(result.error, /SQL|secret|internal-constraint/);
  assert.equal(f.state.stores.length, 2);
  f.db.select = () => { throw new Error("SQL SELECT secret-parameters"); };
  const availability = await f.checkSlugAvailability("new-cafe");
  assert.equal(availability.available, false);
  assert.doesNotMatch(availability.error, /SQL|secret/);
});
