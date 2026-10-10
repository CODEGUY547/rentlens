import type { TenantRow } from "./types";

export function normalizeWhatsAppNumber(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `256${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("7")) digits = `256${digits}`;
  return digits;
}

export function createWhatsAppUrl(phone: string, message: string) {
  const number = normalizeWhatsAppNumber(phone);
  if (!number) return "";
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function createReminderMessage(tenant: TenantRow) {
  const balance = new Intl.NumberFormat("en-UG").format(tenant.balance);
  if (tenant.promise_date) {
    const promisedDate = new Date(`${tenant.promise_date}T12:00:00`).toLocaleDateString("en-UG", { dateStyle: "long" });
    return `Hello ${tenant.full_name}, this is a friendly reminder about the rent payment you planned for ${promisedDate}. Your current balance is UGX ${balance}. Thank you.`;
  }
  if (tenant.status === "overdue") {
    return `Hello ${tenant.full_name}, this is a friendly reminder that your rent balance of UGX ${balance} for ${tenant.unit_name} is overdue. Please let us know when you expect to make the payment. Thank you.`;
  }
  return `Hello ${tenant.full_name}, this is a friendly reminder that your current rent balance for ${tenant.unit_name} is UGX ${balance}. Rent is normally due on day ${tenant.due_day} of the month. Thank you.`;
}
