import { NextResponse } from "next/server";
import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getOrCreateStore } from "@/utils/store";

// GET /api/menu - ดึงรายการเมนูทั้งหมด พร้อมข้อมูลหมวดหมู่
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeParam = searchParams.get("store");

    let storeId: string;
    if (storeParam) {
      const { getStoreBySlugOrId } = await import("@/utils/store");
      const foundStore = await getStoreBySlugOrId(storeParam);
      if (!foundStore) {
        return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
      }
      storeId = foundStore.id;
    } else {
      const store = await getOrCreateStore();
      storeId = store.id;
    }

    const items = await db.query.menuItems.findMany({
      where: eq(menuItems.storeId, storeId),
      with: {
        category: true,
      },
      orderBy: [desc(menuItems.createdAt)],
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error: unknown) {
    console.error("GET /api/menu error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch menu items" },
      { status: 500 }
    );
  }
}

// POST /api/menu - เพิ่มเมนูอาหารใหม่
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, price, categoryId, imageUrl, isAvailable = true } = body;

    if (!name || !price) {
      return NextResponse.json(
        { success: false, error: "Name and Price are required" },
        { status: 400 }
      );
    }

    const store = await getOrCreateStore();

    const [newItem] = await db
      .insert(menuItems)
      .values({
        storeId: store.id,
        categoryId: categoryId || null,
        name: name.trim(),
        description: description?.trim() || null,
        price: String(price),
        imageUrl: imageUrl || null,
        isAvailable: Boolean(isAvailable),
      })
      .returning();

    return NextResponse.json({ success: true, data: newItem }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/menu error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create menu item" },
      { status: 500 }
    );
  }
}
