import { NextResponse } from "next/server";
import { db } from "@/db";
import { tables } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getStoreBySlugOrId } from "@/utils/store";
import { customerQrProblem, customerQrExpiresAt, QR_PROBLEM_MESSAGES } from "@/lib/customer-qr";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeSlug = searchParams.get("store"), token = searchParams.get("token");
    const tableNumber = Number(searchParams.get("table"));
    if (!storeSlug || storeSlug.length > 200 || !token || token.length > 200 || !Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 50) {
      return NextResponse.json({ success: false, valid: false, error: "กรุณาสแกน QR Code ประจำโต๊ะ" }, { status: 400, headers });
    }
    const store = await getStoreBySlugOrId(storeSlug);
    if (!store) return NextResponse.json({ success: false, valid: false, error: "ไม่พบร้านค้า" }, { status: 404, headers });
    const [table] = await db.select().from(tables)
      .where(and(eq(tables.storeId, store.id), eq(tables.tableNumber, tableNumber))).limit(1);
    const problem = customerQrProblem(table, token);
    if (problem) return NextResponse.json({ success: true, valid: false, reason: problem, message: QR_PROBLEM_MESSAGES[problem] }, { headers });
    return NextResponse.json({ success: true, valid: true, table: {
      id: table.id, tableNumber: table.tableNumber, sessionStartedAt: table.sessionStartedAt,
      qrExpiresAt: new Date(customerQrExpiresAt(table)!).toISOString(),
    } }, { headers });
  } catch {
    return NextResponse.json({ success: false, valid: false, error: "ตรวจสอบ QR ไม่สำเร็จ กรุณาลองใหม่" }, { status: 500, headers });
  }
}
