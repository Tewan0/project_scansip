import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MIN_TABLE_COUNT, MAX_TABLE_COUNT } from "@/lib/table-settings";

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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";

// Lucide Icons
import {
  Coffee,
  QrCode,
  Zap,
  BarChart3,
  Users,
  CheckCircle2,
  ArrowRight,
  Receipt,
  UtensilsCrossed,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Flame,
  Armchair,
  MessageCircle,
} from "lucide-react";

export const metadata = {
  title: "ScanSip - ระบบสั่งอาหารผ่าน QR Code และจัดการร้านอาหารอัจฉริยะ",
  description:
    "ระบบสั่งอาหารผ่าน QR ตามรอบโต๊ะ จัดการออเดอร์ ครัว บิล และรายงานยอดขาย พร้อม AI ช่วยลูกค้าเลือกเมนูเมื่อเปิดใช้งาน",
};

export default async function HomePage() {
  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  let user = null;
  let userStore = null;

  if (isConfigured) {
    try {
      const supabase = await createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        user = authUser;
        const store = await db.query.stores.findFirst({
          where: eq(stores.ownerId, authUser.id),
        });
        if (store) {
          userStore = store;
        }
      }
    } catch {
      user = null;
      userStore = null;
    }
  }

  const primaryCtaHref = user
    ? userStore
      ? "/owner/dashboard"
      : "/owner/onboarding"
    : "/owner/login";

  const primaryCtaText = user
    ? userStore
      ? "เข้าสู่แดชบอร์ดร้าน"
      : "ดำเนินการตั้งค่าร้านต่อ"
    : "เริ่มต้นใช้งาน";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-secondary selection:text-foreground">
      {/* Top Header / Navigation */}
      <header className="sticky top-0 z-40 w-full bg-background/80 dark:bg-card/80 backdrop-blur-md border-b border-border transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center border border-border shadow-xs group-hover:scale-105 transition-transform">
              <Coffee className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-normal leading-tight">
                ScanSip
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Restaurant OS
              </span>
            </div>
          </Link>

          {/* Navigation Links (Desktop & iPad) */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-xs lg:text-sm font-medium text-muted-foreground">
            <a href="#preview" className="hover:text-foreground transition-colors">
              ตัวอย่างหน้าจอ
            </a>
            <a href="#bento" className="hover:text-foreground transition-colors">
              ความสามารถ
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              วิธีเริ่มต้น
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              การใช้งาน
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              คำถามที่พบบ่อย
            </a>
          </nav>

          {/* Right Action using Shadcn Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <Avatar size="sm" className="hidden sm:inline-flex">
                  <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                    {user.email?.slice(0, 2).toUpperCase() || "OW"}
                  </AvatarFallback>
                </Avatar>
                <Button render={<Link href={primaryCtaHref} />} size="sm" className="font-semibold shadow-xs">
                  <span className="sm:hidden">{userStore ? "แดชบอร์ด" : "ตั้งค่าร้าน"}</span>
                  <span className="hidden sm:inline">{primaryCtaText}</span>
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            ) : (
              <>
                <Button
                  render={<Link href="/owner/login" />}
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex text-xs sm:text-sm"
                >
                  เข้าสู่ระบบ
                </Button>
                <Button render={<Link href="/owner/login" />} size="sm" className="font-semibold shadow-xs">
                  <span>เริ่มต้นใช้งาน</span>
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-8 pb-12 sm:pt-14 sm:pb-18 md:pt-16 md:pb-20 border-b border-border overflow-hidden">
        {/* Ambient Radial Background Glow (Works in both Dark & Light mode) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-24 -z-10 flex justify-center overflow-hidden blur-3xl"
        >
          <div className="aspect-[1100/400] w-[68rem] flex-none bg-gradient-to-r from-emerald-500/15 via-teal-400/20 to-emerald-500/10 dark:from-emerald-500/25 dark:via-teal-400/15 dark:to-emerald-400/10 opacity-70" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            {/* Pill Badge using Shadcn Badge */}
            <div className="flex justify-center mb-4 sm:mb-5">
              <Badge
                variant="outline"
                className="gap-2 py-1 px-3 sm:px-3.5 text-xs font-normal rounded-full bg-background/80 backdrop-blur-xs border-emerald-500/30 text-foreground/90 shadow-2xs"
              >
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                </span>
                <span>ระบบ QR Code Menu & จัดการร้านอาหารยุคใหม่</span>
              </Badge>
            </div>

            {/* Main Headline with controlled Thai word wrapping and vibrant emphasis */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-foreground tracking-normal leading-[1.22] sm:leading-[1.18]">
              เปลี่ยนโต๊ะอาหารให้พร้อม<span className="inline-block">รับออเดอร์</span>{" "}
              <span className="inline-block bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-400 bg-clip-text text-transparent">
                ผ่าน QR Code
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="mt-4 sm:mt-5 text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto px-2 sm:px-0">
              ลูกค้าสแกน QR ของรอบโต๊ะเพื่อเลือกเมนู ส่งออเดอร์ และขอเช็กบิล ทีมงานติดตามงานครัว การเสิร์ฟ และการรับเงิน ส่วนเจ้าของร้านดูสรุปยอดขายได้ในระบบเดียว
            </p>

            {/* CTA Buttons using Shadcn Button */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto max-w-xs sm:max-w-none mx-auto">
              <Button
                render={<Link href={primaryCtaHref} />}
                size="lg"
                className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 text-sm font-semibold shadow-md shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.99] transition-all cursor-pointer"
              >
                <span>{primaryCtaText}</span>
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                render={<a href="#preview" />}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 text-sm font-medium hover:bg-muted/80 active:scale-[0.99] transition-all cursor-pointer"
              >
                <span>ดูตัวอย่างการใช้งาน</span>
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>

            {/* Micro Trust Indicators */}
            <div className="mt-8 sm:mt-10 pt-6 sm:pt-7 border-t border-border/70 flex flex-wrap items-center justify-center gap-y-2.5 gap-x-6 sm:gap-x-8 text-xs sm:text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ไม่ต้องลงแอปพลิเคชัน
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ใช้งานผ่านเบราว์เซอร์บนมือถือ
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                เข้าสู่ระบบง่ายด้วย Google
              </span>
            </div>
          </div>

          {/* Interactive Preview Mockup Box with Shadcn Tabs & Table */}
          <div id="preview" className="mt-8 sm:mt-12 lg:mt-14 max-w-5xl mx-auto relative scroll-mt-20">
            {/* Soft backlight for the mockup in both themes */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-emerald-500/10 via-border/40 to-transparent blur-xl -z-10 dark:from-emerald-500/15" />
            <Card className="shadow-2xl shadow-black/5 dark:shadow-2xl dark:shadow-emerald-950/20 border-border/80 bg-card/95 backdrop-blur-xs transition-all overflow-hidden">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-border/80 gap-3 bg-muted/20">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 sm:size-3 rounded-full bg-red-400/80 dark:bg-red-500/70" />
                    <div className="size-2.5 sm:size-3 rounded-full bg-amber-400/80 dark:bg-amber-500/70" />
                    <div className="size-2.5 sm:size-3 rounded-full bg-emerald-400/80 dark:bg-emerald-500/70" />
                  </div>
                  <span className="ml-2 px-2.5 py-0.5 rounded-md bg-background/80 border border-border/60 text-[11px] font-mono text-muted-foreground hidden sm:inline-block">
                    ScanSip / ตัวอย่างหน้าจอ
                  </span>
                </div>
                <Badge variant="secondary" className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 w-fit">
                  ข้อมูลสมมติสำหรับแสดงตัวอย่าง
                </Badge>
              </CardHeader>

              <CardContent className="p-3.5 sm:p-6">
                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                  สลับแท็บเพื่อดูตัวอย่างมุมมองทีมงานและลูกค้า ข้อมูลนี้ไม่ใช่ออเดอร์จริง และส่งคำสั่งซื้อจากตัวอย่างไม่ได้
                </p>
                <Tabs defaultValue="pos" className="w-full">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                    <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
                      <TabsTrigger value="pos" className="text-xs sm:text-sm">
                        <Receipt className="size-3.5 mr-1.5" />
                        ออเดอร์และยอดขาย
                      </TabsTrigger>
                      <TabsTrigger value="customer" className="text-xs sm:text-sm">
                        <Smartphone className="size-3.5 mr-1.5" />
                        หน้าจอลูกค้าสั่งอาหาร
                      </TabsTrigger>
                    </TabsList>
                    <span className="text-xs text-muted-foreground hidden lg:inline">
                      กดสลับแท็บเพื่อดูมุมมองแต่ละฝ่าย
                    </span>
                  </div>

                  {/* Tab 1: Live Kitchen & POS Feed using Shadcn Table */}
                  <TabsContent value="pos" className="space-y-4">
                    <div className="border border-border/80 rounded-lg overflow-x-auto bg-card">
                      <Table className="min-w-[540px] sm:min-w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[110px]">โต๊ะ</TableHead>
                            <TableHead>รายการที่สั่ง</TableHead>
                            <TableHead className="w-[130px]">เวลา</TableHead>
                            <TableHead className="text-right w-[110px]">ยอดรวม</TableHead>
                            <TableHead className="text-right w-[120px]">สถานะ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-bold flex items-center gap-1.5">
                              <Armchair className="size-3.5 text-muted-foreground" />
                              โต๊ะ 05
                            </TableCell>
                            <TableCell>Dirty Coffee (1), Almond Croissant (1)</TableCell>
                            <TableCell className="text-xs text-muted-foreground">1 นาทีที่แล้ว</TableCell>
                            <TableCell className="text-right font-bold">฿220</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary" className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                                กำลังทำ
                              </Badge>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-bold flex items-center gap-1.5">
                              <Armchair className="size-3.5 text-muted-foreground" />
                              โต๊ะ 02
                            </TableCell>
                            <TableCell>Iced Matcha Latte (2)</TableCell>
                            <TableCell className="text-xs text-muted-foreground">5 นาทีที่แล้ว</TableCell>
                            <TableCell className="text-right font-bold">฿190</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary" className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                                เสิร์ฟแล้ว
                              </Badge>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-bold flex items-center gap-1.5">
                              <Armchair className="size-3.5 text-muted-foreground" />
                              โต๊ะ 08
                            </TableCell>
                            <TableCell>Hot Americano (1), Banana Bread (1)</TableCell>
                            <TableCell className="text-xs text-muted-foreground">9 นาทีที่แล้ว</TableCell>
                            <TableCell className="text-right font-bold">฿145</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary" className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                                เสิร์ฟแล้ว
                              </Badge>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg border border-border/80 bg-background/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">ยอดขายวันนี้</p>
                          <p className="text-sm font-bold text-foreground">฿14,850.00</p>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold">+12%</Badge>
                      </div>
                      <div className="p-3 rounded-lg border border-border/80 bg-background/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">ออเดอร์ทั้งหมด</p>
                          <p className="text-sm font-bold text-foreground">48 ออเดอร์</p>
                        </div>
                        <Badge variant="outline">ข้อมูลตัวอย่าง</Badge>
                      </div>
                      <div className="p-3 rounded-lg border border-border/80 bg-background/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">เมนูขายดี</p>
                          <p className="text-sm font-bold text-foreground truncate">Dirty Coffee</p>
                        </div>
                        <Flame className="size-4 text-amber-500" />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 2: Customer Ordering UI Preview */}
                  <TabsContent value="customer" className="space-y-4">
                    <div className="bg-muted/30 border border-border/80 rounded-lg p-3 sm:p-4 max-w-lg mx-auto">
                      <div className="flex items-center justify-between pb-3 border-b border-border/80">
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <Coffee className="size-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">The Artisan Roast</p>
                            <p className="text-[11px] text-muted-foreground">โต๊ะ 05 • กำลังสั่งอาหาร</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          ลูกค้า
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="p-2.5 rounded-lg bg-card border border-border flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-foreground">
                              ☕
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">Dirty Coffee</p>
                              <p className="text-[11px] text-muted-foreground">หมายเหตุ: หวานน้อย</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-foreground">฿125</span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-card border border-border flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-foreground">
                              🥐
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">Almond Croissant</p>
                              <p className="text-[11px] text-muted-foreground">หมายเหตุ: อบร้อน</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-foreground">฿95</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-muted-foreground">ยอดรวม 2 รายการ</span>
                          <p className="text-sm font-bold text-foreground">฿220.00</p>
                        </div>
                        <Button size="xs" disabled>
                          <span>ตัวอย่างปุ่มส่งออเดอร์</span>
                          <ArrowRight data-icon="inline-end" />
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Bento Grid Feature Section */}
      <section id="bento" className="py-16 md:py-24 border-b border-border bg-muted/20 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <Badge variant="secondary" className="mb-2 uppercase tracking-wider text-[11px]">
              ความสามารถของ ScanSip
            </Badge>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-normal">
              ดูแลงานตั้งแต่รับออเดอร์จนถึงปิดโต๊ะ
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              จัดการเมนู โต๊ะ ทีมงาน และรายงานยอดขายจากพื้นที่ทำงานของร้าน
            </p>
          </div>

          {/* Bento Grid Container with Shadcn Cards (Balanced for Mobile, iPad & Desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Bento Item 1: Large Box - QR Code Generator & Table Management */}
            <Card className="md:col-span-2 lg:col-span-2 justify-between border-border/80 hover:border-border transition-colors">
              <CardHeader>
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center mb-2 border border-border/80">
                  <QrCode className="size-5 text-foreground" />
                </div>
                <CardTitle className="text-lg">
                  QR Code แยกตามรอบโต๊ะ
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm leading-relaxed">
                  เปิดโต๊ะเพื่อสร้าง QR สำหรับลูกค้ารอบนั้น หลายมือถือสั่งเพิ่มเข้าบิลเดียวกันได้ เมื่อปิดโต๊ะ QR เดิมจะหมดอายุ และเปิดรอบใหม่ด้วย QR ใหม่
                </CardDescription>
              </CardHeader>
              <CardFooter className="justify-between text-xs text-muted-foreground">
                <span>แสดง QR และคัดลอกลิงก์ของรอบปัจจุบัน</span>
                <Badge variant="outline" className="text-[10px]">
                  สูงสุด {MAX_TABLE_COUNT} โต๊ะ
                </Badge>
              </CardFooter>
            </Card>

            {/* Bento Item 2: Realtime Kitchen Ticket */}
            <Card className="md:col-span-1 lg:col-span-2 justify-between border-border/80 hover:border-border transition-colors">
              <CardHeader>
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center mb-2 border border-border/80">
                  <Zap className="size-5 text-amber-500" />
                </div>
                <CardTitle className="text-lg">
                  ติดตามออเดอร์และงานครัว
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm leading-relaxed">
                  หน้าครัวดึงออเดอร์ใหม่เป็นระยะ พนักงานกดเริ่มทำและทำเสร็จ จากนั้นหน้าร้านยืนยันการเสิร์ฟ โดยแยกสถานะอาหารออกจากสถานะรับเงิน
                </CardDescription>
              </CardHeader>
              <CardFooter className="justify-between text-xs text-muted-foreground">
                <span>รอทำ / กำลังทำ / รอเสิร์ฟ / เสิร์ฟแล้ว</span>
                <Badge variant="secondary" className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  อัปเดตอัตโนมัติ
                </Badge>
              </CardFooter>
            </Card>

            {/* Bento Item 3: Menu Customizer */}
            <Card className="md:col-span-1 lg:col-span-1 justify-between border-border/80 hover:border-border transition-colors">
              <CardHeader>
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center mb-2 border border-border/80">
                  <UtensilsCrossed className="size-5 text-foreground" />
                </div>
                <CardTitle className="text-base">
                  จัดการเมนู & หมวดหมู่
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  เพิ่ม ลบ ปรับราคา หรือเปิด-ปิดเมนูที่ของหมดได้ทันทีจากมือถือ ไม่ต้องพิมพ์เล่มเมนูใหม่เมื่อมีการเปลี่ยนราคา
                </CardDescription>
              </CardHeader>
              <CardFooter className="text-xs text-muted-foreground">
                ลูกค้าเขียนหมายเหตุรายเมนูและถึงครัวได้
              </CardFooter>
            </Card>

            {/* Bento Item 4: Sales & Analytics */}
            <Card className="md:col-span-1 lg:col-span-2 justify-between border-border/80 hover:border-border transition-colors">
              <CardHeader>
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center mb-2 border border-border/80">
                  <BarChart3 className="size-5 text-indigo-500" />
                </div>
                <CardTitle className="text-base">
                  แดชบอร์ดสรุปยอดขาย & เมนูขายดี
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  ดูสรุปยอดขายตามช่วงวันที่ กราฟยอดขาย และเมนูยอดนิยม เพื่อประกอบการวางแผนร้าน พร้อมส่งออกรายงาน CSV ที่เปิดใน Excel ได้
                </CardDescription>
              </CardHeader>
              <CardFooter className="justify-between text-xs text-muted-foreground">
                <span>เลือกช่วงวันที่ของรายงาน</span>
                <span className="font-medium text-foreground">ส่งออก CSV</span>
              </CardFooter>
            </Card>

            {/* Bento Item 5: Staff Role Management */}
            <Card className="md:col-span-1 lg:col-span-1 justify-between border-border/80 hover:border-border transition-colors">
              <CardHeader>
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center mb-2 border border-border/80">
                  <Users className="size-5 text-foreground" />
                </div>
                <CardTitle className="text-base">
                  แบ่งบทบาทพนักงาน
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  เจ้าของร้านเพิ่มทีมงานด้วยอีเมล Google และกำหนดสิทธิ์หน้าร้านหรือครัว ให้แต่ละคนเข้าถึงงานตามบทบาท
                </CardDescription>
              </CardHeader>
              <CardFooter className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>จำกัดสิทธิ์ตามหน้าที่</span>
              </CardFooter>
            </Card>
            <Card className="md:col-span-3 lg:col-span-4 border-border/80">
              <CardHeader>
                <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <MessageCircle className="size-5" />
                </div>
                <CardTitle className="text-lg">AI ช่วยลูกค้าเลือกเมนู</CardTitle>
                <CardDescription className="text-xs sm:text-sm leading-relaxed">
                  เมื่อเปิดใช้งาน AI ลูกค้าถามหาเมนูตามความชอบหรืองบประมาณได้จากหน้าสั่งอาหาร ระบบอ้างอิงเมนูที่ร้านเปิดขาย ลูกค้าเลือกเพิ่มลงตะกร้าและยืนยันส่งออเดอร์เอง
                </CardDescription>
              </CardHeader>
              <CardFooter className="text-xs text-muted-foreground">
                ต้องตั้งค่าบริการ AI ก่อนใช้งาน และควรยืนยันข้อมูลส่วนผสมหรืออาหารที่แพ้กับพนักงาน
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section id="how-it-works" className="py-16 md:py-24 border-b border-border scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <Badge variant="outline" className="mb-2 uppercase tracking-wider text-[11px]">
              Workflow
            </Badge>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-normal">
              3 ขั้นตอนเริ่มใช้งานร้าน
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <Card className="border-border/80 hover:border-border transition-all">
              <CardHeader>
                <span className="text-2xl font-black text-emerald-600/40 dark:text-emerald-400/40 mb-1 block">01</span>
                <CardTitle className="text-base">ตั้งค่าร้าน & ใส่เมนูอาหาร</CardTitle>
                <CardDescription className="text-xs sm:text-sm leading-relaxed">
                  ลงทะเบียนร้านผ่าน Google จากนั้นเพิ่มรายการอาหาร ใส่ราคา รูปภาพ และหมวดหมู่ให้พร้อมให้บริการ
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Step 2 */}
            <Card className="border-border/80 hover:border-border transition-all">
              <CardHeader>
                <span className="text-2xl font-black text-emerald-600/40 dark:text-emerald-400/40 mb-1 block">02</span>
                <CardTitle className="text-base">เปิดโต๊ะ & ให้ลูกค้าสแกน QR</CardTitle>
                <CardDescription className="text-xs sm:text-sm leading-relaxed">
                  พนักงานเปิดรอบโต๊ะแล้วแสดง QR ให้ลูกค้าสแกน ใช้ QR เดิมได้ตลอดรอบนั้น และเปลี่ยน QR เมื่อเปิดรับลูกค้ารอบใหม่
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Step 3 */}
            <Card className="border-border/80 hover:border-border transition-all">
              <CardHeader>
                <span className="text-2xl font-black text-emerald-600/40 dark:text-emerald-400/40 mb-1 block">03</span>
                <CardTitle className="text-base">เปิดรับออเดอร์ & รับชำระเงิน</CardTitle>
                <CardDescription className="text-xs sm:text-sm leading-relaxed">
                  ครัวจัดการออเดอร์ หน้าร้านยืนยันการเสิร์ฟและรับเงินสดหรือโอน/พร้อมเพย์ โดยตรวจยอดโอนเองก่อนบันทึก แล้วปิดโต๊ะเมื่อรับเงินและเสิร์ฟครบ
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing / Value Section */}
      <section id="pricing" className="py-16 md:py-24 border-b border-border bg-muted/20 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <Badge variant="secondary" className="mb-2 uppercase tracking-wider text-[11px]">
              เริ่มต้นกับ ScanSip
            </Badge>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-normal">
              เริ่มต้นสร้างระบบให้ร้านอาหารของคุณวันนี้
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              เข้าสู่ระบบด้วย Google แล้วตั้งค่าร้าน เมนู และโต๊ะก่อนรับออเดอร์
            </p>
          </div>

          <Card className="max-w-md mx-auto border-2 border-primary/20 shadow-lg shadow-black/5 dark:shadow-2xl dark:shadow-emerald-950/20 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-xl">พื้นที่ทำงานของร้าน</CardTitle>
                <CardDescription className="text-xs">สำหรับจัดการร้านอาหารและคาเฟ่</CardDescription>
              </div>
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500">
                ฟีเจอร์ปัจจุบัน
              </Badge>
            </CardHeader>

            <CardContent>
              <div className="my-2 pb-6 border-b border-border/80">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-foreground">เริ่มจากร้านของคุณ</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  ตั้งค่าร้านและเพิ่มเมนู แล้วเปิดโต๊ะเพื่อเริ่มรับออเดอร์
                </p>
              </div>

              <ul className="space-y-3 text-xs sm:text-sm text-foreground my-6">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>ตั้งค่าได้ {MIN_TABLE_COUNT}–{MAX_TABLE_COUNT} โต๊ะ พร้อม QR แยกตามรอบ</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>ติดตามออเดอร์ งานครัว และการเสิร์ฟ</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>ระบบจัดการเมนูและหมวดหมู่อาหาร</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>รายงานยอดขายและสถิติเมนูยอดนิยม</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>บันทึกรับเงินสดหรือโอน/พร้อมเพย์โดยพนักงาน</span>
                </li>
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                render={<Link href={primaryCtaHref} />}
                size="lg"
                className="w-full h-11 text-sm font-semibold shadow-md shadow-primary/10 hover:shadow-lg active:scale-[0.99] transition-all cursor-pointer"
              >
                <span>{primaryCtaText}</span>
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* FAQ Accordion Section using Shadcn Accordion */}
      <section id="faq" className="py-16 md:py-24 border-b border-border scroll-mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <Badge variant="outline" className="mb-2 uppercase tracking-wider text-[11px]">
              FAQ
            </Badge>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-normal">
              คำถามที่พบบ่อย
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              ข้อสงสัยทั่วไปเกี่ยวกับการติดตั้งและใช้งานระบบ ScanSip
            </p>
          </div>

          <Accordion className="w-full space-y-2">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-base font-semibold">
                ลูกค้าต้องดาวน์โหลดแอปพลิเคชันหรือไม่?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                ไม่ต้องติดตั้งแอป ลูกค้าสแกน QR ของรอบโต๊ะแล้วเปิดผ่านเบราว์เซอร์ เพื่อเลือกเมนู ระบุจำนวน เขียนหมายเหตุ และส่งออเดอร์ ปัจจุบันยังไม่มีตัวเลือกท็อปปิ้งที่คิดราคาเพิ่มอัตโนมัติ
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-base font-semibold">
                ตั้งโต๊ะได้กี่โต๊ะ และใช้ QR เดิมได้ตลอดหรือไม่?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                ตั้งจำนวนโต๊ะได้ {MIN_TABLE_COUNT}–{MAX_TABLE_COUNT} โต๊ะต่อร้าน QR ใช้ได้เฉพาะรอบที่เปิดอยู่ เมื่อปิดโต๊ะ QR เดิมจะหมดอายุ ต้องใช้ QR ใหม่สำหรับรอบถัดไป จึงไม่ควรนำ QR ของรอบหนึ่งไปติดใช้งานถาวร
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-base font-semibold">
                รับเงินและยืนยันยอดโอนอย่างไร?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                ระบบแสดงยอดบิลและ QR พร้อมเพย์เมื่อร้านตั้งค่าหมายเลขไว้ ลูกค้าควรตรวจยอดกับพนักงานก่อนโอน พนักงานต้องตรวจเงินเข้าบัญชีร้านและยืนยันรับเงินเอง ระบบยังไม่ตรวจสลิปหรือยืนยันยอดโอนอัตโนมัติ ส่วนเงินสดสามารถกรอกยอดรับเพื่อคำนวณเงินทอนได้
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-base font-semibold">
                สามารถแบ่งบทบาทให้พนักงานแต่ละคนได้หรือไม่?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                เพิ่มทีมงานด้วยอีเมล Google และแบ่งสิทธิ์เป็นพนักงานหน้าร้านหรือครัว โดยเจ้าของร้านจัดการยอดขายและการตั้งค่า พร้อมเข้าไปช่วยงานทั้งสองฝ่ายได้
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger className="text-base font-semibold">
                AI Chatbot ใช้ได้ทันทีหรือไม่?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                ต้องตั้งค่าบริการ AI ก่อนใช้งาน และอาจมีค่าใช้จ่ายตามผู้ให้บริการ AI ช่วยแนะนำเมนู แต่ลูกค้าต้องเลือกและส่งออเดอร์เอง หาก AI ยังไม่พร้อม ลูกค้ายังสั่งจากเมนูได้ตามปกติ
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-16 md:py-20 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="size-12 rounded-xl bg-primary text-primary-foreground mx-auto flex items-center justify-center mb-6 shadow-xs">
            <Coffee className="size-6" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-normal">
            พร้อมยกระดับประสบการณ์ให้ร้านของคุณแล้วหรือยัง?
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            ตั้งค่าร้านและเมนูให้พร้อม แล้วให้ทีมงานจัดการออเดอร์ โต๊ะ และยอดขายผ่านเบราว์เซอร์ที่เชื่อมต่ออินเทอร์เน็ต
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              render={<Link href={primaryCtaHref} />}
              size="lg"
              className="h-11 px-8 text-sm font-semibold shadow-md shadow-primary/10 hover:shadow-lg active:scale-[0.99] transition-all cursor-pointer"
            >
              <span>{primaryCtaText}</span>
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </section>

      {/* Clean Footer with Separator */}
      <footer className="py-8 bg-background text-muted-foreground text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">ScanSip</span>
              <span>© {new Date().getFullYear()} All rights reserved.</span>
            </div>
            <div className="flex flex-wrap justify-center sm:justify-end items-center gap-x-6 gap-y-2">
              <Link href="/owner/login" className="hover:text-foreground transition-colors">
                เข้าสู่ระบบเจ้าของร้าน
              </Link>
              <a href="#preview" className="hover:text-foreground transition-colors">
                พรีวิวระบบ
              </a>
              <a href="#bento" className="hover:text-foreground transition-colors">
                ความสามารถ
              </a>
              <a href="#pricing" className="hover:text-foreground transition-colors">
                การใช้งาน
              </a>
              <a href="#faq" className="hover:text-foreground transition-colors">
                FAQ
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
