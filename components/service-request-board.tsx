// @refresh reset
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { REQUEST_LABELS, type CustomerRequest } from "@/lib/customer-session-view";
import { RotateCw, Volume2, VolumeX } from "lucide-react";

type StaffRequest = Pick<CustomerRequest, "id" | "kind" | "createdAt"> & { tableNumber: number };

export function playServiceBellSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, gainVal = 0.25) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(gainVal, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    // Crisp hotel frontdesk bell chime: Ding-Ding! (1568Hz G6 -> 2093Hz C7)
    playTone(1567.98, now, 0.65, 0.28);
    playTone(3135.96, now, 0.45, 0.1);
    playTone(2093.00, now + 0.15, 1.0, 0.32);
    playTone(4186.01, now + 0.15, 0.6, 0.12);
  } catch {}
}

export function ServiceRequestBoard() {
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousRequestsRef = useRef<Set<string> | null>(null);
  const working = useRef(new Set<string>()), mounted = useRef(false), version = useRef({ value: 0 });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("service_sound_enabled");
      if (saved !== null) setSoundEnabled(saved === "true");
    } catch {}
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try { localStorage.setItem("service_sound_enabled", String(next)); } catch {}
    if (next) playServiceBellSound();
  };

  const load = useCallback(async () => {
    const current = ++version.current.value;
    try {
      const response = await fetch("/api/service-requests", { cache: "no-store" });
      const result = await response.json();
      if (!mounted.current || current !== version.current.value) return;
      if (response.status === 401 || response.status === 403) setRequests([]);
      if (!response.ok || !result.success) throw new Error(result.error || "โหลดคำขอไม่สำเร็จ");
      const list = (result.data || []) as StaffRequest[];
      if (previousRequestsRef.current !== null && soundEnabled) {
        const hasNewRequest = list.some((r) => !previousRequestsRef.current!.has(r.id));
        if (hasNewRequest) {
          playServiceBellSound();
        }
      }
      previousRequestsRef.current = new Set(list.map((r) => r.id));
      setRequests(list); setError("");
    } catch (error) { if (mounted.current && current === version.current.value) setError(error instanceof Error ? error.message : "เชื่อมต่อไม่ได้ กรุณาลองใหม่"); }
    finally { if (mounted.current && current === version.current.value) setLoading(false); }
  }, [soundEnabled]);

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
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h2 className="font-bold">คำขอจากลูกค้า ({requests.length})</h2>
        <span className="flex size-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleSound}
          className={cn(
            "h-8 px-2.5 text-xs gap-1.5 cursor-pointer rounded-md transition-colors",
            soundEnabled
              ? "text-emerald-700 dark:text-emerald-300 font-semibold"
              : "text-muted-foreground"
          )}
          title={soundEnabled ? "เปิดเสียงเตือนเรียกพนักงานอยู่ (คลิกเพื่อปิด)" : "ปิดเสียงเตือนอยู่ (คลิกเพื่อเปิด)"}
        >
          {soundEnabled ? <Volume2 className="size-3.5 text-emerald-600 dark:text-emerald-400" /> : <VolumeX className="size-3.5 text-muted-foreground" />}
          <span>{soundEnabled ? "เสียงเตือน" : "ปิดเสียง"}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 rounded-lg cursor-pointer transition-colors"
          disabled={busy.length > 0}
          onClick={() => void load()}
          title="อัปเดตคำขอ"
          aria-label="อัปเดตคำขอ"
        >
          <RotateCw className="size-3.5" />
        </Button>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">อัปเดตทุก 5 วินาที · กดดำเนินการแล้วหลังช่วยลูกค้า รับเงินจากหน้าบิลและปิดโต๊ะจากผังโต๊ะ</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <p role="status" className="text-sm">กำลังโหลดคำขอ…</p> : !error && !requests.length ? <p className="text-sm text-muted-foreground">ไม่มีคำขอที่รออยู่</p> : null}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {requests.map((request) => {
        const isBill = request.kind === "bill";
        return (
          <div
            key={request.id}
            className={cn(
              "space-y-2.5 rounded-xl border p-4 shadow-xs transition-all animate-in fade-in-50 zoom-in-95 duration-200 relative overflow-hidden",
              isBill
                ? "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20"
                : "border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <span className="relative flex size-2">
                  <span
                    className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      isBill ? "bg-emerald-400" : "bg-amber-400"
                    )}
                  ></span>
                  <span
                    className={cn(
                      "relative inline-flex rounded-full size-2",
                      isBill ? "bg-emerald-500" : "bg-amber-500"
                    )}
                  ></span>
                </span>
                โต๊ะ {request.tableNumber} · {REQUEST_LABELS[request.kind]}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-semibold py-0.5 px-2",
                  isBill
                    ? "border-emerald-300 bg-emerald-100/60 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "border-amber-300 bg-amber-100/60 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                )}
              >
                {isBill ? "เช็กบิล" : "เรียกบริการ"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(request.createdAt).toLocaleTimeString("th-TH", {
                timeZone: "Asia/Bangkok",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <Button
              className="min-h-11 w-full font-medium active:scale-[0.99] transition-transform shadow-xs"
              disabled={busy.includes(request.id)}
              onClick={() => void resolve(request.id)}
            >
              {busy.includes(request.id) ? "กำลังบันทึก…" : "ดำเนินการแล้ว"}
            </Button>
          </div>
        );
      })}
    </div>
  </section>;
}
