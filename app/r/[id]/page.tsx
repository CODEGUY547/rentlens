import { notFound } from "next/navigation";
import { RentReceipt } from "@/components/rent-receipt";
import { verifyReceiptToken } from "@/lib/receipt-share";
import { createAdmin } from "@/lib/supabase/server";
import { formatRentPeriod } from "@/lib/product";

export default async function SharedReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params;
  const { token = "" } = await searchParams;
  if (!verifyReceiptToken(id, token)) notFound();
  const admin = createAdmin();
  if (!admin) notFound();
  const { data: payment } = await admin
    .from("payments")
    .select("id,tenant_id,landlord_id,amount,paid_at,payment_method,reference,receipt_number,tenants(full_name,unit_name)")
    .eq("id", id)
    .is("voided_at", null)
    .single();
  if (!payment) notFound();
  const tenant = payment.tenants as unknown as { full_name: string; unit_name: string };
  const { data: charges } = await admin.from("charges").select("amount,paid_amount").eq("tenant_id", payment.tenant_id).in("status", ["due", "partial"]);
  const balance = (charges || []).reduce((sum, charge) => sum + Number(charge.amount) - Number(charge.paid_amount), 0);
  const [{ data: allocationRows }, { data: profile }] = await Promise.all([
    admin.from("payment_allocations").select("charges(charge_month)").eq("payment_id", id),
    admin.from("profiles").select("business_name").eq("id", payment.landlord_id).single(),
  ]);
  const rentPeriods = (allocationRows || []).flatMap((row) => {
    const charge = row.charges as unknown as { charge_month: string } | null;
    return charge ? [formatRentPeriod(charge.charge_month)] : [];
  });

  return <RentReceipt receiptNumber={payment.receipt_number} paidAt={payment.paid_at} tenantName={tenant.full_name} unitName={tenant.unit_name} amount={Number(payment.amount)} paymentMethod={payment.payment_method} reference={payment.reference} balance={balance} businessName={profile?.business_name || "My Rentals"} rentPeriods={rentPeriods} secure />;
}
