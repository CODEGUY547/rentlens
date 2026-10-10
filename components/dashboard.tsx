"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, BellRing, Building2, CalendarClock, Check, ChevronRight, CircleDollarSign,
  Clock3, Download, Home, LogOut, Menu, MessageCircle, Plus, ReceiptText, Search,
  Send, Settings, Users, WalletCards, X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { demoMessages, demoPayments, demoTenants } from "@/lib/demo-data";
import { createReminderMessage, createWhatsAppUrl } from "@/lib/manual-whatsapp";
import type { MessageRow, PaymentRow, TenantRow, TenantStatus } from "@/lib/types";

type Tab = "overview" | "tenants" | "payments" | "messages" | "settings";
type Modal = "tenant" | "payment" | "promise" | null;

const nav: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "tenants", label: "Tenants", icon: Users },
  { id: "payments", label: "Payments", icon: WalletCards },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "settings", label: "Settings", icon: Settings },
];

function money(value: number) {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(value).replace("UGX", "UGX ");
}

function niceDate(value: string | null) {
  if (!value) return "No payment yet";
  return new Date(value).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: TenantStatus | MessageRow["status"] }) {
  return <span className={`status ${status}`}><i />{status.replace("_", " ")}</span>;
}

export default function Dashboard({ preview }: { preview: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!preview);
  const [tenants, setTenants] = useState<TenantRow[]>(preview ? demoTenants : []);
  const [payments, setPayments] = useState<PaymentRow[]>(preview ? demoPayments : []);
  const [messages, setMessages] = useState<MessageRow[]>(preview ? demoMessages : []);

  useEffect(() => {
    if (preview) return;
    const supabase = createClient();
    if (!supabase) {
      router.replace("/dashboard?demo=1");
      return;
    }
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      const [tenantResult, paymentResult, messageResult] = await Promise.all([
        supabase.from("tenant_overview").select("*").order("full_name"),
        supabase.from("payments").select("id,tenant_id,amount,paid_at,payment_method,reference,receipt_number,tenants(full_name,phone)").order("paid_at", { ascending: false }).limit(100),
        supabase.from("message_log").select("id,type,body,status,created_at,tenants(full_name,phone)").order("created_at", { ascending: false }).limit(100),
      ]);
      if (tenantResult.error) toast.error(tenantResult.error.message);
      else setTenants((tenantResult.data || []) as TenantRow[]);
      if (!paymentResult.error) setPayments((paymentResult.data || []).map((item) => {
        const joined = item.tenants as unknown as { full_name: string; phone: string } | null;
        return { ...item, amount: Number(item.amount), tenant_name: joined?.full_name || "Tenant", tenant_phone: joined?.phone || "" } as PaymentRow;
      }));
      if (!messageResult.error) setMessages((messageResult.data || []).map((item) => {
        const joined = item.tenants as unknown as { full_name: string; phone: string } | null;
        return { ...item, tenant_name: joined?.full_name || "Tenant", phone: joined?.phone || "" } as MessageRow;
      }));
      setLoading(false);
    })();
  }, [preview, router]);

  const totals = useMemo(() => {
    const expected = tenants.reduce((sum, item) => sum + item.monthly_rent, 0);
    const outstanding = tenants.reduce((sum, item) => sum + item.balance, 0);
    const collected = Math.max(0, expected - Math.min(expected, outstanding));
    return { expected, outstanding, collected, paid: tenants.filter((item) => item.status === "paid").length, late: tenants.filter((item) => item.status === "overdue").length };
  }, [tenants]);

  const filteredTenants = tenants.filter((item) => `${item.full_name} ${item.unit_name} ${item.phone}`.toLowerCase().includes(query.toLowerCase()));
  async function signOut() {
    await createClient()?.auth.signOut();
    router.push("/login");
  }

  function openModal(kind: Modal, tenantId = "") {
    setSelectedTenant(tenantId || tenants[0]?.id || "");
    setModal(kind);
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand"><span className="brand-mark"><Building2 /></span><span>RentLens<small>RENT & TENANT MANAGER</small></span></div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X /></button>
        </div>
        <nav>
          <span className="nav-label">WORKSPACE</span>
          {nav.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setMobileNav(false); }}><item.icon size={19} />{item.label}{item.id === "messages" && messages.some((m) => m.status === "failed") && <b>{messages.filter((m) => m.status === "failed").length}</b>}</button>)}
        </nav>
        <div className="sidebar-card"><BellRing /><strong>Next reminder run</strong><span>Tomorrow at 9:00 AM</span></div>
        <button className="account" onClick={signOut}><span>BM</span><div><strong>Bugembe Mahad</strong><small>Landlord account</small></div><LogOut size={17} /></button>
      </aside>
      {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close menu" />}

      <section className="workspace">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu /></button>
          <div><span className="eyebrow">OCTOBER 2026</span><h1>{nav.find((item) => item.id === tab)?.label}</h1></div>
          <div className="top-actions">{preview && <span className="preview-pill">Preview data</span>}<button className="secondary" onClick={() => openModal("promise")}><CalendarClock /> Add promise</button><button className="primary" onClick={() => openModal("payment")}><Plus /> Record payment</button></div>
        </header>

        <div className="content">
          {loading ? <LoadingState /> : tab === "overview" ? (
            <Overview totals={totals} tenants={tenants} messages={messages} openModal={openModal} setTab={setTab} />
          ) : tab === "tenants" ? (
            <Tenants tenants={filteredTenants} query={query} setQuery={setQuery} openModal={openModal} />
          ) : tab === "payments" ? (
            <Payments payments={payments} preview={preview} />
          ) : tab === "messages" ? (
            <Messages messages={messages} preview={preview} onStatusChange={(id, status) => setMessages(messages.map((item) => item.id === id ? { ...item, status } : item))} />
          ) : <SettingsPanel preview={preview} />}
        </div>
      </section>

      {modal && (
        <ModalShell title={modal === "tenant" ? "Add a tenant" : modal === "payment" ? "Record a payment" : "Record a payment promise"} subtitle={modal === "payment" ? "The balance and receipt will update automatically." : modal === "promise" ? "RentLens will remind this tenant on the promised date." : "Create the tenant and their rental unit."} close={() => setModal(null)}>
          {modal === "tenant" ? <TenantForm preview={preview} onCreated={(tenant) => { setTenants([...tenants, tenant]); setModal(null); }} /> : modal === "payment" ? <PaymentForm tenants={tenants} selected={selectedTenant} preview={preview} onPaid={(payment, tenantId, newBalance) => { setPayments([payment, ...payments]); setTenants(tenants.map((t) => t.id === tenantId ? { ...t, balance: newBalance, status: newBalance === 0 ? "paid" : "partial", last_payment_at: payment.paid_at } : t)); setModal(null); setTab("payments"); }} /> : <PromiseForm tenants={tenants} selected={selectedTenant} preview={preview} onSaved={(tenantId, date) => { setTenants(tenants.map((t) => t.id === tenantId ? { ...t, promise_date: date, status: "promised" } : t)); setModal(null); }} />}
        </ModalShell>
      )}
    </main>
  );
}

