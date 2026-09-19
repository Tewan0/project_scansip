"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  FileSpreadsheet,
  BarChart3,
  CalendarDays,
  Trophy,
  UtensilsCrossed,
  Hash,
  Banknote,
  Loader2,
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
    <div className="p-4 sm:p-gutter max-w-full overflow-x-hidden">
      {/* Controls & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-stack-lg gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:flex-initial flex items-center gap-2 bg-surface-card border border-border-subtle rounded-xl px-3 py-1.5 shadow-xs h-9 min-w-0">
            <Calendar className="w-4 h-4 text-on-surface-variant shrink-0" />
            <select
              className="bg-transparent border-none text-body-sm font-body-sm text-on-surface focus:ring-0 py-0 pl-1 pr-4 cursor-pointer outline-none w-full truncate"
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

          <button
            type="button"
            onClick={() => fetchReports(dateRange, true)}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-1.5 px-3 h-9 text-xs font-medium border border-border-subtle rounded-xl bg-surface hover:bg-surface-container-low transition-colors text-on-surface-variant cursor-pointer shadow-xs shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>รีเฟรช</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={isLoading || !reportData}
          className="bg-primary-container text-on-primary hover:bg-primary transition-colors duration-200 rounded-xl px-4 h-9 flex items-center justify-center gap-2 font-label-md text-label-md shadow-xs cursor-pointer disabled:opacity-50 w-full sm:w-auto shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span>ส่งออกไฟล์ Excel (CSV)</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-on-surface-variant font-body-md text-center">กำลังประมวลผลรายงานจากฐานข้อมูล...</span>
        </div>
      ) : (
        <>
          {/* Top Quick KPI summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-gutter mb-gutter">
            <div className="bg-surface-card rounded-xl border border-border-subtle p-4 sm:p-stack-lg shadow-xs flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-body-sm text-on-surface-variant font-medium block truncate">ยอดขายรวม · {rangeLabels[dateRange]}</span>
                <div className="font-headline-lg text-headline-lg font-bold text-on-background mt-1 truncate">
                  ฿{(reportData?.totalRevenue || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary-fixed text-primary-container flex items-center justify-center shrink-0">
                <Banknote className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-surface-card rounded-xl border border-border-subtle p-4 sm:p-stack-lg shadow-xs flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-body-sm text-on-surface-variant font-medium block truncate">จำนวนออเดอร์ทั้งหมด · {rangeLabels[dateRange]}</span>
                <div className="font-headline-lg text-headline-lg font-bold text-on-background mt-1 truncate">
                  {reportData?.totalOrdersCount || 0} ออเดอร์
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-secondary-fixed text-secondary flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter">
            {/* Chart Card */}
            <div className="xl:col-span-8 bg-surface-card rounded-xl border border-border-subtle p-4 sm:p-stack-lg shadow-xs overflow-hidden flex flex-col">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-stack-lg">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary shrink-0" />
                  <h3 className="font-headline-md text-headline-md font-bold text-primary truncate">
                    {dateRange === "3m" ? "ยอดขายรายเดือน" : "ยอดขายรายวัน"}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {dailySales.length > 10 && (
                    <span className="text-[11px] text-on-surface-variant/80 bg-surface-container-low px-2 py-0.5 rounded xl:hidden">
                      เลื่อนแนวนอน ↔
                    </span>
                  )}
                  <span className="text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded flex items-center gap-1.5 shrink-0">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {rangeLabels[dateRange]}
                  </span>
                </div>
              </div>

              {/* Main Chart Structure with Fixed Y-axis and Scrollable Bars */}
              <div className="flex w-full overflow-hidden">
                {/* Fixed Y-axis labels on the left */}
                <div className="w-12 sm:w-14 shrink-0 flex flex-col justify-between text-right pr-2 text-label-md font-label-md text-on-surface-variant pb-7 text-[11px] sm:text-xs border-r border-border-subtle/50 select-none">
                  <span>฿{Math.round(maxSaleAmount).toLocaleString()}</span>
                  <span>฿{Math.round(maxSaleAmount / 2).toLocaleString()}</span>
                  <span>฿0</span>
                </div>

                {/* Scrollable Bar + X-axis area */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin pl-2">
                  <div className={`h-64 flex flex-col justify-between ${dailySales.length > 10 ? "min-w-[650px] xl:min-w-0" : "w-full"}`}>
                    {/* Bars Container with Grid lines */}
                    <div className="relative flex-1 flex items-end border-b border-border-subtle pb-1 pt-8">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-1 pt-8">
                        <div className="w-full border-t border-dashed border-border-subtle/60"></div>
                        <div className="w-full border-t border-dashed border-border-subtle/60"></div>
                        <div className="w-full"></div>
                      </div>

                      {/* Bars */}
                      <div className="w-full flex justify-between items-end gap-1 sm:gap-2 z-10 h-full">
                        {dailySales.map((item, idx) => (
                          <div
                            key={idx}
                            className={`group relative flex-1 ${
                              dailySales.length <= 3
                                ? "max-w-[80px]"
                                : dailySales.length <= 7
                                ? "max-w-[48px]"
                                : "min-w-[10px]"
                            } rounded-t-sm transition-all duration-200 cursor-pointer ${
                              item.highlight
                                ? "bg-primary-container shadow-[0_0_8px_rgba(85,55,34,0.3)] hover:brightness-110"
                                : "bg-primary-fixed-dim hover:bg-primary-container"
                            }`}
                            style={{ height: `${Math.max(item.heightPct, 4)}%` }}
                          >
                            {/* Tooltip */}
                            <div
                              className={`${
                                item.highlight
                                  ? "opacity-100 z-30"
                                  : "opacity-0 group-hover:opacity-100 z-20"
                              } absolute -top-8 left-1/2 transform -translate-x-1/2 bg-inverse-surface text-inverse-on-surface font-label-md px-2 py-0.5 rounded shadow-md whitespace-nowrap transition-opacity pointer-events-none text-[10px] sm:text-xs`}
                            >
                              {item.dateStr}: {item.amount}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* X-axis labels aligned exactly below the bars */}
                    <div className="w-full flex justify-between pt-1.5 text-on-surface-variant select-none">
                      {dailySales.map((item, idx) => (
                        <div
                          key={idx}
                          className={`flex-1 text-center truncate ${
                            dailySales.length <= 3
                              ? "max-w-[80px]"
                              : dailySales.length <= 7
                              ? "max-w-[48px]"
                              : "min-w-[10px]"
                          }`}
                        >
                          <span
                            className={`text-[10px] sm:text-xs block truncate ${
                              item.highlight ? "text-primary font-bold" : ""
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
            </div>

            {/* Top Items Table Card */}
            <div className="xl:col-span-4 bg-surface-card rounded-xl border border-border-subtle p-4 sm:p-stack-lg shadow-xs flex flex-col h-full overflow-hidden">
              <div className="flex items-center gap-2 mb-stack-lg">
                <Trophy className="w-5 h-5 text-primary shrink-0" />
                <h3 className="font-headline-md text-headline-md font-bold text-primary truncate">
                  เมนูขายดีสูงสุด
                </h3>
              </div>
              <div className="flex-1 overflow-x-auto max-h-[360px] scrollbar-thin">
                {topItems.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant text-body-sm">
                    ยังไม่มีรายการขายในช่วงเวลานี้
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[260px]">
                    <thead>
                      <tr>
                        <th className="font-label-md text-label-md text-on-surface-variant bg-surface-container-low py-stack-sm px-2.5 sm:px-stack-md border-b border-border-subtle rounded-tl-lg">
                          <span className="flex items-center gap-1.5">
                            <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" />
                            รายการ
                          </span>
                        </th>
                        <th className="font-label-md text-label-md text-on-surface-variant bg-surface-container-low py-stack-sm px-2.5 sm:px-stack-md border-b border-border-subtle text-right">
                          <span className="flex items-center justify-end gap-1.5">
                            <Hash className="w-3.5 h-3.5 shrink-0" />
                            จำนวน
                          </span>
                        </th>
                        <th className="font-label-md text-label-md text-on-surface-variant bg-surface-container-low py-stack-sm px-2.5 sm:px-stack-md border-b border-border-subtle text-right rounded-tr-lg">
                          <span className="flex items-center justify-end gap-1.5">
                            <Banknote className="w-3.5 h-3.5 shrink-0" />
                            ยอดขาย
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {topItems.map((item) => (
                        <tr
                          key={item.name}
                          className="hover:bg-surface-bright transition-colors border-b border-border-subtle last:border-0 h-12"
                        >
                          <td className="py-stack-sm px-2.5 sm:px-stack-md font-body-md text-body-md text-on-surface truncate max-w-[120px] sm:max-w-[160px]">
                            {item.name}
                          </td>
                          <td className="py-stack-sm px-2.5 sm:px-stack-md font-body-md text-body-md text-on-surface-variant text-right whitespace-nowrap">
                            {item.qty}
                          </td>
                          <td className="py-stack-sm px-2.5 sm:px-stack-md font-body-md text-body-md text-on-surface text-right font-semibold whitespace-nowrap">
                            {item.revenue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
