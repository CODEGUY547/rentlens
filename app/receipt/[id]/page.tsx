import { notFound } from "next/navigation";
import { demoPayments, demoTenants } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { RentReceipt } from "@/components/rent-receipt";
import { formatRentPeriod } from "@/lib/product";

type PaymentRecord = {
  id: string;
  tenant_id: string;
  amount: number | string;
  paid_at: string;
  payment_method: string;
  reference: string | null;
  receipt_number: string;
  balance_after?: number | string | null;
  tenant_name_snapshot?: string | null;
  unit_name_snapshot?: string | null;
  business_name_snapshot?: string | null;
  voided_at?: string | null;
  tenants: { full_name: string; phone: string; unit_name: string } | null;
};

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ demo?: string }> }) {
  const { id } = await params;
  const { demo } = await searchParams;
  const demoPayment = demoPayments.find((item) => item.id === id);
  const demoTenant = demoPayment ? demoTenants.find((item) => item.id === demoPayment.tenant_id) : undefined;

  if (demo === "1") {
    if (!demoPayment || !demoTenant) notFound();
    return <RentReceipt receiptNumber={demoPayment.receipt_number} paidAt={demoPayment.paid_at} tenantName={demoTenant.full_name} unitName={demoTenant.unit_name} amount={demoPayment.amount} paymentMethod={demoPayment.payment_method} reference={demoPayment.reference} balance={demoTenant.balance} businessName="Elias Estates" rentPeriods={[formatRentPeriod(demoPayment.paid_at)]} />;
  }

  const supabase = await createClient();
  if (!supabase) notFound();
  let result = await supabase.from("payments").select("id,tenant_id,amount,paid_at,payment_method,reference,receipt_number,balance_after,tenant_name_snapshot,unit_name_snapshot,business_name_snapshot,voided_at,tenants(full_name,phone,unit_name)").eq("id", id).single();
  const hasSnapshots = !result.error;
  if (result.error) {
    result = await supabase.from("payments").select("id,tenant_id,amount,paid_at,payment_method,reference,receipt_number,voided_at,tenants(full_name,phone,unit_name)").eq("id", id).single();
  }
  if (!result.data) notFound();
  const payment = result.data as unknown as PaymentRecord;
  const tenant = payment.tenants;
  if (!tenant) notFound();

  const [{ data: allocationRows }, { data: overview }, { data: auth }] = await Promise.all([
    supabase.from("payment_allocations").select("charges(charge_month)").eq("payment_id", id),
    supabase.from("tenant_overview").select("balance").eq("id", payment.tenant_id).single(),
    supabase.auth.getUser(),
  ]);
  let profileBusiness = "My Rentals";
  if (auth.user) {
    const { data: profile } = await supabase.from("profiles").select("business_name").eq("id", auth.user.id).single();
    profileBusiness = profile?.business_name || profileBusiness;
  }
  const rentPeriods = (allocationRows || []).flatMap((row) => {
    const charge = row.charges as unknown as { charge_month: string } | null;
    return charge ? [formatRentPeriod(charge.charge_month)] : [];
  });

  return <RentReceipt
    receiptNumber={payment.receipt_number}
    paidAt={payment.paid_at}
    tenantName={payment.tenant_name_snapshot || tenant.full_name}
    unitName={payment.unit_name_snapshot || tenant.unit_name}
    amount={Number(payment.amount)}
    paymentMethod={payment.payment_method}
    reference={payment.reference}
    balance={payment.balance_after == null ? Number(overview?.balance || 0) : Number(payment.balance_after)}
    balanceLabel={hasSnapshots && payment.balance_after != null ? "Balance After Payment" : "Current Balance"}
    businessName={payment.business_name_snapshot || profileBusiness}
    rentPeriods={rentPeriods}
    voided={Boolean(payment.voided_at)}
  />;
}
