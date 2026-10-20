import { NextResponse } from "next/server";
import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { deleteMenuItem } from "@/app/actions/menu";
import { requireStoreAccess, apiError, AccessError } from "@/lib/auth";
import { validateCategory, validateName, validatePrice } from "@/lib/menu-validation";
import { validateImageUrl } from "@/utils/supabase/storage";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { store } = await requireStoreAccess(["owner"]);
    const { id } = await params;
    const item = await db.query.menuItems.findFirst({ where: and(eq(menuItems.id, id), eq(menuItems.storeId, store.id)), with: { category: true } });
    if (!item) throw new AccessError("ไม่พบเมนูในร้านนี้", 404);
    return NextResponse.json({ success: true, data: item });
  } catch (error) { return apiError(error); }
}
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { store, user } = await requireStoreAccess(["owner"]);
    const { id } = await params;
    const body = await req.json();
    const item = await db.query.menuItems.findFirst({ where: and(eq(menuItems.id, id), eq(menuItems.storeId, store.id)) });
    if (!item) throw new AccessError("ไม่พบเมนูในร้านนี้", 404);
    const values: Partial<typeof menuItems.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) values.name = validateName(body.name);
    if (body.price !== undefined) values.price = validatePrice(body.price);
    if (body.categoryId !== undefined) values.categoryId = await validateCategory(body.categoryId, store.id);
    if (body.description !== undefined) values.description = typeof body.description === "string" ? body.description.trim() : null;
    if (body.imageUrl !== undefined) values.imageUrl = validateImageUrl(body.imageUrl, "menu-photos", user.id, item.imageUrl);
    if (body.isAvailable !== undefined) {
      if (typeof body.isAvailable !== "boolean") throw new AccessError("สถานะเมนูไม่ถูกต้อง", 400);
      values.isAvailable = body.isAvailable;
    }
    const [updated] = await db.update(menuItems).set(values).where(and(eq(menuItems.id, id), eq(menuItems.storeId, store.id))).returning();
    return NextResponse.json({ success: true, data: updated });
  } catch (error) { return apiError(error); }
}
export async function DELETE(_req: Request, { params }: Params) {
  const result = await deleteMenuItem((await params).id);
  return NextResponse.json(result, { status: result.success ? 200 : result.status || 500 });
}
