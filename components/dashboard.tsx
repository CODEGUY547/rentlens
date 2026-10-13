"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, BellRing, Building2, CalendarClock, Check, ChevronRight,
  CircleDollarSign, Clock3, Download, Home, LogOut, Menu, MessageCircle,
  Plus, ReceiptText, Search, Send, Settings, Users, WalletCards, WifiOff, X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { demoCharges, demoMessages, demoPayments, demoTenants } from "@/lib/demo-data";
import { createReminderMessage, createWhatsAppUrl } from "@/lib/manual-whatsapp";
import { allocatePayment, currentMonthKey, formatRentPeriod, localDateISO } from "@/lib/product";
import type { ChargeRow, LandlordProfile, LandlordSettings, MessageRow, PaymentRow, TenantRow, TenantStatus } from "@/lib/types";

type Tab = "today" | "tenants" | "ledger" | "messages" | "settings";
type Modal = "tenant" | "payment" | "promise" | "detail" | null;

const nav: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "today", label: "Today", icon: Home },
  { id: "tenants", label: "Tenants & units", icon: Users },
  { id: "ledger", label: "Rent ledger", icon: WalletCards },
  { id: "messages", label: "WhatsApp outbox", icon: MessageCircle },
  { id: "settings", label: "Setup", icon: Settings },
];

const defaultProfile: LandlordProfile = { full_name: "Landlord", business_name: "My Rentals" };
const defaultSettings: LandlordSettings = { currency: "UGX", timezone: "Africa/Kampala", remind_days_before: 3, overdue_repeat_days: 7, holiday_messages_enabled: false };

function money(value: number) {
  return `UGX ${new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(value)}`;
}
function niceDate(value: string | null) {
  if (!value) return "No payment yet";
  return new Date(value).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
}
function initials(value: string) { return value.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(); }
function StatusBadge({ status }: { status: TenantStatus | MessageRow["status"] }) {
  return <span className={`status ${status}`}><i />{status.replace("_", " ")}</span>;
}

