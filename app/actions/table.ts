"use server";

import { db } from "@/db";
import { tables } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getCurrentOwnerStore } from "@/app/actions/owner-auth";
import { revalidatePath } from "next/cache";

export interface TableActionResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Validates table count to be an integer between 1 and 50.
 */
export function validateTableCount(count: number): { valid: boolean; error?: string } {
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 50) {
    return {
      valid: false,
      error: "จำนวนโต๊ะต้องอยู่ระหว่าง 1 ถึง 50 โต๊ะ",
    };
  }
  return { valid: true };
}

/**
 * Server Action: Updates and synchronizes table records for the owner's store.
 * Strictly validates count (Min 1, Max 50) before performing database queries.
 */
export async function updateStoreTableCount(requestedCount: number): Promise<TableActionResponse> {
  // 1. Validate requested table count before performing any database queries
  const validation = validateTableCount(requestedCount);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || "จำนวนโต๊ะต้องอยู่ระหว่าง 1 ถึง 50 โต๊ะ",
    };
  }

  try {
    // 2. Authenticate owner and confirm store
    const { user, store } = await getCurrentOwnerStore();
    if (!user || !store) {
      return { success: false, error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
    }

    // 3. Query existing tables for this store
    const existingTables = await db
      .select()
      .from(tables)
      .where(eq(tables.storeId, store.id))
      .orderBy(asc(tables.tableNumber));

    const currentCount = existingTables.length;

    if (requestedCount > currentCount) {
      // Insert additional tables
      const newTables = [];
      for (let num = currentCount + 1; num <= requestedCount; num++) {
        newTables.push({
          storeId: store.id,
          tableNumber: num,
          status: "available" as const,
        });
      }
      if (newTables.length > 0) {
        await db.insert(tables).values(newTables);
      }
    } else if (requestedCount < currentCount) {
      // Remove excess tables
      const tablesToDelete = existingTables
        .filter((t) => t.tableNumber > requestedCount)
        .map((t) => t.id);

      for (const tableId of tablesToDelete) {
        await db.delete(tables).where(eq(tables.id, tableId));
      }
    }

    revalidatePath("/owner/tables");
    revalidatePath("/dashboard/qr-code");

    return {
      success: true,
      data: { count: requestedCount },
    };
  } catch (error) {
    console.error("updateStoreTableCount error:", error);
    return {
      success: false,
      error: "เกิดข้อผิดพลาดในการบันทึกจำนวนโต๊ะ",
    };
  }
}

/**
 * Server Action: Fetches all tables for the owner's current store.
 */
export async function getStoreTables(): Promise<TableActionResponse> {
  try {
    const { user, store } = await getCurrentOwnerStore();
    if (!user || !store) {
      return { success: false, error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
    }

    const storeTables = await db
      .select()
      .from(tables)
      .where(eq(tables.storeId, store.id))
      .orderBy(asc(tables.tableNumber));

    return {
      success: true,
      data: storeTables,
    };
  } catch (error) {
    console.error("getStoreTables error:", error);
    return {
      success: false,
      error: "ไม่สามารถดึงข้อมูลโต๊ะได้",
    };
  }
}
