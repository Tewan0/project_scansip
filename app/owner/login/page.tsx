"use client";

import { useState, useTransition, use } from "react";
import Link from "next/link";
import { signInWithGoogleOwner } from "@/app/actions/owner-auth";
import { Coffee, Store, ShieldCheck, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LoginPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default function OwnerLoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = use(searchParams);
  const errorParam = typeof resolvedParams.error === "string" ? resolvedParams.error : null;
  const [errorMessage, setErrorMessage] = useState<string | null>(errorParam);
  const [isPending, startTransition] = useTransition();

  const handleGoogleLogin = () => {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const result = await signInWithGoogleOwner();
        if (result && !result.success && result.error) {
          setErrorMessage(result.error);
        }
      } catch (err: unknown) {
        // Next.js redirect() throws an error with digest 'NEXT_REDIRECT', which is expected
        if (err instanceof Error && "digest" in err && typeof err.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        console.error("Owner login error:", err);
        setErrorMessage("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
      }
    });
  };

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
      {/* Back to Home Link */}
      <div className="w-full max-w-md mb-4 flex justify-between items-center">
        <Button variant="ghost" size="sm" render={<Link href="/" />}>
          <ArrowLeft className="w-4 h-4" data-icon="inline-start" />
          กลับหน้าหลัก
        </Button>
        <Badge variant="outline" className="text-xs font-normal">
          สำหรับเจ้าของร้าน
        </Badge>
      </div>

      {/* Main Login Card */}
      <Card className="w-full max-w-md shadow-xs border-border">
        <CardHeader className="text-center pb-4 pt-6">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
              <Coffee className="w-6 h-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            ScanSip Portal
          </CardTitle>
          <CardDescription className="text-sm">
            ระบบจัดการร้านอาหารและออเดอร์โต๊ะอาหารแบบครบวงจร
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">เข้าสู่ระบบไม่สำเร็จ</p>
                <p className="mt-0.5 opacity-90">{errorMessage}</p>
              </div>
            </div>
          )}

          <div className="bg-muted/40 p-3.5 rounded-lg border border-border/60 text-xs text-muted-foreground flex items-center gap-2">
            <Store className="w-4 h-4 text-primary shrink-0" />
            <span>เข้าถึงแดชบอร์ด รายการเมนู รายงานยอดขาย และ QR Code โต๊ะ</span>
          </div>

          {/* Google OAuth Login Button */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleGoogleLogin}
            disabled={isPending}
            className="w-full h-12 text-sm font-medium justify-center gap-3 border-border bg-background hover:bg-muted/50 cursor-pointer shadow-2xs"
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span>{isPending ? "กำลังเชื่อมต่อไปยัง Google..." : "ดำเนินการต่อด้วย Google"}</span>
            <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
          </Button>
        </CardContent>

        <CardFooter className="pt-2 pb-6 border-t border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>ยืนยันตัวตนปลอดภัยผ่าน Supabase Auth</span>
        </CardFooter>
      </Card>
    </div>
  );
}

