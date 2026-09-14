import { NextResponse } from "next/server";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getOrCreateStore } from "@/utils/store";

// DELETE /api/staff/[id] - ลบพนักงาน
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const store = await getOrCreateStore();

    const [deleted] = await db
      .delete(staff)
      .where(and(eq(staff.id, id), eq(staff.storeId, store.id)))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Staff not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (error: unknown) {
    console.error("DELETE /api/staff/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete staff" },
      { status: 500 }
    );
  }
}
