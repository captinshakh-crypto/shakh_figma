-- SHAKH initial schema (Supabase/PostgreSQL)
-- Apply through Supabase migrations after reviewing in a staging project.
create extension if not exists pgcrypto;

create type public.app_role as enum (
  'super_admin','captain','customer','supermarket','restaurant','butcher_poultry','grocery'
);
create type public.record_status as enum ('pending','approved','rejected','active','inactive');
create type public.wallet_entry_type as enum (
  'topup','merchant_commission','captain_delivery','platform_delivery_share',
  'reward_credit','payout_debit','admin_adjustment','refund'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  phone text,
  role public.app_role not null default 'customer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.merchant_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null,
  merchant_type public.app_role not null check (merchant_type in ('supermarket','restaurant','butcher_poultry','grocery')),
  description text,
  address text,
  service_zone_ids uuid[],
  approval_status public.record_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.service_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  delivery_fee_iqd bigint not null default 0 check (delivery_fee_iqd >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchant_profiles(id) on delete cascade,
  is_shakh_store boolean not null default false,
  category_key text not null,
  title text not null,
  description text,
  price_iqd bigint not null check (price_iqd > 0),
  stock_quantity numeric(12,3),
  unit text not null default 'piece',
  image_path text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_shakh_store and merchant_id is null) or (not is_shakh_store and merchant_id is not null))
);

create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance_iqd bigint not null default 0 check (balance_iqd >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_user_id uuid not null references public.wallets(user_id),
  entry_type public.wallet_entry_type not null,
  amount_iqd bigint not null check (amount_iqd > 0),
  direction text not null check (direction in ('credit','debit')),
  reference_type text,
  reference_id uuid,
  idempotency_key text unique,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.wallet_topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  amount_iqd bigint not null check (amount_iqd > 0),
  note text,
  status public.record_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reward_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id),
  title text not null,
  description text,
  reward_amount_iqd bigint not null check (reward_amount_iqd > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  merchant_id uuid references public.merchant_profiles(id),
  service_zone_id uuid references public.service_zones(id),
  status text not null default 'placed',
  subtotal_iqd bigint not null check (subtotal_iqd >= 0),
  delivery_fee_iqd bigint not null check (delivery_fee_iqd >= 0),
  merchant_commission_rate_bps integer not null default 0 check (merchant_commission_rate_bps between 0 and 10000),
  merchant_commission_iqd bigint not null default 0 check (merchant_commission_iqd >= 0),
  platform_delivery_share_iqd bigint not null default 0 check (platform_delivery_share_iqd >= 0),
  captain_user_id uuid references public.profiles(id),
  reward_campaign_id uuid references public.reward_campaigns(id),
  reward_amount_iqd bigint not null default 0 check (reward_amount_iqd >= 0),
  currency text not null default 'IQD' check (currency = 'IQD'),
  idempotency_key text unique,
  placed_at timestamptz not null default now(),
  settled_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_title_snapshot text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price_iqd bigint not null check (unit_price_iqd > 0),
  line_total_iqd bigint not null check (line_total_iqd > 0)
);

create table public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.profiles(id),
  amount_iqd bigint not null check (amount_iqd > 0),
  payout_method text not null check (payout_method in ('fastpay','fib')),
  status public.record_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create index products_merchant_idx on public.products(merchant_id);
create index products_category_idx on public.products(category_key);
create index orders_customer_idx on public.orders(customer_id, placed_at desc);
create index orders_merchant_idx on public.orders(merchant_id, placed_at desc);
create index topups_user_status_idx on public.wallet_topup_requests(user_id, status);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index ledger_wallet_created_idx on public.wallet_ledger(wallet_user_id, created_at desc);

-- Security helpers: SECURITY DEFINER functions use a fixed search_path.
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() = 'super_admin', false)
$$;

