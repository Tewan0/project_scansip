"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Coffee,
  Store,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  User,
  ArrowRight,
  Shield,
} from "lucide-react";

interface LoginOnboardingProps {
  initialUser?: {
    id: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
  } | null;
  authError?: string | null;
  isConfigured?: boolean;
}

export default function LoginOnboarding({
  authError,
  isConfigured = true,
}: LoginOnboardingProps) {
  const router = useRouter();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(authError || null);

  // Automatically advance to dashboard if session is detected client-side
  useEffect(() => {
    if (!isConfigured) return;

    const supabase = createClient();

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.push("/dashboard");
      }
    });

    // Listen to auth events (e.g. OAuth redirect callback)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        router.push("/dashboard");
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [router, isConfigured]);

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      setErrorMessage(null);

      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        throw new Error(
          "Supabase environment variables are missing. Please configure .env.local"
        );
      }

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
      setIsGoogleLoading(false);
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred during Google Sign In.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-secondary-container opacity-20 blur-[100px] animate-floatSlow"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary-container opacity-15 blur-[120px] animate-floatSlowReverse"></div>
      </div>

      {/* Main Card Container */}
      <main className="w-full max-w-[480px] bg-surface-card rounded-2xl border border-border-subtle shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative z-10 overflow-hidden animate-cardEnter">
        {/* Header */}
        <header className="pt-stack-lg px-stack-lg pb-stack-md text-center border-b border-border-subtle bg-surface-bright">
          <div className="flex justify-center mb-stack-sm">
            <div className="w-13 h-13 rounded-2xl bg-primary flex items-center justify-center shadow-md text-on-primary animate-gentleBob">
              <Coffee className="w-7 h-7" />
            </div>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-unit font-bold">
            ScanSip
          </h1>
          <div className="flex items-center justify-center gap-1.5 text-on-surface-variant">
            <Store className="w-4 h-4 text-primary" />
            <p className="font-body-md text-body-md">Owner Dashboard</p>
          </div>
        </header>

        <div className="p-stack-lg relative">
          {/* Supabase Not Configured Warning (if any) */}
          {!isConfigured && (
            <div className="mb-stack-md p-stack-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">ยังไม่ได้ตั้งค่าคีย์ Supabase</p>
                <p className="text-[11px] text-amber-700">
                  โปรดกำหนดค่า NEXT_PUBLIC_SUPABASE_URL ใน .env เพื่อใช้งานการเข้าสู่ระบบผ่าน Google
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="mb-stack-md p-stack-sm rounded-lg bg-error-container text-on-error-container text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-error shrink-0" />
              <p className="break-words flex-1">{errorMessage}</p>
            </div>
          )}

          {/* Login (Only Google Sign In) */}
          <div className="w-full flex flex-col justify-center py-stack-md animate-fadeIn">
            <div className="text-center mb-stack-lg">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-secondary-container/60 text-primary mb-stack-sm">
                <User className="w-5 h-5" />
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-stack-sm font-bold">
                ยินดีต้อนรับเข้าสู่ระบบ
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                เข้าสู่ระบบด้วยบัญชี Google เพื่อจัดการร้านอาหารและออเดอร์ของคุณ
              </p>
            </div>

            <div className="space-y-stack-md">
              {/* Single Login Button: Google Sign-In with Supabase */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-stack-sm py-3 px-stack-md bg-surface-card border border-border-subtle rounded-xl hover:bg-surface-container-low hover:border-secondary/40 shadow-xs hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-60 group"
              >
                {isGoogleLoading ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg
                    className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110 duration-200"
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
                  {isGoogleLoading ? "กำลังเชื่อมต่อไปยัง Google..." : "ดำเนินการต่อด้วย Google"}
                </span>
                <ArrowRight className="w-4 h-4 text-on-surface-variant ml-auto group-hover:translate-x-1 transition-transform duration-200" />
              </button>
            </div>

            {/* Security guarantee badge */}
            <div className="mt-stack-lg flex items-center justify-center gap-1.5 text-on-surface-variant text-xs hover:text-on-surface transition-colors">
              <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
              <span>เข้าสู่ระบบอย่างรวดเร็วและปลอดภัยผ่าน Supabase OAuth</span>
            </div>

            <div className="mt-stack-md text-center">
              <p className="font-body-sm text-[12px] text-on-surface-variant flex items-center justify-center gap-1 flex-wrap">
                <Shield className="w-3.5 h-3.5 inline shrink-0" />
                เมื่อดำเนินการต่อ แสดงว่าคุณยอมรับ{" "}
                <a className="text-primary hover:underline font-semibold inline-flex items-center gap-0.5" href="#">
                  ข้อกำหนดการให้บริการ
                </a>{" "}
                และ{" "}
                <a className="text-primary hover:underline font-semibold inline-flex items-center gap-0.5" href="#">
                  นโยบายความเป็นส่วนตัว
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
