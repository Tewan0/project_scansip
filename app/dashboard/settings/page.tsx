/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Store,
  CreditCard,
  Clock,
  Coins,
  Save,
  Loader2,
  Image as ImageIcon,
  Upload,
  Trash2,
  Globe,
  AlertTriangle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { checkSlugAvailability } from "@/app/actions/owner-auth";

export default function SettingsPage() {
  const [storeName, setStoreName] = useState("");
  const [promptPayNumber, setPromptPayNumber] = useState("");
  const [openingTime, setOpeningTime] = useState("08:00");
  const [closingTime, setClosingTime] = useState("18:00");
  const [currency, setCurrency] = useState("THB");
  const [logoUrl, setLogoUrl] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Slug states
  const [slug, setSlug] = useState("");
  const [originalSlug, setOriginalSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "unavailable">("idle");
  const [slugError, setSlugError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper to format slug from input string
  const formatSlug = (input: string) => {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

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
          setLogoUrl(json.data.logoUrl || "");
          const initialSlug = json.data.slug || "";
          setSlug(initialSlug);
          setOriginalSlug(initialSlug);
        }
      } catch (err) {
        console.error("Failed to load store settings:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStore();
  }, []);

  // Debounced check for slug availability if changed from original
  useEffect(() => {
    if (!slug || slug === originalSlug) {
      setSlugStatus("idle");
      setSlugError(null);
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
  }, [slug, originalSlug]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextSlug = formatSlug(e.target.value);
    setSlug(nextSlug);
    if (!nextSlug) {
      setSlugStatus("idle");
      setSlugError(null);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setLogoUploadError("กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG)");
      return;
    }

    try {
      setIsUploadingLogo(true);
      setLogoUploadError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "restaurant-logos");
      if (logoUrl) {
        formData.append("oldUrl", logoUrl);
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.url) {
        setLogoUrl(data.url);
      } else {
        setLogoUploadError(data.error || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ");
      }
    } catch (err) {
      console.error("Logo upload error:", err);
      setLogoUploadError("ไม่สามารถอัปโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    const prevLogo = logoUrl;
    setLogoUrl("");
    setLogoUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (prevLogo) {
      try {
        await fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: prevLogo, bucket: "restaurant-logos" }),
        });
      } catch (err) {
        console.error("Failed to delete logo file:", err);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slugStatus === "unavailable") {
      setErrorMessage("กรุณาเปลี่ยน URL Slug ให้ไม่ซ้ำกับร้านอื่นก่อนบันทึก");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      const res = await fetch("/api/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: storeName.trim(),
          promptPayNumber: promptPayNumber.trim(),
          openingTime,
          closingTime,
          currency,
          logoUrl: logoUrl.trim() || null,
          slug: slug.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSaved(true);
        if (json.data?.slug) {
          setOriginalSlug(json.data.slug);
          setSlug(json.data.slug);
          setSlugStatus("idle");
        }
        setTimeout(() => setSaved(false), 3500);
      } else {
        setErrorMessage(json.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    } catch (err) {
      console.error("Failed to save store settings:", err);
      setErrorMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-gutter lg:p-margin-page animate-fadeIn">
        <div className="max-w-3xl mx-auto space-y-stack-lg">
          <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-2 mb-6">
              <div className="h-6 w-36 rounded-lg skeleton-shimmer" />
              <div className="h-4 w-60 rounded skeleton-shimmer" />
            </div>

            {/* Logo skeleton */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-border-subtle flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl skeleton-shimmer shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-40 rounded skeleton-shimmer" />
                <div className="h-7 w-28 rounded-lg skeleton-shimmer" />
              </div>
            </div>

            {/* Field skeletons */}
            {[1, 2, 3].map((k) => (
              <div key={k} className="space-y-2">
                <div className="h-4 w-28 rounded skeleton-shimmer" />
                <div className="h-10 w-full rounded-xl skeleton-shimmer" />
              </div>
            ))}

            <div className="pt-4 border-t border-border-subtle flex justify-end">
              <div className="h-11 w-36 rounded-xl skeleton-shimmer" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isSlugChanged = slug !== originalSlug && slug.length > 0;

  return (
    <div className="p-4 sm:p-gutter lg:p-margin-page animate-fadeIn">
      <div className="max-w-3xl mx-auto space-y-stack-lg">
        {saved && (
          <div className="p-stack-sm rounded-xl bg-status-success/10 border border-status-success/30 text-status-success flex items-center gap-2 text-xs animate-fadeIn font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>บันทึกการตั้งค่าลงฐานข้อมูลเรียบร้อยแล้ว!</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-stack-sm rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-5 h-5 text-primary" />
            <h2 className="font-headline-md text-headline-md font-bold text-primary">
              ข้อมูลร้านค้า
            </h2>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
            จัดการข้อมูลทั่วไป โลโก้ และ URL สำหรับสั่งอาหารของร้าน
          </p>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Restaurant Logo Section */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-border-subtle">
              <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-2 font-bold">
                <ImageIcon className="w-4 h-4 text-primary" />
                โลโก้ร้านค้า (Restaurant Logo)
              </label>
              <p className="text-xs text-on-surface-variant mb-3">
                ภาพโลโก้จะแสดงในหน้าสั่งอาหารของลูกค้าและบนแถบเมนูในระบบ
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                onChange={handleLogoFileChange}
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-20 h-20 rounded-2xl border border-border-subtle bg-surface flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Store Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="w-8 h-8 text-on-surface-variant/40" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isUploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-primary text-on-primary text-xs font-medium rounded-lg hover:bg-primary/90 transition-all duration-200 shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังอัปโหลด...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>{logoUrl ? "เปลี่ยนรูปโลโก้" : "อัปโหลดโลโก้"}</span>
                        </>
                      )}
                    </button>

                    {logoUrl && (
                      <button
                        type="button"
                        disabled={isUploadingLogo}
                        onClick={handleRemoveLogo}
                        className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-medium rounded-lg border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบโลโก้</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    รองรับไฟล์ JPG, PNG, WEBP แนะนำขนาดสี่เหลี่ยมจัตุรัส 500x500px ขึ้นไป
                  </p>
                </div>
              </div>

              {logoUploadError && (
                <p className="text-xs text-rose-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {logoUploadError}
                </p>
              )}
            </div>

            {/* Store Name */}
            <div>
              <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-1.5 font-bold">
                <Store className="w-4 h-4 text-primary" />
                ชื่อร้านค้า <span className="text-rose-500">*</span>
              </label>
              <input
                className="w-full h-10 px-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-xl focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface text-sm"
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>

            {/* Store Slug / URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface font-bold">
                  <Globe className="w-4 h-4 text-primary" />
                  URL ร้านค้า (SLUG) <span className="text-rose-500">*</span>
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
                  className={`w-full h-10 pl-28 pr-3.5 rounded-xl border bg-surface text-on-surface text-sm font-mono focus:ring-2 outline-none transition-all ${
                    slugStatus === "unavailable"
                      ? "border-rose-400 focus:ring-rose-200"
                      : slugStatus === "available"
                      ? "border-emerald-400 focus:ring-emerald-200"
                      : "border-border-subtle focus:border-secondary focus:ring-secondary/20"
                  }`}
                />
              </div>

              {isSlugChanged && (
                <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="font-semibold block text-amber-800">
                      คำเตือนเรื่องการเปลี่ยน URL Slug:
                    </strong>
                    หากคุณเปลี่ยน URL นี้ ป้าย <strong>QR Code ทั้งหมดที่พิมพ์ติดบนโต๊ะอาหารไว้แล้วจะใช้การไม่ได้ทันที</strong> ลูกค้าจะไม่สามารถสแกนเข้าสั่งได้ คุณจะต้องดาวน์โหลดและพิมพ์ป้าย QR Code ใหม่ในหน้า &quot;คิวอาร์โค้ด&quot;
                  </div>
                </div>
              )}
            </div>

            {/* PromptPay */}
            <div>
              <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-1.5 font-bold">
                <CreditCard className="w-4 h-4 text-primary" />
                เบอร์พร้อมเพย์ (สำหรับรับชำระเงิน)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="w-4 h-4 text-on-surface-variant" />
                </div>
                <input
                  className="w-full h-10 pl-10 pr-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-xl focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface text-sm"
                  type="text"
                  placeholder="เช่น เบอร์โทรศัพท์หรือเลขบัตรประชาชน"
                  value={promptPayNumber}
                  onChange={(e) => setPromptPayNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Opening & Closing Hours */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-1.5 font-bold">
                  <Clock className="w-4 h-4 text-primary" />
                  เวลาเปิดทำการ
                </label>
                <input
                  className="w-full h-10 px-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-xl focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface text-sm"
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-1.5 font-bold">
                  <Clock className="w-4 h-4 text-primary" />
                  เวลาปิดทำการ
                </label>
                <input
                  className="w-full h-10 px-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-xl focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface text-sm"
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                />
              </div>
            </div>

            {/* Currency */}
            <div>
              <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface mb-1.5 font-bold">
                <Coins className="w-4 h-4 text-primary" />
                สกุลเงินที่แสดง
              </label>
              <select
                className="w-full h-10 px-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-xl focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface cursor-pointer text-sm"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="THB">บาทไทย (฿)</option>
              </select>
            </div>

            <div className="pt-4 border-t border-border-subtle flex justify-end">
              <button
                type="submit"
                disabled={isSaving || isUploadingLogo || slugStatus === "unavailable" || !storeName.trim() || !slug.trim()}
                className="w-full sm:w-auto justify-center px-6 h-11 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary/90 transition-all duration-200 shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-60 text-sm font-medium active:scale-95"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูลการตั้งค่า"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
