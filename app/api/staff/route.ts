import { NextResponse } from "next/server";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getOrCreateStore } from "@/utils/store";

// GET /api/staff - ดึงรายชื่อพนักงานทั้งหมดของร้าน
export async function GET() {
  try {
    const store = await getOrCreateStore();
    const staffList = await db
      .select()
      .from(staff)
      .where(eq(staff.storeId, store.id))
      .orderBy(desc(staff.createdAt));

    return NextResponse.json({ success: true, data: staffList });
  } catch (error: unknown) {
    console.error("GET /api/staff error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch staff" },
      { status: 500 }
    );
  }
}

// POST /api/staff - เพิ่มพนักงานใหม่
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, role = "cashier" } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const store = await getOrCreateStore();

    // หากไม่ระบุชื่อ ให้แปลงจาก username ของ email
    const username = email.split("@")[0].replace(/[._]/g, " ");
    const staffName =
      name ||
      username
        .split(" ")
        .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ") ||
      "พนักงานใหม่";

    const [newStaff] = await db
      .insert(staff)
      .values({
        storeId: store.id,
        email: email.trim().toLowerCase(),
        name: staffName,
        role: role as "owner" | "manager" | "cashier" | "kitchen",
      })
      .returning();

    return NextResponse.json({ success: true, data: newStaff }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/staff error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add staff" },
      { status: 500 }
    );
  }
}
