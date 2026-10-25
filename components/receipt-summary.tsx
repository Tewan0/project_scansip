import { Banknote, CreditCard, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReceiptReport } from "@/lib/receipt-report";

const baht = (cents: number) => (cents / 100).toLocaleString("th-TH", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export function ReceiptSummary({ receipts, monthly }: { receipts: ReceiptReport; monthly: boolean }) {
  const summaries = [
    { label: "รับเงินรวม", amount: receipts.totalCents, Icon: Wallet, detail: `${receipts.paymentCount.toLocaleString("th-TH")} รายการรับเงิน` },
    { label: "เงินสด", amount: receipts.cashCents, Icon: Banknote, detail: "ยอดหลังหักเงินทอน" },
    { label: "เงินโอน", amount: receipts.transferCents, Icon: CreditCard, detail: "ยอดที่พนักงานยืนยันรับเงินแล้ว" },
  ];
  return <section aria-labelledby="receipt-summary-title" className="space-y-3">
    <div>
      <h2 id="receipt-summary-title" className="text-lg font-semibold">ยอดรับเงินจริง</h2>
      <p className="mt-1 text-sm text-muted-foreground">นับตามวันที่บันทึกรับเงินในช่วงที่เลือก · เวลาไทย</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {summaries.map(({ label, amount, Icon, detail }) => <Card key={label} className="gap-3 border-border py-4">
        <CardHeader className="flex flex-row items-start justify-between gap-3 px-4">
          <div className="min-w-0">
            <CardDescription>{label}</CardDescription>
            <CardTitle className="mt-1 break-words text-2xl tabular-nums">฿{baht(amount)}</CardTitle>
          </div>
          <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-4 text-xs text-muted-foreground">{detail}</CardContent>
      </Card>)}
    </div>
    {receipts.paymentCount === 0 ? <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
      ยังไม่มีรายการรับเงินในช่วงเวลานี้
    </p> : <div className="max-h-80 overflow-auto rounded-lg border border-border">
      <Table aria-label="ยอดรับเงินแยกตามวันที่และวิธีชำระ">
        <TableHeader>
          <TableRow>
            <TableHead>{monthly ? "เดือนที่รับเงิน" : "วันที่รับเงิน"}</TableHead>
            <TableHead className="text-right">เงินสด (บาท)</TableHead>
            <TableHead className="text-right">เงินโอน (บาท)</TableHead>
            <TableHead className="text-right">รวม (บาท)</TableHead>
            <TableHead className="text-right">รายการรับเงิน</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.periods.map(period => <TableRow key={period.dateStr}>
            <TableCell className="whitespace-nowrap">{period.dateStr}</TableCell>
            <TableCell className="text-right tabular-nums">{baht(period.cashCents)}</TableCell>
            <TableCell className="text-right tabular-nums">{baht(period.transferCents)}</TableCell>
            <TableCell className="text-right font-medium tabular-nums">{baht(period.totalCents)}</TableCell>
            <TableCell className="text-right tabular-nums">{period.paymentCount}</TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
    </div>}
    <p className="text-xs text-muted-foreground">อ้างอิงประวัติรับเงินที่บันทึกในระบบ ออเดอร์เก่าที่ไม่มีประวัติรับเงินจะไม่รวมในส่วนนี้</p>
  </section>;
}
