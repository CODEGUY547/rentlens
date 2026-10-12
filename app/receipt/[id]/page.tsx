import { notFound } from "next/navigation";
import { demoPayments, demoTenants } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { RentReceipt } from "@/components/rent-receipt";
import { formatRentPeriod } from "@/lib/product";

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ demo?: string }> }) {
  const { id } = await params;
  const { demo } = await searchParams;
  let payment = demoPayments.find((item) => item.id === id);
  let tenant = payment ? demoTenants.find((item) => item.id === payment?.tenant_id) : undefined;
  let balance = tenant?.balance ?? 0;
  let businessName = "Elias Estates";
  let rentPeriods = payment ? [new Date(payment.paid_at).toISOString().slice(0, 10)] : [];

  if (demo !== "1") {
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase.from("payments").select("id, amount, paid_at, payment_method, reference, receipt_number, tenant_id, tenants(full_name, phone, unit_name)").eq("id", id).single();
      if (data) {
        const joined = data.tenants as unknown as { full_name: string; phone: string; unit_name: string };
        payment = { id: data.id, tenant_id: data.tenant_id, tenant_name: joined.full_name, tenant_phone: joined.phone, amount: Number(data.amount), paid_at: data.paid_at, payment_method: data.payment_method, reference: data.reference, receipt_number: data.receipt_number };
        tenant = { id: data.tenant_id, full_name: joined.full_name, phone: joined.phone, unit_name: joined.unit_name, monthly_rent: 0, due_day: 1, balance: 0, last_payment_at: data.paid_at, promise_date: null, status: "paid", whatsapp_opt_in: true };
        const { data: overview } = await supabase.from("tenant_overview").select("balance").eq("id", data.tenant_id).single();
        balance = Number(overview?.balance || 0);
        const { data: allocationRows } = await supabase.from("payment_allocations").select("charges(charge_month)").eq("payment_id", id);
        rentPeriods = (allocationRows || []).flatMap((row) => {
          const charge = row.charges as unknown as { charge_month: string } | null;
          return charge ? [charge.charge_month] : [];
        });
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          const { data: profile } = await supabase.from("profiles").select("business_name").eq("id", auth.user.id).single();
          businessName = profile?.business_name || businessName;
        }
      }
    }
  }
  if (!payment || !tenant) notFound();

  return <RentReceipt receiptNumber={payment.receipt_number} paidAt={payment.paid_at} tenantName={tenant.full_name} unitName={tenant.unit_name} amount={payment.amount} paymentMethod={payment.payment_method} reference={payment.reference} balance={balance} businessName={businessName} rentPeriods={rentPeriods.map(formatRentPeriod)} />;
}
