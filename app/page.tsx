import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import LoginOnboarding from "./components/LoginOnboarding";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const authError = typeof params?.error === "string" ? params.error : null;
  const authCode = typeof params?.code === "string" ? params.code : null;

  // If Supabase redirected back with ?code= to the root page, forward directly to /auth/callback
  if (authCode) {
    redirect(`/auth/callback?code=${authCode}`);
  }

  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  let loggedInUser = null;
  if (isConfigured) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        loggedInUser = user;
      }
    } catch {
      loggedInUser = null;
    }
  }

  // If user is already logged in, redirect directly to dashboard
  if (loggedInUser) {
    redirect("/dashboard");
  }

  return (
    <LoginOnboarding
      initialUser={null}
      authError={authError}
      isConfigured={isConfigured}
    />
  );
}
