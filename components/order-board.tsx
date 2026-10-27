"use client";
import { RefreshStatus } from "@/components/refresh-status";
import { startVisiblePolling } from "@/lib/visible-polling";
import { BOOLEAN_PREFERENCES, useStoredPreference } from "@/hooks/use-stored-preference";
import { OrderCardsSkeleton } from "@/components/loading-skeletons";
import { BillBoard } from "@/components/bill-board";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COOKING_LABELS, type CookingStatus } from "@/lib/permissions";
import { RotateCw, Volume2, VolumeX, Clock, MessageSquare, StickyNote } from "lucide-react";

type Order = {
  id: string; orderNumber: string; billNumber: string; tableNumber: number | null; status: string; createdAt: string;
  customerNote: string | null; totalAmount?: string; paymentStatus?: string;
  items: { id: string; menuName: string; quantity: number; specialInstruction: string | null; status: CookingStatus }[];
};
const labels: Record<string, string> = { pending: "รอทำ", preparing: "กำลังทำ", served: "ทำเสร็จแล้ว", completed: "ปิดออเดอร์แล้ว", cancelled: "ยกเลิกแล้ว" };

const SOUND_TYPES = ["melody", "dingdong", "marimba"] as const;
export type SoundType = typeof SOUND_TYPES[number];

export function playOrderSound(soundType: SoundType = "melody") {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, gainVal = 0.25, type: OscillatorType = "sine") => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(gainVal, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    if (soundType === "melody") {
      // 4-Note Melodic Bell Arpeggio: C5 -> E5 -> G5 -> C6 (~1.5s)
      playTone(523.25, now, 0.45, 0.22);         // C5
      playTone(659.25, now + 0.18, 0.45, 0.25);  // E5
      playTone(783.99, now + 0.36, 0.55, 0.28);  // G5
      playTone(1046.50, now + 0.58, 1.1, 0.35);  // C6
      playTone(2093.00, now + 0.58, 0.8, 0.12);  // Shimmer harmonic
    } else if (soundType === "dingdong") {
      // Double Ding-Dong: G5 -> E5, G5 -> E5 (~1.8s)
      playTone(783.99, now, 0.55, 0.32);
      playTone(659.25, now + 0.22, 0.7, 0.28);
      playTone(783.99, now + 0.75, 0.55, 0.32);
      playTone(659.25, now + 0.97, 0.9, 0.28);
    } else if (soundType === "marimba") {
      // Cheerful Marimba Roll: F5 -> A5 -> C6 -> E6 (~1.4s)
      playTone(698.46, now, 0.35, 0.3, "triangle");
      playTone(880.00, now + 0.14, 0.35, 0.32, "triangle");
      playTone(1046.50, now + 0.28, 0.45, 0.35, "triangle");
      playTone(1318.51, now + 0.45, 0.85, 0.38, "triangle");
    }
  } catch {
    // Audio autoplay restricted before user interaction
  }
}

export function OrderBoard({ mode }: { mode: "kitchen" | "frontdesk" }) {
  return mode === "frontdesk" ? <BillBoard /> : <KitchenOrderBoard />;
}

