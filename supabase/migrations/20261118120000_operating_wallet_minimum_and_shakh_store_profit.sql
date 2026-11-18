-- Enforce the 5,000 IQD operating-wallet minimum and track SHAKH Store cost/profit.
insert into public.platform_settings(key,value)
values ('operating_wallet_minimum_iqd','5000'::jsonb)
on conflict (key) do update set value=excluded.value, updated_at=now();

alter table public.products add column if not exists cost_price_iqd bigint;
alter table public.products add constraint products_cost_price_nonnegative check (cost_price_iqd is null or cost_price_iqd >= 0);
alter table public.order_items add column if not exists cost_price_snapshot_iqd bigint;
alter table public.order_items add constraint order_items_cost_snapshot_nonnegative check (cost_price_snapshot_iqd is null or cost_price_snapshot_iqd >= 0);

create schema if not exists private;
create or replace function private.operating_wallet_minimum_iqd()
returns bigint language sql stable security definer set search_path=''
as $$ select coalesce((select (value #>> '{}')::bigint from public.platform_settings where key='operating_wallet_minimum_iqd'),5000) $$;
create or replace function private.has_operating_wallet(p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select coalesce((select w.balance_iqd >= private.operating_wallet_minimum_iqd() from public.wallets w where w.user_id=p_user_id),false) $$;

create or replace function private.enforce_product_wallet_minimum()
returns trigger language plpgsql security definer set search_path='public','private','pg_temp'
as $$
declare v_owner uuid;
begin
 if new.is_shakh_store then
   if not public.is_super_admin() then raise exception 'Only super admin can manage SHAKH Store'; end if;
   if new.cost_price_iqd is null then raise exception 'Purchase cost is required for SHAKH Store products'; end if;
   return new;
 end if;
 select user_id into v_owner from public.merchant_profiles where id=new.merchant_id and approval_status='approved';
 if v_owner is null then raise exception 'Approved merchant account required'; end if;
 if v_owner<>auth.uid() and not public.is_super_admin() then raise exception 'You cannot manage another merchant products'; end if;
 if not public.is_super_admin() and not private.has_operating_wallet(v_owner) then
   raise exception 'Wallet must have at least 5,000 IQD before posting products';
 end if;
 return new;
end $$;
drop trigger if exists products_wallet_minimum_guard on public.products;
create trigger products_wallet_minimum_guard before insert or update of merchant_id,is_shakh_store,cost_price_iqd,price_iqd on public.products
for each row execute function private.enforce_product_wallet_minimum();

create or replace function private.enforce_order_wallet_minimum()
returns trigger language plpgsql security definer set search_path='public','private','pg_temp'
as $$
declare v_merchant_owner uuid; v_captain_type public.captain_type; v_captain_merchant uuid;
begin
 if tg_op='INSERT' and new.merchant_id is not null then
  select user_id into v_merchant_owner from public.merchant_profiles where id=new.merchant_id and approval_status='approved';
  if v_merchant_owner is null then raise exception 'Merchant is unavailable'; end if;
  if not private.has_operating_wallet(v_merchant_owner) then raise exception 'Merchant wallet must have at least 5,000 IQD to receive orders'; end if;
 end if;
 if tg_op='UPDATE' and new.status is distinct from old.status and new.merchant_id is not null and new.status in ('accepted','preparing','ready_for_pickup') then
  select user_id into v_merchant_owner from public.merchant_profiles where id=new.merchant_id;
  if v_merchant_owner is not null and not private.has_operating_wallet(v_merchant_owner) then raise exception 'Merchant wallet must have at least 5,000 IQD to process orders'; end if;
 end if;
 if tg_op='UPDATE' and new.captain_user_id is distinct from old.captain_user_id and new.captain_user_id is not null then
  select cp.captain_type,cp.merchant_id into v_captain_type,v_captain_merchant
  from public.captain_profiles cp join public.profiles p on p.id=cp.user_id
  where cp.user_id=new.captain_user_id and cp.is_active=true and p.role='captain' and p.is_active=true;
  if not found then raise exception 'Captain account is not active or approved'; end if;
  if v_captain_type='merchant' and v_captain_merchant is distinct from new.merchant_id then raise exception 'This captain is restricted to a different store'; end if;
  if not private.has_operating_wallet(new.captain_user_id) then raise exception 'Captain wallet must have at least 5,000 IQD to receive deliveries'; end if;
 end if;
 return new;
end $$;
drop trigger if exists orders_wallet_minimum_guard on public.orders;
create trigger orders_wallet_minimum_guard before insert or update of status,captain_user_id on public.orders
for each row execute function private.enforce_order_wallet_minimum();

create or replace function private.snapshot_product_cost()
returns trigger language plpgsql security definer set search_path='public','pg_temp'
as $$
begin
 if new.product_id is not null then select cost_price_iqd into new.cost_price_snapshot_iqd from public.products where id=new.product_id; end if;
 return new;
end $$;
drop trigger if exists order_items_cost_snapshot on public.order_items;
create trigger order_items_cost_snapshot before insert on public.order_items for each row execute function private.snapshot_product_cost();

create or replace function public.admin_shakh_store_profit()
returns table(delivered_orders bigint,units_sold numeric,sales_iqd bigint,purchase_cost_iqd bigint,gross_profit_iqd bigint)
language plpgsql stable security definer set search_path='public','pg_temp'
as $$
begin
 if not public.is_super_admin() then raise exception 'Super admin only'; end if;
 return query
 select count(distinct o.id)::bigint,coalesce(sum(oi.quantity),0)::numeric,
  coalesce(sum(oi.line_total_iqd),0)::bigint,
  coalesce(sum(round(oi.cost_price_snapshot_iqd*oi.quantity)::bigint),0)::bigint,
  coalesce(sum(oi.line_total_iqd-round(oi.cost_price_snapshot_iqd*oi.quantity)::bigint),0)::bigint
 from public.orders o join public.order_items oi on oi.order_id=o.id
 join public.products p on p.id=oi.product_id
 where o.merchant_id is null and o.status='delivered' and p.is_shakh_store=true
 and oi.cost_price_snapshot_iqd is not null;
end $$;
revoke all on function public.admin_shakh_store_profit() from public,anon;
grant execute on function public.admin_shakh_store_profit() to authenticated;
revoke all on function private.operating_wallet_minimum_iqd() from public,anon,authenticated;
revoke all on function private.has_operating_wallet(uuid) from public,anon,authenticated;
revoke all on function private.enforce_product_wallet_minimum() from public,anon,authenticated;
revoke all on function private.enforce_order_wallet_minimum() from public,anon,authenticated;
revoke all on function private.snapshot_product_cost() from public,anon,authenticated;
