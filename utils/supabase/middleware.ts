import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh auth token if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isOwnerRoute = pathname.startsWith("/owner");
  const isOwnerLogin = pathname === "/owner/login";

  // Helper function to create redirect with preserved cookies
  const createRedirectWithCookies = (targetUrl: URL) => {
    if (targetUrl.hostname === "0.0.0.0") {
      targetUrl.hostname = "localhost";
    }
    const hostHeader = request.headers.get("host");
    if (hostHeader && !hostHeader.startsWith("0.0.0.0")) {
      targetUrl.host = hostHeader;
    }
    const redirectResponse = NextResponse.redirect(targetUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  };

  // 1. If accessing /owner/login while already logged in, redirect to dashboard or onboarding
  if (isOwnerLogin && user) {
    try {
      const { db } = await import("@/db");
      const { stores } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");

      const userStores = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.ownerId, user.id))
        .limit(1);

      const targetPath = userStores.length > 0 ? "/owner/dashboard" : "/owner/onboarding";
      return createRedirectWithCookies(new URL(targetPath, request.url));
    } catch (err) {
      console.error("Middleware /owner/login check error:", err);
    }
  }

  // 2. Protect all other /owner/* routes
  if (isOwnerRoute && !isOwnerLogin) {
    // If not authenticated, redirect to /owner/login
    if (!user) {
      const loginUrl = new URL("/owner/login", request.url);
      return createRedirectWithCookies(loginUrl);
    }

    // Authenticated user attempting to access /owner/dashboard without a store -> redirect to /owner/onboarding
    if (pathname === "/owner/dashboard") {
      try {
        const { db } = await import("@/db");
        const { stores } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");

        const userStores = await db
          .select({ id: stores.id })
          .from(stores)
          .where(eq(stores.ownerId, user.id))
          .limit(1);

        if (userStores.length === 0) {
          return createRedirectWithCookies(new URL("/owner/onboarding", request.url));
        }
      } catch (err) {
        console.error("Middleware store check error for /owner/dashboard:", err);
      }
    }

    // Authenticated user attempting to access /owner/onboarding when store already exists -> redirect to /owner/dashboard
    if (pathname === "/owner/onboarding") {
      try {
        const { db } = await import("@/db");
        const { stores } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");

        const userStores = await db
          .select({ id: stores.id })
          .from(stores)
          .where(eq(stores.ownerId, user.id))
          .limit(1);

        if (userStores.length > 0) {
          return createRedirectWithCookies(new URL("/owner/dashboard", request.url));
        }
      } catch (err) {
        console.error("Middleware store check error for /owner/onboarding:", err);
      }
    }
  }

  return supabaseResponse;
}
