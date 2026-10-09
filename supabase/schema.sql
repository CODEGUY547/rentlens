-- RentLens initial schema. Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;
create sequence if not exists public.receipt_number_seq start 1001;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  business_name text not null default 'My Rentals',
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  unique (landlord_id, name)
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  full_name text not null,
  phone text not null,
  unit_name text not null,
  monthly_rent numeric(14,2) not null check (monthly_rent >= 0),
  due_day smallint not null default 5 check (due_day between 1 and 28),
  whatsapp_opt_in boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  charge_month date not null,
  due_date date not null,
  description text not null default 'Monthly rent',
  amount numeric(14,2) not null check (amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'due' check (status in ('due','partial','paid','waived')),
  created_at timestamptz not null default now(),
  unique (tenant_id, charge_month, description)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  payment_method text not null,
  reference text,
  receipt_number text not null unique,
  confirmed_by uuid not null references public.profiles(id),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  charge_id uuid not null references public.charges(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, charge_id)
);

create table if not exists public.payment_promises (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  promised_date date not null,
  promised_amount numeric(14,2),
  note text,
  status text not null default 'active' check (status in ('active','kept','missed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.message_log (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  type text not null check (type in ('reminder','receipt','thank_you','holiday')),
  body text not null,
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed')),
  provider_message_id text unique,
  message_key text unique,
  failure_reason text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.landlord_settings (
  landlord_id uuid primary key references public.profiles(id) on delete cascade,
  currency text not null default 'UGX',
  timezone text not null default 'Africa/Kampala',
  remind_days_before smallint not null default 3,
  overdue_repeat_days smallint not null default 7,
  holiday_messages_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  insert into public.landlord_settings (landlord_id) values (new.id) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.add_tenant_with_unit(
  p_full_name text, p_phone text, p_property_name text, p_unit_name text,
  p_monthly_rent numeric, p_due_day integer
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_property_id uuid; v_tenant_id uuid; v_landlord uuid := auth.uid(); v_due date;
begin
  if v_landlord is null then raise exception 'Authentication required'; end if;
  insert into public.properties (landlord_id, name) values (v_landlord, trim(p_property_name))
  on conflict (landlord_id, name) do update set name = excluded.name returning id into v_property_id;
  insert into public.tenants (landlord_id, property_id, full_name, phone, unit_name, monthly_rent, due_day)
  values (v_landlord, v_property_id, trim(p_full_name), trim(p_phone), trim(p_unit_name), p_monthly_rent, p_due_day)
  returning id into v_tenant_id;
  v_due := make_date(extract(year from current_date)::int, extract(month from current_date)::int, least(p_due_day, 28));
  insert into public.charges (landlord_id, tenant_id, charge_month, due_date, amount)
  values (v_landlord, v_tenant_id, date_trunc('month', current_date)::date, v_due, p_monthly_rent);
  return v_tenant_id;
end; $$;

create or replace function public.record_rent_payment(
  p_tenant_id uuid, p_amount numeric, p_payment_method text,
  p_reference text default null, p_paid_at timestamptz default now()
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_landlord uuid := auth.uid(); v_payment_id uuid; v_receipt text; v_remaining numeric := p_amount; v_charge record; v_allocate numeric;
begin
  if v_landlord is null then raise exception 'Authentication required'; end if;
  if p_amount <= 0 then raise exception 'Payment must be greater than zero'; end if;
  if not exists(select 1 from public.tenants where id = p_tenant_id and landlord_id = v_landlord) then raise exception 'Tenant not found'; end if;
  v_receipt := 'RL-' || extract(year from p_paid_at)::int || '-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0');
  insert into public.payments (landlord_id, tenant_id, amount, paid_at, payment_method, reference, receipt_number, confirmed_by)
  values (v_landlord, p_tenant_id, p_amount, p_paid_at, p_payment_method, nullif(trim(p_reference),''), v_receipt, v_landlord)
  returning id into v_payment_id;
  for v_charge in select * from public.charges where tenant_id=p_tenant_id and landlord_id=v_landlord and status in ('due','partial') order by due_date for update loop
    exit when v_remaining <= 0;
    v_allocate := least(v_remaining, v_charge.amount - v_charge.paid_amount);
    insert into public.payment_allocations(payment_id, charge_id, amount) values(v_payment_id, v_charge.id, v_allocate);
    update public.charges set paid_amount=paid_amount+v_allocate, status=case when paid_amount+v_allocate >= amount then 'paid' else 'partial' end where id=v_charge.id;
    v_remaining := v_remaining-v_allocate;
  end loop;
  update public.payment_promises set status='kept' where tenant_id=p_tenant_id and landlord_id=v_landlord and status='active' and promised_date <= p_paid_at::date;
  return jsonb_build_object('id',v_payment_id,'receipt_number',v_receipt,'unallocated_amount',v_remaining);
end; $$;

create or replace function public.generate_monthly_charges()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  insert into public.charges(landlord_id,tenant_id,charge_month,due_date,amount)
  select t.landlord_id,t.id,date_trunc('month',current_date)::date,
    make_date(extract(year from current_date)::int,extract(month from current_date)::int,t.due_day),t.monthly_rent
  from public.tenants t where t.active
  on conflict (tenant_id,charge_month,description) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

create or replace view public.tenant_overview with (security_invoker=true) as
select t.id,t.landlord_id,t.full_name,t.phone,p.name || ' · ' || t.unit_name as unit_name,
  t.monthly_rent,t.due_day,t.whatsapp_opt_in,
  coalesce((select sum(c.amount-c.paid_amount) from public.charges c where c.tenant_id=t.id and c.status in ('due','partial')),0)::numeric as balance,
  (select max(pay.paid_at) from public.payments pay where pay.tenant_id=t.id and pay.voided_at is null) as last_payment_at,
  (select pp.promised_date from public.payment_promises pp where pp.tenant_id=t.id and pp.status='active' order by pp.promised_date limit 1) as promise_date,
  case
    when exists(select 1 from public.payment_promises pp where pp.tenant_id=t.id and pp.status='active') then 'promised'
    when coalesce((select sum(c.amount-c.paid_amount) from public.charges c where c.tenant_id=t.id and c.status in ('due','partial')),0)=0 then 'paid'
    when exists(select 1 from public.charges c where c.tenant_id=t.id and c.status='partial') then 'partial'
    when exists(select 1 from public.charges c where c.tenant_id=t.id and c.status='due' and c.due_date<current_date) then 'overdue'
    else 'due' end as status
from public.tenants t join public.properties p on p.id=t.property_id where t.active;

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.tenants enable row level security;
alter table public.charges enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.payment_promises enable row level security;
alter table public.message_log enable row level security;
alter table public.landlord_settings enable row level security;

create policy "own profile" on public.profiles for all using (id=auth.uid()) with check (id=auth.uid());
create policy "own properties" on public.properties for all using (landlord_id=auth.uid()) with check (landlord_id=auth.uid());
create policy "own tenants" on public.tenants for all using (landlord_id=auth.uid()) with check (landlord_id=auth.uid());
create policy "own charges" on public.charges for all using (landlord_id=auth.uid()) with check (landlord_id=auth.uid());
create policy "own payments" on public.payments for all using (landlord_id=auth.uid()) with check (landlord_id=auth.uid());
create policy "own allocations" on public.payment_allocations for select using (exists(select 1 from public.payments p where p.id=payment_id and p.landlord_id=auth.uid()));
create policy "own promises" on public.payment_promises for all using (landlord_id=auth.uid()) with check (landlord_id=auth.uid());
create policy "own messages" on public.message_log for all using (landlord_id=auth.uid()) with check (landlord_id=auth.uid());
create policy "own settings" on public.landlord_settings for all using (landlord_id=auth.uid()) with check (landlord_id=auth.uid());

create index if not exists charges_tenant_due_idx on public.charges(tenant_id,due_date,status);
create index if not exists payments_tenant_date_idx on public.payments(tenant_id,paid_at desc);
create index if not exists promises_due_idx on public.payment_promises(promised_date,status);
create index if not exists messages_provider_idx on public.message_log(provider_message_id);
