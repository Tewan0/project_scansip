import Link from "next/link";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AccessDeniedPage() {
  return (
    <div className="relative min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4 overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-16 -z-10 flex justify-center overflow-hidden blur-3xl opacity-50 dark:opacity-20">
        <div className="aspect-[1100/300] w-[60rem] flex-none bg-gradient-to-r from-amber-500/20 via-orange-400/20 to-rose-500/15" />
      </div>

      <div className="w-full max-w-md mb-4 flex justify-end">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md border-border shadow-xs animate-cardEnter">
        <CardHeader className="text-center pb-4 pt-6">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
          <CardTitle className="text-xl font-bold tracking-normal">
            ยังเข้าใช้งานหน้านี้ไม่ได้
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground pt-1">
            กรุณาตรวจว่าล็อกอินด้วยอีเมลที่เจ้าของร้านเพิ่มไว้ หากมีรายชื่อซ้ำหรือบทบาทเดิม ให้เจ้าของร้านแก้ไขในหน้าจัดการพนักงาน
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-2">
          <Button variant="outline" className="w-full justify-center" render={<Link href="/workspace" />}>
            <ArrowLeft className="w-4 h-4" data-icon="inline-start" />
            กลับหน้าทำงานของฉัน
          </Button>

          <form action="/auth/signout" method="post" className="w-full">
            <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 justify-center" type="submit">
              <LogOut className="w-4 h-4" data-icon="inline-start" />
              ออกจากระบบเพื่อเปลี่ยนบัญชี
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
