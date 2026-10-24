"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/db";
import { stores, staff, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, getAccessForUser, AccessError } from "@/lib/auth";
import { DEFAULT_STORE_CATEGORIES } from "@/utils/store";
import { validateImageUrl } from "@/utils/supabase/storage";
import { lockAccount } from "@/lib/account-lock";

export interface CreateStoreInput {
  name: string;
  slug: string;
  promptpayNumber?: string | null;
  openingTime?: string;
  closingTime?: string;
  logoUrl?: string | null;
}

/**
 * Initiates Google OAuth; the callback resolves the role from current store records.
 */
export async function signInWithGoogleOwner() {
  const supabase = await createClient();
  const headersList = await headers();
  const rawHost =
    headersList.get("x-forwarded-host") ||
    headersList.get("host") ||
    "localhost:3000";
  const host = rawHost.replace("0.0.0.0", "localhost");
  const proto =
    headersList.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "development" ? "http" : "https");
  const origin = `${proto}://${host}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    console.error("Google OAuth initiation error:", error);
    return { success: false, error: error.message };
  }

  if (data?.url) {
    redirect(data.url);
  }

  return { success: false, error: "Failed to generate OAuth redirect URL" };
}

/**
 * Signs out store owner and clears session cookies
 */
export async function signOutOwner() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Sign out error:", error);
  }
  redirect("/owner/login");
}

/**
 * Queries current owner store details via Drizzle ORM based on auth.uid()
 */
export async function getCurrentOwnerStore() {
  const user = await requireUser();
  const access = await getAccessForUser(user);
  if (access && access.role !== "owner") throw new AccessError("เฉพาะเจ้าของร้านเท่านั้น");
  return { user, store: access?.store ?? null, staffRole: access ? "เจ้าของร้าน" : null };
}

/**
 * Checks if a store URL slug is available
 */
export async function checkSlugAvailability(slug: string) {
  try {
    const cleanSlug = slug
      .trim()
      .toLowerCase()
      .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!cleanSlug) {
      return { available: false, error: "Slug cannot be empty", slug: "" };
    }

    const existing = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.slug, cleanSlug))
      .limit(1);

    return { available: existing.length === 0, slug: cleanSlug };
  } catch (error) {
    console.error("checkSlugAvailability error:", error);
    return { available: false, error: "Failed to verify slug availability", slug };
  }
}

/**
 * Server action handling store creation form at /owner/onboarding
 * Validates input, inserts store & owner staff record using pure Drizzle ORM
 */
export async function createStoreOnboarding(data: FormData | CreateStoreInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "กรุณาเข้าสู่ระบบก่อนสร้างร้านค้า (Unauthorized)",
      };
    }

    const access = await getAccessForUser(user);
    if (access && access.role !== "owner") throw new AccessError("บัญชีพนักงานไม่สามารถสร้างร้านได้");

    // Extract fields based on whether data is FormData or CreateStoreInput object
    let name = "";
    let rawSlug = "";
    let promptpayNumber: string | null = null;
    let openingTime = "08:00";
    let closingTime = "18:00";
    let logoUrl: string | null = null;

    if (data instanceof FormData) {
      name = (data.get("name") as string) || "";
      rawSlug = (data.get("slug") as string) || "";
      promptpayNumber = (data.get("promptpayNumber") as string) || null;
      openingTime = (data.get("openingTime") as string) || "08:00";
      closingTime = (data.get("closingTime") as string) || "18:00";
      logoUrl = (data.get("logoUrl") as string) || null;
    } else {
      name = data.name || "";
      rawSlug = data.slug || "";
      promptpayNumber = data.promptpayNumber || null;
      openingTime = data.openingTime || "08:00";
      closingTime = data.closingTime || "18:00";
      logoUrl = data.logoUrl || null;
    }

    if (!name.trim()) {
      return { success: false, error: "กรุณาระบุชื่อร้านค้า" };
    }

    // Check if user already owns a store
    const existingUserStores = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.ownerId, user.id))
      .limit(1);

    if (existingUserStores.length > 0) {
      return {
        success: false,
        error: "คุณได้สร้างร้านค้าไปแล้ว กำลังนำทางสู่แดชบอร์ด...",
        redirectUrl: "/owner/dashboard",
      };
    }

    // Sanitize and validate slug
    let slug = rawSlug
      .trim()
      .toLowerCase()
      .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!slug) {
      slug = name
        .trim()
        .toLowerCase()
        .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `store-${Math.random().toString(36).substring(2, 7)}`;
    }

    // Validate uniqueness of slug
    const existingSlug = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.slug, slug))
      .limit(1);

    if (existingSlug.length > 0) {
      return {
        success: false,
        error: `URL Slug "${slug}" มีร้านอื่นใช้งานแล้ว โปรดเลือกชื่อ URL ใหม่`,
      };
    }

    logoUrl = validateImageUrl(logoUrl, "restaurant-logos", user.id);
    const newStore = await db.transaction(async (tx) => {
    // Serialize store creation with accepting a staff invitation for this account.
    await lockAccount(tx, user.id);
    if (await getAccessForUser(user, tx)) throw new AccessError("บัญชีนี้มีร้านหรือสิทธิ์พนักงานแล้ว กรุณาโหลดหน้าใหม่", 409);
    const [newStore] = await tx
      .insert(stores)
      .values({
        ownerId: user.id,
        name: name.trim(),
        slug,
        logoUrl: logoUrl?.trim() || null,
        promptPayNumber: promptpayNumber?.trim() || null,
        openingTime: openingTime?.trim() || "08:00",
        closingTime: closingTime?.trim() || "18:00",
        currency: "THB",
      })
      .returning();

    // Automatically insert initial staff record setting role = 'owner'
    const ownerEmail = user.email || `${user.id.slice(0, 8)}@owner.scansip.com`;
    const ownerName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      (user.email ? user.email.split("@")[0] : "เจ้าของร้าน");

    await tx.insert(staff).values({
      storeId: newStore.id,
      userId: user.id,
      email: ownerEmail,
      name: ownerName,
      role: "owner",
    });

    await tx.insert(categories).values(DEFAULT_STORE_CATEGORIES.map((c) => ({ ...c, storeId: newStore.id })));
    return newStore;
    });

    return {
      success: true,
      store: newStore,
      redirectUrl: "/owner/dashboard",
    };
  } catch (error: unknown) {
    console.error("createStoreOnboarding error:", error);
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการสร้างร้านค้า";
    return { success: false, error: message };
  }
}
