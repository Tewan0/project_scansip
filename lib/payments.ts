export type PaymentMethod = "cash" | "transfer";
export const MAX_PAYMENT_CENTS = 2_000_000_000;
export function parseBaht(value: string): number | null {
  const clean = value.trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= MAX_PAYMENT_CENTS ? cents : null;
}
export function needsServing(order: { servingRequired?: boolean; deliveredAt?: unknown; status: string }) {
  return order.servingRequired === true && !order.deliveredAt && order.status !== "cancelled";
}
