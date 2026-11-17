-- Support SHAKH Store orders, reward funding and explicit customer totals.
alter table public.orders add column if not exists total_iqd bigint;
alter table public.orders add constraint orders_total_iqd_nonnegative check (total_iqd is null or total_iqd >= 0);

create or replace function public.snapshot_order_commission()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v_type public.app_role; v_rate integer; v_delivery_share bigint;
begin
  if new.merchant_id is null then
    new.merchant_commission_rate_bps := 0;
    new.merchant_commission_iqd := 0;
    new.platform_delivery_share_iqd := least(new.delivery_fee_iqd,200);
    return new;
  end if;
  select merchant_type into v_type from public.merchant_profiles
  where id=new.merchant_id and approval_status='approved';
  if v_type is null then raise exception 'Merchant is not approved'; end if;
  select commission_rate_bps,platform_delivery_share_iqd into v_rate,v_delivery_share
  from public.commission_settings where merchant_type=v_type;
  new.merchant_commission_rate_bps := coalesce(v_rate,0);
  new.merchant_commission_iqd := floor((new.subtotal_iqd::numeric*coalesce(v_rate,0))/10000)::bigint;
  new.platform_delivery_share_iqd := least(new.delivery_fee_iqd,coalesce(v_delivery_share,200));
  return new;
end;
$fn$;