export default function Dashboard({ preview }: { preview: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("today");
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(true);
  const [profile, setProfile] = useState<LandlordProfile>(preview ? { full_name: "Bugembe Mahad", business_name: "Elias Estates" } : defaultProfile);
  const [settings, setSettings] = useState<LandlordSettings>(defaultSettings);
  const [tenants, setTenants] = useState<TenantRow[]>(preview ? demoTenants : []);
  const [payments, setPayments] = useState<PaymentRow[]>(preview ? demoPayments : []);
  const [messages, setMessages] = useState<MessageRow[]>(preview ? demoMessages : []);
  const [charges, setCharges] = useState<ChargeRow[]>(preview ? demoCharges : []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    queueMicrotask(update);
    addEventListener("online", update); addEventListener("offline", update);
    return () => { removeEventListener("online", update); removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    if (preview) return;
    const supabase = createClient();
    if (!supabase) { router.replace("/dashboard?demo=1"); return; }
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace("/login"); return; }
      const [tenantResult, paymentResult, messageResult, chargeResult, profileResult, settingsResult] = await Promise.all([
        supabase.from("tenant_overview").select("*").order("full_name"),
        supabase.from("payments").select("id,tenant_id,amount,paid_at,payment_method,reference,receipt_number,tenants(full_name,phone)").is("voided_at", null).order("paid_at", { ascending: false }).limit(200),
        supabase.from("message_log").select("id,tenant_id,type,body,status,created_at,failure_reason,tenants(full_name,phone)").order("created_at", { ascending: false }).limit(200),
        supabase.from("charges").select("id,tenant_id,charge_month,due_date,description,amount,paid_amount,status").order("due_date"),
        supabase.from("profiles").select("full_name,business_name").single(),
        supabase.from("landlord_settings").select("currency,timezone,remind_days_before,overdue_repeat_days,holiday_messages_enabled").single(),
      ]);
      const firstError = [tenantResult, paymentResult, messageResult, chargeResult].find((result) => result.error)?.error;
      if (firstError) setError(firstError.message);
      setTenants((tenantResult.data || []) as TenantRow[]);
      setPayments((paymentResult.data || []).map((item) => {
        const joined = item.tenants as unknown as { full_name: string; phone: string } | null;
        return { ...item, amount: Number(item.amount), tenant_name: joined?.full_name || "Tenant", tenant_phone: joined?.phone || "" } as PaymentRow;
      }));
      setMessages((messageResult.data || []).map((item) => {
        const joined = item.tenants as unknown as { full_name: string; phone: string } | null;
        return { ...item, tenant_name: joined?.full_name || "Tenant", phone: joined?.phone || "" } as MessageRow;
      }));
      setCharges((chargeResult.data || []).map((item) => ({ ...item, amount: Number(item.amount), paid_amount: Number(item.paid_amount) })) as ChargeRow[]);
      if (profileResult.data) setProfile(profileResult.data as LandlordProfile);
      if (settingsResult.data) setSettings(settingsResult.data as LandlordSettings);
      setLoading(false);
    })();
  }, [preview, router]);

  const totals = useMemo(() => {
    const month = currentMonthKey(settings.timezone);
    const monthPayments = payments.filter((payment) => payment.paid_at.slice(0, 7) === month);
    const monthCharges = charges.filter((charge) => charge.charge_month.slice(0, 7) === month);
    return {
      expected: monthCharges.reduce((sum, charge) => sum + charge.amount, 0),
      collected: monthPayments.reduce((sum, payment) => sum + payment.amount, 0),
      outstanding: tenants.reduce((sum, tenant) => sum + tenant.balance, 0),
      overdue: tenants.filter((tenant) => tenant.status === "overdue").length,
      receipts: monthPayments.length,
    };
  }, [charges, payments, settings.timezone, tenants]);
  const filteredTenants = tenants.filter((tenant) => `${tenant.full_name} ${tenant.unit_name} ${tenant.phone}`.toLowerCase().includes(query.toLowerCase()));
  const pendingMessages = messages.filter((message) => message.status === "queued" || message.status === "failed");

  async function signOut() { await createClient()?.auth.signOut(); router.push("/login"); }
  function openModal(kind: Modal, tenantId = "") { setSelectedTenant(tenantId || tenants[0]?.id || ""); setModal(kind); }

  if (loading) return <LoadingState />;
  return <main className="app-shell">
    <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
      <div className="sidebar-top"><div className="brand"><span className="brand-mark"><Building2 /></span><span>RentLens<small>RENT COLLECTION OS</small></span></div><button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X /></button></div>
      <div className="business-chip"><span>{initials(profile.business_name)}</span><div><strong>{profile.business_name}</strong><small>Landlord workspace</small></div></div>
      <nav><span className="nav-label">WORKSPACE</span>{nav.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setMobileNav(false); }}><item.icon size={19} />{item.label}{item.id === "messages" && pendingMessages.length > 0 && <b>{pendingMessages.length}</b>}</button>)}</nav>
      <div className="sidebar-card"><BellRing /><strong>{pendingMessages.length} messages ready</strong><span>Review before opening WhatsApp</span></div>
      <button className="account" onClick={signOut}><span>{initials(profile.full_name)}</span><div><strong>{profile.full_name}</strong><small>Landlord account</small></div><LogOut size={17} /></button>
    </aside>
    {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close menu" />}
    <section className="workspace">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu /></button><div><span className="eyebrow">{profile.business_name.toUpperCase()}</span><h1>{nav.find((item) => item.id === tab)?.label}</h1></div><div className="top-actions">{preview && <span className="preview-pill">Sample data</span>}<button className="secondary" onClick={() => openModal("promise")}><CalendarClock /> Add promise</button><button className="primary" onClick={() => openModal("payment")}><Plus /> Record payment</button></div></header>
      {!online && <div className="system-banner"><WifiOff /> You are offline. Payment drafts can be saved on this device and confirmed when you reconnect.</div>}
      {error && <div className="system-banner error"><AlertCircle /> Some records could not load: {error}</div>}
      <div className="content">
        {tab === "today" ? <Today totals={totals} tenants={tenants} messages={messages} openModal={openModal} setTab={setTab} /> :
          tab === "tenants" ? <Tenants tenants={filteredTenants} query={query} setQuery={setQuery} openModal={openModal} /> :
          tab === "ledger" ? <Ledger payments={payments} preview={preview} /> :
          tab === "messages" ? <Messages messages={messages} preview={preview} onStatusChange={(id, status) => setMessages(messages.map((message) => message.id === id ? { ...message, status } : message))} /> :
          <SettingsPanel preview={preview} profile={profile} settings={settings} onSaved={(nextProfile, nextSettings) => { setProfile(nextProfile); setSettings(nextSettings); }} />}
      </div>
    </section>
    <nav className="mobile-bottom-nav" aria-label="Main navigation">{nav.slice(0, 4).map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><item.icon size={20} /><span>{item.id === "ledger" ? "Ledger" : item.id === "messages" ? "Outbox" : item.label}</span></button>)}</nav>
    {modal && <ModalShell title={modal === "tenant" ? "Add tenant & unit" : modal === "payment" ? "Confirm a rent payment" : modal === "promise" ? "Record a payment promise" : "Tenant history"} close={() => setModal(null)}>
      {modal === "tenant" ? <TenantForm preview={preview} onCreated={(tenant) => { setTenants([...tenants, tenant]); setModal(null); }} /> : modal === "payment" ? <PaymentForm tenants={tenants} charges={charges} payments={payments} selected={selectedTenant} preview={preview} online={online} onPaid={(payment, tenantId, balance) => { setPayments([payment, ...payments]); setTenants(tenants.map((tenant) => tenant.id === tenantId ? { ...tenant, balance, status: balance === 0 ? "paid" : "partial", last_payment_at: payment.paid_at } : tenant)); setModal(null); setTab("ledger"); }} /> : modal === "promise" ? <PromiseForm tenants={tenants} selected={selectedTenant} preview={preview} onSaved={(tenantId, date) => { setTenants(tenants.map((tenant) => tenant.id === tenantId ? { ...tenant, promise_date: date, status: "promised" } : tenant)); setModal(null); }} /> : <TenantDetail tenant={tenants.find((tenant) => tenant.id === selectedTenant)} payments={payments} charges={charges} messages={messages} preview={preview} onPayment={() => openModal("payment", selectedTenant)} />}
    </ModalShell>}
  </main>;
}

