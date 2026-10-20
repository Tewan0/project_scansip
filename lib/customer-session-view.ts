import { COOKING_LABELS, type CookingStatus } from "@/lib/permissions";

export type CustomerOrder = {
  id: string; orderNumber: string; status: string; paymentStatus: string; totalAmount: string | number;
  customerNote: string | null; createdAt: string;
  items: { id: string; menuName: string; quantity: number; unitPrice: string | number; specialInstruction: string | null; status: CookingStatus }[];
};
export type CustomerRequest = { id: string; kind: "assistance" | "bill"; status: "pending" | "resolved"; createdAt: string; resolvedAt: string | null };
export const REQUEST_LABELS = { assistance: "เรียกพนักงาน", bill: "ขอเช็กบิล" };
export const ORDER_LABELS: Record<string, string> = { pending: "รับออเดอร์แล้ว", preparing: "กำลังทำ", served: "ทำเสร็จแล้ว / รอเสิร์ฟ", completed: "ปิดออเดอร์แล้ว", cancelled: "ยกเลิกแล้ว" };
export function customerItemStatus(orderStatus: string, itemStatus: CookingStatus) {
  if (orderStatus === "cancelled") return "ยกเลิกแล้ว";
  if (orderStatus === "completed") return "เสร็จสิ้น";
  return COOKING_LABELS[itemStatus] || "รอทำ";
}
export function sessionTotals(orders: CustomerOrder[]) {
  const active = orders.filter((order) => order.status !== "cancelled");
  const cents = (order: CustomerOrder) => Math.round(Number(order.totalAmount) * 100);
  return { total: active.reduce((sum, order) => sum + cents(order), 0) / 100,
    unpaid: active.filter((order) => order.paymentStatus === "unpaid").reduce((sum, order) => sum + cents(order), 0) / 100 };
}
