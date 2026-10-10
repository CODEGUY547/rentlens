import { NextResponse } from "next/server";
import { canShareReceipts, signReceiptId } from "@/lib/receipt-share";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canShareReceipts()) return NextResponse.json({ error: "Receipt sharing secret is not configured" }, { status: 503 });

  const { data: payment, error } = await supabase
    .from("payments")
    .select("id,amount,receipt_number,tenant_id,tenants(full_name,phone)")
    .eq("id", id)
    .single();
  if (error || !payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  const tenant = payment.tenants as unknown as { full_name: string; phone: string };
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const token = signReceiptId(payment.id);
  return NextResponse.json({
    url: `${origin}/r/${payment.id}?token=${encodeURIComponent(token)}`,
    phone: tenant.phone,
    tenantName: tenant.full_name,
    amount: Number(payment.amount),
    receiptNumber: payment.receipt_number,
  });
}
