import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { checkOwnerRestaurant, signInWithGoogleOwner } from "@/app/actions/owner-auth";
import OwnerLoginForm from "./owner-login-form";

interface OwnerLoginPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Owner Login Page (Server Component).
 * Checks if an active session already exists and performs deterministic redirect.
 * Otherwise, renders the OwnerLoginForm integrated with the Google OAuth Server Action.
 */
export default async function OwnerLoginPage({ searchParams }: OwnerLoginPageProps) {
  const params = await searchParams;
  const rawError = params.error;
  const authError = typeof rawError === "string" ? rawError : null;

  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Server-Side Check: Check if owner is already authenticated
  if (isConfigured) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const restaurant = await checkOwnerRestaurant();
        if (restaurant) {
          redirect("/owner/dashboard");
        } else {
          redirect("/owner/onboarding");
        }
      }
    } catch (err: unknown) {
      // Re-throw redirect exceptions from Next.js
      if (
        err &&
        typeof err === "object" &&
        "message" in err &&
        typeof (err as { message: unknown }).message === "string" &&
        (err as { message: string }).message.includes("NEXT_REDIRECT")
      ) {
        throw err;
      }
      console.error("Error verifying owner session on login page:", err);
    }
  }

  return (
    <OwnerLoginForm
      authError={authError}
      isConfigured={isConfigured}
      onSignInAction={signInWithGoogleOwner}
    />
  );
}
