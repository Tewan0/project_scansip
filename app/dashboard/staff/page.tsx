"use client";

import { useState, useEffect, useRef } from "react";
import { useConfirmation } from "@/hooks/use-confirmation";

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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

// Lucide Icons
import {
  CheckCircle2,
  UserPlus,
  Mail,
  Users,
  Trash2,
  AlertCircle,
  RotateCw,
  ShieldCheck,
  Shield,
  ChefHat,
  Receipt,
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
  const { confirm, confirmationDialog } = useConfirmation();
  const removing = useRef(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [roleInput, setRoleInput] = useState<"cashier" | "kitchen">("cashier");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchStaff = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/staff");
      const json = await res.json();
      if (json.success) {
        setStaffList(json.data || []);
      } else throw new Error(json.error || "โหลดรายชื่อพนักงานไม่สำเร็จ");
    } catch (err) {
      setStaffList([]);
      setStatusMessage({ text: err instanceof Error ? err.message : "โหลดรายชื่อพนักงานไม่สำเร็จ", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => void fetchStaff(), 0);
    return () => clearTimeout(timer);
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
    }
  };

  const handleRemoveStaff = async (id: string, name: string) => {
    if (removing.current || !await confirm({ title: "ลบพนักงาน", description: `ต้องการลบ “${name}” ออกจากร้านใช่ไหม? บัญชีนี้จะสูญเสียสิทธิ์พนักงานของร้าน`, confirmLabel: "ลบพนักงาน" })) return;
    if (removing.current) return;
    removing.current = true;
    setStatusMessage(null);

    try {
      setDeletingId(id);
      const res = await fetch(`/api/staff/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setStaffList((prev) => prev.filter((staff) => staff.id !== id));
        setStatusMessage({ text: `ลบ ${name} ออกจากระบบแล้ว`, type: "success" });
      } else {
        const result = await res.json();
        throw new Error(result.error || "ลบพนักงานไม่สำเร็จ");
      }
    } catch (err) {
      setStatusMessage({ text: err instanceof Error ? err.message : "ลบพนักงานไม่สำเร็จ", type: "error" });
    } finally {
      removing.current = false;
      setDeletingId(null);
    }
  };

  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  async function changeRole(id: string, role: string) {
    setUpdatingRoleId(id);
    try {
      const res = await fetch("/api/staff/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "เปลี่ยนบทบาทไม่สำเร็จ");
      setStaffList((list) => list.map((item) => item.id === id ? result.data : item));
      setStatusMessage({ text: "เปลี่ยนบทบาทแล้ว สิทธิ์ใหม่มีผลในการเรียกใช้งานครั้งถัดไป", type: "success" });
    } catch (error) { setStatusMessage({ text: error instanceof Error ? error.message : "เปลี่ยนบทบาทไม่สำเร็จ", type: "error" }); }
    finally { setUpdatingRoleId(null); }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((p) => p.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "ST";
  };

  const getRoleBadge = (role: StaffMember["role"]) => {
    switch (role) {
      case "owner":
        return (
          <Badge className="gap-1 text-[11px] bg-primary text-primary-foreground font-semibold">
            <ShieldCheck className="size-3" />
            เจ้าของร้าน
          </Badge>
        );
      case "manager":
        return (
          <Badge variant="secondary" className="gap-1 text-[11px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 font-semibold">
            <Shield className="size-3 text-purple-600" />
            บทบาทเดิม (กรุณาเปลี่ยน)
          </Badge>
        );
      case "cashier":
        return (
          <Badge variant="secondary" className="gap-1 text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 font-semibold">
            <Receipt className="size-3 text-blue-600" />
            พนักงานหน้าร้าน
          </Badge>
        );
      case "kitchen":
        return (
          <Badge variant="secondary" className="gap-1 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 font-semibold">
            <ChefHat className="size-3 text-amber-600" />
            ครัว
          </Badge>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto font-sans">
      {confirmationDialog}
      {/* Top Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            จัดการทีมงานและพนักงาน
          </h1>
          <Badge variant="outline" className="text-xs">
            {staffList.length} บัญชีพนักงาน
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          เพิ่มอีเมล Google แล้วให้พนักงานใช้หน้าเข้าสู่ระบบเดียวกัน ระบบจะพาไปยังหน้าร้านหรือครัวตามบทบาท
        </p>
      </div>

      {/* Status Message Banner */}
      {statusMessage && (
        <div
          role={statusMessage.type === "error" ? "alert" : "status"}
          className={`p-3 rounded-lg border flex flex-wrap items-center gap-2 text-xs animate-fadeIn ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="size-4 shrink-0 text-destructive" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Add Staff Section with Shadcn Card */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <UserPlus className="size-4 text-foreground" />
            <CardTitle className="text-base font-bold">เพิ่มอีเมลพนักงาน</CardTitle>
          </div>
          <CardDescription className="text-xs">
            ระบุอีเมล Google ของพนักงานและกำหนดบทบาทเพื่ออนุญาตการเข้าใช้งานระบบร้านค้า
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleAddStaff} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-4 space-y-1">
              <Label htmlFor="staff-name" className="text-xs">ชื่อพนักงาน (ไม่บังคับ)</Label>
              <Input
                id="staff-name"
                placeholder="เช่น สมชาย ใจดี"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="xl:col-span-4 space-y-1">
              <Label htmlFor="staff-email" className="text-xs">อีเมล Google *</Label>
              <Input
                id="staff-email"
                placeholder="staff@gmail.com"
                required
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="xl:col-span-2 space-y-1">
              <Label htmlFor="staff-role" className="text-xs">ตำแหน่ง</Label>
              <select
                id="staff-role"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value as "cashier" | "kitchen")}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs outline-none focus:border-ring cursor-pointer"
              >
                <option value="cashier">พนักงานหน้าร้าน</option>
                <option value="kitchen">ครัว</option>
              </select>
            </div>

            <div className="xl:col-span-2 flex items-end">
              <Button
                disabled={isSubmitting}
                className="w-full h-9 text-xs"
                type="submit"
              >
                {isSubmitting ? (
                  <RotateCw className="size-3.5 animate-spin" />
                ) : (
                  <>
                    <UserPlus data-icon="inline-start" />
                    <span>เพิ่ม</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Staff List Card */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="p-4 border-b border-border bg-card flex flex-wrap flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Users className="size-4 text-foreground" />
            <CardTitle className="text-base font-bold">
              รายชื่อพนักงานทั้งหมด ({staffList.length} คน)
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            กำหนดสิทธิ์ตาม Security Role
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 rounded" />
                </div>
              ))}
            </div>
          ) : staffList.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Users className="size-10 mx-auto mb-3 opacity-30" />
              <h3 className="text-base font-bold text-foreground mb-1">
                ยังไม่มีรายชื่อพนักงาน
              </h3>
              <p className="text-xs max-w-sm mx-auto">
                กรอกอีเมลด้านบนเพื่อเชิญทีมงานเข้าร่วมจัดการระบบร้านค้า
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {staffList.map((staff) => {
                const isDeleting = deletingId === staff.id;
                const isOwner = staff.role === "owner";

                return (
                  <div
                    key={staff.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex flex-1 items-center gap-3 min-w-0">
                      <Avatar size="default" className="rounded-full border border-border">
                        <AvatarFallback className="text-xs font-bold bg-muted text-foreground">
                          {getInitials(staff.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {staff.name}
                          </p>
                          {getRoleBadge(staff.role)}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                          <Mail className="size-3 text-muted-foreground shrink-0" />
                          <span className="truncate" title={staff.email}>{staff.email}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3 sm:border-0 sm:pt-0">
                      {!isOwner && <select aria-label={"บทบาทของ " + staff.name} value={staff.role} disabled={updatingRoleId === staff.id || isDeleting}
                        onChange={(e) => void changeRole(staff.id, e.target.value)} className="min-h-11 rounded-lg border bg-background px-2 text-sm">
                        {staff.role === "manager" && <option value="manager" disabled>เลือกบทบาทใหม่</option>}
                        <option value="cashier">หน้าร้าน</option><option value="kitchen">ครัว</option>
                      </select>}
                      {!isOwner && (
                        <Button
                          onClick={() => handleRemoveStaff(staff.id, staff.name)}
                          disabled={isDeleting || updatingRoleId === staff.id}
                          variant="outline"
                          size="icon-xs"
                          className="size-11 text-muted-foreground hover:text-destructive hover:border-destructive/40"
                          title="ลบพนักงาน"
                          aria-label={"ลบพนักงาน " + staff.name}
                        >
                          {isDeleting ? (
                            <RotateCw className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>

        <CardFooter className="p-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>สิทธิ์ Owner จะไม่สามารถถูกลบได้</span>
          <span className="font-medium text-foreground">ระบบความปลอดภัยสิทธิ์การเข้าถึง</span>
        </CardFooter>
      </Card>
    </div>
  );
}
