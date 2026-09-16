/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import {
  Coffee,
  Store,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  SlidersHorizontal,
  LayoutDashboard,
  User,
  ArrowRight,
  ArrowLeft,
  Shield,
  Edit2,
  ImagePlus,
  UploadCloud,
  CreditCard,
  Clock,
  CheckCircle2,
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
  initialUser,
  authError,
  isConfigured = true,
}: LoginOnboardingProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2>(initialUser ? 2 : 1);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(authError || null);

  // Store Setup Form State
  const [storeName, setStoreName] = useState("The Coffee Corner");
  const [promptPayNumber, setPromptPayNumber] = useState("081-234-5678");
  const [openingTime, setOpeningTime] = useState("08:00");
  const [closingTime, setClosingTime] = useState("18:00");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSubmittingSetup, setIsSubmittingSetup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    }
  };

  const handleCompleteSetup = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSetup(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "scansip_store_info",
        JSON.stringify({
          storeName,
          promptPayNumber,
          openingTime,
          closingTime,
          logoPreview,
        })
      );
    }
    setTimeout(() => {
      router.push("/dashboard");
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-secondary-container opacity-20 blur-[100px]"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary-container opacity-10 blur-[120px]"></div>
      </div>

      {/* Main Card Container */}
      <main className="w-full max-w-[480px] bg-surface-card rounded-xl border border-border-subtle shadow-[0_4px_12px_rgba(0,0,0,0.05)] relative z-10 overflow-hidden">
        {/* Header */}
        <header className="pt-stack-lg px-stack-lg pb-stack-md text-center border-b border-border-subtle bg-surface-bright">
          <div className="flex justify-center mb-stack-sm">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center shadow-xs text-on-primary">
              <Coffee className="w-7 h-7" />
            </div>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-unit font-bold">
            ScanSip
          </h1>
          <div className="flex items-center justify-center gap-1.5 text-on-surface-variant">
            <Store className="w-4 h-4" />
            <p className="font-body-md text-body-md">Owner Dashboard</p>
          </div>
        </header>

        <div className="p-stack-lg relative min-h-[420px]">
          {/* Supabase Not Configured Warning (if any) */}
          {!isConfigured && (
            <div className="mb-stack-md p-stack-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
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
            <div className="mb-stack-md p-stack-sm rounded-lg bg-error-container text-on-error-container text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-error shrink-0" />
              <p className="break-words flex-1">{errorMessage}</p>
            </div>
          )}

          {/* Logged in banner (if session active) */}
          {initialUser && (
            <div className="mb-stack-md p-stack-sm rounded-lg bg-secondary-container/40 border border-secondary-container text-primary flex items-center justify-between text-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
                <span>
                  เข้าสู่ระบบโดย <strong>{initialUser.name || initialUser.email}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="font-bold text-secondary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  ตั้งค่าร้าน
                </button>
                <Link
                  href="/dashboard"
                  className="font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  แดชบอร์ด
                </Link>
              </div>
            </div>
          )}

          {/* Step 1: Login (Only Google Sign In) */}
          {currentStep === 1 && (
            <div className="w-full flex flex-col h-full justify-center py-stack-md animate-fadeIn">
              <div className="text-center mb-stack-lg">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-secondary-container/60 text-primary mb-stack-sm">
                  <User className="w-5 h-5" />
                </div>
                <h2 className="font-headline-md text-headline-md text-on-surface mb-stack-sm font-bold">
                  ยินดีต้อนรับกลับเข้าสู่ระบบ
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
                  className="w-full flex items-center justify-center gap-stack-sm py-3 px-stack-md bg-surface-card border border-border-subtle rounded-lg hover:bg-surface-container-low hover:border-secondary/40 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-60 group"
                >
                  {isGoogleLoading ? (
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
                    {isGoogleLoading ? "กำลังเชื่อมต่อไปยัง Google..." : "ดำเนินการต่อด้วย Google"}
                  </span>
                  <ArrowRight className="w-4 h-4 text-on-surface-variant ml-auto group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Security guarantee badge */}
              <div className="mt-stack-lg flex items-center justify-center gap-1.5 text-on-surface-variant text-xs">
                <ShieldCheck className="w-4 h-4 text-status-success" />
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

              {/* Quick shortcut to Step 2 Store Setup or Dashboard */}
              <div className="mt-stack-lg pt-stack-sm border-t border-border-subtle flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Store className="w-4 h-4" />
                  ตั้งค่าร้านค้า
                </button>
                <Link
                  href="/dashboard"
                  className="text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1 font-semibold"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  แดชบอร์ด
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Step 2: Onboarding Setup */}
          {currentStep === 2 && (
            <div className="w-full animate-fadeIn">
              <div className="flex items-center gap-stack-sm mb-stack-md">
                <button
                  type="button"
                  className="p-1 rounded-full hover:bg-surface-container-low text-on-surface-variant transition-colors cursor-pointer"
                  onClick={() => setCurrentStep(1)}
                  title="กลับสู่หน้าเข้าสู่ระบบ"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Store className="w-5 h-5 text-primary" />
                    <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                      ตั้งค่าร้านค้า
                    </h2>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    เตรียมความพร้อมข้อมูลร้านของคุณก่อนเปิดรับออเดอร์
                  </p>
                </div>
              </div>

              <form onSubmit={handleCompleteSetup} className="space-y-stack-md">
                {/* Store Logo Upload */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoChange}
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-stack-md border-2 border-dashed border-border-subtle rounded-lg bg-surface-bright hover:bg-surface-container-low transition-colors cursor-pointer group"
                >
                  {logoPreview ? (
                    <div className="flex flex-col items-center">
                      <img
                        src={logoPreview}
                        alt="โลโก้ร้านค้า"
                        className="w-16 h-16 rounded-full object-cover mb-stack-sm border border-border-subtle"
                      />
                      <span className="font-label-md text-label-md text-primary flex items-center gap-1">
                        <Edit2 className="w-4 h-4" />
                        เปลี่ยนโลโก้
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-stack-sm group-hover:bg-secondary-container transition-colors">
                        <ImagePlus className="w-6 h-6 text-on-surface-variant group-hover:text-primary transition-colors" />
                      </div>
                      <span className="font-label-md text-label-md text-on-surface flex items-center gap-1.5">
                        <UploadCloud className="w-4 h-4" />
                        อัปโหลดโลโก้ร้านค้า
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant text-[11px] mt-unit">
                        ไฟล์ JPG, PNG ขนาดไม่เกิน 2MB
                      </span>
                    </>
                  )}
                </div>

                {/* Store Name */}
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-unit">
                    ชื่อร้านค้า
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-stack-sm flex items-center pointer-events-none">
                      <Store className="w-4 h-4 text-on-surface-variant" />
                    </div>
                    <input
                      className="w-full h-[36px] pl-[36px] pr-stack-sm font-body-md text-body-md bg-surface-card border border-border-subtle rounded focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all placeholder:text-on-surface-variant/50 text-on-surface"
                      placeholder="เช่น คาเฟ่ เดอ ปารีส"
                      type="text"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                    />
                  </div>
                </div>

                {/* PromptPay Number */}
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-unit">
                    เบอร์พร้อมเพย์ (สำหรับรับชำระเงิน)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-stack-sm flex items-center pointer-events-none">
                      <CreditCard className="w-4 h-4 text-on-surface-variant" />
                    </div>
                    <input
                      className="w-full h-[36px] pl-[36px] pr-stack-sm font-body-md text-body-md bg-surface-card border border-border-subtle rounded focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all placeholder:text-on-surface-variant/50 text-on-surface"
                      placeholder="เบอร์โทรศัพท์ 08X-XXX-XXXX หรือเลขบัตรประชาชน"
                      type="text"
                      required
                      value={promptPayNumber}
                      onChange={(e) => setPromptPayNumber(e.target.value)}
                    />
                  </div>
                </div>

                {/* Opening Hours */}
                <div className="flex gap-stack-sm">
                  <div className="flex-1">
                    <label className="block font-label-md text-label-md text-on-surface mb-unit">
                      เวลาเปิดทำการ
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Clock className="w-4 h-4 text-on-surface-variant" />
                      </div>
                      <input
                        className="w-full h-[36px] pl-8 pr-2 font-body-md text-body-md bg-surface-card border border-border-subtle rounded focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface"
                        type="time"
                        value={openingTime}
                        onChange={(e) => setOpeningTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block font-label-md text-label-md text-on-surface mb-unit">
                      เวลาปิดทำการ
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Clock className="w-4 h-4 text-on-surface-variant" />
                      </div>
                      <input
                        className="w-full h-[36px] pl-8 pr-2 font-body-md text-body-md bg-surface-card border border-border-subtle rounded focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface"
                        type="time"
                        value={closingTime}
                        onChange={(e) => setClosingTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-stack-sm">
                  <button
                    type="submit"
                    disabled={isSubmittingSetup}
                    className="w-full h-[38px] flex items-center justify-center gap-2 bg-primary text-on-primary font-label-md text-label-md rounded hover:bg-primary/90 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isSubmittingSetup ? "กำลังบันทึกและเปลี่ยนเส้นทาง..." : "เสร็จสิ้นการตั้งค่า"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