function Today({ totals, tenants, messages, openModal, setTab }: { totals: { expected: number; collected: number; outstanding: number; overdue: number; receipts: number }; tenants: TenantRow[]; messages: MessageRow[]; openModal: (kind: Modal, id?: string) => void; setTab: (tab: Tab) => void }) {
  const attention = [...tenants].filter((tenant) => tenant.status !== "paid").sort((a, b) => (a.status === "overdue" ? -1 : 0) - (b.status === "overdue" ? -1 : 0));
  const progress = totals.expected ? Math.min(100, Math.round((totals.collected / totals.expected) * 100)) : 0;
  return <>
    <section className="rent-cycle-hero"><div><span className="eyebrow light">THIS MONTH&apos;S RENT CYCLE</span><h2>{money(totals.collected)} collected</h2><p>{progress}% of {money(totals.expected)} expected · {totals.receipts} receipts issued</p></div><div className="cycle-progress"><strong>{progress}%</strong><div className="progress"><i style={{ width: `${progress}%` }} /></div></div></section>
    <section className="metric-grid"><Metric icon={<CircleDollarSign />} label="Collected this month" value={money(totals.collected)} note="Confirmed payments only" tone="green" /><Metric icon={<WalletCards />} label="Expected rent" value={money(totals.expected)} note="This month’s charges" /><Metric icon={<AlertCircle />} label="Total outstanding" value={money(totals.outstanding)} note={`${totals.overdue} overdue tenants`} tone="amber" /><Metric icon={<MessageCircle />} label="Ready to send" value={String(messages.filter((message) => message.status === "queued" || message.status === "failed").length)} note="In WhatsApp outbox" /></section>
    <section className="today-grid"><div className="panel"><div className="panel-head"><div><h3>Today&apos;s attention list</h3><p>Start with overdue balances and promises.</p></div><button className="text-button" onClick={() => setTab("tenants")}>All tenants <ChevronRight /></button></div><div className="attention-list">{attention.slice(0, 6).map((tenant) => <article key={tenant.id}><span className="avatar">{initials(tenant.full_name)}</span><div className="person"><strong>{tenant.full_name}</strong><small>{tenant.unit_name} · Last paid {niceDate(tenant.last_payment_at)}</small></div><div className="balance"><strong>{money(tenant.balance)}</strong><StatusBadge status={tenant.status} /></div><div className="row-actions"><button className="small-action" onClick={() => openModal("detail", tenant.id)}>History</button><button className="small-action" onClick={() => openModal("payment", tenant.id)}>Record payment</button></div></article>)}{!attention.length && <Empty icon={<Check />} title="Everything is clear" text="No balances need attention today." />}</div></div>
      <aside className="today-aside"><div className="panel quick-card"><h3>Quick actions</h3><button onClick={() => openModal("payment")}><ReceiptText /> Confirm payment <ChevronRight /></button><button onClick={() => openModal("promise")}><CalendarClock /> Add promise <ChevronRight /></button><button onClick={() => openModal("tenant")}><Users /> Add tenant <ChevronRight /></button></div><div className="panel outbox-snapshot"><MessageCircle /><div><strong>{messages.filter((message) => message.status === "queued" || message.status === "failed").length} messages waiting</strong><p>Review all prepared reminders from one guided queue.</p></div><button className="secondary full" onClick={() => setTab("messages")}>Open outbox</button></div></aside></section>
  </>;
}

