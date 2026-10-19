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
import { Separator } from "@/components/ui/separator";

// Lucide Icons
import {
  Hourglass,
  CheckCircle2,
  CheckCheck,
  Tag,
  Armchair,
  UtensilsCrossed,
  Banknote,
  Info,
  MousePointerClick,
  RefreshCw,
  Inbox,
  Clock,
  AlertCircle,
  Receipt,
  RotateCw,
} from "lucide-react";

interface OrderItem {
  id: string;
  menuName: string;
  unitPrice: string | number;
  quantity: number;
  specialInstruction: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  tableNumber: number | null;
  totalAmount: string | number;
  status: "pending" | "preparing" | "served" | "completed" | "cancelled";
  paymentStatus: "unpaid" | "paid" | "refunded";
  customerNote: string | null;
  createdAt: string;
  items: OrderItem[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"ทั้งหมด" | "pending" | "preparing" | "served" | "completed">("ทั้งหมด");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      const res = await fetch("/api/orders");
      const json = await res.json();
      if (json.success) {
        setOrders(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Poll orders every 8 seconds for live POS feed
    const timer = setInterval(() => fetchOrders(false), 8000);
    return () => clearInterval(timer);
  }, []);

  const filteredOrders = orders.filter((order) => {
    if (activeTab === "ทั้งหมด") return true;
    return order.status === activeTab;
  });

  const updateOrderStatus = async (id: string, newStatus: Order["status"]) => {
    try {
      setUpdatingId(id);
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((order) =>
            order.id === id ? { ...order, status: newStatus } : order
          )
        );
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
            <Hourglass className="size-3 text-amber-600" />
            รอยืนยัน
          </Badge>
        );
      case "preparing":
        return (
          <Badge variant="secondary" className="gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
            <Hourglass className="size-3 animate-spin text-blue-600" />
            กำลังเตรียม
          </Badge>
        );
      case "served":
        return (
          <Badge variant="secondary" className="gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
            <CheckCircle2 className="size-3 text-indigo-600" />
            เสิร์ฟแล้ว
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            <CheckCheck className="size-3 text-emerald-600" />
            เสร็จสิ้น
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="gap-1 text-[11px] font-semibold text-destructive border-destructive/40">
            <AlertCircle className="size-3" />
            ยกเลิก
          </Badge>
        );
    }
  };

  const formatOrderDateTime = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return "ไม่ระบุเวลา";
    }

    return new Intl.DateTimeFormat("th-TH", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const tabsConfig = [
    { label: "ทั้งหมด", key: "ทั้งหมด" },
    { label: "รอยืนยัน", key: "pending" },
    { label: "กำลังเตรียม", key: "preparing" },
    { label: "เสิร์ฟแล้ว", key: "served" },
    { label: "เสร็จสิ้น", key: "completed" },
  ] as const;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              รายการออเดอร์
            </h1>
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Live POS Feed
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            จัดการคำสั่งซื้อของลูกค้าในร้านและอัปเดตสถานะเข้าครัวแบบเรียลไทม์
          </p>
        </div>

        <Button
          onClick={() => fetchOrders(true)}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="w-fit"
        >
          <RefreshCw className={isRefreshing ? "animate-spin" : ""} data-icon="inline-start" />
          <span>{isRefreshing ? "กำลังรีเฟรช..." : "รีเฟรชออเดอร์"}</span>
        </Button>
      </div>

      {/* Filter Tabs using Solid / Clean Buttons */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        {tabsConfig.map((tab) => {
          const count =
            tab.key === "ทั้งหมด"
              ? orders.length
              : orders.filter((o) => o.status === tab.key).length;
          const isActive = activeTab === tab.key;

          return (
            <Button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className="gap-2 shrink-0 h-8"
            >
              <span>{tab.label}</span>
              <Badge
                variant={isActive ? "secondary" : "outline"}
                className={`text-[10px] px-1.5 py-0 h-4 ${
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Main Orders Table Card */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-foreground" />
            <CardTitle className="text-base font-bold">
              ตารางออเดอร์ ({filteredOrders.length} รายการ)
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            อัปเดตอัตโนมัติทุก 8 วินาที
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                  <Skeleton className="h-6 w-24 rounded" />
                  <Skeleton className="h-6 w-16 rounded" />
                  <Skeleton className="h-6 w-48 rounded" />
                  <Skeleton className="h-6 w-20 rounded" />
                  <Skeleton className="h-6 w-24 rounded" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Inbox className="size-10 mx-auto mb-3 opacity-30" />
              <h3 className="text-base font-bold text-foreground mb-1">
                ยังไม่มีคำสั่งซื้อในสถานะนี้
              </h3>
              <p className="text-xs max-w-sm mx-auto">
                เมื่อลูกค้าสแกนสั่งอาหารจากโต๊ะ รายการจะส่งเข้ามายังหน้าจอนี้โดยอัตโนมัติ
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[160px] text-xs font-semibold">ออเดอร์</TableHead>
                    <TableHead className="w-[110px] text-xs font-semibold">โต๊ะ</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[240px]">รายการอาหาร</TableHead>
                    <TableHead className="w-[120px] text-xs font-semibold">ยอดรวม</TableHead>
                    <TableHead className="w-[130px] text-xs font-semibold">สถานะ</TableHead>
                    <TableHead className="text-right w-[140px] text-xs font-semibold">จัดการออเดอร์</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const isRowUpdating = updatingId === order.id;

                    return (
                      <TableRow key={order.id} className="hover:bg-muted/30">
                        {/* Order ID & Time */}
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-foreground">
                              {order.orderNumber}
                            </span>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="size-3" />
                              {formatOrderDateTime(order.createdAt)}
                            </span>
                          </div>
                        </TableCell>

                        {/* Table Number */}
                        <TableCell className="py-3">
                          <span className="inline-flex items-center gap-1 font-semibold text-xs text-foreground bg-muted px-2 py-0.5 rounded">
                            <Armchair className="size-3 text-muted-foreground" />
                            {order.tableNumber ? `โต๊ะ ${String(order.tableNumber).padStart(2, "0")}` : "กลับบ้าน"}
                          </span>
                        </TableCell>

                        {/* Items ordered */}
                        <TableCell className="py-3">
                          <ul className="space-y-1">
                            {order.items?.map((item) => (
                              <li key={item.id} className="text-xs">
                                <span className="font-bold text-foreground">{item.quantity}x</span>{" "}
                                <span className="text-foreground">{item.menuName}</span>
                                {item.specialInstruction && (
                                  <span className="text-muted-foreground text-[11px] block pl-4 italic">
                                    • {item.specialInstruction}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                          {order.customerNote && (
                            <div className="mt-1.5 p-1.5 rounded bg-muted/60 text-[11px] text-muted-foreground border border-border">
                              <span className="font-semibold text-foreground">โน้ต: </span>
                              {order.customerNote}
                            </div>
                          )}
                        </TableCell>

                        {/* Total Amount */}
                        <TableCell className="py-3 font-bold text-sm text-foreground">
                          ฿{Number(order.totalAmount).toFixed(2)}
                        </TableCell>

                        {/* Status Badge */}
                        <TableCell className="py-3">
                          {getStatusBadge(order.status)}
                        </TableCell>

                        {/* Action Buttons */}
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {order.status === "pending" && (
                              <Button
                                onClick={() => updateOrderStatus(order.id, "preparing")}
                                disabled={isRowUpdating}
                                size="xs"
                                className="h-7 text-xs font-semibold"
                              >
                                {isRowUpdating ? (
                                  <RotateCw className="size-3 animate-spin" />
                                ) : (
                                  <span>รับออเดอร์</span>
                                )}
                              </Button>
                            )}

                            {order.status === "preparing" && (
                              <Button
                                onClick={() => updateOrderStatus(order.id, "served")}
                                disabled={isRowUpdating}
                                variant="outline"
                                size="xs"
                                className="h-7 text-xs font-semibold text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              >
                                {isRowUpdating ? (
                                  <RotateCw className="size-3 animate-spin" />
                                ) : (
                                  <span>เสิร์ฟแล้ว</span>
                                )}
                              </Button>
                            )}

                            {order.status === "served" && (
                              <Button
                                onClick={() => updateOrderStatus(order.id, "completed")}
                                disabled={isRowUpdating}
                                variant="outline"
                                size="xs"
                                className="h-7 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              >
                                {isRowUpdating ? (
                                  <RotateCw className="size-3 animate-spin" />
                                ) : (
                                  <span>ปิดบิล</span>
                                )}
                              </Button>
                            )}

                            {order.status === "completed" && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                                <CheckCircle2 className="size-3 text-emerald-600" />
                                เรียบร้อย
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>แสดง {filteredOrders.length} จาก {orders.length} ออเดอร์ทั้งหมด</span>
          <span className="font-semibold text-foreground">ระบบ Live POS เชื่อมต่อสมบูรณ์</span>
        </CardFooter>
      </Card>
    </div>
  );
}
