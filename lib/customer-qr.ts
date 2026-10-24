// Shared display rules; authorization must also run on the server.
export const CUSTOMER_QR_LIFETIME_MS = 24 * 60 * 60 * 1000;
type QrTable = {
  status: string; currentSessionToken: string | null;
  currentQrToken?: string | null; qrExpiresAt?: Date | string | null;
  sessionStartedAt?: Date | string | null;
};
export function customerQrToken(table: QrTable) {
  return table.currentQrToken ?? table.currentSessionToken;
}
export function customerQrExpiresAt(table: QrTable): number | null {
  // Legacy QR codes retain their original opening time; never grant a new window on read.
  const value = table.currentQrToken ? table.qrExpiresAt : table.sessionStartedAt;
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return table.currentQrToken ? time : time + CUSTOMER_QR_LIFETIME_MS;
}
export function customerQrProblem(table: QrTable | undefined, token: unknown, now = Date.now()) {
  if (!table || table.status !== "occupied" || !table.currentSessionToken) return "table_closed";
  if (typeof token !== "string" || !token || token.length > 200 || customerQrToken(table) !== token) return "session_expired";
  const expiresAt = customerQrExpiresAt(table);
  if (expiresAt === null || now >= expiresAt) return "qr_expired";
  return null;
}
export const QR_PROBLEM_MESSAGES = {
  table_closed: "โต๊ะนี้ยังไม่ได้เปิดให้บริการหรือปิดโต๊ะแล้ว กรุณาติดต่อพนักงาน",
  session_expired: "QR นี้ใช้ไม่ได้แล้ว กรุณาสแกน QR ล่าสุดจากพนักงาน",
  qr_expired: "QR หมดอายุ กรุณาติดต่อพนักงาน ออเดอร์ที่ส่งแล้วและบิลเดิมยังอยู่ครบ",
};
