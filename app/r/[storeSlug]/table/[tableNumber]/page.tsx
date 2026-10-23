/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { CustomerSessionPanel } from "@/components/customer-session-panel";
import { CustomerChatbot } from "@/components/customer-chatbot";
import { useCustomerCart } from "@/hooks/use-customer-cart";
import { cartStorageKey, MAX_CART_LINES, MAX_CART_QUANTITY } from "@/lib/customer-cart";
import {
  Coffee,
  ShoppingBag,
  Plus,
  Minus,
  ChevronRight,
  X,
  FileQuestion,
  Loader2,
  UtensilsCrossed,
  Check,
  Trash2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import { useSearchParams } from "next/navigation";

interface Category {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string | null;
  category?: Category | null;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  note: string;
}

interface TablePageProps {
  params: Promise<{ storeSlug: string; tableNumber: string }>;
}

export default function TenantCustomerTableOrderingPage({ params }: TablePageProps) {
  const resolvedParams = use(params);
  const storeSlug = resolvedParams.storeSlug;
  const tableNumber = resolvedParams.tableNumber;
  const searchParams = useSearchParams();
  const sessionToken = searchParams.get("token") || "";
  const cartKey = cartStorageKey(storeSlug, tableNumber, sessionToken);
  return <CustomerOrdering key={cartKey || JSON.stringify([storeSlug, tableNumber])}
    storeSlug={storeSlug} tableNumber={tableNumber} sessionToken={sessionToken} cartKey={cartKey} />;
}

function CustomerOrdering({ storeSlug, tableNumber, sessionToken, cartKey }: {
  storeSlug: string; tableNumber: string; sessionToken: string; cartKey: string;
}) {

  // Table Session Validation State
  const [sessionValidation, setSessionValidation] = useState<{
    isValid: boolean;
    isChecking: boolean;
    reason?: string;
    message?: string;
  }>({
    isValid: true,
    isChecking: true,
  });

  const [storeInfo, setStoreInfo] = useState<{
    id?: string;
    name: string;
    promptPayNumber: string | null;
    openingTime: string;
    closingTime: string;
    logoUrl?: string | null;
  }>({
    name: "กำลังโหลดชื่อร้าน...",
    promptPayNumber: null,
    openingTime: "08:00",
    closingTime: "18:00",
    logoUrl: null,
  });

  const [menuList, setMenuList] = useState<MenuItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ทั้งหมด");
  const [isLoading, setIsLoading] = useState(true);
  const [menuLoadError, setMenuLoadError] = useState("");

  // Cart State
  const { draft, ready: cartReady, persistent, updateDraft, beginCheckout, releaseCheckout } = useCustomerCart(cartKey);
  const customerNote = draft.customerNote;
  const cart: CartItem[] = draft.items.map((line) => ({
    menuItem: menuList.find((item) => item.id === line.menuItemId) ?? {
      id: line.menuItemId, name: line.name, description: null, price: 0,
      imageUrl: null, isAvailable: false, categoryId: null,
    }, quantity: line.quantity, note: line.note,
  }));
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const checkoutInFlight = useRef(false);
  const [checkoutError, setCheckoutError] = useState("");

  const [historyRevision, setHistoryRevision] = useState(0);

  // Search and Item Detail Modal
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [detailNote, setDetailNote] = useState("");

  // Validate Table Session Token
  const validateSession = useCallback(async () => {
    try {
      setSessionValidation((prev) => ({ ...prev, isChecking: true }));
      const res = await fetch(
        `/api/tables/validate?store=${encodeURIComponent(storeSlug)}&table=${encodeURIComponent(
          tableNumber
        )}&token=${encodeURIComponent(sessionToken)}`
      );
      const json = await res.json();
      if (res.ok && json.success && json.valid) {
        setSessionValidation({ isValid: true, isChecking: false });
      } else {
        if (json.success && ["table_closed", "session_expired"].includes(json.reason)) {
          updateDraft(() => ({ items: [], customerNote: "" }));
        }
        setSessionValidation({
          isValid: false,
          isChecking: false,
          reason: json.reason,
          message: json.message || "โต๊ะนี้ยังไม่ได้เปิดใช้งาน กรุณาติดต่อพนักงาน",
        });
      }
    } catch (err) {
      console.error("Session validation error:", err);
      setSessionValidation({
        isValid: false,
        isChecking: false,
        message: "ไม่สามารถตรวจสอบสถานะของโต๊ะได้ กรุณาติดต่อพนักงาน",
      });
    }
  }, [storeSlug, tableNumber, sessionToken, updateDraft]);

  // Load Store Info, Categories, and Menu Items specifically for this storeSlug
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setMenuLoadError("");
      const [storeRes, catRes, menuRes] = await Promise.all([
        fetch(`/api/store?store=${encodeURIComponent(storeSlug)}`),
        fetch(`/api/categories?store=${encodeURIComponent(storeSlug)}`),
        fetch(`/api/menu?store=${encodeURIComponent(storeSlug)}`),
      ]);

      const [storeJson, catJson, menuJson] = await Promise.all([
        storeRes.json(),
        catRes.json(),
        menuRes.json(),
      ]);
      if (!storeRes.ok || !catRes.ok || !menuRes.ok || !storeJson.success || !catJson.success || !menuJson.success) {
        throw new Error("โหลดเมนูไม่สำเร็จ รายการในตะกร้ายังเก็บไว้ กรุณาลองอีกครั้ง");
      }

      if (storeJson.success && storeJson.data) {
        setStoreInfo({
          id: storeJson.data.id,
          name: storeJson.data.name,
          promptPayNumber: storeJson.data.promptPayNumber,
          openingTime: storeJson.data.openingTime,
          closingTime: storeJson.data.closingTime,
          logoUrl: storeJson.data.logoUrl || null,
        });
      }

      if (catJson.success && catJson.data) {
        setCategoriesList(catJson.data);
      }

      if (menuJson.success && menuJson.data) {
        setMenuList(menuJson.data);
      }
    } catch (err) {
      console.error("Error loading customer menu:", err);
      setMenuLoadError("โหลดเมนูไม่สำเร็จ รายการในตะกร้ายังเก็บไว้ กรุณาลองอีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  }, [storeSlug]);

  useEffect(() => {
    const timer = setTimeout(() => { void validateSession(); void loadData(); }, 0);
    return () => clearTimeout(timer);
  }, [validateSession, loadData]);

  // Cart operations
  const addToCart = (item: MenuItem, qty = 1, note = "") => {
    if (!item.isAvailable || !canEditCart) return false;
    const existing = draft.items.find((line) => line.menuItemId === item.id);
    if (existing && existing.quantity + qty > MAX_CART_QUANTITY) return false;
    if (!existing && draft.items.length >= MAX_CART_LINES) return false;
    updateDraft((previous) => ({ ...previous, items: existing
      ? previous.items.map((line) => line.menuItemId === item.id
          ? { ...line, quantity: Math.min(MAX_CART_QUANTITY, line.quantity + qty), note: note ? `${line.note ? line.note + " · " : ""}${note}`.slice(0, 300) : line.note }
          : line)
      : [...previous.items, { menuItemId: item.id, name: item.name, quantity: qty, note: note.slice(0, 300) }],
    }));
    return true;
  };

  const updateQuantity = (itemId: string, delta: number) => {
    if (!cartReady || checkoutInFlight.current || draft.requestId) return;
    updateDraft((previous) => ({ ...previous, items: previous.items
      .map((line) => line.menuItemId === itemId ? { ...line, quantity: Math.min(MAX_CART_QUANTITY, line.quantity + delta) } : line)
      .filter((line) => line.quantity > 0) }));
  };

  const updateItemNote = (itemId: string, note: string) => {
    if (checkoutInFlight.current || draft.requestId) return;
    updateDraft((previous) => ({ ...previous, items: previous.items.map((line) => line.menuItemId === itemId ? { ...line, note: note.slice(0, 300) } : line) }));
  };

  const canCheckout = cartReady && !sessionValidation.isChecking && sessionValidation.isValid && !isSubmittingOrder && (Boolean(draft.requestId) || (!isLoading && !menuLoadError));
  const canEditCart = canCheckout && !draft.requestId;
  const hasUnavailableItems = cart.some((line) => !line.menuItem.isAvailable);

  const cartTotalAmount = cart.reduce((sum, item) => {
    return sum + Number(item.menuItem.price) * item.quantity;
  }, 0);

  const cartTotalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Submit order to POST /api/orders targeting this specific store
  const handleCheckout = async () => {
    if (!canCheckout || !cart.length || (hasUnavailableItems && !draft.requestId) || checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    try {
      setIsSubmittingOrder(true);
      setCheckoutError("");
      const attempt = beginCheckout();
      const payload = {
        requestId: attempt.requestId,
        storeSlug,
        storeId: storeInfo.id,
        tableNumber: parseInt(tableNumber) || 1,
        sessionToken,
        customerNote: attempt.customerNote.trim() || null,
        items: attempt.items.map((c) => ({
          menuItemId: c.menuItemId,
          menuName: c.name,
          unitPrice: menuList.find((item) => item.id === c.menuItemId)?.price,
          quantity: c.quantity,
          specialInstruction: c.note.trim() || null,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        updateDraft(() => ({ items: [], customerNote: "" }));
        setHistoryRevision((previous) => previous + 1);
        setIsCartOpen(false);
      } else {
        // These responses mean the request was rejected before creating an order.
        // Keep the key on server/network failures, where the commit may have succeeded.
        if ([400, 403, 404].includes(res.status)) releaseCheckout();
        setCheckoutError(json.error || "ส่งคำสั่งซื้อไม่สำเร็จ รายการในตะกร้ายังอยู่ กรุณาลองใหม่");
        if (json.sessionExpired) {
          validateSession();
        }
      }
    } catch (err) {
      console.error("Failed to checkout:", err);
      setCheckoutError("ยังยืนยันผลการส่งไม่ได้ กดตรวจสอบการส่งอีกครั้ง ระบบจะใช้รหัสเดิมเพื่อป้องกันออเดอร์ซ้ำ");
    } finally {
      checkoutInFlight.current = false;
      setIsSubmittingOrder(false);
    }
  };

  const filteredMenu = menuList.filter((item) => {
    const matchesCategory = selectedCategory === "ทั้งหมด" || item.category?.name === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || item.name.toLowerCase().includes(q) || (item.description && item.description.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  // If table is not open or token is expired/invalid -> Show blocked screen
  if (!sessionValidation.isChecking && !sessionValidation.isValid) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm border-border text-center shadow-xs">
          <CardHeader className="pt-8 pb-4">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold">
              โต๊ะ {tableNumber.padStart(2, "0")} ยังไม่พร้อมสั่งอาหาร
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-6">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {sessionValidation.message ||
                "โต๊ะนี้ยังไม่ได้เปิดใช้งาน หรือเช็คบิลออกจากร้านแล้ว กรุณาสแกน QR Code ใหม่จากพนักงาน"}
            </p>

            <div className="p-3 bg-muted/50 rounded-lg text-xs border border-border">
              <p className="font-semibold text-foreground">วิธีใช้งาน:</p>
              <p className="text-muted-foreground mt-0.5">
                แจ้งพนักงานที่หน้าร้านเพื่อเปิดโต๊ะและขอรับ QR Code รอบบิลของคุณ
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={validateSession}
              className="w-full text-xs"
            >
              ลองตรวจสอบสถานะอีกครั้ง
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border shadow-2xs px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-primary flex items-center justify-center text-primary-foreground shadow-2xs shrink-0">
              {storeInfo.logoUrl ? (
                <img
                  src={storeInfo.logoUrl}
                  alt={storeInfo.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Coffee className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-bold text-sm text-foreground leading-tight">
                {storeInfo.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                เวลาทำการ {storeInfo.openingTime} - {storeInfo.closingTime}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Badge variant="outline" className="font-semibold text-xs border-primary/30 text-primary bg-primary/5">
              โต๊ะ {tableNumber.padStart(2, "0")}
            </Badge>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!cartReady}
              onClick={() => setIsCartOpen(true)}
              aria-label={`เปิดตะกร้า ${cartTotalItemsCount} รายการ`}
              className="relative flex size-9 items-center justify-center p-0 rounded-lg border-border cursor-pointer active:scale-95 transition-all shadow-2xs"
            >
              <ShoppingBag className="size-4 text-foreground" />
              {cartTotalItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-xs animate-popIn">
                  {cartTotalItemsCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto px-4 pt-4">
        <CustomerChatbot key={JSON.stringify([storeSlug, tableNumber, sessionToken])} storeSlug={storeSlug} tableNumber={tableNumber} sessionToken={sessionToken}
          enabled={!!canEditCart} onSessionExpired={validateSession}
          onAdd={(id) => { const item = menuList.find((menu) => menu.id === id); return item ? addToCart(item) : false; }} />
        {cartReady && !persistent && <p role="alert" className="mb-3 rounded-lg border border-amber-500/40 p-3 text-sm text-foreground">
          เบราว์เซอร์ไม่อนุญาตให้บันทึกตะกร้า รายการอาจหายเมื่อรีเฟรชหรือปิดหน้านี้
        </p>}
        {menuLoadError && <div role="alert" className="mb-3 rounded-lg border border-destructive/40 p-3 text-sm">
          <p>{menuLoadError}</p><Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => void loadData()}>ลองโหลดเมนูอีกครั้ง</Button>
        </div>}
        <CustomerSessionPanel storeSlug={storeSlug} tableNumber={tableNumber} sessionToken={sessionToken}
          enabled={!sessionValidation.isChecking && sessionValidation.isValid} refreshKey={historyRevision}
          onSessionExpired={validateSession} promptPayNumber={storeInfo.promptPayNumber} />

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="ค้นหาชื่อเมนู เช่น กาแฟ, ชา..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 h-9 text-xs bg-card rounded-xl border border-border shadow-2xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 cursor-pointer"
              aria-label="ล้างคำค้นหา"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Categories Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-3">
          <Button
            type="button"
            variant={selectedCategory === "ทั้งหมด" ? "default" : "outline"}
            size="xs"
            onClick={() => setSelectedCategory("ทั้งหมด")}
            className="rounded-full text-xs cursor-pointer shadow-2xs shrink-0"
          >
            ทั้งหมด
          </Button>
          {categoriesList.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              variant={selectedCategory === cat.name ? "default" : "outline"}
              size="xs"
              onClick={() => setSelectedCategory(cat.name)}
              className="rounded-full text-xs cursor-pointer shadow-2xs shrink-0"
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Menu Items List */}
        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-3 flex gap-3 border-border shadow-2xs">
                <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
                <div className="flex-1 flex flex-col justify-between py-0.5 space-y-2">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-3/4 rounded" />
                    <Skeleton className="h-3 w-full rounded" />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-5 w-14 rounded" />
                    <Skeleton className="size-6 rounded-full" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredMenu.length === 0 ? (
          <Card className="p-8 text-center my-6 border-dashed border-border shadow-none">
            <UtensilsCrossed className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-foreground">
              {searchQuery ? `ไม่พบเมนูที่ตรงกับ "${searchQuery}"` : "ไม่พบรายการเมนูในหมวดนี้"}
            </p>
            {searchQuery && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-3 text-xs"
              >
                ล้างการค้นหา
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-2.5">
            {filteredMenu.map((item) => (
              <Card
                key={item.id}
                onClick={() => {
                  if (item.isAvailable) {
                    setSelectedMenuItem(item);
                    setDetailQuantity(1);
                    setDetailNote("");
                  }
                }}
                className={`p-3 flex flex-row gap-3 border-border shadow-2xs transition-all ${
                  !item.isAvailable
                    ? "opacity-60"
                    : "cursor-pointer hover:border-primary/40 active:scale-[0.99]"
                }`}
              >
                {/* Menu Image */}
                <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden shrink-0 relative flex items-center justify-center border border-border">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileQuestion className="w-6 h-6 text-muted-foreground/40" />
                  )}
                  {!item.isAvailable && (
                    <span className="absolute inset-0 bg-background/80 text-foreground text-[10px] font-bold flex items-center justify-center backdrop-blur-2xs">
                      หมด
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                  <div>
                    <h3 className="break-words font-semibold text-sm leading-relaxed text-foreground">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-bold text-primary text-sm">
                      ฿{Number(item.price).toFixed(2)}
                    </span>

                    {item.isAvailable ? (
                      <Button
                        type="button"
                        size="icon-xs"
                        onClick={(e) => {
                          e?.stopPropagation?.();
                          addToCart(item);
                        }}
                        disabled={!canEditCart}
                        aria-label={`เพิ่ม ${item.name} ลงตะกร้า`}
                        className="size-11 rounded-full shadow-2xs cursor-pointer active:scale-90 transition-transform"
                        title="เพิ่มลงตะกร้า"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        สินค้าหมด
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {!isCartOpen && (
        <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] inset-x-4 max-w-md mx-auto z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Button
            type="button"
            size="lg"
            onClick={() => setIsCartOpen(true)}
            disabled={!cartReady}
            aria-label={`เปิดตะกร้า ${cartTotalItemsCount} รายการ`}
            className="w-full h-12 shadow-xl shadow-primary/15 hover:shadow-2xl flex items-center justify-between cursor-pointer rounded-xl px-4 active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-2">
              <span
                key={cartTotalItemsCount}
                className="w-6 h-6 rounded-full bg-primary-foreground text-primary flex items-center justify-center font-bold text-xs animate-popIn"
              >
                {cartTotalItemsCount}
              </span>
              <span className="font-semibold text-sm">{cart.length ? "ดูรายการในตะกร้า" : "เปิดตะกร้า"}</span>
            </div>
            <div className="flex items-center gap-1 font-bold text-base">
              <span>฿{cartTotalAmount.toFixed(2)}</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </Button>
        </div>
      )}

      {/* Cart Modal / Drawer */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent showCloseButton={false} className="bottom-0 top-auto max-w-full translate-y-0 rounded-b-none p-0 sm:bottom-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2 sm:rounded-xl">
          <Card className="w-full max-h-[85dvh] gap-0 rounded-b-none border-0 py-0 sm:rounded-xl flex flex-col shadow-xl overflow-hidden bg-card">
            {/* Header */}
            <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 p-4 border-b border-border">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary" />
                <DialogTitle className="text-sm font-bold">
                  ตะกร้าสั่งอาหาร (โต๊ะ {tableNumber.padStart(2, "0")})
                </DialogTitle>
                </div>
                <DialogDescription className="mt-1 text-xs">ตรวจรายการและหมายเหตุก่อนส่งให้ครัว</DialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsCartOpen(false)}
                aria-label="ปิดตะกร้า"
                className="size-11 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            {/* Cart Item List */}
            <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
              {cart.length > 0 && persistent && <p className="text-xs text-muted-foreground">เก็บตะกร้าไว้ในเบราว์เซอร์นี้ รีเฟรชแล้วเลือกต่อได้</p>}
              {cart.length === 0 && <div className="py-8 text-center">
                <ShoppingBag className="mx-auto mb-3 size-10 text-muted-foreground" />
                <p className="font-semibold">ตะกร้ายังว่างอยู่</p>
                <p className="mt-1 text-sm text-muted-foreground">เลือกเมนูที่ชอบแล้วกดปุ่ม + เพื่อเพิ่มได้เลย</p>
                <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={() => setIsCartOpen(false)}>เลือกเมนู</Button>
              </div>}
              {cartReady && !persistent && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">บันทึกตะกร้าในเบราว์เซอร์ไม่ได้ กรุณาอย่ารีเฟรชก่อนส่งออเดอร์</p>}
              {isLoading && cart.length > 0 && <p role="status" className="text-sm text-muted-foreground">กำลังตรวจราคาและเมนูปัจจุบัน...</p>}
              {cart.map((c) => (
                <div
                  key={c.menuItem.id}
                  className="p-3 rounded-lg border border-border bg-muted/30 space-y-2"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h4 className="break-words font-semibold text-sm text-foreground">
                        {c.menuItem.name}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        ฿{Number(c.menuItem.price).toFixed(2)} / รายการ
                      </span>
                    </div>
                    <span className="shrink-0 font-bold text-sm text-foreground">
                      ฿{(Number(c.menuItem.price) * c.quantity).toFixed(2)}
                    </span>
                  </div>
                  {!draft.requestId && !isLoading && !menuLoadError && !c.menuItem.isAvailable && <p className="text-sm text-destructive">เมนูนี้หมดหรือไม่มีในร้านแล้ว กรุณานำออกก่อนสั่ง</p>}

                  {/* Note for kitchen */}
                  <input
                    type="text"
                    placeholder="หมายเหตุเพิ่มเติม (เช่น หวานน้อย, แยกน้ำแข็ง)..."
                    value={c.note}
                    aria-label={`หมายเหตุสำหรับ ${c.menuItem.name}`}
                    maxLength={300}
                    disabled={isSubmittingOrder || Boolean(draft.requestId)}
                    onChange={(e) => updateItemNote(c.menuItem.id, e.target.value)}
                    className="min-h-11 w-full text-base sm:text-sm p-2 rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                  />

                  {/* Quantity Stepper */}
                  <div className="flex flex-wrap items-center justify-end gap-2.5">
                    <Button type="button" variant="ghost" className="mr-auto min-h-11" disabled={isSubmittingOrder || Boolean(draft.requestId)}
                      aria-label={`นำ ${c.menuItem.name} ออกจากตะกร้า`} onClick={() => updateDraft((previous) => ({ ...previous, items: previous.items.filter((line) => line.menuItemId !== c.menuItem.id) }))}>
                      <Trash2 className="size-4" /> นำออก
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      onClick={() => updateQuantity(c.menuItem.id, -1)}
                      aria-label={`ลดจำนวน ${c.menuItem.name}`}
                      disabled={isSubmittingOrder || Boolean(draft.requestId)}
                      className="size-11 rounded-full cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="font-semibold text-sm w-6 text-center">
                      {c.quantity}
                    </span>
                    <Button
                      type="button"
                      size="icon-xs"
                      onClick={() => updateQuantity(c.menuItem.id, 1)}
                      aria-label={`เพิ่มจำนวน ${c.menuItem.name}`}
                      disabled={!canEditCart || !c.menuItem.isAvailable || c.quantity >= MAX_CART_QUANTITY}
                      className="size-11 rounded-full cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Order Level Customer Note */}
              {cart.length > 0 && <div className="pt-1">
                <label htmlFor="customer-note" className="block text-xs font-medium text-foreground mb-1">
                  ข้อความถึงครัว / ร้านค้า
                </label>
                <input
                  id="customer-note"
                  type="text"
                  placeholder="เช่น รับของพร้อมกัน, ขอจานแบ่ง..."
                  value={customerNote}
                  maxLength={500}
                  disabled={isSubmittingOrder || Boolean(draft.requestId)}
                  onChange={(e) => updateDraft((previous) => ({ ...previous, customerNote: e.target.value }))}
                  className="min-h-11 w-full text-base sm:text-sm p-2 rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                />
              </div>}
            </CardContent>

            {/* Footer Checkout */}
            <CardFooter className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border flex flex-col gap-3">
              {draft.requestId && <p role="status" className="text-sm text-muted-foreground">มีรายการรอยืนยันผล กรุณาตรวจสอบการส่งเดิมก่อนแก้ตะกร้าหรือสั่งเพิ่ม</p>}
              {checkoutError && <p role="alert" className="w-full text-sm text-destructive">{checkoutError}</p>}
              {hasUnavailableItems && !draft.requestId && !isLoading && !menuLoadError && <p className="w-full text-sm text-destructive">กรุณานำเมนูที่สั่งไม่ได้ออกจากตะกร้าก่อน</p>}
              <div className="flex justify-between items-center w-full font-bold">
                <span className="text-sm text-foreground">ยอดชำระทั้งหมด</span>
                <span className="text-lg text-primary">฿{cartTotalAmount.toFixed(2)}</span>
              </div>

              <Button
                type="button"
                size="lg"
                onClick={handleCheckout}
                disabled={!canCheckout || !cart.length || (hasUnavailableItems && !draft.requestId)}
                className="w-full h-11 text-sm font-semibold cursor-pointer shadow-xs justify-center"
              >
                {isSubmittingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" data-icon="inline-start" />
                    กำลังส่งคำสั่งซื้อไปยังครัว...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" data-icon="inline-start" />
                    {draft.requestId ? "ตรวจสอบการส่งอีกครั้ง" : "ยืนยันส่งคำสั่งซื้อ"}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </DialogContent>
      </Dialog>

      {/* Item Detail Modal */}
      <Dialog open={!!selectedMenuItem} onOpenChange={(open) => !open && setSelectedMenuItem(null)}>
        <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden bg-card border-border">
          {selectedMenuItem && (
            <div>
              {/* Image banner */}
              <div className="relative aspect-video w-full bg-muted flex items-center justify-center overflow-hidden border-b border-border">
                {selectedMenuItem.imageUrl ? (
                  <img
                    src={selectedMenuItem.imageUrl}
                    alt={selectedMenuItem.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Coffee className="size-12 text-muted-foreground/40" />
                )}
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg text-foreground leading-tight">
                      {selectedMenuItem.name}
                    </h3>
                    <span className="font-bold text-lg text-primary shrink-0">
                      ฿{Number(selectedMenuItem.price).toFixed(2)}
                    </span>
                  </div>
                  {selectedMenuItem.description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {selectedMenuItem.description}
                    </p>
                  )}
                </div>

                {/* Special Instruction Note */}
                <div className="space-y-1.5">
                  <label htmlFor="item-detail-note" className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>หมายเหตุถึงครัว (ไม่บังคับ)</span>
                    <span className="text-[10px] text-muted-foreground">{detailNote.length}/300</span>
                  </label>
                  <textarea
                    id="item-detail-note"
                    rows={2}
                    maxLength={300}
                    placeholder="เช่น หวานน้อย, แยกน้ำแข็ง, ไม่ใส่ผักชี..."
                    value={detailNote}
                    onChange={(e) => setDetailNote(e.target.value)}
                    className="w-full rounded-xl border border-border bg-muted/30 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                {/* Quantity and Add Button */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">จำนวน</span>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        className="size-8 rounded-lg cursor-pointer"
                        disabled={detailQuantity <= 1}
                        onClick={() => setDetailQuantity((q) => Math.max(1, q - 1))}
                        aria-label="ลดจำนวน"
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="font-bold text-sm min-w-5 text-center">{detailQuantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        className="size-8 rounded-lg cursor-pointer"
                        disabled={detailQuantity >= MAX_CART_QUANTITY}
                        onClick={() => setDetailQuantity((q) => Math.min(MAX_CART_QUANTITY, q + 1))}
                        aria-label="เพิ่มจำนวน"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="w-full h-11 rounded-xl text-sm font-semibold justify-center cursor-pointer shadow-xs"
                    disabled={!canEditCart}
                    onClick={() => {
                      addToCart(selectedMenuItem, detailQuantity, detailNote.trim());
                      setSelectedMenuItem(null);
                      setDetailNote("");
                      setDetailQuantity(1);
                    }}
                  >
                    <span>เพิ่มลงตะกร้า</span>
                    <span className="ml-1.5 opacity-90">· ฿{(Number(selectedMenuItem.price) * detailQuantity).toFixed(2)}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

