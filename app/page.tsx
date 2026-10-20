import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";

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
} from "lucide-react";

export const metadata = {
  title: "ScanSip - ระบบสั่งอาหารผ่าน QR Code และจัดการร้านอาหารอัจฉริยะ",
  description:
    "ยกระดับร้านอาหารและคาเฟ่ของคุณด้วยระบบ QR Code Menu สั่งง่าย รับออเดอร์เรียลไทม์ และระบบรายงานยอดขายครบวงจร",
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
    : "เริ่มต้นใช้งานฟรี";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-secondary selection:text-foreground">
      {/* Top Header / Navigation */}
      <header className="sticky top-0 z-40 w-full bg-card/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center border border-border shadow-xs">
              <Coffee className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight leading-tight">
                ScanSip
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Restaurant OS
              </span>
            </div>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              ฟีเจอร์เด่น
            </a>
            <a href="#preview" className="hover:text-foreground transition-colors">
              พรีวิวระบบ
            </a>
            <a href="#bento" className="hover:text-foreground transition-colors">
              ความสามารถ
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              ราคา
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              คำถามที่พบบ่อย
            </a>
          </nav>

          {/* Right Action using Shadcn Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {user ? (
              <div className="flex items-center gap-3">
                <Avatar size="sm" className="hidden sm:inline-flex">
                  <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                    {user.email?.slice(0, 2).toUpperCase() || "OW"}
                  </AvatarFallback>
                </Avatar>
                <Button render={<Link href={primaryCtaHref} />} size="sm">
                  <span className="sm:hidden">แดชบอร์ด</span>
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
                  className="hidden sm:inline-flex"
                >
                  เข้าสู่ระบบ
                </Button>
                <Button render={<Link href="/owner/login" />} size="sm">
                  <span>เริ่มใช้งาน</span>
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 border-b border-border overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            {/* Pill Badge using Shadcn Badge */}
            <div className="flex justify-center mb-6">
              <Badge variant="outline" className="gap-2 py-1 px-3 text-xs font-normal">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                <span>ระบบสั่งอาหารผ่าน QR Code ยุคใหม่ สำหรับร้านอาหารและคาเฟ่</span>
              </Badge>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-foreground tracking-tight leading-[1.15]">
              เปลี่ยนโต๊ะอาหารให้พร้อมรับออเดอร์{" "}
              <span className="text-muted-foreground">ใน 3 วินาที</span>
            </h1>

            {/* Sub-headline */}
            <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              ลดต้นทุนพนักงาน แก้ปัญหาจดออเดอร์ตกหล่น ลูกค้าสแกน QR Code เพื่อสั่งอาหารและเช็กบิลได้ทันที พร้อมระบบจัดการครัวและสถิติยอดขายแบบเรียลไทม์
            </p>

            {/* CTA Buttons using Shadcn Button */}
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button
                render={<Link href={primaryCtaHref} />}
                size="lg"
                className="w-full sm:w-auto h-11 px-6 text-sm"
              >
                <span>{primaryCtaText}</span>
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                render={<a href="#preview" />}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-11 px-6 text-sm"
              >
                <span>ดูตัวอย่างการใช้งาน</span>
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>

            {/* Micro Trust Indicators */}
            <div className="mt-10 pt-8 border-t border-border flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-600" />
                ไม่ต้องลงแอปพลิเคชัน
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-600" />
                รองรับโทรศัพท์ทุกระบบ (iOS / Android)
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-600" />
                เข้าสู่ระบบง่ายด้วย Google
              </span>
            </div>
          </div>

          {/* Interactive Preview Mockup Box with Shadcn Tabs & Table */}
          <div id="preview" className="mt-12 sm:mt-16 max-w-5xl mx-auto">
            <Card className="shadow-xs border-border">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-border gap-2">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-muted-foreground/30" />
                  <div className="size-3 rounded-full bg-muted-foreground/30" />
                  <div className="size-3 rounded-full bg-muted-foreground/30" />
                  <span className="ml-2 text-xs font-mono text-muted-foreground hidden sm:inline">
                    scansip.app/demo
                  </span>
                </div>
                <Badge variant="secondary" className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 w-fit">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Real-time Interactive Demonstration
                </Badge>
              </CardHeader>

              <CardContent className="pt-4">
                <Tabs defaultValue="pos" className="w-full">
                  <div className="flex justify-between items-center mb-4">
                    <TabsList>
                      <TabsTrigger value="pos">
                        <Receipt className="size-3.5 mr-1.5" />
                        Live Kitchen & POS Feed
                      </TabsTrigger>
                      <TabsTrigger value="customer">
                        <Smartphone className="size-3.5 mr-1.5" />
                        หน้าจอลูกค้าสั่งอาหาร
                      </TabsTrigger>
                    </TabsList>
                    <span className="text-xs text-muted-foreground hidden md:inline">
                      กดสลับแท็บเพื่อดูมุมมองแต่ละฝ่าย
                    </span>
                  </div>

                  {/* Tab 1: Live Kitchen & POS Feed using Shadcn Table */}
                  <TabsContent value="pos" className="space-y-4">
                    <div className="border border-border rounded-lg overflow-hidden">
                      <Table>
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
                      <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">ยอดขายวันนี้</p>
                          <p className="text-sm font-bold text-foreground">฿14,850.00</p>
                        </div>
                        <Badge variant="outline">+12%</Badge>
                      </div>
                      <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">ออเดอร์ทั้งหมด</p>
                          <p className="text-sm font-bold text-foreground">48 โต๊ะ</p>
                        </div>
                        <Badge variant="outline">เฉลี่ย 4 นาที</Badge>
                      </div>
                      <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
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
                    <div className="bg-muted/30 border border-border rounded-lg p-4 max-w-lg mx-auto">
                      <div className="flex items-center justify-between pb-3 border-b border-border">
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
                              <p className="text-[11px] text-muted-foreground">หวาน 50% • นมโอ๊ต</p>
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
                              <p className="text-[11px] text-muted-foreground">อบร้อน</p>
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
                        <Button size="xs">
                          <span>ส่งออเดอร์เข้าครัว</span>
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
      <section id="bento" className="py-16 md:py-24 border-b border-border bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <Badge variant="secondary" className="mb-2 uppercase tracking-wider text-[11px]">
              Bento Architecture
            </Badge>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              โครงสร้างระบบครบวงจร ออกแบบมาเพื่อร้านอาหารยุคใหม่
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              รวมทุกเครื่องมือที่เจ้าของร้านต้องการไว้ในระบบเดียว ไม่ต้องซื้อโปรแกรมเพิ่ม
            </p>
          </div>

          {/* Bento Grid Container with Shadcn Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Bento Item 1: Large Box - QR Code Generator & Table Management */}
            <Card className="md:col-span-2 lg:col-span-2 justify-between">
              <CardHeader>
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center mb-2 border border-border">
                  <QrCode className="size-5 text-foreground" />
                </div>
                <CardTitle className="text-lg">
                  ระบบ QR Code ประจำโต๊ะแยกอัตโนมัติ
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm leading-relaxed">
                  สร้างและพิมพ์ QR Code ประจำโต๊ะแบบระบุหมายเลขโต๊ะได้ทันที ลูกค้าสแกนปุ๊บ ระบบจะผูกเข้ากับโต๊ะนั้นโดยตรง ป้องกันการสับสนและสั่งผิดโต๊ะ 100%
                </CardDescription>
              </CardHeader>
              <CardFooter className="justify-between text-xs text-muted-foreground">
                <span>ดาวน์โหลดเป็นรูปภาพหรือ PDF พร้อมพิมพ์</span>
                <Badge variant="outline" className="text-[10px]">
                  พิมพ์ได้ทุกขนาด
                </Badge>
              </CardFooter>
            </Card>

            {/* Bento Item 2: Realtime Kitchen Ticket */}
            <Card className="md:col-span-1 lg:col-span-2 justify-between">
              <CardHeader>
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center mb-2 border border-border">
                  <Zap className="size-5 text-amber-600" />
                </div>
                <CardTitle className="text-lg">
                  ออเดอร์เด้งเข้าครัวทันทีแบบ Real-time
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm leading-relaxed">
                  ทันทีที่ลูกค้ากดยืนยัน รายการอาหารจะส่งตรงไปยังหน้าจอพนักงานหรือครัวโดยไม่ต้องรอเด็กเสิร์ฟเดินไปส่งบิล ประหยัดเวลาได้กว่า 5-10 นาทีต่อออเดอร์
                </CardDescription>
              </CardHeader>
              <CardFooter className="justify-between text-xs text-muted-foreground">
                <span>อัปเดตสถานะ: รอทำ / กำลังทำ / เสิร์ฟแล้ว</span>
                <Badge variant="secondary" className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
                  Instant Sync
                </Badge>
              </CardFooter>
            </Card>

            {/* Bento Item 3: Menu Customizer */}
            <Card className="justify-between">
              <CardHeader>
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center mb-2 border border-border">
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
                รองรับตัวเลือกเสริม (Toppings/Notes)
              </CardFooter>
            </Card>

            {/* Bento Item 4: Sales & Analytics */}
            <Card className="md:col-span-2 justify-between">
              <CardHeader>
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center mb-2 border border-border">
                  <BarChart3 className="size-5 text-indigo-600" />
                </div>
                <CardTitle className="text-base">
                  แดชบอร์ดสรุปยอดขาย & เมนูขายดี
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  แสดงกราฟยอดขายรายวัน เปรียบเทียบการเติบโต และรายงานเมนูยอดนิยม ช่วยให้วางแผนสต็อกวัตถุดิบได้อย่างแม่นยำ ไม่เหลือทิ้ง
                </CardDescription>
              </CardHeader>
              <CardFooter className="justify-between text-xs text-muted-foreground">
                <span>กราฟแสดงผล Real-time</span>
                <span className="font-medium text-foreground">ส่งออกรายงานสรุป</span>
              </CardFooter>
            </Card>

            {/* Bento Item 5: Staff Role Management */}
            <Card className="justify-between">
              <CardHeader>
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center mb-2 border border-border">
                  <Users className="size-5 text-foreground" />
                </div>
                <CardTitle className="text-base">
                  แบ่งบทบาทพนักงาน
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  กำหนดสิทธิ์ผู้จัดการ แคชเชียร์ หรือพนักงานครัว เพื่อความปลอดภัยของข้อมูลการเงินร้าน
                </CardDescription>
              </CardHeader>
              <CardFooter className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                <span>จำกัดสิทธิ์ตามหน้าที่</span>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section id="how-it-works" className="py-16 md:py-24 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <Badge variant="outline" className="mb-2 uppercase tracking-wider text-[11px]">
              Workflow
            </Badge>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              3 ขั้นตอนง่ายๆ เริ่มใช้งานได้ในวันเดียว
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <Card>
              <CardHeader>
                <span className="text-2xl font-black text-muted-foreground/30 mb-1 block">01</span>
                <CardTitle className="text-base">ตั้งค่าร้าน & ใส่เมนูอาหาร</CardTitle>
                <CardDescription className="text-xs sm:text-sm leading-relaxed">
                  ลงทะเบียนร้านผ่าน Google จากนั้นเพิ่มรายการอาหาร ใส่ราคา รูปภาพ และหมวดหมู่ให้พร้อมให้บริการ
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Step 2 */}
            <Card>
              <CardHeader>
                <span className="text-2xl font-black text-muted-foreground/30 mb-1 block">02</span>
                <CardTitle className="text-base">พิมพ์ QR Code วางบนโต๊ะ</CardTitle>
                <CardDescription className="text-xs sm:text-sm leading-relaxed">
                  ระบบจะสร้าง QR Code เฉพาะของแต่ละโต๊ะ สามารถสั่งพิมพ์หรือดาวน์โหลดไปติดบนแท่นวางโต๊ะอาหารได้ทันที
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Step 3 */}
            <Card>
              <CardHeader>
                <span className="text-2xl font-black text-muted-foreground/30 mb-1 block">03</span>
                <CardTitle className="text-base">เปิดรับออเดอร์ & รับชำระเงิน</CardTitle>
                <CardDescription className="text-xs sm:text-sm leading-relaxed">
                  ลูกค้าสแกนสั่งเองผ่านมือถือ ครัวเห็นออเดอร์ทันที พร้อมระบบแสดง QR พร้อมเพย์ของร้านเมื่อลูกค้าต้องการเช็กบิล
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing / Value Section */}
      <section id="pricing" className="py-16 md:py-24 border-b border-border bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <Badge variant="secondary" className="mb-2 uppercase tracking-wider text-[11px]">
              Fair & Transparent
            </Badge>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              เริ่มต้นสร้างระบบให้ร้านอาหารของคุณวันนี้
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              ไม่มีค่าธรรมเนียมแอบแฝง ไม่มีส่วนแบ่งยอดขาย (0% Commission)
            </p>
          </div>

          <Card className="max-w-md mx-auto border-2 border-primary/20 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">Standard Plan</CardTitle>
                <CardDescription className="text-xs">เหมาะสำหรับคาเฟ่และร้านอาหารทุกขนาด</CardDescription>
              </div>
              <Badge>แนะนำ</Badge>
            </CardHeader>

            <CardContent>
              <div className="my-2 pb-6 border-b border-border">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">฿0</span>
                  <span className="text-xs text-muted-foreground">/ ช่วงเปิดตัวใช้งานฟรี</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ใช้งานได้ครบทุกฟังก์ชัน ไม่จำกัดจำนวนออเดอร์
                </p>
              </div>

              <ul className="space-y-3 text-xs sm:text-sm text-foreground my-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>สร้าง QR Code ประจำโต๊ะได้ไม่จำกัดจำนวนโต๊ะ</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>ระบบออเดอร์แบบเรียลไทม์ (Live Sync POS)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>ระบบจัดการเมนูและหมวดหมู่อาหาร</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>รายงานยอดขายและสถิติเมนูยอดนิยม</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>รับชำระผ่าน PromptPay ตรงเข้าบัญชีร้าน 100%</span>
                </li>
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                render={<Link href={primaryCtaHref} />}
                size="lg"
                className="w-full h-11 text-sm font-semibold"
              >
                <span>{primaryCtaText}</span>
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* FAQ Accordion Section using Shadcn Accordion */}
      <section id="faq" className="py-16 md:py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <Badge variant="outline" className="mb-2 uppercase tracking-wider text-[11px]">
              FAQ
            </Badge>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
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
                ไม่ต้องดาวน์โหลดแอปใดๆ ทั้งสิ้น ลูกค้าเพียงเปิดกล้องมือถือ (ทั้ง iOS และ Android) เพื่อสแกน QR Code ประจำโต๊ะ ก็สามารถดูเมนู เลือกปรับระดับความหวาน/ท็อปปิ้ง และกดส่งออเดอร์ผ่าน Web Browser ได้ทันที
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-base font-semibold">
                มีข้อจำกัดเรื่องจำนวนโต๊ะหรือสาขาหรือไม่?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                สามารถสร้าง QR Code ประจำโต๊ะได้ไม่จำกัดจำนวน โดยระบบจะแยกหมายเลขโต๊ะและสร้าง URL เฉพาะโต๊ะให้อัตโนมัติ พร้อมระบบดาวน์โหลดไฟล์ QR สำหรับส่งโรงพิมพ์
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-base font-semibold">
                ระบบชำระเงินทำงานอย่างไร มีหักเปอร์เซ็นต์หรือไม่?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                ไม่มีการหักเปอร์เซ็นต์ยอดขาย (0% GP) ร้านค้าสามารถกรอกเบอร์พร้อมเพย์ (PromptPay) ของตนเองในระบบ เมื่อลูกค้ากดเช็กบิล ระบบจะสร้าง QR Code พร้อมเพย์ให้ลูกค้าสแกนจ่ายตรงเข้าบัญชีของเจ้าของร้านทันที 100%
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
          </Accordion>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-16 md:py-20 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="size-12 rounded-xl bg-primary text-primary-foreground mx-auto flex items-center justify-center mb-6 shadow-xs">
            <Coffee className="size-6" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            พร้อมยกระดับประสบการณ์ให้ร้านของคุณแล้วหรือยัง?
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            เริ่มต้นใช้งาน ScanSip วันนี้ จัดการโต๊ะ รับออเดอร์ และดูยอดขายได้ทันทีจากทุกที่
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              render={<Link href={primaryCtaHref} />}
              size="lg"
              className="h-11 px-8 text-sm font-semibold"
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">ScanSip</span>
              <span>© {new Date().getFullYear()} All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/owner/login" className="hover:text-foreground transition-colors">
                เข้าสู่ระบบเจ้าของร้าน
              </Link>
              <a href="#features" className="hover:text-foreground transition-colors">
                ฟีเจอร์
              </a>
              <a href="#pricing" className="hover:text-foreground transition-colors">
                ราคา
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
