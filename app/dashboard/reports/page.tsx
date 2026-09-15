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
    const { dailySales, topItems } = reportData;

    const csvContent =
      "data:text/csv;charset=utf-8," +
      "วันที่,วัน,ยอดขาย\n" +
      dailySales.map((d) => `${d.dateStr},${d.day},${d.amount.replace("฿", "").replace(/,/g, "")}`).join("\n") +
      "\n\nเมนูยอดนิยม,จำนวนขายได้,รายได้รวม\n" +
      topItems.map((i) => `"${i.name}",${i.qty},${i.revenue.replace("฿", "").replace(/,/g, "")}`).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `scansip_sales_report_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const rangeLabels: Record<string, string> = {
    "7d": "7 วันล่าสุด",
    "30d": "30 วันล่าสุด",
    month: "เดือนนี้",
  };

  const dailySales = reportData?.dailySales || [];
  const topItems = reportData?.topItems || [];
  const maxSaleAmount = Math.max(...dailySales.map((d) => d.rawAmount), 100);

  return (
    <div className="p-gutter">
      {/* Controls & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-stack-lg gap-stack-md">
        <div className="flex items-center gap-stack-sm">
          <div className="flex items-center gap-stack-sm bg-surface-card border border-border-subtle rounded-xl p-unit px-stack-sm shadow-xs h-9">
            <Calendar className="w-4 h-4 text-on-surface-variant" />
            <select
              className="bg-transparent border-none text-body-sm font-body-sm text-on-surface focus:ring-0 py-0 pl-1 pr-6 cursor-pointer outline-none"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="7d">7 วันล่าสุด</option>
              <option value="30d">30 วันล่าสุด</option>
              <option value="month">เดือนนี้</option>
            </select>
          </div>

          <button
            onClick={() => fetchReports(dateRange, true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 h-9 text-xs font-medium border border-border-subtle rounded-xl bg-surface hover:bg-surface-container-low transition-colors text-on-surface-variant cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>รีเฟรช</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={isLoading || !reportData}
          className="bg-primary-container text-on-primary hover:bg-primary transition-colors duration-200 rounded-xl px-stack-lg h-9 flex items-center gap-stack-sm font-label-md text-label-md shadow-xs cursor-pointer disabled:opacity-50"
        >
          <FileSpreadsheet className="w-4 h-4" />
          ส่งออกไฟล์ Excel (CSV)
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-on-surface-variant font-body-md">กำลังประมวลผลรายงานจากฐานข้อมูล...</span>
        </div>
      ) : (
        <>
          {/* Top Quick KPI summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter mb-gutter">
            <div className="bg-surface-card rounded-xl border border-border-subtle p-stack-lg shadow-xs flex items-center justify-between">
              <div>
                <span className="text-body-sm text-on-surface-variant font-medium">ยอดขายรวม ({rangeLabels[dateRange]})</span>
                <div className="font-headline-lg text-headline-lg font-bold text-on-background mt-1">
                  ฿{(reportData?.totalRevenue || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary-fixed text-primary-container flex items-center justify-center">
                <Banknote className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-surface-card rounded-xl border border-border-subtle p-stack-lg shadow-xs flex items-center justify-between">
              <div>
                <span className="text-body-sm text-on-surface-variant font-medium">จำนวนออเดอร์ทั้งหมด ({rangeLabels[dateRange]})</span>
                <div className="font-headline-lg text-headline-lg font-bold text-on-background mt-1">
                  {reportData?.totalOrdersCount || 0} ออเดอร์
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-secondary-fixed text-secondary flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            {/* Chart Card */}
            <div className="lg:col-span-8 bg-surface-card rounded-xl border border-border-subtle p-stack-lg shadow-xs">
              <div className="flex justify-between items-center mb-stack-lg">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="font-headline-md text-headline-md font-bold text-primary">
                    ยอดขายรายวัน
                  </h3>
                </div>
                <span className="text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {rangeLabels[dateRange]}
                </span>
              </div>

              {/* Bar Chart Container */}
              <div className="h-64 w-full flex items-end justify-between gap-1 sm:gap-2 px-stack-sm border-b border-border-subtle relative pb-stack-sm ml-6">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-label-md font-label-md text-on-surface-variant pb-stack-sm -ml-8">
                  <span>฿{Math.round(maxSaleAmount).toLocaleString()}</span>
                  <span>฿{Math.round(maxSaleAmount / 2).toLocaleString()}</span>
                  <span>฿0</span>
                </div>

                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-stack-sm">
                  <div className="w-full border-t border-dashed border-border-subtle"></div>
                  <div className="w-full border-t border-dashed border-border-subtle"></div>
                  <div className="w-full"></div>
                </div>

                {/* Bars */}
                <div className="w-full flex justify-between items-end gap-1 sm:gap-2 z-10 h-full pt-4">
                  {dailySales.map((item, idx) => (
                    <div
                      key={idx}
                      className={`group relative flex-1 min-w-[12px] rounded-t-sm transition-all duration-200 cursor-pointer ${
                        item.highlight
                          ? "bg-primary-container shadow-[0_0_8px_rgba(85,55,34,0.3)] hover:brightness-110"
                          : "bg-primary-fixed-dim hover:bg-primary-container"
                      }`}
                      style={{ height: `${Math.max(item.heightPct, 4)}%` }}
                    >
                      <div
                        className={`${
                          item.highlight
                            ? "opacity-100 z-20"
                            : "opacity-0 group-hover:opacity-100 z-10"
                        } absolute -top-9 left-1/2 transform -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-label-md font-label-md px-2 py-1 rounded shadow-md whitespace-nowrap transition-opacity pointer-events-none text-xs`}
                      >
                        {item.dateStr}: {item.amount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* X-axis labels */}
              <div className="flex justify-between mt-stack-sm text-label-md font-label-md text-on-surface-variant px-stack-sm ml-6 overflow-hidden">
                {dailySales.map((item, idx) => (
                  <span
                    key={idx}
                    className={`text-center flex-1 text-xs truncate ${
                      item.highlight ? "text-primary font-bold" : ""
                    }`}
                  >
                    {item.day}
                  </span>
                ))}
              </div>
            </div>

            {/* Top Items Table Card */}
            <div className="lg:col-span-4 bg-surface-card rounded-xl border border-border-subtle p-stack-lg shadow-xs flex flex-col h-full">
              <div className="flex items-center gap-2 mb-stack-lg">
                <Trophy className="w-5 h-5 text-primary" />
                <h3 className="font-headline-md text-headline-md font-bold text-primary">
                  เมนูขายดีสูงสุด
                </h3>
              </div>
              <div className="flex-1 overflow-x-auto max-h-[360px]">
                {topItems.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant text-body-sm">
                    ยังไม่มีรายการขายในช่วงเวลานี้
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="font-label-md text-label-md text-on-surface-variant bg-surface-container-low py-stack-sm px-stack-md border-b border-border-subtle rounded-tl-lg">
                          <span className="flex items-center gap-1.5">
                            <UtensilsCrossed className="w-3.5 h-3.5" />
                            รายการ
                          </span>
                        </th>
                        <th className="font-label-md text-label-md text-on-surface-variant bg-surface-container-low py-stack-sm px-stack-md border-b border-border-subtle text-right">
                          <span className="flex items-center justify-end gap-1.5">
                            <Hash className="w-3.5 h-3.5" />
                            จำนวน
                          </span>
                        </th>
                        <th className="font-label-md text-label-md text-on-surface-variant bg-surface-container-low py-stack-sm px-stack-md border-b border-border-subtle text-right rounded-tr-lg">
                          <span className="flex items-center justify-end gap-1.5">
                            <Banknote className="w-3.5 h-3.5" />
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
                          <td className="py-stack-sm px-stack-md font-body-md text-body-md text-on-surface">
                            {item.name}
                          </td>
                          <td className="py-stack-sm px-stack-md font-body-md text-body-md text-on-surface-variant text-right">
                            {item.qty}
                          </td>
                          <td className="py-stack-sm px-stack-md font-body-md text-body-md text-on-surface text-right font-semibold">
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
