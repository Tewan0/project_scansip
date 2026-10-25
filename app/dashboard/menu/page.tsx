/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  UtensilsCrossed,
  Coffee,
  Trash2,
  X,
  Upload,
  Pencil,
  RotateCw,
} from "lucide-react";
import EditMenuItemModal from "./EditMenuItemModal";
import { deleteMenuItem } from "@/app/actions/menu";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useConfirmation } from "@/hooks/use-confirmation";

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string | null;
  category?: Category | null;
}

export default function MenuManagementPage() {
  const { confirm, confirmationDialog } = useConfirmation();
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const deleting = useRef(false);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ทุกหมวดหมู่");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const createInFlight = useRef(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategoryId, setNewItemCategoryId] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemImageFile, setNewItemImageFile] = useState<File | null>(null);
  const [newItemImagePreview, setNewItemImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (newItemImagePreview) URL.revokeObjectURL(newItemImagePreview); };
  }, [newItemImagePreview]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [menuRes, catRes] = await Promise.all([
          fetch("/api/menu"),
          fetch("/api/categories"),
        ]);

        const [menuData, catData] = await Promise.all([
          menuRes.json(),
          catRes.json(),
        ]);

        if (cancelled) return;
        if (menuData.success) setItems(menuData.data || []);
        if (catData.success) {
          setCategoriesList(catData.data || []);
          if (catData.data?.length > 0) {
            setNewItemCategoryId(current => current || catData.data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load menu data:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetchData();
    return () => { cancelled = true; };
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "ทุกหมวดหมู่" ||
      item.category?.name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
        setCreateError("กรุณาใช้รูป JPG, PNG, WebP หรือ GIF ขนาดไม่เกิน 5 MB");
        e.target.value = "";
        return;
      }
      setCreateError("");
      setNewItemImageFile(file);
      setNewItemImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createInFlight.current || !newItemName.trim() || !newItemPrice) return;
    createInFlight.current = true;

    try {
      setIsSubmitting(true);
      setCreateError("");
      const formData = new FormData();
      formData.append("name", newItemName.trim());
      formData.append("price", newItemPrice);
      formData.append("categoryId", newItemCategoryId);
      formData.append("description", newItemDesc.trim());
      if (newItemImageFile) {
        formData.append("image", newItemImageFile);
      }

      const res = await fetch("/api/menu", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setItems((prev) => [json.data, ...prev]);
        setNewItemName("");
        setNewItemPrice("");
        setNewItemDesc("");
        setNewItemImageFile(null);
        setNewItemImagePreview(null);
        setIsModalOpen(false);
        setFeedback({ type: "success", text: "เพิ่มเมนูใหม่แล้ว" });
      } else {
        setCreateError(json.error || "เกิดข้อผิดพลาดในการเพิ่มเมนู");
      }
    } catch (err) {
      console.error("Create menu item error:", err);
      setCreateError("ยังยืนยันผลการบันทึกไม่ได้ กรุณาโหลดรายการเมนูเพื่อตรวจสอบก่อนเพิ่มซ้ำ");
    } finally {
      createInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (deleting.current || !await confirm({ title: "ลบเมนูอาหาร", description: `ต้องการลบ “${items.find(item => item.id === id)?.name || "เมนูนี้"}” ใช่ไหม? เมนูนี้จะไม่แสดงให้ลูกค้าสั่งอีก`, confirmLabel: "ลบเมนู" })) return;
    if (deleting.current) return;
    deleting.current = true;
    setFeedback(null);
    try {
      setDeletingId(id);
      const res = await deleteMenuItem(id);
      if (res.success) {
        setItems((prev) => prev.filter((it) => it.id !== id));
        setFeedback({ type: "success", text: "ลบเมนูแล้ว" });
      } else {
        setFeedback({ type: "error", text: res.error || "ไม่สามารถลบรายการได้" });
      }
    } catch (err) {
      console.error("Delete menu error:", err);
      setFeedback({ type: "error", text: "ยังยืนยันผลการลบไม่ได้ กรุณาโหลดรายการใหม่เพื่อตรวจสอบ" });
    } finally {
      deleting.current = false;
      setDeletingId(null);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      const updatedStatus = !item.isAvailable;
      const res = await fetch(`/api/menu/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: updatedStatus }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, isAvailable: updatedStatus } : it
          )
        );
      } else {
        const result = await res.json();
        setFeedback({ type: "error", text: result.error || "เปลี่ยนสถานะเมนูไม่สำเร็จ" });
      }
    } catch (err) {
      console.error("Toggle availability error:", err);
      setFeedback({ type: "error", text: "เปลี่ยนสถานะเมนูไม่สำเร็จ กรุณาลองใหม่" });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${feedback.type === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>{feedback.text}</p>}
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              จัดการเมนูอาหาร
            </h1>
            <Badge variant="outline" className="text-xs">
              {items.length} รายการทั้งหมด
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            เพิ่ม ลบ แก้ไขราคา ปรับสถานะพร้อมจำหน่าย และจัดหมวดหมู่เมนู
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setIsModalOpen(true)} size="sm">
            <Plus data-icon="inline-start" />
            <span>เพิ่มเมนูใหม่</span>
          </Button>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <Card className="border-border">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อเมนู..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <Button
                type="button"
                onClick={() => setSelectedCategory("ทุกหมวดหมู่")}
                variant={selectedCategory === "ทุกหมวดหมู่" ? "default" : "outline"}
                size="xs"
                className="h-8 rounded-lg shrink-0"
              >
                ทุกหมวดหมู่
              </Button>
              {categoriesList.map((cat) => (
                <Button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  variant={selectedCategory === cat.name ? "default" : "outline"}
                  size="xs"
                  className="h-8 rounded-lg shrink-0"
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu Items Grid */}
      {isLoading ? (
        <div role="status" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          <span className="sr-only">กำลังโหลดรายการเมนู</span>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="overflow-hidden p-0">
              <Skeleton className="h-44 w-full rounded-t-xl rounded-b-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex justify-between items-center pt-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-16 text-center text-muted-foreground">
            <UtensilsCrossed className="size-10 mx-auto mb-3 opacity-30" />
            <h3 className="text-base font-bold text-foreground mb-1">
              ไม่พบรายการอาหารในหมวดนี้
            </h3>
            <p className="text-xs max-w-sm mx-auto mb-4">
              คุณสามารถเริ่มเพิ่มเมนูแรกเข้าสู่ระบบได้ทันที
            </p>
            <Button onClick={() => setIsModalOpen(true)} size="sm">
              <Plus data-icon="inline-start" />
              <span>เพิ่มเมนูอาหาร</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const isDeleting = deletingId === item.id;

            return (
              <Card
                key={item.id}
                className={`overflow-hidden gap-0 py-0 justify-between border-border transition-all duration-200 hover:border-foreground/20 ${
                  !item.isAvailable ? "bg-muted/20" : ""
                }`}
              >
                <div>
                  {/* Photo area */}
                  <div className="relative h-44 w-full bg-muted overflow-hidden border-b border-border flex items-center justify-center">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Coffee className="size-8 opacity-30 mb-1" />
                        <span className="text-[10px]">ไม่มีรูปภาพ</span>
                      </div>
                    )}

                    {/* Category Tag overlay */}
                    <div className="absolute top-2 left-2 max-w-[calc(100%-6rem)]">
                      <Badge variant="secondary" className="max-w-full text-[10px] bg-card/90 backdrop-blur-xs border border-border">
                        <span className="truncate">{item.category?.name || "ทั่วไป"}</span>
                      </Badge>
                    </div>

                    {/* Stock Status Badge */}
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant={item.isAvailable ? "secondary" : "outline"}
                        className={`text-[10px] ${
                          item.isAvailable
                            ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800"
                            : "text-destructive bg-destructive/10 border-destructive/30"
                        }`}
                      >
                        {item.isAvailable ? "พร้อมขาย" : "หมด"}
                      </Badge>
                    </div>
                  </div>

                  {/* Details Header */}
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base font-bold text-foreground line-clamp-2">
                      {item.name}
                    </CardTitle>
                    {item.description ? (
                      <CardDescription className="text-xs line-clamp-2 mt-1">
                        {item.description}
                      </CardDescription>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic mt-1">
                        ไม่มีคำอธิบายเพิ่มเติม
                      </p>
                    )}
                  </CardHeader>
                </div>

                {/* Footer Controls */}
                <CardFooter className="p-4 pt-2 border-t border-border flex flex-wrap items-center justify-between gap-3 mt-auto">
                  <span className="font-extrabold text-base text-foreground">
                    ฿{Number(item.price).toFixed(2)}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      onClick={() => toggleAvailability(item)}
                      variant="outline"
                      size="xs"
                      className="text-[11px] h-7"
                      title={item.isAvailable ? "คลิกเพื่อปิดชั่วคราว" : "คลิกเพื่อเปิดจำหน่าย"}
                    >
                      {item.isAvailable ? "เปิด" : "ปิด"}
                    </Button>

                    <Button
                      onClick={() => setEditingItem(item)}
                      variant="outline"
                      size="icon-xs"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      title="แก้ไขเมนู"
                    >
                      <Pencil className="size-3.5" />
                    </Button>

                    <Button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={isDeleting}
                      variant="outline"
                      size="icon-xs"
                      className="size-7 text-muted-foreground hover:text-destructive hover:border-destructive/40"
                      title="ลบเมนู"
                    >
                      {isDeleting ? (
                        <RotateCw className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create New Item Modal with Shadcn Card */}
      {isModalOpen && (
        <Dialog open onOpenChange={open => { if (!open && !createInFlight.current) setIsModalOpen(false); }}>
          <DialogContent showCloseButton={false} className="sm:max-w-lg p-0 gap-0 flex flex-col overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border p-4 bg-card">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="size-4 text-foreground" />
                <DialogTitle className="text-base font-bold">เพิ่มเมนูอาหารใหม่</DialogTitle>
              </div>
              <Button
                onClick={() => setIsModalOpen(false)}
                variant="ghost"
                size="icon-xs"
                className="size-11"
                aria-label="ปิดหน้าต่างเพิ่มเมนู"
                disabled={isSubmitting}
              >
                <X className="size-4" />
              </Button>
            </CardHeader>
            <DialogDescription className="sr-only">กรอกชื่อ ราคา และรายละเอียดเมนู แล้วกดบันทึก</DialogDescription>

            <form onSubmit={handleCreateItem} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
              {createError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{createError}</p>}
              <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
              {/* Photo Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs">รูปภาพเมนู</Label>
                <div className="flex items-center gap-3">
                  {newItemImagePreview ? (
                    <div className="relative size-20 rounded-lg overflow-hidden border border-border bg-muted shrink-0">
                      <img src={newItemImagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setNewItemImageFile(null);
                          setNewItemImagePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => fileInputRef.current?.click()}
                      className="size-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground bg-muted/40 hover:bg-muted transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                    >
                      <Upload className="size-5 mb-0.5" />
                      <span className="text-[10px]">เลือกรูป</span>
                    </button>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    size="xs"
                    className="h-8"
                  >
                    <Upload data-icon="inline-start" />
                    <span>อัปโหลดรูปภาพ</span>
                  </Button>
                </div>
              </div>

              {/* Menu Name */}
              <div className="space-y-1.5">
                <Label htmlFor="menu-name" className="text-xs">ชื่อเมนูอาหาร / เครื่องดื่ม *</Label>
                <Input
                  id="menu-name"
                  required
                  placeholder="เช่น มัทฉะลาเต้เย็น"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Category & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="menu-cat" className="text-xs">หมวดหมู่</Label>
                  <select
                    id="menu-cat"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs outline-none focus:border-ring"
                    value={newItemCategoryId}
                    onChange={(e) => setNewItemCategoryId(e.target.value)}
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="menu-price" className="text-xs">ราคา (บาท) *</Label>
                  <Input
                    id="menu-price"
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="85.00"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="menu-desc" className="text-xs">รายละเอียด / ส่วนผสม (ถ้ามี)</Label>
                <textarea
                  id="menu-desc"
                  rows={2}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-xs outline-none focus:border-ring resize-none"
                  placeholder="รสชาติกลมกล่อม หวานมันกำลังดี..."
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                />
              </div>

              </fieldset>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  variant="outline"
                  size="sm"
                >
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={isSubmitting} size="sm">
                  {isSubmitting ? (
                    <RotateCw className="size-4 animate-spin" />
                  ) : (
                    <span>บันทึกเมนูใหม่</span>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Modal Component */}
      {editingItem && <EditMenuItemModal
        key={editingItem.id}
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        categories={categoriesList}
        onSuccess={(updated) => {
          setFeedback({ type: "success", text: "บันทึกการแก้ไขเมนูแล้ว" });
          setItems((prev) =>
            prev.map((it) => (it.id === updated.id ? updated : it))
          );
        }}
      />}
      {confirmationDialog}
    </div>
  );
}
