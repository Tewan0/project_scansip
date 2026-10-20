import "server-only";
import { createAdminClient } from "./admin";
import { AccessError } from "@/lib/auth";

export function extractStoragePath(url: string | null | undefined, bucket = "restaurant-logos") {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin) return null;
    const prefix = `/storage/v1/object/public/${bucket}/`;
    if (!parsed.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
    if (path.split("/").some((part) => !part || part === "." || part === "..")) return null;
    return path;
  } catch { return null; }
}

export function validateImageUrl(value: unknown, bucket: string, ownerId: string, existing?: string | null) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new AccessError("รูปภาพไม่ถูกต้อง", 400);
  if (value === existing) return value;
  const path = extractStoragePath(value, bucket);
  if (!path?.startsWith(ownerId + "/")) throw new AccessError("กรุณาอัปโหลดรูปภาพด้วยบัญชีของร้านนี้", 400);
  return value;
}

export async function deleteStorageFile(url: string | null | undefined, bucket: string, ownerId: string) {
  const path = extractStoragePath(url, bucket);
  // Legacy shared folders are retained: never delete a path supplied by another store.
  if (!path?.startsWith(ownerId + "/")) return false;
  const { error } = await createAdminClient().storage.from(bucket).remove([path]);
  if (error) console.error("Storage cleanup failed:", error.message);
  return !error;
}
