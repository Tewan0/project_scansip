"use server";
import { GET, POST } from "@/app/api/tables/route";
import { requireStoreAccess, AccessError } from "@/lib/auth";

export async function updateStoreTableCount(count: number) {
  try {
    await requireStoreAccess(["owner"]);
    const response = await POST(new Request("http://localhost/api/tables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync_tables", count }) }));
    return await response.json();
  } catch (error) { return { success: false, error: error instanceof AccessError ? error.message : "ไม่สามารถปรับจำนวนโต๊ะได้" }; }
}
export async function getStoreTables() {
  const response = await GET();
  return response.json();
}
