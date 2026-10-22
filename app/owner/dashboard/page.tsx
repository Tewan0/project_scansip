import { redirect } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";
import { getCurrentOwnerStore, signOutOwner } from "@/app/actions/owner-auth";

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
    redirect("/owner/onboarding");
  }

  const storeSlug = store.slug || "scansip";

  const navCards = [
    {
      title: "ช่วยงานหน้าร้าน",
      desc: "เปิดโต๊ะ ดู QR และติดตามออเดอร์",
      href: "/frontdesk",
      icon: Armchair,
      badge: "หน้าร้าน",
      iconClass: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-amber-500/20",
      badgeClass: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/60",
    },
    {
      title: "ช่วยงานครัว",
      desc: "เริ่มทำและทำเสร็จแยกรายเมนู",
      href: "/kitchen",
      icon: ChefHat,
      badge: "ครัว",
      iconClass: "bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400 border-orange-500/20",
      badgeClass: "text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border-orange-200/60 dark:border-orange-800/60",
    },
    {
      title: "แดชบอร์ดสถิติ",
      desc: "ดูยอดขายวันนี้ แนวโน้มรายรับ และออเดอร์ล่าสุด",
      href: "/dashboard",
      icon: LayoutDashboard,
      badge: "ภาพรวมหลัก",
      iconClass: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border-blue-500/20",
      badgeClass: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-800/60",
    },
    {
      title: "จัดการเมนูอาหาร",
      desc: "เพิ่มและแก้ไขเมนู ราคา รูปภาพ หมวดหมู่ และสถานะพร้อมขาย",
      href: "/dashboard/menu",
      icon: UtensilsCrossed,
      badge: "จัดการเมนู",
      iconClass: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-500/20",
      badgeClass: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/60",
    },
    {
      title: "รายการออเดอร์",
      desc: "ติดตามสถานะคำสั่งซื้อในครัวและของลูกค้าทุกโต๊ะในร้าน",
      href: "/dashboard/orders",
      icon: Receipt,
      badge: "Live Orders",
      iconClass: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 border-rose-500/20",
      badgeClass: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-800/60",
    },
    {
      title: "ผังโต๊ะอาหาร",
      desc: "เปิด-ปิดโต๊ะ และสร้าง Dynamic QR Code สั่งอาหารเฉพาะรอบบิล",
      href: "/dashboard/tables",
      icon: QrCode,
      badge: "Dynamic QR",
      iconClass: "bg-teal-500/10 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400 border-teal-500/20",
      badgeClass: "text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border-teal-200/60 dark:border-teal-800/60",
    },
    {
      title: "จัดการพนักงาน",
      desc: "เชิญพนักงานและแบ่งสิทธิ์เข้าใช้งานตามหน้าที่ (หน้าร้านและครัว)",
      href: "/dashboard/staff",
      icon: Users,
      badge: "สิทธิ์ทีมงาน",
      iconClass: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400 border-violet-500/20",
      badgeClass: "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 border-violet-200/60 dark:border-violet-800/60",
    },
    {
      title: "รายงานยอดขาย",
      desc: "วิเคราะห์ยอดขาย เมนูยอดนิยม และสรุปรายงานรายรับประจำรอบ",
      href: "/dashboard/reports",
      icon: BarChart3,
      badge: "สถิติ & กราฟ",
      iconClass: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 border-indigo-500/20",
      badgeClass: "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/60 dark:border-indigo-800/60",
    },
    {
      title: "ตั้งค่าร้านค้า",
      desc: "ปรับแต่งข้อมูลร้าน เวลาเปิด-ปิด โลโก้ และเบอร์พร้อมเพย์รับเงิน",
      href: "/dashboard/settings",
      icon: Settings,
      badge: "การตั้งค่า",
      iconClass: "bg-slate-500/10 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300 border-slate-500/20",
      badgeClass: "text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-800/60",
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
            <p className="text-xs text-muted-foreground">พอร์ทัลเจ้าของร้าน</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <form action={signOutOwner}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-11 w-11 text-muted-foreground hover:text-destructive hover:border-destructive/40 sm:w-auto"
            >
              <LogOut data-icon="inline-start" />
              <span className="sr-only sm:not-sr-only">ออกจากระบบ</span>
            </Button>
          </form>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Hub */}
      <main className="relative flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Ambient Top Glow (Works in both Dark & Light mode) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-8 -z-10 flex justify-center overflow-hidden blur-3xl opacity-50 dark:opacity-20"
        >
          <div className="aspect-[1100/300] w-[64rem] flex-none bg-gradient-to-r from-emerald-500/20 via-teal-400/20 to-blue-500/15" />
        </div>

        {/* Store Profile Card using Shadcn Card */}
        <Card className="border-border/80 shadow-xs hover:shadow-sm transition-all bg-card/95 backdrop-blur-xs relative overflow-hidden">
          {/* Subtle top accent gradient line */}
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500 opacity-70" />

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
                เมนูการจัดการระบบร้านค้า
              </h2>
              <p className="text-xs text-muted-foreground">
                เลือกโมดูลเพื่อเข้าสู่ระบบบริหารจัดการส่วนต่างๆ ของร้าน
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {navCards.length} โมดูลพร้อมใช้งาน
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
                  <Card className="h-full py-0 border-border/80 bg-card shadow-xs transition-all duration-200 ease-out hover:-translate-y-1 motion-reduce:hover:translate-y-0 hover:shadow-md hover:border-foreground/20 dark:hover:border-primary/40 dark:hover:shadow-lg dark:hover:shadow-black/20">
                    <CardHeader className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
                        <div
                          className={cn(
                            "size-10 rounded-lg flex items-center justify-center border transition-transform duration-200 group-hover:scale-110",
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
