"use client";
import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => { window.removeEventListener("online", listener); window.removeEventListener("offline", listener); };
}
const getOnline = () => navigator.onLine;
const serverOnline = () => true;

export function RefreshStatus({ updatedAt, failed }: { updatedAt: number | null; failed: boolean }) {
  const online = useSyncExternalStore(subscribe, getOnline, serverOnline);
  return <p role="status" className="text-xs text-muted-foreground">
    {!online ? "ออฟไลน์ · ข้อมูลอาจไม่เป็นปัจจุบัน" : failed ? "อัปเดตไม่สำเร็จ · กำลังแสดงข้อมูลล่าสุดที่โหลดได้" : updatedAt ? "อัปเดตล่าสุด" : "รอโหลดข้อมูล"}
    {updatedAt !== null && <span> · {new Date(updatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "medium" })}</span>}
  </p>;
}