function Overview({ totals, tenants, messages, openModal, setTab }: { totals: { expected: number; outstanding: number; collected: number; paid: number; late: number }; tenants: TenantRow[]; messages: MessageRow[]; openModal: (kind: Modal, id?: string) => void; setTab: (tab: Tab) => void }) {
  const attention = tenants.filter((item) => item.status === "overdue" || item.status === "partial" || item.status === "promised");
  return <>
    <section className="welcome"><div><h2>Your rent collection at a glance</h2><p>Payments only count after you confirm them.</p></div><span><Clock3 /> Updated just now</span></section>
    <section className="metric-grid">
      <Metric icon={<CircleDollarSign />} label="Collected this month" value={money(totals.collected)} note={`${totals.paid} tenants fully paid`} tone="green" />
      <Metric icon={<WalletCards />} label="Expected rent" value={money(totals.expected)} note="Current monthly charges" />
      <Metric icon={<AlertCircle />} label="Outstanding" value={money(totals.outstanding)} note={`${totals.late} overdue tenants`} tone="amber" />
      <Metric icon={<MessageCircle />} label="Messages sent" value={String(messages.length)} note={`${messages.filter((m) => m.status === "failed").length} need attention`} />
    </section>
    <section className="overview-grid">
      <div className="panel">
        <div className="panel-head"><div><h3>Needs your attention</h3><p>Balances, overdue rent and payment promises</p></div><button className="text-button" onClick={() => setTab("tenants")}>See all <ChevronRight /></button></div>
        <div className="attention-list">
          {attention.slice(0, 5).map((tenant) => <article key={tenant.id}><span className="avatar">{tenant.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span><div className="person"><strong>{tenant.full_name}</strong><small>{tenant.unit_name} · Last paid {niceDate(tenant.last_payment_at)}</small></div><div className="balance"><strong>{money(tenant.balance)}</strong><StatusBadge status={tenant.status} /></div><button className="small-action" onClick={() => openModal("payment", tenant.id)}>Record payment</button></article>)}
          {!attention.length && <Empty icon={<Check />} title="Everyone is up to date" text="No outstanding balances need your attention." />}
        </div>
      </div>
      <div className="side-stack">
        <div className="panel collection-card"><span className="eyebrow light">COLLECTION PROGRESS</span><strong>{totals.expected ? Math.round((totals.collected / totals.expected) * 100) : 0}%</strong><div className="progress"><i style={{ width: `${totals.expected ? Math.min(100, (totals.collected / totals.expected) * 100) : 0}%` }} /></div><p>{money(totals.collected)} of {money(totals.expected)}</p></div>
        <div className="panel quick-card"><h3>Quick actions</h3><button onClick={() => openModal("payment")}><ReceiptText /> Confirm a payment <ChevronRight /></button><button onClick={() => openModal("promise")}><CalendarClock /> Add payment promise <ChevronRight /></button><button onClick={() => openModal("tenant")}><Users /> Add a new tenant <ChevronRight /></button></div>
      </div>
    </section>
  </>;
}

function Metric({ icon, label, value, note, tone = "plain" }: { icon: React.ReactNode; label: string; value: string; note: string; tone?: string }) {
  return <article className={`metric ${tone}`}><div className="metric-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{note}</small></article>;
}

function Tenants({ tenants, query, setQuery, openModal }: { tenants: TenantRow[]; query: string; setQuery: (value: string) => void; openModal: (kind: Modal, id?: string) => void }) {
  function sendReminder(tenant: TenantRow) {
    const url = createWhatsAppUrl(tenant.phone, createReminderMessage(tenant));
    if (!url) return toast.error("Add a valid WhatsApp number for this tenant");
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return <section className="panel page-panel">
    <div className="panel-head"><div><h2>Tenants</h2><p>Balances and payment information for every tenant.</p></div><button className="primary" onClick={() => openModal("tenant")}><Plus /> Add tenant</button></div>
    <div className="table-tools"><label className="search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tenant, unit or phone" /></label><span>{tenants.length} tenants</span></div>
    <div className="responsive-table"><table><thead><tr><th>Tenant</th><th>Monthly rent</th><th>Last payment</th><th>Balance</th><th>Status</th><th /></tr></thead><tbody>
      {tenants.map((tenant) => <tr key={tenant.id}><td><div className="person-cell"><span className="avatar">{tenant.full_name.slice(0, 2).toUpperCase()}</span><div><strong>{tenant.full_name}</strong><small>{tenant.unit_name} · {tenant.phone}</small></div></div></td><td>{money(tenant.monthly_rent)}</td><td>{niceDate(tenant.last_payment_at)}</td><td><strong>{money(tenant.balance)}</strong>{tenant.promise_date && <small className="cell-note">Promised {niceDate(tenant.promise_date)}</small>}</td><td><StatusBadge status={tenant.status} /></td><td><div className="row-actions"><button className="small-action whatsapp-action" disabled={!tenant.whatsapp_opt_in} title={tenant.whatsapp_opt_in ? "Open a prepared reminder in WhatsApp" : "Tenant has not opted in"} onClick={() => sendReminder(tenant)}><MessageCircle /> WhatsApp</button><button className="small-action" onClick={() => openModal("payment", tenant.id)}>Add payment</button></div></td></tr>)}
    </tbody></table></div>
  </section>;
}

function Payments({ payments, preview }: { payments: PaymentRow[]; preview: boolean }) {
  async function sendReceipt(payment: PaymentRow) {
    const popup = window.open("", "_blank");
    if (!popup) return toast.error("Allow pop-ups so RentLens can open WhatsApp");
    try {
      let receiptUrl = `${window.location.origin}/receipt/${payment.id}?demo=1`;
      if (!preview) {
        const response = await fetch(`/api/receipts/${payment.id}/share`, { method: "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not prepare the receipt link");
        receiptUrl = result.url;
      }
      const amount = new Intl.NumberFormat("en-UG").format(payment.amount);
      const message = `Hello ${payment.tenant_name}, thank you. We received your payment of UGX ${amount}. Receipt ${payment.receipt_number}: ${receiptUrl}`;
      const url = createWhatsAppUrl(payment.tenant_phone, message);
      if (!url) throw new Error("This tenant does not have a valid WhatsApp number");
      popup.location.href = url;
    } catch (cause) {
      popup.close();
      toast.error(cause instanceof Error ? cause.message : "Could not open WhatsApp");
    }
  }
  return <section className="panel page-panel"><div className="panel-head"><div><h2>Payment history</h2><p>Every confirmed payment and its numbered receipt.</p></div><button className="secondary"><Download /> Export CSV</button></div>
    <div className="responsive-table"><table><thead><tr><th>Receipt</th><th>Tenant</th><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th><th /></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><strong>{payment.receipt_number}</strong></td><td>{payment.tenant_name}</td><td>{niceDate(payment.paid_at)}</td><td>{payment.payment_method}</td><td>{payment.reference || "—"}</td><td><strong>{money(payment.amount)}</strong></td><td><div className="row-actions"><button className="small-action whatsapp-action" onClick={() => sendReceipt(payment)}><Send /> Send receipt</button><a className="small-action" href={`/receipt/${payment.id}${preview ? "?demo=1" : ""}`} target="_blank" rel="noreferrer">View</a></div></td></tr>)}</tbody></table></div>
  </section>;
}

function Messages({ messages, preview, onStatusChange }: { messages: MessageRow[]; preview: boolean; onStatusChange: (id: string, status: MessageRow["status"]) => void }) {
  async function openPrepared(message: MessageRow) {
    const url = createWhatsAppUrl(message.phone, message.body);
    if (!url) return toast.error("This tenant does not have a valid WhatsApp number");
    window.open(url, "_blank", "noopener,noreferrer");
    if (!preview && message.status === "queued") {
      const { error } = await createClient()!.from("message_log").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", message.id);
      if (!error) onStatusChange(message.id, "sent");
    }
  }
  return <section className="panel page-panel"><div className="panel-head"><div><h2>WhatsApp outbox</h2><p>RentLens prepares reminders; you review and send them from your WhatsApp.</p></div></div>
    <div className="responsive-table"><table><thead><tr><th>Tenant</th><th>Message</th><th>Type</th><th>Prepared</th><th>Status</th><th /></tr></thead><tbody>{messages.map((message) => <tr key={message.id}><td><strong>{message.tenant_name}</strong><small className="cell-note">{message.phone}</small></td><td className="message-preview">{message.body}</td><td className="capitalize">{message.type.replace("_", " ")}</td><td>{niceDate(message.created_at)}</td><td><StatusBadge status={message.status} /></td><td><button className="small-action whatsapp-action" onClick={() => openPrepared(message)}><MessageCircle /> {message.status === "queued" ? "Review & send" : "Open again"}</button></td></tr>)}</tbody></table></div>
  </section>;
}

function SettingsPanel({ preview }: { preview: boolean }) {
  return <div className="settings-grid"><section className="panel page-panel"><div className="panel-head"><div><h2>Reminder preparation</h2><p>RentLens checks who needs attention and prepares the message.</p></div></div><SettingRow title="Before rent is due" text="Prepare a friendly reminder 3 days before the due date." /><SettingRow title="On the due date" text="Prepare a reminder on each tenant’s due date." /><SettingRow title="Overdue follow-up" text="Prepare another reminder every 7 days while a balance remains." /><SettingRow title="Payment promises" text="Prepare a reminder on the tenant’s promised payment date." /></section><section className="panel page-panel"><div className="panel-head"><div><h2>WhatsApp sending</h2><p>Manual, safe and ready to use.</p></div></div><div className={`integration-state ${preview ? "pending" : ""}`}><MessageCircle /><div><strong>Manual WhatsApp is active</strong><p>RentLens prepares the message and secure receipt link. You review it and tap Send in WhatsApp.</p></div></div><div className="manual-steps"><span>1</span><p>Open a tenant or prepared reminder.</p><span>2</span><p>Review the message in WhatsApp.</p><span>3</span><p>Tap Send from the landlord’s account.</p></div></section></div>;
}

function SettingRow({ title, text }: { title: string; text: string }) { return <div className="setting-row"><div><strong>{title}</strong><p>{text}</p></div><label className="toggle"><input type="checkbox" defaultChecked /><span /></label></div>; }

function ModalShell({ title, subtitle, close, children }: { title: string; subtitle: string; close: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="modal"><header><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={close}><X /></button></header>{children}</section></div>;
}

function TenantForm({ preview, onCreated }: { preview: boolean; onCreated: (tenant: TenantRow) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "+256 ", property: "", unit: "", rent: "", dueDay: "5" });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const tenant: TenantRow = { id: crypto.randomUUID(), full_name: form.name, phone: form.phone, unit_name: `${form.property} · ${form.unit}`, monthly_rent: Number(form.rent), due_day: Number(form.dueDay), balance: Number(form.rent), last_payment_at: null, promise_date: null, status: "due", whatsapp_opt_in: true };
    if (!preview) {
      const { data, error } = await createClient()!.rpc("add_tenant_with_unit", { p_full_name: form.name, p_phone: form.phone, p_property_name: form.property, p_unit_name: form.unit, p_monthly_rent: Number(form.rent), p_due_day: Number(form.dueDay) });
      if (error) { setSaving(false); return toast.error(error.message); }
      tenant.id = data;
    }
    toast.success("Tenant added"); onCreated(tenant); setSaving(false);
  }
  return <form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="wide">Tenant full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Amina Nansubuga" /></label><label>WhatsApp number<input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label>Property<input required value={form.property} onChange={(e) => setForm({ ...form, property: e.target.value })} placeholder="e.g. Kisaasi Apartments" /></label><label>Unit<input required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. A03" /></label><label>Monthly rent (UGX)<input required type="number" min="0" value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} placeholder="650000" /></label><label>Due day<input required type="number" min="1" max="28" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} /></label></div><div className="consent-note"><MessageCircle /> Confirm that the tenant has agreed to receive rent messages on this WhatsApp number.</div><button className="primary full" disabled={saving}>{saving ? "Saving…" : "Add tenant"}</button></form>;
}

