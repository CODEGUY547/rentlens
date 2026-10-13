import { notFound } from "next/navigation";
import { RentReceipt } from "@/components/rent-receipt";
import { verifyReceiptToken } from "@/lib/receipt-share";
import { createAdmin } from "@/lib/supabase/server";
import { formatRentPeriod } from "@/lib/product";

type SharedPayment = {
  id: string;
  tenant_id: string;
  landlord_id: string;
  amount: number | string;
  paid_at: string;
  payment_method: string;
  reference: string | null;
  receipt_number: string;
  balance_after?: number | string | null;
  tenant_name_snapshot?: string | null;
  unit_name_snapshot?: string | null;
  business_name_snapshot?: string | null;
  tenants: { full_name: string; unit_name: string } | null;
};

export default async function SharedReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params;
  const { token = "" } = await searchParams;
  if (!verifyReceiptToken(id, token)) notFound();
  const admin = createAdmin();
  if (!admin) notFound();

  let result = await admin.from("payments").select("id,tenant_id,landlord_id,amount,paid_at,payment_method,reference,receipt_number,balance_after,tenant_name_snapshot,unit_name_snapshot,business_name_snapshot,tenants(full_name,unit_name)").eq("id", id).is("voided_at", null).single();
  const hasSnapshots = !result.error;
  if (result.error) {
    result = await admin.from("payments").select("id,tenant_id,landlord_id,amount,paid_at,payment_method,reference,receipt_number,tenants(full_name,unit_name)").eq("id", id).is("voided_at", null).single();
  }
  if (!result.data) notFound();
  const payment = result.data as unknown as SharedPayment;
  const tenant = payment.tenants;
  if (!tenant) notFound();

  const [{ data: charges }, { data: allocationRows }, { data: profile }] = await Promise.all([
    admin.from("charges").select("amount,paid_amount").eq("tenant_id", payment.tenant_id).in("status", ["due", "partial"]),
    admin.from("payment_allocations").select("charges(charge_month)").eq("payment_id", id),
    admin.from("profiles").select("business_name").eq("id", payment.landlord_id).single(),
  ]);
  const currentBalance = (charges || []).reduce((sum, charge) => sum + Number(charge.amount) - Number(charge.paid_amount), 0);
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
    balance={payment.balance_after == null ? currentBalance : Number(payment.balance_after)}
    balanceLabel={hasSnapshots && payment.balance_after != null ? "Balance After Payment" : "Current Balance"}
    businessName={payment.business_name_snapshot || profile?.business_name || "My Rentals"}
    rentPeriods={rentPeriods}
    secure
  />;
}
