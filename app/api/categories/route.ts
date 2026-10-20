import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getStoreBySlugOrId } from "@/utils/store";
import { requireStoreAccess, apiError, AccessError } from "@/lib/auth";
import { validateName } from "@/lib/menu-validation";

export async function GET(req: Request) {
  try {
    const storeParam = new URL(req.url).searchParams.get("store");
    const store = storeParam ? await getStoreBySlugOrId(storeParam) : (await requireStoreAccess(["owner"])).store;
    if (!store) throw new AccessError("ไม่พบร้านค้า", 404);
    const data = await db.select().from(categories).where(eq(categories.storeId, store.id)).orderBy(asc(categories.sortOrder));
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiError(error); }
}
export async function POST(req: Request) {
  try {
    const { store } = await requireStoreAccess(["owner"]);
    const body = await req.json();
    const [category] = await db.insert(categories).values({
      storeId: store.id, name: validateName(body.name), sortOrder: Number.isInteger(body.sortOrder) ? body.sortOrder : 0,
    }).returning();
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) { return apiError(error); }
}
