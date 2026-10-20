import { NextResponse } from "next/server";
import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getStoreBySlugOrId } from "@/utils/store";
import { requireStoreAccess, apiError, AccessError } from "@/lib/auth";
import { validateCategory, validateName, validatePrice } from "@/lib/menu-validation";
import { validateImageUrl } from "@/utils/supabase/storage";

export async function GET(req: Request) {
  try {
    const storeParam = new URL(req.url).searchParams.get("store");
    const store = storeParam ? await getStoreBySlugOrId(storeParam) : (await requireStoreAccess(["owner"])).store;
    if (!store) throw new AccessError("ไม่พบร้านค้า", 404);
    const items = await db.query.menuItems.findMany({
      where: eq(menuItems.storeId, store.id), with: { category: true }, orderBy: [desc(menuItems.createdAt)],
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) { return apiError(error); }
}

export async function POST(req: Request) {
  try {
    const { store, user } = await requireStoreAccess(["owner"]);
    const body = await req.json();
    const categoryId = await validateCategory(body.categoryId, store.id);
    if (body.isAvailable !== undefined && typeof body.isAvailable !== "boolean") throw new AccessError("สถานะเมนูไม่ถูกต้อง", 400);
    const [item] = await db.insert(menuItems).values({
      storeId: store.id, name: validateName(body.name), price: validatePrice(body.price), categoryId,
      description: typeof body.description === "string" ? body.description.trim() : null,
      imageUrl: validateImageUrl(body.imageUrl, "menu-photos", user.id),
      isAvailable: body.isAvailable ?? true,
    }).returning();
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) { return apiError(error); }
}
