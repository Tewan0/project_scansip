"use client";

import { useState } from "react";

interface Order {
  id: string;
  table: string;
  items: string[];
  total: string;
  time: string;
  status: "Prep" | "Ready" | "Done";
}

const initialOrders: Order[] = [
  {
    id: "#2045",
    table: "Table 04",
    items: ["2x Artisan Latte", "1x Butter Croissant"],
    total: "$14.50",
    time: "2m ago",
    status: "Prep",
  },
  {
    id: "#2044",
    table: "Table 02",
    items: ["1x Iced Matcha"],
    total: "$6.00",
    time: "15m ago",
    status: "Ready",
  },
  {
    id: "#2043",
    table: "Table 08",
    items: ["1x Espresso Martini", "1x Truffle Fries"],
    total: "$22.00",
    time: "28m ago",
    status: "Ready",
  },
  {
    id: "#2042",
    table: "Table 01",
    items: ["2x Oat Flat White", "1x Avocado Toast"],
    total: "$18.50",
    time: "45m ago",
    status: "Done",
  },
  {
    id: "#2041",
    table: "Table 06",
    items: ["1x Artisan Cold Brew", "1x Croissant"],
    total: "$9.75",
    time: "1h ago",
    status: "Done",
  },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeTab, setActiveTab] = useState<"All" | "Prep" | "Ready" | "Done">("All");

  const filteredOrders = orders.filter((order) => {
    if (activeTab === "All") return true;
    return order.status === activeTab;
  });

  const updateOrderStatus = (id: string, newStatus: "Prep" | "Ready" | "Done") => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === id ? { ...order, status: newStatus } : order
      )
    );
  };

  return (
    <div className="p-gutter lg:p-margin-page">
      <div className="max-w-7xl mx-auto space-y-gutter">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-stack-sm border-b border-border-subtle pb-stack-sm overflow-x-auto">
          {(["All", "Prep", "Ready", "Done"] as const).map((tab) => {
            const count =
              tab === "All"
                ? orders.length
                : orders.filter((o) => o.status === tab).length;

            const icon =
              tab === "All"
                ? "list_alt"
                : tab === "Prep"
                ? "hourglass_top"
                : tab === "Ready"
                ? "check_circle"
                : "done_all";

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-label-md text-label-md flex items-center gap-2 transition-colors cursor-pointer ${
                  activeTab === tab
                    ? "bg-primary text-on-primary font-bold shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{icon}</span>
                <span>{tab}</span>
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full ${
                    activeTab === tab
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

        {/* Orders Grid / Table */}
        <div className="bg-surface-card rounded-xl border border-border-subtle overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-surface border-b border-border-subtle text-on-surface-variant font-label-md text-label-md">
                <tr>
                  <th className="py-stack-sm px-gutter font-semibold">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">tag</span>
                      Order
                    </span>
                  </th>
                  <th className="py-stack-sm px-gutter font-semibold">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">table_restaurant</span>
                      Table
                    </span>
                  </th>
                  <th className="py-stack-sm px-gutter font-semibold">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">restaurant_menu</span>
                      Items
                    </span>
                  </th>
                  <th className="py-stack-sm px-gutter font-semibold text-right">
                    <span className="flex items-center justify-end gap-1">
                      <span className="material-symbols-outlined text-[14px]">payments</span>
                      Total
                    </span>
                  </th>
                  <th className="py-stack-sm px-gutter font-semibold text-right">
                    <span className="flex items-center justify-end gap-1">
                      <span className="material-symbols-outlined text-[14px]">info</span>
                      Status
                    </span>
                  </th>
                  <th className="py-stack-sm px-gutter font-semibold text-right">
                    <span className="flex items-center justify-end gap-1">
                      <span className="material-symbols-outlined text-[14px]">touch_app</span>
                      Action
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md divide-y divide-border-subtle">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      No orders in this category.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-surface-container-low transition-colors"
                    >
                      <td className="py-stack-md px-gutter">
                        <div className="font-bold text-on-surface">{order.id}</div>
                        <div className="text-on-surface-variant text-xs mt-0.5">
                          {order.time}
                        </div>
                      </td>
                      <td className="py-stack-md px-gutter font-semibold text-primary">
                        {order.table}
                      </td>
                      <td className="py-stack-md px-gutter text-on-surface-variant">
                        <ul className="text-xs space-y-0.5">
                          {order.items.map((it, idx) => (
                            <li key={idx}>{it}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-stack-md px-gutter font-bold text-on-surface text-right">
                        {order.total}
                      </td>
                      <td className="py-stack-md px-gutter text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            order.status === "Prep"
                              ? "bg-surface-container text-on-surface"
                              : order.status === "Ready"
                              ? "bg-[#D1FAE5] text-[#065F46]"
                              : "bg-surface-variant text-on-surface-variant"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-stack-md px-gutter text-right">
                        <div className="flex items-center justify-end gap-1">
                          {order.status === "Prep" && (
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(order.id, "Ready")}
                              className="px-2.5 py-1 bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] rounded text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Mark Ready
                            </button>
                          )}
                          {order.status === "Ready" && (
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(order.id, "Done")}
                              className="px-2.5 py-1 bg-surface-variant text-on-surface-variant hover:bg-surface-container-high rounded text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Mark Done
                            </button>
                          )}
                          {order.status === "Done" && (
                            <span className="text-xs text-status-success flex items-center justify-end gap-0.5">
                              <span className="material-symbols-outlined text-[16px]">
                                check
                              </span>
                              Complete
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
