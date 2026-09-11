import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { checkOwnerRestaurant, signOutOwner } from "@/app/actions/owner-auth";

/**
 * Owner Dashboard Page (Server Component).
 * Route Protection:
 * - Unauthenticated users are redirected to /owner/login.
 * - Authenticated users without a registered restaurant are redirected to /owner/onboarding.
 */
export default async function OwnerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/owner/login");
  }

  // Server-side check: must have a registered restaurant to access owner dashboard
  const restaurant = await checkOwnerRestaurant();
  if (!restaurant) {
    redirect("/owner/onboarding");
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-surface-card rounded-xl border border-border-subtle p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {restaurant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="w-16 h-16 rounded-xl object-cover border border-border-subtle shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-xs shrink-0">
                <span className="material-symbols-outlined text-3xl">storefront</span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
                  {restaurant.name}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary-container text-primary">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  Verified Cafe
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Owner ID: <span className="font-mono text-[11px]">{restaurant.owner_user_id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-secondary-container text-primary rounded-lg font-label-md text-label-md font-bold hover:bg-secondary-container/80 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              POS App
            </Link>

            <form action={signOutOwner}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-border-subtle text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg font-label-md text-label-md transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Cafe Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* PromptPay Card */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                PromptPay Payment
              </span>
              <span className="material-symbols-outlined text-primary text-[20px]">
                payments
              </span>
            </div>
            <p className="text-xl font-bold text-on-surface">
              {restaurant.promptpay_number || "Not Configured"}
            </p>
            <p className="font-body-sm text-[11px] text-on-surface-variant mt-1">
              {restaurant.promptpay_number
                ? "Active for dynamic QR table billing"
                : "Add in settings to enable QR payments"}
            </p>
          </div>

          {/* Account Status Card */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Google Account
              </span>
              <span className="material-symbols-outlined text-primary text-[20px]">
                account_circle
              </span>
            </div>
            <p className="text-base font-semibold text-on-surface truncate">
              {user.email}
            </p>
            <p className="font-body-sm text-[11px] text-on-surface-variant mt-1">
              Logged in via Supabase Google OAuth
            </p>
          </div>

          {/* Created Date Card */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">
                Registered On
              </span>
              <span className="material-symbols-outlined text-primary text-[20px]">
                calendar_today
              </span>
            </div>
            <p className="text-base font-semibold text-on-surface">
              {new Date(restaurant.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
            <p className="font-body-sm text-[11px] text-on-surface-variant mt-1">
              RLS Policy: Owner Full Access
            </p>
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            href="/dashboard/menu"
            className="bg-surface-card hover:bg-surface-container-low border border-border-subtle rounded-xl p-4 transition-colors flex flex-col items-center text-center gap-2 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-secondary-container/60 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">restaurant_menu</span>
            </div>
            <span className="font-label-md text-label-md font-semibold text-on-surface">
              Manage Menu
            </span>
          </Link>

          <Link
            href="/dashboard/orders"
            className="bg-surface-card hover:bg-surface-container-low border border-border-subtle rounded-xl p-4 transition-colors flex flex-col items-center text-center gap-2 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-secondary-container/60 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">receipt_long</span>
            </div>
            <span className="font-label-md text-label-md font-semibold text-on-surface">
              Live Orders
            </span>
          </Link>

          <Link
            href="/dashboard/qr-code"
            className="bg-surface-card hover:bg-surface-container-low border border-border-subtle rounded-xl p-4 transition-colors flex flex-col items-center text-center gap-2 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-secondary-container/60 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">qr_code</span>
            </div>
            <span className="font-label-md text-label-md font-semibold text-on-surface">
              Table QR Codes
            </span>
          </Link>

          <Link
            href="/dashboard/settings"
            className="bg-surface-card hover:bg-surface-container-low border border-border-subtle rounded-xl p-4 transition-colors flex flex-col items-center text-center gap-2 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-secondary-container/60 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">settings</span>
            </div>
            <span className="font-label-md text-label-md font-semibold text-on-surface">
              Cafe Settings
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
