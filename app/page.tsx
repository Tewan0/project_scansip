import { createClient } from "@/utils/supabase/server";
import GoogleSignInButton from "./components/GoogleSignInButton";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const authError = params?.error;

  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  let user = null;
  if (isConfigured) {
    try {
      const supabase = await createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      user = currentUser;
    } catch {
      // In case Supabase fails to connect or invalid keys
      user = null;
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-4">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Project ScanSIP
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            ระบบทดสอบ Supabase Google Authentication
          </p>
        </div>

        {/* Configuration Notice if not set */}
        {!isConfigured && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
            <div className="flex items-center gap-2 font-semibold text-amber-300 mb-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              ยังไม่ได้ตั้งค่า Supabase Keys
            </div>
            <p className="mb-2">
              กรุณาใส่ค่าในไฟล์{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-white">
                .env.local
              </code>
            </p>
            <pre className="bg-slate-950 p-2.5 rounded text-[11px] font-mono text-slate-300 overflow-x-auto">
              {`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...`}
            </pre>
          </div>
        )}

        {/* Callback Error Alert */}
        {authError && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
            <p className="font-semibold text-red-300 mb-0.5">
              เกิดข้อผิดพลาดในการเข้าสู่ระบบ
            </p>
            <p>Code: {String(authError)}</p>
          </div>
        )}

        {/* Logged in state */}
        {user ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 flex items-center gap-2 text-xs font-medium">
              <svg
                className="w-4 h-4 text-emerald-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>เข้าสู่ระบบด้วย Google สำเร็จเรียบร้อย!</span>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
              {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                <img
                  src={
                    user.user_metadata?.avatar_url ||
                    user.user_metadata?.picture
                  }
                  alt="Profile"
                  className="w-14 h-14 rounded-full border-2 border-indigo-400/40 object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-indigo-600/30 flex items-center justify-center font-bold text-indigo-300 text-xl">
                  {(user.email?.[0] ?? "U").toUpperCase()}
                </div>
              )}
              <div className="overflow-hidden flex-1">
                <h2 className="font-semibold text-white text-base truncate">
                  {user.user_metadata?.full_name ||
                    user.user_metadata?.name ||
                    "ผู้ใช้งาน"}
                </h2>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Google OAuth
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5 font-mono text-slate-400">
              <div className="flex justify-between">
                <span>User ID:</span>
                <span className="text-slate-300 truncate max-w-[190px]">
                  {user.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Sign In:</span>
                <span className="text-slate-300">
                  {user.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleString("th-TH")
                    : "-"}
                </span>
              </div>
            </div>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl font-medium text-sm text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all duration-200 cursor-pointer text-center"
              >
                ออกจากระบบ (Sign Out)
              </button>
            </form>
          </div>
        ) : (
          /* Not logged in state */
          <div className="flex flex-col items-center">
            <GoogleSignInButton />
            <p className="text-xs text-slate-500 text-center mt-6">
              เข้าสู่ระบบเพื่อทดสอบการเชื่อมต่อ Supabase Authentication
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
