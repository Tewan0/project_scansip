import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAccessForUser, AccessError } from "@/lib/auth";
import { homeForRole } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin.replace("0.0.0.0", "localhost");
  const response = NextResponse.redirect(new URL("/workspace", origin));
  response.headers.set("Cache-Control", "private, no-store");
  function finish(path: string) {
    const result = NextResponse.redirect(new URL(path, origin));
    response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie.name, cookie.value, cookie));
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(name);
      if (value) result.headers.set(name, value);
    }
    return result;
  }
  if (!code) return finish("/owner/login?error=ไม่สามารถเข้าสู่ระบบได้");
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies, headers) { cookies.forEach(({ name, value, options }) => {
        request.cookies.set(name, value); response.cookies.set(name, value, options);
      }); Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value)); },
    },
  });
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return finish("/owner/login?error=ไม่สามารถเข้าสู่ระบบได้");
  try {
    const access = await getAccessForUser(data.user);
    return finish(access ? homeForRole(access.role) : "/owner/onboarding");
  } catch (error) {
    if (!(error instanceof AccessError)) console.error("Login routing failed:", error);
    return finish("/access-denied");
  }
}
