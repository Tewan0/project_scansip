/* eslint-disable @next/next/no-img-element */
"use client";

import { imageUploadProblem, IMAGE_ACCEPT, IMAGE_UPLOAD_HINT } from "@/lib/image-upload";

import { useState, useTransition, useEffect, useRef } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { useRouter } from "next/navigation";
import {
  createStoreOnboarding,
  checkSlugAvailability,
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
  Upload,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const problem = imageUploadProblem(file);
    if (problem) {
      setLogoUploadError(problem);
      e.target.value = "";
      return;
    }

    try {
      setIsUploadingLogo(true);
      setLogoUploadError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "restaurant-logos");

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

  // Helper to format slug from input string
  const formatSlug = (input: string) => {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100);
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
    <div className="relative min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden">
      {/* Ambient Radial Glow */}

      <div className="max-w-xl w-full">
        {/* Account Info & Sign Out Bar */}
        <div className="mb-3 flex justify-end"><ThemeToggle /></div>
        {currentUserEmail && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-card border border-border flex items-center justify-between gap-2 text-xs shadow-2xs">
            <div className="flex items-center gap-2 text-muted-foreground min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">
                เข้าสู่ระบบด้วย: <strong className="text-foreground font-semibold">{currentUserEmail}</strong>
              </span>
            </div>
            <LogoutButton
              variant="ghost"
              size="xs"
              confirmTitle="ยืนยันการเปลี่ยนบัญชี"
              confirmDescription="คุณต้องการออกจากระบบเพื่อเปลี่ยนบัญชีใช่หรือไม่?"
              confirmLabel="เปลี่ยนบัญชี"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-3.5 h-3.5" data-icon="inline-start" />
              เปลี่ยนบัญชี
            </LogoutButton>
          </div>
        )}

        <Card className="border-border shadow-xs animate-cardEnter">
          <CardHeader className="text-center pb-6 pt-8">
            <div className="w-12 h-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <Coffee className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-normal">
              เริ่มต้นตั้งค่าร้านค้าของคุณ
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              กรอกรายละเอียดร้านเพื่อสร้างระบบจัดการโต๊ะ เมนูอาหาร และ URL สั่งอาหารผ่าน QR Code
            </CardDescription>
          </CardHeader>

          <CardContent>
            {errorMessage && (
              <div className="mb-6 p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Store Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold">
                    <Store className="w-3.5 h-3.5 text-primary" />
                    ชื่อร้านค้า <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {storeName.length}/100 ตัวอักษร
                  </span>
                </div>
                <Input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="เช่น Slow Bar Coffee, กาแฟริมทาง"
                  value={storeName}
                  onChange={handleStoreNameChange}
                  className="h-10 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  จำกัดความยาวไม่เกิน 100 ตัวอักษร
                </p>
              </div>

              {/* Store Slug */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold">
                    <Globe className="w-3.5 h-3.5 text-primary" />
                    URL ร้านค้า (Slug) <span className="text-destructive">*</span>
                  </Label>
                  {slugStatus === "checking" && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> กำลังตรวจสอบ...
                    </span>
                  )}
                  {slugStatus === "available" && (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-50 text-[11px] py-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> ใช้ได้
                    </Badge>
                  )}
                  {slugStatus === "unavailable" && (
                    <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10 text-[11px] py-0">
                      <XCircle className="w-3 h-3 mr-1" /> {slugError || "URL ซ้ำ"}
                    </Badge>
                  )}
                </div>

                <div
                  className={`flex items-center w-full min-w-0 h-10 rounded-lg border border-input bg-transparent dark:bg-input/30 px-3 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 ${
                    slugStatus === "unavailable"
                      ? "border-destructive focus-within:border-destructive focus-within:ring-destructive/30"
                      : slugStatus === "available"
                      ? "border-emerald-500 focus-within:border-emerald-500 focus-within:ring-emerald-500/30"
                      : ""
                  }`}
                >
                  <span className="text-xs text-muted-foreground font-mono select-none shrink-0">
                    project-scansip.vercel.app/r/
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="my-coffee-shop"
                    value={slug}
                    onChange={handleSlugChange}
                    className="min-w-0 flex-1 bg-transparent pl-1 font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <p>จำกัดความยาวไม่เกิน 100 ตัวอักษร</p>
                  <span className="shrink-0">{slug.length}/100 ตัวอักษร</span>
                </div>
              </div>

              {/* PromptPay Number */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <CreditCard className="w-3.5 h-3.5 text-primary" />
                  เบอร์พร้อมเพย์รับเงิน (PromptPay)
                </Label>
                <Input
                  type="text"
                  placeholder="เบอร์มือถือ หรือ เลขบัตรประชาชน 13 หลัก"
                  value={promptPayNumber}
                  onChange={(e) => setPromptPayNumber(e.target.value)}
                  className="h-10 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  ระบบจะสร้าง QR Code พร้อมเพย์ตามยอดสั่งซื้อให้ลูกค้าสแกนจ่ายได้ทันที
                </p>
              </div>

              {/* Opening & Closing Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    เวลาเปิดร้าน
                  </Label>
                  <Input
                    type="time"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    เวลาปิดร้าน
                  </Label>
                  <Input
                    type="time"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              {/* Restaurant Logo Upload */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <ImageIcon className="w-3.5 h-3.5 text-primary" />
                  โลโก้ร้านค้า (ตัวเลือก)
                </Label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  onChange={handleLogoFileChange}
                  className="hidden"
                />

                <p className="text-xs text-muted-foreground">{IMAGE_UPLOAD_HINT}</p>

                {logoUrl ? (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg border border-border overflow-hidden bg-background shrink-0 flex items-center justify-center">
                        <img
                          src={logoUrl}
                          alt="Logo Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> อัปโหลดสำเร็จ
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          พร้อมแสดงบนหัวเว็บและใบเสร็จ
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingLogo}
                      >
                        เปลี่ยนรูป
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={handleRemoveLogo}
                        disabled={isUploadingLogo}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="ลบรูปภาพ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isUploadingLogo}
                    onClick={() => !isUploadingLogo && fileInputRef.current?.click()}
                    className={`w-full border border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      isUploadingLogo
                        ? "bg-muted/50 border-muted"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    }`}
                  >
                    {isUploadingLogo ? (
                      <span className="flex flex-col items-center gap-1 py-1">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-xs font-medium text-foreground">กำลังอัปโหลดรูปภาพโลโก้...</span>
                      </span>
                    ) : (
                      <>
                        <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1.5">
                          <Upload className="w-4 h-4" />
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          คลิกเพื่อเลือกไฟล์รูปภาพโลโก้
                        </span>
                        <span className="text-[11px] text-muted-foreground mt-0.5">
                          รองรับไฟล์ JPG, PNG, WEBP แนะนำขนาดสี่เหลี่ยมจัตุรัส
                        </span>
                      </>
                    )}
                  </button>
                )}

                {logoUploadError && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {logoUploadError}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  disabled={isPending || !storeName.trim() || !slug.trim() || slugStatus === "unavailable"}
                  className="w-full h-11 text-sm font-medium justify-center cursor-pointer shadow-xs"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" data-icon="inline-start" />
                      กำลังสร้างร้านค้าและกำหนดสิทธิ์...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" data-icon="inline-start" />
                      สร้างร้านค้าและเข้าสู่แดชบอร์ด
                      <ArrowRight className="w-4 h-4" data-icon="inline-end" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

