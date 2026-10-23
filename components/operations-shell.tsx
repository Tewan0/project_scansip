"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { ROLE_LABELS, type StaffRole } from "@/lib/permissions";
import { Armchair, ChefHat, LogOut, ReceiptText, Store } from "lucide-react";
import { cn } from "@/lib/utils";

export function OperationsShell({ children, role, storeName }: { children: React.ReactNode; role: StaffRole; storeName: string }) {
  const pathname = usePathname();

  const links = [
    ...(role === "owner" ? [{ href: "/owner/dashboard", label: "จัดการร้าน", icon: Store, exact: false }] : []),
    ...(role !== "kitchen"
      ? [
          { href: "/frontdesk", label: "ผังโต๊ะ", icon: Armchair, exact: true },
          { href: "/frontdesk/orders", label: "บิลหน้าร้าน", icon: ReceiptText, exact: false },
        ]
      : []),
    ...(role !== "cashier" ? [{ href: "/kitchen", label: "หน้าครัว", icon: ChefHat, exact: false }] : []),
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-foreground">{storeName}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
              {ROLE_LABELS[role]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span>ออกจากระบบ</span>
            </LogoutButton>
          </div>
          <nav aria-label="หน้าทำงาน" className="flex w-full flex-wrap gap-2 text-sm pt-1 border-t border-border/50">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = link.exact
                ? pathname === link.href
                : pathname === link.href || (link.href !== "/frontdesk" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                      : "border border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl">{children}</main>
    </div>
  );
}
