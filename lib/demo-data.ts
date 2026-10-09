import type { MessageRow, PaymentRow, TenantRow } from "./types";

export const demoTenants: TenantRow[] = [
  {
    id: "t1", full_name: "Sarah Namusoke", phone: "+256 772 445 180", unit_name: "Kisaasi · A02",
    monthly_rent: 650000, due_day: 5, balance: 0, last_payment_at: "2026-10-04", promise_date: null,
    status: "paid", whatsapp_opt_in: true,
  },
  {
    id: "t2", full_name: "Daniel Okello", phone: "+256 701 982 014", unit_name: "Ntinda · B04",
    monthly_rent: 800000, due_day: 5, balance: 300000, last_payment_at: "2026-10-03", promise_date: null,
    status: "partial", whatsapp_opt_in: true,
  },
  {
    id: "t3", full_name: "Mariam Nakiwala", phone: "+256 755 361 729", unit_name: "Kisaasi · A05",
    monthly_rent: 550000, due_day: 5, balance: 550000, last_payment_at: "2026-09-05", promise_date: "2026-10-12",
    status: "promised", whatsapp_opt_in: true,
  },
  {
    id: "t4", full_name: "Joseph Ssemanda", phone: "+256 786 110 663", unit_name: "Bweyogerere · C01",
    monthly_rent: 700000, due_day: 5, balance: 1400000, last_payment_at: "2026-08-30", promise_date: null,
    status: "overdue", whatsapp_opt_in: false,
  },
];

export const demoPayments: PaymentRow[] = [
  { id: "p1", tenant_id: "t1", tenant_name: "Sarah Namusoke", amount: 650000, paid_at: "2026-10-04T10:30:00Z", payment_method: "Mobile Money", reference: "MP24100481", receipt_number: "RL-2026-00128" },
  { id: "p2", tenant_id: "t2", tenant_name: "Daniel Okello", amount: 500000, paid_at: "2026-10-03T08:12:00Z", payment_method: "Bank transfer", reference: "DFCU-44810", receipt_number: "RL-2026-00127" },
  { id: "p3", tenant_id: "t3", tenant_name: "Mariam Nakiwala", amount: 550000, paid_at: "2026-09-05T15:45:00Z", payment_method: "Cash", reference: null, receipt_number: "RL-2026-00119" },
];

export const demoMessages: MessageRow[] = [
  { id: "m1", tenant_name: "Sarah Namusoke", phone: "+256 772 445 180", type: "receipt", body: "Payment received. Your receipt RL-2026-00128 is ready.", status: "read", created_at: "2026-10-04T10:31:00Z" },
  { id: "m2", tenant_name: "Daniel Okello", phone: "+256 701 982 014", type: "thank_you", body: "Thank you for your payment of UGX 500,000. Balance: UGX 300,000.", status: "delivered", created_at: "2026-10-03T08:14:00Z" },
  { id: "m3", tenant_name: "Mariam Nakiwala", phone: "+256 755 361 729", type: "reminder", body: "A friendly reminder about your promised payment date on 12 Oct.", status: "sent", created_at: "2026-10-09T06:00:00Z" },
  { id: "m4", tenant_name: "Joseph Ssemanda", phone: "+256 786 110 663", type: "reminder", body: "Your rent balance is overdue.", status: "failed", created_at: "2026-10-08T06:00:00Z" },
];
