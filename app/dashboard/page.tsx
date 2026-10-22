"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

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
  Banknote,
  TrendingUp,
  TrendingDown,
  Minus,
  Receipt,
  CheckCircle2,
  Coffee,
  Flame,
  LineChart,
  ArrowRight,
  BarChart3,
  Clock,
  Hourglass,
  CheckCheck,
  Eye,
  RefreshCw,
  Armchair,
  ShoppingBag,
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
  growthPercent: number | null;
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

  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const fetchStats = useCallback(async (isManual = false) => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch("/api/dashboard/stats", { signal: controller.signal, cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error("Failed to load dashboard");
      if (!controller.signal.aborted) {
        setStats(json.data);
        setError(null);
      }
    } catch {
      if (!controller.signal.aborted) setError("อัปเดตข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    const timer = setInterval(() => void fetchStats(), 15000);
    return () => {
      clearInterval(timer);
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [fetchStats]);

  // Compute SVG chart coordinates based on chartData
  const chartPoints = stats?.chartData || [];
  const maxSales = Math.max(...chartPoints.map((c) => c.sales), 100);
  const chartHeight = 220;
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

  // Loading Skeleton State with Shadcn Skeleton
  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44 rounded-lg" />
            <Skeleton className="h-4 w-64 rounded-md" />
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        {/* 3 Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 justify-between h-36">
              <div className="flex justify-between items-start">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="size-9 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-36 my-2" />
              <Skeleton className="h-4 w-40" />
            </Card>
          ))}
        </div>

        {/* Chart & Recent Orders Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2 p-5 h-96 justify-between">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-8 w-28" />
            </div>
            <Skeleton className="w-full h-64 rounded-lg mt-4" />
          </Card>
          <Card className="p-5 h-96 justify-between">
            <div className="flex justify-between items-center mb-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="space-y-3 flex-1">
              {[1, 2, 3, 4].map((j) => (
                <Skeleton key={j} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div className="p-6 space-y-4"><h1 className="text-2xl font-bold">ภาพรวมร้านค้า</h1><p role="alert" className="text-destructive">{error || "ไม่พบข้อมูล"}</p><Button onClick={() => void fetchStats(true)} disabled={isRefreshing}>ลองอีกครั้ง</Button></div>;
  }

  const todaySalesDisplay = `฿${(stats?.todaySales || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header with Live Refresh Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              ภาพรวมร้านค้า
            </h1>
            <Badge variant="outline" className="gap-1.5 text-xs font-normal">
              <span className={`size-2 rounded-full ${error ? "bg-amber-500" : "bg-emerald-500 animate-pulse"}`} />
              {error ? "ข้อมูลยังไม่อัปเดต" : "อัปเดตทุก 15 วินาที"}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            ยอดสั่งซื้อที่ไม่ยกเลิก รวมรายการที่ยังไม่ชำระ · แบ่งวันตามเวลาไทย
          </p>
        </div>

        <Button
          onClick={() => fetchStats(true)}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="w-fit"
        >
          <RefreshCw className={isRefreshing ? "animate-spin" : ""} data-icon="inline-start" />
          <span>{isRefreshing ? "กำลังอัปเดต..." : "อัปเดตข้อมูล"}</span>
        </Button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error} · กำลังแสดงข้อมูลที่โหลดได้ครั้งล่าสุด</p>}
      {/* 3 Metric Cards Bento Grid using Shadcn Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Metric 1: Sales */}
        <Card className="justify-between border-border/80 hover:border-foreground/20 hover:-translate-y-0.5 hover:shadow-md transition-all animate-fadeIn shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                ยอดขายวันนี้
              </CardDescription>
              <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Banknote className="size-4" />
              </div>
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight mt-1">
              {todaySalesDisplay}
            </CardTitle>
          </CardHeader>
          <CardFooter className="py-3 text-xs flex items-center gap-1.5">
            <span className={`font-semibold flex items-center gap-0.5 ${(stats?.growthPercent ?? 0) < 0 ? "text-destructive" : (stats?.growthPercent ?? 0) > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
              {(stats?.growthPercent ?? 0) < 0 ? <TrendingDown className="size-3.5" /> : (stats?.growthPercent ?? 0) > 0 ? <TrendingUp className="size-3.5" /> : <Minus className="size-3.5" />}
              {stats?.growthPercent === null ? "เมื่อวานไม่มียอดขาย" : `${(stats?.growthPercent ?? 0) > 0 ? "+" : ""}${stats?.growthPercent ?? 0}%`}
            </span>
            <span className="text-muted-foreground">เทียบกับเมื่อวาน</span>
          </CardFooter>
        </Card>

        {/* Metric 2: Orders Count */}
        <Card className="justify-between border-border/80 hover:border-foreground/20 hover:-translate-y-0.5 hover:shadow-md transition-all animate-fadeIn animation-delay-100 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                จำนวนออเดอร์วันนี้
              </CardDescription>
              <div className="size-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <Receipt className="size-4" />
              </div>
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight mt-1">
              {stats?.todayOrdersCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="py-3 text-xs flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>เสร็จสิ้น {stats?.completedOrdersCount ?? 0} ออเดอร์</span>
          </CardFooter>
        </Card>

        {/* Metric 3: Best Menu Item */}
        <Card className="justify-between border-border/80 hover:border-foreground/20 hover:-translate-y-0.5 hover:shadow-md transition-all sm:col-span-2 lg:col-span-1 animate-fadeIn animation-delay-200 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                เมนูขายดีประจำวัน
              </CardDescription>
              <div className="size-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <Coffee className="size-4" />
              </div>
            </div>
            <CardTitle className="text-xl font-bold tracking-tight mt-1 truncate" title={stats?.topMenu.name}>
              {stats?.topMenu.name || "ยังไม่มีข้อมูล"}
            </CardTitle>
          </CardHeader>
          <CardFooter className="py-3 text-xs flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
            <Flame className="size-3.5" />
            <span>{stats?.topMenu.count ?? 0} รายการที่สั่ง</span>
          </CardFooter>
        </Card>
      </div>

      {/* Main Data Section: Chart & Recent Orders */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: 7 Days Sales Trend Chart */}
        <Card className="xl:col-span-2 flex flex-col justify-between border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <LineChart className="size-5 text-foreground" />
              <div>
                <CardTitle className="text-base font-bold">ยอดขาย (7 วันล่าสุด)</CardTitle>
                <CardDescription className="text-xs">ยอดสั่งซื้อที่ไม่ยกเลิก รวมรายการที่ยังไม่ชำระ</CardDescription>
              </div>
            </div>
            <Button
              render={<Link href="/dashboard/reports" />}
              variant="outline"
              size="xs"
            >
              <BarChart3 data-icon="inline-start" />
              <span>รายงานยอดขาย</span>
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="relative w-full h-[240px] pb-6">
              {/* Responsive SVG Chart */}
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                {/* Horizontal Grid Lines */}
                <path d={`M0 40 L${chartWidth} 40`} fill="none" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" className="text-border" />
                <path d={`M0 90 L${chartWidth} 90`} fill="none" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" className="text-border" />
                <path d={`M0 140 L${chartWidth} 140`} fill="none" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" className="text-border" />
                <path d={`M0 190 L${chartWidth} 190`} fill="none" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" className="text-border" />

                {/* Gradient Fill under Curve */}
                {areaD && (
                  <path d={areaD} fill="currentColor" className="text-primary/10" />
                )}

                {/* Primary Stroke Line */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    className="text-primary"
                  />
                )}

                {/* Data Points */}
                {points.map((pt, i) => (
                  <g key={i}>
                    <circle cx={pt.x} cy={pt.y} r="4" fill="currentColor" className="text-background stroke-primary stroke-2" />
                  </g>
                ))}
              </svg>

              {/* X-Axis Labels */}
              <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-muted-foreground px-2 select-none">
                {points.map((pt, i) => (
                  <span key={i} className="text-center w-12 text-[11px] truncate">
                    {pt.label}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Recent Orders List using Shadcn Table */}
        <Card className="flex flex-col justify-between border-border overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <Receipt className="size-4 text-foreground" />
              <CardTitle className="text-base font-bold">ออเดอร์ล่าสุด</CardTitle>
            </div>
            <Badge variant="outline" className="text-[11px]">
              {(stats?.recentOrders || []).length} รายการ
            </Badge>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-x-auto overflow-y-auto max-h-[340px]">
            {(!stats?.recentOrders || stats.recentOrders.length === 0) ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-2">
                <ShoppingBag className="size-8 opacity-30" />
                <p className="text-xs">ยังไม่มีคำสั่งซื้อเข้ามาในวันนี้</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-xs py-2">ออเดอร์</TableHead>
                    <TableHead className="text-right text-xs py-2">ยอดรวม</TableHead>
                    <TableHead className="text-right text-xs py-2">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/40">
                      <TableCell className="py-2.5">
                        <div className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                          <span>{order.id}</span>
                          {order.tableNumber && (
                            <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Armchair className="size-2.5" /> โต๊ะ {order.tableNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground text-[10px] mt-0.5 flex items-center gap-1">
                          <Clock className="size-2.5" />
                          <span>{order.time}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs py-2.5">
                        {order.total}
                      </TableCell>
                      <TableCell className="text-right py-2.5">
                        {order.statusKey === "preparing" ? (
                          <Badge variant="secondary" className="gap-1 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                            <Hourglass className="size-2.5" />
                            {order.status}
                          </Badge>
                        ) : order.statusKey === "served" ? (
                          <Badge variant="secondary" className="gap-1 text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                            <CheckCircle2 className="size-2.5" />
                            {order.status}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                            <CheckCheck className="size-2.5" />
                            {order.status}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>

          <CardFooter className="p-3 border-t border-border bg-card">
            <Button
              render={<Link href="/dashboard/orders" />}
              variant="ghost"
              size="sm"
              className="w-full text-xs"
            >
              <Eye data-icon="inline-start" />
              <span>ดูออเดอร์ทั้งหมด</span>
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
