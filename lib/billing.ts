import type { CookingStatus } from "@/lib/permissions";

export type BillOrder = {
  id: string; orderNumber: string; status: string; paymentStatus: string; totalAmount: string;
  customerNote: string | null; createdAt: string; servingRequired: boolean; deliveredAt: string | null;
  items: { id: string; menuName: string; quantity: number; unitPrice: string; specialInstruction: string | null; status: CookingStatus }[];
};
export type Bill = {
  id: string; number: string; tableNumber: number | null; current: boolean;
  openedAt: string | null; firstOrderedAt: string | null; lastOrderedAt: string | null;
  totalCents: number; paidCents: number; unpaidCents: number; refundedCents: number;
  unfinishedCount: number; unservedCount: number; unpaidOrderIds: string[]; anchorOrderId: string | null;
  orders: BillOrder[];
  payments: { id: string; method: "cash" | "transfer"; amountCents: number; receivedCents: number; changeCents: number; createdAt: string }[];
};
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "รอทำ", preparing: "กำลังทำ", served: "ทำเสร็จแล้ว", completed: "ปิดออเดอร์แล้ว", cancelled: "ยกเลิกแล้ว",
};
export const formatBaht = (cents: number) => (cents / 100).toFixed(2);