function Metric({ icon, label, value, note, tone = "plain" }: { icon: React.ReactNode; label: string; value: string; note: string; tone?: string }) { return <article className={`metric ${tone}`}><div className="metric-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{note}</small></article>; }

function Tenants({ tenants, query, setQuery, openModal }: { tenants: TenantRow[]; query: string; setQuery: (value: string) => void; openModal: (kind: Modal, id?: string) => void }) {
  const [filter, setFilter] = useState<"all" | "overdue" | "promised">("all");
  const visible = tenants.filter((tenant) => filter === "all" || tenant.status === filter);
  function remind(tenant: TenantRow) { const url = createWhatsAppUrl(tenant.phone, createReminderMessage(tenant)); if (!url) return toast.error("Add a valid WhatsApp number"); window.open(url, "_blank", "noopener,noreferrer"); }
  return <section className="panel page-panel records-page"><div className="panel-head"><div><h2>Tenants & units</h2><p>Open a tenant to see their complete rent history.</p></div><button className="primary" onClick={() => openModal("tenant")}><Plus /> Add tenant</button></div><div className="record-tools"><label className="search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tenant, unit or phone" /></label><div className="filter-tabs">{(["all", "overdue", "promised"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}</button>)}</div></div>
    <div className="desktop-records responsive-table"><table><thead><tr><th>Tenant</th><th>Monthly rent</th><th>Last payment</th><th>Balance</th><th>Status</th><th /></tr></thead><tbody>{visible.map((tenant) => <tr key={tenant.id}><td><button className="person-link" onClick={() => openModal("detail", tenant.id)}><span className="avatar">{initials(tenant.full_name)}</span><span><strong>{tenant.full_name}</strong><small>{tenant.unit_name} · {tenant.phone}</small></span></button></td><td>{money(tenant.monthly_rent)}</td><td>{niceDate(tenant.last_payment_at)}</td><td><strong>{money(tenant.balance)}</strong></td><td><StatusBadge status={tenant.status} /></td><td><div className="row-actions"><button className="small-action whatsapp-action" disabled={!tenant.whatsapp_opt_in} onClick={() => remind(tenant)}><MessageCircle /> Remind</button><button className="small-action" onClick={() => openModal("payment", tenant.id)}>Pay</button></div></td></tr>)}</tbody></table></div>
    <div className="mobile-records">{visible.map((tenant) => <article className="record-card" key={tenant.id}><button className="record-card-main" onClick={() => openModal("detail", tenant.id)}><span className="avatar">{initials(tenant.full_name)}</span><span><strong>{tenant.full_name}</strong><small>{tenant.unit_name}</small></span><span><strong>{money(tenant.balance)}</strong><StatusBadge status={tenant.status} /></span></button><div className="record-card-actions"><button onClick={() => remind(tenant)} disabled={!tenant.whatsapp_opt_in}><MessageCircle /> Remind</button><button onClick={() => openModal("payment", tenant.id)}><Plus /> Payment</button></div></article>)}</div>
  </section>;
}

function Ledger({ payments, preview }: { payments: PaymentRow[]; preview: boolean }) {
  function exportCsv() { const rows = [["Receipt", "Tenant", "Date", "Method", "Reference", "Amount"], ...payments.map((p) => [p.receipt_number, p.tenant_name, p.paid_at, p.payment_method, p.reference || "", String(p.amount)])]; const blob = new Blob([rows.map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `rentlens-ledger-${localDateISO()}.csv`; link.click(); URL.revokeObjectURL(link.href); }
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return <section className="panel page-panel records-page"><div className="panel-head"><div><h2>Rent ledger</h2><p>A permanent trail of confirmed payments and receipts.</p></div><button className="secondary" onClick={exportCsv}><Download /> Export CSV</button></div><div className="ledger-summary"><span><small>Recorded payments</small><strong>{payments.length}</strong></span><span><small>Total recorded</small><strong>{money(total)}</strong></span></div><div className="desktop-records responsive-table"><table><thead><tr><th>Receipt</th><th>Tenant</th><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th><th /></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><strong>{payment.receipt_number}</strong></td><td>{payment.tenant_name}</td><td>{niceDate(payment.paid_at)}</td><td>{payment.payment_method}</td><td>{payment.reference || "—"}</td><td><strong>{money(payment.amount)}</strong></td><td><a className="small-action" href={`/receipt/${payment.id}${preview ? "?demo=1" : ""}`} target="_blank" rel="noreferrer">Receipt</a></td></tr>)}</tbody></table></div><div className="mobile-records">{payments.map((payment) => <article className="record-card payment-card" key={payment.id}><div><span className="receipt-code">{payment.receipt_number}</span><strong>{payment.tenant_name}</strong><small>{niceDate(payment.paid_at)} · {payment.payment_method}</small></div><div><strong>{money(payment.amount)}</strong><a href={`/receipt/${payment.id}${preview ? "?demo=1" : ""}`} target="_blank" rel="noreferrer">Open receipt</a></div></article>)}</div></section>;
}

function Messages({ messages, preview, onStatusChange }: { messages: MessageRow[]; preview: boolean; onStatusChange: (id: string, status: MessageRow["status"]) => void }) {
  const pending = messages.filter((message) => message.status === "queued" || message.status === "failed");
  const [queue, setQueue] = useState<MessageRow[]>([]); const [index, setIndex] = useState<number | null>(null); const [opened, setOpened] = useState(false);
  const current = index === null ? null : queue[index]; const complete = index !== null && index >= queue.length;
  function openMessage(message: MessageRow) { const url = createWhatsAppUrl(message.phone, message.body); if (!url) return toast.error("Invalid WhatsApp number"); const popup = window.open(url, "_blank"); if (!popup) return toast.error("Allow pop-ups to open WhatsApp"); setOpened(true); }
  async function confirm() { if (!current) return; if (!preview) { const { error } = await createClient()!.from("message_log").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", current.id); if (error) return toast.error(error.message); } onStatusChange(current.id, "sent"); setIndex((value) => (value ?? 0) + 1); setOpened(false); }
  return <><section className="panel page-panel records-page"><div className="panel-head"><div><h2>WhatsApp outbox</h2><p>One guided button for every reminder that is ready.</p></div><button className="primary" disabled={!pending.length} onClick={() => { setQueue(pending); setIndex(0); setOpened(false); }}><Send /> Send all ({pending.length})</button></div><div className="outbox-clear"><Check /> RentLens prepares messages. You remain in control of the final WhatsApp send.</div><div className="desktop-records responsive-table"><table><thead><tr><th>Tenant</th><th>Message</th><th>Type</th><th>Status</th><th /></tr></thead><tbody>{messages.map((message) => <tr key={message.id}><td><strong>{message.tenant_name}</strong><small className="cell-note">{message.phone}</small></td><td className="message-preview">{message.body}</td><td className="capitalize">{message.type.replace("_", " ")}</td><td><StatusBadge status={message.status} /></td><td><button className="small-action whatsapp-action" onClick={() => openMessage(message)}>Open</button></td></tr>)}</tbody></table></div><div className="mobile-records">{messages.map((message) => <article className="record-card message-card" key={message.id}><div><strong>{message.tenant_name}</strong><StatusBadge status={message.status} /></div><p>{message.body}</p>{message.failure_reason && <small className="inline-error">{message.failure_reason}</small>}<button onClick={() => openMessage(message)}><MessageCircle /> Review in WhatsApp</button></article>)}</div></section>
    {index !== null && <ModalShell title={complete ? "Outbox reviewed" : `Message ${index + 1} of ${queue.length}`} close={() => setIndex(null)}>{complete ? <div className="queue-complete"><span><Check /></span><h3>All messages reviewed</h3><p>Skipped messages remain in the outbox for later.</p><button className="primary full" onClick={() => setIndex(null)}>Done</button></div> : current && <div className="queue-body"><div className="queue-progress"><i style={{ width: `${((index + 1) / queue.length) * 100}%` }} /></div><div className="queue-person"><span className="avatar">{initials(current.tenant_name)}</span><div><strong>{current.tenant_name}</strong><small>{current.phone}</small></div></div><div className="queue-message"><span>Prepared message</span><p>{current.body}</p></div>{!opened ? <button className="primary full" onClick={() => openMessage(current)}><MessageCircle /> Open in WhatsApp</button> : <button className="primary full" onClick={confirm}><Check /> Sent — next message</button>}<button className="secondary full" onClick={() => { setIndex(index + 1); setOpened(false); }}>Skip for now</button></div>}</ModalShell>}
  </>;
}

function SettingsPanel({ preview, profile, settings, onSaved }: { preview: boolean; profile: LandlordProfile; settings: LandlordSettings; onSaved: (profile: LandlordProfile, settings: LandlordSettings) => void }) {
  const [nextProfile, setNextProfile] = useState(profile); const [nextSettings, setNextSettings] = useState(settings); const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent) { event.preventDefault(); setSaving(true); if (!preview) { const supabase = createClient()!; const [a, b] = await Promise.all([supabase.from("profiles").update(nextProfile).eq("id", (await supabase.auth.getUser()).data.user!.id), supabase.from("landlord_settings").update(nextSettings).eq("landlord_id", (await supabase.auth.getUser()).data.user!.id)]); if (a.error || b.error) { setSaving(false); return toast.error(a.error?.message || b.error?.message); } } onSaved(nextProfile, nextSettings); toast.success("Settings saved"); setSaving(false); }
  return <div className="settings-grid"><form className="panel page-panel settings-form" onSubmit={save}><div className="panel-head"><div><h2>Business & reminders</h2><p>These values now drive the workspace and receipt identity.</p></div></div><div className="form-grid"><label>Business name<input value={nextProfile.business_name} onChange={(event) => setNextProfile({ ...nextProfile, business_name: event.target.value })} /></label><label>Your name<input value={nextProfile.full_name} onChange={(event) => setNextProfile({ ...nextProfile, full_name: event.target.value })} /></label><label>Reminder days before<input type="number" min="0" max="30" value={nextSettings.remind_days_before} onChange={(event) => setNextSettings({ ...nextSettings, remind_days_before: Number(event.target.value) })} /></label><label>Overdue repeat days<input type="number" min="1" max="30" value={nextSettings.overdue_repeat_days} onChange={(event) => setNextSettings({ ...nextSettings, overdue_repeat_days: Number(event.target.value) })} /></label></div><label className="consent-check"><input type="checkbox" checked={nextSettings.holiday_messages_enabled} onChange={(event) => setNextSettings({ ...nextSettings, holiday_messages_enabled: event.target.checked })} /><span><strong>Prepare holiday greetings</strong><small>Only for tenants who opted into WhatsApp messages.</small></span></label><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button></form><aside className="settings-side"><div className="panel system-card"><h3>System status</h3><div className="system-row"><span>Database</span><strong className="good">Connected</strong></div><div className="system-row"><span>Receipts</span><strong className="good">Ready</strong></div><div className="system-row"><span>WhatsApp</span><strong>Manual send</strong></div><p>Automatic sending requires an approved WhatsApp Business provider. The current flow never claims a message was delivered until you confirm it.</p></div><div className="panel expectation-card"><Clock3 /><div><strong>What happens automatically?</strong><p>Balances, allocations, numbered receipts and the outbox update after a confirmed payment.</p></div></div></aside></div>;
}

function ModalShell({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; closeRef.current?.focus(); const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); }; addEventListener("keydown", key); return () => { removeEventListener("keydown", key); previous?.focus(); }; }, [close]);
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}><section className="modal"><header><div><span className="eyebrow">RENTLENS</span><h2>{title}</h2></div><button ref={closeRef} className="icon-button" onClick={close} aria-label="Close dialog"><X /></button></header>{children}</section></div>;
}

