import { redirect } from "next/navigation";
import { requirePageAccess } from "@/lib/auth";
import { homeForRole } from "@/lib/permissions";

export default async function WorkspacePage() {
  const { role } = await requirePageAccess(["owner", "cashier", "kitchen"]);
  redirect(homeForRole(role));
}
