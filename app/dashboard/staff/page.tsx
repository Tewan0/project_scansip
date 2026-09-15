"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  UserPlus,
  Mail,
  Users,
  Clock,
  Trash2,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

interface StaffMember {
  id: string;
  storeId: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "cashier" | "kitchen";
  createdAt: string;
}

export default function ManageStaffPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [roleInput, setRoleInput] = useState<"cashier" | "kitchen" | "manager">("cashier");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchStaff = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/staff");
      const json = await res.json();
      if (json.success) {
        setStaffList(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load staff list:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput,
          name: nameInput || undefined,
          role: roleInput,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setStatusMessage({ text: `เพิ่มพนักงาน ${json.data.name} เรียบร้อยแล้ว`, type: "success" });
        setEmailInput("");
        setNameInput("");
        setStaffList((prev) => [json.data, ...prev]);
      } else {
        setStatusMessage({ text: json.error || "เกิดข้อผิดพลาดในการเพิ่มพนักงาน", type: "error" });
      }
    } catch (err) {
      console.error("Add staff error:", err);
      setStatusMessage({ text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", type: "error" });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleRemoveStaff = async (id: string, name: string) => {
    if (!confirm(`คุณต้องการลบพนักงาน "${name}" ออกจากระบบหรือไม่?`)) return;

    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setStaffList((prev) => prev.filter((staff) => staff.id !== id));
        setStatusMessage({ text: `ลบ ${name} ออกจากระบบแล้ว`, type: "success" });
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      console.error("Delete staff error:", err);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((p) => p.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "ST";
  };

  const roleLabels: Record<string, { label: string; class: string }> = {
    owner: { label: "เจ้าของร้าน", class: "bg-primary text-on-primary" },
    manager: { label: "ผู้จัดการ", class: "bg-purple-100 text-purple-800" },
    cashier: { label: "แคชเชียร์", class: "bg-blue-100 text-blue-800" },
    kitchen: { label: "ครัว / บาริสต้า", class: "bg-amber-100 text-amber-800" },
  };

  return (
    <div className="p-stack-md md:p-margin-page">
      <div className="max-w-4xl mx-auto space-y-stack-lg">
        {/* Status Message Banner */}
        {statusMessage && (
          <div
            className={`p-stack-sm rounded-lg border flex items-center gap-2 text-xs animate-fadeIn ${
              statusMessage.type === "success"
                ? "bg-status-success/10 border-status-success/30 text-status-success"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Add Staff Section */}
        <section className="bg-surface-card rounded-xl border border-border-subtle p-gutter shadow-xs">
          <div className="flex items-center gap-2 mb-stack-sm">
            <UserPlus className="w-5 h-5 text-primary" />
            <h2 className="font-headline-md text-headline-md font-bold text-primary">
              เพิ่มพนักงานใหม่
            </h2>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-md">
            กำหนดอีเมลและตำแหน่งเพื่อให้อนุญาตการเข้าใช้งานระบบร้านค้า
          </p>
          <form onSubmit={handleAddStaff} className="grid grid-cols-1 sm:grid-cols-12 gap-stack-md">
            <div className="sm:col-span-4 relative">
              <input
                className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant"
                placeholder="ชื่อพนักงาน (ไม่บังคับ)"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
            </div>

            <div className="sm:col-span-4 relative">
              <Mail className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border-subtle bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant"
                placeholder="staff@example.com"
                required
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <select
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value as "cashier" | "kitchen" | "manager")}
                className="w-full h-9 px-2 rounded-lg border border-border-subtle bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all font-body-sm text-body-sm text-on-surface cursor-pointer"
              >
                <option value="cashier">แคชเชียร์</option>
                <option value="kitchen">บาริสต้า/ครัว</option>
                <option value="manager">ผู้จัดการ</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                disabled={isSubmitting}
                className="w-full h-9 px-4 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary/90 transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                type="submit"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>เพิ่ม</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Staff List Section */}
        <section className="bg-surface-card rounded-xl border border-border-subtle overflow-hidden shadow-xs">
          <div className="px-gutter py-stack-md border-b border-border-subtle bg-surface/50 flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-on-surface-variant" />
              <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
                รายชื่อพนักงานทั้งหมด ({staffList.length})
              </h3>
            </div>
          </div>
          <div className="divide-y divide-border-subtle">
            {isLoading ? (
              <div className="p-12 text-center text-on-surface-variant flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-body-sm">กำลังโหลดรายชื่อพนักงาน...</span>
              </div>
            ) : staffList.length === 0 ? (
              <div className="p-gutter text-center text-on-surface-variant text-body-sm">
                ยังไม่มีรายชื่อพนักงานที่บันทึกในฐานข้อมูล กรุณากรอกอีเมลด้านบนเพื่อเพิ่มพนักงาน
              </div>
            ) : (
              staffList.map((staff) => {
                const roleConfig = roleLabels[staff.role] || {
                  label: staff.role,
                  class: "bg-surface-container text-on-surface",
                };
                return (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-gutter hover:bg-surface-container-lowest transition-colors group"
                  >
                    <div className="flex items-center gap-stack-md">
                      <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {getInitials(staff.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-body-md text-body-md text-on-surface font-semibold">
                            {staff.name}
                          </p>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${roleConfig.class}`}
                          >
                            {roleConfig.label}
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-on-surface-variant" />
                          {staff.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-stack-md">
                      <button
                        type="button"
                        onClick={() => handleRemoveStaff(staff.id, staff.name)}
                        aria-label="ลบพนักงาน"
                        title="ลบพนักงาน"
                        className="text-on-surface-variant hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
