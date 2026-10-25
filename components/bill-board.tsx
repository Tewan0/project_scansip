// @refresh reset
"use client";
import { RefreshStatus } from "@/components/refresh-status";
import { startVisiblePolling } from "@/lib/visible-polling";
import { OrderCardsSkeleton } from "@/components/loading-skeletons";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ServiceRequestBoard } from "@/components/service-request-board";
import { COOKING_LABELS } from "@/lib/permissions";
import { RotateCw } from "lucide-react";
import { type Bill, ORDER_STATUS_LABELS, formatBaht } from "@/lib/billing";
import { parseBaht, type PaymentMethod } from "@/lib/payments";

const time = (value: string | null) => value ? new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }) : "ไม่ทราบเวลา";

export function BillBoard() {
  const [cancelTarget, setCancelTarget] = useState<{ id: string; number: string; billNumber: string } | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [view, setView] = useState("current");
  const [table, setTable] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState({ current: 0, history: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentBill, setPaymentBill] = useState<Bill | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cash, setCash] = useState("");
  const [transferChecked, setTransferChecked] = useState(false);
  const receivedCents = method === "transfer" ? paymentBill?.unpaidCents ?? 0 : parseBaht(cash);
  const paymentValid = paymentBill && receivedCents !== null && receivedCents >= paymentBill.unpaidCents && (method === "cash" || transferChecked);
  const requestState = useRef({ mounted: false, version: 0, working: false });
  const load = useCallback(async () => {
    const state = requestState.current, version = ++state.version;
    try {
      const search = new URLSearchParams({ view, page: String(page), ...(table ? { table } : {}), ...(date ? { date } : {}) });
      const response = await fetch(`/api/bills?${search}`, { cache: "no-store" });
      const result = await response.json();
      if (!state.mounted || version !== state.version) return;
      if (response.status === 401 || response.status === 403) { setBills([]); router.replace("/workspace"); return; }
      if (!response.ok || !result.success) throw new Error(result.error || "โหลดบิลไม่สำเร็จ");
      setUpdatedAt(Date.now());
      setBills(result.data); setStale(false); setError(""); setCounts({ current: result.currentCount, history: result.historyCount, pages: result.pageCount });
      if (page !== result.page) setPage(result.page);
    } catch (error) { if (state.mounted && version === state.version) { setStale(true); setError(error instanceof Error ? error.message : "เชื่อมต่อไม่ได้ กรุณาลองใหม่"); } }
    finally { if (state.mounted && version === state.version) setLoading(false); }
  }, [view, page, table, date, router]);
  useEffect(() => {
    const state = requestState.current; state.mounted = true;
    const initial = setTimeout(() => { setLoading(true); setError(""); setNotice(""); setBills([]); void load(); }, 0);
    const stopPolling = startVisiblePolling(() => { if (!state.working) void load(); }, 8000);
    return () => { state.mounted = false; ++state.version; clearTimeout(initial); stopPolling(); };
  }, [load]);

  async function pay() {
    if (!paymentBill || !paymentValid || requestState.current.working) return;
    const state = requestState.current; state.working = true; ++state.version; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/bills/${paymentBill.id}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        anchorOrderId: paymentBill.anchorOrderId, expectedOrderIds: paymentBill.unpaidOrderIds, expectedTotalCents: paymentBill.unpaidCents,
        method, receivedCents,
      }) });
      const result = await response.json();
      if (!state.mounted) return;
      if (!response.ok || !result.success) {
        if (response.status === 409) { setPaymentBill(null); await load(); }
        throw new Error(result.error || "บันทึกรับเงินไม่สำเร็จ");
      }
      setNotice(`บันทึก${method === "cash" ? "เงินสด" : "เงินโอน"}บิล ${paymentBill.number} ฿${formatBaht(result.data.paidCents)} แล้ว${method === "cash" ? ` · เงินทอน ฿${formatBaht(result.data.changeCents)}` : ""}`);
      setPaymentBill(null); await load();
    } catch (error) { if (state.mounted) setError(error instanceof Error ? error.message : "ยืนยันผลรับเงินไม่ได้ กรุณาอัปเดตข้อมูลเพื่อตรวจสอบก่อนทำซ้ำ"); }
    finally { state.working = false; if (state.mounted) setBusy(false); }
  }
  async function deliver(id: string) {
    if (requestState.current.working) return;
    const state = requestState.current; state.working = true; ++state.version; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delivered: true }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "ยืนยันเสิร์ฟไม่สำเร็จ");
      await load();
      if (state.mounted) setNotice("บันทึกว่าเสิร์ฟครบออเดอร์แล้ว");
    } catch (error) { if (state.mounted) setError(error instanceof Error ? error.message : "เชื่อมต่อไม่ได้ กรุณาอัปเดตสถานะก่อนลองใหม่"); }
    finally { state.working = false; if (state.mounted) setBusy(false); }
  }
  async function cancelOrder() {
    if (!cancelTarget || !cancellationReason.trim() || cancellationReason.length > 300 || requestState.current.working) return;
    const id = cancelTarget.id;
    const state = requestState.current; state.working = true; ++state.version; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled", cancellationReason }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "ยกเลิกไม่สำเร็จ");
      if (state.mounted) { setCancelTarget(null); setCancellationReason(""); await load(); }
    } catch (error) { if (state.mounted) setError(error instanceof Error ? error.message : "ยกเลิกไม่สำเร็จ"); }
    finally { state.working = false; if (state.mounted) setBusy(false); }
  }

  return <section className="space-y-5 p-4 sm:p-6">
    {cancelTarget && <Dialog open onOpenChange={open => { if (!open && !busy) setCancelTarget(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ยกเลิกออเดอร์ {cancelTarget.number}</DialogTitle>
          <DialogDescription>บิล {cancelTarget.billNumber} · กรุณาระบุเหตุผลก่อนยืนยัน ระบบจะบันทึกผู้ดำเนินการและเวลายกเลิก</DialogDescription>
        </DialogHeader>
        <label className="space-y-2 text-sm">
          <span>เหตุผลการยกเลิก</span>
          <textarea aria-label="เหตุผลการยกเลิก" maxLength={300} rows={3} value={cancellationReason}
            disabled={busy} onChange={event => setCancellationReason(event.target.value)}
            className="w-full rounded-md border bg-background p-3" placeholder="เช่น ลูกค้าเปลี่ยนใจ หรือวัตถุดิบหมด" />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setCancelTarget(null)}>กลับ</Button>
          <Button variant="destructive" disabled={busy || !cancellationReason.trim()} onClick={() => void cancelOrder()}>
            {busy ? "กำลังยกเลิก…" : "ยืนยันยกเลิกออเดอร์"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>}
    <ServiceRequestBoard />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">บิลหน้าร้าน</h1>
        <p className="mt-1 text-sm text-muted-foreground">หนึ่งรอบเปิดโต๊ะต่อหนึ่งบิล · สั่งเพิ่มรวมในบิลเดิม · อัปเดตทุก 8 วินาที</p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/frontdesk" className="inline-flex min-h-10 items-center rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted transition-colors">ผังโต๊ะ / ปิดโต๊ะ</Link>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-lg cursor-pointer transition-colors"
          disabled={busy}
          onClick={() => { setError(""); void load(); }}
          title="อัปเดตบิล"
          aria-label="อัปเดตบิล"
        >
          <RotateCw className="size-4" />
        </Button>
      </div>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="ประเภทบิล">
      <Button variant={view === "current" ? "default" : "outline"} disabled={busy} onClick={() => { setView("current"); setPage(1); }}>รอบปัจจุบัน ({counts.current})</Button>
      <Button variant={view === "history" ? "default" : "outline"} disabled={busy} onClick={() => { setView("history"); setPage(1); }}>ประวัติบิล ({counts.history})</Button>
    </div>
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
      <label className="space-y-1 text-sm">
        <span className="block font-medium text-xs text-muted-foreground">เลขโต๊ะ (1–15)</span>
        <input type="number" min={1} max={15} placeholder="ทุกโต๊ะ" aria-label="กรองเลขโต๊ะ" value={table} disabled={busy} onChange={(e) => { setTable(e.target.value); setPage(1); }} className="min-h-10 w-28 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium text-xs text-muted-foreground">วันที่เริ่มรอบ / สั่งครั้งแรก</span>
        <input type="date" aria-label="กรองวันที่บิล" value={date} disabled={busy} onChange={(e) => { setDate(e.target.value); setPage(1); }} className="min-h-10 max-w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
      </label>
      {(table || date) && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setTable(""); setDate(""); setPage(1); }}>ล้างตัวกรอง</Button>}
    </div>
    <RefreshStatus updatedAt={updatedAt} failed={Boolean(error)} />
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">{notice}</p>}
    {loading ? <OrderCardsSkeleton billing /> : !bills.length ? <p className="rounded-xl border p-6 text-center text-muted-foreground">{view === "current" ? "ไม่มีรอบโต๊ะปัจจุบันที่ตรงกับตัวกรอง" : "ไม่มีประวัติบิลที่ตรงกับตัวกรอง"}</p> :
      <div className="grid items-start gap-4 lg:grid-cols-2">{bills.map((bill) => <Card key={bill.id}>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>โต๊ะ {bill.tableNumber ?? "—"}</CardTitle><Badge variant={bill.current ? "default" : "secondary"}>{bill.current ? "รอบปัจจุบัน" : "รอบก่อนหน้า"}</Badge></div>
          <p className="break-words font-mono text-sm font-semibold">บิล {bill.number}</p>
          <p className="text-xs text-muted-foreground">{bill.openedAt ? "เปิดโต๊ะ" : "สั่งครั้งแรก"} {time(bill.openedAt || bill.firstOrderedAt)}</p>
          <p className="text-sm">{bill.orders.length ? `สั่ง ${bill.orders.length} ครั้ง` : "เปิดโต๊ะแล้ว ยังไม่มีรายการสั่ง"}{bill.unfinishedCount > 0 ? ` · ยังทำไม่เสร็จ ${bill.unfinishedCount} ออเดอร์` : ""}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-3.5 text-sm">
            <p className="flex justify-between gap-2 text-muted-foreground"><span>ยอดรวม (ไม่รวมยกเลิก)</span><strong className="text-foreground">฿{formatBaht(bill.totalCents)}</strong></p>
            <p className="flex justify-between gap-2 text-muted-foreground"><span>รับเงินแล้ว</span><span className="text-foreground">฿{formatBaht(bill.paidCents)}</span></p>
            {bill.refundedCents > 0 && <p className="flex justify-between gap-2 text-muted-foreground"><span>คืนเงินแล้ว</span><span className="text-foreground">฿{formatBaht(bill.refundedCents)}</span></p>}
            <p className="flex justify-between items-baseline gap-2 pt-2 border-t border-border/50 font-semibold">
              <span className="text-foreground">ยอดรอรับเงิน</span>
              <span className={bill.unpaidCents > 0 ? "text-lg font-bold text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400 font-medium"}>
                ฿{formatBaht(bill.unpaidCents)}
              </span>
            </p>
          </div>
          {bill.unservedCount > 0 && <p className="text-sm font-medium">ยังไม่เสิร์ฟครบ {bill.unservedCount} ออเดอร์ · ดูรายการสั่งด้านล่าง</p>}
          {bill.unpaidOrderIds.length > 0 ? <Button className="min-h-11 w-full" disabled={busy || stale} onClick={() => { setError(""); setMethod("cash"); setCash(""); setTransferChecked(false); setPaymentBill(bill); }}>รับเงินรวมทั้งบิล ฿{formatBaht(bill.unpaidCents)}</Button> : bill.orders.length > 0 && <p className="text-sm text-emerald-700 dark:text-emerald-300">{bill.current ? bill.unfinishedCount || bill.unservedCount ? "ไม่มียอดค้างรับเงิน · รอทำอาหารและเสิร์ฟครบก่อนปิดโต๊ะ" : "ไม่มียอดค้างรับเงิน · ปิดโต๊ะได้จากผังโต๊ะ" : "ไม่มียอดค้างรับเงิน"}</p>}
          {bill.payments?.length > 0 && <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer text-sm font-medium">ประวัติรับเงิน {bill.payments.length} ครั้ง</summary><ul className="space-y-2 text-sm">{bill.payments.map((payment) => <li key={payment.id} className="border-t pt-2"><p>{payment.method === "cash" ? "เงินสด" : "เงินโอน"} · ฿{formatBaht(payment.amountCents)} · {time(payment.createdAt)}</p>{payment.method === "cash" && <p>รับ ฿{formatBaht(payment.receivedCents)} · ทอน ฿{formatBaht(payment.changeCents)}</p>}</li>)}</ul></details>}
          {bill.orders.length > 0 && <details className="rounded-lg border p-3">
            <summary className="min-h-11 cursor-pointer font-medium">ดูรายการสั่ง {bill.orders.length} ครั้ง</summary>
            <div className="space-y-4 pt-2">{bill.orders.map((order, index) => <div key={order.id} className="space-y-2 border-t pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">สั่งครั้งที่ {index + 1} · {order.orderNumber}</h3><Badge variant="secondary">{order.deliveredAt ? "เสิร์ฟแล้ว" : ORDER_STATUS_LABELS[order.status]}</Badge></div>
              {bill.current && order.servingRequired && !order.deliveredAt && order.status === "served" && <Button className="min-h-11" disabled={busy || stale} onClick={() => void deliver(order.id)}>เสิร์ฟแล้ว · ครบออเดอร์นี้</Button>}
              <p className="text-xs text-muted-foreground">{time(order.createdAt)} · {order.status === "cancelled" ? "ยกเลิก / ไม่นับยอด" : order.paymentStatus === "paid" ? "รับเงินแล้ว" : order.paymentStatus === "refunded" ? "คืนเงินแล้ว" : "ยังไม่รับเงิน"} · ฿{order.totalAmount}</p>
              {order.items.map((item) => <div key={item.id} className="text-sm"><p className="break-words">{item.quantity} × {item.menuName} <span className="text-xs text-muted-foreground">({order.status === "cancelled" ? "ยกเลิก" : COOKING_LABELS[item.status]})</span></p>{item.specialInstruction && <p className="break-words text-xs text-muted-foreground">{item.specialInstruction}</p>}</div>)}
              {order.status === "cancelled" && <div className="rounded-md border p-2 text-xs text-muted-foreground">
                {order.cancellationReason ? <><p className="break-words">เหตุผล: {order.cancellationReason}</p>
                  <p className="break-words">ยกเลิกโดย {order.cancelledByLabel || "ไม่ทราบบัญชี"} · {time(order.cancelledAt)}</p></>
                  : <p>ไม่มีรายละเอียดการยกเลิกย้อนหลัง</p>}
              </div>}
              {order.customerNote && <p className="break-words rounded-md bg-muted p-2 text-xs">ข้อความถึงครัว: {order.customerNote}</p>}
              {!["completed", "cancelled"].includes(order.status) && !order.deliveredAt && order.paymentStatus === "unpaid" && <Button variant="destructive" className="min-h-11" disabled={busy} onClick={() => { setError(""); setCancellationReason(""); setCancelTarget({ id: order.id, number: order.orderNumber, billNumber: bill.number }); }}>ยกเลิกครั้งที่ {index + 1}</Button>}
            </div>)}</div>
          </details>}
        </CardContent>
      </Card>)}</div>}
    {counts.pages > 1 && <div className="flex items-center justify-center gap-3"><Button variant="outline" disabled={busy || page <= 1} onClick={() => setPage((value) => value - 1)}>ก่อนหน้า</Button><span className="text-sm">หน้า {page} / {counts.pages}</span><Button variant="outline" disabled={busy || page >= counts.pages} onClick={() => setPage((value) => value + 1)}>ถัดไป</Button></div>}
    <Dialog open={!!paymentBill} onOpenChange={(open) => { if (!open && !busy) setPaymentBill(null); }}>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader><DialogTitle>ยืนยันรับเงินรวมทั้งบิล</DialogTitle><DialogDescription>ยืนยันหลังรับเงินสดหรือตรวจยอดโอนแล้ว ระบบจะบันทึกรับเงินของรายการที่ค้างในบิลนี้</DialogDescription></DialogHeader>
        {paymentBill && <div className="space-y-3 text-sm">
          <p className="font-semibold">โต๊ะ {paymentBill.tableNumber ?? "—"} · {paymentBill.number}</p>
          <p>{paymentBill.openedAt ? "เปิดโต๊ะ" : "สั่งครั้งแรก"} {time(paymentBill.openedAt || paymentBill.firstOrderedAt)}</p>
          <p>รับเงินสำหรับ {paymentBill.unpaidOrderIds.length} ออเดอร์ · รวม <strong className="text-xl">฿{formatBaht(paymentBill.unpaidCents)}</strong></p>
          <fieldset disabled={busy} className="space-y-3"><legend className="mb-2 font-medium">ช่องทางรับเงิน</legend>
            <div className="flex gap-3">{(["cash", "transfer"] as const).map((value) => <label key={value} className="flex min-h-11 items-center gap-2 rounded-lg border px-3"><input type="radio" name="payment-method" value={value} checked={method === value} onChange={() => { setMethod(value); setTransferChecked(false); }} />{value === "cash" ? "เงินสด" : "โอน / พร้อมเพย์"}</label>)}</div>
            {method === "cash" ? <><label className="block">รับเงินสด (บาท)<input aria-label="รับเงินสด (บาท)" inputMode="decimal" value={cash} onChange={(event) => setCash(event.target.value)} placeholder="เช่น 500.00" className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" /></label>
              <p aria-live="polite">{receivedCents === null ? "กรอกจำนวนเงินไม่เกิน 2 ตำแหน่งทศนิยม" : receivedCents < paymentBill.unpaidCents ? `ยังขาด ฿${formatBaht(paymentBill.unpaidCents - receivedCents)}` : `เงินทอน ฿${formatBaht(receivedCents - paymentBill.unpaidCents)}`}</p></> :
              <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={transferChecked} onChange={(event) => setTransferChecked(event.target.checked)} />ตรวจสอบเงินเข้าบัญชีร้านตรงตามยอดแล้ว</label>}
          </fieldset>
          <p className="text-xs text-muted-foreground">ยอดนี้หักรายการที่รับเงินแล้วและยกเลิกแล้ว หากมีการเปลี่ยนรายการ ระบบจะให้ตรวจยอดใหม่</p>
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2"><Button className="min-h-11 flex-1" disabled={busy || !paymentValid} onClick={() => void pay()}>{busy ? "กำลังบันทึก…" : "ยืนยันว่าได้รับเงินแล้ว"}</Button><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setPaymentBill(null)}>ย้อนกลับ</Button></div>
        </div>}
      </DialogContent>
    </Dialog>
  </section>;
}
