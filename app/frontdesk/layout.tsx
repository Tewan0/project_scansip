import { requirePageAccess } from "@/lib/auth";
import { OperationsShell } from "@/components/operations-shell";
export default async function FrontdeskLayout({ children }: { children: React.ReactNode }) {
  const { role, store } = await requirePageAccess(["owner", "cashier"]);
  return <OperationsShell role={role} storeName={store.name}>{children}</OperationsShell>;
}

