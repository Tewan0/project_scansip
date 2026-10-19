import { NextResponse } from "next/server";
import { db } from "@/db";
import { tables } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getOrCreateStore, getStoreBySlugOrId } from "@/utils/store";

// GET /api/tables/validate?store=...&table=...&token=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeSlug = searchParams.get("store");
    const tableNumber = Number(searchParams.get("table"));
    const token = searchParams.get("token");

    let store;
    if (storeSlug) {
      store = await getStoreBySlugOrId(storeSlug);
    } else {
      store = await getOrCreateStore();
    }

    if (!store) {
      return NextResponse.json({ success: false, valid: false, error: "Store not found" }, { status: 404 });
    }

    if (!tableNumber) {
      return NextResponse.json({ success: false, valid: false, error: "Invalid table number" }, { status: 400 });
    }

    // ค้นหาข้อมูลโต๊ะจากฐานข้อมูล
    const [targetTable] = await db
      .select()
      .from(tables)
      .where(and(eq(tables.storeId, store.id), eq(tables.tableNumber, tableNumber)))
      .limit(1);

    // ถ้ายังไม่มีโต๊ะ หรือ โต๊ะยังไม่ได้เปิด (status != 'occupied' หรือ ไม่มี token)
    if (!targetTable || targetTable.status !== "occupied" || !targetTable.currentSessionToken) {
      return NextResponse.json({
        success: true,
        valid: false,
        reason: "table_closed",
        message: "โต๊ะนี้ยังไม่ได้เปิดให้บริการ หรือเช็คบิลออกจากร้านไปแล้ว กรุณาแจ้งพนักงานเพื่อเปิดโต๊ะ",
      });
    }

    // ถ้ามี token แต่ไม่ตรงกับรอบบิลปัจจุบัน (คนถ่ายรูป QR เก่าเก็บไว้)
    if (targetTable.currentSessionToken !== token) {
      return NextResponse.json({
        success: true,
        valid: false,
        reason: "session_expired",
        message: "รหัสเซสชันของโต๊ะนี้หมดอายุแล้ว (เป็นรหัสของรอบบิลก่อนหน้า) กรุณาสแกน QR Code ใหม่จากพนักงาน",
      });
    }

    // Token ตรง และโต๊ะกำลังเปิดอยู่
    return NextResponse.json({
      success: true,
      valid: true,
      table: {
        id: targetTable.id,
        tableNumber: targetTable.tableNumber,
        sessionStartedAt: targetTable.sessionStartedAt,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/tables/validate error:", err);
    return NextResponse.json({ success: false, valid: false, error: "Internal validation error" }, { status: 500 });
  }
}
