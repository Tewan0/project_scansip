"use client";
import { BillBoard } from "@/components/bill-board";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COOKING_LABELS, type CookingStatus } from "@/lib/permissions";

type Order = {
  id: string; orderNumber: string; billNumber: string; tableNumber: number | null; status: string; createdAt: string;
  customerNote: string | null; totalAmount?: string; paymentStatus?: string;
  items: { id: string; menuName: string; quantity: number; specialInstruction: string | null; status: CookingStatus }[];
};
const labels: Record<string, string> = { pending: "รอทำ", preparing: "กำลังทำ", served: "ทำเสร็จแล้ว", completed: "ปิดออเดอร์แล้ว", cancelled: "ยกเลิกแล้ว" };

export function OrderBoard({ mode }: { mode: "kitchen" | "frontdesk" }) {
  return mode === "frontdesk" ? <BillBoard /> : <KitchenOrderBoard />;
}

function KitchenOrderBoard() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string[]>([]);
  const working = useRef(new Set<string>());
  const version = useRef(0);
  const mounted = useRef(false);
  const load = useCallback(async () => {
    const request = ++version.current;
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const result = await response.json();
      if (!mounted.current || request !== version.current) return;
      if (response.status === 401 || response.status === 403) { setOrders([]); router.replace("/workspace"); return; }
      if (!response.ok || !result.success) throw new Error(result.error || "โหลดออเดอร์ไม่สำเร็จ");
      setOrders(result.data); setError("");
    } catch (error) {
      if (mounted.current && request === version.current) setError(error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ");
    } finally { if (mounted.current && request === version.current) setLoading(false); }
  }, [router]);
  useEffect(() => {
    mounted.current = true;
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => { if (!working.current.size) void load(); }, 8000);
    return () => { mounted.current = false; clearTimeout(initial); clearInterval(timer); };
  }, [load]);

  async function update(id: string, body: Record<string, unknown>) {
    if (working.current.has(id)) return;
    working.current.add(id); setBusy([...working.current]); ++version.current; setError("");
    try {
      const response = await fetch("/api/orders/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "เปลี่ยนสถานะไม่สำเร็จ");
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ"); }
    finally { working.current.delete(id); if (mounted.current) setBusy([...working.current]); }
  }

  const visible = orders.filter((order) => filter === "active" ? ["pending", "preparing"].includes(order.status) : order.status === filter);
  visible.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return <section className="space-y-5 p-4 sm:p-6">

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">รายการอาหารสำหรับครัว</h1><p className="mt-1 text-sm text-muted-foreground">แยกแต่ละครั้งที่สั่ง พร้อมเลขบิลของรอบโต๊ะ · อัปเดตทุก 8 วินาที</p></div>
      <Button variant="outline" disabled={busy.length > 0} onClick={() => void load()}>อัปเดตข้อมูล</Button>
    </div>
    <div className="flex flex-wrap gap-2">
      {[["active", "กำลังรอ/กำลังทำ"], ["served", "ทำเสร็จแล้ว"]].map(([value, label]) =>
        <Button key={value} variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{label}</Button>)}
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {loading ? <p role="status">กำลังโหลดออเดอร์…</p> : visible.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">ไม่มีออเดอร์ในสถานะนี้</CardContent></Card> :
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {visible.map((order) => <Card key={order.id}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>โต๊ะ {order.tableNumber ?? "—"}</CardTitle><Badge variant="secondary">{labels[order.status] || order.status}</Badge></div>
          <p className="text-xs text-muted-foreground">{order.orderNumber} · {new Date(order.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}</p>
          <p className="break-words text-xs font-semibold">บิล {order.billNumber}</p>
          {order.customerNote && <p className="break-words rounded-md bg-muted p-2 text-sm">หมายเหตุ: {order.customerNote}</p>}
        </CardHeader>
        <CardContent className="space-y-3">
          {order.items.map((item) => <div key={item.id} className="space-y-2 border-b pb-3 last:border-0">
            <div className="flex items-start gap-2"><span className="shrink-0 font-bold">{item.quantity} ×</span><p className="min-w-0 break-words font-medium">{item.menuName}</p></div>
            {item.specialInstruction && <p className="break-words text-sm text-muted-foreground">{item.specialInstruction}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={item.status === "ready" ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-muted-foreground"}>{COOKING_LABELS[item.status]}</span>
              {item.status !== "ready" && <div className="flex flex-wrap gap-2">
                {item.status === "pending" && <Button variant="outline" disabled={busy.includes(order.id)} onClick={() => update(order.id, { itemId: item.id, itemStatus: "preparing" })}>เริ่มทำ</Button>}
                <Button disabled={busy.includes(order.id)} onClick={() => update(order.id, { itemId: item.id, itemStatus: "ready" })}>ทำเสร็จ</Button>
              </div>}
            </div>
          </div>)}
        </CardContent>
        <CardFooter className="mt-auto flex-wrap justify-between gap-3">
          {order.status !== "served" ? <Button className="w-full" disabled={busy.includes(order.id)} onClick={() => update(order.id, { finishAll: true })}>{busy.includes(order.id) ? "กำลังบันทึก…" : "ทำเสร็จทั้งหมด"}</Button> : <p className="text-sm text-emerald-700 dark:text-emerald-300">พร้อมให้หน้าร้านนำไปเสิร์ฟ</p>}
        </CardFooter>
      </Card>)}
    </div>}
  </section>;
}

