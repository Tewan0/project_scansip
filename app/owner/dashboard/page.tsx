import { redirect } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";
import { getCurrentOwnerStore } from "@/app/actions/owner-auth";

import { cn } from "@/lib/utils";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Lucide Icons
import {
  Store,
  UtensilsCrossed,
  Receipt,
  Users,
  BarChart3,
  Settings,
  Coffee,
  Clock,
  CreditCard,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  ArrowRight,
  Armchair,
  ChefHat,
  QrCode,
} from "lucide-react";

export default async function OwnerDashboardPage() {
  const { user, store, staffRole } = await getCurrentOwnerStore();

  // If unauthenticated or no store, redirect appropriately
  if (!user) {
    redirect("/owner/login");
  }

  if (!store) {
    redirect("/workspace");
  }

  const storeSlug = store.slug || "scansip";

  const navCards = [
    {
      title: "ช่วยงานหน้าร้าน",
      desc: "เปิดโต๊ะ ดู QR และติดตามออเดอร์",
      href: "/frontdesk",
      icon: Armchair,
      badge: "หน้าร้าน",
      iconClass: "bg-muted text-foreground border-border",
      badgeClass: "bg-muted text-muted-foreground border-border",
    },
    {
      title: "ช่วยงานครัว",
      desc: "เริ่มทำและทำเสร็จแยกรายเมนู",
      href: "/kitchen",
      icon: ChefHat,
      badge: "ครัว",
      iconClass: "bg-muted text-foreground border-border",
      badgeClass: "bg-muted text-muted-foreground border-border",
    },
    {
      title: "แดชบอร์ดสถิติ",
      desc: "ดูยอดขายวันนี้ แนวโน้มรายรับ และออเดอร์ล่าสุด",
      href: "/dashboard",
      icon: LayoutDashboard,
      badge: "ภาพรวมหลัก",
      iconClass: "bg-muted text-foreground border-border",
      badgeClass: "bg-muted text-muted-foreground border-border",
    },
    {
      title: "จัดการเมนูอาหาร",
      desc: "เพิ่มและแก้ไขเมนู ราคา รูปภาพ หมวดหมู่ และสถานะพร้อมขาย",
      href: "/dashboard/menu",
      icon: UtensilsCrossed,
      badge: "จัดการเมนู",
      iconClass: "bg-muted text-foreground border-border",
      badgeClass: "bg-muted text-muted-foreground border-border",
    },
    {
      title: "รายการออเดอร์",
      desc: "ติดตามสถานะคำสั่งซื้อในครัวและของลูกค้าทุกโต๊ะในร้าน",
      href: "/dashboard/orders",
      icon: Receipt,
      badge: "ออเดอร์",
      iconClass: "bg-muted text-foreground border-border",
      badgeClass: "bg-muted text-muted-foreground border-border",
    },
    {
      title: "ผังโต๊ะอาหาร",
      desc: "เปิด-ปิดโต๊ะ และสร้าง QR สำหรับสั่งอาหารในแต่ละรอบโต๊ะ",
      href: "/dashboard/tables",
      icon: QrCode,
      badge: "QR รายรอบ",
      iconClass: "bg-muted text-foreground border-border",
      badgeClass: "bg-muted text-muted-foreground border-border",
    },
    {
      title: "จัดการพนักงาน",
      desc: "เชิญพนักงานและแบ่งสิทธิ์เข้าใช้งานตามหน้าที่ (หน้าร้านและครัว)",
      href: "/dashboard/staff",
      icon: Users,
      badge: "สิทธิ์ทีมงาน",
      iconClass: "bg-muted text-foreground border-border",
      badgeClass: "bg-muted text-muted-foreground border-border",
    },
    {
      title: "รายงานยอดขาย",
      desc: "วิเคราะห์ยอดขาย เมนูยอดนิยม และสรุปรายงานรายรับประจำรอบ",
      href: "/dashboard/reports",
      icon: BarChart3,
      badge: "สถิติ & กราฟ",
      iconClass: "bg-muted text-foreground border-border",
      badgeClass: "bg-muted text-muted-foreground border-border",
    },
    {
      title: "ตั้งค่าร้านค้า",
      desc: "ปรับแต่งข้อมูลร้าน เวลาเปิด-ปิด โลโก้ และเบอร์พร้อมเพย์รับเงิน",
      href: "/dashboard/settings",
      icon: Settings,
      badge: "การตั้งค่า",
      iconClass: "bg-muted text-foreground border-border",
      badgeClass: "bg-muted text-muted-foreground border-border",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-secondary selection:text-foreground">
      {/* Top Navbar using Shadcn structure */}
      <header className="sticky top-0 z-30 bg-card/90 border-b border-border backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar size="default" className="shrink-0 rounded-xl border border-border">
            {store.logoUrl ? (
              <AvatarImage src={store.logoUrl} alt={store.name} className="object-cover" />
            ) : null}
            <AvatarFallback className="rounded-xl bg-primary text-primary-foreground">
              <Coffee className="size-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate font-bold text-base text-foreground leading-tight">
                {store.name}
              </h1>
              <Badge variant="secondary" className="hidden shrink-0 gap-1 text-[11px] font-semibold uppercase sm:inline-flex">
                <ShieldCheck className="size-3 text-emerald-600" />
                {staffRole}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">จัดการร้าน</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LogoutButton
            variant="outline"
            size="sm"
            className="h-11 w-11 text-muted-foreground hover:text-destructive hover:border-destructive/40 sm:w-auto"
          >
            <LogOut data-icon="inline-start" />
            <span className="sr-only sm:not-sr-only">ออกจากระบบ</span>
          </LogoutButton>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Hub */}
      <main className="relative flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">

        {/* Store Profile Card using Shadcn Card */}
        <Card className="border-border/80 shadow-xs hover:shadow-sm transition-all bg-card/95 backdrop-blur-xs relative overflow-hidden">

          <CardHeader className="pb-3 pt-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  <Store className="size-3.5 text-foreground" />
                  <span>ข้อมูลร้านค้าปัจจุบัน</span>
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">{store.name}</CardTitle>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                  <span>เส้นทางร้านค้า:</span>
                  <code className="min-w-0 break-all px-1.5 py-0.5 rounded bg-muted/70 border border-border/60 font-mono text-[11px] text-foreground font-medium">
                    /r/{storeSlug}
                  </code>
                </div>
              </div>

              {/* Action Buttons using Shadcn Button */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
                <Button
                  render={<Link href="/dashboard" />}
                  size="sm"
                  className="font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                >
                  <span>เปิดดูแดชบอร์ดหลัก</span>
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-2 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/70">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/70 flex items-center gap-3">
                <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Clock className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">เวลาทำการ</p>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {store.openingTime || "08:00"} - {store.closingTime || "18:00"} น.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border/70 flex items-center gap-3">
                <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <CreditCard className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">พร้อมเพย์ร้านค้า</p>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {store.promptPayNumber || "ยังไม่ได้ตั้งค่า"}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border/70 flex items-center gap-3">
                <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">ผู้ดูแลระบบ</p>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modules Section Header */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">
                งานในร้าน
              </h2>
              <p className="text-xs text-muted-foreground">
                เลือกงานที่ต้องการจัดการ
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {navCards.length} รายการ
            </Badge>
          </div>

          {/* Bento Grid using Shadcn Cards (Compact, No redundant Footer, Tactile Hover) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {navCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  <Card className="h-full py-0 border-border/80 bg-card shadow-xs transition-all duration-200 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-md hover:border-foreground/20 dark:hover:border-primary/40 dark:hover:shadow-lg dark:hover:shadow-black/20">
                    <CardHeader className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
                        <div
                          className={cn(
                            "size-10 rounded-lg flex items-center justify-center border transition-transform duration-200 group-hover:scale-105",
                            card.iconClass
                          )}
                        >
                          <Icon className="size-5" />
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn("text-[11px] font-medium py-0.5 px-2.5", card.badgeClass)}
                        >
                          {card.badge}
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-bold text-foreground transition-colors flex items-center justify-between gap-3">
                        <span className="group-hover:text-primary transition-colors">{card.title}</span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:translate-x-1.5 motion-reduce:group-hover:translate-x-0 group-hover:text-foreground" />
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-[13px] leading-relaxed mt-2 text-muted-foreground">
                        {card.desc}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="py-6 border-t border-border bg-card text-xs text-muted-foreground mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">ScanSip</span>
            <span>• แดชบอร์ดเจ้าของร้านค้า</span>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-4 text-xs">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              แดชบอร์ดหลัก
            </Link>
            <Link href="/dashboard/settings" className="hover:text-foreground transition-colors">
              ตั้งค่าร้านค้า
            </Link>
            <Link href="/" className="hover:text-foreground transition-colors">
              หน้าแรก
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
