import Link from "next/link";

export default function DashboardPage() {
  const recentOrders = [
    {
      id: "#2045",
      time: "2m ago",
      total: "$14.50",
      status: "Prep",
      statusClass: "bg-surface-container text-on-surface",
    },
    {
      id: "#2044",
      time: "15m ago",
      total: "$6.00",
      status: "Ready",
      statusClass: "bg-[#D1FAE5] text-[#065F46]",
    },
    {
      id: "#2043",
      time: "28m ago",
      total: "$22.00",
      status: "Ready",
      statusClass: "bg-[#D1FAE5] text-[#065F46]",
    },
    {
      id: "#2042",
      time: "45m ago",
      total: "$18.50",
      status: "Done",
      statusClass: "bg-surface-variant text-on-surface-variant",
    },
  ];

  return (
    <div className="p-gutter lg:p-margin-page">
      <div className="max-w-7xl mx-auto space-y-gutter">
        {/* Summary Cards Bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {/* Sales Card */}
          <div className="bg-surface-card border border-border-subtle rounded-xl p-stack-lg flex flex-col gap-stack-sm hover:shadow-xs transition-shadow">
            <div className="flex justify-between items-start">
              <span className="font-label-md text-label-md text-on-surface-variant">
                Today&apos;s Sales
              </span>
              <div className="w-8 h-8 rounded bg-primary-fixed text-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">payments</span>
              </div>
            </div>
            <div className="font-headline-xl text-headline-xl text-on-background mt-2">
              $1,240
            </div>
            <div className="flex items-center gap-unit text-status-success font-label-md text-label-md mt-4">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>+14.2%</span>
              <span className="text-on-surface-variant font-body-sm text-body-sm ml-1 font-normal">
                vs yesterday
              </span>
            </div>
          </div>

          {/* Orders Card */}
          <div className="bg-surface-card border border-border-subtle rounded-xl p-stack-lg flex flex-col gap-stack-sm hover:shadow-xs transition-shadow">
            <div className="flex justify-between items-start">
              <span className="font-label-md text-label-md text-on-surface-variant">
                Total Orders
              </span>
              <div className="w-8 h-8 rounded bg-secondary-fixed text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">receipt_long</span>
              </div>
            </div>
            <div className="font-headline-xl text-headline-xl text-on-background mt-2">
              42
            </div>
            <div className="flex items-center gap-unit text-on-surface-variant font-label-md text-label-md mt-4">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>38 completed</span>
            </div>
          </div>

          {/* Best Item Card */}
          <div className="bg-surface-card border border-border-subtle rounded-xl p-stack-lg flex flex-col gap-stack-sm hover:shadow-xs transition-shadow">
            <div className="flex justify-between items-start">
              <span className="font-label-md text-label-md text-on-surface-variant">
                Best-Selling Item
              </span>
              <div className="w-8 h-8 rounded bg-surface-container-high text-on-surface flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">local_cafe</span>
              </div>
            </div>
            <div className="font-headline-md text-headline-md text-on-background mt-2 leading-tight">
              Oat Flat White
            </div>
            <div className="flex items-center gap-unit text-on-surface-variant font-label-md text-label-md mt-auto pt-4">
              <span className="material-symbols-outlined text-sm">local_fire_department</span>
              <span className="text-status-warning font-semibold">18 orders today</span>
            </div>
          </div>
        </div>

        {/* Main Data Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          {/* Chart Area */}
          <div className="lg:col-span-2 bg-surface-card border border-border-subtle rounded-xl p-stack-lg flex flex-col">
            <div className="flex justify-between items-center mb-stack-lg">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  insights
                </span>
                <h2 className="font-headline-md text-headline-md text-on-background font-bold">
                  Sales (Last 7 Days)
                </h2>
              </div>
              <Link
                href="/dashboard/reports"
                className="font-label-md text-label-md px-3 py-1.5 border border-border-subtle rounded hover:bg-surface-container-low transition-colors text-on-surface-variant flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">bar_chart</span>
                <span>Reports</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>

            <div className="relative w-full h-[280px] mt-auto">
              {/* Abstracted Line Chart */}
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 240">
                {/* Grid Lines */}
                <path
                  d="M0 40 L800 40"
                  fill="none"
                  stroke="#E9ECEF"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                ></path>
                <path
                  d="M0 100 L800 100"
                  fill="none"
                  stroke="#E9ECEF"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                ></path>
                <path
                  d="M0 160 L800 160"
                  fill="none"
                  stroke="#E9ECEF"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                ></path>
                <path
                  d="M0 220 L800 220"
                  fill="none"
                  stroke="#E9ECEF"
                  strokeWidth="1"
                ></path>

                {/* Data Line */}
                <path
                  d="M0 180 C 100 160, 200 200, 300 120 C 400 40, 500 100, 600 60 C 700 20, 800 80, 800 80"
                  fill="none"
                  stroke="#79573f"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="4"
                ></path>

                {/* Gradient Fill */}
                <path
                  d="M0 180 C 100 160, 200 200, 300 120 C 400 40, 500 100, 600 60 C 700 20, 800 80, 800 80 L800 240 L0 240 Z"
                  fill="url(#chartGradient)"
                  opacity="0.15"
                ></path>

                {/* Data Points */}
                <circle cx="300" cy="120" fill="#FFFFFF" r="4" stroke="#79573f" strokeWidth="2"></circle>
                <circle cx="600" cy="60" fill="#FFFFFF" r="4" stroke="#79573f" strokeWidth="2"></circle>

                <defs>
                  <linearGradient id="chartGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#79573f" stopOpacity="1"></stop>
                    <stop offset="100%" stopColor="#79573f" stopOpacity="0"></stop>
                  </linearGradient>
                </defs>
              </svg>

              {/* X-Axis Labels */}
              <div className="absolute bottom-[-24px] left-0 w-full flex justify-between font-label-md text-label-md text-on-surface-variant px-2">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="bg-surface-card border border-border-subtle rounded-xl flex flex-col overflow-hidden shadow-xs">
            <div className="p-stack-lg border-b border-border-subtle flex justify-between items-center bg-surface-bright">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  receipt_long
                </span>
                <h2 className="font-headline-md text-headline-md text-on-background font-bold">
                  Recent Orders
                </h2>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface sticky top-0">
                  <tr>
                    <th className="font-label-md text-label-md text-on-surface-variant py-stack-sm px-stack-lg border-b border-border-subtle font-normal">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">tag</span>
                        Order
                      </span>
                    </th>
                    <th className="font-label-md text-label-md text-on-surface-variant py-stack-sm px-stack-lg border-b border-border-subtle font-normal text-right">
                      <span className="flex items-center justify-end gap-1">
                        <span className="material-symbols-outlined text-[14px]">payments</span>
                        Total
                      </span>
                    </th>
                    <th className="font-label-md text-label-md text-on-surface-variant py-stack-sm px-stack-lg border-b border-border-subtle font-normal text-right">
                      <span className="flex items-center justify-end gap-1">
                        <span className="material-symbols-outlined text-[14px]">info</span>
                        Status
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-body-md text-on-background">
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-border-subtle last:border-0 hover:bg-surface-container-low transition-colors"
                    >
                      <td className="py-stack-md px-stack-lg">
                        <div className="font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px] text-primary">
                            receipt
                          </span>
                          {order.id}
                        </div>
                        <div className="text-on-surface-variant text-xs mt-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
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
                          <span className="material-symbols-outlined text-[13px]">
                            {order.status === "Prep"
                              ? "hourglass_top"
                              : order.status === "Ready"
                              ? "check_circle"
                              : "done_all"}
                          </span>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-stack-sm border-t border-border-subtle bg-surface-bright text-center">
              <Link
                href="/dashboard/orders"
                className="font-label-md text-label-md text-secondary hover:text-primary transition-colors w-full py-2 flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                View All Orders
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
