"use client";
import { ServiceRequestBoard } from "@/components/service-request-board";
import Link from "next/link";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { isValidTableCount, MAX_TABLE_COUNT, MIN_TABLE_COUNT, TABLE_STATUS_LABELS } from "@/lib/table-settings";
import { QRCodeSVG } from "qrcode.react";
import { Armchair, Check, Clock, Copy, ExternalLink, LogOut, Minus, Plus, QrCode, RotateCw } from "lucide-react";

interface TableItem {
  id: string;
  tableNumber: number;
  status: keyof typeof TABLE_STATUS_LABELS;
  currentSessionToken: string | null;
  sessionStartedAt: string | null;
}

function uniqueTables(items: TableItem[]) {
  return Array.from(new Map(items.map((table) => [table.tableNumber, table])).values())
    .sort((a, b) => a.tableNumber - b.tableNumber);
}

export default function TablesManagementPage() {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [canManageTables, setCanManageTables] = useState(false);
  const [storeSlug, setStoreSlug] = useState("");
  const [storeName, setStoreName] = useState("");
  const [draftCount, setDraftCount] = useState<string | null>(null);
  const [activeQrTable, setActiveQrTable] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);
  const requests = useRef({ version: 0 });
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTables = useCallback(async () => {
    if (busy.current) return;
    const version = ++requests.current.version;
    try {
      const res = await fetch("/api/tables", { cache: "no-store" });
      const json = await res.json();
      if (version !== requests.current.version) return;
      if (!res.ok || !json.success) {
        if (res.status === 401 || res.status === 403) {
          setTables([]);
          setCanManageTables(false);
        }
        throw new Error(json.error || "โหลดผังโต๊ะไม่สำเร็จ");
      }
      setTables(uniqueTables(json.data || []));
      setStoreSlug(json.store?.slug || json.store?.id || "");
      setStoreName(json.store?.name || "");
      setCanManageTables(json.canManageTables === true);
    } catch (err) {
      if (version === requests.current.version) setError(err instanceof Error ? err.message : "ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่");
    } finally {
      if (version === requests.current.version) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestState = requests.current;
    const initialLoad = setTimeout(() => void fetchTables(), 0);
    const interval = setInterval(() => void fetchTables(), 10000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
      requestState.version++;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [fetchTables]);

  const currentCount = Math.max(0, ...tables.map((table) => table.tableNumber));
  const countValue = draftCount ?? String(currentCount || 8);
  const requestedCount = Number(countValue);
  const validCount = isValidTableCount(requestedCount) && countValue.trim() !== "";
  const removing = tables.filter((table) => validCount && table.tableNumber > requestedCount);
  const busyRemoving = removing.filter((table) => table.status !== "available" || table.currentSessionToken);
  const occupiedCount = tables.filter((table) => table.status === "occupied").length;
  const availableCount = tables.filter((table) => table.status === "available").length;
  const reservedCount = tables.filter((table) => table.status === "reserved").length;
  const qrTable = tables.find((table) => table.tableNumber === activeQrTable && table.currentSessionToken);

  async function performAction(action: string, fields: { count?: number; tableNumber?: number }) {
    if (busy.current) return;
    busy.current = true;
    requests.current.version++;
    setProcessing(action === "sync_tables" ? "count" : String(fields.tableNumber));
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/tables", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...fields }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      if (action === "sync_tables") {
        setTables(uniqueTables(json.data));
        setDraftCount(null);
        setNotice(`บันทึกจำนวนโต๊ะเป็น ${fields.count} โต๊ะแล้ว`);
      } else {
        const updated: TableItem = json.data;
        setTables((previous) => previous.map((table) => table.tableNumber === updated.tableNumber ? updated : table));
        if (action === "open_session") {
          setCopied(false);
          setActiveQrTable(updated.tableNumber);
        } else {
          setActiveQrTable(null);
          setNotice(`ปิดโต๊ะ ${updated.tableNumber} แล้ว`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่");
    } finally {
      busy.current = false;
      setProcessing(null);
      void fetchTables();
    }
  }

  function saveTableCount(event: React.FormEvent) {
    event.preventDefault();
    if (!validCount || busyRemoving.length || processing) return;
    if (removing.length && !window.confirm(
      `ลดเหลือ ${requestedCount} โต๊ะใช่ไหม?\nโต๊ะหมายเลข ${removing.map((table) => table.tableNumber).join(", ")} จะถูกนำออกจากผัง ประวัติออเดอร์เดิมยังคงอยู่`,
    )) return;
    void performAction("sync_tables", { count: requestedCount });
  }

  function getOrderingUrl(table: TableItem) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/r/${encodeURIComponent(storeSlug)}/table/${table.tableNumber}?token=${encodeURIComponent(table.currentSessionToken || "")}`;
  }

  async function copyOrderingUrl(table: TableItem) {
    try {
      await navigator.clipboard.writeText(getOrderingUrl(table));
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("คัดลอกลิงก์ไม่ได้ กรุณาเลือกและคัดลอกลิงก์จากช่องใต้ QR");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <ServiceRequestBoard />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl">ผังโต๊ะอาหาร</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            เปิดโต๊ะเพื่อสร้าง QR สั่งอาหารสำหรับลูกค้ารอบนี้ และปิดโต๊ะเมื่อจบรอบ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
            <Link href="/frontdesk/orders" className="inline-flex min-h-11 items-center rounded-lg border bg-background px-4 text-sm font-medium">ตรวจออเดอร์ / รับเงิน</Link>
          <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-500" /> ว่าง {availableCount}
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <span className="size-2 rounded-full bg-amber-500" /> กำลังใช้งาน {occupiedCount}
          </Badge>
          {reservedCount > 0 && <Badge variant="outline">จองแล้ว {reservedCount}</Badge>}
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
        <Button variant="outline" size="sm" className="mt-2 block" disabled={!!processing} onClick={() => { setError(null); void fetchTables(); }}>ลองโหลดอีกครั้ง</Button>
      </div>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</p>}

      {canManageTables && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Armchair className="size-4 shrink-0" /> จำนวนโต๊ะในร้าน</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveTableCount} className="space-y-3">
              <label htmlFor="table-count" className="block text-sm text-muted-foreground">
                กำหนดได้ {MIN_TABLE_COUNT}–{MAX_TABLE_COUNT} โต๊ะ ปัจจุบันมี {tables.length} โต๊ะ
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" className="size-11 shrink-0" aria-label="ลดจำนวนโต๊ะ"
                    disabled={!!processing || !validCount || requestedCount <= MIN_TABLE_COUNT}
                    onClick={() => setDraftCount(String(requestedCount - 1))}><Minus /></Button>
                  <Input id="table-count" type="number" inputMode="numeric" min={MIN_TABLE_COUNT} max={MAX_TABLE_COUNT} step={1}
                    value={countValue} onChange={(event) => setDraftCount(event.target.value)}
                    disabled={!!processing} aria-describedby="table-count-help" aria-invalid={!validCount}
                    className="h-11 w-24 text-center text-base tabular-nums" />
                  <Button type="button" variant="outline" className="size-11 shrink-0" aria-label="เพิ่มจำนวนโต๊ะ"
                    disabled={!!processing || !validCount || requestedCount >= MAX_TABLE_COUNT}
                    onClick={() => setDraftCount(String(requestedCount + 1))}><Plus /></Button>
                  <span className="text-sm text-muted-foreground">โต๊ะ</span>
                </div>
                <Button type="submit" className="h-11 w-full sm:w-auto"
                  disabled={!!processing || isLoading || !validCount || !!busyRemoving.length || requestedCount === currentCount}>
                  {processing === "count" && <RotateCw className="size-4 animate-spin" />}
                  {processing === "count" ? "กำลังบันทึก..." : "บันทึกจำนวนโต๊ะ"}
                </Button>
              </div>
              <p id="table-count-help" className={busyRemoving.length || !validCount ? "text-sm text-destructive" : "text-xs leading-relaxed text-muted-foreground"}>
                {!validCount ? `กรุณาระบุจำนวนเต็มตั้งแต่ ${MIN_TABLE_COUNT}–${MAX_TABLE_COUNT}`
                  : busyRemoving.length ? `ยังลดไม่ได้: โต๊ะ ${busyRemoving.map((table) => table.tableNumber).join(", ")} กำลังใช้งานหรือจองอยู่`
                  : removing.length ? `จะนำโต๊ะ ${removing.map((table) => table.tableNumber).join(", ")} ออกจากผัง โดยเก็บประวัติออเดอร์เดิมไว้`
                  : "เมื่อลดจำนวน จะนำโต๊ะหมายเลขสูงสุดออกก่อน และต้องไม่มีลูกค้าหรือออเดอร์ค้าง"}
              </p>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="กำลังโหลดผังโต๊ะ">
          {[1, 2, 3, 4].map((number) => <Skeleton key={number} className="h-48 rounded-xl" />)}
        </div>
      ) : tables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <Armchair className="mx-auto mb-3 size-8" />
          <p>ยังไม่มีโต๊ะในร้าน</p>
          <p className="mt-1 text-sm">{canManageTables ? "กำหนดจำนวนโต๊ะด้านบนแล้วกดบันทึกเพื่อเริ่มต้น" : "ให้เจ้าของร้านเพิ่มโต๊ะก่อนเริ่มใช้งาน"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {tables.map((table) => {
            const occupied = table.status === "occupied";
            const reserved = table.status === "reserved";
            const working = processing === String(table.tableNumber);
            const number = String(table.tableNumber).padStart(2, "0");
            return (
              <Card key={table.id} className={occupied ? "gap-0 border border-amber-500/40 py-0" : "gap-0 border border-border py-0"}>
                <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={occupied ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-sm font-bold text-black" : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold text-foreground"}>{number}</span>
                    <h2 className="text-base font-semibold">โต๊ะ {number}</h2>
                  </div>
                  <Badge variant="outline" className={occupied ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300" : reserved ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300" : "text-muted-foreground"}>
                    {TABLE_STATUS_LABELS[table.status]}
                  </Badge>
                </div>
                <div className="flex-1 px-4 pb-4 text-sm text-muted-foreground">
                  {occupied ? (
                    <p className="flex items-center gap-2"><Clock className="size-4 shrink-0" /> เปิดเมื่อ {table.sessionStartedAt ? new Date(table.sessionStartedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "สักครู่"}</p>
                  ) : <p>{reserved ? "โต๊ะนี้จองไว้ สามารถเปิดเมื่อมีลูกค้ามาถึง" : "พร้อมรับลูกค้าและเปิดรอบใหม่"}</p>}
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border bg-muted/30 p-3">
                  {occupied ? <>
                    <Button type="button" variant="outline" className="min-h-11 flex-1" disabled={!table.currentSessionToken || !storeSlug}
                      onClick={() => { setCopied(false); setActiveQrTable(table.tableNumber); }}><QrCode className="size-4" /> ดู QR</Button>
                    <Button type="button" variant="destructive" className="min-h-11 flex-1" disabled={!!processing}
                      onClick={() => {
                        if (window.confirm(`ปิดโต๊ะ ${number} ใช่ไหม? QR รอบนี้จะใช้สั่งต่อไม่ได้ กรุณาตรวจสอบการรับเงินให้เรียบร้อยก่อน`)) {
                          void performAction("close_session", { tableNumber: table.tableNumber });
                        }
                      }}>{working ? <RotateCw className="size-4 animate-spin" /> : <LogOut className="size-4" />} ปิดโต๊ะ</Button>
                  </> : (
                    <Button type="button" className="min-h-11 w-full" disabled={!!processing}
                      onClick={() => void performAction("open_session", { tableNumber: table.tableNumber })}>
                      {working ? <RotateCw className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      {working ? "กำลังเปิดโต๊ะ..." : "เปิดโต๊ะและสร้าง QR"}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!qrTable} onOpenChange={(open) => { if (!open) setActiveQrTable(null); }}>
        <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          {qrTable && <>
            <DialogHeader>
              <DialogTitle className="text-lg">QR สั่งอาหาร · โต๊ะ {String(qrTable.tableNumber).padStart(2, "0")}</DialogTitle>
              <DialogDescription className="break-words">{storeName} · ใช้ได้เฉพาะรอบนี้และหมดอายุเมื่อปิดโต๊ะ</DialogDescription>
            </DialogHeader>
            <div className="mx-auto rounded-xl bg-white p-4">
              <QRCodeSVG value={getOrderingUrl(qrTable)} size={192} level="M" fgColor="#18181b" bgColor="#ffffff" title={"สแกนสั่งอาหาร โต๊ะ " + qrTable.tableNumber} />
            </div>
            <label className="sr-only" htmlFor="ordering-url">ลิงก์สั่งอาหาร</label>
            <div className="flex min-w-0 gap-2">
              <Input id="ordering-url" value={getOrderingUrl(qrTable)} readOnly className="min-w-0 flex-1 text-xs" onFocus={(event) => event.target.select()} />
              <Button variant="outline" aria-label={copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"} onClick={() => void copyOrderingUrl(qrTable)}>
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="min-h-11 flex-1" render={<a href={getOrderingUrl(qrTable)} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink /> เปิดหน้าสั่งอาหาร
              </Button>
              <Button className="min-h-11 flex-1" onClick={() => setActiveQrTable(null)}>ปิดหน้าต่าง</Button>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
