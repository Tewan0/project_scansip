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
    const thaiDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const thaiMonths = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    const thaiFullMonths = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];

    const mapBuckets = new Map<string, { dayLabel: string; dateStr: string; amount: number }>();
    let startDate: Date;
    let endDate: Date;

    if (range === "7d") {
      // 7 วันล่าสุด
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        mapBuckets.set(key, { dayLabel: thaiDays[d.getDay()], dateStr: key, amount: 0 });
      }
    } else if (range === "month") {
      // เดือนนี้: ตั้งแต่วันที่ 1 ถึงวันนี้
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const lastDay = now.getDate();
      endDate = new Date(now.getFullYear(), now.getMonth(), lastDay, 23, 59, 59, 999);

      for (let day = 1; day <= lastDay; day++) {
        const d = new Date(now.getFullYear(), now.getMonth(), day);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        mapBuckets.set(key, { dayLabel: `${day}`, dateStr: key, amount: 0 });
      }
    } else if (range === "month-1" || range === "month-2" || range === "month-3") {
      // ย้อนหลัง 1, 2, 3 เดือน (เต็มเดือนนั้นๆ)
      const offset = range === "month-1" ? 1 : range === "month-2" ? 2 : 3;
      const targetYear = now.getMonth() - offset < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const targetMonth = (now.getMonth() - offset + 12) % 12;
      const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

      startDate = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
      endDate = new Date(targetYear, targetMonth, daysInTargetMonth, 23, 59, 59, 999);

      for (let day = 1; day <= daysInTargetMonth; day++) {
        const d = new Date(targetYear, targetMonth, day);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        mapBuckets.set(key, { dayLabel: `${day}`, dateStr: key, amount: 0 });
      }
    } else if (range === "3m") {
      // ภาพรวม 3 เดือนล่าสุด: แสดงแท่งรายเดือนของ 3 เดือนล่าสุด
      const startY = now.getMonth() - 2 < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const startM = (now.getMonth() - 2 + 12) % 12;
      startDate = new Date(startY, startM, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      for (let offset = 2; offset >= 0; offset--) {
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const key = `${yyyy}-${mm}`;
        const monthLabel = `${thaiMonths[d.getMonth()]} ${yyyy}`;
        mapBuckets.set(key, {
          dayLabel: monthLabel,
          dateStr: `${thaiFullMonths[d.getMonth()]} ${yyyy}`,
          amount: 0,
        });
      }
    } else {
      // Fallback 7d
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        mapBuckets.set(key, { dayLabel: thaiDays[d.getDay()], dateStr: key, amount: 0 });
      }
    }

    const itemAgg: Record<string, { name: string; qty: number; revenue: number }> = {};
    let totalRevenue = 0;
    let totalOrdersCount = 0;

    for (const o of allOrders) {
      if (o.status === "cancelled") continue;
      const orderDate = new Date(o.createdAt);
      if (orderDate < startDate || orderDate > endDate) continue;

      totalOrdersCount++;
      const amt = Number(o.totalAmount) || 0;
      totalRevenue += amt;

      let key: string;
      if (range === "3m") {
        const yyyy = orderDate.getFullYear();
        const mm = String(orderDate.getMonth() + 1).padStart(2, "0");
        key = `${yyyy}-${mm}`;
      } else {
        const yyyy = orderDate.getFullYear();
        const mm = String(orderDate.getMonth() + 1).padStart(2, "0");
        const dd = String(orderDate.getDate()).padStart(2, "0");
        key = `${yyyy}-${mm}-${dd}`;
      }

      const entry = mapBuckets.get(key);
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

    const salesArray = Array.from(mapBuckets.values());
    const maxAmount = Math.max(...salesArray.map((d) => d.amount), 1);

    const salesFormatted = salesArray.map((d) => ({
      day: d.dayLabel,
      dateStr: d.dateStr,
      amount: `฿${d.amount.toLocaleString("th-TH")}`,
      rawAmount: d.amount,
      heightPct: Math.round((d.amount / maxAmount) * 100),
      highlight: d.amount === maxAmount && d.amount > 0,
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
        dailySales: salesFormatted,
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
