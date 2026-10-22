import { NextResponse } from "next/server";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireStoreAccess, requireUser, getAccessForUser, AccessError, apiError } from "@/lib/auth";
import { createStoreOnboarding } from "@/app/actions/owner-auth";
import { validateStoreSettings } from "@/lib/store-validation";
import { deleteStorageFile, validateImageUrl } from "@/utils/supabase/storage";

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
      return NextResponse.json({ success: true, data: { id: foundStore.id, name: foundStore.name, slug: foundStore.slug, logoUrl: foundStore.logoUrl, openingTime: foundStore.openingTime, closingTime: foundStore.closingTime, currency: foundStore.currency, promptPayNumber: foundStore.promptPayNumber } });
    }

    const { store } = await requireStoreAccess(["owner"]);
    return NextResponse.json({ success: true, data: store });
  } catch (error) { return apiError(error); }
}

// POST /api/store - สร้างร้านค้าใหม่ (สำหรับ Onboarding ร้านค้าใหม่)
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const access = await getAccessForUser(user);
    if (access && access.role !== "owner") throw new AccessError("บัญชีพนักงานไม่สามารถสร้างร้านได้");
    if (access) return NextResponse.json({ success: true, data: access.store });
    const body = await req.json();
    const result = await createStoreOnboarding({ name: body.name, slug: body.slug || "", promptpayNumber: body.promptPayNumber, openingTime: body.openingTime, closingTime: body.closingTime });
    if (!result.success) throw new AccessError(result.error || "สร้างร้านไม่สำเร็จ", 400);
    return NextResponse.json({ success: true, data: result.store }, { status: 201 });
  } catch (error) { return apiError(error); }
}

// PUT /api/store - บันทึกการตั้งค่าร้านค้า (ชื่อร้าน, เบอร์พร้อมเพย์, เวลาเปิด-ปิด, โลโก้, slug)
export async function PUT(req: Request) {
  try {
    const { store, user } = await requireStoreAccess(["owner"]);
    const body = await req.json();
    const values = validateStoreSettings(body);
    const logoUrl = body.logoUrl === undefined ? undefined
      : validateImageUrl(body.logoUrl, "restaurant-logos", user.id, store.logoUrl);
    if (values.slug !== undefined && values.slug !== store.slug) {
      const existing = await db.query.stores.findFirst({ where: eq(stores.slug, values.slug) });
      if (existing && existing.id !== store.id) throw new AccessError("URL ร้านนี้มีผู้ใช้งานแล้ว กรุณาเลือกชื่อใหม่", 409);
    }
    // Patch supplied fields only, so saving one setting does not restore stale values.
    const [updatedStore] = await db.update(stores).set({
      ...values, ...(logoUrl !== undefined ? { logoUrl } : {}), updatedAt: new Date(),
    }).where(eq(stores.id, store.id)).returning();
    if (!updatedStore) throw new AccessError("ไม่พบร้านค้า", 404);

    // The saved record must point to the replacement before removing the old file.
    // Cleanup failure must not turn a successful settings save into a failed response.
    if (logoUrl !== undefined && store.logoUrl && store.logoUrl !== logoUrl) {
      try { await deleteStorageFile(store.logoUrl, "restaurant-logos", user.id); }
      catch (error) { console.error("Store logo cleanup failed:", error); }
    }

    return NextResponse.json({ success: true, data: updatedStore });
  } catch (error) { return apiError(error); }
}
