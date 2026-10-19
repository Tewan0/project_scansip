/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
import { getCurrentOwnerStore, signOutOwner } from "@/app/actions/owner-auth";

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
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Lucide Icons
import {
  Store,
  UtensilsCrossed,
  Receipt,
  QrCode,
  Users,
  BarChart3,
  Settings,
  Coffee,
  ExternalLink,
  Clock,
  CreditCard,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  ArrowRight,
  TrendingUp,
  Flame,
  CheckCircle2,
  Armchair,
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
  const customerUrl = `/r/${storeSlug}`;

  const navCards = [
    {
      title: "แดชบอร์ดสถิติ",
      desc: "ดูยอดขายวันนี้ แนวโน้มรายรับ และออเดอร์ล่าสุดแบบเรียลไทม์",
      href: "/dashboard",
      icon: LayoutDashboard,
      badge: "ภาพรวมหลัก",
    },
    {
      title: "จัดการเมนูอาหาร",
      desc: "เพิ่ม แก้ไข หมวดหมู่ และรายการอาหาร/เครื่องดื่ม พร้อมตัวเลือกเสริม",
      href: "/dashboard/menu",
      icon: UtensilsCrossed,
      badge: "เมนู & สต็อก",
    },
    {
      title: "รายการออเดอร์",
      desc: "ติดตามสถานะคำสั่งซื้อในครัวและของลูกค้าทุกโต๊ะในร้าน",
      href: "/dashboard/orders",
      icon: Receipt,
      badge: "Live Orders",
    },
    {
      title: "ผังโต๊ะอาหาร",
      desc: "เปิด-ปิดโต๊ะ และสร้าง Dynamic QR Code สั่งอาหารเฉพาะรอบบิล",
      href: "/dashboard/tables",
      icon: Armchair,
      badge: "Dynamic QR",
    },
    {
      title: "จัดการพนักงาน",
      desc: "เชิญพนักงานและแบ่งสิทธิ์เข้าใช้งานตามหน้าที่ (Manager, Cashier, Kitchen)",
      href: "/dashboard/staff",
      icon: Users,
      badge: "สิทธิ์ทีมงาน",
    },
    {
      title: "รายงานยอดขาย",
      desc: "วิเคราะห์ยอดขาย เมนูยอดนิยม และสรุปรายงานรายรับประจำรอบ",
      href: "/dashboard/reports",
      icon: BarChart3,
      badge: "สถิติ & กราฟ",
    },
    {
      title: "ตั้งค่าร้านค้า",
      desc: "ปรับแต่งข้อมูลร้าน เวลาเปิด-ปิด โลโก้ และเบอร์พร้อมเพย์รับเงิน",
      href: "/dashboard/settings",
      icon: Settings,
      badge: "การตั้งค่า",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-secondary selection:text-foreground">
      {/* Top Navbar using Shadcn structure */}
      <header className="sticky top-0 z-30 bg-card/90 border-b border-border backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar size="default" className="rounded-xl border border-border">
            {store.logoUrl ? (
              <AvatarImage src={store.logoUrl} alt={store.name} className="object-cover" />
            ) : null}
            <AvatarFallback className="rounded-xl bg-primary text-primary-foreground">
              <Coffee className="size-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-foreground leading-tight">
                {store.name}
              </h1>
              <Badge variant="secondary" className="gap-1 text-[11px] font-semibold uppercase">
                <ShieldCheck className="size-3 text-emerald-600" />
                {staffRole}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">พอร์ทัลเจ้าของร้าน (Owner Portal)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <form action={signOutOwner}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:border-destructive/40"
            >
              <LogOut data-icon="inline-start" />
              <span>ออกจากระบบ</span>
            </Button>
          </form>
        </div>
      </header>

      {/* Main Content Hub */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Store Profile Card using Shadcn Card */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  <Store className="size-3.5 text-foreground" />
                  <span>ข้อมูลร้านค้าปัจจุบัน</span>
                </div>
                <CardTitle className="text-2xl font-bold">{store.name}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  URL ร้านค้า: scansip.app/r/{storeSlug}
                </CardDescription>
              </div>

              {/* Action Buttons using Shadcn Button */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
                <Button
                  render={
                    <Link
                      href={customerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                  size="sm"
                >
                  <span>หน้าสั่งอาหารของลูกค้า</span>
                  <ExternalLink data-icon="inline-end" />
                </Button>
                <Button
                  render={<Link href="/dashboard" />}
                  variant="outline"
                  size="sm"
                >
                  <span>เปิดดูแดชบอร์ดหลัก</span>
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border">
              <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center gap-3">
                <div className="size-8 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 text-muted-foreground">
                  <Clock className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">เวลาทำการ</p>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {store.openingTime || "08:00"} - {store.closingTime || "18:00"} น.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center gap-3">
                <div className="size-8 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 text-muted-foreground">
                  <CreditCard className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">พร้อมเพย์ร้านค้า</p>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {store.promptPayNumber || "ยังไม่ได้ตั้งค่า"}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center gap-3">
                <div className="size-8 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 text-muted-foreground">
                  <ShieldCheck className="size-4 text-emerald-600" />
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">
                เมนูการจัดการระบบร้านค้า
              </h2>
              <p className="text-xs text-muted-foreground">
                เลือกโมดูลเพื่อเข้าสู่ระบบบริหารจัดการส่วนต่างๆ ของร้าน
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              7 โมดูลพร้อมใช้งาน
            </Badge>
          </div>

          {/* Bento Grid using Shadcn Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {navCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href} className="group block focus-visible:outline-none">
                  <Card className="h-full justify-between border-border transition-all duration-200 group-hover:border-foreground/30 group-hover:bg-muted/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="size-10 rounded-lg bg-muted flex items-center justify-center border border-border text-foreground transition-transform duration-200 group-hover:scale-105">
                          <Icon className="size-5" />
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {card.badge}
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-bold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                        <span>{card.title}</span>
                        <ArrowRight className="size-4 text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-foreground" />
                      </CardTitle>
                      <CardDescription className="text-xs leading-relaxed mt-1">
                        {card.desc}
                      </CardDescription>
                    </CardHeader>

                    <CardFooter className="pt-0 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border mt-auto">
                      <span>คลิกเพื่อเปิดใช้งาน</span>
                      <span className="font-medium text-foreground">เปิดโมดูล</span>
                    </CardFooter>
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
          <div className="flex items-center gap-4 text-xs">
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
