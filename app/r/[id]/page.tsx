import { notFound } from "next/navigation";
import { Building2, CheckCircle2 } from "lucide-react";
import { verifyReceiptToken } from "@/lib/receipt-share";
import { createAdmin } from "@/lib/supabase/server";

function money(value: number) {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(value);
}

export default async function SharedReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params;
  const { token = "" } = await searchParams;
  if (!verifyReceiptToken(id, token)) notFound();
  const admin = createAdmin();
  if (!admin) notFound();
  const { data: payment } = await admin
    .from("payments")
    .select("id,amount,paid_at,payment_method,reference,receipt_number,tenants(full_name,unit_name)")
    .eq("id", id)
    .is("voided_at", null)
    .single();
  if (!payment) notFound();
  const tenant = payment.tenants as unknown as { full_name: string; unit_name: string };

  return <main className="receipt-page"><section className="receipt-card">
    <header><div className="brand"><span className="brand-mark"><Building2 /></span><span>RentLens<small>PAYMENT RECEIPT</small></span></div><div className="receipt-status"><CheckCircle2 /> Payment received</div></header>
    <div className="receipt-hero"><span>AMOUNT PAID</span><strong>{money(Number(payment.amount))}</strong><p>Thank you, {tenant.full_name}</p></div>
    <div className="receipt-grid">
      <div><span>Receipt number</span><strong>{payment.receipt_number}</strong></div>
      <div><span>Payment date</span><strong>{new Date(payment.paid_at).toLocaleDateString("en-UG", { dateStyle: "long" })}</strong></div>
      <div><span>Tenant</span><strong>{tenant.full_name}</strong></div>
      <div><span>Unit</span><strong>{tenant.unit_name}</strong></div>
      <div><span>Payment method</span><strong>{payment.payment_method}</strong></div>
      <div><span>Reference</span><strong>{payment.reference || "—"}</strong></div>
    </div>
    <footer><p>This secure receipt was generated after the landlord confirmed the payment.</p><span className="print-note">Use your browser menu to print or save as PDF</span></footer>
  </section></main>;
}
