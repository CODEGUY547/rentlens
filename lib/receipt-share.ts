import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  return process.env.RECEIPT_SHARE_SECRET || process.env.CRON_SECRET || "";
}

export function canShareReceipts() {
  return Boolean(secret());
}

export function signReceiptId(paymentId: string) {
  const key = secret();
  if (!key) throw new Error("Receipt sharing is not configured");
  return createHmac("sha256", key).update(`rentlens-receipt:${paymentId}`).digest("base64url");
}

export function verifyReceiptToken(paymentId: string, token: string) {
  if (!token || !secret()) return false;
  const expected = signReceiptId(paymentId);
  const suppliedBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}
