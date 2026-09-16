import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const role = searchParams.get("role");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const rawHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    origin;
  const safeHost = rawHost.replace("0.0.0.0", "localhost");
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (request.url.startsWith("https") ? "https" : "http");
  const baseHost = safeHost.startsWith("http")
    ? safeHost
    : `${proto}://${safeHost}`;

  if (errorParam) {
    const loginPath = role === "owner" ? "/owner/login" : "/";
    return NextResponse.redirect(
      `${baseHost}${loginPath}?error=${encodeURIComponent(errorDescription || errorParam)}`
    );
  }

  if (code) {
    const response = NextResponse.redirect(`${baseHost}/owner/dashboard`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      // Query stores table via pure Drizzle ORM
      const userStores = await db
        .select()
        .from(stores)
        .where(eq(stores.ownerId, data.user.id))
        .limit(1);

      // Routing Logic:
      // No store found: Redirect user to /owner/onboarding
      // Store found: Redirect user to /owner/dashboard
      const targetPath = userStores.length > 0 ? "/owner/dashboard" : "/owner/onboarding";

      return NextResponse.redirect(`${baseHost}${targetPath}`, {
        headers: response.headers,
      });
    }

    if (error) {
      console.error("Supabase exchangeCodeForSession error:", error.message);
      const loginPath = role === "owner" ? "/owner/login" : "/";
      return NextResponse.redirect(
        `${baseHost}${loginPath}?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  return NextResponse.redirect(`${baseHost}/owner/login?error=no_auth_code_provided`);
}
