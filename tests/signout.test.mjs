import { test } from "node:test";
import assert from "node:assert/strict";
import { autoImplementMethods } from "next/dist/server/route-modules/app-route/helpers/auto-implement-methods.js";
import { fixture } from "./helpers.mjs";

const site = "https://project-scansip.vercel.app";
function setup(failure) {
  const calls = { clients: 0, signouts: 0 };
  const f = fixture("owner", { "@/utils/supabase/server": {
    async createClient() {
      calls.clients++;
      if (failure === "client") throw new Error("private client configuration");
      return { auth: { async signOut() {
        calls.signouts++;
        if (failure === "throw") throw new Error("private auth token");
        return { error: failure === "error" ? new Error("private upstream details") : null };
      } } };
    },
  } });
  return { calls, methods: autoImplementMethods(f.load("app/auth/signout/route.ts")) };
}
function post(headers = {}, url = site + "/auth/signout") {
  return new Request(url, { method: "POST", headers });
}

test("GET, HEAD and other unsupported methods cannot sign out; OPTIONS advertises only POST", async () => {
  const f = setup();
  for (const method of ["GET", "HEAD", "PUT", "PATCH", "DELETE"]) {
    const response = await f.methods[method](new Request(site + "/auth/signout", { method, headers: { Origin: site } }));
    assert.equal(response.status, 405, method);
  }
  const options = await f.methods.OPTIONS(new Request(site + "/auth/signout", { method: "OPTIONS" }));
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("Allow"), "OPTIONS, POST");
  assert.deepEqual(f.calls, { clients: 0, signouts: 0 });
});

test("same-origin form POST signs out once and redirects to login without caching", async () => {
  for (const fetchSite of [undefined, "same-origin"]) {
    const f = setup();
    const headers = { Origin: site, "Content-Type": "application/x-www-form-urlencoded" };
    if (fetchSite) headers["Sec-Fetch-Site"] = fetchSite;
    const response = await f.methods.POST(post(headers));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), site + "/owner/login");
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(f.calls, { clients: 1, signouts: 1 });
  }
});

test("POST rejects missing, null, malformed and foreign origins before touching Auth", async () => {
  for (const origin of [undefined, "null", "", "https://evil.example", "http://project-scansip.vercel.app",
    site + ":444", site + "/", site + ".evil.example", site + " https://evil.example"]) {
    const f = setup();
    const response = await f.methods.POST(post(origin === undefined ? {} : { Origin: origin }));
    assert.equal(response.status, 403, String(origin));
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(f.calls, { clients: 0, signouts: 0 });
  }
});

test("cross-site and same-site fetch metadata never authorize a logout", async () => {
  for (const fetchSite of ["cross-site", "same-site", "none"]) {
    const f = setup();
    assert.equal((await f.methods.POST(post({ Origin: site, "Sec-Fetch-Site": fetchSite }))).status, 403);
    assert.deepEqual(f.calls, { clients: 0, signouts: 0 });
  }
});

test("browser Host supports localhost, LAN, IPv6 and deployment hosts despite internal bind URL", async () => {
  for (const [url, host, origin] of [
    ["http://0.0.0.0:3000/auth/signout", "localhost:3000", "http://localhost:3000"],
    ["http://0.0.0.0:3000/auth/signout", "127.0.0.1:3000", "http://127.0.0.1:3000"],
    ["http://0.0.0.0:3000/auth/signout", "192.168.1.5:3000", "http://192.168.1.5:3000"],
    ["http://[::]:3000/auth/signout", "[::1]:3000", "http://[::1]:3000"],
    ["https://internal.example/auth/signout", "project-scansip.vercel.app", site],
    ["https://preview.example/auth/signout", "preview.example", "https://preview.example"],
  ]) {
    const f = setup();
    const response = await f.methods.POST(post({ Host: host, Origin: origin }, url));
    assert.equal(response.status, 303, host);
    assert.equal(response.headers.get("Location"), origin + "/owner/login");
    assert.deepEqual(f.calls, { clients: 1, signouts: 1 });
  }
});

test("forged forwarding headers cannot authorize logout or change its redirect", async () => {
  const attacks = [
    { Origin: "https://evil.example", "X-Forwarded-Host": "evil.example" },
    { Origin: "http://project-scansip.vercel.app", "X-Forwarded-Proto": "http" },
    { Origin: "https://evil.example", Host: "project-scansip.vercel.app@evil.example" },
    { Origin: site, Host: "project-scansip.vercel.app/path" },
    { Origin: site, Host: "project-scansip.vercel.app,evil.example" },
    { Origin: site, Host: "project-scansip.vercel.app?other" },
    { Origin: site, Host: "project-scansip.vercel.app#other" },
    { Origin: site, Host: "project-scansip.vercel.app:bad-port" },
  ];
  for (const headers of attacks) {
    const f = setup();
    assert.equal((await f.methods.POST(post(headers))).status, 403, JSON.stringify(headers));
    assert.deepEqual(f.calls, { clients: 0, signouts: 0 });
  }
  const f = setup();
  const response = await f.methods.POST(post({ Origin: site, "X-Forwarded-Host": "evil.example", "X-Forwarded-Proto": "http" }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), site + "/owner/login");
});

test("Auth failures return a safe retryable error instead of a success redirect", async () => {
  for (const failure of ["client", "error", "throw"]) {
    const f = setup(failure);
    const response = await f.methods.POST(post({ Origin: site }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Location"), null);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.doesNotMatch(await response.text(), /private|token|configuration|upstream/);
  }
});
