import { requirePageAccess } from "@/lib/auth";
import { OperationsShell } from "@/components/operations-shell";
export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  const { role, store } = await requirePageAccess(["owner", "kitchen"]);
  return <OperationsShell role={role} storeName={store.name}>{children}</OperationsShell>;
}

