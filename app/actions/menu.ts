"use server";

import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Internal synchronous helper to extract relative file path from a Supabase Storage public URL.
 */
function getStoragePath(
  url?: string | null,
  bucket = "menu-photos"
): string | null {
  if (!url || typeof url !== "string") return null;

  try {
    const bucketMarker = `/${bucket}/`;
    const markerIndex = url.indexOf(bucketMarker);
    if (markerIndex !== -1) {
      const pathWithQuery = url.substring(markerIndex + bucketMarker.length);
      const cleanPath = pathWithQuery.split("?")[0].split("#")[0];
      return decodeURIComponent(cleanPath).trim() || null;
    }
  } catch (error) {
    console.error("Failed to parse storage URL:", error);
  }
  return null;
}

/**
 * Extracts the relative file path from a Supabase Storage public URL.
 * e.g., "https://.../storage/v1/object/public/menu-photos/store_123/item_456.png" -> "store_123/item_456.png"
 * e.g., "https://.../storage/v1/object/public/menu-photos/items/menu_123.jpg" -> "items/menu_123.jpg"
 */
export async function extractStoragePath(
  url?: string | null,
  bucket = "menu-photos"
): Promise<string | null> {
  return getStoragePath(url, bucket);
}

/**
 * Returns a Supabase client suitable for server actions.
 * Prioritizes SUPABASE_SERVICE_ROLE_KEY if present for administrative storage operations,
 * otherwise falls back to the server SSR client.
 */
async function getSupabaseClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceKey) {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(supabaseUrl, serviceKey);
  }

  try {
    const { createClient } = await import("@/utils/supabase/server");
    return await createClient();
  } catch {
    const { createClient } = await import("@supabase/supabase-js");
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
    return createClient(supabaseUrl, anonKey);
  }
}

/**
 * Deletes a menu item and automatically cleans up its associated photo in Supabase Storage.
 *
 * Logic Flow:
 * 1. Fetch menu item record from `menu_items` using Drizzle ORM to retrieve its imageUrl.
 * 2. If imageUrl exists and is hosted on Supabase Storage ('menu-photos' bucket):
 *    - Extract relative file path.
 *    - Call Supabase Storage API to remove the file.
 * 3. Delete menu item record from `menu_items` table via Drizzle ORM.
 * 4. Revalidate cache paths.
 */
