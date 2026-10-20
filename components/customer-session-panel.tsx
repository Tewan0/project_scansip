/* eslint-disable @next/next/no-img-element */
// @refresh reset
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [qrFailed, setQrFailed] = useState(false);
  const mounted = useRef(false), version = useRef({ value: 0 }), submitting = useRef(false);
  const load = useCallback(async () => {
    const current = ++version.current.value;
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
    } finally { if (mounted.current && current === version.current.value) setLoading(false); }
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
      await load();
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : "ยืนยันการส่งไม่ได้ กดอัปเดตสถานะเพื่อตรวจสอบคำขอก่อนลองอีกครั้ง");
    } finally { submitting.current = false; if (mounted.current) setSending(false); }
  }
  const totals = sessionTotals(orders);
  return <section aria-label="ออเดอร์และบริการของโต๊ะ" className="mb-5 space-y-3 rounded-xl border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold">ออเดอร์ของโต๊ะรอบนี้</h2>
      <Button type="button" variant="outline" className="min-h-11" disabled={!enabled || sending} onClick={() => void load()}>อัปเดตสถานะ</Button>
    </div>
    <p className="text-xs text-muted-foreground">รวมรายการจากทุกคนที่ใช้ QR รอบนี้ · อัปเดตทุก 5 วินาที</p>
    <div className="grid grid-cols-2 gap-2">
      {(["assistance", "bill"] as const).map((kind) => {
        const pending = requests.some((request) => request.kind === kind && request.status === "pending");
        return <Button key={kind} type="button" variant={kind === "bill" ? "default" : "outline"} className="min-h-11 whitespace-normal" disabled={!enabled || sending || pending} onClick={() => void send(kind)}>
          {kind === "bill" ? <ReceiptText className="size-4 shrink-0" /> : <BellRing className="size-4 shrink-0" />}
          {pending ? (kind === "bill" ? "รอพนักงานเช็กบิล" : "เรียกพนักงานแล้ว") : REQUEST_LABELS[kind]}
        </Button>;
      })}
    </div>
    <p className="text-xs text-muted-foreground">ขอเช็กบิลแล้ว พนักงานจะตรวจยอดและรับชำระเงินให้</p>
    {message && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{message}</p>}
    {requests.length > 0 && <div className="space-y-1 text-xs" aria-label="สถานะคำขอ">
      {(["assistance", "bill"] as const).map((kind) => {
        const latest = requests.filter((request) => request.kind === kind).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
        return latest && <p key={kind}>{REQUEST_LABELS[kind]}: {latest.status === "pending" ? "รอพนักงาน" : "พนักงานดำเนินการแล้ว"}</p>;
      })}
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error} · กดอัปเดตสถานะเพื่อลองใหม่</p>}
    {loading ? <p role="status" className="text-sm text-muted-foreground">กำลังโหลดประวัติออเดอร์…</p> : !orders.length && !error ? <p className="py-2 text-sm text-muted-foreground">ยังไม่มีออเดอร์ในรอบนี้ เลือกเมนูแล้วส่งจากตะกร้าได้เลย</p> : null}
    {orders.map((order) => <details key={order.id} open={!["completed", "cancelled"].includes(order.status)} className="rounded-lg border p-3">
      <summary className="min-h-11 cursor-pointer text-sm">
        <span className="font-semibold">{order.orderNumber}</span> · {ORDER_LABELS[order.status] || order.status}
        <span className="mt-1 block text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })} · ฿{Number(order.totalAmount).toFixed(2)}</span>
      </summary>
      <ul className="mt-2 space-y-3 border-t pt-3">
        {order.items.map((item) => <li key={item.id} className="space-y-1 text-sm">
          <div className="flex justify-between gap-2"><span className="min-w-0 break-words">{item.quantity} × {item.menuName}</span><span className="shrink-0">฿{(Number(item.unitPrice) * item.quantity).toFixed(2)}</span></div>
          <Badge variant="secondary">{customerItemStatus(order.status, item.status)}</Badge>
          {item.specialInstruction && <p className="break-words text-xs text-muted-foreground">หมายเหตุ: {item.specialInstruction}</p>}
        </li>)}
      </ul>
      {order.customerNote && <p className="mt-3 break-words text-xs text-muted-foreground">ข้อความถึงครัว: {order.customerNote}</p>}
      <p className="mt-3 text-xs">{order.status === "cancelled" ? "ไม่นับในยอดรวม" : order.paymentStatus === "paid" ? "ชำระแล้ว" : order.paymentStatus === "refunded" ? "คืนเงินแล้ว" : "ยังไม่ชำระ"}</p>
    </details>)}
    {orders.length > 0 && <div className="space-y-1 border-t pt-3 text-sm">
      <p className="flex justify-between gap-2"><span>ยอดรวมรอบโต๊ะ (ไม่รวมยกเลิก)</span><strong>฿{totals.total.toFixed(2)}</strong></p>
      <p className="flex justify-between gap-2"><span>ยอดที่ยังไม่ชำระ</span><strong>฿{totals.unpaid.toFixed(2)}</strong></p>
      {promptPayNumber && totals.unpaid > 0 && !error && !loading && <details className="pt-2"><summary className="min-h-11 cursor-pointer">ชำระผ่านพร้อมเพย์</summary>
        <p className="text-xs text-muted-foreground">ตรวจยอดกับพนักงานก่อนโอน · {promptPayNumber}</p>
        {qrFailed ? <p className="text-sm">โหลด QR ไม่สำเร็จ กรุณาขอ QR จากพนักงาน</p> : <img className="mx-auto my-3 size-40 rounded-lg bg-white p-2" alt="QR พร้อมเพย์สำหรับยอดที่ยังไม่ชำระ" src={`https://promptpay.io/${encodeURIComponent(promptPayNumber.replace(/-/g, ""))}/${totals.unpaid.toFixed(2)}.png`} onError={() => setQrFailed(true)} />}
        <p className="text-xs text-muted-foreground">เมื่อโอนแล้ว แจ้งพนักงานเพื่อตรวจสอบและยืนยันการรับเงิน</p>
      </details>}
    </div>}
  </section>;
}
