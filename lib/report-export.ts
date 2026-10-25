import type { ReceiptReport } from "@/lib/receipt-report";

export function csvCell(value: string | number): string {
  let text = String(value);
  // Spreadsheet programs must treat menu names as text, even if they start with a formula.
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function reportCsv(data: {
  range: string;
  receipts?: ReceiptReport;
  dailySales: { dateStr: string; day: string; rawAmount: number }[];
  topItems: { name: string; qty: number; revenue: string }[];
}): string {
  const monthly = data.range === "3m";
  const rows: (string | number)[][] = [
    monthly ? ["เดือนที่สั่ง", "ยอดขายตามวันที่สั่ง (รวมที่ยังไม่ชำระ)"] : ["วันที่สั่ง", "วัน", "ยอดขายตามวันที่สั่ง (รวมที่ยังไม่ชำระ)"],
    ...data.dailySales.map(d => monthly ? [d.dateStr, d.rawAmount] : [d.dateStr, d.day, d.rawAmount]),
    [], ["เมนูยอดนิยม", "จำนวนขายได้", "รายได้รวม"],
    ...data.topItems.map(i => [i.name, i.qty, Number(i.revenue.replace(/[฿,]/g, ""))]),
  ];
  if (data.receipts) {
    const amounts = (value: ReceiptReport | ReceiptReport["periods"][number]) =>
      [(value.cashCents / 100).toFixed(2), (value.transferCents / 100).toFixed(2),
        (value.totalCents / 100).toFixed(2), value.paymentCount];
    rows.push([], ["ยอดรับเงินจริงตามวันที่รับเงิน (เวลาไทย)"],
      [monthly ? "เดือนที่รับเงิน" : "วันที่รับเงิน", "เงินสดหลังหักเงินทอน (บาท)", "เงินโอน (บาท)", "รวม (บาท)", "รายการรับเงิน"],
      ...data.receipts.periods.map(period => [period.dateStr, ...amounts(period)]),
      ["รวม", ...amounts(data.receipts)],
      ["อ้างอิงประวัติรับเงินที่บันทึกในระบบ ไม่รวมออเดอร์เก่าที่ไม่มีประวัติรับเงิน"]);
  }
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
