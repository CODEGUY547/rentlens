import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("Verification failed", { status: 403 });
}

export async function POST(request: Request) {
  const admin = createAdmin();
  if (!admin) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const payload = await request.json();
  const statuses = payload?.entry?.flatMap((entry: { changes?: { value?: { statuses?: unknown[] } }[] }) => entry.changes?.flatMap((change) => change.value?.statuses || []) || []) || [];
  for (const item of statuses as { id: string; status: "sent"|"delivered"|"read"|"failed"; timestamp?: string; errors?: { title?: string; message?: string }[] }[]) {
    const update: Record<string, string> = { status: item.status };
    const timestamp = item.timestamp ? new Date(Number(item.timestamp) * 1000).toISOString() : new Date().toISOString();
    if (item.status === "sent") update.sent_at = timestamp;
    if (item.status === "delivered") update.delivered_at = timestamp;
    if (item.status === "read") update.read_at = timestamp;
    if (item.status === "failed") update.failure_reason = item.errors?.[0]?.title || item.errors?.[0]?.message || "Delivery failed";
    await admin.from("message_log").update(update).eq("provider_message_id", item.id);
  }
  return NextResponse.json({ received: true });
}
