import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { fixture } from "./helpers.mjs";

const cacheHeaders = { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", Expires: "0", Pragma: "no-cache" };

function authFixture(role, refresh = true) {
  let f;
  f = fixture(role, {
    "@supabase/ssr": {
      createServerClient(_url, _key, { cookies }) {
        function session() {
          if (refresh) cookies.setAll([{ name: "test-auth", value: "refreshed", options: { httpOnly: true, path: "/" } }], cacheHeaders);
          return { data: { user: f.context.user }, error: null };
        }
        return { auth: { getUser: async () => session(), exchangeCodeForSession: async () => session() } };
      },
    },
  });
  return f;
}

test("OAuth ignores requested owner role and preserves refreshed cookies and cache headers", async () => {
  for (const [role, destination] of [["owner", "/owner/dashboard"], ["cashier", "/frontdesk"], ["kitchen", "/kitchen"]]) {
    const f = authFixture(role);
    const response = await f.load("app/auth/callback/route.ts").GET(new NextRequest("http://localhost/auth/callback?code=test&role=owner&next=https://example.com"));
    assert.equal(response.headers.get("location"), "http://localhost" + destination);
    assert.equal(response.cookies.get("test-auth").value, "refreshed");
    for (const [name, value] of Object.entries(cacheHeaders)) assert.equal(response.headers.get(name), value);
  }
});

test("proxy rejects wrong roles and follows role revocation on the next request", async () => {
  const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only";
  try {
    const f = authFixture("cashier"), { updateSession } = f.load("utils/supabase/middleware.ts");
    const response = await updateSession(new NextRequest("http://localhost/dashboard/staff"));
    assert.equal(response.headers.get("location"), "http://localhost/frontdesk");
    assert.equal(response.cookies.get("test-auth").value, "refreshed");
    assert.equal(response.headers.get("cache-control"), cacheHeaders["Cache-Control"]);
    f.state.staff[0].role = "kitchen";
    assert.equal((await updateSession(new NextRequest("http://localhost/frontdesk"))).headers.get("location"), "http://localhost/kitchen");
    f.context.user = null;
    assert.equal((await updateSession(new NextRequest("http://localhost/kitchen"))).headers.get("location"), "http://localhost/owner/login");
    const noRefresh = authFixture("owner", false);
    const api = await noRefresh.load("utils/supabase/middleware.ts").updateSession(new NextRequest("http://localhost/api/orders"));
    assert.equal(api.headers.get("cache-control"), "private, no-store");
  } finally {
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.key;
  }
});


test("pending invitations go to workspace without an access-denied loop", async () => {
  const f = authFixture("new-user");
  f.state.staff.push({ id: "invite-a", storeId: "shop-a", userId: null, email: "staff@example.com", role: "cashier" },
    { id: "invite-b", storeId: "shop-b", userId: null, email: "staff@example.com", role: "kitchen" });
  const callback = await f.load("app/auth/callback/route.ts").GET(new NextRequest("http://localhost/auth/callback?code=test"));
  assert.equal(callback.headers.get("location"), "http://localhost/workspace");
  const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only";
  try {
    const { updateSession } = f.load("utils/supabase/middleware.ts");
    for (const path of ["/workspace", "/owner/onboarding"]) {
      const response = await updateSession(new NextRequest("http://localhost" + path));
      assert.equal(response.headers.get("location"), null);
    }
    const response = await updateSession(new NextRequest("http://localhost/frontdesk"));
    assert.equal(response.headers.get("location"), "http://localhost/workspace");
  } finally {
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.key;
  }
});
