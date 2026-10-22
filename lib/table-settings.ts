export const MIN_TABLE_COUNT = 1;
export const MAX_TABLE_COUNT = 15;

export const TABLE_STATUS_LABELS = {
  available: "ว่าง",
  occupied: "กำลังใช้งาน",
  reserved: "จองแล้ว",
} as const;

export function isValidTableCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value)
    && value >= MIN_TABLE_COUNT && value <= MAX_TABLE_COUNT;
}
