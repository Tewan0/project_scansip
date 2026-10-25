import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";

function browser(initial = {}) {
  const values = new Map(Object.entries(initial));
  const window = Object.assign(new EventTarget(), {
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  });
  return { window, values, change(key, value) {
    if (key === null) values.clear();
    else if (value === null) values.delete(key);
    else values.set(key, value);
    window.dispatchEvent(Object.assign(new Event("storage"), { key }));
  } };
}

test("sound preferences restore, persist, follow storage changes and unsubscribe on unmount", () => {
  const b = browser({ kitchen_sound_enabled: "false" });
  const { createPreferenceStore, BOOLEAN_PREFERENCES } = fixture("anonymous", {}, { window: b.window }).load("hooks/use-stored-preference.ts");
  const store = createPreferenceStore("kitchen_sound_enabled", "true", BOOLEAN_PREFERENCES);
  assert.equal(store.getServerSnapshot(), "true");
  assert.equal(store.getSnapshot(), "false");
  let changes = 0;
  const unsubscribe = store.subscribe(() => changes++);
  store.setValue("true");
  assert.equal(store.getSnapshot(), "true");
  assert.equal(b.values.get("kitchen_sound_enabled"), "true");
  assert.equal(changes, 1);
  b.change("another-key", "false");
  assert.equal(changes, 1);
  b.change("kitchen_sound_enabled", "false");
  assert.equal(changes, 2);
  assert.equal(store.getSnapshot(), "false");
  b.change(null);
  assert.equal(store.getSnapshot(), "true");
  unsubscribe();
  b.change("kitchen_sound_enabled", "false");
  assert.equal(changes, 3);
  assert.equal(createPreferenceStore("kitchen_sound_enabled", "true", BOOLEAN_PREFERENCES).getSnapshot(), "false");
});

test("blocked storage still allows sound controls to change in memory, including blocked writes only", () => {
  for (const readsBlocked of [false, true]) {
    const window = Object.assign(new EventTarget(), { localStorage: {
      getItem() { if (readsBlocked) throw Error("Blocked"); return "true"; },
      setItem() { throw Error("Blocked"); },
    } });
    const { createPreferenceStore, BOOLEAN_PREFERENCES } = fixture("anonymous", {}, { window }).load("hooks/use-stored-preference.ts");
    const store = createPreferenceStore("service_sound_enabled", "true", BOOLEAN_PREFERENCES);
    assert.equal(store.getSnapshot(), "true");
    store.setValue("false");
    assert.equal(store.getSnapshot(), "false");
    store.setValue("true");
    assert.equal(store.getSnapshot(), "true");
  }
});

test("unknown stored sound types fall back safely and server snapshots never access localStorage", () => {
  const b = browser({ kitchen_sound_type: "unsupported" });
  const { createPreferenceStore } = fixture("anonymous", {}, { window: b.window }).load("hooks/use-stored-preference.ts");
  const store = createPreferenceStore("kitchen_sound_type", "melody", ["melody", "dingdong", "marimba"]);
  assert.equal(store.getSnapshot(), "melody");
  store.setValue("marimba");
  assert.equal(store.getSnapshot(), "marimba");
  store.setValue("unsupported");
  assert.equal(store.getSnapshot(), "marimba");
  const server = fixture().load("hooks/use-stored-preference.ts").createPreferenceStore("sound", "true", ["true", "false"]);
  assert.equal(server.getServerSnapshot(), "true");
});

test("mobile layout follows matchMedia changes, has a stable server default and cleans up its subscription", () => {
  const media = Object.assign(new EventTarget(), { matches: true });
  let callbacks;
  const react = { useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
    callbacks = { subscribe, getSnapshot, getServerSnapshot };
    return getSnapshot();
  } };
  const f = fixture("anonymous", { react }, { window: { matchMedia(query) {
    assert.equal(query, "(max-width: 767px)");
    return media;
  } } });
  assert.equal(f.load("hooks/use-mobile.ts").useIsMobile(), true);
  assert.equal(callbacks.getServerSnapshot(), false);
  let changed = 0;
  const unsubscribe = callbacks.subscribe(() => changed++);
  media.matches = false;
  media.dispatchEvent(new Event("change"));
  assert.equal(callbacks.getSnapshot(), false);
  assert.equal(changed, 1);
  unsubscribe();
  media.dispatchEvent(new Event("change"));
  assert.equal(changed, 1);
});
