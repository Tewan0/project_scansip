"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { Restaurant } from "@/types/database";

/**
 * Initiates the Google OAuth sign-in flow for cafe owners.
 * Configures the callback to /auth/callback?role=owner.
 */
export async function signInWithGoogleOwner(): Promise<void> {
  let authUrl: string | null = null;

  try {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
    const proto = headerStore.get("x-forwarded-proto") || "http";
    const origin =
      headerStore.get("origin") ||
      (host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?role=owner`,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (error) {
      console.error("Google OAuth error in signInWithGoogleOwner:", error.message);
      throw new Error(`Failed to initialize Google Sign In: ${error.message}`);
    }

    if (data?.url) {
      authUrl = data.url;
    }
  } catch (error) {
    console.error("Error initiating owner Google login:", error);
    throw error;
  }

  if (authUrl) {
    redirect(authUrl);
  }
}

/**
 * Signs out the current owner, clearing all Supabase session cookies,
 * and deterministically redirects to /owner/login.
 */
export async function signOutOwner(): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign-out error in signOutOwner:", error.message);
    }
  } catch (error) {
    console.error("Unexpected error during owner sign-out:", error);
  }

  redirect("/owner/login");
}

/**
 * Retrieves the restaurant record for the currently authenticated owner.
 * Returns null if the user is unauthenticated or has not yet registered a restaurant.
 */
export async function checkOwnerRestaurant(): Promise<Restaurant | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const { data: restaurant, error: dbError } = await supabase
      .from("restaurants")
      .select("*")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (dbError) {
      console.error("Database error querying owner restaurant:", dbError.message);
      return null;
    }

    return restaurant;
  } catch (error) {
    console.error("Unexpected error in checkOwnerRestaurant:", error);
    return null;
  }
}

/**
 * Registers a new restaurant profile linked to the authenticated owner.
 * Redirects to /owner/dashboard upon successful completion.
 */
export async function registerRestaurantAction(
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "User is not authenticated. Please log in again." };
    }

    const name = (formData.get("name") as string)?.trim();
    const promptpayNumber = (formData.get("promptpay_number") as string)?.trim() || null;
    const logoUrl = (formData.get("logo_url") as string)?.trim() || null;

    if (!name) {
      return { error: "Restaurant name is required." };
    }

    const { error: insertError } = await supabase.from("restaurants").insert({
      owner_user_id: user.id,
      name,
      promptpay_number: promptpayNumber,
      logo_url: logoUrl,
    });

    if (insertError) {
      console.error("Error inserting restaurant:", insertError.message);
      return { error: `Failed to register restaurant: ${insertError.message}` };
    }
  } catch (error) {
    console.error("Unexpected error in registerRestaurantAction:", error);
    return { error: "An unexpected error occurred while registering your restaurant." };
  }

  redirect("/owner/dashboard");
}
