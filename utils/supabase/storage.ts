import { createAdminClient } from "./admin";

/**
 * Extracts the relative file path from a Supabase Storage public URL or relative path.
 */
export function extractStoragePath(
  url?: string | null,
  bucket = "restaurant-logos"
): string | null {
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

    return decodeURIComponent(cleanUrl).replace(/^\/+/, "").trim() || null;
  } catch (error) {
    console.error("Failed to parse storage URL:", error);
    return null;
  }
}

/**
 * Deletes a file from a specified Supabase Storage bucket.
 */
export async function deleteStorageFile(
  url?: string | null,
  bucket = "restaurant-logos"
): Promise<boolean> {
  if (!url) return false;
  const filePath = extractStoragePath(url, bucket);
  if (!filePath) return false;

  try {
    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.warn(
        `[deleteStorageFile] Failed to remove '${filePath}' from bucket '${bucket}':`,
        error.message
      );
      return false;
    }

    console.log(
      `[deleteStorageFile] Successfully deleted '${filePath}' from bucket '${bucket}'`
    );
    return true;
  } catch (err) {
    console.error(
      `[deleteStorageFile] Error removing '${filePath}' from bucket '${bucket}':`,
      err
    );
    return false;
  }
}
