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
import { validateStoreOnboarding, validateStoreSettings } from "@/lib/store-validation";

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
    const cleanSlug = validateStoreSettings({ slug: slug ?? "" }).slug!;

    const existing = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.slug, cleanSlug))
      .limit(1);

    return { available: existing.length === 0, slug: cleanSlug };
  } catch (error) {
    console.error("checkSlugAvailability error:", error);
    return { available: false, error: error instanceof AccessError ? error.message : "ไม่สามารถตรวจสอบ URL ได้ กรุณาลองใหม่", slug: typeof slug === "string" ? slug : "" };
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

    const input = data instanceof FormData ? Object.fromEntries(data.entries()) : data;
    const { name, slug, promptPayNumber, openingTime, closingTime, logoUrl: rawLogoUrl } = validateStoreOnboarding(input);
    const logoUrl = validateImageUrl(rawLogoUrl, "restaurant-logos", user.id);

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

    const newStore = await db.transaction(async (tx) => {
    // Serialize store creation with accepting a staff invitation for this account.
    await lockAccount(tx, user.id);
    if (await getAccessForUser(user, tx)) throw new AccessError("บัญชีนี้มีร้านหรือสิทธิ์พนักงานแล้ว กรุณาโหลดหน้าใหม่", 409);
    const [newStore] = await tx
      .insert(stores)
      .values({
        ownerId: user.id,
        name,
        slug,
        logoUrl: logoUrl?.trim() || null,
        promptPayNumber,
        openingTime,
        closingTime,
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
    const message = error instanceof AccessError ? error.message : "ไม่สามารถสร้างร้านได้ กรุณาลองใหม่อีกครั้ง";
    return { success: false, error: message };
  }
}