function PaymentForm({ tenants, selected, preview, onPaid }: { tenants: TenantRow[]; selected: string; preview: boolean; onPaid: (payment: PaymentRow, tenantId: string, balance: number) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ tenantId: selected || tenants[0]?.id || "", amount: "", method: "Mobile Money", reference: "", paidAt: new Date().toISOString().slice(0, 10) });
  const tenant = tenants.find((item) => item.id === form.tenantId);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!tenant) return; setSaving(true);
    let id = crypto.randomUUID(); let receipt = `RL-DEMO-${id.slice(0, 8).toUpperCase()}`;
    if (!preview) {
      const { data, error } = await createClient()!.rpc("record_rent_payment", { p_tenant_id: form.tenantId, p_amount: Number(form.amount), p_payment_method: form.method, p_reference: form.reference || null, p_paid_at: new Date(form.paidAt).toISOString() });
      if (error) { setSaving(false); return toast.error(error.message); }
      id = data.id; receipt = data.receipt_number;
    }
    const payment: PaymentRow = { id, tenant_id: tenant.id, tenant_name: tenant.full_name, tenant_phone: tenant.phone, amount: Number(form.amount), paid_at: new Date(form.paidAt).toISOString(), payment_method: form.method, reference: form.reference || null, receipt_number: receipt };
    toast.success("Payment confirmed. Send the receipt from Payment history."); onPaid(payment, tenant.id, Math.max(0, tenant.balance - Number(form.amount))); setSaving(false);
  }
  return <form className="modal-form" onSubmit={submit}><label>Tenant<select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}>{tenants.map((item) => <option key={item.id} value={item.id}>{item.full_name} — {item.unit_name}</option>)}</select></label>{tenant && <div className="balance-callout"><span>Current balance</span><strong>{money(tenant.balance)}</strong></div>}<div className="form-grid"><label>Amount received (UGX)<input autoFocus required type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="500000" /></label><label>Payment date<input required type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} /></label><label>Payment method<select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option>Mobile Money</option><option>Bank transfer</option><option>Cash</option><option>Cheque</option></select></label><label>Transaction reference<input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Optional" /></label></div><div className="consent-note"><ReceiptText /> A numbered receipt and thank-you message will be prepared after confirmation.</div><button className="primary full" disabled={saving}>{saving ? "Confirming…" : "Confirm payment & create receipt"}</button></form>;
}

