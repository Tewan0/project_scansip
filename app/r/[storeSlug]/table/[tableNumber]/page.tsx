/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, use } from "react";
import {
  Coffee,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Clock,
  CheckCircle2,
  Hourglass,
  CheckCheck,
  ChevronRight,
  ArrowLeft,
  X,
  FileQuestion,
  Loader2,
  CreditCard,
  QrCode,
  UtensilsCrossed,
  Check,
} from "lucide-react";

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

  const [storeInfo, setStoreInfo] = useState<{
    id?: string;
    name: string;
    promptPayNumber: string | null;
    openingTime: string;
    closingTime: string;
  }>({
    name: "กำลังโหลดชื่อร้าน...",
    promptPayNumber: null,
    openingTime: "08:00",
    closingTime: "18:00",
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
    loadData();
  }, [storeSlug]);

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

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#191c1d] pb-28">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border-subtle shadow-xs px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-xs">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base text-primary leading-tight">
                {storeInfo.name}
              </h1>
              <p className="text-xs text-on-surface-variant flex items-center gap-1">
                <span>เวลาเปิด-ปิด: {storeInfo.openingTime} - {storeInfo.closingTime}</span>
              </p>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-full text-xs font-bold shrink-0">
            โต๊ะ {tableNumber.padStart(2, "0")}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto px-4 pt-4">
        {/* Active Placed Order Tracking View (เมื่อลูกค้าสั่งแล้ว) */}
        {activeOrder && (
          <section className="mb-6 p-4 rounded-2xl bg-white border border-primary/20 shadow-md animate-fadeIn">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-3">
              <div>
                <span className="text-[11px] font-semibold text-primary/80 uppercase tracking-wider">
                  คำสั่งซื้อปัจจุบัน
                </span>
                <h3 className="font-bold text-lg text-primary">
                  {activeOrder.orderNumber}
                </h3>
              </div>
              <div className="text-right">
                {activeOrder.status === "pending" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                    <Hourglass className="w-3.5 h-3.5" />
                    รอยืนยันออเดอร์
                  </span>
                )}
                {activeOrder.status === "preparing" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                    <Hourglass className="w-3.5 h-3.5 animate-spin" />
                    ครัวกำลังเตรียม
                  </span>
                )}
                {activeOrder.status === "served" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    เสิร์ฟอาหารแล้ว
                  </span>
                )}
                {activeOrder.status === "completed" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    <CheckCheck className="w-3.5 h-3.5" />
                    เสร็จสิ้น
                  </span>
                )}
              </div>
            </div>

            {/* Order Items summary */}
            <div className="space-y-1.5 mb-3 text-xs">
              {activeOrder.items?.map((it) => (
                <div key={it.id} className="flex justify-between items-center text-on-surface">
                  <span>
                    <strong className="text-primary">{it.quantity}x</strong> {it.menuName}
                    {it.specialInstruction && (
                      <span className="text-on-surface-variant block text-[11px] pl-3">
                        ({it.specialInstruction})
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-on-surface">
                    ฿{(Number(it.unitPrice) * it.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-dashed border-border-subtle flex justify-between items-center text-sm font-bold">
              <span>ยอดรวมทั้งหมด</span>
              <span className="text-primary text-base">฿{Number(activeOrder.totalAmount).toFixed(2)}</span>
            </div>

            {/* PromptPay QR Code Payment section */}
            {storeInfo.promptPayNumber && (
              <div className="mt-4 p-3 bg-secondary-container/20 rounded-xl border border-secondary/20 text-center">
                <p className="text-xs font-semibold text-primary mb-1">
                  สแกนชำระเงินผ่านพร้อมเพย์
                </p>
                <p className="text-[11px] text-on-surface-variant mb-2">
                  เบอร์: <strong>{storeInfo.promptPayNumber}</strong>
                </p>
                <div className="w-32 h-32 mx-auto bg-white p-2 rounded-lg border border-border-subtle shadow-xs flex items-center justify-center">
                  <img
                    alt="PromptPay QR Code"
                    className="w-full h-full object-contain"
                    src={`https://promptpay.io/${storeInfo.promptPayNumber.replace(/-/g, "")}/${activeOrder.totalAmount}.png`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=PROMPTPAY_${storeInfo.promptPayNumber}`;
                    }}
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-2">
                  เมื่อโอนแล้ว แจ้งพนักงานเพื่อเช็คบิลได้ทันทีครับ
                </p>
              </div>
            )}
          </section>
        )}

        {/* Categories Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-4">
          <button
            type="button"
            onClick={() => setSelectedCategory("ทั้งหมด")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === "ทั้งหมด"
                ? "bg-primary text-on-primary shadow-xs"
                : "bg-white text-on-surface border border-border-subtle hover:bg-surface-container"
            }`}
          >
            ทั้งหมด
          </button>
          {categoriesList.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.name
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-white text-on-surface border border-border-subtle hover:bg-surface-container"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
            <p className="text-xs">กำลังโหลดเมนูอร่อยๆ สักครู่ครับ...</p>
          </div>
        ) : filteredMenu.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border-subtle p-8 text-center my-6">
            <UtensilsCrossed className="w-8 h-8 mx-auto text-on-surface-variant/40 mb-2" />
            <p className="text-sm font-semibold text-on-surface">ไม่พบรายการเมนูในหมวดนี้</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMenu.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border border-border-subtle p-3 flex gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all ${
                  !item.isAvailable ? "opacity-60" : ""
                }`}
              >
                {/* Menu Image */}
                <div className="w-24 h-24 rounded-xl bg-surface-container-high overflow-hidden shrink-0 relative flex items-center justify-center">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileQuestion className="w-8 h-8 text-on-surface-variant/30" />
                  )}
                  {!item.isAvailable && (
                    <span className="absolute inset-0 bg-black/50 text-white text-[10px] font-bold flex items-center justify-center backdrop-blur-xs">
                      สินค้าหมด
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-between py-0.5">
                  <div>
                    <h3 className="font-bold text-sm text-on-surface line-clamp-1">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 mt-1">
                    <span className="font-bold text-primary text-sm">
                      ฿{Number(item.price).toFixed(2)}
                    </span>

                    {item.isAvailable ? (
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-xs active:scale-90 transition-transform cursor-pointer"
                        title="เพิ่มลงตะกร้า"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-[11px] text-error font-medium">ของหมด</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-40 animate-slideUp">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-primary text-on-primary p-3.5 rounded-2xl shadow-xl flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                {cartTotalItemsCount}
              </div>
              <span className="font-bold text-sm">ดูตะกร้าของคุณ</span>
            </div>
            <div className="flex items-center gap-1 font-bold text-base">
              <span>฿{cartTotalAmount.toFixed(2)}</span>
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Modal / Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-bright">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base text-on-surface">
                  ตะกร้าสั่งอาหาร (โต๊ะ {tableNumber.padStart(2, "0")})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Item List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((c) => (
                <div
                  key={c.menuItem.id}
                  className="bg-surface-card p-3 rounded-xl border border-border-subtle"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-on-surface">
                        {c.menuItem.name}
                      </h4>
                      <span className="text-xs text-primary font-semibold">
                        ฿{Number(c.menuItem.price).toFixed(2)} / ชิ้น
                      </span>
                    </div>
                    <span className="font-bold text-sm text-on-surface">
                      ฿{(Number(c.menuItem.price) * c.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* Note for kitchen */}
                  <input
                    type="text"
                    placeholder="หมายเหตุเพิ่มเติม (เช่น หวานน้อย, แยกน้ำแข็ง)..."
                    value={c.note}
                    onChange={(e) => updateItemNote(c.menuItem.id, e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-surface mb-2 outline-none focus:border-secondary"
                  />

                  {/* Quantity Stepper */}
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => updateQuantity(c.menuItem.id, -1)}
                      className="w-7 h-7 rounded-full border border-border-subtle bg-white flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-sm w-5 text-center">
                      {c.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(c.menuItem.id, 1)}
                      className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-xs active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Order Level Customer Note */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  ข้อความถึงร้านค้า / โน้ตเพิ่มเติม
                </label>
                <input
                  type="text"
                  placeholder="เช่น รับของพร้อมกัน, ขอจานแบ่ง..."
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-border-subtle bg-surface outline-none focus:border-secondary"
                />
              </div>
            </div>

            {/* Footer Checkout */}
            <div className="p-4 border-t border-border-subtle bg-surface-bright space-y-3">
              <div className="flex justify-between items-center font-bold">
                <span className="text-sm">ยอดชำระทั้งหมด</span>
                <span className="text-lg text-primary">฿{cartTotalAmount.toFixed(2)}</span>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={isSubmittingOrder}
                className="w-full py-3.5 bg-primary text-on-primary font-bold text-sm rounded-xl shadow-lg hover:bg-primary/90 flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
              >
                {isSubmittingOrder ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {isSubmittingOrder ? "กำลังส่งคำสั่งซื้อไปยังครัว..." : "ยืนยันส่งคำสั่งซื้อ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
