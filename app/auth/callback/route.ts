import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/?error=${encodeURIComponent(errorDescription || errorParam)}`
    );
  }

  if (code) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";
    const baseHost = isLocalEnv ? origin : forwardedHost ? `https://${forwardedHost}` : origin;

    let response = NextResponse.redirect(`${baseHost}/dashboard`);

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
      // ตรวจสอบว่าผู้ใช้นี้มีร้านค้าแล้วหรือยัง
      const userStore = await db.query.stores.findFirst({
        where: eq(stores.ownerId, data.user.id),
      });

      // ถ้ายังไม่มีร้านค้า ให้ redirect ไปหน้า Onboarding
      const targetUrl = userStore ? `${baseHost}/dashboard` : `${baseHost}/onboarding`;
      return NextResponse.redirect(targetUrl, {
        headers: response.headers,
      });
    }

    if (error) {
      console.error("Supabase exchangeCodeForSession error:", error.message);
      return NextResponse.redirect(
        `${origin}/?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  // If no code, redirect to error state
  return NextResponse.redirect(`${origin}/?error=no_auth_code_provided`);
}
