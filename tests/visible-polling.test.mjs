import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";

test("polling pauses in hidden/offline pages, refreshes on resume and removes listeners", () => {
  const window = new EventTarget(), document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const navigator = { onLine: true }; let tick, count = 0, cleared = false;
  const f = fixture("anonymous", {}, { window, document, navigator,
    setInterval(fn) { tick = fn; return 4; }, clearInterval(id) { assert.equal(id, 4); cleared = true; } });
  const stop = f.load("lib/visible-polling.ts").startVisiblePolling(() => count++, 8000);
  tick(); assert.equal(count, 1);
  document.visibilityState = "hidden"; tick(); window.dispatchEvent(new Event("online")); assert.equal(count, 1);
  document.visibilityState = "visible"; document.dispatchEvent(new Event("visibilitychange")); assert.equal(count, 2);
  navigator.onLine = false; tick(); assert.equal(count, 2);
  navigator.onLine = true; window.dispatchEvent(new Event("online")); assert.equal(count, 3);
  stop(); assert.equal(cleared, true);
  window.dispatchEvent(new Event("online")); document.dispatchEvent(new Event("visibilitychange")); assert.equal(count, 3);
});

test("refresh status distinguishes offline, failed update and successful timestamp without claiming server connectivity", () => {
  let online = true;
  const react = { useSyncExternalStore: (_subscribe, read) => read() };
  const f = fixture("anonymous", { react }, { navigator: { get onLine() { return online; } } });
  const Status = f.load("components/refresh-status.tsx").RefreshStatus;
  const text = node => typeof node === "string" ? node : Array.isArray(node) ? node.map(text).join("") : node?.props ? text(node.props.children) : "";
  const stamp = Date.parse("2026-10-25T00:00:00Z");
  assert.match(text(Status({ updatedAt: stamp, failed: false })), /อัปเดตล่าสุด/);
  assert.match(text(Status({ updatedAt: stamp, failed: true })), /อัปเดตไม่สำเร็จ/);
  online = false;
  assert.match(text(Status({ updatedAt: stamp, failed: false })), /ออฟไลน์/);
});
