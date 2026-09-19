/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  UtensilsCrossed,
  Layers,
  Tag,
  Settings2,
  Trash2,
  X,
  Save,
  Coffee,
  CupSoda,
  Croissant,
  Cookie,
  FileQuestion,
  ImagePlus,
  FileText,
  Loader2,
  Upload,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import EditMenuItemModal from "./EditMenuItemModal";
import { deleteMenuItem } from "@/app/actions/menu";

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
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ทุกหมวดหมู่");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Fetch menu and categories from database
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [menuRes, catRes] = await Promise.all([
        fetch("/api/menu"),
        fetch("/api/categories"),
      ]);

      const [menuData, catData] = await Promise.all([
        menuRes.json(),
        catRes.json(),
      ]);

      if (menuData.success) setItems(menuData.data || []);
      if (catData.success) {
        setCategoriesList(catData.data || []);
        if (catData.data?.length > 0 && !newItemCategoryId) {
          setNewItemCategoryId(catData.data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load menu data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const categoryName = item.category?.name || "ทั่วไป";
    const matchesCategory =
      selectedCategory === "ทุกหมวดหมู่" ||
      categoryName.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG)");
      return;
    }

    setNewItemImageFile(file);
    if (newItemImagePreview) {
      URL.revokeObjectURL(newItemImagePreview);
    }
    setNewItemImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveNewItemImage = () => {
    setNewItemImageFile(null);
    if (newItemImagePreview) {
      URL.revokeObjectURL(newItemImagePreview);
      setNewItemImagePreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCloseModal = () => {
    setNewItemName("");
    setNewItemPrice("");
    setNewItemDesc("");
    handleRemoveNewItemImage();
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("คุณต้องการลบเมนูนี้ใช่หรือไม่?")) return;
    try {
      setDeletingId(id);
      const res = await deleteMenuItem(id);
      if (res.success) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert(res.error || "ไม่สามารถลบรายการได้");
      }
    } catch (err) {
      console.error("Failed to delete menu item:", err);
      alert("เกิดข้อผิดพลาดในการลบเมนู");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSuccess = (updatedItem: MenuItem) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === updatedItem.id) {
          const matchedCategory = categoriesList.find(
            (c) => c.id === updatedItem.categoryId
          );
          return {
            ...item,
            ...updatedItem,
            category: matchedCategory || item.category,
          };
        }
        return item;
      })
    );
    // Refresh list from database to ensure fresh state
    fetchData();
  };

  const handleToggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/menu/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !currentStatus }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, isAvailable: !currentStatus } : item
          )
        );
      }
    } catch (err) {
      console.error("Failed to toggle availability:", err);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice) return;

    try {
      setIsSubmitting(true);

      let uploadedImageUrl: string | null = null;
      // บันทึกรูปลง Supabase Storage เมื่อกดบันทึกเมนูเท่านั้น
      if (newItemImageFile) {
        const formData = new FormData();
        formData.append("file", newItemImageFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadData.success || !uploadData.url) {
          alert(uploadData.error || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ");
          setIsSubmitting(false);
          return;
        }
        uploadedImageUrl = uploadData.url;
      }

      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItemName.trim(),
          price: parseFloat(newItemPrice),
          description: newItemDesc.trim() || null,
          categoryId: newItemCategoryId || null,
          imageUrl: uploadedImageUrl,
          isAvailable: true,
        }),
      });

      const result = await res.json();
      if (result.success) {
        await fetchData(); // refresh list from db
        handleCloseModal();
      } else {
        alert(result.error || "เกิดข้อผิดพลาดในการสร้างเมนู");
      }
    } catch (err) {
      console.error("Failed to create menu item:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryIcon = (categoryName?: string | null) => {
    if (!categoryName) return <UtensilsCrossed className="w-3.5 h-3.5" />;
    // ตรวจสอบเครื่องดื่มที่ไม่ใช่กาแฟก่อนกาแฟ เพื่อไม่ให้คำว่า 'กาแฟ' ไปตรงกับเงื่อนไขกาแฟ
    if (categoryName.includes("ไม่ใช่กาแฟ") || categoryName.includes("Non-Coffee")) {
      return <CupSoda className="w-3.5 h-3.5" />;
    }
    if (categoryName.includes("กาแฟ") || categoryName.includes("Coffee")) {
      return <Coffee className="w-3.5 h-3.5" />;
    }
    if (categoryName.includes("ชา") || categoryName.includes("Tea") || categoryName.includes("เครื่องดื่ม")) {
      return <CupSoda className="w-3.5 h-3.5" />;
    }
    if (
      categoryName.includes("เบเกอรี่") ||
      categoryName.includes("ของหวาน") ||
      categoryName.includes("ขนม") ||
      categoryName.includes("Cake") ||
      categoryName.includes("Bakery")
    ) {
      return <Croissant className="w-3.5 h-3.5" />;
    }
    if (
      categoryName.includes("อาหารว่าง") ||
      categoryName.includes("ทานเล่น") ||
      categoryName.includes("Snack")
    ) {
      return <Cookie className="w-3.5 h-3.5" />;
    }
    if (categoryName.includes("จานหลัก") || categoryName.includes("อาหาร")) {
      return <UtensilsCrossed className="w-3.5 h-3.5" />;
    }
    return <UtensilsCrossed className="w-3.5 h-3.5" />;
  };

  return (
    <div className="p-4 sm:p-gutter lg:p-margin-page bg-surface-bright min-h-full">
      {/* Actions & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-stack-lg gap-stack-md">
        <div className="flex flex-wrap gap-stack-sm w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
            <input
              className="h-9 pl-9 pr-4 w-full rounded-lg border border-border-subtle bg-surface-card text-body-md font-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-shadow outline-none text-on-surface"
              placeholder="ค้นหาเมนูอาหาร/เครื่องดื่ม..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="h-9 px-3 rounded-lg border border-border-subtle bg-surface-card text-body-md font-body-md text-on-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-shadow outline-none cursor-pointer"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="ทุกหมวดหมู่">ทุกหมวดหมู่</option>
            {categoriesList.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
            {items.some((i) => !i.category?.name) && (
              <option value="ทั่วไป">ทั่วไป</option>
            )}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            if (categoriesList.length > 0 && !newItemCategoryId) {
              setNewItemCategoryId(categoriesList[0].id);
            }
            setIsModalOpen(true);
          }}
          className="h-9 px-stack-md bg-primary text-on-primary font-label-md text-label-md rounded-lg flex items-center gap-1.5 shadow-xs hover:bg-primary-container transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มเมนูใหม่</span>
        </button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
          <p className="font-body-md text-body-md">กำลังโหลดข้อมูลเมนู...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty State */
        <div className="bg-surface-card border border-border-subtle rounded-xl p-12 text-center max-w-md mx-auto my-12 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mx-auto mb-4 text-on-surface-variant">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface mb-2">
            ยังไม่มีรายการเมนู
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
            เริ่มต้นเพิ่มรายการอาหาร เครื่องดื่ม หรือของหวานลงในระบบของคุณ
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="h-9 px-stack-md bg-primary text-on-primary font-label-md text-label-md rounded-lg inline-flex items-center gap-1.5 shadow-xs hover:bg-primary-container transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            เพิ่มเมนูแรก
          </button>
        </div>
      ) : (
        /* Menu Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-surface-card rounded-xl border border-border-subtle overflow-hidden flex flex-col shadow-xs hover:shadow-md transition-shadow group ${
                !item.isAvailable ? "opacity-70 bg-surface-container-lowest" : ""
              }`}
            >
              {/* Menu Item Image */}
              <div className="aspect-[4/3] w-full bg-surface-container-high relative overflow-hidden flex items-center justify-center">
                {item.imageUrl ? (
                  <img
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src={item.imageUrl}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-on-surface-variant/40 gap-1">
                    {getCategoryIcon(item.category?.name)}
                    <span className="text-xs">ไม่มีรูปภาพ</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className="bg-surface-card/90 backdrop-blur-xs text-on-surface font-label-md text-xs px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                    {getCategoryIcon(item.category?.name)}
                    {item.category?.name || "ทั่วไป"}
                  </span>
                </div>
                {!item.isAvailable && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                    <span className="bg-error text-on-error font-label-md text-xs px-2.5 py-1 rounded shadow-md font-bold">
                      หมดชั่วคราว
                    </span>
                  </div>
                )}
              </div>

              {/* Menu Item Content */}
              <div className="p-stack-md flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h3 className="font-headline-md text-headline-md font-bold text-on-surface leading-tight">
                      {item.name}
                    </h3>
                    <span className="font-headline-md text-headline-md font-bold text-primary shrink-0">
                      ฿{Number(item.price).toFixed(2)}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mb-stack-md">
                    {item.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                  </p>
                </div>

                {/* Actions bottom bar */}
                <div className="pt-stack-sm border-t border-border-subtle flex items-center justify-between mt-auto">
                  <button
                    type="button"
                    onClick={() => handleToggleAvailability(item.id, item.isAvailable)}
                    className={`font-label-md text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer flex items-center gap-1 ${
                      item.isAvailable
                        ? "border-status-success/30 bg-status-success/10 text-status-success hover:bg-status-success/20"
                        : "border-border-subtle bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.isAvailable ? "bg-status-success" : "bg-on-surface-variant"
                      }`}
                    />
                    <span>{item.isAvailable ? "พร้อมจำหน่าย" : "สินค้าหมด"}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary-container/20 rounded transition-colors cursor-pointer"
                      title="แก้ไขเมนู"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded transition-colors cursor-pointer disabled:opacity-50"
                      title="ลบเมนู"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-error" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-on-background/40 backdrop-blur-xs z-50 flex items-center justify-center p-gutter">
          <div className="bg-surface-card border border-border-subtle rounded-xl max-w-lg w-full overflow-hidden shadow-xl animate-scaleUp">
            <div className="p-stack-md border-b border-border-subtle flex justify-between items-center bg-surface-bright">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-primary" />
                <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
                  เพิ่มเมนูอาหารใหม่
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-stack-md space-y-stack-md">
              {/* Photo Upload Section */}
              <div>
                <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                  <ImagePlus className="w-3.5 h-3.5 text-on-surface-variant" />
                  รูปภาพเมนู
                </label>

                <div className="flex items-center gap-stack-md">
                  {newItemImagePreview ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border-subtle bg-surface-container shrink-0">
                      <img
                        src={newItemImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveNewItemImage}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80 cursor-pointer"
                        title="ลบรูป"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-border-subtle flex flex-col items-center justify-center text-on-surface-variant bg-surface hover:bg-surface-container-low cursor-pointer transition-colors shrink-0"
                    >
                      <Upload className="w-5 h-5 mb-0.5" />
                      <span className="text-[10px]">เลือกรูป</span>
                    </div>
                  )}

                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageFileChange}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-medium border border-border-subtle rounded-lg bg-surface hover:bg-surface-container-low text-on-surface transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>อัปโหลดรูปภาพจากอุปกรณ์</span>
                    </button>
                    <p className="text-[11px] text-on-surface-variant mt-1">
                      รองรับไฟล์ JPG, PNG (รูปจะถูกบันทึกเมื่อกดบันทึกเมนู)
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                  <Tag className="w-3.5 h-3.5 text-on-surface-variant" />
                  ชื่อเมนู
                </label>
                <input
                  required
                  className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface text-body-md font-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-shadow text-on-surface"
                  placeholder="เช่น มัทฉะลาเต้เย็น"
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-stack-sm">
                <div>
                  <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                    <Layers className="w-3.5 h-3.5 text-on-surface-variant" />
                    หมวดหมู่
                  </label>
                  <select
                    className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface text-body-md font-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-shadow text-on-surface cursor-pointer"
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
                <div>
                  <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                    <span className="font-bold text-xs text-on-surface-variant">฿</span>
                    ราคา (บาท)
                  </label>
                  <input
                    required
                    className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface text-body-md font-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-shadow text-on-surface"
                    placeholder="เช่น 85.00"
                    type="number"
                    step="0.5"
                    min="0"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                  <FileText className="w-3.5 h-3.5 text-on-surface-variant" />
                  คำอธิบายเมนู
                </label>
                <textarea
                  rows={2}
                  className="w-full p-2.5 rounded-lg border border-border-subtle bg-surface text-body-md font-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-shadow text-on-surface resize-none"
                  placeholder="รายละเอียด ส่วนผสม หรือรสชาติ..."
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-stack-sm pt-stack-sm border-t border-border-subtle">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-stack-md h-9 rounded-lg border border-border-subtle bg-surface text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-stack-md h-9 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกเมนู"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      <EditMenuItemModal
        isOpen={!!editingItem}
        item={editingItem}
        categories={categoriesList}
        onClose={() => setEditingItem(null)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
