import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { eq, desc, gte } from "drizzle-orm";
import { getOrCreateStore } from "@/utils/store";

export async function GET() {
  try {
    const store = await getOrCreateStore();

    // ดึงออเดอร์ทั้งหมดของร้าน
    const allOrders = await db.query.orders.findMany({
      where: eq(orders.storeId, store.id),
      with: {
        items: true,
      },
      orderBy: [desc(orders.createdAt)],
    });

    // กำหนดวันเริ่มต้นของวันนี้ (00:00:00)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    // คำนวณยอดขายวันนี้
    let todaySales = 0;
    let yesterdaySales = 0;
    let todayOrdersCount = 0;
    let completedOrdersCount = 0;

    // คำนวณเมนูขายดีประจำวัน (Map menuName -> count)
    const itemCounts: Record<string, number> = {};

    // คำนวณยอดขายย้อนหลัง 7 วัน สำหรับกราฟ
    // วันย้อนหลัง 7 วัน: [day-6, day-5, day-4, day-3, day-2, day-1, today]
    const daysTh = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const last7DaysData: { dateStr: string; dayLabel: string; sales: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      last7DaysData.push({
        dateStr,
        dayLabel: daysTh[d.getDay()],
        sales: 0,
      });
    }

    for (const o of allOrders) {
      const orderDate = new Date(o.createdAt);
      const amount = Number(o.totalAmount) || 0;

      // กรองเฉพาะออเดอร์ที่ไม่ถูกยกเลิก สำหรับคิดยอดขาย
      const isCountable = o.status !== "cancelled";

      if (orderDate >= startOfToday) {
        todayOrdersCount++;
        if (o.status === "completed") {
          completedOrdersCount++;
        }
        if (isCountable) {
          todaySales += amount;
          // นับเมนูขายดีวันนี้
          if (o.items && Array.isArray(o.items)) {
            for (const it of o.items) {
              itemCounts[it.menuName] = (itemCounts[it.menuName] || 0) + (it.quantity || 1);
            }
          }
        }
      } else if (orderDate >= startOfYesterday && orderDate < startOfToday) {
        if (isCountable) {
          yesterdaySales += amount;
        }
      }

      // หายอดขาย 7 วันล่าสุด
      if (isCountable) {
        const yyyy = orderDate.getFullYear();
        const mm = String(orderDate.getMonth() + 1).padStart(2, "0");
        const dd = String(orderDate.getDate()).padStart(2, "0");
        const oDateStr = `${yyyy}-${mm}-${dd}`;

        const dayEntry = last7DaysData.find((d) => d.dateStr === oDateStr);
        if (dayEntry) {
          dayEntry.sales += amount;
        }
      }
    }

    // หากไม่มีออเดอร์เลยในวันนี้ ให้เช็คเมนูขายดีตลอดกาลเป็น fallback
    if (Object.keys(itemCounts).length === 0) {
      for (const o of allOrders) {
        if (o.status !== "cancelled" && o.items) {
          for (const it of o.items) {
            itemCounts[it.menuName] = (itemCounts[it.menuName] || 0) + (it.quantity || 1);
          }
        }
      }
    }

    // เรียงหา top menu
    let topMenuName = "ยังไม่มีข้อมูล";
    let topMenuCount = 0;
    const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
    if (sortedItems.length > 0) {
      topMenuName = sortedItems[0][0];
      topMenuCount = sortedItems[0][1];
    }

    // คำนวณ % การเติบโตเทียบกับเมื่อวาน
    let growthPercent = 0;
    if (yesterdaySales > 0) {
      growthPercent = ((todaySales - yesterdaySales) / yesterdaySales) * 100;
    } else if (todaySales > 0) {
      growthPercent = 100;
    }

    // ออเดอร์ล่าสุด 5 รายการ
    const recentOrders = allOrders.slice(0, 5).map((o) => {
      // แปลงเวลาให้อ่านง่าย เช่น 5 นาทีที่แล้ว หรือ เวลา
      const diffMs = Date.now() - new Date(o.createdAt).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      let timeStr = "เมื่อสักครู่";
      if (diffMins >= 60) {
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours >= 24) {
          timeStr = `${Math.floor(diffHours / 24)} วันที่แล้ว`;
        } else {
          timeStr = `${diffHours} ชั่วโมงที่แล้ว`;
        }
      } else if (diffMins > 0) {
        timeStr = `${diffMins} นาทีที่แล้ว`;
      }

      const statusMap: Record<string, { label: string; class: string }> = {
        pending: { label: "รอดำเนินการ", class: "bg-surface-container text-on-surface" },
        preparing: { label: "กำลังเตรียม", class: "bg-amber-100 text-amber-800" },
        served: { label: "พร้อมเสิร์ฟ", class: "bg-emerald-100 text-emerald-800" },
        completed: { label: "เสร็จสิ้น", class: "bg-surface-variant text-on-surface-variant" },
        cancelled: { label: "ยกเลิก", class: "bg-rose-100 text-rose-800" },
      };

      const s = statusMap[o.status] || { label: o.status, class: "bg-surface-container text-on-surface" };

      return {
        id: o.orderNumber,
        tableNumber: o.tableNumber,
        time: timeStr,
        total: `฿${Number(o.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        status: s.label,
        statusKey: o.status,
        statusClass: s.class,
        createdAt: o.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        todaySales,
        yesterdaySales,
        growthPercent: Number(growthPercent.toFixed(1)),
        totalOrdersCount: allOrders.length,
        todayOrdersCount,
        completedOrdersCount,
        topMenu: {
          name: topMenuName,
          count: topMenuCount,
        },
        chartData: last7DaysData,
        recentOrders,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/dashboard/stats error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