function PromiseForm({ tenants, selected, preview, onSaved }: { tenants: TenantRow[]; selected: string; preview: boolean; onSaved: (tenantId: string, date: string) => void }) {
  const [saving, setSaving] = useState(false); const [tenantId, setTenantId] = useState(selected || tenants[0]?.id || ""); const [date, setDate] = useState(""); const [note, setNote] = useState("");
  async function submit(e: React.FormEvent) { e.preventDefault(); setSaving(true); if (!preview) { const { error } = await createClient()!.from("payment_promises").insert({ tenant_id: tenantId, promised_date: date, note }); if (error) { setSaving(false); return toast.error(error.message); } } toast.success("Payment promise saved"); onSaved(tenantId, date); setSaving(false); }
  return <form className="modal-form" onSubmit={submit}><label>Tenant<select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>{tenants.map((item) => <option key={item.id} value={item.id}>{item.full_name} — {money(item.balance)} due</option>)}</select></label><label>Promised payment date<input required type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></label><label>Note<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did the tenant say?" /></label><button className="primary full" disabled={saving}>{saving ? "Saving…" : "Save promise & schedule reminder"}</button></form>;
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="empty"><i>{icon}</i><strong>{title}</strong><p>{text}</p></div>; }
function LoadingState() { return <div className="loading-grid">{[1, 2, 3, 4].map((item) => <i key={item} />)}</div>; }
