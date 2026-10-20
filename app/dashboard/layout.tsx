import DashboardShell from "@/components/dashboard-shell";
import { requirePageAccess } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess(["owner"]);
  return <DashboardShell>{children}</DashboardShell>;
}
