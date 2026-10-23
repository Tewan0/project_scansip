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
  Users,
  BarChart3,
  Settings,
  Coffee,
  LogOut,
  Armchair,
  ChefHat,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";

const navItems = [
  { name: "แดชบอร์ด", href: "/dashboard", icon: LayoutDashboard },
  { name: "ผังโต๊ะอาหาร", href: "/dashboard/tables", icon: Armchair },
  { name: "เมนูอาหาร", href: "/dashboard/menu", icon: UtensilsCrossed },
  { name: "บิลหน้าร้าน", href: "/dashboard/orders", icon: Receipt },
  { name: "จัดการพนักงาน", href: "/dashboard/staff", icon: Users },
  { name: "รายงานยอดขาย", href: "/dashboard/reports", icon: BarChart3 },
  { name: "ช่วยงานหน้าร้าน", href: "/frontdesk", icon: Armchair },
  { name: "ช่วยงานครัว", href: "/kitchen", icon: ChefHat },
  { name: "ตั้งค่าร้านค้า", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
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
  const [storeLogoUrl, setStoreLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/store")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.name) {
          setStoreName(json.data.name);
          setStoreLogoUrl(json.data.logoUrl || null);
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
    if (item.href === "/dashboard/tables" && pathname.startsWith("/owner/tables")) {
      return true;
    }
    return pathname.startsWith(item.href);
  });
  const pageTitle = currentItem ? currentItem.name : "แดชบอร์ด";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-border font-sans">
        {/* Sidebar Header with Brand info */}
        <SidebarHeader className="border-b border-border p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href="/owner/dashboard" />}
                className="hover:bg-sidebar-accent"
              >
                <div className="size-8 rounded-lg overflow-hidden bg-primary flex items-center justify-center text-primary-foreground shadow-2xs shrink-0">
                  {storeLogoUrl ? (
                    <img src={storeLogoUrl} alt={storeName} className="w-full h-full object-cover" />
                  ) : (
                    <Coffee className="size-4" />
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold text-foreground">ScanSip</span>
                  <span className="truncate text-xs text-muted-foreground">{storeName}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Sidebar Navigation Items */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground">
              เมนูการจัดการ
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href) ||
                        (item.href === "/dashboard/tables" && pathname.startsWith("/owner/tables"));
                  const IconComponent = item.icon;

                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        render={<Link href={item.href} aria-current={isActive ? "page" : undefined} />}
                        isActive={isActive}
                        tooltip={item.name}
                        className={
                          isActive
                            ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15 hover:text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }
                      >
                        <IconComponent />
                        <span>{item.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Sidebar Footer with User info & Signout */}
        <SidebarFooter className="border-t border-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-sidebar-accent transition-colors group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {currentUser?.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      className="size-8 rounded-full border border-border object-cover shrink-0"
                    />
                  ) : (
                    <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : "OW"}
                    </div>
                  )}
                  <div className="grid flex-1 text-left text-xs leading-tight min-w-0 group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium text-foreground">
                      {currentUser?.name || "เจ้าของร้าน"}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {currentUser?.email || ""}
                    </span>
                  </div>
                </div>

                <LogoutButton
                  title="ออกจากระบบ"
                  aria-label="ออกจากระบบ"
                  formClassName="shrink-0"
                  className="inline-flex size-11 items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer group-data-[collapsible=icon]:size-8"
                >
                  <LogOut className="size-4" />
                </LogoutButton>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Main Content Inset with Header & Trigger */}
      <SidebarInset className="min-w-0 bg-background">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 bg-background sticky top-0 z-30">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-foreground tracking-tight">
            {pageTitle}
          </h1>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

