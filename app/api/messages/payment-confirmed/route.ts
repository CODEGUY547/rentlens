import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { paymentId } = await request.json();
  const { data: payment, error } = await supabase.from("payments").select("id,amount,receipt_number,tenant_id,tenants(full_name,phone,whatsapp_opt_in)").eq("id", paymentId).single();
  if (error || !payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  const tenant = payment.tenants as unknown as { full_name: string; phone: string; whatsapp_opt_in: boolean };
  if (!tenant.whatsapp_opt_in) return NextResponse.json({ skipped: "Tenant has not opted in" });
  const body = `Thank you ${tenant.full_name}. We received UGX ${Number(payment.amount).toLocaleString("en-UG")}. Receipt ${payment.receipt_number}.`;
  const { data: message } = await supabase.from("message_log").insert({ landlord_id: auth.user.id, tenant_id: payment.tenant_id, payment_id: payment.id, type: "receipt", body, status: "queued", message_key: `receipt:${payment.id}` }).select("id").single();
  try {
    const providerId = await sendWhatsAppTemplate(tenant.phone, "rent_payment_receipt", "en", [{ type: "body", parameters: [{ type: "text", text: tenant.full_name }, { type: "text", text: Number(payment.amount).toLocaleString("en-UG") }, { type: "text", text: payment.receipt_number }] }, { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: payment.id }] }]);
    await supabase.from("message_log").update({ status: "sent", provider_message_id: providerId, sent_at: new Date().toISOString() }).eq("id", message?.id);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "Message failed";
    await supabase.from("message_log").update({ status: "failed", failure_reason: reason }).eq("id", message?.id);
    return NextResponse.json({ error: reason }, { status: 502 });
  }
}