export async function deleteMenuItem(menuItemId: string) {
  try {
    if (!menuItemId) {
      return { success: false, error: "Menu item ID is required" };
    }

    // 1. Fetch the menu item record from menu_items
    const existingItem = await db.query.menuItems.findFirst({
      where: eq(menuItems.id, menuItemId),
    });

    if (!existingItem) {
      return { success: false, error: "Menu item not found" };
    }

    // 2. If photoUrl/imageUrl exists and is hosted on Supabase Storage (menu-photos bucket)
    const photoUrl = existingItem.imageUrl;
    const filePath = getStoragePath(photoUrl, "menu-photos");

    if (filePath) {
      try {
        const supabase = await getSupabaseClient();
        const { error: storageError } = await supabase.storage
          .from("menu-photos")
          .remove([filePath]);

        if (storageError) {
          console.warn(
            `[deleteMenuItem] Failed to remove storage file '${filePath}':`,
            storageError.message
          );
        } else {
          console.log(
            `[deleteMenuItem] Successfully deleted storage file: ${filePath}`
          );
        }
      } catch (storageErr) {
        console.warn(
          `[deleteMenuItem] Error while deleting storage file '${filePath}':`,
          storageErr
        );
      }
    }

    // 3. Delete the menu item record from menu_items table via Drizzle ORM
    await db.delete(menuItems).where(eq(menuItems.id, menuItemId));

    // 4. Revalidate cache paths
    revalidatePath("/owner/menu");
    revalidatePath("/dashboard/menu");

    return { success: true };
  } catch (error: unknown) {
    console.error("deleteMenuItem error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete menu item";
    return { success: false, error: message };
  }
}

/**
 * Updates a menu item with new text details and optional new image file.
 * Automatically cleans up the old photo from Supabase Storage when a new one is uploaded.
 *
 * Logic Flow:
 * 1. Accepts menuItemId and formData (name, description, unitPrice, categoryId, isAvailable, new image file).
 * 2. If new image file provided:
 *    - Upload to 'menu-photos' bucket.
 *    - Extract and delete old image file from 'menu-photos' bucket to prevent orphan files.
 *    - Set updated photoUrl/imageUrl to new uploaded URL.
 * 3. Update `menu_items` table via Drizzle ORM.
 * 4. Revalidate cache paths.
 */
export async function updateMenuItem(menuItemId: string, formData: FormData) {
  try {
    if (!menuItemId) {
      return { success: false, error: "Menu item ID is required" };
    }

    // 1. Fetch existing item
    const existingItem = await db.query.menuItems.findFirst({
      where: eq(menuItems.id, menuItemId),
    });

    if (!existingItem) {
      return { success: false, error: "Menu item not found" };
    }

    // Read form data values
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const priceRaw = formData.get("unitPrice") ?? formData.get("price");
    const categoryIdRaw = formData.get("categoryId") as string | null;
    const isAvailableRaw = formData.get("isAvailable");
    const removeImage = formData.get("removeImage") === "true";

    if (!name) {
      return { success: false, error: "Name is required" };
    }

    if (priceRaw === null || priceRaw === undefined || priceRaw === "") {
      return { success: false, error: "Price is required" };
    }

    const price = String(parseFloat(String(priceRaw)));
    const categoryId =
      categoryIdRaw && categoryIdRaw !== "none" && categoryIdRaw !== ""
        ? categoryIdRaw
        : null;
    const isAvailable =
      isAvailableRaw === "true" ||
      isAvailableRaw === "on" ||
      isAvailableRaw === "1";

    // Check for uploaded image file
    const file = (formData.get("image") ||
      formData.get("file") ||
      formData.get("photo")) as File | null;

    let finalImageUrl: string | null = existingItem.imageUrl;

    if (file && file instanceof File && file.size > 0) {
      const supabase = await getSupabaseClient();

      // Create unique filename
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `menu_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}.${ext}`;
      const filePath = `items/${fileName}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Upload new image to 'menu-photos' bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("menu-photos")
        .upload(filePath, buffer, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error(
          "[updateMenuItem] Supabase storage upload error:",
          uploadError
        );
        return {
          success: false,
          error: `Failed to upload image: ${uploadError.message}`,
        };
      }

      // Get public URL of newly uploaded image
      const { data: publicUrlData } = supabase.storage
        .from("menu-photos")
        .getPublicUrl(uploadData.path);

      finalImageUrl = publicUrlData.publicUrl;

      // Extract and delete old image file from 'menu-photos' bucket to prevent orphan files
      const oldFilePath = getStoragePath(
        existingItem.imageUrl,
        "menu-photos"
      );
      if (oldFilePath && oldFilePath !== filePath) {
        try {
          const { error: removeError } = await supabase.storage
            .from("menu-photos")
            .remove([oldFilePath]);

          if (removeError) {
            console.warn(
              `[updateMenuItem] Failed to remove old storage file '${oldFilePath}':`,
              removeError.message
            );
          } else {
            console.log(
              `[updateMenuItem] Successfully removed old storage file: ${oldFilePath}`
            );
          }
        } catch (remErr) {
          console.warn(
            `[updateMenuItem] Error while deleting old storage file '${oldFilePath}':`,
            remErr
          );
        }
      }
    } else if (removeImage) {
      // User explicitly requested to remove existing image
      const oldFilePath = getStoragePath(
        existingItem.imageUrl,
        "menu-photos"
      );
      if (oldFilePath) {
        try {
          const supabase = await getSupabaseClient();
          await supabase.storage.from("menu-photos").remove([oldFilePath]);
          console.log(
            `[updateMenuItem] Successfully deleted old storage file on remove: ${oldFilePath}`
          );
        } catch (remErr) {
          console.warn(
            `[updateMenuItem] Error while deleting storage file '${oldFilePath}':`,
            remErr
          );
        }
      }
      finalImageUrl = null;
    }

    // 3. Update menu_items table via Drizzle ORM
    const [updatedItem] = await db
      .update(menuItems)
      .set({
        name,
        description,
        price,
        categoryId,
        isAvailable,
        imageUrl: finalImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(menuItems.id, menuItemId))
      .returning();

    // 4. Revalidate cache paths
    revalidatePath("/owner/menu");
    revalidatePath("/dashboard/menu");

    return { success: true, data: updatedItem };
  } catch (error: unknown) {
    console.error("updateMenuItem error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update menu item";
    return { success: false, error: message };
  }
}
