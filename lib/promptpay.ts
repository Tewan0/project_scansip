function formatTlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export function crc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Generates an EMVCo-compliant Thai PromptPay QR payload string.
 * Supports 10-digit Thai mobile numbers (0xxxxxxxxx) and 13-digit National/Tax IDs.
 */
export function generatePromptPayPayload(target: string, amount?: number): string | null {
  if (typeof target !== "string") return null;
  const digits = target.replace(/[\s-]/g, "");

  let targetSubField: string;
  if (/^0\d{9}$/.test(digits)) {
    targetSubField = formatTlv("01", `0066${digits.slice(1)}`);
  } else if (/^\d{13}$/.test(digits)) {
    targetSubField = formatTlv("02", digits);
  } else {
    return null;
  }

  let amountField = "";
  if (amount !== undefined) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) {
      return null;
    }
    amountField = formatTlv("54", amount.toFixed(2));
  }

  const merchantInfo = formatTlv("00", "A000000677010111") + targetSubField;
  const payloadWithoutCrc =
    formatTlv("00", "01") +
    formatTlv("01", amountField ? "12" : "11") +
    formatTlv("29", merchantInfo) +
    formatTlv("58", "TH") +
    formatTlv("53", "764") +
    amountField +
    "6304";

  return payloadWithoutCrc + crc16Ccitt(payloadWithoutCrc);
}
