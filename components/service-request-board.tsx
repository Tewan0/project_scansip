// @refresh reset
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { REQUEST_LABELS, type CustomerRequest } from "@/lib/customer-session-view";
type StaffRequest = Pick<CustomerRequest, "id" | "kind" | "createdAt"> & { tableNumber: number };

export function ServiceRequestBoard() {
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string[]>([]);
  const working = useRef(new Set<string>()), mounted = useRef(false), version = useRef({ value: 0 });
  const load = useCallback(async () => {
    const current = ++version.current.value;
    try {
      const response = await fetch("/api/service-requests", { cache: "no-store" });
      const result = await response.json();
      if (!mounted.current || current !== version.current.value) return;
      if (response.status === 401 || response.status === 403) setRequests([]);
      if (!response.ok || !result.success) throw new Error(result.error || "โหลดคำขอไม่สำเร็จ");
      setRequests(result.data); setError("");
    } catch (error) { if (mounted.current && current === version.current.value) setError(error instanceof Error ? error.message : "เชื่อมต่อไม่ได้ กรุณาลองใหม่"); }
    finally { if (mounted.current && current === version.current.value) setLoading(false); }
  }, []);
  useEffect(() => {
    const generation = version.current;
    mounted.current = true;
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => { if (!working.current.size) void load(); }, 5000);
    return () => { mounted.current = false; ++generation.value; clearTimeout(initial); clearInterval(timer); };
  }, [load]);
  async function resolve(id: string) {
    if (working.current.has(id)) return;
    working.current.add(id); setBusy([...working.current]); ++version.current.value;
    try {
      const response = await fetch(`/api/service-requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "resolved" }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      await load();
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่"); }
    finally { working.current.delete(id); if (mounted.current) setBusy([...working.current]); }
  }
  return <section aria-label="คำขอจากลูกค้า" className="space-y-3 rounded-xl border border-primary/30 bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">คำขอจากลูกค้า ({requests.length})</h2><Button variant="outline" className="min-h-11" disabled={busy.length > 0} onClick={() => void load()}>อัปเดตคำขอ</Button></div>
    <p className="text-xs text-muted-foreground">อัปเดตทุก 5 วินาที · กดดำเนินการแล้วหลังช่วยลูกค้า รับเงินจากหน้าบิลและปิดโต๊ะจากผังโต๊ะ</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <p role="status" className="text-sm">กำลังโหลดคำขอ…</p> : !error && !requests.length ? <p className="text-sm text-muted-foreground">ไม่มีคำขอที่รออยู่</p> : null}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{requests.map((request) => <div key={request.id} className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="font-semibold">โต๊ะ {request.tableNumber} · {REQUEST_LABELS[request.kind]}</p>
      <p className="text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })}</p>
      <Button className="min-h-11 w-full" disabled={busy.includes(request.id)} onClick={() => void resolve(request.id)}>{busy.includes(request.id) ? "กำลังบันทึก…" : "ดำเนินการแล้ว"}</Button>
    </div>)}</div>
  </section>;
}
