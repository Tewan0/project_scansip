"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Store,
  CreditCard,
  Clock,
  Coins,
  Save,
  Loader2,
} from "lucide-react";

export default function SettingsPage() {
  const [storeName, setStoreName] = useState("");
  const [promptPayNumber, setPromptPayNumber] = useState("");
  const [openingTime, setOpeningTime] = useState("08:00");
  const [closingTime, setClosingTime] = useState("18:00");
  const [currency, setCurrency] = useState("THB");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // โหลดข้อมูลร้านจาก Database จริง
    const fetchStore = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/store");
        const json = await res.json();
        if (json.success && json.data) {
          setStoreName(json.data.name || "");
          setPromptPayNumber(json.data.promptPayNumber || "");
          setOpeningTime(json.data.openingTime || "08:00");
          setClosingTime(json.data.closingTime || "18:00");
          setCurrency(json.data.currency || "THB");
        }
      } catch (err) {
        console.error("Failed to load store settings:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStore();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const res = await fetch("/api/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: storeName,
          promptPayNumber,
          openingTime,
          closingTime,
          currency,
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save store settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="font-body-md text-body-md">กำลังโหลดข้อมูลการตั้งค่าร้าน...</p>
      </div>
    );
  }

  return (
    <div className="p-stack-md md:p-margin-page">
      <div className="max-w-3xl mx-auto space-y-stack-lg">
        {saved && (
          <div className="p-stack-sm rounded-lg bg-status-success/10 border border-status-success/30 text-status-success flex items-center gap-2 text-xs animate-fadeIn">
            <CheckCircle2 className="w-4 h-4" />
            <span>บันทึกการตั้งค่าลงฐานข้อมูลเรียบร้อยแล้ว!</span>
          </div>
        )}

        <div className="bg-surface-card rounded-xl border border-border-subtle p-gutter shadow-xs">
          <div className="flex items-center gap-2 mb-stack-sm">
            <Store className="w-5 h-5 text-primary" />
            <h2 className="font-headline-md text-headline-md font-bold text-primary">
              ข้อมูลร้านค้า
            </h2>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-lg">
            จัดการข้อมูลทั่วไปของร้านอาหาร/คาเฟ่ และการรับชำระเงิน (บันทึกลง Database จริง)
          </p>

          <form onSubmit={handleSave} className="space-y-stack-md">
            <div>
              <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-unit">
                <Store className="w-4 h-4 text-on-surface-variant" />
                ชื่อร้านค้า
              </label>
              <input
                className="w-full h-[36px] px-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface"
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-unit">
                <CreditCard className="w-4 h-4 text-on-surface-variant" />
                เบอร์พร้อมเพย์ (สำหรับรับชำระเงิน)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="w-4 h-4 text-on-surface-variant" />
                </div>
                <input
                  className="w-full h-[36px] pl-10 pr-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface"
                  type="text"
                  required
                  placeholder="เช่น 081-234-5678 หรือเลขบัตรประชาชน"
                  value={promptPayNumber}
                  onChange={(e) => setPromptPayNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
              <div>
                <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-unit">
                  <Clock className="w-4 h-4 text-on-surface-variant" />
                  เวลาเปิดทำการ
                </label>
                <input
                  className="w-full h-[36px] px-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface"
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-unit">
                  <Clock className="w-4 h-4 text-on-surface-variant" />
                  เวลาปิดทำการ
                </label>
                <input
                  className="w-full h-[36px] px-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface"
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-unit">
                <Coins className="w-4 h-4 text-on-surface-variant" />
                สกุลเงินที่แสดง
              </label>
              <select
                className="w-full h-[36px] px-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface cursor-pointer"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="THB">บาทไทย (฿)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            <div className="pt-stack-md border-t border-border-subtle flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-stack-lg h-9 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary/90 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
