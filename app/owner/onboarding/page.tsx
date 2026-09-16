"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createStoreOnboarding,
  checkSlugAvailability,
  signOutOwner,
} from "@/app/actions/owner-auth";
import { createClient } from "@/utils/supabase/client";
import {
  Store,
  Clock,
  CreditCard,
  Sparkles,
  ArrowRight,
  Loader2,
  Coffee,
  CheckCircle2,
  XCircle,
  Globe,
  Image as ImageIcon,
  AlertCircle,
  LogOut,
} from "lucide-react";

export default function OwnerOnboardingPage() {
  const router = useRouter();
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "unavailable">("idle");
  const [slugError, setSlugError] = useState<string | null>(null);

  const [promptPayNumber, setPromptPayNumber] = useState("");
  const [openingTime, setOpeningTime] = useState("08:00");
  const [closingTime, setClosingTime] = useState("18:00");
  const [logoUrl, setLogoUrl] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Helper to format slug from input string
  const formatSlug = (input: string) => {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  // Auto-generate slug as store name changes if not manually edited
  const handleStoreNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStoreName(val);
    if (!isSlugManuallyEdited) {
      const nextSlug = formatSlug(val);
      setSlug(nextSlug);
      if (!nextSlug) {
        setSlugStatus("idle");
        setSlugError(null);
      }
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    const nextSlug = formatSlug(e.target.value);
    setSlug(nextSlug);
    if (!nextSlug) {
      setSlugStatus("idle");
      setSlugError(null);
    }
  };

  // Debounced check for slug availability
  useEffect(() => {
    if (!slug) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSlugStatus("checking");
      try {
        const res = await checkSlugAvailability(slug);
        if (res.available) {
          setSlugStatus("available");
          setSlugError(null);
        } else {
          setSlugStatus("unavailable");
          setSlugError(res.error || "URL Slug นี้มีผู้อื่นใช้งานแล้ว");
        }
      } catch {
        setSlugStatus("idle");
      }
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [slug]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setCurrentUserEmail(data.user.email);
      }
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim() || !slug.trim()) {
      setErrorMessage("กรุณาระบุชื่อร้านค้าและ URL Slug");
      return;
    }

    if (slugStatus === "unavailable") {
      setErrorMessage("กรุณาเลือก URL Slug อื่นที่ไม่ซ้ำกับร้านที่มีอยู่");
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      try {
        const result = await createStoreOnboarding({
          name: storeName.trim(),
          slug: slug.trim(),
          promptpayNumber: promptPayNumber.trim() || null,
          openingTime,
          closingTime,
          logoUrl: logoUrl.trim() || null,
        });

        if (result.success) {
          router.push(result.redirectUrl || "/owner/dashboard");
        } else {
          setErrorMessage(result.error || "เกิดข้อผิดพลาดในการสร้างร้านค้า");
          if (result.redirectUrl) {
            router.push(result.redirectUrl);
          }
        }
      } catch (err: unknown) {
        console.error("Submission error:", err);
        setErrorMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-8 relative">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[15%] -right-[10%] w-[45%] h-[45%] rounded-full bg-secondary-container opacity-20 blur-[90px]" />
        <div className="absolute -bottom-[15%] -left-[10%] w-[45%] h-[45%] rounded-full bg-primary-container opacity-15 blur-[90px]" />
      </div>

      <div className="max-w-xl w-full bg-surface-card border border-border-subtle rounded-3xl p-6 sm:p-10 shadow-xl relative z-10">
        {/* Account Info & Sign Out Bar */}
        {currentUserEmail && (
          <div className="mb-6 px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-border-subtle flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-on-surface-variant min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">
                เข้าสู่ระบบด้วย: <strong className="text-on-surface font-semibold">{currentUserEmail}</strong>
              </span>
            </div>
            <form action={signOutOwner}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-medium px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>เปลี่ยนบัญชี</span>
              </button>
            </form>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary text-on-primary rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-md">
            <Coffee className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-on-surface">
            เริ่มต้นตั้งค่าร้านค้าของคุณ
          </h1>
          <p className="text-sm text-on-surface-variant mt-1.5 leading-relaxed">
            กรอกรายละเอียดร้านเพื่อสร้างระบบจัดการและ URL สั่งอาหารผ่าน QR Code
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Store Name */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
              <Store className="w-4 h-4 text-primary" />
              ชื่อร้านค้า <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น Slow Bar Coffee, กาแฟริมทาง"
              value={storeName}
              onChange={handleStoreNameChange}
              className="w-full h-11 px-3.5 rounded-xl border border-border-subtle bg-surface text-on-surface text-sm focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
            />
          </div>

          {/* Store Slug */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-on-surface uppercase tracking-wider">
                <Globe className="w-4 h-4 text-primary" />
                URL ร้านค้า (Slug) <span className="text-rose-500">*</span>
              </label>
              {slugStatus === "checking" && (
                <span className="text-xs text-neutral-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> กำลังตรวจสอบ...
                </span>
              )}
              {slugStatus === "available" && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> URL นี้ใช้ได้
                </span>
              )}
              {slugStatus === "unavailable" && (
                <span className="text-xs text-rose-600 font-medium flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> {slugError || "URL ซ้ำ"}
                </span>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs text-neutral-400 font-mono select-none">
                scansip.com/r/
              </div>
              <input
                type="text"
                required
                placeholder="my-coffee-shop"
                value={slug}
                onChange={handleSlugChange}
                className={`w-full h-11 pl-28 pr-3.5 rounded-xl border bg-surface text-on-surface text-sm font-mono focus:ring-2 outline-none transition-all ${
                  slugStatus === "unavailable"
                    ? "border-rose-400 focus:ring-rose-200"
                    : slugStatus === "available"
                    ? "border-emerald-400 focus:ring-emerald-200"
                    : "border-border-subtle focus:border-secondary focus:ring-secondary/20"
                }`}
              />
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">
              ใช้สำหรับสร้างลิงก์หน้าสั่งอาหารของลูกค้า เช่น{" "}
              <code className="text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                scansip.com/r/{slug || "your-slug"}
              </code>
            </p>
          </div>

          {/* PromptPay Number */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
              <CreditCard className="w-4 h-4 text-primary" />
              เบอร์พร้อมเพย์รับเงิน (PromptPay)
            </label>
            <input
              type="text"
              placeholder="08X-XXX-XXXX หรือ เลขบัตรประชาชน 13 หลัก"
              value={promptPayNumber}
              onChange={(e) => setPromptPayNumber(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-border-subtle bg-surface text-on-surface text-sm focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
            />
            <p className="text-[11px] text-on-surface-variant mt-1">
              ใช้สร้าง QR Code รับเงินอัตโนมัติให้ลูกค้าสแกนจ่ายเงิน
            </p>
          </div>

          {/* Opening & Closing Hours */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="flex items-center gap-1 text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                เวลาเปิดร้าน
              </label>
              <input
                type="time"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-border-subtle bg-surface text-on-surface text-sm focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                เวลาปิดร้าน
              </label>
              <input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-border-subtle bg-surface text-on-surface text-sm focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
              />
            </div>
          </div>

          {/* Logo URL */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
              <ImageIcon className="w-4 h-4 text-primary" />
              URL โลโก้ร้านค้า (ตัวเลือก)
            </label>
            <input
              type="url"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-border-subtle bg-surface text-on-surface text-sm focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={isPending || !storeName.trim() || !slug.trim() || slugStatus === "unavailable"}
              className="w-full h-12 bg-primary text-on-primary font-medium text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังสร้างร้านค้าและกำหนดสิทธิ์...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>สร้างร้านค้าและเข้าสู่แดชบอร์ด</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
