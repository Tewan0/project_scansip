import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";

const limit = 8 * 1024;
function setup(endpoint, role = "owner") {
  const removed = [];
  const f = fixture(role, { "./admin": { createAdminClient: () => ({ storage: { from: bucket => ({
    async remove(paths) { removed.push({ bucket, paths: Array.from(paths) }); return { error: null }; },
  }) } }) } }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://storage.example" } } });
  f.state.tables.push({ id: "table-a", storeId: "shop-a", tableNumber: 1, status: "occupied", currentSessionToken: "round-a", sessionStartedAt: new Date() });
  const body = endpoint === "service"
    ? { storeSlug: "cafe-a", tableNumber: 1, sessionToken: "round-a", kind: "assistance" }
    : { url: "https://storage.example/storage/v1/object/public/restaurant-logos/" + role + "/logo.png" };
  const send = endpoint === "service" ? f.load("app/api/customer/requests/route.ts").POST : f.load("app/api/upload/route.ts").DELETE;
  return { ...f, removed, body, send };
}
function rawRequest(body, headers = { "Content-Type": "application/json" }) {
  return new Request("http://localhost/api/test", { method: "POST", body, headers });
}
function trackedStream(headers) {
  let pulled = 0, cancelled = false;
  const body = new ReadableStream({
    pull(controller) { pulled++; controller.enqueue(new Uint8Array(1024)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const req = new Request("http://localhost/api/test", { method: "POST", headers, body, duplex: "half" });
  return { req, pulls: () => pulled, cancelled: () => cancelled };
}
function unchanged(f) { assert.equal(f.writes.length, 0); assert.equal(f.removed.length, 0); }

for (const endpoint of ["service", "delete"]) {
  test(endpoint + " rejects wrong media type and oversized declared length before reading", async () => {
    for (const [headers, status] of [
      [{}, 415], [{ "Content-Type": "text/plain" }, 415],
      [{ "Content-Type": "application/json", "Content-Length": String(limit + 1) }, 413],
      [{ "Content-Type": "application/json", "Content-Length": "invalid" }, 400],
    ]) {
      const f = setup(endpoint), stream = trackedStream(headers);
      const res = await f.send(stream.req);
      assert.equal(res.status, status); assert.equal(stream.pulls(), 0); unchanged(f);
    }
  });

  test(endpoint + " cancels oversized streams without trusting Content-Length", async () => {
    for (const length of [undefined, "1"]) {
      const f = setup(endpoint), headers = { "Content-Type": "application/json" };
      if (length !== undefined) headers["Content-Length"] = length;
      const stream = trackedStream(headers);
      assert.equal((await f.send(stream.req)).status, 413);
      assert.equal(stream.cancelled(), true);
      assert.equal(stream.pulls(), 9, "stop on the first chunk above 8 KiB");
      unchanged(f);
    }
  });

  test(endpoint + " rejects invalid JSON and non-object bodies as 400", async () => {
    for (const body of ["", "{", "null", "[]", "5", '"text"']) {
      const f = setup(endpoint);
      assert.equal((await f.send(rawRequest(body))).status, 400);
      unchanged(f);
    }
  });

  test(endpoint + " accepts JSON at the byte limit and rejects one extra byte", async () => {
    for (const extra of [0, 1]) {
      const f = setup(endpoint);
      // Thai text ensures byte counts, rather than JavaScript character counts, govern the limit.
      const json = JSON.stringify({ ...f.body, note: "ภาษาไทย" });
      const body = json + " ".repeat(limit - Buffer.byteLength(json) + extra);
      assert.equal(Buffer.byteLength(body), limit + extra);
      const res = await f.send(rawRequest(body, { "Content-Type": "application/json; charset=utf-8" }));
      assert.equal(res.status, extra ? 413 : 200);
      if (extra) unchanged(f);
      else if (endpoint === "service") assert.equal(f.state.serviceRequests.length, 1);
      else assert.equal(f.removed.length, 1);
    }
  });
}

test("service body errors do not pretend the QR expired; an invalid QR still fails after parsing", async () => {
  const f = setup("service", "anonymous");
  const oversize = await f.send(rawRequest(JSON.stringify({ ...f.body, pad: "a".repeat(limit) })));
  assert.equal(oversize.status, 413);
  assert.equal((await oversize.json()).sessionExpired, undefined);
  assert.match(oversize.headers.get("cache-control"), /no-store/);
  const invalidQr = await f.send(rawRequest(JSON.stringify({ ...f.body, sessionToken: "wrong" })));
  assert.equal(invalidQr.status, 403);
  assert.equal((await invalidQr.json()).sessionExpired, true);
  unchanged(f);
  assert.equal((await f.send(rawRequest(JSON.stringify(f.body)))).status, 200);
});

test("unauthenticated users and staff cannot make DELETE read a body or contact Storage", async () => {
  for (const role of ["anonymous", "cashier", "kitchen"]) {
    const f = setup("delete", role), stream = trackedStream({ "Content-Type": "application/json" });
    assert.equal((await f.send(stream.req)).status, role === "anonymous" ? 401 : 403);
    assert.equal(stream.pulls(), 0); unchanged(f);
  }
});

test("DELETE preserves bucket and ownership restrictions for onboarding and owners", async () => {
  for (const role of ["new-user", "owner"]) {
    for (const bucket of ["restaurant-logos", "menu-photos"]) {
      const f = setup("delete", role);
      const url = "https://storage.example/storage/v1/object/public/" + bucket + "/" + role + "/photo.png";
      const res = await f.send(rawRequest(JSON.stringify({ bucket, url })));
      const allowed = role === "owner" || bucket === "restaurant-logos";
      assert.equal(res.status, allowed ? 200 : 403);
      assert.equal(f.removed.length, allowed ? 1 : 0);
      if (allowed) assert.deepEqual(f.removed[0], { bucket, paths: [role + "/photo.png"] });
    }
  }
  for (const body of [{}, { url: 123 }, { url: "x", bucket: "private" },
    { url: "https://storage.example/storage/v1/object/public/restaurant-logos/other/logo.png" },
    { url: "https://other.example/storage/v1/object/public/restaurant-logos/owner/logo.png" }]) {
    const f = setup("delete");
    assert.ok((await f.send(rawRequest(JSON.stringify(body)))).status >= 400);
    unchanged(f);
  }
});
