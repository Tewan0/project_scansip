import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROLE_LABELS, type StaffRole } from "@/lib/permissions";

export function OperationsShell({ children, role, storeName }: { children: React.ReactNode; role: StaffRole; storeName: string }) {
  return <div className="min-h-dvh bg-background">
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1"><p className="truncate font-bold">{storeName}</p><p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p></div>
        <ThemeToggle />
        <form action="/auth/signout" method="post"><button className="min-h-11 rounded-lg border px-3 text-sm" type="submit">ออกจากระบบ</button></form>
        <nav aria-label="หน้าทำงาน" className="flex w-full flex-wrap gap-2 text-sm">
          {role === "owner" && <Link className="rounded-lg border px-3 py-2" href="/owner/dashboard">จัดการร้าน</Link>}
          {role !== "kitchen" && <><Link className="rounded-lg border px-3 py-2" href="/frontdesk">ผังโต๊ะ</Link><Link className="rounded-lg border px-3 py-2" href="/frontdesk/orders">บิลหน้าร้าน</Link></>}
          {role !== "cashier" && <Link className="rounded-lg border px-3 py-2" href="/kitchen">หน้าครัว</Link>}
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-7xl">{children}</main>
  </div>;
}

