-- Per-zone delivery pricing and immutable SHAKH/captain order snapshots.
alter table public.service_zones
  add column shakh_delivery_share_iqd bigint,
  add column captain_delivery_share_iqd bigint;

update public.service_zones
set shakh_delivery_share_iqd = least(delivery_fee_iqd, 200),
    captain_delivery_share_iqd = delivery_fee_iqd - least(delivery_fee_iqd, 200);

alter table public.service_zones
  alter column shakh_delivery_share_iqd set not null,
  alter column captain_delivery_share_iqd set not null,
  add constraint service_zones_delivery_fee_nonnegative_check check (delivery_fee_iqd >= 0),
  add constraint service_zones_shakh_share_nonnegative_check check (shakh_delivery_share_iqd >= 0),
  add constraint service_zones_captain_share_nonnegative_check check (captain_delivery_share_iqd >= 0),
  add constraint service_zones_delivery_split_matches_fee_check
    check (shakh_delivery_share_iqd <= delivery_fee_iqd
       and captain_delivery_share_iqd = delivery_fee_iqd - shakh_delivery_share_iqd);

alter table public.orders
  add column captain_delivery_share_iqd bigint not null default 0;

update public.orders
set captain_delivery_share_iqd = greatest(delivery_fee_iqd - platform_delivery_share_iqd, 0);

alter table public.orders
  add constraint orders_captain_delivery_share_nonnegative_check check (captain_delivery_share_iqd >= 0),
  add constraint orders_delivery_split_matches_fee_check
    check (platform_delivery_share_iqd <= delivery_fee_iqd
       and captain_delivery_share_iqd = delivery_fee_iqd - platform_delivery_share_iqd);

create or replace function public.admin_save_service_zone(
  p_zone_id uuid default null,
  p_name text default null,
  p_description text default null,
  p_delivery_fee_iqd bigint default null,
  p_shakh_share_iqd bigint default null,
  p_captain_share_iqd bigint default null,
  p_is_active boolean default true
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_zone_id uuid;
  v_action text;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  if nullif(trim(coalesce(p_name,'')), '') is null then raise exception 'Zone name is required'; end if;
  if length(trim(p_name)) > 120 then raise exception 'Zone name is too long'; end if;
  if p_description is not null and length(trim(p_description)) > 500 then raise exception 'Zone description is too long'; end if;
  if p_delivery_fee_iqd is null or p_delivery_fee_iqd < 0 then raise exception 'Delivery fee must be zero or greater'; end if;
  if p_shakh_share_iqd is null or p_shakh_share_iqd < 0 then raise exception 'SHAKH share must be zero or greater'; end if;
  if p_captain_share_iqd is null or p_captain_share_iqd < 0 then raise exception 'Captain share must be zero or greater'; end if;
  if p_shakh_share_iqd > p_delivery_fee_iqd
     or p_captain_share_iqd <> p_delivery_fee_iqd - p_shakh_share_iqd then
    raise exception 'SHAKH share plus captain share must equal the delivery fee';
  end if;
  if p_is_active is null then raise exception 'Zone active status is required'; end if;

  if p_zone_id is null then
    insert into public.service_zones(
      name,description,delivery_fee_iqd,shakh_delivery_share_iqd,captain_delivery_share_iqd,is_active
    )
    values(
      trim(p_name),nullif(trim(coalesce(p_description,'')),''),p_delivery_fee_iqd,
      p_shakh_share_iqd,p_captain_share_iqd,p_is_active
    )
    returning id into v_zone_id;
    v_action := 'create_service_zone';
  else
    update public.service_zones
    set name=trim(p_name),
        description=nullif(trim(coalesce(p_description,'')),''),
        delivery_fee_iqd=p_delivery_fee_iqd,
        shakh_delivery_share_iqd=p_shakh_share_iqd,
        captain_delivery_share_iqd=p_captain_share_iqd,
        is_active=p_is_active
    where id=p_zone_id
    returning id into v_zone_id;
    if v_zone_id is null then raise exception 'Service zone not found'; end if;
    v_action := 'update_service_zone';
  end if;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),v_action,'service_zone',v_zone_id,
    jsonb_build_object(
      'name',trim(p_name),
      'delivery_fee_iqd',p_delivery_fee_iqd,
      'shakh_delivery_share_iqd',p_shakh_share_iqd,
      'captain_delivery_share_iqd',p_captain_share_iqd,
      'is_active',p_is_active
    )
  );
  return v_zone_id;
