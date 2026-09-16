import { NextResponse } from "next/server";
import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteMenuItem } from "@/app/actions/menu";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/menu/[id] - ดึงข้อมูลเมนูตาม ID
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const item = await db.query.menuItems.findFirst({
      where: eq(menuItems.id, id),
      with: { category: true },
    });

    if (!item) {
      return NextResponse.json({ success: false, error: "Menu item not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error: unknown) {
    console.error("GET /api/menu/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch menu item" }, { status: 500 });
  }
}

// PATCH /api/menu/[id] - แก้ไขข้อมูลเมนู หรือเปิด/ปิดการจำหน่าย (Toggle Availability)
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.price !== undefined) updateData.price = String(body.price);
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId || null;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.isAvailable !== undefined) updateData.isAvailable = Boolean(body.isAvailable);

    const [updatedItem] = await db
      .update(menuItems)
      .set(updateData)
      .where(eq(menuItems.id, id))
      .returning();

    if (!updatedItem) {
      return NextResponse.json({ success: false, error: "Menu item not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedItem });
  } catch (error: unknown) {
    console.error("PATCH /api/menu/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to update menu item" }, { status: 500 });
  }
}

// DELETE /api/menu/[id] - ลบเมนู
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const result = await deleteMenuItem(id);
    if (!result.success) {
      let status = 500;
      if (result.error?.includes("not found") || result.error?.includes("ไม่พบ")) {
        status = 404;
      } else if (result.error?.includes("Unauthorized") || result.error?.includes("เข้าสู่ระบบ")) {
        status = 401;
      } else if (result.error?.includes("Forbidden") || result.error?.includes("สิทธิ์")) {
        status = 403;
      }
      return NextResponse.json(
        { success: false, error: result.error || "Failed to delete menu item" },
        { status }
      );
    }

    return NextResponse.json({ success: true, message: "Menu item deleted successfully" });
  } catch (error: unknown) {
    console.error("DELETE /api/menu/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete menu item" }, { status: 500 });
  }
}
