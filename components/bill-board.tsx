// @refresh reset
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ServiceRequestBoard } from "@/components/service-request-board";
import { COOKING_LABELS } from "@/lib/permissions";
import { type Bill, ORDER_STATUS_LABELS, formatBaht } from "@/lib/billing";

const time = (value: string | null) => value ? new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }) : "ไม่ทราบเวลา";

export function BillBoard() {
  const router = useRouter();
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
      setBills(result.data); setStale(false); setError(""); setCounts({ current: result.currentCount, history: result.historyCount, pages: result.pageCount });
      if (page !== result.page) setPage(result.page);
    } catch (error) { if (state.mounted && version === state.version) { setStale(true); setError(error instanceof Error ? error.message : "เชื่อมต่อไม่ได้ กรุณาลองใหม่"); } }
    finally { if (state.mounted && version === state.version) setLoading(false); }
  }, [view, page, table, date, router]);
  useEffect(() => {
    const state = requestState.current; state.mounted = true;
    const initial = setTimeout(() => { setLoading(true); setError(""); setNotice(""); setBills([]); void load(); }, 0);
    const timer = setInterval(() => { if (!state.working) void load(); }, 8000);
    return () => { state.mounted = false; ++state.version; clearTimeout(initial); clearInterval(timer); };
  }, [load]);

  async function pay() {
    if (!paymentBill || requestState.current.working) return;
    const state = requestState.current; state.working = true; ++state.version; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/bills/${paymentBill.id}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        anchorOrderId: paymentBill.anchorOrderId, expectedOrderIds: paymentBill.unpaidOrderIds, expectedTotalCents: paymentBill.unpaidCents,
      }) });
      const result = await response.json();
      if (!state.mounted) return;
      if (!response.ok || !result.success) {
        if (response.status === 409) { setPaymentBill(null); await load(); }
        throw new Error(result.error || "บันทึกรับเงินไม่สำเร็จ");
      }
      setNotice(`บันทึกรับเงินบิล ${paymentBill.number} ฿${formatBaht(result.data.paidCents)} แล้ว`);
      setPaymentBill(null); await load();
    } catch (error) { if (state.mounted) setError(error instanceof Error ? error.message : "ยืนยันผลรับเงินไม่ได้ กรุณาอัปเดตข้อมูลเพื่อตรวจสอบก่อนทำซ้ำ"); }
    finally { state.working = false; if (state.mounted) setBusy(false); }
  }
  async function cancelOrder(bill: Bill, id: string, number: string) {
    if (requestState.current.working || !window.confirm(`ยกเลิกออเดอร์ ${number} ในบิล ${bill.number} โต๊ะ ${bill.tableNumber ?? "—"} ใช่ไหม?`)) return;
    const state = requestState.current; state.working = true; ++state.version; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "ยกเลิกไม่สำเร็จ");
      if (state.mounted) await load();
    } catch (error) { if (state.mounted) setError(error instanceof Error ? error.message : "ยกเลิกไม่สำเร็จ"); }
    finally { state.working = false; if (state.mounted) setBusy(false); }
  }

  return <section className="space-y-5 p-4 sm:p-6">
    <ServiceRequestBoard />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">บิลหน้าร้าน</h1><p className="mt-1 text-sm text-muted-foreground">หนึ่งรอบเปิดโต๊ะต่อหนึ่งบิล · สั่งเพิ่มรวมในบิลเดิม · อัปเดตทุก 8 วินาที</p></div>
      <Link href="/frontdesk" className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm">ผังโต๊ะ / ปิดโต๊ะ</Link>
      <Button variant="outline" disabled={busy} onClick={() => { setError(""); void load(); }}>อัปเดตบิล</Button>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="ประเภทบิล">
      <Button variant={view === "current" ? "default" : "outline"} disabled={busy} onClick={() => { setView("current"); setPage(1); }}>รอบปัจจุบัน ({counts.current})</Button>
      <Button variant={view === "history" ? "default" : "outline"} disabled={busy} onClick={() => { setView("history"); setPage(1); }}>ประวัติบิล ({counts.history})</Button>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1 text-sm"><span className="block">เลขโต๊ะ</span><input type="number" min={1} max={50} placeholder="ทุกโต๊ะ" aria-label="กรองเลขโต๊ะ" value={table} disabled={busy} onChange={(e) => { setTable(e.target.value); setPage(1); }} className="min-h-11 w-28 rounded-lg border bg-background px-3" /></label>
      <label className="space-y-1 text-sm"><span className="block">วันที่เริ่มรอบ / สั่งครั้งแรก</span><input type="date" aria-label="กรองวันที่บิล" value={date} disabled={busy} onChange={(e) => { setDate(e.target.value); setPage(1); }} className="min-h-11 max-w-full rounded-lg border bg-background px-3" /></label>
      {(table || date) && <Button variant="ghost" disabled={busy} onClick={() => { setTable(""); setDate(""); setPage(1); }}>ล้างตัวกรอง</Button>}
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">{notice}</p>}
    {loading ? <p role="status">กำลังโหลดบิล…</p> : !bills.length ? <p className="rounded-xl border p-6 text-center text-muted-foreground">{view === "current" ? "ไม่มีรอบโต๊ะปัจจุบันที่ตรงกับตัวกรอง" : "ไม่มีประวัติบิลที่ตรงกับตัวกรอง"}</p> :
      <div className="grid items-start gap-4 lg:grid-cols-2">{bills.map((bill) => <Card key={bill.id}>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>โต๊ะ {bill.tableNumber ?? "—"}</CardTitle><Badge variant={bill.current ? "default" : "secondary"}>{bill.current ? "รอบปัจจุบัน" : "รอบก่อนหน้า"}</Badge></div>
          <p className="break-words font-mono text-sm font-semibold">บิล {bill.number}</p>
          <p className="text-xs text-muted-foreground">{bill.openedAt ? "เปิดโต๊ะ" : "สั่งครั้งแรก"} {time(bill.openedAt || bill.firstOrderedAt)}</p>
          <p className="text-sm">{bill.orders.length ? `สั่ง ${bill.orders.length} ครั้ง` : "เปิดโต๊ะแล้ว ยังไม่มีรายการสั่ง"}{bill.unfinishedCount > 0 ? ` · ยังทำไม่เสร็จ ${bill.unfinishedCount} ออเดอร์` : ""}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
            <p className="flex justify-between gap-2"><span>ยอดรวม (ไม่รวมยกเลิก)</span><strong>฿{formatBaht(bill.totalCents)}</strong></p>
            <p className="flex justify-between gap-2"><span>รับเงินแล้ว</span><span>฿{formatBaht(bill.paidCents)}</span></p>
            {bill.refundedCents > 0 && <p className="flex justify-between gap-2"><span>คืนเงินแล้ว</span><span>฿{formatBaht(bill.refundedCents)}</span></p>}
            <p className="flex justify-between gap-2 font-semibold"><span>ยอดรอรับเงิน</span><span>฿{formatBaht(bill.unpaidCents)}</span></p>
          </div>
          {bill.unpaidOrderIds.length > 0 ? <Button className="min-h-11 w-full" disabled={busy || stale} onClick={() => { setError(""); setPaymentBill(bill); }}>รับเงินรวมทั้งบิล ฿{formatBaht(bill.unpaidCents)}</Button> : bill.orders.length > 0 && <p className="text-sm text-emerald-700 dark:text-emerald-300">{bill.current ? bill.unfinishedCount ? "ไม่มียอดค้างรับเงิน · รออาหารทำเสร็จก่อนปิดโต๊ะ" : "ไม่มียอดค้างรับเงิน · ปิดโต๊ะได้จากผังโต๊ะ" : "ไม่มียอดค้างรับเงิน"}</p>}
          {bill.orders.length > 0 && <details className="rounded-lg border p-3">
            <summary className="min-h-11 cursor-pointer font-medium">ดูรายการสั่ง {bill.orders.length} ครั้ง</summary>
            <div className="space-y-4 pt-2">{bill.orders.map((order, index) => <div key={order.id} className="space-y-2 border-t pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">สั่งครั้งที่ {index + 1} · {order.orderNumber}</h3><Badge variant="secondary">{ORDER_STATUS_LABELS[order.status]}</Badge></div>
              <p className="text-xs text-muted-foreground">{time(order.createdAt)} · {order.status === "cancelled" ? "ยกเลิก / ไม่นับยอด" : order.paymentStatus === "paid" ? "รับเงินแล้ว" : order.paymentStatus === "refunded" ? "คืนเงินแล้ว" : "ยังไม่รับเงิน"} · ฿{order.totalAmount}</p>
              {order.items.map((item) => <div key={item.id} className="text-sm"><p className="break-words">{item.quantity} × {item.menuName} <span className="text-xs text-muted-foreground">({order.status === "cancelled" ? "ยกเลิก" : COOKING_LABELS[item.status]})</span></p>{item.specialInstruction && <p className="break-words text-xs text-muted-foreground">{item.specialInstruction}</p>}</div>)}
              {order.customerNote && <p className="break-words rounded-md bg-muted p-2 text-xs">ข้อความถึงครัว: {order.customerNote}</p>}
              {!["completed", "cancelled"].includes(order.status) && order.paymentStatus === "unpaid" && <Button variant="destructive" className="min-h-11" disabled={busy} onClick={() => void cancelOrder(bill, order.id, order.orderNumber)}>ยกเลิกครั้งที่ {index + 1}</Button>}
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
          <p className="text-xs text-muted-foreground">ยอดนี้หักรายการที่รับเงินแล้วและยกเลิกแล้ว หากมีการเปลี่ยนรายการ ระบบจะให้ตรวจยอดใหม่</p>
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2"><Button className="min-h-11 flex-1" disabled={busy} onClick={() => void pay()}>{busy ? "กำลังบันทึก…" : "ยืนยันว่าได้รับเงินแล้ว"}</Button><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setPaymentBill(null)}>ย้อนกลับ</Button></div>
        </div>}
      </DialogContent>
    </Dialog>
  </section>;
}
