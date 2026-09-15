import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getOrCreateStore } from "@/utils/store";

// GET /api/orders - ดึงรายการคำสั่งซื้อทั้งหมด พร้อมรายการอาหารในออเดอร์
export async function GET() {
  try {
    const store = await getOrCreateStore();

    const allOrders = await db.query.orders.findMany({
      where: eq(orders.storeId, store.id),
      with: {
        items: true,
      },
      orderBy: [desc(orders.createdAt)],
    });

    return NextResponse.json({ success: true, data: allOrders });
  } catch (error: unknown) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch orders" }, { status: 500 });
  }
}

// POST /api/orders - สร้างคำสั่งซื้อใหม่ (ใช้เวลาลูกค้าสแกน QR แล้วกดสั่ง)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tableNumber, customerNote, items, storeId: customStoreId, storeSlug } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order must contain at least one item" },
        { status: 400 }
      );
    }

    let targetStoreId: string;
    if (storeSlug || customStoreId) {
      const { getStoreBySlugOrId } = await import("@/utils/store");
      const foundStore = await getStoreBySlugOrId(storeSlug || customStoreId);
      if (!foundStore) {
        return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
      }
      targetStoreId = foundStore.id;
    } else {
      const store = await getOrCreateStore();
      targetStoreId = store.id;
    }

    // คำนวณยอดรวม
    const totalAmount = items.reduce((sum: number, item: { unitPrice: number | string; quantity: number }) => {
      return sum + Number(item.unitPrice) * (Number(item.quantity) || 1);
    }, 0);

    // รหัสออเดอร์ เช่น #1001, #1002
    const orderNumber = `#${Math.floor(1000 + Math.random() * 9000)}`;

    // สร้าง Order
    const [newOrder] = await db
      .insert(orders)
      .values({
        storeId: targetStoreId,
        tableNumber: Number(tableNumber) || null,
        orderNumber,
        totalAmount: totalAmount.toFixed(2),
        customerNote: customerNote || null,
        status: "pending",
        paymentStatus: "unpaid",
      })
      .returning();

    // บันทึก Order Items ทีละรายการ
    const itemsToInsert = items.map((item: {
      menuItemId?: string;
      menuName: string;
      unitPrice: number | string;
      quantity?: number;
      specialInstruction?: string;
    }) => ({
      orderId: newOrder.id,
      menuItemId: item.menuItemId || null,
      menuName: item.menuName,
      unitPrice: String(item.unitPrice),
      quantity: Number(item.quantity) || 1,
      specialInstruction: item.specialInstruction || null,
    }));

    await db.insert(orderItems).values(itemsToInsert);

    // ดึงข้อมูลออเดอร์เต็มรูปแบบพร้อม items ส่งกลับ
    const completeOrder = await db.query.orders.findFirst({
      where: eq(orders.id, newOrder.id),
      with: { items: true },
    });

    return NextResponse.json({ success: true, data: completeOrder }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json({ success: false, error: "Failed to create order" }, { status: 500 });
  }
}
