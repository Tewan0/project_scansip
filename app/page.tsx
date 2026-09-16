import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import LoginOnboarding from "./components/LoginOnboarding";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const authError = typeof params?.error === "string" ? params.error : null;
  const authCode = typeof params?.code === "string" ? params.code : null;

  // If Supabase redirected back with ?code= to the root page, forward directly to /auth/callback
  if (authCode) {
    redirect(`/auth/callback?code=${authCode}`);
  }

  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  let loggedInUser = null;
  if (isConfigured) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        loggedInUser = user;
      }
    } catch {
      loggedInUser = null;
    }
  }

  // หากผู้ใช้ล็อกอินแล้ว ตรวจสอบว่ามีร้านค้าหรือยัง
  if (loggedInUser) {
    const userStore = await db.query.stores.findFirst({
      where: eq(stores.ownerId, loggedInUser.id),
    });

    if (userStore) {
      redirect("/owner/dashboard");
    } else {
      // ผู้ใช้ใหม่ยังไม่มีร้านค้า ให้ส่งไปหน้า Onboarding ตั้งชื่อร้าน
      redirect("/owner/onboarding");
    }
  }

  return (
    <LoginOnboarding
      initialUser={null}
      authError={authError}
      isConfigured={isConfigured}
    />
  );
}
