"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AlertCircle, ArrowRight, Loader2, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

type Invitation = { id: string; storeId: string; storeName: string; storeSlug: string | null; role: "cashier" | "kitchen" };

export function StaffInvitations({ email, invitations }: { email: string; invitations: Invitation[] }) {
  const busy = useRef(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(invitation: Invitation, accept: boolean) {
    if (busy.current) return;
    busy.current = true;
    setPendingId(invitation.id);
    setError(null);
    try {
      const response = await fetch("/api/staff/invitations", {
        method: accept ? "POST" : "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId: invitation.id, storeId: invitation.storeId, role: invitation.role }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "ไม่สามารถตอบรับคำเชิญได้");
      const destination = accept ? result.data?.redirectUrl : "/workspace";
      if (!["/workspace", "/frontdesk", "/kitchen"].includes(destination)) throw new Error("กรุณาโหลดหน้าใหม่เพื่อเข้าใช้งาน");
      window.location.assign(destination);
    } catch (error) {
      setError(error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่");
      busy.current = false;
      setPendingId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link href="/" className="text-xl font-semibold tracking-tight">ScanSip</Link>
        <div className="flex items-center gap-2"><ThemeToggle /><LogoutButton /></div>
      </div>
      <h1 className="text-2xl font-semibold">เลือกเข้าใช้งานร้าน</h1>
      <p className="mt-2 break-all text-sm text-muted-foreground">บัญชี {email}</p>
      <p className="mt-3 text-sm text-muted-foreground">ตรวจชื่อร้านและบทบาทก่อนยืนยัน รับเฉพาะคำเชิญจากร้านที่คุณทำงานอยู่</p>
      {error && <div role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}
      <div className="mt-6 space-y-3">
        {invitations.map(invitation => (
          <section key={invitation.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-start gap-3">
              <Store className="mt-1 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <h2 className="break-words font-semibold">{invitation.storeName}</h2>
                <p className="mt-1 break-all text-xs text-muted-foreground">project-scansip.vercel.app/r/{invitation.storeSlug || invitation.storeId}</p>
                <p className="mt-2 text-sm">บทบาท: {invitation.role === "cashier" ? "พนักงานหน้าร้าน" : "ครัว"}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={pendingId !== null} onClick={() => void respond(invitation, false)}>ปฏิเสธ</Button>
              <Button disabled={pendingId !== null} onClick={() => void respond(invitation, true)}>
                {pendingId === invitation.id ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}ยืนยันเข้าร้าน
              </Button>
            </div>
          </section>
        ))}
        {!invitations.length && <div className="rounded-xl border bg-card px-5 py-8 text-center"><Users className="mx-auto mb-3 size-6 text-muted-foreground" /><p className="font-medium">ยังไม่มีคำเชิญจากร้าน</p><p className="mt-2 text-sm text-muted-foreground">ให้เจ้าของร้านเพิ่มอีเมลบัญชีนี้ในหน้าจัดการพนักงาน แล้วกดโหลดใหม่</p></div>}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <Button variant="outline" disabled={pendingId !== null} onClick={() => window.location.reload()}>โหลดใหม่</Button>
        <Link href="/owner/onboarding" className="text-sm underline underline-offset-4">ฉันเป็นเจ้าของร้าน ต้องการสร้างร้านใหม่</Link>
      </div>
    </main>
  );
}
