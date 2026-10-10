import { NextResponse } from "next/server";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateStore, getCurrentUserId, generateSlug } from "@/utils/store";
import { deleteStorageFile } from "@/utils/supabase/storage";

// GET /api/store - ดึงข้อมูลร้านค้าปัจจุบัน หรือค้นหาจาก slug/id
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeParam = searchParams.get("store");

    if (storeParam) {
      const { getStoreBySlugOrId } = await import("@/utils/store");
      const foundStore = await getStoreBySlugOrId(storeParam);
      if (!foundStore) {
        return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: foundStore });
    }

    const store = await getOrCreateStore();
    return NextResponse.json({ success: true, data: store });
  } catch (error: unknown) {
    console.error("GET /api/store error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch store" }, { status: 500 });
  }
}

// POST /api/store - สร้างร้านค้าใหม่ (สำหรับ Onboarding ร้านค้าใหม่)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, promptPayNumber, openingTime = "08:00", closingTime = "18:00", currency = "THB" } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, error: "Store name is required" },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please log in first" },
        { status: 401 }
      );
    }

    // ตรวจสอบว่าผู้ใช้นี้มีร้านอยู่แล้วหรือไม่
    const existing = await db.query.stores.findFirst({
      where: eq(stores.ownerId, userId),
    });

    if (existing) {
      return NextResponse.json(
        { success: true, data: existing, message: "Store already exists" },
        { status: 200 }
      );
    }

    // สร้างร้านใหม่ของ Owner นี้
    const slug = generateSlug(name);
    const [newStore] = await db
      .insert(stores)
      .values({
        ownerId: userId,
        name: name.trim(),
        slug,
        promptPayNumber: promptPayNumber || null,
        openingTime,
        closingTime,
        currency,
      })
      .returning();

    return NextResponse.json({ success: true, data: newStore }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/store error:", error);
    return NextResponse.json({ success: false, error: "Failed to create store" }, { status: 500 });
  }
}

// PUT /api/store - บันทึกการตั้งค่าร้านค้า (ชื่อร้าน, เบอร์พร้อมเพย์, เวลาเปิด-ปิด, โลโก้, slug)
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { name, promptPayNumber, openingTime, closingTime, currency, logoUrl, slug } = body;

    const store = await getOrCreateStore();
    if (!store) {
      return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
    }

    let updatedSlug = store.slug;
    if (slug !== undefined) {
      const cleanSlug = typeof slug === "string"
        ? slug
            .trim()
            .toLowerCase()
            .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
        : "";

      if (!cleanSlug) {
        return NextResponse.json(
          { success: false, error: "URL Slug cannot be empty" },
          { status: 400 }
        );
      }

      if (cleanSlug !== store.slug) {
        const existing = await db.query.stores.findFirst({
          where: eq(stores.slug, cleanSlug),
        });
        if (existing && existing.id !== store.id) {
          return NextResponse.json(
            { success: false, error: `URL Slug "${cleanSlug}" มีผู้อื่นใช้งานแล้ว` },
            { status: 400 }
          );
        }
        updatedSlug = cleanSlug;
      }
    }

    // ลบไฟล์โลโก้เก่าออกจาก Storage ทันทีเมื่อมีการเปลี่ยนรูปหรือลบรูป
    if (logoUrl !== undefined && store.logoUrl && store.logoUrl !== logoUrl) {
      await deleteStorageFile(store.logoUrl, "restaurant-logos");
    }

    const [updatedStore] = await db
      .update(stores)
      .set({
        name: name !== undefined ? name : store.name,
        slug: updatedSlug,
        promptPayNumber: promptPayNumber !== undefined ? promptPayNumber : store.promptPayNumber,
        openingTime: openingTime !== undefined ? openingTime : store.openingTime,
        closingTime: closingTime !== undefined ? closingTime : store.closingTime,
        currency: currency !== undefined ? currency : store.currency,
        logoUrl: logoUrl !== undefined ? logoUrl : store.logoUrl,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, store.id))
      .returning();

    return NextResponse.json({ success: true, data: updatedStore });
  } catch (error: unknown) {
    console.error("PUT /api/store error:", error);
    return NextResponse.json({ success: false, error: "Failed to update store" }, { status: 500 });
  }
}