end;
$fn$;

revoke all on function public.admin_save_service_zone(uuid,text,text,bigint,bigint,bigint,boolean) from public,anon;
grant execute on function public.admin_save_service_zone(uuid,text,text,bigint,bigint,bigint,boolean) to authenticated;

create or replace function public.snapshot_order_commission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_type public.app_role;
  v_rate integer;
  v_zone_fee bigint;
  v_shakh_share bigint;
  v_captain_share bigint;
begin
  select delivery_fee_iqd,shakh_delivery_share_iqd,captain_delivery_share_iqd
  into v_zone_fee,v_shakh_share,v_captain_share
  from public.service_zones
  where id=new.service_zone_id and is_active=true;
  if not found then raise exception 'Delivery zone is unavailable'; end if;

  new.delivery_fee_iqd := v_zone_fee;
  new.platform_delivery_share_iqd := v_shakh_share;
  new.captain_delivery_share_iqd := v_captain_share;

  if new.merchant_id is null then
    new.merchant_commission_rate_bps := 0;
    new.merchant_commission_iqd := 0;
    return new;
  end if;

  select merchant_type into v_type
  from public.merchant_profiles
  where id=new.merchant_id and approval_status='approved';
  if v_type is null then raise exception 'Merchant is not approved'; end if;

  select commission_rate_bps into v_rate
  from public.commission_settings where merchant_type=v_type;

  new.merchant_commission_rate_bps := coalesce(v_rate,0);
  new.merchant_commission_iqd :=
    floor((new.subtotal_iqd::numeric * coalesce(v_rate,0))/10000)::bigint;
  return new;
end;
$fn$;

create or replace function public.settle_delivered_order(p_order_id uuid)
returns void
language plpgsql
security definer
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

  v_captain_share := v_order.captain_delivery_share_iqd;

  if v_order.merchant_id is not null and v_order.merchant_commission_iqd > 0 then
    select user_id into v_merchant_user_id from public.merchant_profiles where id=v_order.merchant_id;
    if v_merchant_user_id is null then raise exception 'Merchant account not found'; end if;
    update public.wallets set balance_iqd=balance_iqd-v_order.merchant_commission_iqd,updated_at=now()
    where user_id=v_merchant_user_id and balance_iqd>=v_order.merchant_commission_iqd;
    get diagnostics v_rows=row_count;
    if v_rows <> 1 then raise exception 'Merchant wallet has insufficient balance'; end if;

    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_merchant_user_id,'merchant_commission',v_order.merchant_commission_iqd,'debit','order',v_order.id,
      'merchant-commission:'||v_order.id::text,'Merchant commission debit',auth.uid());

    update public.wallets set balance_iqd=balance_iqd+v_order.merchant_commission_iqd,updated_at=now()
    where user_id=v_admin_id;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_admin_id,'merchant_commission',v_order.merchant_commission_iqd,'credit','order',v_order.id,
      'admin-merchant-commission:'||v_order.id::text,'Merchant commission received',auth.uid());
  end if;

  if v_order.platform_delivery_share_iqd > 0 then
    update public.wallets set balance_iqd=balance_iqd+v_order.platform_delivery_share_iqd,updated_at=now()
    where user_id=v_admin_id;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_admin_id,'platform_delivery_share',v_order.platform_delivery_share_iqd,'credit','order',v_order.id,
      'admin-delivery-share:'||v_order.id::text,'Platform delivery share',auth.uid());
  end if;

  if v_order.captain_user_id is not null and v_captain_share > 0 then
    update public.wallets set balance_iqd=balance_iqd+v_captain_share,updated_at=now()
    where user_id=v_order.captain_user_id;
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
    values(v_order.captain_user_id,'گەیاندن تەواو بوو',
      'بڕی '||v_captain_share::text||' دینار بۆ جزدانەکەت زیاد کرا.','captain_earning');
  end if;
end;
$fn$;
