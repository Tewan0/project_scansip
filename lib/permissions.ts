export type StaffRole = "owner" | "cashier" | "kitchen";

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "เจ้าของร้าน", cashier: "พนักงานหน้าร้าน", kitchen: "ครัว",
};

export function homeForRole(role: StaffRole) {
  return role === "owner" ? "/owner/dashboard" : role === "cashier" ? "/frontdesk" : "/kitchen";
}

export function canAccessPath(role: StaffRole, pathname: string) {
  const within = (prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");
  if (within("/dashboard") || within("/owner")) return role === "owner";
  if (within("/frontdesk")) return role === "owner" || role === "cashier";
  if (within("/kitchen")) return role === "owner" || role === "kitchen";
  return true;
}

export type CookingStatus = "pending" | "preparing" | "ready";
export const COOKING_LABELS: Record<CookingStatus, string> = {
  pending: "รอทำ", preparing: "กำลังทำ", ready: "ทำเสร็จแล้ว",
};

export function canAdvanceItem(from: CookingStatus, to: CookingStatus) {
  return from === to || (from === "pending" && (to === "preparing" || to === "ready")) ||
    (from === "preparing" && to === "ready");
}

export function aggregateCookingStatus(items: { status: CookingStatus }[]) {
  if (items.length && items.every((item) => item.status === "ready")) return "served";
  return items.some((item) => item.status !== "pending") ? "preparing" : "pending";
}
