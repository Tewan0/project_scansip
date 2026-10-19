import { NextResponse } from "next/server";
import { db } from "@/db";
import { tables, stores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getOrCreateStore, getStoreBySlugOrId } from "@/utils/store";
import crypto from "crypto";

// GET /api/tables - ดึงรายชื่อโต๊ะทั้งหมดของร้าน พร้อม Session Token ปัจจุบัน
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeSlug = searchParams.get("store");

    let store;
    if (storeSlug) {
      store = await getStoreBySlugOrId(storeSlug);
    } else {
      store = await getOrCreateStore();
    }

    if (!store) {
      return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
    }

    const tableList = await db.query.tables.findMany({
      where: eq(tables.storeId, store.id),
      orderBy: (tables, { asc }) => [asc(tables.tableNumber)],
    });

    return NextResponse.json({ success: true, data: tableList, store });
  } catch (err: unknown) {
    console.error("GET /api/tables error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch tables" }, { status: 500 });
  }
}

// POST /api/tables - สร้างโต๊ะใหม่ หรือ เปิด/ปิด Session โต๊ะ
// Body actions:
// 1. { action: "open_session", tableNumber: 5 }
// 2. { action: "close_session", tableNumber: 5 }
// 3. { action: "sync_tables", count: 10 }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, tableNumber, count, storeSlug } = body;

    let store;
    if (storeSlug) {
      store = await getStoreBySlugOrId(storeSlug);
    } else {
      store = await getOrCreateStore();
    }

    if (!store) {
      return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
    }

    // 1. เปิดโต๊ะอาหาร (สร้าง Session Token ใหม่เฉพาะรอบบิลนี้)
    if (action === "open_session") {
      if (!tableNumber) {
        return NextResponse.json({ success: false, error: "Missing tableNumber" }, { status: 400 });
      }

      // หาโต๊ะนี้ ถ้ายังไม่มีให้สร้างอัตโนมัติ
      let [existingTable] = await db
        .select()
        .from(tables)
        .where(and(eq(tables.storeId, store.id), eq(tables.tableNumber, Number(tableNumber))))
        .limit(1);

      const newToken = "tk_" + crypto.randomBytes(4).toString("hex");

      if (existingTable) {
        const [updated] = await db
          .update(tables)
          .set({
            status: "occupied",
            currentSessionToken: newToken,
            sessionStartedAt: new Date(),
          })
          .where(eq(tables.id, existingTable.id))
          .returning();
        return NextResponse.json({ success: true, data: updated });
      } else {
        const [created] = await db
          .insert(tables)
          .values({
            storeId: store.id,
            tableNumber: Number(tableNumber),
            status: "occupied",
            currentSessionToken: newToken,
            sessionStartedAt: new Date(),
          })
          .returning();
        return NextResponse.json({ success: true, data: created });
      }
    }

    // 2. ปิดโต๊ะอาหาร / เช็คบิล (ทำให้ Token เดิมหมดอายุทันที ป้องกันการแอบสั่ง)
    if (action === "close_session") {
      if (!tableNumber) {
        return NextResponse.json({ success: false, error: "Missing tableNumber" }, { status: 400 });
      }

      const [updated] = await db
        .update(tables)
        .set({
          status: "available",
          currentSessionToken: null,
          sessionStartedAt: null,
        })
        .where(and(eq(tables.storeId, store.id), eq(tables.tableNumber, Number(tableNumber))))
        .returning();

      return NextResponse.json({ success: true, data: updated });
    }

    // 3. กำหนดจำนวนโต๊ะทั้งหมดของร้าน (Sync tables)
    if (action === "sync_tables") {
      const targetCount = Math.max(1, Math.min(50, Number(count) || 6));
      for (let i = 1; i <= targetCount; i++) {
        const existing = await db
          .select({ id: tables.id })
          .from(tables)
          .where(and(eq(tables.storeId, store.id), eq(tables.tableNumber, i)))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(tables).values({
            storeId: store.id,
            tableNumber: i,
            status: "available",
          });
        }
      }

      const all = await db.query.tables.findMany({
        where: eq(tables.storeId, store.id),
        orderBy: (tables, { asc }) => [asc(tables.tableNumber)],
      });

      return NextResponse.json({ success: true, data: all });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("POST /api/tables error:", err);
    return NextResponse.json({ success: false, error: "Failed to process table action" }, { status: 500 });
  }
}