function TenantForm({ preview, onCreated }: { preview: boolean; onCreated: (tenant: TenantRow) => void }) {
  const [saving, setSaving] = useState(false); const [form, setForm] = useState({ name: "", phone: "+256 ", property: "", unit: "", rent: "", dueDay: "5", consent: false });
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!form.consent) return toast.error("Confirm WhatsApp consent or add the tenant later without messaging"); setSaving(true); const tenant: TenantRow = { id: crypto.randomUUID(), full_name: form.name, phone: form.phone, unit_name: `${form.property} · ${form.unit}`, monthly_rent: Number(form.rent), due_day: Number(form.dueDay), balance: Number(form.rent), last_payment_at: null, promise_date: null, status: "due", whatsapp_opt_in: true }; if (!preview) { const { data, error } = await createClient()!.rpc("add_tenant_with_unit", { p_full_name: form.name, p_phone: form.phone, p_property_name: form.property, p_unit_name: form.unit, p_monthly_rent: Number(form.rent), p_due_day: Number(form.dueDay) }); if (error) { setSaving(false); return toast.error(error.message); } tenant.id = data; } onCreated(tenant); toast.success("Tenant and current rent charge added"); }
  return <form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="wide">Tenant full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Amina Nansubuga" /></label><label>WhatsApp number<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Property<input required value={form.property} onChange={(event) => setForm({ ...form, property: event.target.value })} placeholder="e.g. Kisaasi Apartments" /></label><label>Unit / room<input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="e.g. A03" /></label><label>Monthly rent (UGX)<input required type="number" min="1" value={form.rent} onChange={(event) => setForm({ ...form, rent: event.target.value })} /></label><label>Rent due day<input required type="number" min="1" max="28" value={form.dueDay} onChange={(event) => setForm({ ...form, dueDay: event.target.value })} /><small className="field-help">The calendar day rent is expected each month.</small></label></div><label className="consent-check"><input type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /><span><strong>Tenant agreed to WhatsApp messages</strong><small>Keep consent records before sending reminders or receipts.</small></span></label><button className="primary full" disabled={saving}>{saving ? "Saving…" : "Add tenant & unit"}</button></form>;
}

