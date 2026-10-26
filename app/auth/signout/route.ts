import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function browserOrigin(request: Request): string | null {
  const url = new URL(request.url);
  // Next.js may use its internal bind address in request.url. Match the browser's
  // Host instead, without accepting arbitrary X-Forwarded-Host/Proto headers.
  const host = request.headers.get("host") ?? url.host;
  if (!host || /[/\\@?#,\s]/.test(host)) return null;
  try {
    return new URL(url.protocol + "//" + host).origin;
  } catch {
    return null;
  }
}

// GET/HEAD are intentionally absent: Next.js returns 405 without signing out.
export async function POST(request: Request) {
  const origin = browserOrigin(request);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || request.headers.get("origin") !== origin ||
    (fetchSite !== null && fetchSite !== "same-origin")) {
    return NextResponse.json({ success: false, error: "แหล่งที่มาของคำขอไม่ถูกต้อง กรุณาออกจากระบบผ่านปุ่มในเว็บไซต์" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return NextResponse.redirect(new URL("/owner/login", origin), {
      status: 303, headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ success: false, error: "ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
