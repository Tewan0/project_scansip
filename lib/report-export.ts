export function csvCell(value: string | number): string {
  let text = String(value);
  // Spreadsheet programs must treat menu names as text, even if they start with a formula.
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function reportCsv(data: {
  range: string;
  dailySales: { dateStr: string; day: string; rawAmount: number }[];
  topItems: { name: string; qty: number; revenue: string }[];
}): string {
  const monthly = data.range === "3m";
  const rows: (string | number)[][] = [
    monthly ? ["เดือน", "ยอดขาย"] : ["วันที่", "วัน", "ยอดขาย"],
    ...data.dailySales.map(d => monthly ? [d.dateStr, d.rawAmount] : [d.dateStr, d.day, d.rawAmount]),
    [], ["เมนูยอดนิยม", "จำนวนขายได้", "รายได้รวม"],
    ...data.topItems.map(i => [i.name, i.qty, Number(i.revenue.replace(/[฿,]/g, ""))]),
  ];
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
