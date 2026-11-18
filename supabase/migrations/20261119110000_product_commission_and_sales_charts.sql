-- Per-product merchant commissions are snapshotted at checkout and charged
-- from the merchant wallet only after the captain marks the order delivered.
alter table public.products add column if not exists merchant_commission_per_unit_iqd bigint not null default 0;
alter table public.order_items
  add column if not exists merchant_commission_per_unit_snapshot_iqd bigint not null default 0,
  add column if not exists merchant_commission_line_snapshot_iqd bigint not null default 0;

-- Product commission is configured by super admin only, never by the merchant owner.
create or replace function public.protect_product_moderation_fields()
returns trigger language plpgsql set search_path = public as $
begin
  if not public.is_super_admin() then
    new.approval_status := old.approval_status;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
    new.rejection_reason := old.rejection_reason;
    new.is_shakh_store := old.is_shakh_store;
    new.merchant_id := old.merchant_id;
    new.merchant_commission_per_unit_iqd := old.merchant_commission_per_unit_iqd;
  end if;
  return new;
end; $;

create or replace function public.snapshot_product_merchant_commission()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_rate bigint;
begin
  select merchant_commission_per_unit_iqd into v_rate from public.products where id=new.product_id;
  new.merchant_commission_per_unit_snapshot_iqd:=coalesce(v_rate,0);
  new.merchant_commission_line_snapshot_iqd:=round(new.quantity*coalesce(v_rate,0))::bigint;
  return new;
end; $$;
drop trigger if exists order_items_snapshot_merchant_commission on public.order_items;
create trigger order_items_snapshot_merchant_commission before insert on public.order_items
for each row execute function public.snapshot_product_merchant_commission();

create or replace function public.reconcile_checkout_commission_to_product_rates()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_owner uuid; v_new bigint;
begin
  select * into v_order from public.orders where id=new.order_id for update;
  if v_order.merchant_id is null then return new; end if;
  select user_id into v_owner from public.merchant_profiles where id=v_order.merchant_id;
  if v_owner is null then raise exception 'Merchant wallet owner not found'; end if;
  if v_order.merchant_commission_iqd>0 and not exists(
    select 1 from public.wallet_ledger where idempotency_key='merchant-commission-reversal:'||v_order.id::text
  ) then
    update public.wallets set balance_iqd=balance_iqd+v_order.merchant_commission_iqd,updated_at=now() where user_id=v_owner;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_owner,'merchant_commission',v_order.merchant_commission_iqd,'credit','order_commission_reversal',v_order.id,
      'merchant-commission-reversal:'||v_order.id::text,'Reversed checkout estimate; product commission charged after delivery',auth.uid());
  end if;
  select coalesce(sum(merchant_commission_line_snapshot_iqd),0) into v_new from public.order_items where order_id=new.order_id;
  update public.orders set merchant_commission_iqd=v_new where id=new.order_id;
  return new;
end; $$;
drop trigger if exists order_items_reconcile_commission on public.order_items;
create trigger order_items_reconcile_commission after insert on public.order_items
for each row execute function public.reconcile_checkout_commission_to_product_rates();

