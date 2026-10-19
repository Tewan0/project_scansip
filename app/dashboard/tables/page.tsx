"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeSVG } from "qrcode.react";
import {
  Armchair,
  Sparkles,
  RotateCw,
  LogOut,
  Clock,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  X,
} from "lucide-react";

interface TableItem {
  id: string;
  tableNumber: number;
  status: "available" | "occupied" | "reserved";
  currentSessionToken: string | null;
  sessionStartedAt: string | null;
}

export default function TablesManagementPage() {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<number | null>(null);
  const [storeSlug, setStoreSlug] = useState<string>("slow-bar");
  const [activeQrModal, setActiveQrModal] = useState<{ tableNumber: number; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTables = async () => {
    try {
      const res = await fetch("/api/tables");
      const json = await res.json();
      if (json.success) {
        if (json.data && json.data.length > 0) {
          // Deduplicate tables by tableNumber
          const uniqueTables = Array.from(
            new Map(json.data.map((t: TableItem) => [t.tableNumber, t])).values()
          ) as TableItem[];
          setTables(uniqueTables);
        } else {
          // If no tables seeded yet, sync initial 8 tables
          await handleSyncTables(8);
        }
        if (json.store?.slug) {
          setStoreSlug(json.store.slug);
        }
      }
    } catch (err) {
      console.error("Failed to load tables:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncTables = async (count: number) => {
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_tables", count }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const uniqueTables = Array.from(
          new Map(json.data.map((t: TableItem) => [t.tableNumber, t])).values()
        ) as TableItem[];
        setTables(uniqueTables);
      }
    } catch (err) {
      console.error("Failed to sync tables:", err);
    }
  };

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 10000);
    return () => clearInterval(interval);
  }, []);

  // เปิดโต๊ะ (Open Session)
  const handleOpenSession = async (tableNumber: number) => {
    try {
      setIsProcessing(tableNumber);
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_session", tableNumber }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setTables((prev) =>
          prev.map((t) => (t.tableNumber === tableNumber ? json.data : t))
        );
        // เปิด Modal แสดง QR ทันทีให้พนักงานสแกนหรือยื่นให้ลูกค้า
        if (json.data.currentSessionToken) {
          setActiveQrModal({
            tableNumber,
            token: json.data.currentSessionToken,
          });
        }
      }
    } catch (err) {
      console.error("Failed to open table:", err);
    } finally {
      setIsProcessing(null);
    }
  };

  // ปิดโต๊ะ / เช็คบิล (Close Session)
  const handleCloseSession = async (tableNumber: number) => {
    if (!confirm(`ยืนยันการเช็คบิลและปิดโต๊ะ ${tableNumber} หรือไม่? รหัสสั่งอาหารรอบนี้จะหมดอายุทันที`)) {
      return;
    }
    try {
      setIsProcessing(tableNumber);
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close_session", tableNumber }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setTables((prev) =>
          prev.map((t) => (t.tableNumber === tableNumber ? json.data : t))
        );
        if (activeQrModal?.tableNumber === tableNumber) {
          setActiveQrModal(null);
        }
      }
    } catch (err) {
      console.error("Failed to close table:", err);
    } finally {
      setIsProcessing(null);
    }
  };

  const getOrderingUrl = (tableNumber: number, token?: string | null) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const base = `${origin}/r/${storeSlug}/table/${tableNumber}`;
    return token ? `${base}?token=${token}` : base;
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const occupiedCount = tables.filter((t) => t.status === "occupied").length;
  const availableCount = tables.length - occupiedCount;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              ผังโต๊ะอาหาร & Dynamic Sessions
            </h1>
            <Badge variant="outline" className="text-xs">
              ป้องกันการสั่งเล่น 100%
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            เปิดโต๊ะเพื่อสร้างรหัสสั่งอาหารเฉพาะรอบบิล และปิดโต๊ะเมื่อเช็คบิลเพื่อตัดสิทธิ์การสั่งทันที
          </p>
        </div>

        {/* Quick Table Counts */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
            <span className="size-2 rounded-full bg-emerald-500" />
            โต๊ะว่าง: {availableCount}
          </Badge>
          <Badge variant="secondary" className="gap-1.5 text-xs bg-amber-50 text-amber-700 border-amber-200">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            มีลูกค้านั่ง: {occupiedCount}
          </Badge>
        </div>
      </div>

      {/* Tables Bento Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="h-44 p-4 flex flex-col justify-between border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-8 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-1.5 my-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-7 w-full rounded-md" />
              </div>
              <Skeleton className="h-8 w-full rounded-lg" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.map((table) => {
            const isOccupied = table.status === "occupied" && Boolean(table.currentSessionToken);
            const isWorking = isProcessing === table.tableNumber;
            const formattedTable = String(table.tableNumber).padStart(2, "0");
            const orderUrl = getOrderingUrl(table.tableNumber, table.currentSessionToken);

            return (
              <Card
                key={`table-slot-${table.tableNumber}`}
                className={`border transition-all flex flex-col justify-between ${
                  isOccupied
                    ? "border-amber-500/40 bg-amber-500/[0.02] shadow-2xs"
                    : "border-border bg-card hover:border-border/80"
                }`}
              >
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isOccupied
                          ? "bg-amber-500 text-white shadow-2xs"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {formattedTable}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">
                        โต๊ะ {formattedTable}
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        {isOccupied ? "กำลังใช้งาน" : "โต๊ะว่าง"}
                      </CardDescription>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 ${
                      isOccupied
                        ? "border-amber-500/40 bg-amber-50 text-amber-700"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {isOccupied ? "Occupied" : "Available"}
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-2">
                  {isOccupied ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>เปิดเมื่อ: {table.sessionStartedAt ? new Date(table.sessionStartedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "สักครู่"}</span>
                      </div>
                      <div className="flex items-center justify-between bg-muted/50 p-2 rounded-md font-mono text-[11px]">
                        <span className="truncate text-muted-foreground">
                          {table.currentSessionToken}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveQrModal({
                              tableNumber: table.tableNumber,
                              token: table.currentSessionToken!,
                            })
                          }
                          className="text-primary hover:underline font-sans font-semibold shrink-0 cursor-pointer flex items-center gap-1"
                        >
                          <QrCode className="w-3 h-3" /> ดู QR
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 text-center text-xs text-muted-foreground">
                      พร้อมรับลูกค้าและเปิดรอบบิลใหม่
                    </div>
                  )}
                </CardContent>

                <div className="p-3 border-t border-border bg-muted/20 flex items-center gap-2">
                  {isOccupied ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          setActiveQrModal({
                            tableNumber: table.tableNumber,
                            token: table.currentSessionToken!,
                          })
                        }
                        className="flex-1 text-xs"
                      >
                        <QrCode className="w-3 h-3" data-icon="inline-start" />
                        QR สั่งอาหาร
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        disabled={isWorking}
                        onClick={() => handleCloseSession(table.tableNumber)}
                        className="text-xs"
                        title="เช็คบิลและตัดสิทธิ์การสั่ง"
                      >
                        {isWorking ? <RotateCw className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                        ปิดโต๊ะ
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="xs"
                      disabled={isWorking}
                      onClick={() => handleOpenSession(table.tableNumber)}
                      className="w-full text-xs font-semibold cursor-pointer"
                    >
                      {isWorking ? (
                        <>
                          <RotateCw className="w-3 h-3 animate-spin" data-icon="inline-start" />
                          กำลังเปิดโต๊ะ...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" data-icon="inline-start" />
                          เปิดโต๊ะ (สร้าง QR)
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* QR Code Modal for Active Table Session */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <Card className="w-full max-w-sm border-border shadow-xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base font-bold">
                  QR สั่งอาหาร: โต๊ะ {String(activeQrModal.tableNumber).padStart(2, "0")}
                </CardTitle>
                <CardDescription className="text-xs">
                  รหัสเฉพาะรอบบิลนี้ (จะหมดอายุทันทีเมื่อปิดโต๊ะ)
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setActiveQrModal(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="p-6 flex flex-col items-center justify-center space-y-4">
              <div className="p-3 bg-white border border-border rounded-xl shadow-xs">
                <QRCodeSVG
                  value={getOrderingUrl(activeQrModal.tableNumber, activeQrModal.token)}
                  size={180}
                  level="M"
                  fgColor="#18181b"
                  bgColor="#ffffff"
                />
              </div>

              <div className="w-full space-y-2">
                <div className="flex items-center gap-1.5 p-2 bg-muted rounded-lg border border-border text-xs">
                  <span className="font-mono truncate flex-1 text-[11px] text-muted-foreground select-all">
                    {getOrderingUrl(activeQrModal.tableNumber, activeQrModal.token)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() =>
                      handleCopyLink(
                        getOrderingUrl(activeQrModal.tableNumber, activeQrModal.token)
                      )
                    }
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() =>
                      window.open(
                        getOrderingUrl(activeQrModal.tableNumber, activeQrModal.token),
                        "_blank"
                      )
                    }
                  >
                    <ExternalLink className="w-3 h-3" data-icon="inline-start" />
                    เปิดหน้าสั่งอาหาร
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setActiveQrModal(null)}
                    className="flex-1 text-xs"
                  >
                    เรียบร้อย
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
