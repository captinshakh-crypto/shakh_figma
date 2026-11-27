-- Captain-controlled availability, enforced by the database for both self-claim and admin assignment.
alter table public.captain_profiles
  add column if not exists is_available boolean not null default true;

create or replace function public.set_my_captain_availability(p_is_available boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_is_available is null then raise exception 'Availability value is required'; end if;
  if not exists (
    select 1 from public.captain_agreement_acceptances ca
    where ca.user_id=auth.uid() and ca.agreement_version='shakh-captain-terms-v1'
  ) then raise exception 'Accept the current captain agreement before changing availability'; end if;

  update public.captain_profiles cp
  set is_available = p_is_available
  from public.profiles p
  where cp.user_id = auth.uid()
    and cp.user_id = p.id
    and cp.is_active = true
    and p.role = 'captain'
    and p.is_active = true;

  if not found then raise exception 'Active captain account required'; end if;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'set_captain_availability','captain_profile',auth.uid(),
    jsonb_build_object('is_available',p_is_available));
end;
$fn$;

revoke all on function public.set_my_captain_availability(boolean) from public, anon;
grant execute on function public.set_my_captain_availability(boolean) to authenticated;

create or replace function public.claim_available_delivery(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_type public.captain_type;
  v_merchant_id uuid;
  v_commission bigint;
  v_captain_share bigint;
  v_rows integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select cp.captain_type, cp.merchant_id
    into v_type, v_merchant_id
  from public.captain_profiles cp
  join public.profiles p on p.id = cp.user_id
  where cp.user_id = v_user
    and cp.is_active = true
    and cp.is_available = true
    and exists (
      select 1 from public.captain_agreement_acceptances ca
      where ca.user_id=cp.user_id and ca.agreement_version='shakh-captain-terms-v1'
    )
    and p.role = 'captain'
    and p.is_active = true;

  if not found then raise exception 'Active and available captain account required'; end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Delivery order not found'; end if;
  if v_order.status <> 'ready_for_pickup' or v_order.captain_user_id is not null then
    raise exception 'This delivery is no longer available';
  end if;
  if v_type = 'merchant' and v_merchant_id is distinct from v_order.merchant_id then
    raise exception 'This delivery belongs to another store';
  end if;

  v_commission := round(v_order.delivery_fee_iqd * 0.20)::bigint;
  v_captain_share := v_order.delivery_fee_iqd - v_commission;

  insert into public.wallets(user_id, balance_iqd)
  values (v_user, 0) on conflict (user_id) do nothing;

  update public.wallets
  set balance_iqd = balance_iqd - v_commission, updated_at = now()
  where user_id = v_user and balance_iqd >= v_commission;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Your wallet does not have enough balance for the 20 percent delivery commission';
  end if;

  insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
  values(v_user,'platform_delivery_share',v_commission,'debit','captain_delivery_commission',v_order.id,
    'captain-delivery-commission:'||v_order.id::text,'Prepaid 20 percent commission from delivery fee',v_user);

  update public.orders
  set captain_user_id = v_user,
      status = 'assigned',
      platform_delivery_share_iqd = v_commission,
      captain_delivery_share_iqd = v_captain_share
  where id = v_order.id;

  delete from public.order_live_locations where order_id = v_order.id;
  insert into public.order_status_history(order_id,from_status,to_status,changed_by,actor_role,note)
  values(v_order.id,'ready_for_pickup','assigned',v_user,'captain','Captain claimed available delivery; 20 percent commission prepaid');

  insert into public.notifications(user_id,title,body,kind)
  values(v_order.customer_id,'کاپتن دیاریکرا','کاپتنێک گەیاندنی داواکارییەکەت وەرگرت.','captain_assigned');
end;
$function$;

create or replace function public.admin_assign_captain(p_order_id uuid, p_captain_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_type public.captain_type;
  v_merchant_id uuid;
  v_commission bigint;
  v_captain_share bigint;
  v_rows integer;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  select cp.captain_type,cp.merchant_id into v_type,v_merchant_id
  from public.captain_profiles cp
  join public.profiles p on p.id=cp.user_id
  where cp.user_id=p_captain_user_id
    and cp.is_active=true
    and cp.is_available=true
    and exists (
      select 1 from public.captain_agreement_acceptances ca
      where ca.user_id=cp.user_id and ca.agreement_version='shakh-captain-terms-v1'
    )
    and p.role='captain'
    and p.is_active=true;
  if not found then raise exception 'Captain account is not active or available'; end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status<>'ready_for_pickup' then raise exception 'Order must be ready for pickup before captain assignment'; end if;
  if v_order.captain_user_id is not null then raise exception 'A captain is already assigned to this order'; end if;
  if v_type='merchant' and v_merchant_id is distinct from v_order.merchant_id then raise exception 'This captain is restricted to a different store'; end if;

  v_commission:=round(v_order.delivery_fee_iqd*0.20)::bigint;
  v_captain_share:=v_order.delivery_fee_iqd-v_commission;
  insert into public.wallets(user_id,balance_iqd) values(p_captain_user_id,0) on conflict(user_id) do nothing;
  update public.wallets set balance_iqd=balance_iqd-v_commission,updated_at=now()
  where user_id=p_captain_user_id and balance_iqd>=v_commission;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Captain wallet must have the required delivery commission before assignment'; end if;
  insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
  values(p_captain_user_id,'platform_delivery_share',v_commission,'debit','captain_delivery_commission',v_order.id,
    'captain-delivery-commission:'||v_order.id::text,'Prepaid 20 percent commission from delivery fee',auth.uid());
  update public.orders set captain_user_id=p_captain_user_id,status='assigned',
    platform_delivery_share_iqd=v_commission,captain_delivery_share_iqd=v_captain_share where id=p_order_id;
  delete from public.order_live_locations where order_id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,changed_by,actor_role,note)
  values(p_order_id,'ready_for_pickup','assigned',auth.uid(),'super_admin','Captain assigned; 20 percent delivery commission prepaid');
  insert into public.notifications(user_id,title,body,kind)
  values(p_captain_user_id,'گەیاندنی نوێت هەیە','داواکارییەکی نوێت بۆ گەیاندن دیاریکرا؛ ٢٠٪ کۆمسیۆن پێشەکی لە جزدان کەمکرایەوە.','delivery_assigned');
  insert into public.notifications(user_id,title,body,kind)
  values(v_order.customer_id,'کاپتن دیاریکرا','کاپتن بۆ گەیاندنی داواکارییەکەت دیاریکرا.','captain_assigned');
end;
$function$;