function PaymentForm({ tenants, charges, payments, selected, preview, online, onPaid }: { tenants: TenantRow[]; charges: ChargeRow[]; payments: PaymentRow[]; selected: string; preview: boolean; online: boolean; onPaid: (payment: PaymentRow, tenantId: string, balance: number) => void }) {
  const [saving, setSaving] = useState(false); const [form, setForm] = useState({ tenantId: selected || tenants[0]?.id || "", amount: "", method: "Mobile Money", reference: "", paidAt: localDateISO() });
  const tenant = tenants.find((item) => item.id === form.tenantId); const amount = Number(form.amount || 0); const allocations = allocatePayment(charges.filter((charge) => charge.tenant_id === form.tenantId), amount); const unallocated = Math.max(0, amount - allocations.reduce((sum, item) => sum + item.allocated, 0)); const duplicate = payments.some((payment) => payment.tenant_id === form.tenantId && payment.amount === amount && payment.paid_at.slice(0, 10) === form.paidAt);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!tenant || amount <= 0) return; if (amount > tenant.balance) return toast.error("This is more than the outstanding balance. Record only the amount being allocated."); if (duplicate && !confirm("A payment with the same tenant, amount and date already exists. Record it again?")) return; if (!online && !preview) { const drafts = JSON.parse(localStorage.getItem("rentlens-payment-drafts") || "[]"); localStorage.setItem("rentlens-payment-drafts", JSON.stringify([...drafts, { ...form, savedAt: new Date().toISOString() }])); toast.success("Payment draft saved on this device. Reconnect to confirm it."); return; } setSaving(true); let id = crypto.randomUUID(); let receipt = `RL-DEMO-${id.slice(0, 8).toUpperCase()}`; if (!preview) { const { data, error } = await createClient()!.rpc("record_rent_payment", { p_tenant_id: form.tenantId, p_amount: amount, p_payment_method: form.method, p_reference: form.reference || null, p_paid_at: `${form.paidAt}T12:00:00+03:00` }); if (error) { setSaving(false); return toast.error(error.message); } id = data.id; receipt = data.receipt_number; } const payment: PaymentRow = { id, tenant_id: tenant.id, tenant_name: tenant.full_name, tenant_phone: tenant.phone, amount, paid_at: `${form.paidAt}T12:00:00+03:00`, payment_method: form.method, reference: form.reference || null, receipt_number: receipt }; onPaid(payment, tenant.id, Math.max(0, tenant.balance - amount)); toast.success("Payment confirmed and receipt created"); }
  return <form className="modal-form" onSubmit={submit}><label>Tenant<select value={form.tenantId} onChange={(event) => setForm({ ...form, tenantId: event.target.value, amount: "" })}>{tenants.map((item) => <option key={item.id} value={item.id}>{item.full_name} — {item.unit_name}</option>)}</select></label>{tenant && <div className="balance-callout"><span>Outstanding balance</span><strong>{money(tenant.balance)}</strong></div>}<div className="form-grid"><label>Amount received (UGX)<input autoFocus required type="number" min="1" max={tenant?.balance || undefined} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label>Payment date<input required type="date" value={form.paidAt} onChange={(event) => setForm({ ...form, paidAt: event.target.value })} /></label><label>Payment method<select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}><option>Mobile Money</option><option>Bank transfer</option><option>Cash</option><option>Cheque</option></select></label><label>Transaction reference<input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Optional but recommended" /></label></div>{tenant && <div className="amount-shortcuts"><button type="button" onClick={() => setForm({ ...form, amount: String(Math.min(tenant.monthly_rent, tenant.balance)) })}>This month</button><button type="button" onClick={() => setForm({ ...form, amount: String(tenant.balance) })}>Full balance</button></div>}{amount > 0 && <div className="allocation-preview"><strong>How this payment will be used</strong>{allocations.map((item) => <span key={item.id}><i>{formatRentPeriod(item.charge_month)}</i><b>{money(item.allocated)}</b></span>)}{unallocated > 0 && <span className="inline-error"><i>Unallocated</i><b>{money(unallocated)}</b></span>}<span><i>Balance after payment</i><b>{money(Math.max(0, (tenant?.balance || 0) - amount))}</b></span></div>}{duplicate && <p className="inline-error">Possible duplicate: the same amount is already recorded for this tenant on this date.</p>}<button className="primary full" disabled={saving}>{saving ? "Confirming…" : online || preview ? "Confirm payment & create receipt" : "Save offline draft"}</button></form>;
}

