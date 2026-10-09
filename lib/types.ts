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
  amount: number;
  paid_at: string;
  payment_method: string;
  reference: string | null;
  receipt_number: string;
}

export interface MessageRow {
  id: string;
  tenant_name: string;
  phone: string;
  type: "reminder" | "receipt" | "thank_you" | "holiday";
  body: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
  created_at: string;
}
