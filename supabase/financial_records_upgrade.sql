-- RentLens financial records upgrade.
-- Safe to run more than once in the Supabase SQL Editor.

alter table public.payments add column if not exists idempotency_key text;
alter table public.payments add column if not exists balance_after numeric(14,2);
alter table public.payments add column if not exists tenant_name_snapshot text;
alter table public.payments add column if not exists unit_name_snapshot text;
alter table public.payments add column if not exists business_name_snapshot text;
alter table public.payments add column if not exists voided_by uuid references public.profiles(id);

create unique index if not exists payments_landlord_idempotency_idx
  on public.payments(landlord_id,idempotency_key)
  where idempotency_key is not null;

-- Payments are permanent financial records. Clients may read and create them,
-- but only the audited reversal function below may correct a confirmed payment.
drop policy if exists "own payments" on public.payments;
drop policy if exists "view own payments" on public.payments;
drop policy if exists "create own payments" on public.payments;
create policy "view own payments" on public.payments for select
  using (landlord_id=auth.uid());
create policy "create own payments" on public.payments for insert to authenticated
  with check (landlord_id=auth.uid());

update public.payments pay
set tenant_name_snapshot = coalesce(pay.tenant_name_snapshot, t.full_name),
    unit_name_snapshot = coalesce(pay.unit_name_snapshot, t.unit_name),
    business_name_snapshot = coalesce(pay.business_name_snapshot, p.business_name)
from public.tenants t, public.profiles p
where pay.tenant_id=t.id and pay.landlord_id=p.id
  and (pay.tenant_name_snapshot is null or pay.unit_name_snapshot is null or pay.business_name_snapshot is null);

create table if not exists public.payment_reversals (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  reversed_by uuid not null references public.profiles(id),
  reason text not null check (length(trim(reason)) >= 3),
  created_at timestamptz not null default now()
);

alter table public.payment_reversals enable row level security;
drop policy if exists "own payment reversals" on public.payment_reversals;
drop policy if exists "view own payment reversals" on public.payment_reversals;
create policy "view own payment reversals" on public.payment_reversals for select
  using (landlord_id=auth.uid());

create or replace function public.record_rent_payment_v2(
  p_tenant_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference text default null,
  p_paid_at timestamptz default now(),
  p_idempotency_key text default null
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_landlord uuid := auth.uid();
  v_payment_id uuid;
  v_receipt text;
  v_remaining numeric := p_amount;
  v_charge record;
  v_allocate numeric;
  v_balance numeric;
  v_tenant_name text;
  v_unit_name text;
  v_business_name text;
  v_existing record;
begin
  if v_landlord is null then raise exception 'Authentication required'; end if;
  if p_amount <= 0 then raise exception 'Payment must be greater than zero'; end if;

  if nullif(trim(p_idempotency_key),'') is not null then
    select id,receipt_number,balance_after into v_existing
    from public.payments
    where landlord_id=v_landlord and idempotency_key=trim(p_idempotency_key);
    if found then
      return jsonb_build_object('id',v_existing.id,'receipt_number',v_existing.receipt_number,'balance_after',v_existing.balance_after,'duplicate',true);
    end if;
  end if;

  select t.full_name,t.unit_name,p.business_name
  into v_tenant_name,v_unit_name,v_business_name
  from public.tenants t join public.profiles p on p.id=t.landlord_id
  where t.id=p_tenant_id and t.landlord_id=v_landlord and t.active;
  if not found then raise exception 'Tenant not found'; end if;

  v_receipt := 'RL-' || extract(year from p_paid_at)::int || '-' || lpad(nextval('public.receipt_number_seq')::text,6,'0');
  insert into public.payments(
    landlord_id,tenant_id,amount,paid_at,payment_method,reference,receipt_number,confirmed_by,
    idempotency_key,tenant_name_snapshot,unit_name_snapshot,business_name_snapshot
  ) values (
    v_landlord,p_tenant_id,p_amount,p_paid_at,p_payment_method,nullif(trim(p_reference),''),v_receipt,v_landlord,
    nullif(trim(p_idempotency_key),''),v_tenant_name,v_unit_name,v_business_name
  ) returning id into v_payment_id;

  for v_charge in
    select * from public.charges
    where tenant_id=p_tenant_id and landlord_id=v_landlord and status in ('due','partial')
    order by due_date for update
  loop
    exit when v_remaining <= 0;
    v_allocate := least(v_remaining,v_charge.amount-v_charge.paid_amount);
    insert into public.payment_allocations(payment_id,charge_id,amount) values(v_payment_id,v_charge.id,v_allocate);
    update public.charges
      set paid_amount=paid_amount+v_allocate,
          status=case when paid_amount+v_allocate >= amount then 'paid' else 'partial' end
      where id=v_charge.id;
    v_remaining := v_remaining-v_allocate;
  end loop;

  select coalesce(sum(amount-paid_amount),0) into v_balance
  from public.charges where tenant_id=p_tenant_id and status in ('due','partial');
  update public.payments set balance_after=v_balance where id=v_payment_id;
  update public.payment_promises set status='kept'
    where tenant_id=p_tenant_id and landlord_id=v_landlord and status='active' and promised_date <= p_paid_at::date;

  return jsonb_build_object('id',v_payment_id,'receipt_number',v_receipt,'unallocated_amount',v_remaining,'balance_after',v_balance,'duplicate',false);
end; $$;

create or replace function public.reverse_rent_payment(p_payment_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_landlord uuid := auth.uid();
  v_payment public.payments%rowtype;
  v_allocation record;
begin
  if v_landlord is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Please provide a reversal reason'; end if;

  select * into v_payment from public.payments
  where id=p_payment_id and landlord_id=v_landlord for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.voided_at is not null then raise exception 'Payment has already been reversed'; end if;

  for v_allocation in select * from public.payment_allocations where payment_id=p_payment_id loop
    update public.charges
    set paid_amount=greatest(0,paid_amount-v_allocation.amount),
        status=case
          when greatest(0,paid_amount-v_allocation.amount)=0 then 'due'
          when greatest(0,paid_amount-v_allocation.amount)<amount then 'partial'
          else 'paid' end
    where id=v_allocation.charge_id;
  end loop;

  update public.payments
  set voided_at=now(),void_reason=trim(p_reason),voided_by=v_landlord
  where id=p_payment_id;
  insert into public.payment_reversals(landlord_id,payment_id,reversed_by,reason)
  values(v_landlord,p_payment_id,v_landlord,trim(p_reason));

  return jsonb_build_object('id',p_payment_id,'reversed',true);
end; $$;
