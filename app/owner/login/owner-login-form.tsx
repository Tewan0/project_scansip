"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface OwnerLoginFormProps {
  authError?: string | null;
  isConfigured: boolean;
  onSignInAction?: () => Promise<void>;
}

export default function OwnerLoginForm({
  authError,
  isConfigured,
}: OwnerLoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const displayError = clientError || authError;

  const handleGoogleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    setIsLoading(true);

    try {
      if (!isConfigured) {
        throw new Error("Supabase environment variables are missing in .env.local");
      }

      // Use the @supabase/ssr browser client so that the PKCE code_verifier
      // is written directly to document.cookie on the exact origin (localhost / domain).
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?role=owner`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during Google Sign In.";
      setClientError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-secondary-container opacity-20 blur-[100px]"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary-container opacity-10 blur-[120px]"></div>
      </div>

      {/* Main Login Card */}
      <main className="w-full max-w-[460px] bg-surface-card rounded-xl border border-border-subtle shadow-[0_4px_16px_rgba(0,0,0,0.06)] relative z-10 overflow-hidden">
        {/* Card Header */}
        <header className="pt-stack-lg px-stack-lg pb-stack-md text-center border-b border-border-subtle bg-surface-bright">
          <div className="flex justify-center mb-stack-sm">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center shadow-xs">
              <span
                className="material-symbols-outlined text-on-primary text-[28px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                local_cafe
              </span>
            </div>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-unit font-bold">
            ScanSip
          </h1>
          <div className="flex items-center justify-center gap-1 text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px]">storefront</span>
            <p className="font-body-md text-body-md">Owner Portal</p>
          </div>
        </header>

        <div className="p-stack-lg">
          {/* Missing Supabase configuration notice */}
          {!isConfigured && (
            <div className="mb-stack-md p-stack-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-600 text-[18px]">
                warning
              </span>
              <div>
                <p className="font-semibold">Supabase Configuration Required</p>
                <p className="text-[11px] text-amber-700">
                  Please specify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
                </p>
              </div>
            </div>
          )}

          {/* Authentication Error Banner */}
          {displayError && (
            <div className="mb-stack-md p-stack-sm rounded-lg bg-error-container text-on-error-container text-xs flex items-start gap-2 animate-fadeIn">
              <span className="material-symbols-outlined text-error text-[18px] shrink-0">
                error
              </span>
              <p className="break-words flex-1 leading-snug">{displayError}</p>
            </div>
          )}

          <div className="text-center mb-stack-lg">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-secondary-container/60 text-primary mb-stack-sm">
              <span className="material-symbols-outlined text-[22px]">account_circle</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-stack-sm font-bold">
              Owner Sign In
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Sign in with your verified Google account to access your cafe management dashboard.
            </p>
          </div>

          <form onSubmit={handleGoogleSignIn} className="space-y-stack-md">
            <button
              type="submit"
              disabled={isLoading || !isConfigured}
              className="w-full flex items-center justify-center gap-stack-sm py-3 px-stack-md bg-surface-card border border-border-subtle rounded-lg hover:bg-surface-container-low hover:border-secondary/40 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-60 group"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg
                  className="w-5 h-5 shrink-0 transition-transform group-hover:scale-105"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  ></path>
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  ></path>
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  ></path>
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  ></path>
                </svg>
              )}
              <span className="font-label-md text-label-md text-on-surface font-bold">
                {isLoading ? "Connecting to Google..." : "Continue with Google"}
              </span>
              <span className="material-symbols-outlined text-on-surface-variant text-[18px] ml-auto group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </button>
          </form>

          {/* Security and Trust Indicators */}
          <div className="mt-stack-lg flex items-center justify-center gap-1.5 text-on-surface-variant text-xs">
            <span className="material-symbols-outlined text-[16px] text-status-success">
              verified_user
            </span>
            <span>Secured with Supabase SSR Auth &amp; Google OAuth</span>
          </div>

          <div className="mt-stack-md text-center">
            <p className="font-body-sm text-[11px] text-on-surface-variant flex items-center justify-center gap-1 flex-wrap">
              <span className="material-symbols-outlined text-[13px]">shield</span>
              By logging in, you agree to our terms and owner privacy standards.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
