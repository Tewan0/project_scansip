/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Lucide Icons
import {
  CheckCircle2,
  Store,
  CreditCard,
  Clock,
  Upload,
  Trash2,
  Globe,
  AlertCircle,
  RotateCw,
  Coffee,
  Save,
  Check,
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
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const busy = useRef(false);

  const formatSlug = (input: string) => {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  useEffect(() => {
    const fetchStore = async () => {
      try {
        setIsLoading(true);
        setLoadError(false);
        const res = await fetch("/api/store");
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setStoreName(json.data.name || "");
          setPromptPayNumber(json.data.promptPayNumber || "");
          setOpeningTime(json.data.openingTime || "08:00");
          setClosingTime(json.data.closingTime || "18:00");
          setCurrency(json.data.currency || "THB");
          setLogoUrl(json.data.logoUrl || "");
          const initialSlug = json.data.slug || "";
          setSlug(initialSlug);
          setOriginalSlug(initialSlug);
        } else throw new Error("โหลดข้อมูลร้านไม่สำเร็จ");
      } catch (err) {
        console.error("Failed to load store settings:", err);
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStore();
  }, [loadAttempt]);

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
    if (busy.current || loadError || isLoading) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
      setLogoUploadError("กรุณาใช้รูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB");
      e.target.value = "";
      return;
    }

    busy.current = true;
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
      if (res.ok && data.success && data.url) {
        setLogoUrl(data.url);
      } else {
        setLogoUploadError(data.error || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ");
      }
    } catch (err) {
      console.error("Logo upload error:", err);
      setLogoUploadError("ไม่สามารถอัปโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      busy.current = false;
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    if (busy.current || loadError || isLoading) return;
    setLogoUrl("");
    setLogoUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy.current || isLoading || loadError || slugStatus === "checking") return;
    if (slugStatus === "unavailable") {
      setErrorMessage("กรุณาเปลี่ยน URL Slug ให้ไม่ซ้ำกับร้านอื่นก่อนบันทึก");
      return;
    }

    busy.current = true;
    try {
      setIsSaving(true);
      setSaved(false);
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
          slug: slug.trim(),
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
      busy.current = false;
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto font-sans">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Card className="p-6 space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (loadError) return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <p role="alert" className="text-destructive">โหลดข้อมูลร้านไม่สำเร็จ กรุณาลองใหม่ก่อนแก้ไขการตั้งค่า</p>
      <Button onClick={() => setLoadAttempt((value) => value + 1)}>ลองโหลดอีกครั้ง</Button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto font-sans">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            ตั้งค่าข้อมูลร้านค้า
          </h1>
          <Badge variant="outline" className="text-xs">
            Store Profile
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          จัดการชื่อร้าน โลโก้ URL หน้าร้าน เวลาเปิด-ปิด และเบอร์พร้อมเพย์รับชำระเงิน
        </p>
      </div>

      {/* Success Notification Banner */}
      {saved && (
        <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>บันทึกการตั้งค่าร้านค้าเรียบร้อยแล้ว</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <fieldset disabled={isSaving || isUploadingLogo} className="min-w-0 space-y-6">
        {/* Section 1: Logo & Visual Identity */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">โลโก้และเอกลักษณ์ร้านค้า</CardTitle>
            <CardDescription className="text-xs">
              รูปภาพโลโก้จะแสดงบนหน้าแดชบอร์ด เมนูลูกค้า และป้าย QR Code
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Avatar size="lg" className="size-20 rounded-xl border border-border shrink-0">
                {logoUrl ? (
                  <AvatarImage src={logoUrl} alt="Store Logo" className="object-cover" />
                ) : null}
                <AvatarFallback className="rounded-xl bg-muted text-foreground">
                  <Coffee className="size-8 opacity-40" />
                </AvatarFallback>
              </Avatar>

              <div className="space-y-2 flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    variant="outline"
                    size="xs"
                    className="h-8 text-xs"
                  >
                    {isUploadingLogo ? (
                      <RotateCw className="size-3.5 animate-spin" />
                    ) : (
                      <Upload data-icon="inline-start" />
                    )}
                    <span>{logoUrl ? "เปลี่ยนรูปภาพโลโก้" : "อัปโหลดรูปภาพ"}</span>
                  </Button>

                  {logoUrl && (
                    <Button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={isUploadingLogo}
                      variant="outline"
                      size="xs"
                      className="h-8 text-xs text-destructive hover:border-destructive/40"
                    >
                      <Trash2 data-icon="inline-start" />
                      <span>ลบรูปภาพ</span>
                    </Button>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  รองรับไฟล์ PNG, JPG หรือ WebP ขนาดไม่เกิน 5MB (แนะนำอัตราส่วน 1:1)
                </p>
                <p className="text-xs text-muted-foreground">การเปลี่ยนหรือลบโลโก้จะมีผลเมื่อกดบันทึกการตั้งค่า</p>

                {logoUploadError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    <span>{logoUploadError}</span>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Store Information & URL */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">ข้อมูลร้านค้าและการเข้าถึง</CardTitle>
            <CardDescription className="text-xs">
              กำหนดชื่อร้านค้าและที่อยู่ URL เว็บไซต์สำหรับลูกค้าสแกนสั่ง
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Store Name */}
            <div className="space-y-1.5">
              <Label htmlFor="store-name" className="text-xs flex items-center gap-1.5">
                <Store className="size-3.5 text-muted-foreground" />
                <span>ชื่อร้านค้า *</span>
              </Label>
              <Input
                id="store-name"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="เช่น ScanSip Cafe & Roastery"
                className="h-9 text-xs"
              />
            </div>

            {/* Store URL Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="store-slug" className="text-xs flex items-center gap-1.5">
                <Globe className="size-3.5 text-muted-foreground" />
                <span>URL Slug ของร้าน *</span>
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap items-center gap-y-2 w-full min-w-0 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                  <span className="text-muted-foreground select-none">project-scansip.vercel.app/r/</span>
                  <input
                    id="store-slug"
                    type="text"
                    required
                    value={slug}
                    onChange={handleSlugChange}
                    className="min-w-24 w-24 flex-1 bg-transparent font-mono text-foreground outline-none font-semibold pl-1"
                    placeholder="my-cafe"
                  />
                  {slugStatus === "checking" && (
                    <RotateCw className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                  )}
                  {slugStatus === "available" && (
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 shrink-0">
                      <Check className="size-3" /> ว่าง
                    </span>
                  )}
                  {slugStatus === "unavailable" && (
                    <span className="text-[11px] text-destructive font-semibold shrink-0">
                      ไม่ว่าง
                    </span>
                  )}
                </div>
              </div>
              {slugError && (
                <p className="text-xs text-destructive">{slugError}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Operating Hours & PromptPay */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">เวลาทำการและการรับชำระเงิน</CardTitle>
            <CardDescription className="text-xs">
              ตั้งค่าช่วงเวลาเปิด-ปิดร้าน และเบอร์พร้อมเพย์รับเงินจากลูกค้า
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Opening & Closing Times */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="open-time" className="text-xs flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <span>เวลาเปิดร้าน</span>
                </Label>
                <Input
                  id="open-time"
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="close-time" className="text-xs flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <span>เวลาปิดร้าน</span>
                </Label>
                <Input
                  id="close-time"
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* PromptPay Number */}
            <div className="space-y-1.5">
              <Label htmlFor="promptpay-no" className="text-xs flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-muted-foreground" />
                <span>เบอร์พร้อมเพย์รับเงิน (PromptPay)</span>
              </Label>
              <Input
                id="promptpay-no"
                placeholder="เช่น 0891234567 หรือ เลขบัตรประชาชน 13 หลัก"
                value={promptPayNumber}
                onChange={(e) => setPromptPayNumber(e.target.value)}
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                ระบบจะสร้าง QR Code พร้อมเพย์ให้ลูกค้าสแกนจ่ายเงินตรงเข้าบัญชีคุณทันทีเมื่อเช็กบิล
              </p>
            </div>
          </CardContent>

          <CardFooter className="p-4 border-t border-border flex justify-end">
            <Button
              type="submit"
              disabled={isSaving || isUploadingLogo || slugStatus === "checking" || slugStatus === "unavailable"}
              size="sm"
              className="text-xs font-semibold"
            >
              {isSaving ? (
                <>
                  <RotateCw className="size-3.5 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Save data-icon="inline-start" />
                  <span>บันทึกการตั้งค่าร้านค้า</span>
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
        </fieldset>
      </form>
    </div>
  );
}
