import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * OAuth Callback Route Handler.
 * Exchanges the Google authorization code for a Supabase session,
 * queries the `restaurants` table to check onboarding status,
 * and performs deterministic redirects.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const role = searchParams.get("role");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Determine fallback error redirect target based on the role/context
  const isOwnerFlow = role === "owner";
  const errorRedirectBase = isOwnerFlow ? `${origin}/owner/login` : `${origin}/`;

  // 1. Handle OAuth provider errors returned in query params
  if (errorParam) {
    const errorMsg = errorDescription || errorParam;
    console.error("OAuth provider error received in callback:", errorMsg);
    return NextResponse.redirect(
      `${errorRedirectBase}?error=${encodeURIComponent(errorMsg)}`
    );
  }

  // 2. Validate authorization code presence
  if (!code) {
    console.error("No authorization code found in OAuth callback request.");
    return NextResponse.redirect(
      `${errorRedirectBase}?error=${encodeURIComponent("No authorization code provided.")}`
    );
  }

  try {
    // 3. Exchange code for session using server client
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Supabase exchangeCodeForSession error:", error.message);
      return NextResponse.redirect(
        `${errorRedirectBase}?error=${encodeURIComponent(error.message)}`
      );
    }

    // 4. Verify session context and authenticated user
    const user = data.user;
    if (!user) {
      console.error("No authenticated user found following session exchange.");
      return NextResponse.redirect(
        `${errorRedirectBase}?error=${encodeURIComponent("Failed to establish user session.")}`
      );
    }

    // Determine public URL base (handles custom domains and reverse proxies)
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";
    const hostBase = isLocalEnv
      ? origin
      : forwardedHost
      ? `https://${forwardedHost}`
      : origin;

    // 5. Query the database to check if owner restaurant record exists
    const { data: restaurant, error: dbError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (dbError) {
      console.error("Error querying owner restaurant in auth callback:", dbError.message);
      // Safe fallback: redirect to onboarding to allow restaurant setup
      return NextResponse.redirect(`${hostBase}/owner/onboarding`);
    }

    // 6. Deterministic Routing Rules:
    // - If restaurant DOES NOT exist -> Redirect to /owner/onboarding
    if (!restaurant) {
      return NextResponse.redirect(`${hostBase}/owner/onboarding`);
    }

    // - If restaurant record EXISTS -> Redirect to /owner/dashboard
    return NextResponse.redirect(`${hostBase}/owner/dashboard`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected authentication error occurred.";
    console.error("Unexpected error in auth callback route handler:", err);
    return NextResponse.redirect(
      `${errorRedirectBase}?error=${encodeURIComponent(message)}`
    );
  }
}
