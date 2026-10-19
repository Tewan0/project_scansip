/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, use } from "react";
import {
  Coffee,
  ShoppingBag,
  Plus,
  Minus,
  CheckCircle2,
  Hourglass,
  CheckCheck,
  ChevronRight,
  X,
  FileQuestion,
  Loader2,
  UtensilsCrossed,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

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

interface OrderItemResponse {
  id: string;
  menuName: string;
  unitPrice: string | number;
  quantity: number;
  specialInstruction: string | null;
}

interface CreatedOrder {
  id: string;
  orderNumber: string;
  tableNumber: number | null;
  totalAmount: string | number;
  status: "pending" | "preparing" | "served" | "completed" | "cancelled";
  paymentStatus: "unpaid" | "paid" | "refunded";
  customerNote: string | null;
  createdAt: string;
  items: OrderItemResponse[];
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

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Active Placed Order (Tracking View)
  const [activeOrder, setActiveOrder] = useState<CreatedOrder | null>(null);

  // Validate Table Session Token
  const validateSession = async () => {
    try {
      setSessionValidation((prev) => ({ ...prev, isChecking: true }));
      const res = await fetch(
        `/api/tables/validate?store=${encodeURIComponent(storeSlug)}&table=${encodeURIComponent(
          tableNumber
        )}&token=${encodeURIComponent(sessionToken)}`
      );
      const json = await res.json();
      if (json.success && json.valid) {
        setSessionValidation({ isValid: true, isChecking: false });
      } else {
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
  };

  // Load Store Info, Categories, and Menu Items specifically for this storeSlug
  const loadData = async () => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    validateSession();
    loadData();
  }, [storeSlug, tableNumber, sessionToken]);

  // Poll order status if an order has been placed
  useEffect(() => {
    if (!activeOrder || !storeInfo.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${activeOrder.id}`);
        const json = await res.json();
        if (json.success && json.data) {
          setActiveOrder(json.data);
        }
      } catch (err) {
        console.error("Polling order error:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeOrder, storeInfo.id]);

  // Cart operations
  const addToCart = (item: MenuItem) => {
    if (!item.isAvailable) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1, note: "" }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.menuItem.id === itemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateItemNote = (itemId: string, note: string) => {
    setCart((prev) =>
      prev.map((c) => (c.menuItem.id === itemId ? { ...c, note } : c))
    );
  };

  const cartTotalAmount = cart.reduce((sum, item) => {
    return sum + Number(item.menuItem.price) * item.quantity;
  }, 0);

  const cartTotalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Submit order to POST /api/orders targeting this specific store
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      setIsSubmittingOrder(true);
      const payload = {
        storeSlug,
        storeId: storeInfo.id,
        tableNumber: parseInt(tableNumber) || 1,
        sessionToken,
        customerNote: customerNote.trim() || null,
        items: cart.map((c) => ({
          menuItemId: c.menuItem.id,
          menuName: c.menuItem.name,
          unitPrice: c.menuItem.price,
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
      if (json.success && json.data) {
        setActiveOrder(json.data);
        setCart([]);
        setIsCartOpen(false);
      } else {
        alert(json.error || "เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ โปรดลองใหม่อีกครั้ง");
        if (json.sessionExpired) {
          validateSession();
        }
      }
    } catch (err) {
      console.error("Failed to checkout:", err);
      alert("เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ โปรดลองใหม่อีกครั้ง");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const filteredMenu = menuList.filter((item) => {
    if (selectedCategory === "ทั้งหมด") return true;
    return item.category?.name === selectedCategory;
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
    <div className="min-h-screen bg-muted/20 pb-28">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border shadow-2xs px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
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
            <div>
              <h1 className="font-bold text-sm text-foreground leading-tight">
                {storeInfo.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                เวลาทำการ {storeInfo.openingTime} - {storeInfo.closingTime}
              </p>
            </div>
          </div>

          <Badge variant="outline" className="font-semibold text-xs border-primary/30 text-primary bg-primary/5">
            โต๊ะ {tableNumber.padStart(2, "0")}
          </Badge>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto px-4 pt-4">
        {/* Active Placed Order Tracking View (เมื่อลูกค้าสั่งแล้ว) */}
        {activeOrder && (
          <Card className="mb-5 border-border shadow-xs">
            <CardHeader className="pb-3 pt-4 px-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    คำสั่งซื้อปัจจุบัน
                  </span>
                  <CardTitle className="font-bold text-base text-foreground">
                    {activeOrder.orderNumber}
                  </CardTitle>
                </div>
                <div>
                  {activeOrder.status === "pending" && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                      <Hourglass className="w-3 h-3 mr-1" />
                      รอยืนยัน
                    </Badge>
                  )}
                  {activeOrder.status === "preparing" && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs">
                      <Hourglass className="w-3 h-3 mr-1 animate-spin" />
                      กำลังเตรียม
                    </Badge>
                  )}
                  {activeOrder.status === "served" && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      เสิร์ฟแล้ว
                    </Badge>
                  )}
                  {activeOrder.status === "completed" && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                      <CheckCheck className="w-3 h-3 mr-1" />
                      เสร็จสิ้น
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {/* Order Items summary */}
              <div className="space-y-1.5 text-xs">
                {activeOrder.items?.map((it) => (
                  <div key={it.id} className="flex justify-between items-center text-foreground">
                    <span>
                      <strong className="text-primary font-semibold">{it.quantity}x</strong> {it.menuName}
                      {it.specialInstruction && (
                        <span className="text-muted-foreground block text-[11px] pl-3">
                          ({it.specialInstruction})
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-foreground">
                      ฿{(Number(it.unitPrice) * it.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-foreground">ยอดรวมทั้งหมด</span>
                <span className="text-primary text-base">฿{Number(activeOrder.totalAmount).toFixed(2)}</span>
              </div>

              {/* PromptPay QR Code Payment section */}
              {storeInfo.promptPayNumber && (
                <div className="p-3 bg-muted/40 rounded-xl border border-border text-center mt-3">
                  <p className="text-xs font-semibold text-foreground mb-0.5">
                    สแกนชำระเงินผ่านพร้อมเพย์
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    เบอร์: <strong className="text-foreground">{storeInfo.promptPayNumber}</strong>
                  </p>
                  <div className="w-28 h-28 mx-auto bg-white p-2 rounded-lg border border-border shadow-2xs flex items-center justify-center">
                    <img
                      alt="PromptPay QR Code"
                      className="w-full h-full object-contain"
                      src={`https://promptpay.io/${storeInfo.promptPayNumber.replace(/-/g, "")}/${activeOrder.totalAmount}.png`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=PROMPTPAY_${storeInfo.promptPayNumber}`;
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    เมื่อโอนแล้ว แจ้งพนักงานเพื่อเช็คบิลได้ทันทีครับ
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
            <p className="text-sm font-medium text-foreground">ไม่พบรายการเมนูในหมวดนี้</p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {filteredMenu.map((item) => (
              <Card
                key={item.id}
                className={`p-3 flex gap-3 border-border shadow-2xs transition-all ${
                  !item.isAvailable ? "opacity-60" : ""
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
                <div className="flex-1 flex flex-col justify-between py-0.5">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground line-clamp-1">
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
                        onClick={() => addToCart(item)}
                        className="rounded-full shadow-2xs cursor-pointer"
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
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-40">
          <Button
            type="button"
            size="lg"
            onClick={() => setIsCartOpen(true)}
            className="w-full h-12 shadow-lg flex items-center justify-between cursor-pointer rounded-xl px-4"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary-foreground text-primary flex items-center justify-center font-bold text-xs">
                {cartTotalItemsCount}
              </span>
              <span className="font-semibold text-sm">ดูรายการในตะกร้า</span>
            </div>
            <div className="flex items-center gap-1 font-bold text-base">
              <span>฿{cartTotalAmount.toFixed(2)}</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </Button>
        </div>
      )}

      {/* Cart Modal / Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
          <Card className="w-full max-w-md rounded-b-none sm:rounded-xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden border-border bg-card">
            {/* Header */}
            <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-bold">
                  ตะกร้าสั่งอาหาร (โต๊ะ {tableNumber.padStart(2, "0")})
                </CardTitle>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsCartOpen(false)}
                className="cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            {/* Cart Item List */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((c) => (
                <div
                  key={c.menuItem.id}
                  className="p-3 rounded-lg border border-border bg-muted/30 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        {c.menuItem.name}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        ฿{Number(c.menuItem.price).toFixed(2)} / รายการ
                      </span>
                    </div>
                    <span className="font-bold text-sm text-foreground">
                      ฿{(Number(c.menuItem.price) * c.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* Note for kitchen */}
                  <input
                    type="text"
                    placeholder="หมายเหตุเพิ่มเติม (เช่น หวานน้อย, แยกน้ำแข็ง)..."
                    value={c.note}
                    onChange={(e) => updateItemNote(c.menuItem.id, e.target.value)}
                    className="w-full text-xs p-2 rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                  />

                  {/* Quantity Stepper */}
                  <div className="flex items-center justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      onClick={() => updateQuantity(c.menuItem.id, -1)}
                      className="rounded-full cursor-pointer"
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
                      className="rounded-full cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Order Level Customer Note */}
              <div className="pt-1">
                <label className="block text-xs font-medium text-foreground mb-1">
                  ข้อความถึงครัว / ร้านค้า
                </label>
                <input
                  type="text"
                  placeholder="เช่น รับของพร้อมกัน, ขอจานแบ่ง..."
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  className="w-full text-xs p-2 rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </CardContent>

            {/* Footer Checkout */}
            <CardFooter className="p-4 border-t border-border flex flex-col gap-3">
              <div className="flex justify-between items-center w-full font-bold">
                <span className="text-sm text-foreground">ยอดชำระทั้งหมด</span>
                <span className="text-lg text-primary">฿{cartTotalAmount.toFixed(2)}</span>
              </div>

              <Button
                type="button"
                size="lg"
                onClick={handleCheckout}
                disabled={isSubmittingOrder}
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
                    ยืนยันส่งคำสั่งซื้อ
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}

