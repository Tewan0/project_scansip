"use client";

import { useState } from "react";

export default function SalesReportsPage() {
  const [dateRange, setDateRange] = useState("Last 7 Days");

  const dailySales = [
    { day: "Mon", amount: "$3,000", heightPct: 60, highlight: false },
    { day: "Tue", amount: "$4,000", heightPct: 80, highlight: false },
    { day: "Wed", amount: "$2,000", heightPct: 40, highlight: false },
    { day: "Thu", amount: "$4,500", heightPct: 90, highlight: false },
    { day: "Fri", amount: "$3,500", heightPct: 70, highlight: false },
    { day: "Sat", amount: "$5,000", heightPct: 100, highlight: true },
    { day: "Sun", amount: "$2,500", heightPct: 50, highlight: false },
  ];

  const topItems = [
    { name: "Espresso Martini", qty: 142, revenue: "$2,130" },
    { name: "Artisan Cold Brew", qty: 118, revenue: "$708" },
    { name: "Aged Negroni", qty: 95, revenue: "$1,425" },
    { name: "Truffle Fries", qty: 88, revenue: "$792" },
    { name: "Matcha Latte", qty: 76, revenue: "$456" },
  ];

  const handleExport = () => {
    // Generate simple CSV download for demo
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Day,Sales\n" +
      dailySales.map((d) => `${d.day},${d.amount.replace("$", "")}`).join("\n") +
      "\n\nTop Item,Qty,Revenue\n" +
      topItems.map((i) => `${i.name},${i.qty},${i.revenue.replace("$", "")}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `scansip_sales_report_${dateRange.toLowerCase().replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-gutter">
      {/* Controls & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-stack-lg gap-stack-md">
        <div className="flex items-center gap-stack-sm bg-surface-card border border-border-subtle rounded-xl p-unit px-stack-sm shadow-xs h-9">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
            calendar_today
          </span>
          <select
            className="bg-transparent border-none text-body-sm font-body-sm text-on-surface focus:ring-0 py-0 pl-1 pr-6 cursor-pointer outline-none"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>This Month</option>
            <option>Custom Range...</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="bg-primary-container text-on-primary hover:bg-primary transition-colors duration-200 rounded-xl px-stack-lg h-9 flex items-center gap-stack-sm font-label-md text-label-md shadow-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">table_view</span>
          Export to Excel
        </button>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Chart Card */}
        <div className="lg:col-span-8 bg-surface-card rounded-xl border border-border-subtle p-stack-lg shadow-xs">
          <div className="flex justify-between items-center mb-stack-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">
                bar_chart
              </span>
              <h3 className="font-headline-md text-headline-md font-bold text-primary">
                Sales by Day
              </h3>
            </div>
            <span className="text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">date_range</span>
              {dateRange}
            </span>
          </div>

          {/* Bar Chart Container */}
          <div className="h-64 w-full flex items-end justify-between gap-2 px-stack-sm border-b border-border-subtle relative pb-stack-sm ml-6">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-label-md font-label-md text-on-surface-variant pb-stack-sm -ml-8">
              <span>$5k</span>
              <span>$2.5k</span>
              <span>$0</span>
            </div>

            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-stack-sm">
              <div className="w-full border-t border-dashed border-border-subtle"></div>
              <div className="w-full border-t border-dashed border-border-subtle"></div>
              <div className="w-full"></div>
            </div>

            {/* Bars */}
            <div className="w-full flex justify-between items-end gap-2 sm:gap-4 z-10 h-full pt-4">
              {dailySales.map((item) => (
                <div
                  key={item.day}
                  className={`group relative w-full rounded-t-sm transition-all duration-200 cursor-pointer ${
                    item.highlight
                      ? "bg-primary-container shadow-[0_0_8px_rgba(85,55,34,0.3)] hover:brightness-110"
                      : "bg-primary-fixed-dim hover:bg-primary-container"
                  }`}
                  style={{ height: `${item.heightPct}%` }}
                >
                  <div
                    className={`${
                      item.highlight
                        ? "opacity-100 z-20"
                        : "opacity-0 group-hover:opacity-100 z-10"
                    } absolute -top-8 left-1/2 transform -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-label-md font-label-md px-2 py-1 rounded shadow-md whitespace-nowrap transition-opacity pointer-events-none`}
                  >
                    {item.amount}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between mt-stack-sm text-label-md font-label-md text-on-surface-variant px-stack-sm ml-6">
            {dailySales.map((item) => (
              <span
                key={item.day}
                className={item.highlight ? "text-primary font-bold" : ""}
              >
                {item.day}
              </span>
            ))}
          </div>
        </div>

        {/* Top Items Table Card */}
        <div className="lg:col-span-4 bg-surface-card rounded-xl border border-border-subtle p-stack-lg shadow-xs flex flex-col h-full">
          <div className="flex items-center gap-2 mb-stack-lg">
            <span className="material-symbols-outlined text-primary text-[22px]">
              leaderboard
            </span>
            <h3 className="font-headline-md text-headline-md font-bold text-primary">
              Top Selling Items
            </h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="font-label-md text-label-md text-on-surface-variant bg-surface-container-low py-stack-sm px-stack-md border-b border-border-subtle rounded-tl-lg">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">restaurant_menu</span>
                      Item
                    </span>
                  </th>
                  <th className="font-label-md text-label-md text-on-surface-variant bg-surface-container-low py-stack-sm px-stack-md border-b border-border-subtle text-right">
                    <span className="flex items-center justify-end gap-1">
                      <span className="material-symbols-outlined text-[14px]">tag</span>
                      Qty
                    </span>
                  </th>
                  <th className="font-label-md text-label-md text-on-surface-variant bg-surface-container-low py-stack-sm px-stack-md border-b border-border-subtle text-right rounded-tr-lg">
                    <span className="flex items-center justify-end gap-1">
                      <span className="material-symbols-outlined text-[14px]">payments</span>
                      Revenue
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
          </div>
        </div>
      </div>
    </div>
  );
}
