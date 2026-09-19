import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getOrCreateStore, DEFAULT_STORE_CATEGORIES } from "@/utils/store";

// GET /api/categories - ดึงหมวดหมู่ทั้งหมด
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

    let data = await db
      .select()
      .from(categories)
      .where(eq(categories.storeId, storeId))
      .orderBy(asc(categories.sortOrder));

    // หากร้านค้านี้ยังไม่มีหมวดหมู่ ให้สร้างหมวดหมู่เริ่มต้นอัตโนมัติ
    if (data.length === 0) {
      try {
        data = await db
          .insert(categories)
          .values(
            DEFAULT_STORE_CATEGORIES.map((c) => ({
              storeId,
              name: c.name,
              sortOrder: c.sortOrder,
            }))
          )
          .returning();
        data.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      } catch (insertErr) {
        console.error("Failed to auto-seed categories:", insertErr);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST /api/categories - เพิ่มหมวดหมู่ใหม่
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, sortOrder = 0 } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, error: "Category name is required" },
        { status: 400 }
      );
    }

    const store = await getOrCreateStore();

    const [newCategory] = await db
      .insert(categories)
      .values({
        storeId: store.id,
        name: name.trim(),
        sortOrder: Number(sortOrder) || 0,
      })
      .returning();

    return NextResponse.json({ success: true, data: newCategory }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/categories error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create category" },
      { status: 500 }
    );
  }
}