create or replace function public.admin_set_product_commission(p_product_id uuid,p_amount_iqd bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_super_admin() then raise exception 'not_authorized'; end if;
  if p_amount_iqd<0 then raise exception 'commission_must_be_nonnegative'; end if;
  update public.products set merchant_commission_per_unit_iqd=p_amount_iqd,updated_at=now()
  where id=p_product_id and is_shakh_store=false;
  if not found then raise exception 'merchant_product_not_found'; end if;
end; $$;
revoke all on function public.admin_set_product_commission(uuid,bigint) from public;
grant execute on function public.admin_set_product_commission(uuid,bigint) to authenticated;

create or replace function public.settle_delivered_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_admin_id uuid; v_reward_owner uuid; v_merchant_owner uuid; v_merchant_commission bigint:=0; v_balance bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.settled_at is not null then raise exception 'Order already settled'; end if;
  if v_order.status<>'delivered' then raise exception 'Order must be marked delivered first'; end if;
  if not public.is_super_admin() and v_order.captain_user_id is distinct from auth.uid() then
    raise exception 'Only assigned captain or super admin can settle this order';
  end if;
  select id into v_admin_id from public.profiles where role='super_admin' and is_active=true order by created_at asc limit 1;
  if v_admin_id is null then raise exception 'Super admin account is not initialized'; end if;
  if v_order.merchant_id is not null then
    select user_id into v_merchant_owner from public.merchant_profiles where id=v_order.merchant_id;
    select coalesce(sum(merchant_commission_line_snapshot_iqd),0) into v_merchant_commission from public.order_items where order_id=v_order.id;
    if v_merchant_owner is null then raise exception 'Merchant account is unavailable'; end if;
    if v_merchant_commission>0 then
      select balance_iqd into v_balance from public.wallets where user_id=v_merchant_owner for update;
      if coalesce(v_balance,0)<v_merchant_commission then raise exception 'Merchant wallet has insufficient balance for product commissions'; end if;
      update public.wallets set balance_iqd=balance_iqd-v_merchant_commission,updated_at=now()
      where user_id=v_merchant_owner and balance_iqd>=v_merchant_commission;
      if not found then raise exception 'Merchant wallet debit failed'; end if;
      insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
      values(v_merchant_owner,'merchant_commission',v_merchant_commission,'debit','delivered_order_product_commission',v_order.id,
        'delivered-product-commission:'||v_order.id::text,'Per-product commission charged after delivery',auth.uid());
      insert into public.notifications(user_id,title,body,kind)
      values(v_merchant_owner,'کۆمسیۆنی فرۆشتن لە جزدان کەمکرایەوە',
        'لیستی کاڵا فرۆشراوەکان و کۆی کۆمسیۆنی ئەم داواکارییە لە بەشی داواکارییەکان ببینە.','merchant_commission_debit');
    end if;
  end if;
  if v_order.reward_campaign_id is not null and v_order.reward_amount_iqd>0 then
    select owner_user_id into v_reward_owner from public.reward_campaigns where id=v_order.reward_campaign_id;
    if v_reward_owner is null then raise exception 'Referral link owner is unavailable'; end if;
    insert into public.wallets(user_id,balance_iqd) values(v_reward_owner,0) on conflict(user_id) do nothing;
    update public.wallets set balance_iqd=balance_iqd+v_order.reward_amount_iqd,updated_at=now() where user_id=v_reward_owner;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_reward_owner,'reward_credit',v_order.reward_amount_iqd,'credit','order',v_order.id,'reward-credit:'||v_order.id::text,
      'Referral reward paid after delivered order',auth.uid());
    insert into public.notifications(user_id,title,body,kind) values(v_reward_owner,'پارەی شێر و خەڵات زیاد کرا','کۆمسیۆنی لینکەکەت بۆ جزدان زیاد کرا.','reward_credit');
  end if;
  update public.orders set merchant_commission_iqd=v_merchant_commission,settled_at=now() where id=v_order.id;
  insert into public.notifications(user_id,title,body,kind)
  values(v_admin_id,'داواکاری گەیاندن تەواو بوو','کۆمسیۆنی پۆستەکان و بەشی گەیاندن لە ڕاپۆرت تۆمار کرا؛ باڵانسی جزدانی سوپەر ئەدمین ناگۆڕێت.','order_settled');
  if v_order.captain_user_id is not null then
    insert into public.notifications(user_id,title,body,kind)
    values(v_order.captain_user_id,'گەیاندن تەواو بوو','لیستی فرۆشتن و کۆمسیۆنی هەر کاڵایەک لە وردەکاریی داواکارییەکە ببینە.','captain_earning');
  end if;
end; $$;
revoke all on function public.settle_delivered_order(uuid) from public;
grant execute on function public.settle_delivered_order(uuid) to authenticated;

create or replace function public.admin_sales_chart(p_period text default 'day')
returns table(bucket_start timestamptz,orders_count bigint,delivered_count bigint,sales_iqd bigint,product_commission_iqd bigint,delivery_platform_iqd bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'not_authorized'; end if;
  if p_period not in ('hour','day','week','month') then raise exception 'invalid_period'; end if;
  return query
  select date_trunc(p_period,o.settled_at at time zone 'Asia/Baghdad') at time zone 'Asia/Baghdad',
    count(*)::bigint,count(*) filter(where o.status='delivered')::bigint,
    coalesce(sum(o.subtotal_iqd),0)::bigint,
    coalesce(sum(o.merchant_commission_iqd),0)::bigint,
    coalesce(sum(o.platform_delivery_share_iqd),0)::bigint
  from public.orders o
  where o.status='delivered' and o.settled_at is not null
    and o.settled_at>=now()-case p_period when 'hour' then interval '24 hours' when 'day' then interval '30 days' when 'week' then interval '12 weeks' else interval '12 months' end
  group by 1 order by 1;
end; $$;
revoke all on function public.admin_sales_chart(text) from public;
grant execute on function public.admin_sales_chart(text) to authenticated;
