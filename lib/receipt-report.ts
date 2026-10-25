export type ReceiptPeriod = {
  dateStr: string;
  cashCents: number;
  transferCents: number;
  totalCents: number;
  paymentCount: number;
};

export type ReceiptReport = Omit<ReceiptPeriod, "dateStr"> & { periods: ReceiptPeriod[] };

type Payment = { method: "cash" | "transfer"; amountCents: number; createdAt: Date };
type Period = { key: string; dateStr: string };

export function summarizeReceipts(payments: Payment[], periods: Period[], monthly: boolean): ReceiptReport {
  const buckets = new Map(periods.map(period => [period.key, {
    dateStr: period.dateStr, cashCents: 0, transferCents: 0, totalCents: 0, paymentCount: 0,
  }]));
  const totals = { cashCents: 0, transferCents: 0, totalCents: 0, paymentCount: 0 };
  for (const payment of payments) {
    const thaiDate = new Date(payment.createdAt.getTime() + 7 * 60 * 60 * 1000).toISOString();
    const bucket = buckets.get(thaiDate.slice(0, monthly ? 7 : 10));
    if (!bucket) continue;
    // One payment may cover multiple orders. Count the receipt once, using the
    // amount retained by the shop (cash tender minus change), never receivedCents.
    const methodKey = payment.method === "cash" ? "cashCents" : "transferCents";
    bucket[methodKey] += payment.amountCents;
    bucket.totalCents += payment.amountCents;
    bucket.paymentCount++;
    totals[methodKey] += payment.amountCents;
    totals.totalCents += payment.amountCents;
    totals.paymentCount++;
  }
  return { ...totals, periods: Array.from(buckets.values()) };
}