function PromiseForm({ tenants, selected, preview, onSaved }: { tenants: TenantRow[]; selected: string; preview: boolean; onSaved: (tenantId: string, date: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState(selected || tenants[0]?.id || "");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    if (!preview) {
      const supabase = createClient()!;
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        setSaving(false);
        toast.error("Your session has expired. Please sign in again.");
        return;
      }
      const { error } = await supabase.from("payment_promises").insert({
        landlord_id: auth.user.id,
        tenant_id: tenantId,
        promised_date: date,
        note: note.trim() || null,
      });
      if (error) {
        setSaving(false);
        toast.error(error.message);
        return;
      }
    }
    onSaved(tenantId, date);
    toast.success("Promise saved and added to the attention list");
  }

  return <form className="modal-form" onSubmit={submit}>
    <label>Tenant<select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>{tenants.map((item) => <option key={item.id} value={item.id}>{item.full_name} — {money(item.balance)} due</option>)}</select></label>
    <label>Promised payment date<input required type="date" min={localDateISO()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
    <label>What did the tenant say?<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" /></label>
    <button className="primary full" disabled={saving}>{saving ? "Saving…" : "Save promise"}</button>
  </form>;
}

function TenantDetail({ tenant, payments, charges, messages, preview, onPayment }: { tenant?: TenantRow; payments: PaymentRow[]; charges: ChargeRow[]; messages: MessageRow[]; preview: boolean; onPayment: () => void }) { if (!tenant) return <Empty icon={<Users />} title="Tenant not found" text="Close this window and choose a tenant again." />; const events = [...payments.filter((p) => p.tenant_id === tenant.id).map((p) => ({ date: p.paid_at, title: `${money(p.amount)} payment`, detail: p.receipt_number, href: `/receipt/${p.id}${preview ? "?demo=1" : ""}` })), ...charges.filter((c) => c.tenant_id === tenant.id).map((c) => ({ date: c.due_date, title: `${formatRentPeriod(c.charge_month)} rent`, detail: `${money(c.paid_amount)} of ${money(c.amount)} paid`, href: "" })), ...messages.filter((m) => m.tenant_id === tenant.id).map((m) => ({ date: m.created_at, title: `${m.type.replace("_", " ")} message`, detail: m.status, href: "" }))].sort((a, b) => b.date.localeCompare(a.date)); return <div className="tenant-detail"><div className="tenant-balance"><span className="avatar">{initials(tenant.full_name)}</span><div><h3>{tenant.full_name}</h3><p>{tenant.unit_name} · {tenant.phone}</p></div><strong>{money(tenant.balance)}<small>outstanding</small></strong></div><div className="tenant-facts"><span><small>Monthly rent</small><strong>{money(tenant.monthly_rent)}</strong></span><span><small>Due day</small><strong>Day {tenant.due_day}</strong></span><span><small>Last payment</small><strong>{niceDate(tenant.last_payment_at)}</strong></span></div><button className="primary full" onClick={onPayment}><Plus /> Record payment</button><h3 className="timeline-title">Account history</h3><div className="ledger-timeline">{events.map((event, index) => <article key={`${event.date}-${index}`}><i /><div><strong>{event.title}</strong><small>{niceDate(event.date)} · {event.detail}</small></div>{event.href && <a href={event.href} target="_blank" rel="noreferrer">Receipt</a>}</article>)}{!events.length && <Empty icon={<Clock3 />} title="No history yet" text="Charges, payments and messages will appear here." />}</div></div>; }

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="empty"><i>{icon}</i><strong>{title}</strong><p>{text}</p></div>; }
function LoadingState() { return <main className="loading-layout" aria-label="Loading RentLens"><aside /><section><div className="loading-hero" /><div className="loading-grid">{[1, 2, 3, 4].map((item) => <i key={item} />)}</div><div className="loading-panel" /></section></main>; }
