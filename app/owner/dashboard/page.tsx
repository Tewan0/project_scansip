import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
import { getCurrentOwnerStore, signOutOwner } from "@/app/actions/owner-auth";
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
      desc: "ดูยอดขายวันนี้ แนวโน้มรายรับ และออเดอร์ล่าสุด",
      href: "/dashboard",
      icon: LayoutDashboard,
      color: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      title: "จัดการเมนูอาหาร",
      desc: "เพิ่ม แก้ไข หมวดหมู่ และรายการอาหาร/เครื่องดื่ม",
      href: "/dashboard/menu",
      icon: UtensilsCrossed,
      color: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      title: "รายการออเดอร์",
      desc: "ดูและอัปเดตสถานะคำสั่งซื้อของลูกค้าในร้าน",
      href: "/dashboard/orders",
      icon: Receipt,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      title: "คิวอาร์โค้ดโต๊ะ",
      desc: "สร้างและพิมพ์ QR Code ประจำโต๊ะสำหรับสั่งอาหาร",
      href: "/dashboard/qr-code",
      icon: QrCode,
      color: "bg-purple-50 text-purple-700 border-purple-200",
    },
    {
      title: "จัดการพนักงาน",
      desc: "เชิญพนักงานและกำหนดบทบาท (Manager, Cashier, Kitchen)",
      href: "/dashboard/staff",
      icon: Users,
      color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    {
      title: "รายงานยอดขาย",
      desc: "วิเคราะห์ยอดขาย เมนูขายดี และดาวน์โหลดรายงาน",
      href: "/dashboard/reports",
      icon: BarChart3,
      color: "bg-rose-50 text-rose-700 border-rose-200",
    },
    {
      title: "ตั้งค่าร้านค้า",
      desc: "ปรับแต่งข้อมูลร้าน เวลาเปิด-ปิด และเบอร์พร้อมเพย์",
      href: "/dashboard/settings",
      icon: Settings,
      color: "bg-neutral-50 text-neutral-700 border-neutral-200",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-body-md text-body-md text-on-background">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border-subtle backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
            <Coffee className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-on-surface leading-tight">
                {store.name}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary uppercase">
                <ShieldCheck className="w-3 h-3" />
                {staffRole}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">Owner Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <form action={signOutOwner}>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 border border-border-subtle transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออกจากระบบ</span>
            </button>
          </form>
        </div>
      </header>

      {/* Main Content Hub */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Store Profile Card */}
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-primary font-bold uppercase tracking-wider mb-1">
                <Store className="w-4 h-4" />
                <span>ข้อมูลร้านค้าปัจจุบัน</span>
              </div>
              <h2 className="text-2xl font-bold text-on-surface">{store.name}</h2>
              <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs text-on-surface-variant">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span>
                    เวลาทำการ: {store.openingTime || "08:00"} - {store.closingTime || "18:00"} น.
                  </span>
                </div>
                {store.promptPayNumber && (
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-neutral-400" />
                    <span>พร้อมเพย์: {store.promptPayNumber}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-status-success" />
                  <span>อีเมลผู้ดูแล: {user.email}</span>
                </div>
              </div>
            </div>

            {/* Public Customer URL Link */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 md:pt-0">
              <Link
                href={customerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
              >
                <span>หน้าสั่งอาหารของลูกค้า</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-container border border-border-subtle text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container-high transition-colors"
              >
                <span>เปิดดูแดชบอร์ดหลัก</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Modules Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-on-surface">
              เมนูการจัดการระบบร้านค้า
            </h3>
            <span className="text-xs text-on-surface-variant">
              สิทธิ์การเข้าถึง: เจ้าของร้าน (Owner)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {navCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group bg-surface-card border border-border-subtle hover:border-secondary/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${card.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <h4 className="font-bold text-sm text-on-surface mb-1 group-hover:text-primary transition-colors">
                      {card.title}
                    </h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
