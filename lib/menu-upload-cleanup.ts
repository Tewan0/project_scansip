import "server-only";
import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createAdminClient } from "@/utils/supabase/admin";

// Only clean a new upload after a successful read confirms no menu references it.
// A failed/ambiguous commit or verification outage must never delete a live image.
export async function cleanupFailedMenuUpload(path: string, imageUrl: string, storeId: string) {
  try {
    const referenced = await db.query.menuItems.findFirst({
      where: and(eq(menuItems.storeId, storeId), eq(menuItems.imageUrl, imageUrl)),
    });
    if (referenced) return;
    const { error } = await createAdminClient().storage.from("menu-photos").remove([path]);
    if (error) console.error("Failed menu upload cleanup failed:", error);
  } catch (error) {
    // Keep the original save error and retain the file when verification is uncertain.
    console.error("Failed menu upload retained:", error);
  }
}

