import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAccessForUser, AccessError } from "@/lib/auth";
import { canAccessPath, homeForRole } from "@/lib/permissions";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const privateResponse = /^\/(api|auth|owner|dashboard|frontdesk|kitchen|workspace|onboarding)(\/|$)/.test(pathname);
  if (privateResponse) response.headers.set("Cache-Control", "private, no-store");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return response;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies, headers) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const login = pathname === "/owner/login";
  const protectedPath = ["/owner", "/dashboard", "/frontdesk", "/kitchen", "/workspace", "/onboarding"]
    .some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
  function redirectTo(target: string) {
    const url = request.nextUrl.clone(); url.pathname = target; url.search = "";
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie.name, cookie.value, cookie));
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(name);
      if (value) redirected.headers.set(name, value);
    }
    return redirected;
  }
  if (!protectedPath) return response;
  if (!user || user.is_anonymous) return login ? response : redirectTo("/owner/login");
  try {
    const access = await getAccessForUser(user);
    if (!access) return ["/workspace", "/owner/onboarding"].includes(pathname) ? response : redirectTo("/workspace");
    if (login || pathname === "/owner/onboarding" || pathname === "/onboarding" || pathname === "/workspace" || !canAccessPath(access.role, pathname)) {
      return redirectTo(homeForRole(access.role));
    }
    return response;
  } catch (error) {
    if (error instanceof AccessError) return redirectTo("/access-denied");
    console.error("Permission lookup failed:", error);
    const unavailable = new NextResponse("ไม่สามารถตรวจสิทธิ์ได้ กรุณาลองใหม่", { status: 503, headers: { "Cache-Control": "private, no-store" } });
    response.cookies.getAll().forEach((cookie) => unavailable.cookies.set(cookie.name, cookie.value, cookie));
    return unavailable;
  }
}
