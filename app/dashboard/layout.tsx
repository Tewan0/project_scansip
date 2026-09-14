/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Receipt,
  QrCode,
  Users,
  BarChart3,
  Settings,
  Coffee,
  X,
  Menu,
  Bell,
  LogOut,
} from "lucide-react";

const navItems = [
  { name: "แดชบอร์ด", href: "/dashboard", icon: LayoutDashboard },
  { name: "เมนูอาหาร", href: "/dashboard/menu", icon: UtensilsCrossed },
  { name: "ออเดอร์", href: "/dashboard/orders", icon: Receipt },
  { name: "คิวอาร์โค้ด", href: "/dashboard/qr-code", icon: QrCode },
  { name: "จัดการพนักงาน", href: "/dashboard/staff", icon: Users },
  { name: "รายงานยอดขาย", href: "/dashboard/reports", icon: BarChart3 },
  { name: "ตั้งค่าร้านค้า", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    avatarUrl?: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser({
          name:
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            data.user.email?.split("@")[0] ||
            "เจ้าของร้าน",
          email: data.user.email || "",
          avatarUrl:
            data.user.user_metadata?.avatar_url ||
            data.user.user_metadata?.picture,
        });
      }
    });
  }, []);

  const [storeName, setStoreName] = useState<string>("แดชบอร์ดเจ้าของร้าน");

  useEffect(() => {
    fetch("/api/store")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.name) {
          setStoreName(json.data.name);
        } else if (!json.data) {
          // If logged-in user doesn't have a store yet, redirect to onboarding
          router.push("/onboarding");
        }
      })
      .catch(() => {});
  }, [router]);

  // Determine current page title
  const currentItem = navItems.find((item) => {
    if (item.href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(item.href);
  });
  const pageTitle = currentItem ? currentItem.name : "แดชบอร์ด";

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-body-md text-body-md text-on-background">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-on-background/40 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SideNavBar (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed md:flex flex-col left-0 top-0 h-screen w-[260px] bg-surface border-r border-border-subtle z-50 py-margin-page transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? "translate-x-0 flex" : "-translate-x-full md:translate-x-0 hidden"
        }`}
      >
        {/* Brand Header */}
        <div className="px-stack-lg pb-stack-lg border-b border-border-subtle mb-stack-md flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-stack-sm group">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-on-primary shadow-xs">
              <Coffee className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-headline-md text-headline-md font-bold text-primary group-hover:opacity-90">
                ScanSip
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant">
                {storeName}
              </span>
            </div>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-on-surface-variant hover:text-on-surface p-1 rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col flex-1 gap-unit px-stack-sm overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const IconComponent = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-stack-sm px-stack-md py-stack-sm transition-colors duration-150 ${
                  isActive
                    ? "bg-secondary-container text-primary border-l-2 border-secondary scale-[0.98] font-semibold rounded-r-lg"
                    : "text-on-surface-variant hover:bg-surface-container-high transition-colors rounded-lg font-normal"
                } ${item.href === "/dashboard/settings" ? "mt-auto" : ""}`}
              >
                <IconComponent className={`w-5 h-5 ${isActive ? "text-primary" : "text-on-surface-variant"}`} />
                <span className="font-label-md text-label-md">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="px-stack-sm pt-stack-sm border-t border-border-subtle mt-auto">
          <div className="flex items-center justify-between p-stack-sm hover:bg-surface-container-low rounded-lg transition-colors group">
            <div className="flex items-center gap-stack-sm min-w-0">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full border border-border-subtle object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-secondary-container/60 overflow-hidden border border-border-subtle shrink-0 flex items-center justify-center font-bold text-xs text-primary">
                  {currentUser?.name
                    ? currentUser.name.slice(0, 2).toUpperCase()
                    : "OW"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-label-md text-label-md text-on-surface truncate">
                  {currentUser?.name || "เจ้าของร้าน ScanSip"}
                </p>
                <p className="font-body-sm text-[11px] text-on-surface-variant truncate">
                  {currentUser?.email || "บัญชี Google"}
                </p>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                title="ออกจากระบบ"
                className="text-on-surface-variant hover:text-error p-1 rounded-md hover:bg-error-container/20 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col md:ml-[260px] h-screen overflow-hidden">
        {/* TopNavBar */}
        <header className="flex justify-between items-center h-16 px-gutter bg-surface border-b border-border-subtle shrink-0 w-full sticky top-0 z-30">
          <div className="flex items-center gap-stack-md">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-on-surface-variant p-2 -ml-2 rounded-full hover:bg-surface-container-low cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-headline-md text-headline-md font-bold text-primary opacity-90">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-stack-md">
            <button
              className="relative text-on-surface-variant hover:bg-surface-container-low rounded-full p-2 transition-colors duration-200 cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border border-surface"></span>
            </button>

            <Link href="/dashboard/settings" className="block cursor-pointer">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-border-subtle hover:opacity-85 transition-opacity">
                <img
                  alt="Owner Profile"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYYkFY8RkvtMuRqSIvZzvo7WosSysjrIi_Miuvt1r5PHa2ZHQmY224H3TR_b1V4pfGDqEOgaa-VYN3tllyvSZLpK1pim0Jgu_yESEd2FFfzeE2aw0CaWX55UY7HE34jlJgTf9904Wu9ErVpuTJfoR6wQOitRaiaPVMG8EIoLO5e8egTcWAvVDf9q02tWOpc6HuZy_rsjHmFI37VT5XmtZIeXajf0A6pXHSaZFscGky-nEX8WsBua9Kqw"
                />
              </div>
            </Link>
          </div>
        </header>

        {/* Dynamic Nested Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
