import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

async function handleSignOut(request: Request) {
  const supabase = await createClient();

  // Sign out user on Supabase
  await supabase.auth.signOut();

  // Resolve safe origin (avoid 0.0.0.0 binding address which is unroutable in browser)
  const rawHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(request.url).host;
  const safeHost = rawHost.replace("0.0.0.0", "localhost");
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (request.url.startsWith("https") ? "https" : "http");
  const baseHost = `${proto}://${safeHost}`;

  return NextResponse.redirect(`${baseHost}/owner/login`, {
    status: 303, // See Other: convert to GET for redirect
  });
}

export async function POST(request: Request) {
  return handleSignOut(request);
}

export async function GET(request: Request) {
  return handleSignOut(request);
}
