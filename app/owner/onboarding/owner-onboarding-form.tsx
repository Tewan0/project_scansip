"use client";

import { useState, useTransition } from "react";
import { registerRestaurantAction, signOutOwner } from "@/app/actions/owner-auth";

interface OwnerOnboardingFormProps {
  userEmail?: string;
}

export default function OwnerOnboardingForm({ userEmail }: OwnerOnboardingFormProps) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    setFormError(null);
    startTransition(async () => {
      const result = await registerRestaurantAction(formData);
      if (result?.error) {
        setFormError(result.error);
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-secondary-container opacity-20 blur-[100px]"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary-container opacity-10 blur-[120px]"></div>
      </div>

      <main className="w-full max-w-[500px] bg-surface-card rounded-xl border border-border-subtle shadow-[0_4px_16px_rgba(0,0,0,0.06)] relative z-10 overflow-hidden">
        {/* Header */}
        <header className="pt-stack-lg px-stack-lg pb-stack-md text-center border-b border-border-subtle bg-surface-bright">
          <div className="flex justify-center mb-stack-sm">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center shadow-xs">
              <span
                className="material-symbols-outlined text-on-primary text-[28px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                storefront
              </span>
            </div>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-unit font-bold">
            Register Your Cafe
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Welcome, {userEmail || "Partner"}! Set up your restaurant details to get started.
          </p>
        </header>

        <div className="p-stack-lg">
          {formError && (
            <div className="mb-stack-md p-stack-sm rounded-lg bg-error-container text-on-error-container text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-error text-[18px] shrink-0">
                error
              </span>
              <p className="flex-1">{formError}</p>
            </div>
          )}

          <form action={handleSubmit} className="space-y-stack-md">
            {/* Restaurant Name */}
            <div>
              <label htmlFor="name" className="block font-label-md text-label-md text-on-surface mb-unit font-medium">
                Restaurant / Cafe Name <span className="text-error">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-stack-sm flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                    local_cafe
                  </span>
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Blue Bottle Coffee &amp; Bakery"
                  className="w-full h-[40px] pl-[36px] pr-stack-sm font-body-md text-body-md bg-surface-card border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all placeholder:text-on-surface-variant/50 text-on-surface"
                />
              </div>
            </div>

            {/* PromptPay Number */}
            <div>
              <label htmlFor="promptpay_number" className="block font-label-md text-label-md text-on-surface mb-unit font-medium">
                PromptPay Number (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-stack-sm flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                    payments
                  </span>
                </div>
                <input
                  id="promptpay_number"
                  name="promptpay_number"
                  type="text"
                  placeholder="e.g. 081-234-5678 or National ID"
                  className="w-full h-[40px] pl-[36px] pr-stack-sm font-body-md text-body-md bg-surface-card border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all placeholder:text-on-surface-variant/50 text-on-surface"
                />
              </div>
              <p className="font-body-sm text-[11px] text-on-surface-variant mt-1">
                Used to automatically generate QR codes for customer table payments.
              </p>
            </div>

            {/* Logo URL */}
            <div>
              <label htmlFor="logo_url" className="block font-label-md text-label-md text-on-surface mb-unit font-medium">
                Logo URL (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-stack-sm flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                    image
                  </span>
                </div>
                <input
                  id="logo_url"
                  name="logo_url"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  className="w-full h-[40px] pl-[36px] pr-stack-sm font-body-md text-body-md bg-surface-card border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all placeholder:text-on-surface-variant/50 text-on-surface"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-stack-sm">
              <button
                type="submit"
                disabled={isPending}
                className="w-full h-[42px] flex items-center justify-center gap-2 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary/90 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving your cafe...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      check_circle
                    </span>
                    <span>Complete Onboarding</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer with sign-out option */}
          <div className="mt-stack-lg pt-stack-sm border-t border-border-subtle flex items-center justify-between text-xs text-on-surface-variant">
            <span>Signed in as {userEmail}</span>
            <button
              type="button"
              onClick={() => signOutOwner()}
              className="text-error hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <span className="material-symbols-outlined text-[15px]">logout</span>
              Sign out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
