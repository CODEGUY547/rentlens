import { notFound } from "next/navigation";
import { Building2, CheckCircle2 } from "lucide-react";
import { demoPayments, demoTenants } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";

function money(value: number) { return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(value); }

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ demo?: string }> }) {
  const { id } = await params;
  const { demo } = await searchParams;
  let payment = demoPayments.find((item) => item.id === id);
  let tenant = payment ? demoTenants.find((item) => item.id === payment?.tenant_id) : undefined;

  if (demo !== "1") {
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase.from("payments").select("id, amount, paid_at, payment_method, reference, receipt_number, tenant_id, tenants(full_name, phone, unit_name)").eq("id", id).single();
      if (data) {
        const joined = data.tenants as unknown as { full_name: string; phone: string; unit_name: string };
        payment = { id: data.id, tenant_id: data.tenant_id, tenant_name: joined.full_name, tenant_phone: joined.phone, amount: Number(data.amount), paid_at: data.paid_at, payment_method: data.payment_method, reference: data.reference, receipt_number: data.receipt_number };
        tenant = { id: data.tenant_id, full_name: joined.full_name, phone: joined.phone, unit_name: joined.unit_name, monthly_rent: 0, due_day: 1, balance: 0, last_payment_at: data.paid_at, promise_date: null, status: "paid", whatsapp_opt_in: true };
      }
    }
  }
  if (!payment || !tenant) notFound();

  return (
    <main className="receipt-page">
      <section className="receipt-card">
        <header><div className="brand"><span className="brand-mark"><Building2 /></span><span>RentLens<small>PAYMENT RECEIPT</small></span></div><div className="receipt-status"><CheckCircle2 /> Payment received</div></header>
        <div className="receipt-hero"><span>AMOUNT PAID</span><strong>{money(payment.amount)}</strong><p>Thank you, {tenant.full_name}</p></div>
        <div className="receipt-grid">
          <div><span>Receipt number</span><strong>{payment.receipt_number}</strong></div>
          <div><span>Payment date</span><strong>{new Date(payment.paid_at).toLocaleDateString("en-UG", { dateStyle: "long" })}</strong></div>
          <div><span>Tenant</span><strong>{tenant.full_name}</strong></div>
          <div><span>Unit</span><strong>{tenant.unit_name}</strong></div>
          <div><span>Payment method</span><strong>{payment.payment_method}</strong></div>
          <div><span>Reference</span><strong>{payment.reference || "—"}</strong></div>
        </div>
        <footer><p>This receipt was generated after the landlord confirmed the payment.</p><button onClick={undefined} className="print-note">Use your browser menu to print or save as PDF</button></footer>
      </section>
    </main>
  );
}
