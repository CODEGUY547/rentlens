import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/server";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.CRON_SECRET && request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase service role is not configured" }, { status: 503 });
  await admin.rpc("generate_monthly_charges");
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const [{ data: charges }, { data: promises }] = await Promise.all([
    admin.from("charges").select("id,landlord_id,tenant_id,due_date,amount,paid_amount,status,tenants(full_name,phone,whatsapp_opt_in)").in("status", ["due", "partial"]).lte("due_date", horizon),
    admin.from("payment_promises").select("id,landlord_id,tenant_id,promised_date,tenants(full_name,phone,whatsapp_opt_in)").eq("status", "active").lte("promised_date", today),
  ]);
  let sent = 0, failed = 0, skipped = 0;
  for (const charge of charges || []) {
    const tenant = charge.tenants as unknown as { full_name: string; phone: string; whatsapp_opt_in: boolean };
    if (!tenant?.whatsapp_opt_in) { skipped++; continue; }
    const kind = charge.due_date < today ? "overdue" : charge.due_date === today ? "due" : "upcoming";
    const messageKey = `charge:${charge.id}:${kind}:${today}`;
    const body = kind === "overdue"
      ? `Hello ${tenant.full_name}, your rent balance of UGX ${(Number(charge.amount)-Number(charge.paid_amount)).toLocaleString("en-UG")} is overdue.`
      : `Hello ${tenant.full_name}, a friendly reminder that UGX ${(Number(charge.amount)-Number(charge.paid_amount)).toLocaleString("en-UG")} rent is due on ${charge.due_date}.`;
    const { data: row, error: insertError } = await admin.from("message_log").insert({ landlord_id: charge.landlord_id, tenant_id: charge.tenant_id, type: "reminder", body, message_key: messageKey }).select("id").single();
    if (insertError) { skipped++; continue; }
    try {
      const providerId = await sendWhatsAppTemplate(tenant.phone, kind === "overdue" ? "rent_overdue_reminder" : "rent_due_reminder", "en", [{ type: "body", parameters: [{ type: "text", text: tenant.full_name }, { type: "text", text: (Number(charge.amount)-Number(charge.paid_amount)).toLocaleString("en-UG") }, { type: "text", text: charge.due_date }] }]);
      await admin.from("message_log").update({ status: "sent", provider_message_id: providerId, sent_at: new Date().toISOString() }).eq("id", row.id); sent++;
    } catch (cause) {
      await admin.from("message_log").update({ status: "failed", failure_reason: cause instanceof Error ? cause.message : "Message failed" }).eq("id", row.id); failed++;
    }
  }
  for (const promise of promises || []) {
    const tenant = promise.tenants as unknown as { full_name: string; phone: string; whatsapp_opt_in: boolean };
    if (!tenant?.whatsapp_opt_in) { skipped++; continue; }
    const messageKey = `promise:${promise.id}:${promise.promised_date}`;
    const body = `Hello ${tenant.full_name}, this is a friendly reminder about the rent payment you planned for today.`;
    const { data: row, error: insertError } = await admin.from("message_log").insert({ landlord_id: promise.landlord_id, tenant_id: promise.tenant_id, type: "reminder", body, message_key: messageKey }).select("id").single();
    if (insertError) { skipped++; continue; }
    try {
      const providerId = await sendWhatsAppTemplate(tenant.phone, "payment_promise_reminder", "en", [{ type: "body", parameters: [{ type: "text", text: tenant.full_name }, { type: "text", text: promise.promised_date }] }]);
      await admin.from("message_log").update({ status: "sent", provider_message_id: providerId, sent_at: new Date().toISOString() }).eq("id", row.id); sent++;
    } catch (cause) {
      await admin.from("message_log").update({ status: "failed", failure_reason: cause instanceof Error ? cause.message : "Message failed" }).eq("id", row.id); failed++;
    }
  }
  return NextResponse.json({ ok: true, sent, failed, skipped });
}