drop function if exists public.create_order(uuid,uuid,jsonb);
create or replace function public.create_order(
  p_merchant_id uuid,
  p_service_zone_id uuid,
  p_items jsonb,
  p_reward_campaign_id uuid default null,
  p_reward_amount_iqd bigint default 0
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare
  v_order_id uuid;
  v_subtotal bigint := 0;
  v_delivery bigint;
  v_total bigint;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty numeric(12,3);
  v_line bigint;
  v_campaign public.reward_campaigns%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.current_app_role() not in ('customer','super_admin') then raise exception 'Only customers can checkout'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;

  if p_merchant_id is not null and not exists(
    select 1 from public.merchant_profiles where id=p_merchant_id and approval_status='approved'
  ) then raise exception 'Merchant is unavailable'; end if;

  select delivery_fee_iqd into v_delivery from public.service_zones
  where id=p_service_zone_id and is_active=true;
  if v_delivery is null then raise exception 'Delivery zone is unavailable'; end if;

  if p_reward_campaign_id is null then
    if coalesce(p_reward_amount_iqd,0) <> 0 then raise exception 'Reward campaign is required for a reward amount'; end if;
  else
    select * into v_campaign from public.reward_campaigns
    where id=p_reward_campaign_id and is_active=true;
    if not found then raise exception 'Reward campaign is unavailable'; end if;
    if p_reward_amount_iqd <> v_campaign.reward_amount_iqd then raise exception 'Reward amount does not match campaign'; end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
    where id=(v_item->>'product_id')::uuid
      and merchant_id is not distinct from p_merchant_id
      and is_shakh_store=(p_merchant_id is null)
      and is_available=true
    for update;
    if not found then raise exception 'A product is unavailable'; end if;
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid product quantity'; end if;
    if v_product.stock_quantity is not null and v_product.stock_quantity < v_qty then raise exception 'Insufficient product stock'; end if;
    v_subtotal := v_subtotal + round(v_product.price_iqd*v_qty)::bigint;
  end loop;

  v_total := v_subtotal + v_delivery + coalesce(p_reward_amount_iqd,0);
  insert into public.orders(customer_id,merchant_id,service_zone_id,subtotal_iqd,delivery_fee_iqd,
    reward_campaign_id,reward_amount_iqd,total_iqd,status)
  values(auth.uid(),p_merchant_id,p_service_zone_id,v_subtotal,v_delivery,
    p_reward_campaign_id,coalesce(p_reward_amount_iqd,0),v_total,'placed')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
    where id=(v_item->>'product_id')::uuid
      and merchant_id is not distinct from p_merchant_id
      and is_shakh_store=(p_merchant_id is null)
      and is_available=true
    for update;
    v_qty := (v_item->>'quantity')::numeric;
    v_line := round(v_product.price_iqd*v_qty)::bigint;
    insert into public.order_items(order_id,product_id,product_title_snapshot,quantity,unit_price_iqd,line_total_iqd)
    values(v_order_id,v_product.id,v_product.title,v_qty,v_product.price_iqd,v_line);
    if v_product.stock_quantity is not null then
      update public.products set stock_quantity=stock_quantity-v_qty,updated_at=now() where id=v_product.id;
    end if;
  end loop;

  if p_merchant_id is null then
    insert into public.notifications(user_id,title,body,kind)
    select id,'داواکاری نوێ بۆ شاخ ستۆر','داواکارییەکی نوێ لە شاخ ستۆر هەیە.','new_shakh_store_order'
    from public.profiles where role='super_admin' and is_active=true;
  else
    insert into public.notifications(user_id,title,body,kind)
    select user_id,'داواکاری نوێ','داواکارییەکی نوێت هەیە.','new_order'
    from public.merchant_profiles where id=p_merchant_id;
  end if;
  return v_order_id;
end;
$fn$;

create or replace function public.settle_delivered_order(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare
  v_order public.orders%rowtype;
  v_admin_id uuid;
  v_merchant_user_id uuid;
  v_reward_owner uuid;
  v_captain_share bigint;
  v_rows integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.settled_at is not null then raise exception 'Order already settled'; end if;
  if v_order.status <> 'delivered' then raise exception 'Order must be marked delivered first'; end if;
  if not public.is_super_admin() and v_order.captain_user_id is distinct from auth.uid() then
    raise exception 'Only assigned captain or super admin can settle this order';
  end if;

  select id into v_admin_id from public.profiles
  where role='super_admin' and is_active=true order by created_at asc limit 1;
  if v_admin_id is null then raise exception 'Super admin account is not initialized'; end if;

  v_captain_share := greatest(v_order.delivery_fee_iqd-v_order.platform_delivery_share_iqd,0);

  if v_order.merchant_id is not null and v_order.merchant_commission_iqd > 0 then
    select user_id into v_merchant_user_id from public.merchant_profiles where id=v_order.merchant_id;
    update public.wallets set balance_iqd=balance_iqd-v_order.merchant_commission_iqd,updated_at=now()
    where user_id=v_merchant_user_id and balance_iqd>=v_order.merchant_commission_iqd;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Merchant wallet has insufficient balance'; end if;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_merchant_user_id,'merchant_commission',v_order.merchant_commission_iqd,'debit','order',v_order.id,
      'merchant-commission:'||v_order.id::text,'Merchant commission debit',auth.uid());
    update public.wallets set balance_iqd=balance_iqd+v_order.merchant_commission_iqd,updated_at=now() where user_id=v_admin_id;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_admin_id,'merchant_commission',v_order.merchant_commission_iqd,'credit','order',v_order.id,
      'admin-merchant-commission:'||v_order.id::text,'Merchant commission received',auth.uid());
  end if;

  if v_order.platform_delivery_share_iqd > 0 then
    update public.wallets set balance_iqd=balance_iqd+v_order.platform_delivery_share_iqd,updated_at=now() where user_id=v_admin_id;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_admin_id,'platform_delivery_share',v_order.platform_delivery_share_iqd,'credit','order',v_order.id,
      'admin-delivery-share:'||v_order.id::text,'Platform delivery share',auth.uid());
  end if;

  if v_order.captain_user_id is not null and v_captain_share > 0 then
    update public.wallets set balance_iqd=balance_iqd+v_captain_share,updated_at=now() where user_id=v_order.captain_user_id;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_order.captain_user_id,'captain_delivery',v_captain_share,'credit','order',v_order.id,
      'captain-delivery:'||v_order.id::text,'Captain delivery earnings',auth.uid());
  end if;

  if v_order.reward_campaign_id is not null and v_order.reward_amount_iqd > 0 then
    select owner_user_id into v_reward_owner from public.reward_campaigns
    where id=v_order.reward_campaign_id and is_active=true;
    if v_reward_owner is null then raise exception 'Reward owner is unavailable'; end if;
    update public.wallets set balance_iqd=balance_iqd+v_order.reward_amount_iqd,updated_at=now()
    where user_id=v_reward_owner;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_reward_owner,'reward_credit',v_order.reward_amount_iqd,'credit','order',v_order.id,
      'reward-credit:'||v_order.id::text,'Reward amount collected with order',auth.uid());
    insert into public.notifications(user_id,title,body,kind)
    values(v_reward_owner,'پارەی شێرو خەلات زیاد کرا','بڕی شێرو خەلات بۆ جزدانەکەت زیاد کرا.','reward_credit');
  end if;

  update public.orders set settled_at=now() where id=v_order.id;
  insert into public.notifications(user_id,title,body,kind)
  values(v_admin_id,'داواکاری گەیاندن تەواو بوو','کۆمسیۆن و بەشی گەیاندن بۆ جزدان زیاد کرا.','order_settled');
  if v_order.captain_user_id is not null then
    insert into public.notifications(user_id,title,body,kind)
    values(v_order.captain_user_id,'گەیاندن تەواو بوو','بڕی '||v_captain_share::text||' دینار بۆ جزدانەکەت زیاد کرا.','captain_earning');
  end if;
end;
$fn$;

revoke execute on function public.create_order(uuid,uuid,jsonb,uuid,bigint) from public,anon;
grant execute on function public.create_order(uuid,uuid,jsonb,bigint,bigint) to authenticated;
revoke execute on function public.settle_delivered_order(uuid) from public,anon;
grant execute on function public.settle_delivered_order(uuid) to authenticated;
