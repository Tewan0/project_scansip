/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { name: "Menu", href: "/dashboard/menu", icon: "restaurant_menu" },
  { name: "Orders", href: "/dashboard/orders", icon: "receipt_long" },
  { name: "QR Code", href: "/dashboard/qr-code", icon: "qr_code" },
  { name: "Manage Staff", href: "/dashboard/staff", icon: "group" },
  { name: "Reports", href: "/dashboard/reports", icon: "assessment" },
  { name: "Settings", href: "/dashboard/settings", icon: "settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
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
            "Owner",
          email: data.user.email || "",
          avatarUrl:
            data.user.user_metadata?.avatar_url ||
            data.user.user_metadata?.picture,
        });
      }
    });
  }, []);

  const [storeInfo] = useState<{ storeName?: string }>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("scansip_store_info");
        if (stored) return JSON.parse(stored);
      } catch {
        // ignore
      }
    }
    return {};
  });

  // Determine current page title
  const currentItem = navItems.find((item) => {
    if (item.href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(item.href);
  });
  const pageTitle = currentItem ? currentItem.name : "Dashboard";

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
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                local_cafe
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-md text-headline-md font-bold text-primary group-hover:opacity-90">
                ScanSip
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant">
                {storeInfo.storeName || "Owner Dashboard"}
              </span>
            </div>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-on-surface-variant hover:text-on-surface p-1 rounded"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col flex-1 gap-unit px-stack-sm overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-stack-sm px-stack-md py-stack-sm transition-colors duration-150 ${
                  isActive
                    ? "bg-secondary-container text-primary border-l-2 border-secondary scale-[0.98] font-semibold rounded-r-lg"
                    : "text-on-surface-variant hover:bg-surface-container-high transition-colors rounded-lg font-normal"
                } ${item.name === "Settings" ? "mt-auto" : ""}`}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
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
                  {currentUser?.name || "ScanSip Owner"}
                </p>
                <p className="font-body-sm text-[11px] text-on-surface-variant truncate">
                  {currentUser?.email || "Google Account"}
                </p>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                title="Sign out"
                className="text-on-surface-variant hover:text-error p-1 rounded-md hover:bg-error-container/20 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
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
              <span className="material-symbols-outlined">menu</span>
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
              <span className="material-symbols-outlined">notifications</span>
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
