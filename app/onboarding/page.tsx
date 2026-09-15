"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Clock,
  CreditCard,
  Sparkles,
  ArrowRight,
  Loader2,
  Coffee,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [promptPayNumber, setPromptPayNumber] = useState("");
  const [openingTime, setOpeningTime] = useState("08:00");
  const [closingTime, setClosingTime] = useState("18:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: storeName,
          promptPayNumber,
          openingTime,
          closingTime,
        }),
      });

      const json = await res.json();
      if (json.success) {
        // สร้างร้านสำเร็จ นำทางเข้า Dashboard ของร้านใหม่ทันที
        router.push("/dashboard");
      } else {
        setErrorMessage(json.error || "เกิดข้อผิดพลาดในการสร้างร้านค้า");
      }
    } catch (err) {
      console.error("Create store error:", err);
      setErrorMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-gutter">
      <div className="max-w-md w-full bg-surface-card border border-border-subtle rounded-2xl p-stack-xl shadow-xl">
        {/* Brand Header */}
        <div className="text-center mb-stack-lg">
          <div className="w-12 h-12 bg-primary text-on-primary rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md">
            <Coffee className="w-6 h-6" />
          </div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-background">
            ยินดีต้อนรับสู่ ScanSip
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            เริ่มต้นสร้างร้านค้าของคุณเพื่อเปิดระบบสั่งอาหารผ่าน QR Code
          </p>
        </div>

        {errorMessage && (
          <div className="mb-stack-md p-stack-sm rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Store Setup Form */}
        <form onSubmit={handleSubmit} className="space-y-stack-md">
          <div>
            <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-unit">
              <Store className="w-4 h-4 text-primary" />
              ชื่อร้านค้าของคุณ <span className="text-error">*</span>
            </label>
            <input
              required
              className="w-full h-10 px-3 rounded-lg border border-border-subtle bg-surface font-body-md text-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none text-on-surface"
              placeholder="เช่น Slow Bar Coffee, กาแฟริมทาง"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-unit">
              <CreditCard className="w-4 h-4 text-primary" />
              เบอร์พร้อมเพย์รับเงิน (PromptPay)
            </label>
            <input
              className="w-full h-10 px-3 rounded-lg border border-border-subtle bg-surface font-body-md text-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none text-on-surface"
              placeholder="08X-XXX-XXXX หรือ เลขบัตรประชาชน"
              value={promptPayNumber}
              onChange={(e) => setPromptPayNumber(e.target.value)}
            />
            <p className="text-[11px] text-on-surface-variant mt-1">
              ใช้สำหรับสร้าง QR Code รับเงินให้ลูกค้าสแกนจ่ายเงิน
            </p>
          </div>

          <div className="grid grid-cols-2 gap-stack-sm">
            <div>
              <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                <Clock className="w-3.5 h-3.5 text-on-surface-variant" />
                เวลาเปิดร้าน
              </label>
              <input
                type="time"
                className="w-full h-10 px-3 rounded-lg border border-border-subtle bg-surface font-body-md text-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none text-on-surface"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
              />
            </div>
            <div>
              <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                <Clock className="w-3.5 h-3.5 text-on-surface-variant" />
                เวลาปิดร้าน
              </label>
              <input
                type="time"
                className="w-full h-10 px-3 rounded-lg border border-border-subtle bg-surface font-body-md text-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none text-on-surface"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !storeName.trim()}
            className="w-full h-11 mt-stack-md bg-primary text-on-primary font-label-lg text-label-lg rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-md cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>สร้างร้านค้าและเริ่มต้นใช้งาน</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
