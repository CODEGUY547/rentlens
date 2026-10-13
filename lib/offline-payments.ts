import type { OfflinePaymentDraft } from "./types";

const STORAGE_KEY = "rentlens-payment-drafts-v2";
const LEGACY_KEY = "rentlens-payment-drafts";

export function readPaymentDrafts(): OfflinePaymentDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as OfflinePaymentDraft[];
    if (current.length) return current;
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]") as Array<Record<string, unknown>>;
    const migrated = legacy.map((item) => ({
      id: crypto.randomUUID(),
      tenantId: String(item.tenantId || ""),
      tenantName: String(item.tenantName || "Tenant"),
      tenantPhone: String(item.tenantPhone || ""),
      amount: Number(item.amount || 0),
      method: String(item.method || "Cash"),
      reference: String(item.reference || ""),
      paidAt: String(item.paidAt || ""),
      savedAt: String(item.savedAt || new Date().toISOString()),
      attempts: 0,
    })).filter((item) => item.tenantId && item.amount > 0 && item.paidAt);
    if (migrated.length) writePaymentDrafts(migrated);
    localStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch {
    return [];
  }
}

export function writePaymentDrafts(drafts: OfflinePaymentDraft[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function addPaymentDraft(draft: OfflinePaymentDraft) {
  const drafts = [...readPaymentDrafts(), draft];
  writePaymentDrafts(drafts);
  return drafts;
}
