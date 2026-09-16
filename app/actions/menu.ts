"use server";

import { db } from "@/db";
import { menuItems, staff } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Extracts the relative file path from a Supabase Storage public URL or relative path.
 * Supports:
 * - Full Supabase URLs: "https://.../storage/v1/object/public/menu-photos/items/menu_123.jpg" -> "items/menu_123.jpg"
 * - Custom store paths: "store_id/filename.png" -> "store_id/filename.png"
 * - Leading slashes / prefixes: "/menu-photos/store_123/item.png" -> "store_123/item.png"
 * - Safely returns null for non-bucket external URLs (e.g. Unsplash)
 */
export async function extractStoragePath(
  url?: string | null,
  bucket = "menu-photos"
): Promise<string | null> {
  if (!url || typeof url !== "string") return null;

  try {
    let cleanUrl = url.trim();
    if (!cleanUrl) return null;

    // Strip query strings or hash (?t=... #...)
    cleanUrl = cleanUrl.split("?")[0].split("#")[0];

    const bucketMarker = `${bucket}/`;
    const markerIndex = cleanUrl.indexOf(bucketMarker);
    if (markerIndex !== -1) {
      const pathPart = cleanUrl.substring(markerIndex + bucketMarker.length);
      return decodeURIComponent(pathPart).replace(/^\/+/, "").trim() || null;
    }

    // If it's an external URL that doesn't contain the bucket, skip deletion
    if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
      return null;
    }

    // If it's already a relative path inside bucket (e.g., store_id/filename.png or items/filename.png)
    return decodeURIComponent(cleanUrl).replace(/^\/+/, "").trim() || null;
  } catch (error) {
    console.error("Failed to parse storage URL:", error);
    return null;
  }
}

/**
 * Deletes a menu item and automatically cleans up its associated photo in Supabase Storage.
 *
 * Secure Approach:
 * 1. Verify Ownership: Authenticate user and confirm they own the store.
 * 2. Fetch Menu Record: Query menu_items using Drizzle ORM to get photoUrl.
 * 3. Delete Image from Storage:
 *    - Extract relative path inside bucket from photoUrl (e.g. store_id/filename.png — strip domains or leading slashes).
 *    - Instantiate const supabaseAdmin = createAdminClient().
 *    - Call await supabaseAdmin.storage.from('menu-photos').remove([filePath]).
 * 4. Delete DB Record: Delete the record from menu_items table via Drizzle ORM.
 * 5. Revalidate: Call revalidatePath('/owner/menu').
 */
export async function deleteMenuItem(menuItemId: string) {
  try {
    if (!menuItemId) {
      return { success: false, error: "Menu item ID is required" };
    }

    // 1. Verify Ownership: Authenticate the user
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "กรุณาเข้าสู่ระบบก่อนทำรายการ (Unauthorized)",
      };
    }

    // 2. Fetch Menu Record: Query menu_items using Drizzle ORM to get photoUrl and store details
    const existingItem = await db.query.menuItems.findFirst({
      where: eq(menuItems.id, menuItemId),
      with: {
        store: true,
      },
    });

    if (!existingItem) {
      return { success: false, error: "ไม่พบรายการเมนูที่ต้องการลบ" };
    }

    // Confirm the user owns the store
    let isOwner = existingItem.store?.ownerId === user.id;
    if (!isOwner) {
      // Also check if user is registered in staff with role 'owner'
      const staffMember = await db.query.staff.findFirst({
        where: and(
          eq(staff.storeId, existingItem.storeId),
          eq(staff.userId, user.id),
          eq(staff.role, "owner")
        ),
      });
      isOwner = !!staffMember;
    }

    if (!isOwner) {
      return {
        success: false,
        error: "คุณไม่มีสิทธิ์ในการลบรายการอาหารของร้านค้านี้ (Forbidden)",
      };
    }

    // 3. Delete Image from Storage:
    // Extract the relative path inside the bucket from photoUrl (e.g., store_id/filename.png — strip domains or leading slashes)
    const photoUrl = existingItem.imageUrl;
    const filePath = await extractStoragePath(photoUrl, "menu-photos");

    if (filePath) {
      try {
        const supabaseAdmin = createAdminClient();
        const { error: storageError } = await supabaseAdmin.storage
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

    // 4. Delete DB Record: Delete the record from menu_items table via Drizzle ORM
    await db.delete(menuItems).where(eq(menuItems.id, menuItemId));

    // 5. Revalidate: Call revalidatePath('/owner/menu')
    revalidatePath("/owner/menu");
    revalidatePath("/dashboard/menu");

    return { success: true, message: "ลบเมนูและรูปภาพเรียบร้อยแล้ว" };
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
 * 2. Authenticates user and verifies store ownership.
 * 3. If new image file provided:
 *    - Upload to 'menu-photos' bucket via Supabase Admin Client.
 *    - Extract and delete old image file from 'menu-photos' bucket to prevent orphan files.
 *    - Set updated photoUrl/imageUrl to new uploaded URL.
 * 4. Update `menu_items` table via Drizzle ORM.
 * 5. Revalidate cache paths.
 */
export async function updateMenuItem(menuItemId: string, formData: FormData) {
  try {
    if (!menuItemId) {
      return { success: false, error: "Menu item ID is required" };
    }

    // Verify Ownership
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "กรุณาเข้าสู่ระบบก่อนทำรายการ (Unauthorized)",
      };
    }

    // 1. Fetch existing item with store details
    const existingItem = await db.query.menuItems.findFirst({
      where: eq(menuItems.id, menuItemId),
      with: {
        store: true,
      },
    });

    if (!existingItem) {
      return { success: false, error: "Menu item not found" };
    }

    let isOwner = existingItem.store?.ownerId === user.id;
    if (!isOwner) {
      const staffMember = await db.query.staff.findFirst({
        where: and(
          eq(staff.storeId, existingItem.storeId),
          eq(staff.userId, user.id),
          eq(staff.role, "owner")
        ),
      });
      isOwner = !!staffMember;
    }

    if (!isOwner) {
      return {
        success: false,
        error: "คุณไม่มีสิทธิ์ในการแก้ไขรายการอาหารของร้านค้านี้ (Forbidden)",
      };
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
      const supabaseAdmin = createAdminClient();

      // Create unique filename
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `menu_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}.${ext}`;
      const filePath = `items/${fileName}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Upload new image to 'menu-photos' bucket
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
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
      const { data: publicUrlData } = supabaseAdmin.storage
        .from("menu-photos")
        .getPublicUrl(uploadData.path);

      finalImageUrl = publicUrlData.publicUrl;

      // Extract and delete old image file from 'menu-photos' bucket to prevent orphan files
      const oldFilePath = await extractStoragePath(
        existingItem.imageUrl,
        "menu-photos"
      );
      if (oldFilePath && oldFilePath !== filePath) {
        try {
          const { error: removeError } = await supabaseAdmin.storage
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
      const oldFilePath = await extractStoragePath(
        existingItem.imageUrl,
        "menu-photos"
      );
      if (oldFilePath) {
        try {
          const supabaseAdmin = createAdminClient();
          await supabaseAdmin.storage.from("menu-photos").remove([oldFilePath]);
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

    // 4. Update menu_items table via Drizzle ORM
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

    // 5. Revalidate cache paths
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
