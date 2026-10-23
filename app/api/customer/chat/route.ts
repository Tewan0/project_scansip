import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { chatRateLimits, menuItems } from "@/db/schema";
import { AccessError } from "@/lib/auth";
import { withCustomerSession, customerError } from "@/lib/customer-session";
import { answerMenuQuestion, validateMessages } from "@/lib/customer-ai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    if (Number(req.headers.get("content-length") || 0) > 24000) throw new AccessError("ข้อความยาวเกินไป", 413);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 24000) throw new AccessError("ข้อความยาวเกินไป", 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new AccessError("ข้อมูลคำถามไม่ถูกต้อง", 400); }
    if (!body || typeof body !== "object") throw new AccessError("ข้อมูลคำถามไม่ถูกต้อง", 400);
    const messages = validateMessages(body.messages);
    const input = { storeSlug: body.storeSlug, tableNumber: body.tableNumber,
      sessionToken: req.headers.get("authorization")?.replace(/^Bearer /, "") };
    const menu = await withCustomerSession(input, async (tx, table) => {
      if (!process.env.GEMINI_AI_API_KEY?.trim()) throw new AccessError("ผู้ช่วย AI ยังไม่เปิดใช้งาน กรุณาเลือกเมนูหรือเรียกพนักงานได้ตามปกติ", 503);
      const now = new Date();
      // Lock order is store -> table -> counters. No external requests inside the transaction.
      const limits = [
        { id: `table:${table.id}`, windowKey: createHash("sha256").update(table.currentSessionToken!).digest("hex"), max: 40, cooldown: true },
        { id: `store:${table.storeId}`, windowKey: now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }), max: 100, cooldown: false },
      ];
      for (const limit of limits) {
        const [previous] = await tx.select().from(chatRateLimits).where(eq(chatRateLimits.id, limit.id)).for("update");
        const sameWindow = previous?.windowKey === limit.windowKey;
        if (sameWindow && previous.count >= limit.max) throw new AccessError(limit.cooldown ? "ถึงจำนวนคำถามของโต๊ะรอบนี้แล้ว กรุณาสอบถามพนักงาน" : "ผู้ช่วย AI ใช้ครบจำนวนคำถามของร้านวันนี้แล้ว กรุณาสอบถามพนักงาน", 429);
        if (sameWindow && limit.cooldown && now.getTime() - previous.lastUsedAt.getTime() < 5000) throw new AccessError("กรุณารอ 5 วินาทีก่อนถามอีกครั้ง", 429);
        const values = { windowKey: limit.windowKey, count: sameWindow ? previous.count + 1 : 1, lastUsedAt: now };
        if (previous) await tx.update(chatRateLimits).set(values).where(eq(chatRateLimits.id, limit.id));
        else await tx.insert(chatRateLimits).values({ id: limit.id, ...values });
      }
      return tx.select({ id: menuItems.id, name: menuItems.name, description: menuItems.description, price: menuItems.price, isAvailable: menuItems.isAvailable })
        .from(menuItems).where(and(eq(menuItems.storeId, table.storeId), eq(menuItems.isAvailable, true))).orderBy(asc(menuItems.name), asc(menuItems.id)).limit(80);
    }, true);
    const data = await answerMenuQuestion(messages, menu);
    // A table may close while the provider is answering. Discard that old-round answer.
    await withCustomerSession(input, async () => undefined);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return customerError(error); }
}
