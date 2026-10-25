"use client";

import { RefreshStatus } from "@/components/refresh-status";
import { useState, useEffect, useRef, useCallback } from "react";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ReceiptSummary } from "@/components/receipt-summary";
import type { ReceiptReport } from "@/lib/receipt-report";
import { reportCsv } from "@/lib/report-export";
import { Skeleton } from "@/components/ui/skeleton";

// Lucide Icons
import {
  Calendar,
  FileSpreadsheet,
  BarChart3,
  CalendarDays,
  Trophy,
  Banknote,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

interface DailySale {
  day: string;
  dateStr: string;
  amount: string;
  rawAmount: number;
  heightPct: number;
  highlight: boolean;
}

interface TopItem {
  name: string;
  qty: number;
  revenue: string;
}

interface ReportData {
  receipts: ReceiptReport;
  range: string;
  totalRevenue: number;
  totalOrdersCount: number;
  dailySales: DailySale[];
  topItems: TopItem[];
}

export default function SalesReportsPage() {
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState("7d");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const fetchReports = useCallback(async (rangeKey: string) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const res = await fetch(`/api/reports?range=${rangeKey}`, { signal: controller.signal, cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error("โหลดรายงานไม่สำเร็จ กรุณาลองอีกครั้ง");
      if (!controller.signal.aborted) { setUpdatedAt(Date.now()); setReportData(json.data); }
    } catch {
      if (!controller.signal.aborted) setError("โหลดรายงานไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void fetchReports(dateRange), 0);
    return () => { clearTimeout(initial); activeRequest.current?.abort(); };
  }, [dateRange, fetchReports]);

  const changeRange = (rangeKey: string) => {
    if (rangeKey === dateRange) return;
    activeRequest.current?.abort();
    setError(null);
    setIsLoading(true);
    setIsRefreshing(false);
    setDateRange(rangeKey);
  };

  const refreshReports = () => {
    setError(null);
    setIsRefreshing(true);
    return fetchReports(dateRange);
  };

  const handleExport = () => {
    if (!reportData || reportData.range !== dateRange || error) return;
    const url = URL.createObjectURL(new Blob([reportCsv(reportData)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `scansip_sales_report_${reportData.range}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const [now] = useState(() => new Date(Date.now() + 7 * 60 * 60 * 1000));
  const prev1 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prev2 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const prev3 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));

  const thaiMonths = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];

  const rangeLabels: Record<string, string> = {
    "7d": "7 วันล่าสุด",
    month: "เดือนนี้",
    "month-1": `เดือนที่แล้ว (${thaiMonths[prev1.getUTCMonth()]})`,
    "month-2": `2 เดือนที่แล้ว (${thaiMonths[prev2.getUTCMonth()]})`,
    "month-3": `3 เดือนที่แล้ว (${thaiMonths[prev3.getUTCMonth()]})`,
    "3m": "3 เดือนล่าสุด",
  };

  const dailySales = reportData?.dailySales || [];
  const topItems = reportData?.topItems || [];
  const maxSaleAmount = Math.max(...dailySales.map((d) => d.rawAmount), 100);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div>
        <h1 className="text-2xl font-bold">รายงานยอดขายและรับเงิน</h1>
        <p className="mt-1 text-sm text-muted-foreground">แยกยอดขายตามวันที่สั่ง และยอดรับเงินจริงตามวันที่ชำระ · เวลาไทย</p>
      </div>
      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 min-h-9 shadow-2xs focus-within:ring-2 focus-within:ring-ring">
            <Calendar className="size-4 text-muted-foreground shrink-0" />
            <select
              className="bg-card border-none text-xs text-card-foreground cursor-pointer outline-none w-full min-h-9"
              aria-label="ช่วงเวลาของรายงาน"
              value={dateRange}
              onChange={(e) => changeRange(e.target.value)}
            >
              <option value="7d">7 วันล่าสุด</option>
              <option value="month">เดือนนี้</option>
              <option value="month-1">เดือนที่แล้ว ({thaiMonths[prev1.getUTCMonth()]})</option>
              <option value="month-2">2 เดือนที่แล้ว ({thaiMonths[prev2.getUTCMonth()]})</option>
              <option value="month-3">3 เดือนที่แล้ว ({thaiMonths[prev3.getUTCMonth()]})</option>
              <option value="3m">3 เดือนล่าสุด</option>
            </select>
          </div>

          <Button
            type="button"
            onClick={() => refreshReports()}
            disabled={isRefreshing || isLoading}
            variant="outline"
            size="sm"
            className="h-9 text-xs"
          >
            <RefreshCw className={isRefreshing ? "animate-spin" : ""} data-icon="inline-start" />
            <span>รีเฟรช</span>
          </Button>
        </div>

        <Button
          type="button"
          onClick={handleExport}
          disabled={isLoading || isRefreshing || !!error || !reportData || reportData.range !== dateRange}
          size="sm"
          className="h-9 text-xs"
        >
          <FileSpreadsheet data-icon="inline-start" />
          <span>ส่งออก CSV (เปิดใน Excel ได้)</span>
        </Button>
      </div>

    <RefreshStatus updatedAt={updatedAt} failed={Boolean(error)} />
      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
      {isLoading ? (
        <div role="status" className="space-y-6">
        <span className="sr-only">กำลังโหลดรายงานยอดขายและรับเงิน</span>
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map(item => <Card key={item} className="h-28 justify-between p-4">
              <Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-36" />
            </Card>)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-5 h-28 justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-44" />
            </Card>
            <Card className="p-5 h-28 justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-44" />
            </Card>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <Card className="xl:col-span-8 p-5 h-80 justify-between">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-56 w-full rounded-lg" />
            </Card>
            <Card className="xl:col-span-4 p-5 h-80 justify-between">
              <Skeleton className="h-5 w-36" />
              <div className="space-y-2 mt-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </Card>
          </div>
        </div>
      ) : reportData?.range === dateRange ? (
        <>
          {reportData.receipts && <ReceiptSummary receipts={reportData.receipts} monthly={dateRange === "3m"} />}
          <div>
            <h2 className="text-lg font-semibold">ยอดขายตามวันที่สั่ง</h2>
            <p className="mt-1 text-sm text-muted-foreground">รวมออเดอร์ที่ยังไม่ชำระเงิน ไม่นับออเดอร์ที่ยกเลิก</p>
          </div>
          {/* Top Quick KPI summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardHeader className="p-5 flex flex-wrap flex-row items-center justify-between gap-3 pb-2">
                <div>
                  <CardDescription className="text-xs uppercase font-semibold tracking-wider">
                    ยอดขายรวม · {rangeLabels[dateRange]}
                  </CardDescription>
                  <CardTitle className="text-3xl font-extrabold tracking-tight mt-1 text-foreground">
                    ฿{(reportData?.totalRevenue || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </CardTitle>
                </div>
                <div className="size-10 rounded-lg bg-muted border border-border flex items-center justify-center text-foreground">
                  <Banknote className="size-5" />
                </div>
              </CardHeader>
            </Card>

            <Card className="border-border">
              <CardHeader className="p-5 flex flex-wrap flex-row items-center justify-between gap-3 pb-2">
                <div>
                  <CardDescription className="text-xs uppercase font-semibold tracking-wider">
                    จำนวนออเดอร์ทั้งหมด · {rangeLabels[dateRange]}
                  </CardDescription>
                  <CardTitle className="text-3xl font-extrabold tracking-tight mt-1 text-foreground">
                    {reportData?.totalOrdersCount || 0} ออเดอร์
                  </CardTitle>
                </div>
                <div className="size-10 rounded-lg bg-muted border border-border flex items-center justify-center text-foreground">
                  <TrendingUp className="size-5" />
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* Main Reports Bento Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Sales Bar Chart Card */}
            <Card className="xl:col-span-8 border-border flex flex-col">
              <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3 pb-3 border-b border-border bg-card">
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-foreground" />
                  <CardTitle className="text-base font-bold">
                    {dateRange === "3m" ? "ยอดขายรายเดือน" : "ยอดขายรายวัน"}
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-xs gap-1.5">
                  <CalendarDays className="size-3" />
                  <span>{rangeLabels[dateRange]}</span>
                </Badge>
              </CardHeader>

              <CardContent className="pt-2">
                <p className="mb-3 text-xs text-muted-foreground">หน่วย: บาท · เลื่อนแนวนอนเพื่อดูครบทุกวัน</p>
                <div className="flex min-w-0 gap-2">
                  <div aria-hidden="true" className="flex h-[200px] w-20 shrink-0 flex-col justify-between text-right text-xs tabular-nums text-muted-foreground">
                    <span>{maxSaleAmount.toLocaleString("th-TH")}</span>
                    <span>{(maxSaleAmount / 2).toLocaleString("th-TH")}</span>
                    <span>0</span>
                  </div>
                  <div className="min-w-0 flex-1 overflow-x-auto pb-2" tabIndex={0} role="region" aria-label="กราฟยอดขาย เลื่อนเพื่อดูแต่ละวัน">
                    <div className="relative" style={{ minWidth: dailySales.length * (dateRange === "3m" ? 100 : 44) }}>
                      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 flex h-[200px] flex-col justify-between">
                        {[0, 1, 2].map(line => <div key={line} className="border-t border-dashed border-border" />)}
                      </div>
                      <div className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(dailySales.length, 1)}, minmax(0, 1fr))` }}>
                        {dailySales.map(item => (
                          <div key={item.dateStr} className="min-w-0 text-center">
                            <div className="group relative flex h-[200px] items-end justify-center focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} aria-label={`${item.dateStr}: ${item.amount}`} title={`${item.dateStr}: ${item.amount}`}>
                              <div className={`w-full max-w-12 rounded-t-sm ${item.highlight ? "bg-primary" : "bg-primary/50"}`} style={{ height: `${item.rawAmount / maxSaleAmount * 200}px` }} />
                              <span className="pointer-events-none absolute inset-x-0 top-1 rounded bg-foreground px-0.5 py-1 text-[10px] text-background opacity-0 group-hover:opacity-100 group-focus:opacity-100">{item.amount}</span>
                            </div>
                            <div className="mt-2 text-[11px] text-muted-foreground">{item.day}</div>
                            {dateRange === "7d" && <div className="text-[10px] text-muted-foreground">{item.dateStr.slice(8)}/{item.dateStr.slice(5, 7)}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {dailySales.every(item => item.rawAmount === 0) && <p className="mt-3 text-center text-sm text-muted-foreground">ยังไม่มียอดขายในช่วงเวลานี้</p>}
              </CardContent>
            </Card>

            {/* Top Items Table Card */}
            <Card className="xl:col-span-4 border-border flex flex-col overflow-hidden">
              <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3 pb-3 border-b border-border bg-card">
                <div className="flex items-center gap-2">
                  <Trophy className="size-4 text-foreground" />
                  <CardTitle className="text-base font-bold">เมนูขายดีสูงสุด</CardTitle>
                </div>
                <Badge variant="outline" className="text-[11px]">
                  {topItems.length} อันดับแรก
                </Badge>
              </CardHeader>

              <CardContent className="p-0 flex-1 overflow-x-auto max-h-[340px]">
                {topItems.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-xs">
                    ยังไม่มีข้อมูลการขายในช่วงเวลานี้
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs">รายการ</TableHead>
                        <TableHead className="text-right text-xs">จำนวน</TableHead>
                        <TableHead className="text-right text-xs">ยอดขาย</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topItems.map((item) => (
                        <TableRow key={item.name} className="hover:bg-muted/30">
                          <TableCell className="font-semibold text-xs text-foreground whitespace-normal break-words max-w-[180px]">
                            {item.name}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {item.qty}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-foreground">
                            {item.revenue}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
