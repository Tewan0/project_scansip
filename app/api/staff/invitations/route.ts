import { NextResponse } from "next/server";
import { AccessError, apiError, requireUser } from "@/lib/auth";
import { acceptStaffInvitation, declineStaffInvitation } from "@/lib/staff-invitations";

async function readInput(req: Request) {
  const origin = req.headers.get("origin");
  if (origin) {
    // Next.js may construct req.url with its bind address (0.0.0.0).
    // Host is the browser-facing authority; do not trust arbitrary forwarded hosts.
    const url = new URL(req.url);
    const host = req.headers.get("host") ?? url.host;
    let sameOrigin = false;
    try {
      if (!/[\/\\@?#,\s]/.test(host)) {
        sameOrigin = origin === new URL(url.protocol + "//" + host).origin;
      }
    } catch { /* Malformed authorities fail closed. */ }
    if (!sameOrigin) throw new AccessError("แหล่งที่มาของคำขอไม่ถูกต้อง", 403);
  }
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new AccessError("รูปแบบคำขอไม่ถูกต้อง", 415);
  }
  const body = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    typeof body.invitationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.invitationId)) {
    throw new AccessError("ข้อมูลคำเชิญไม่ถูกต้อง", 400);
  }
  return body;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await readInput(req);
    if (typeof body.storeId !== "string" || body.storeId.length > 100 || !["cashier", "kitchen"].includes(body.role)) {
      throw new AccessError("ข้อมูลคำเชิญไม่ถูกต้อง", 400);
    }
    const data = await acceptStaffInvitation(user, body.invitationId, body.storeId, body.role);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const response = apiError(error); response.headers.set("Cache-Control", "private, no-store"); return response; }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const body = await readInput(req);
    await declineStaffInvitation(user, body.invitationId);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const response = apiError(error); response.headers.set("Cache-Control", "private, no-store"); return response; }
}