-- Create profile and empty wallet for newly registered users. Role is always customer.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.profiles(id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''), 'customer')
  on conflict (id) do nothing;
  insert into public.wallets(user_id, balance_iqd)
  values (new.id, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_shakh on auth.users;
create trigger on_auth_user_created_shakh
after insert on auth.users
for each row execute function public.handle_new_user();

-- A user can request a top-up without paying. Approval is the only operation that credits it.
create or replace function public.request_wallet_topup(p_amount_iqd bigint, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount_iqd is null or p_amount_iqd <= 0 then raise exception 'Amount must be positive'; end if;
  insert into public.wallet_topup_requests(user_id, amount_iqd, note)
  values (auth.uid(), p_amount_iqd, p_note)
  returning id into v_id;
  insert into public.notifications(user_id,title,body,kind)
  values (auth.uid(),'داواکاری جزدان نێردرا','داواکاری پڕکردنەوەی جزدان لە چاوەڕوانی پەسەندکردندایە.','wallet_topup_pending');
  return v_id;
end;
$$;

create or replace function public.review_wallet_topup(p_request_id uuid, p_approve boolean, p_admin_note text default null)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_req public.wallet_topup_requests%rowtype;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  select * into v_req from public.wallet_topup_requests where id = p_request_id for update;
  if not found then raise exception 'Top-up request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'Request already reviewed'; end if;

  update public.wallet_topup_requests
  set status = case when p_approve then 'approved'::public.record_status else 'rejected'::public.record_status end,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  if p_approve then
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values (v_req.user_id,'topup',v_req.amount_iqd,'credit','wallet_topup_request',v_req.id,'topup:'||v_req.id::text,'Admin-approved wallet top-up',auth.uid());
    update public.wallets set balance_iqd = balance_iqd + v_req.amount_iqd, updated_at = now()
    where user_id = v_req.user_id;
  end if;

  insert into public.notifications(user_id,title,body,kind)
  values (v_req.user_id,
    case when p_approve then 'جزدان پڕکرایەوە' else 'داواکاری جزدان ڕەتکرایەوە' end,
    case when p_approve then 'بڕی داواکراو بۆ جزدانەکەت زیاد کرا.' else coalesce(p_admin_note,'داواکارییەکەت پەسەند نەکرا.') end,
    case when p_approve then 'wallet_topup_approved' else 'wallet_topup_rejected' end);
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values (auth.uid(),case when p_approve then 'approve_topup' else 'reject_topup' end,'wallet_topup_request',v_req.id,jsonb_build_object('amount_iqd',v_req.amount_iqd));
end;
$$;

-- Admin-only self top-up. The ledger and balance update are one database transaction.
create or replace function public.admin_credit_own_wallet(p_amount_iqd bigint, p_note text default null)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  if p_amount_iqd is null or p_amount_iqd <= 0 then raise exception 'Amount must be positive'; end if;
  insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,note,created_by)
  values(auth.uid(),'admin_adjustment',p_amount_iqd,'credit',coalesce(p_note,'Super admin wallet funding'),auth.uid());
  update public.wallets set balance_iqd = balance_iqd + p_amount_iqd, updated_at = now()
  where user_id = auth.uid();
  insert into public.audit_logs(actor_user_id,action,entity_type,details)
  values(auth.uid(),'admin_wallet_credit','wallet',jsonb_build_object('amount_iqd',p_amount_iqd));
end;
$$;

-- RLS defaults: private data is not exposed unless a policy below explicitly permits it.
alter table public.profiles enable row level security;
alter table public.merchant_profiles enable row level security;
alter table public.service_zones enable row level security;
alter table public.products enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.wallet_topup_requests enable row level security;
alter table public.reward_campaigns enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payout_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

create policy profiles_read_self_or_admin on public.profiles for select
using (id = auth.uid() or public.is_super_admin());
create policy profiles_update_self_or_admin on public.profiles for update
using (id = auth.uid() or public.is_super_admin())
with check (id = auth.uid() or public.is_super_admin());

create policy merchants_read_active_or_owner_or_admin on public.merchant_profiles for select
using (approval_status = 'approved' or user_id = auth.uid() or public.is_super_admin());
create policy merchants_insert_self on public.merchant_profiles for insert
with check (user_id = auth.uid() and public.current_app_role() = merchant_type);
create policy merchants_update_owner_or_admin on public.merchant_profiles for update
using (user_id = auth.uid() or public.is_super_admin())
with check (user_id = auth.uid() or public.is_super_admin());

create policy zones_read_active on public.service_zones for select using (is_active = true or public.is_super_admin());
create policy zones_admin_all on public.service_zones for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy products_read_available on public.products for select
using (is_available = true or public.is_super_admin() or exists (
  select 1 from public.merchant_profiles m where m.id = merchant_id and m.user_id = auth.uid()
));
create policy products_merchant_insert on public.products for insert
with check (
  (is_shakh_store = true and public.is_super_admin())
  or (is_shakh_store = false and exists (
    select 1 from public.merchant_profiles m where m.id = merchant_id and m.user_id = auth.uid() and m.approval_status = 'approved'
  ))
);
create policy products_merchant_update on public.products for update
using (public.is_super_admin() or exists (
  select 1 from public.merchant_profiles m where m.id = merchant_id and m.user_id = auth.uid()
))
with check (public.is_super_admin() or exists (
  select 1 from public.merchant_profiles m where m.id = merchant_id and m.user_id = auth.uid()
));

create policy wallets_read_self_or_admin on public.wallets for select
using (user_id = auth.uid() or public.is_super_admin());
create policy ledger_read_self_or_admin on public.wallet_ledger for select
using (wallet_user_id = auth.uid() or public.is_super_admin());
create policy topups_read_self_or_admin on public.wallet_topup_requests for select
using (user_id = auth.uid() or public.is_super_admin());
create policy topups_insert_self on public.wallet_topup_requests for insert
with check (user_id = auth.uid() and status = 'pending');

create policy rewards_read_active_or_owner_or_admin on public.reward_campaigns for select
using (is_active or owner_user_id = auth.uid() or public.is_super_admin());
create policy rewards_owner_insert on public.reward_campaigns for insert
with check (owner_user_id = auth.uid());

create policy orders_read_participant_or_admin on public.orders for select
using (customer_id = auth.uid() or captain_user_id = auth.uid() or public.is_super_admin()
  or exists(select 1 from public.merchant_profiles m where m.id = merchant_id and m.user_id = auth.uid()));
create policy order_items_read_participant on public.order_items for select
using (exists(select 1 from public.orders o where o.id = order_id and (
  o.customer_id = auth.uid() or o.captain_user_id = auth.uid() or public.is_super_admin()
  or exists(select 1 from public.merchant_profiles m where m.id = o.merchant_id and m.user_id = auth.uid())
)));

create policy payouts_read_self_or_admin on public.payout_requests for select
using (requester_user_id = auth.uid() or public.is_super_admin());
create policy payouts_insert_self on public.payout_requests for insert
with check (requester_user_id = auth.uid() and status = 'pending');
create policy notifications_read_self on public.notifications for select using (user_id = auth.uid());
create policy notifications_update_self on public.notifications for update
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_admin_read on public.audit_logs for select using (public.is_super_admin());
create policy settings_admin_all on public.platform_settings for all using (public.is_super_admin()) with check (public.is_super_admin());

revoke all on function public.review_wallet_topup(uuid,boolean,text) from public;
revoke all on function public.admin_credit_own_wallet(bigint,text) from public;
grant execute on function public.request_wallet_topup(bigint,text) to authenticated;
grant execute on function public.review_wallet_topup(uuid,boolean,text) to authenticated;
grant execute on function public.admin_credit_own_wallet(bigint,text) to authenticated;
