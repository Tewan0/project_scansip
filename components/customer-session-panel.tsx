// @refresh reset
"use client";
import { CustomerOrdersSkeleton } from "@/components/loading-skeletons";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, ReceiptText, QrCode, ChevronDown } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { generatePromptPayPayload } from "@/lib/promptpay";
import { CustomerOrder, CustomerRequest, REQUEST_LABELS, ORDER_LABELS, customerItemStatus, sessionTotals } from "@/lib/customer-session-view";

export function CustomerSessionPanel({ storeSlug, tableNumber, sessionToken, enabled, refreshKey, onSessionExpired, promptPayNumber }: {
  storeSlug: string; tableNumber: string; sessionToken: string; enabled: boolean; refreshKey: number;
  onSessionExpired: () => void; promptPayNumber: string | null;
}) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const mounted = useRef(false), version = useRef({ value: 0 }), submitting = useRef(false);
  const pendingRead = useRef<number | null>(null);
  const load = useCallback(async (afterMutation = false) => {
    // Polls share a pending read; each completed mutation needs a fresh snapshot.
    if (!afterMutation && pendingRead.current === version.current.value) return;
    const current = ++version.current.value;
    pendingRead.current = current;
    try {
      const response = await fetch(`/api/customer/session?store=${encodeURIComponent(storeSlug)}&table=${encodeURIComponent(tableNumber)}`, {
        cache: "no-store", headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const result = await response.json();
      if (!mounted.current || current !== version.current.value) return;
      if (result.sessionExpired) { setOrders([]); setRequests([]); onSessionExpired(); return; }
      if (!response.ok || !result.success) throw new Error(result.error || "โหลดประวัติไม่สำเร็จ");
      setOrders(result.data.orders); setRequests(result.data.requests); setError("");
    } catch (error) {
      if (mounted.current && current === version.current.value) setError(error instanceof Error ? error.message : "เชื่อมต่อไม่ได้ ข้อมูลที่แสดงอาจยังไม่เป็นปัจจุบัน");
    } finally {
      if (pendingRead.current === current) pendingRead.current = null;
      if (mounted.current && current === version.current.value) setLoading(false);
    }
  }, [storeSlug, tableNumber, sessionToken, onSessionExpired]);

  useEffect(() => {
    const generation = version.current;
    mounted.current = true;
    if (!enabled) return () => { mounted.current = false; ++generation.value; };
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => { if (!submitting.current) void load(); }, 5000);
    return () => { mounted.current = false; ++generation.value; clearTimeout(initial); clearInterval(timer); };
  }, [enabled, refreshKey, load]);

  async function send(kind: CustomerRequest["kind"]) {
    if (!enabled || submitting.current || requests.some((request) => request.kind === kind && request.status === "pending")) return;
    submitting.current = true; ++version.current.value; setSending(true); setMessage("");
    try {
      const response = await fetch("/api/customer/requests", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeSlug, tableNumber: Number(tableNumber), sessionToken, kind }) });
      const result = await response.json();
      if (!mounted.current) return;
      if (result.sessionExpired) { onSessionExpired(); return; }
      if (!response.ok || !result.success) throw new Error(result.error || "ส่งคำขอไม่สำเร็จ");
      setRequests((previous) => [result.data, ...previous.filter((request) => request.id !== result.data.id)]);
      setMessage("แจ้งหน้าร้านแล้ว กรุณารอพนักงานสักครู่");
      await load(true);
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : "ยืนยันการส่งไม่ได้ กดอัปเดตสถานะเพื่อตรวจสอบคำขอก่อนลองอีกครั้ง");
    } finally { submitting.current = false; if (mounted.current) setSending(false); }
  }
  const totals = sessionTotals(orders);
  const hasOrders = orders.length > 0;
  const promptPayPayload = promptPayNumber && totals.unpaid > 0
    ? generatePromptPayPayload(promptPayNumber, totals.unpaid)
    : null;
  return <section aria-label="ออเดอร์และบริการของโต๊ะ" className={cn("mb-4 rounded-xl border bg-card transition-all", hasOrders ? "p-4 space-y-3" : "p-3 space-y-2.5")}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h2 className="font-bold text-sm">ออเดอร์ของโต๊ะรอบนี้</h2>
        {hasOrders ? (
          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4.5 font-normal">
            {orders.length} บิล
          </Badge>
        ) : !loading && !error ? (
          <span className="text-[11px] text-muted-foreground">(ยังไม่มีออเดอร์)</span>
        ) : null}
      </div>
      <Button
        type="button"
        className="hidden"
        disabled={!enabled || sending}
        onClick={() => void load()}
      >
        อัปเดตสถานะ
      </Button>
    </div>
    {hasOrders && <p className="text-xs text-muted-foreground">รวมรายการจากทุกคนที่ใช้ QR รอบนี้ · อัปเดตทุก 5 วินาที</p>}
    <div className="grid grid-cols-2 gap-2">
      {(["assistance", "bill"] as const).map((kind) => {
        const pending = requests.some((request) => request.kind === kind && request.status === "pending");
        return (
          <Button
            key={kind}
            type="button"
            variant={kind === "bill" ? "default" : "outline"}
            className={cn(
              "whitespace-normal transition-all",
              hasOrders ? "min-h-11" : "min-h-9 h-9 text-xs",
              pending && kind === "bill" && "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 animate-pulse",
              pending && kind === "assistance" && "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 animate-pulse"
            )}
            disabled={!enabled || sending || pending}
            onClick={() => void send(kind)}
          >
            {kind === "bill" ? <ReceiptText className="size-3.5 shrink-0" /> : <BellRing className="size-3.5 shrink-0" />}
            {pending ? (kind === "bill" ? "รอพนักงานเช็กบิล" : "เรียกพนักงานแล้ว") : REQUEST_LABELS[kind]}
          </Button>
        );
      })}
    </div>
    {hasOrders && <p className="text-xs text-muted-foreground">ขอเช็กบิลแล้ว พนักงานจะตรวจยอดและรับชำระเงินให้</p>}
    {message && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{message}</p>}
    {requests.length > 0 && <div className="space-y-1 text-xs" aria-label="สถานะคำขอ">
      {(["assistance", "bill"] as const).map((kind) => {
        const latest = requests.filter((request) => request.kind === kind).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
        return latest && <p key={kind}>{REQUEST_LABELS[kind]}: {latest.status === "pending" ? "รอพนักงาน" : "พนักงานดำเนินการแล้ว"}</p>;
      })}
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error} · กดอัปเดตสถานะเพื่อลองใหม่</p>}
    {loading ? <CustomerOrdersSkeleton /> : null}
    {orders.map((order) => <details key={order.id} open={!["completed", "cancelled"].includes(order.status)} className="rounded-lg border p-3">
      <summary className="min-h-11 cursor-pointer text-sm">
        <span className="font-semibold">{order.orderNumber}</span> · {order.deliveredAt ? "เสิร์ฟแล้ว" : ORDER_LABELS[order.status] || order.status}
        <span className="mt-1 block text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })} · ฿{Number(order.totalAmount).toFixed(2)}</span>
      </summary>
      <ul className="mt-2 space-y-3 border-t pt-3">
        {order.items.map((item) => <li key={item.id} className="space-y-1 text-sm">
          <div className="flex justify-between gap-2"><span className="min-w-0 break-words">{item.quantity} × {item.menuName}</span><span className="shrink-0">฿{(Number(item.unitPrice) * item.quantity).toFixed(2)}</span></div>
          <Badge variant="secondary">{order.deliveredAt ? "เสิร์ฟแล้ว" : customerItemStatus(order.status, item.status)}</Badge>
          {item.specialInstruction && <p className="break-words text-xs text-muted-foreground">หมายเหตุ: {item.specialInstruction}</p>}
        </li>)}
      </ul>
      {order.customerNote && <p className="mt-3 break-words text-xs text-muted-foreground">ข้อความถึงครัว: {order.customerNote}</p>}
      <p className="mt-3 text-xs">{order.status === "cancelled" ? "ไม่นับในยอดรวม" : order.paymentStatus === "paid" ? "ชำระแล้ว" : order.paymentStatus === "refunded" ? "คืนเงินแล้ว" : "ยังไม่ชำระ"}</p>
    </details>)}
    {orders.length > 0 && <div className="space-y-1 border-t pt-3 text-sm">
      <p className="flex justify-between gap-2"><span>ยอดรวมรอบโต๊ะ (ไม่รวมยกเลิก)</span><strong>฿{totals.total.toFixed(2)}</strong></p>
      <p className="flex justify-between gap-2"><span>ยอดที่ยังไม่ชำระ</span><strong>฿{totals.unpaid.toFixed(2)}</strong></p>
      {promptPayNumber && totals.unpaid > 0 && !error && !loading && (
        <details className="group pt-2">
          <summary className="flex min-h-12 cursor-pointer select-none items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 font-medium text-foreground shadow-2xs transition-all duration-200 hover:bg-primary/10 hover:border-primary/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring list-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3 min-w-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <QrCode className="size-4" />
              </span>
              <span className="flex flex-col text-left">
                <span className="font-semibold text-sm leading-tight text-foreground">
                  ชำระผ่านพร้อมเพย์
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  แตะเพื่อเปิด QR Code สแกนจ่าย
                </span>
              </span>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="hidden sm:inline-flex text-[11px] font-normal border-primary/30 text-primary bg-primary/5">
                สแกน QR
              </Badge>
              <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </div>
          </summary>
          <div className="mt-2 space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4 text-center animate-in fade-in-50 slide-in-from-top-1 duration-200">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">ตรวจยอดกับพนักงานก่อนโอน · {promptPayNumber}</p>
              <p className="text-sm font-semibold">
                ยอดที่ต้องชำระ: <span className="text-primary font-bold">฿{totals.unpaid.toFixed(2)}</span>
              </p>
            </div>
            {promptPayPayload ? (
              <div className="flex justify-center py-1">
                <div className="rounded-xl bg-white p-3 shadow-md border border-black/5 ring-1 ring-black/5">
                  <QRCodeSVG
                    value={promptPayPayload}
                    size={160}
                    level="M"
                    fgColor="#18181b"
                    bgColor="#ffffff"
                    className="size-40 mx-auto rounded-lg bg-white"
                    title="QR พร้อมเพย์สำหรับยอดที่ยังไม่ชำระ"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-destructive py-2">โหลด QR ไม่สำเร็จ กรุณาขอ QR จากพนักงาน</p>
            )}
            <p className="text-xs text-muted-foreground">เมื่อโอนแล้ว แจ้งพนักงานเพื่อตรวจสอบและยืนยันการรับเงิน</p>
          </div>
        </details>
      )}
    </div>}
  </section>;
}
