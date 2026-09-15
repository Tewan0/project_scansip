import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getOrCreateStore } from "@/utils/store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "7d"; // '7d', '30d', 'month'

    const store = await getOrCreateStore();

    // ดึงออเดอร์ทั้งหมด
    const allOrders = await db.query.orders.findMany({
      where: eq(orders.storeId, store.id),
      with: {
        items: true,
      },
      orderBy: [desc(orders.createdAt)],
    });

    const now = new Date();
    const daysTh = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

    let numDays = 7;
    if (range === "30d") numDays = 30;
    else if (range === "month") {
      numDays = now.getDate(); // ตั้งแต่วันที่ 1 ของเดือนนี้ถึงวันนี้
    }

    // สร้าง Bucket วันที่
    const dailyMap = new Map<string, { dayLabel: string; dateStr: string; amount: number }>();
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const key = `${yyyy}-${mm}-${dd}`;
      const dayLabel = numDays <= 7 ? daysTh[d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`;
      dailyMap.set(key, { dayLabel, dateStr: key, amount: 0 });
    }

    const itemAgg: Record<string, { name: string; qty: number; revenue: number }> = {};
    let totalRevenue = 0;
    let totalOrdersCount = 0;

    // คำนวณช่วงเวลาเริ่มต้น
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (numDays - 1));
    startDate.setHours(0, 0, 0, 0);

    for (const o of allOrders) {
      if (o.status === "cancelled") continue;
      const orderDate = new Date(o.createdAt);
      if (orderDate < startDate) continue;

      totalOrdersCount++;
      const amt = Number(o.totalAmount) || 0;
      totalRevenue += amt;

      const yyyy = orderDate.getFullYear();
      const mm = String(orderDate.getMonth() + 1).padStart(2, "0");
      const dd = String(orderDate.getDate()).padStart(2, "0");
      const key = `${yyyy}-${mm}-${dd}`;

      const entry = dailyMap.get(key);
      if (entry) {
        entry.amount += amt;
      }

      if (o.items && Array.isArray(o.items)) {
        for (const it of o.items) {
          const qty = Number(it.quantity) || 1;
          const unitP = Number(it.unitPrice) || 0;
          const rev = unitP * qty;
          if (!itemAgg[it.menuName]) {
            itemAgg[it.menuName] = { name: it.menuName, qty: 0, revenue: 0 };
          }
          itemAgg[it.menuName].qty += qty;
          itemAgg[it.menuName].revenue += rev;
        }
      }
    }

    const dailySalesArray = Array.from(dailyMap.values());
    const maxDayAmount = Math.max(...dailySalesArray.map((d) => d.amount), 1);

    const dailySalesFormatted = dailySalesArray.map((d) => ({
      day: d.dayLabel,
      dateStr: d.dateStr,
      amount: `฿${d.amount.toLocaleString("th-TH")}`,
      rawAmount: d.amount,
      heightPct: Math.round((d.amount / maxDayAmount) * 100),
      highlight: d.amount === maxDayAmount && d.amount > 0,
    }));

    const topItems = Object.values(itemAgg)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map((it) => ({
        name: it.name,
        qty: it.qty,
        revenue: `฿${it.revenue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      }));

    return NextResponse.json({
      success: true,
      data: {
        range,
        totalRevenue,
        totalOrdersCount,
        dailySales: dailySalesFormatted,
        topItems,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
