/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Save,
  Loader2,
  Upload,
  ImagePlus,
  Tag,
  Layers,
  FileText,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { updateMenuItem } from "@/app/actions/menu";
import type { Category, MenuItem } from "./page";

interface EditMenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MenuItem | null;
  categories: Category[];
  onSuccess: (updatedItem: MenuItem) => void;
}

export default function EditMenuItemModal({
  isOpen,
  onClose,
  item,
  categories,
  onSuccess,
}: EditMenuItemModalProps) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);

  // Image states
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  // Status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate state when item or modal state changes
  useEffect(() => {
    if (item && isOpen) {
      setName(item.name || "");
      setCategoryId(
        item.categoryId || (categories.length > 0 ? categories[0].id : ""),
      );
      setPrice(String(item.price ?? ""));
      setDescription(item.description || "");
      setIsAvailable(item.isAvailable ?? true);
      setImagePreview(item.imageUrl || null);
      setNewImageFile(null);
      setRemoveImage(false);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [item, isOpen, categories]);

  if (!isOpen || !item) return null;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG)");
      return;
    }

    setNewImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
    setErrorMessage(null);
  };

  const handleRemoveImage = () => {
    setNewImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleResetImage = () => {
    setNewImageFile(null);
    setImagePreview(item.imageUrl || null);
    setRemoveImage(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMessage("กรุณาระบุชื่อเมนู");
      return;
    }

    if (!price || isNaN(Number(price)) || Number(price) < 0) {
      setErrorMessage("กรุณาระบุราคาที่ถูกต้อง");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description.trim());
      formData.append("price", price);
      formData.append("unitPrice", price);
      formData.append("categoryId", categoryId || "");
      formData.append("isAvailable", String(isAvailable));

      if (newImageFile) {
        formData.append("image", newImageFile);
      }

      if (removeImage) {
        formData.append("removeImage", "true");
      }

      const result = await updateMenuItem(item.id, formData);

      if (result.success && result.data) {
        setSuccessMessage("บันทึกการแก้ไขเรียบร้อยแล้ว");
        onSuccess(result.data as MenuItem);
        setTimeout(() => {
          onClose();
        }, 400);
      } else {
        setErrorMessage(result.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    } catch (err: unknown) {
      console.error("Failed to update menu item:", err);
      const msg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasImageChanged = newImageFile !== null || removeImage;

  return (
    <div className="fixed inset-0 bg-on-background/40 backdrop-blur-xs z-50 flex items-center justify-center p-gutter">
      <div className="bg-surface-card border border-border-subtle rounded-xl max-w-lg w-full overflow-hidden shadow-xl animate-scaleUp max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-stack-md border-b border-border-subtle flex justify-between items-center bg-surface-bright shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
              แก้ไขเมนูอาหาร
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form
          onSubmit={handleSubmit}
          className="p-stack-md space-y-stack-md overflow-y-auto flex-1"
        >
          {/* Alerts */}
          {errorMessage && (
            <div className="p-3 bg-error-container/20 border border-error/30 text-error rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-status-success/15 border border-status-success/30 text-status-success rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Photo Upload & Preview Section */}
          <div>
            <label className="flex items-center justify-between font-label-md text-label-md text-on-surface mb-unit">
              <span className="flex items-center gap-1">
                <ImagePlus className="w-3.5 h-3.5 text-on-surface-variant" />
                รูปภาพเมนู
              </span>
              {hasImageChanged && (
                <button
                  type="button"
                  onClick={handleResetImage}
                  className="text-xs text-secondary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  คืนค่ารูปเดิม
                </button>
              )}
            </label>

            <div className="flex items-center gap-stack-md">
              {imagePreview ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border-subtle bg-surface-container shrink-0 group">
                  <img
                    src={imagePreview}
                    alt="Menu item preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={isSubmitting}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
                    title="ลบรูปภาพ"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-300" />
                  </button>
                  {newImageFile && (
                    <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-on-primary text-[10px] text-center py-0.5 font-medium">
                      รูปใหม่
                    </span>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => !isSubmitting && fileInputRef.current?.click()}
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
                  disabled={isSubmitting}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-medium border border-border-subtle rounded-lg bg-surface hover:bg-surface-container-low text-on-surface transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {imagePreview
                      ? "เปลี่ยนรูปภาพใหม่"
                      : "อัปโหลดรูปภาพจากอุปกรณ์"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Menu Name */}
          <div>
            <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
              <Tag className="w-3.5 h-3.5 text-on-surface-variant" />
              ชื่อเมนู <span className="text-error">*</span>
            </label>
            <input
              required
              className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface text-body-md font-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-shadow text-on-surface"
              placeholder="เช่น มัทฉะลาเต้เย็น"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Category & Price */}
          <div className="grid grid-cols-2 gap-stack-sm">
            <div>
              <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                <Layers className="w-3.5 h-3.5 text-on-surface-variant" />
                หมวดหมู่
              </label>
              <select
                className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface text-body-md font-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-shadow text-on-surface cursor-pointer"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                <span className="font-bold text-xs text-on-surface-variant">
                  ฿
                </span>
                ราคา (บาท) <span className="text-error">*</span>
              </label>
              <input
                required
                className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface text-body-md font-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-shadow text-on-surface"
                placeholder="เช่น 85.00"
                type="number"
                step="0.5"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
              <FileText className="w-3.5 h-3.5 text-on-surface-variant" />
              คำอธิบายเมนู
            </label>
            <textarea
              rows={2}
              className="w-full p-2.5 rounded-lg border border-border-subtle bg-surface text-body-md font-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-shadow text-on-surface resize-none"
              placeholder="รายละเอียด ส่วนผสม หรือรสชาติ..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Availability Toggle */}
          <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
            <div>
              <span className="font-label-md text-label-md text-on-surface block">
                สถานะการจำหน่าย
              </span>
              <span className="text-xs text-on-surface-variant">
                {isAvailable
                  ? "เมนูนี้เปิดจำหน่ายและแสดงให้ลูกค้าสั่งได้"
                  : "ระงับการสั่งชั่วคราว (สินค้าหมด)"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsAvailable(!isAvailable)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isAvailable ? "bg-status-success" : "bg-surface-container-high"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isAvailable ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-stack-sm pt-stack-sm border-t border-border-subtle shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-stack-md h-9 rounded-lg border border-border-subtle bg-surface text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-50"
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
              {isSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
