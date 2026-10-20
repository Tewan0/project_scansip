"use client";

import { useState, useEffect } from "react";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

// Lucide Icons
import {
  Calendar,
  FileSpreadsheet,
  BarChart3,
  CalendarDays,
  Trophy,
  UtensilsCrossed,
  Hash,
  Banknote,
  RefreshCw,
  TrendingUp,
  Download,
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
  range: string;
  totalRevenue: number;
  totalOrdersCount: number;
  dailySales: DailySale[];
  topItems: TopItem[];
}

export default function SalesReportsPage() {
  const [dateRange, setDateRange] = useState("7d");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchReports = async (rangeKey = dateRange, isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      else setIsLoading(true);
      const res = await fetch(`/api/reports?range=${rangeKey}`);
      const json = await res.json();
      if (json.success) {
        setReportData(json.data);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports(dateRange);
  }, [dateRange]);

  const handleExport = () => {
    if (!reportData) return;
    const isMonthlyView = dateRange === "3m";
    const csvContent =
      "data:text/csv;charset=utf-8," +
      (isMonthlyView ? "เดือน,ยอดขาย\n" : "วันที่,วัน,ยอดขาย\n") +
      dailySales
        .map((d) =>
          isMonthlyView
            ? `${d.dateStr},${d.amount.replace("฿", "").replace(/,/g, "")}`
            : `${d.dateStr},${d.day},${d.amount.replace("฿", "").replace(/,/g, "")}`
        )
        .join("\n") +
      "\n\nเมนูยอดนิยม,จำนวนขายได้,รายได้รวม\n" +
      topItems
        .map(
          (i) =>
            `"${i.name}",${i.qty},${i.revenue.replace("฿", "").replace(/,/g, "")}`
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `scansip_sales_report_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const now = new Date();
  const prev1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prev2 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const prev3 = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const thaiMonths = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];

  const rangeLabels: Record<string, string> = {
    "7d": "7 วันล่าสุด",
    month: "เดือนนี้",
    "month-1": `เดือนที่แล้ว (${thaiMonths[prev1.getMonth()]})`,
    "month-2": `2 เดือนที่แล้ว (${thaiMonths[prev2.getMonth()]})`,
    "month-3": `3 เดือนที่แล้ว (${thaiMonths[prev3.getMonth()]})`,
    "3m": "3 เดือนล่าสุด",
  };

  const dailySales = reportData?.dailySales || [];
  const topItems = reportData?.topItems || [];
  const maxSaleAmount = Math.max(...dailySales.map((d) => d.rawAmount), 100);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 min-h-9 shadow-2xs">
            <Calendar className="size-4 text-muted-foreground shrink-0" />
            <select
              className="bg-transparent border-none text-xs text-foreground cursor-pointer outline-none w-full"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="7d">7 วันล่าสุด</option>
              <option value="month">เดือนนี้</option>
              <option value="month-1">เดือนที่แล้ว ({thaiMonths[prev1.getMonth()]})</option>
              <option value="month-2">2 เดือนที่แล้ว ({thaiMonths[prev2.getMonth()]})</option>
              <option value="month-3">3 เดือนที่แล้ว ({thaiMonths[prev3.getMonth()]})</option>
              <option value="3m">3 เดือนล่าสุด</option>
            </select>
          </div>

          <Button
            type="button"
            onClick={() => fetchReports(dateRange, true)}
            disabled={isRefreshing}
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
          disabled={isLoading || !reportData}
          size="sm"
          className="h-9 text-xs"
        >
          <FileSpreadsheet data-icon="inline-start" />
          <span>ส่งออกไฟล์ Excel (CSV)</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-6">
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
      ) : (
        <>
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
            <Card className="xl:col-span-8 border-border flex flex-col justify-between">
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

              <CardContent className="pt-6">
                {/* Chart Structure with Fixed Y-axis and Scrollable Bars */}
                <div className="flex w-full overflow-hidden">
                  {/* Fixed Y-axis labels */}
                  <div className="w-14 shrink-0 flex flex-col justify-between text-right pr-2 text-muted-foreground pb-7 text-xs border-r border-border select-none">
                    <span>฿{Math.round(maxSaleAmount).toLocaleString()}</span>
                    <span>฿{Math.round(maxSaleAmount / 2).toLocaleString()}</span>
                    <span>฿0</span>
                  </div>

                  {/* Scrollable Bar + X-axis area */}
                  <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden pl-3">
                    <div className={`h-60 flex flex-col justify-between ${dailySales.length > 10 ? "min-w-[650px] xl:min-w-0" : "w-full"}`}>
                      {/* Bars Container */}
                      <div className="relative flex-1 flex items-end border-b border-border pb-1 pt-6">
                        {/* Horizontal dashed grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-1 pt-6">
                          <div className="w-full border-t border-dashed border-border/80"></div>
                          <div className="w-full border-t border-dashed border-border/80"></div>
                          <div className="w-full"></div>
                        </div>

                        {/* Bars */}
                        <div className="w-full flex justify-between items-end gap-1.5 z-10 h-full">
                          {dailySales.map((item, idx) => (
                            <div
                              key={idx}
                              className={`group relative flex-1 ${
                                dailySales.length <= 3
                                  ? "max-w-[70px]"
                                  : dailySales.length <= 7
                                  ? "max-w-[42px]"
                                  : "min-w-[8px]"
                              } rounded-t-sm transition-all duration-200 cursor-pointer ${
                                item.highlight
                                  ? "bg-primary hover:bg-primary/90"
                                  : "bg-muted-foreground/30 hover:bg-primary"
                              }`}
                              style={{ height: `${Math.max(item.heightPct, 4)}%` }}
                            >
                              {/* Hover Tooltip */}
                              <div
                                className={`${
                                  item.highlight
                                    ? "opacity-100 z-30"
                                    : "opacity-0 group-hover:opacity-100 z-20"
                                } absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-semibold px-2 py-0.5 rounded shadow whitespace-nowrap transition-opacity pointer-events-none`}
                              >
                                {item.dateStr}: {item.amount}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* X-axis labels */}
                      <div className="w-full flex justify-between pt-2 text-muted-foreground select-none">
                        {dailySales.map((item, idx) => (
                          <div
                            key={idx}
                            className={`flex-1 text-center truncate ${
                              dailySales.length <= 3
                                ? "max-w-[70px]"
                                : dailySales.length <= 7
                                ? "max-w-[42px]"
                                : "min-w-[8px]"
                            }`}
                          >
                            <span
                              className={`text-[11px] block truncate ${
                                item.highlight ? "text-foreground font-bold" : ""
                              }`}
                              title={item.dateStr}
                            >
                              {item.day}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Items Table Card */}
            <Card className="xl:col-span-4 border-border flex flex-col justify-between overflow-hidden">
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
                          <TableCell className="font-semibold text-xs text-foreground truncate max-w-[140px]">
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
      )}
    </div>
  );
}