function KitchenOrderBoard() {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string[]>([]);
  const [soundPreference, setSoundPreference] = useStoredPreference("kitchen_sound_enabled", "true", BOOLEAN_PREFERENCES);
  const soundEnabled = soundPreference === "true";
  const [selectedSound, setSelectedSound] = useStoredPreference("kitchen_sound_type", "melody", SOUND_TYPES);
  const [now, setNow] = useState(() => Date.now());
  const previousOrdersRef = useRef<Set<string> | null>(null);
  const working = useRef(new Set<string>());
  const version = useRef(0);
  const mounted = useRef(false);

  const handleSoundChange = (type: SoundType) => {
    setSelectedSound(type);
    playOrderSound(type);
  };

  const pendingRead = useRef<number | null>(null);
  const load = useCallback(async (afterMutation = false) => {
    // Polls share a pending read; each completed mutation needs a fresh snapshot.
    if (!afterMutation && pendingRead.current === version.current) return;
    const request = ++version.current;
    pendingRead.current = request;
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const result = await response.json();
      if (!mounted.current || request !== version.current) return;
      if (response.status === 401 || response.status === 403) { setOrders([]); router.replace("/workspace"); return; }
      if (!response.ok || !result.success) throw new Error(result.error || "โหลดออเดอร์ไม่สำเร็จ");
      if (previousOrdersRef.current !== null && soundEnabled) {
        const hasNewOrder = (result.data as Order[]).some(
          (o) => (o.status === "pending" || o.status === "preparing") && !previousOrdersRef.current!.has(o.id)
        );
        if (hasNewOrder) {
          playOrderSound(selectedSound);
        }
      }
      previousOrdersRef.current = new Set((result.data as Order[]).map((o) => o.id));
      setNow(Date.now());
      setUpdatedAt(Date.now());
      setOrders(result.data); setError("");
    } catch (error) {
      if (mounted.current && request === version.current) setError(error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ");
    } finally {
      if (pendingRead.current === request) pendingRead.current = null;
      if (mounted.current && request === version.current) setLoading(false);
    }
  }, [router, soundEnabled, selectedSound]);
  useEffect(() => {
    mounted.current = true;
    const initial = setTimeout(() => void load(), 0);
    const stopPolling = startVisiblePolling(() => { setNow(Date.now()); if (!working.current.size) void load(); }, 8000);
    return () => { mounted.current = false; ++version.current; clearTimeout(initial); stopPolling(); };
  }, [load]);

  async function update(id: string, body: Record<string, unknown>) {
    if (working.current.has(id)) return;
    working.current.add(id); setBusy([...working.current]); ++version.current; setError("");
    try {
      const response = await fetch("/api/orders/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "เปลี่ยนสถานะไม่สำเร็จ");
      await load(true);
    } catch (error) { setError(error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ"); }
    finally { working.current.delete(id); if (mounted.current) setBusy([...working.current]); }
  }

  const visible = orders.filter((order) => filter === "active" ? ["pending", "preparing"].includes(order.status) : order.status === filter);
  visible.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return <section className="space-y-5 p-4 sm:p-6">

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">รายการอาหารสำหรับครัว</h1>
        <p className="mt-1 text-sm text-muted-foreground">แยกแต่ละครั้งที่สั่ง พร้อมเลขบิลของรอบโต๊ะ · อัปเดตทุก 8 วินาที</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-2xs">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = !soundEnabled;
              setSoundPreference(next ? "true" : "false");
              if (next) playOrderSound(selectedSound);
            }}
            className={cn(
              "h-8 px-2.5 text-xs gap-1.5 cursor-pointer rounded-md transition-colors",
              soundEnabled
                ? "text-emerald-700 dark:text-emerald-300 font-semibold"
                : "text-muted-foreground"
            )}
            title={soundEnabled ? "เปิดเสียงเตือนอยู่ (คลิกเพื่อปิด)" : "ปิดเสียงเตือนอยู่ (คลิกเพื่อเปิด)"}
          >
            {soundEnabled ? <Volume2 className="size-3.5 text-emerald-600 dark:text-emerald-400" /> : <VolumeX className="size-3.5 text-muted-foreground" />}
            <span>{soundEnabled ? "เสียงเตือน" : "ปิดเสียง"}</span>
          </Button>

          {soundEnabled && (
            <div className="flex items-center gap-1 border-l border-border pl-1.5 pr-1">
              {(
                [
                  ["melody", "กระดิ่ง 4 จังหวะ"],
                  ["dingdong", "ดิง-ดอง"],
                  ["marimba", "มาริมบา"],
                ] as const
              ).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSoundChange(type)}
                  className={cn(
                    "h-7 px-2 text-[11px] font-medium rounded-md cursor-pointer transition-all",
                    selectedSound === type
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  title={`เลือกเสียง ${label} (คลิกเพื่อฟังเสียง)`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 rounded-lg cursor-pointer transition-colors"
          disabled={busy.length > 0}
          onClick={() => void load()}
          title="อัปเดตข้อมูล"
          aria-label="อัปเดตข้อมูล"
        >
          <RotateCw className="size-3.5" />
        </Button>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      {[["active", "กำลังรอ/กำลังทำ"], ["served", "ทำเสร็จแล้ว"]].map(([value, label]) =>
        <Button key={value} variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{label}</Button>)}
    </div>
    <RefreshStatus updatedAt={updatedAt} failed={Boolean(error)} />
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {loading ? <OrderCardsSkeleton /> : visible.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">ไม่มีออเดอร์ในสถานะนี้</CardContent></Card> :
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {visible.map((order) => {
        const isPending = order.status === "pending";
        const elapsedMin = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60000));
        const isLongWait = isPending && elapsedMin >= 15;
        return (
          <Card
            key={order.id}
            className={cn(
              "relative overflow-hidden transition-all duration-200 hover:shadow-md border-border/80",
              isPending && "border-amber-500/40 shadow-xs",
              isLongWait && "border-rose-500/60 ring-1 ring-rose-500/30"
            )}
          >
            {isPending && (
              <div className={cn(
                "absolute top-0 inset-x-0 h-1",
                isLongWait ? "bg-rose-500" : "bg-amber-500"
              )} />
            )}
            <CardHeader className="pt-4 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <span>โต๊ะ {order.tableNumber ?? "—"}</span>
                </CardTitle>
                <Badge
                  variant={isPending ? "outline" : "secondary"}
                  className={cn(
                    "text-xs font-semibold",
                    isPending && "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  )}
                >
                  {labels[order.status] || order.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{order.orderNumber} · {new Date(order.createdAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })} น.</span>
                <span className={cn(
                  "font-medium",
                  isLongWait ? "text-rose-600 dark:text-rose-400 font-bold" : "text-muted-foreground"
                )}>
                  <Clock aria-hidden="true" className="mr-1 inline-block size-3.5" /> {elapsedMin < 1 ? "เมื่อสักครู่" : `รอแล้ว ${elapsedMin} นาที`}
                </span>
              </div>
              <p className="break-words text-xs font-semibold text-muted-foreground/80">บิล {order.billNumber}</p>
              {order.customerNote && (
                <div className="rounded-lg border border-amber-300/70 bg-amber-50/70 dark:border-amber-800/60 dark:bg-amber-950/40 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <span className="font-bold text-amber-700 dark:text-amber-300"><MessageSquare aria-hidden="true" className="mr-1 inline-block size-3.5" />หมายเหตุจากลูกค้า: </span>
                  <span className="font-medium">{order.customerNote}</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item) => <div key={item.id} className="space-y-2 border-b pb-3 last:border-0">
                <div className="flex items-start gap-2"><span className="shrink-0 font-bold">{item.quantity} ×</span><p className="min-w-0 break-words font-medium">{item.menuName}</p></div>
                {item.specialInstruction && (
                  <p className="break-words text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-500/10 px-2 py-1 rounded-md">
                    <StickyNote aria-hidden="true" className="mr-1 inline-block size-3" /> {item.specialInstruction}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={item.status === "ready" ? "text-sm text-emerald-700 dark:text-emerald-300 font-medium" : "text-sm text-muted-foreground"}>{COOKING_LABELS[item.status]}</span>
                  {item.status !== "ready" && <div className="flex flex-wrap gap-2">
                    {item.status === "pending" && <Button variant="outline" className="active:scale-95 transition-transform" disabled={busy.includes(order.id)} onClick={() => update(order.id, { itemId: item.id, itemStatus: "preparing" })}>เริ่มทำ</Button>}
                    <Button className="active:scale-95 transition-transform" disabled={busy.includes(order.id)} onClick={() => update(order.id, { itemId: item.id, itemStatus: "ready" })}>ทำเสร็จ</Button>
                  </div>}
                </div>
              </div>)}
            </CardContent>
            <CardFooter className="mt-auto flex-wrap justify-between gap-3">
              {order.status !== "served" ? <Button className="w-full active:scale-[0.99] transition-transform font-semibold" disabled={busy.includes(order.id)} onClick={() => update(order.id, { finishAll: true })}>{busy.includes(order.id) ? "กำลังบันทึก…" : "ทำเสร็จทั้งหมด"}</Button> : <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">พร้อมให้หน้าร้านนำไปเสิร์ฟ</p>}
            </CardFooter>
          </Card>
        );
      })}
    </div>}
  </section>;
}

