"use client";

import { useState, useEffect } from "react";
import {
  ListFilter,
  Hourglass,
  CheckCircle2,
  CheckCheck,
  Tag,
  Armchair,
  UtensilsCrossed,
  Banknote,
  Info,
  MousePointerClick,
  Check,
  Loader2,
  Inbox,
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
  const [activeTab, setActiveTab] = useState<"ทั้งหมด" | "pending" | "preparing" | "served" | "completed">("ทั้งหมด");

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/orders");
      const json = await res.json();
      if (json.success) {
        setOrders(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Poll orders every 10 seconds (หรือใช้ realtime)
    const timer = setInterval(fetchOrders, 10000);
    return () => clearInterval(timer);
  }, []);

  const filteredOrders = orders.filter((order) => {
    if (activeTab === "ทั้งหมด") return true;
    return order.status === activeTab;
  });

  const updateOrderStatus = async (id: string, newStatus: Order["status"]) => {
    try {
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
    }
  };

  const getStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Hourglass className="w-3 h-3" />
            รอยืนยัน
          </span>
        );
      case "preparing":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Hourglass className="w-3 h-3 animate-spin" />
            กำลังเตรียม
          </span>
        );
      case "served":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <CheckCircle2 className="w-3 h-3" />
            เสิร์ฟแล้ว
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCheck className="w-3 h-3" />
            เสร็จสิ้น
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            ยกเลิก
          </span>
        );
    }
  };

  return (
    <div className="p-gutter lg:p-margin-page">
      <div className="max-w-7xl mx-auto space-y-gutter">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-stack-sm border-b border-border-subtle pb-stack-sm overflow-x-auto">
          {[
            { label: "ทั้งหมด", key: "ทั้งหมด" },
            { label: "รอยืนยัน", key: "pending" },
            { label: "กำลังเตรียม", key: "preparing" },
            { label: "เสิร์ฟแล้ว", key: "served" },
            { label: "เสร็จสิ้น", key: "completed" },
          ].map((tab) => {
            const count =
              tab.key === "ทั้งหมด"
                ? orders.length
                : orders.filter((o) => o.status === tab.key).length;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-lg font-label-md text-label-md flex items-center gap-2 transition-colors cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-primary text-on-primary font-bold shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full ${
                    activeTab === tab.key
                      ? "bg-on-primary/20 text-on-primary"
                      : "bg-surface-container text-on-surface"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Orders Table */}
        <div className="bg-surface-card rounded-xl border border-border-subtle overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <p className="font-body-md text-body-md">กำลังโหลดข้อมูลออเดอร์จากฐานข้อมูล...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-16 text-center text-on-surface-variant">
              <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface mb-1">
                ยังไม่มีคำสั่งซื้อในสถานะนี้
              </h3>
              <p className="font-body-sm text-body-sm">
                เมื่อลูกค้าสแกนสั่งอาหารจากโต๊ะ รายการจะปรากฏที่นี่แบบเรียลไทม์
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-surface border-b border-border-subtle text-on-surface-variant font-label-md text-label-md">
                  <tr>
                    <th className="py-stack-sm px-gutter font-semibold">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" />
                        ออเดอร์
                      </span>
                    </th>
                    <th className="py-stack-sm px-gutter font-semibold">
                      <span className="flex items-center gap-1">
                        <Armchair className="w-3.5 h-3.5" />
                        โต๊ะ
                      </span>
                    </th>
                    <th className="py-stack-sm px-gutter font-semibold">
                      <span className="flex items-center gap-1">
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        รายการอาหาร
                      </span>
                    </th>
                    <th className="py-stack-sm px-gutter font-semibold">
                      <span className="flex items-center gap-1">
                        <Banknote className="w-3.5 h-3.5" />
                        ยอดรวม
                      </span>
                    </th>
                    <th className="py-stack-sm px-gutter font-semibold">
                      <span className="flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" />
                        สถานะ
                      </span>
                    </th>
                    <th className="py-stack-sm px-gutter font-semibold text-right">
                      <span className="flex items-center justify-end gap-1">
                        <MousePointerClick className="w-3.5 h-3.5" />
                        จัดการ
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-surface-bright transition-colors"
                    >
                      <td className="py-stack-md px-gutter font-body-md font-bold text-on-surface">
                        {order.orderNumber}
                      </td>
                      <td className="py-stack-md px-gutter font-body-md text-on-surface">
                        โต๊ะ {order.tableNumber ? String(order.tableNumber).padStart(2, "0") : "-"}
                      </td>
                      <td className="py-stack-md px-gutter font-body-md text-on-surface">
                        <ul className="space-y-0.5">
                          {order.items?.map((item) => (
                            <li key={item.id} className="text-xs">
                              <span className="font-semibold text-primary">{item.quantity}x</span> {item.menuName}
                              {item.specialInstruction && (
                                <span className="text-on-surface-variant text-[11px] block pl-3">
                                  - {item.specialInstruction}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-stack-md px-gutter font-body-md font-bold text-primary">
                        ฿{Number(order.totalAmount).toFixed(2)}
                      </td>
                      <td className="py-stack-md px-gutter">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-stack-md px-gutter text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {order.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(order.id, "preparing")}
                              className="px-2.5 py-1 text-xs rounded bg-primary text-on-primary font-semibold hover:bg-primary/90 cursor-pointer"
                            >
                              รับออเดอร์
                            </button>
                          )}
                          {order.status === "preparing" && (
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(order.id, "served")}
                              className="px-2.5 py-1 text-xs rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 cursor-pointer"
                            >
                              เสิร์ฟแล้ว
                            </button>
                          )}
                          {order.status === "served" && (
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(order.id, "completed")}
                              className="px-2.5 py-1 text-xs rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700 cursor-pointer"
                            >
                              ปิดบิล
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
