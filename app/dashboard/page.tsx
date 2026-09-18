"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  TrendingUp,
  Receipt,
  CheckCircle2,
  Coffee,
  Flame,
  LineChart,
  ArrowRight,
  BarChart3,
  Tag,
  Info,
  Clock,
  Hourglass,
  CheckCheck,
  Eye,
  Loader2,
  RefreshCw,
  Armchair,
} from "lucide-react";

interface RecentOrder {
  id: string;
  tableNumber: number | null;
  time: string;
  total: string;
  status: string;
  statusKey: string;
  statusClass: string;
  createdAt: string;
}

interface ChartItem {
  dateStr: string;
  dayLabel: string;
  sales: number;
}

interface DashboardStats {
  todaySales: number;
  yesterdaySales: number;
  growthPercent: number;
  totalOrdersCount: number;
  todayOrdersCount: number;
  completedOrdersCount: number;
  topMenu: {
    name: string;
    count: number;
  };
  chartData: ChartItem[];
  recentOrders: RecentOrder[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      const res = await fetch("/api/dashboard/stats");
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh stats automatically every 15 seconds
    const timer = setInterval(() => fetchStats(), 15000);
    return () => clearInterval(timer);
  }, []);

  // Compute SVG chart coordinates based on chartData
  const chartPoints = stats?.chartData || [];
  const maxSales = Math.max(...chartPoints.map((c) => c.sales), 100);
  const chartHeight = 240;
  const chartWidth = 800;

  // Generate smooth SVG polyline / curve points
  const points = chartPoints.map((pt, idx) => {
    const x = (idx / Math.max(chartPoints.length - 1, 1)) * (chartWidth - 40) + 20;
    // inverted Y (0 is top, height is bottom)
    const y = chartHeight - (pt.sales / (maxSales * 1.25 || 1)) * (chartHeight - 60) - 30;
    return { x, y, sales: pt.sales, label: pt.dayLabel };
  });

  const pathD = points.length > 0
    ? points.reduce((acc, pt, i) => {
        if (i === 0) return `M ${pt.x} ${pt.y}`;
        const prev = points[i - 1];
        const cp1x = prev.x + (pt.x - prev.x) / 2;
        const cp1y = prev.y;
        const cp2x = prev.x + (pt.x - prev.x) / 2;
        const cp2y = pt.y;
        return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pt.x} ${pt.y}`;
      }, "")
    : "";

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`
    : "";

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-on-surface-variant font-body-md">กำลังโหลดข้อมูลแดชบอร์ด...</span>
      </div>
    );
  }

  const todaySalesDisplay = `฿${(stats?.todaySales || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <div className="p-gutter lg:p-margin-page">
      <div className="max-w-7xl mx-auto space-y-gutter">
        {/* Header with Quick Refresh */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-background">
              ภาพรวมร้านค้า
            </h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              ข้อมูลสถิติและสถานะคำสั่งซื้อแบบเรียลไทม์
            </p>
          </div>
          <button
            onClick={() => fetchStats(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border-subtle rounded-lg bg-surface hover:bg-surface-container-low transition-colors text-on-surface-variant cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>อัปเดตข้อมูล</span>
          </button>
        </div>

        {/* Summary Cards Bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {/* Sales Card */}
          <div className="bg-surface-card border border-border-subtle rounded-xl p-stack-lg flex flex-col gap-stack-sm hover:shadow-xs transition-shadow">
            <div className="flex justify-between items-start">
              <span className="font-label-md text-label-md text-on-surface-variant">
                ยอดขายวันนี้
              </span>
              <div className="w-8 h-8 rounded bg-primary-fixed text-primary-container flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <div className="font-headline-xl text-headline-xl text-on-background mt-2">
              {todaySalesDisplay}
            </div>
            <div className="flex items-center gap-unit text-status-success font-label-md text-label-md mt-4">
              <TrendingUp className="w-4 h-4" />
              <span>
                {stats?.growthPercent !== undefined && stats.growthPercent > 0 ? `+${stats.growthPercent}%` : `${stats?.growthPercent || 0}%`}
              </span>
              <span className="text-on-surface-variant font-body-sm text-body-sm ml-1 font-normal">
                เทียบกับเมื่อวาน
              </span>
            </div>
          </div>

          {/* Orders Card */}
          <div className="bg-surface-card border border-border-subtle rounded-xl p-stack-lg flex flex-col gap-stack-sm hover:shadow-xs transition-shadow">
            <div className="flex justify-between items-start">
              <span className="font-label-md text-label-md text-on-surface-variant">
                จำนวนออเดอร์วันนี้
              </span>
              <div className="w-8 h-8 rounded bg-secondary-fixed text-secondary flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="font-headline-xl text-headline-xl text-on-background mt-2">
              {stats?.todayOrdersCount ?? 0}
            </div>
            <div className="flex items-center gap-unit text-on-surface-variant font-label-md text-label-md mt-4">
              <CheckCircle2 className="w-4 h-4 text-status-success" />
              <span>เสร็จสิ้น {stats?.completedOrdersCount ?? 0} ออเดอร์</span>
            </div>
          </div>

          {/* Best Item Card */}
          <div className="bg-surface-card border border-border-subtle rounded-xl p-stack-lg flex flex-col gap-stack-sm hover:shadow-xs transition-shadow">
            <div className="flex justify-between items-start">
              <span className="font-label-md text-label-md text-on-surface-variant">
                เมนูขายดีประจำวัน
              </span>
              <div className="w-8 h-8 rounded bg-surface-container-high text-on-surface flex items-center justify-center">
                <Coffee className="w-4 h-4" />
              </div>
            </div>
            <div className="font-headline-md text-headline-md text-on-background mt-2 leading-tight line-clamp-1" title={stats?.topMenu.name}>
              {stats?.topMenu.name || "ยังไม่มีข้อมูล"}
            </div>
            <div className="flex items-center gap-unit text-on-surface-variant font-label-md text-label-md mt-auto pt-4">
              <Flame className="w-4 h-4 text-status-warning" />
              <span className="text-status-warning font-semibold">
                {stats?.topMenu.count ?? 0} รายการ
              </span>
            </div>
          </div>
        </div>

        {/* Main Data Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          {/* Chart Area */}
          <div className="lg:col-span-2 bg-surface-card border border-border-subtle rounded-xl p-stack-lg flex flex-col">
            <div className="flex justify-between items-center mb-stack-lg">
              <div className="flex items-center gap-2">
                <LineChart className="w-5 h-5 text-primary" />
                <h2 className="font-headline-md text-headline-md text-on-background font-bold">
                  ยอดขาย (7 วันล่าสุด)
                </h2>
              </div>
              <Link
                href="/dashboard/reports"
                className="font-label-md text-label-md px-3 py-1.5 border border-border-subtle rounded hover:bg-surface-container-low transition-colors text-on-surface-variant flex items-center gap-1 cursor-pointer"
              >
                <BarChart3 className="w-4 h-4" />
                <span>รายงานยอดขาย</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="relative w-full h-[280px] mt-auto">
              {/* Dynamic Line Chart */}
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                {/* Grid Lines */}
                <path d={`M0 40 L${chartWidth} 40`} fill="none" stroke="#E9ECEF" strokeDasharray="4 4" strokeWidth="1" />
                <path d={`M0 100 L${chartWidth} 100`} fill="none" stroke="#E9ECEF" strokeDasharray="4 4" strokeWidth="1" />
                <path d={`M0 160 L${chartWidth} 160`} fill="none" stroke="#E9ECEF" strokeDasharray="4 4" strokeWidth="1" />
                <path d={`M0 220 L${chartWidth} 220`} fill="none" stroke="#E9ECEF" strokeDasharray="4 4" strokeWidth="1" />

                {/* Gradient Fill */}
                {areaD && (
                  <path d={areaD} fill="url(#chartGradient)" opacity="0.15" />
                )}

                {/* Data Line */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#79573f"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3.5"
                  />
                )}

                {/* Data Points */}
                {points.map((pt, i) => (
                  <g key={i}>
                    <circle cx={pt.x} cy={pt.y} fill="#FFFFFF" r="5" stroke="#79573f" strokeWidth="2.5" />
                  </g>
                ))}

                <defs>
                  <linearGradient id="chartGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#79573f" stopOpacity="1" />
                    <stop offset="100%" stopColor="#79573f" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>

              {/* X-Axis Labels */}
              <div className="absolute bottom-[-24px] left-0 w-full flex justify-between font-label-md text-label-md text-on-surface-variant px-3">
                {points.map((pt, i) => (
                  <span key={i} className="text-center w-12">
                    {pt.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="bg-surface-card border border-border-subtle rounded-xl flex flex-col overflow-hidden shadow-xs">
            <div className="p-stack-lg border-b border-border-subtle flex justify-between items-center bg-surface-bright">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                <h2 className="font-headline-md text-headline-md text-on-background font-bold">
                  ออเดอร์ล่าสุด
                </h2>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[380px]">
              {(!stats?.recentOrders || stats.recentOrders.length === 0) ? (
                <div className="flex flex-col items-center justify-center p-8 text-on-surface-variant text-center gap-2">
                  <Receipt className="w-8 h-8 opacity-40" />
                  <p className="font-body-md text-sm">ยังไม่มีคำสั่งซื้อเข้ามา</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface sticky top-0 z-10">
                    <tr>
                      <th className="font-label-md text-label-md text-on-surface-variant py-stack-sm px-stack-lg border-b border-border-subtle font-normal">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" />
                          ออเดอร์
                        </span>
                      </th>
                      <th className="font-label-md text-label-md text-on-surface-variant py-stack-sm px-stack-lg border-b border-border-subtle font-normal text-right">
                        <span className="flex items-center justify-end gap-1">
                          <Banknote className="w-3.5 h-3.5" />
                          ยอดรวม
                        </span>
                      </th>
                      <th className="font-label-md text-label-md text-on-surface-variant py-stack-sm px-stack-lg border-b border-border-subtle font-normal text-right">
                        <span className="flex items-center justify-end gap-1">
                          <Info className="w-3.5 h-3.5" />
                          สถานะ
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-body-md text-body-md text-on-background">
                    {stats.recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-border-subtle last:border-0 hover:bg-surface-container-low transition-colors"
                      >
                        <td className="py-stack-md px-stack-lg">
                          <div className="font-bold flex items-center gap-1.5 text-on-background">
                            <Receipt className="w-4 h-4 text-primary" />
                            {order.id}
                            {order.tableNumber && (
                              <span className="text-xs font-normal text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Armchair className="w-3 h-3" /> โต๊ะ {order.tableNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-on-surface-variant text-xs mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {order.time}
                          </div>
                        </td>
                        <td className="py-stack-md px-stack-lg text-right font-bold">
                          {order.total}
                        </td>
                        <td className="py-stack-md px-stack-lg text-right">
                          <span
                            className={`inline-flex items-center gap-1 justify-center px-2 py-1 rounded text-xs font-semibold ${order.statusClass}`}
                          >
                            {order.statusKey === "preparing" ? (
                              <Hourglass className="w-3.5 h-3.5" />
                            ) : order.statusKey === "served" ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCheck className="w-3.5 h-3.5" />
                            )}
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-stack-sm border-t border-border-subtle bg-surface-bright text-center">
              <Link
                href="/dashboard/orders"
                className="font-label-md text-label-md text-secondary hover:text-primary transition-colors w-full py-2 flex items-center justify-center gap-1.5"
              >
                <Eye className="w-4 h-4" />
                ดูออเดอร์ทั้งหมด
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
