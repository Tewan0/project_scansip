import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { checkOwnerRestaurant } from "@/app/actions/owner-auth";
import OwnerOnboardingForm from "./owner-onboarding-form";

/**
 * Owner Onboarding Page (Server Component).
 * Route Protection:
 * - Unauthenticated users are redirected to /owner/login.
 * - Authenticated owners who already registered their restaurant are redirected to /owner/dashboard.
 */
export default async function OwnerOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/owner/login");
  }

  // Server-side check: If already onboarded, send directly to dashboard
  const restaurant = await checkOwnerRestaurant();
  if (restaurant) {
    redirect("/owner/dashboard");
  }

  return <OwnerOnboardingForm userEmail={user.email} />;
}
