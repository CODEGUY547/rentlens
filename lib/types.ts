export type TenantStatus = "paid" | "partial" | "overdue" | "promised" | "due";

export interface TenantRow {
  id: string;
  full_name: string;
  phone: string;
  unit_name: string;
  monthly_rent: number;
  due_day: number;
  balance: number;
  last_payment_at: string | null;
  promise_date: string | null;
  status: TenantStatus;
  whatsapp_opt_in: boolean;
}

export interface PaymentRow {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_phone: string;
  amount: number;
  paid_at: string;
  payment_method: string;
  reference: string | null;
  receipt_number: string;
  balance_after?: number | null;
  voided_at?: string | null;
  void_reason?: string | null;
  tenant_name_snapshot?: string | null;
  unit_name_snapshot?: string | null;
  business_name_snapshot?: string | null;
}

export interface OfflinePaymentDraft {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  amount: number;
  method: string;
  reference: string;
  paidAt: string;
  savedAt: string;
  attempts: number;
  lastError?: string;
}

export interface MessageRow {
  id: string;
  tenant_id?: string;
  tenant_name: string;
  phone: string;
  type: "reminder" | "receipt" | "thank_you" | "holiday";
  body: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
  created_at: string;
  failure_reason?: string | null;
}

export interface ChargeRow {
  id: string;
  tenant_id: string;
  charge_month: string;
  due_date: string;
  description: string;
  amount: number;
  paid_amount: number;
  status: "due" | "partial" | "paid" | "waived";
}

export interface LandlordProfile {
  full_name: string;
  business_name: string;
}

export interface LandlordSettings {
  currency: string;
  timezone: string;
  remind_days_before: number;
  overdue_repeat_days: number;
  holiday_messages_enabled: boolean;
}
