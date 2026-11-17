-- SHAKH order commission snapshot, settlement and cash payout requests.
create or replace function public.snapshot_order_commission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_type public.app_role;
  v_rate integer;
  v_delivery_share bigint;
begin
  if new.merchant_id is null then
    new.merchant_commission_rate_bps := 0;
    new.merchant_commission_iqd := 0;
    new.platform_delivery_share_iqd := 0;
    return new;
  end if;

  select merchant_type into v_type
  from public.merchant_profiles
  where id = new.merchant_id and approval_status = 'approved';

  if v_type is null then raise exception 'Merchant is not approved'; end if;

  select commission_rate_bps, platform_delivery_share_iqd
  into v_rate, v_delivery_share
  from public.commission_settings
  where merchant_type = v_type;

  new.merchant_commission_rate_bps := coalesce(v_rate,0);
  new.merchant_commission_iqd := floor((new.subtotal_iqd::numeric * coalesce(v_rate,0)) / 10000)::bigint;
  new.platform_delivery_share_iqd := least(new.delivery_fee_iqd,coalesce(v_delivery_share,200));
  return new;
end;
$fn$;

drop trigger if exists orders_snapshot_commission on public.orders;
create trigger orders_snapshot_commission
before insert on public.orders
for each row execute function public.snapshot_order_commission();

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
  v_captain_share bigint;
  v_rows integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;
  if v_order.settled_at is not null then raise exception 'Order already settled'; end if;
  if v_order.status <> 'delivered' then raise exception 'Order must be marked delivered first'; end if;
  if not public.is_super_admin() and v_order.captain_user_id is distinct from auth.uid() then
    raise exception 'Only assigned captain or super admin can settle this order';
  end if;

  select id into v_admin_id
  from public.profiles
  where role = 'super_admin' and is_active = true
  order by created_at asc limit 1;
  if v_admin_id is null then raise exception 'Super admin account is not initialized'; end if;

  v_captain_share := greatest(v_order.delivery_fee_iqd - v_order.platform_delivery_share_iqd,0);

  if v_order.merchant_id is not null and v_order.merchant_commission_iqd > 0 then
    select user_id into v_merchant_user_id
    from public.merchant_profiles where id = v_order.merchant_id;
    if v_merchant_user_id is null then raise exception 'Merchant account not found'; end if;

    update public.wallets
    set balance_iqd = balance_iqd - v_order.merchant_commission_iqd, updated_at = now()
    where user_id = v_merchant_user_id and balance_iqd >= v_order.merchant_commission_iqd;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Merchant wallet has insufficient balance'; end if;

    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_merchant_user_id,'merchant_commission',v_order.merchant_commission_iqd,'debit','order',v_order.id,
      'merchant-commission:'||v_order.id::text,'Merchant commission debit',auth.uid());

    update public.wallets
    set balance_iqd = balance_iqd + v_order.merchant_commission_iqd, updated_at = now()
    where user_id = v_admin_id;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_admin_id,'merchant_commission',v_order.merchant_commission_iqd,'credit','order',v_order.id,
      'admin-merchant-commission:'||v_order.id::text,'Merchant commission received',auth.uid());
  end if;

  if v_order.platform_delivery_share_iqd > 0 then
    update public.wallets
    set balance_iqd = balance_iqd + v_order.platform_delivery_share_iqd, updated_at = now()
    where user_id = v_admin_id;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_admin_id,'platform_delivery_share',v_order.platform_delivery_share_iqd,'credit','order',v_order.id,
      'admin-delivery-share:'||v_order.id::text,'Platform delivery share',auth.uid());
  end if;

  if v_order.captain_user_id is not null and v_captain_share > 0 then
    update public.wallets
    set balance_iqd = balance_iqd + v_captain_share, updated_at = now()
    where user_id = v_order.captain_user_id;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_order.captain_user_id,'captain_delivery',v_captain_share,'credit','order',v_order.id,
      'captain-delivery:'||v_order.id::text,'Captain delivery earnings',auth.uid());
  end if;

  update public.orders set settled_at = now() where id = v_order.id;

  insert into public.notifications(user_id,title,body,kind)
  values(v_admin_id,'داواکاری گەیاندن تەواو بوو','کۆمسیۆن و بەشی گەیاندن بۆ جزدان زیاد کرا.','order_settled');

  if v_order.captain_user_id is not null then
    insert into public.notifications(user_id,title,body,kind)
    values(v_order.captain_user_id,'گەیاندن تەواو بوو',
      'بڕی '||v_captain_share::text||' دینار بۆ جزدانەکەت زیاد کرا.','captain_earning');
  end if;
end;
$fn$;

create or replace function public.request_wallet_payout(p_amount_iqd bigint, p_method text, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount_iqd is null or p_amount_iqd <= 0 then raise exception 'Amount must be positive'; end if;
  if p_method not in ('fastpay','fib') then raise exception 'Unsupported payout method'; end if;
  insert into public.payout_requests(requester_user_id,amount_iqd,payout_method,admin_note)
  values(auth.uid(),p_amount_iqd,p_method,p_note)
  returning id into v_id;
  insert into public.notifications(user_id,title,body,kind)
  select id,'داواکاری دەرکردنی پارە','داواکاری کاشکردنی جزدان لە چاوەڕوانی پەسەندکردندایە.','payout_pending'
  from public.profiles where role = 'super_admin' and is_active = true;
  return v_id;
end;
$fn$;

create or replace function public.admin_mark_payout_paid(p_request_id uuid, p_admin_note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_req public.payout_requests%rowtype; v_rows integer;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  select * into v_req from public.payout_requests where id = p_request_id for update;
  if not found then raise exception 'Payout request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'Payout request already reviewed'; end if;

  update public.wallets
  set balance_iqd = balance_iqd - v_req.amount_iqd, updated_at = now()
  where user_id = v_req.requester_user_id and balance_iqd >= v_req.amount_iqd;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Insufficient wallet balance to pay out'; end if;

  insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
  values(v_req.requester_user_id,'payout_debit',v_req.amount_iqd,'debit','payout_request',v_req.id,
    'payout-debit:'||v_req.id::text,coalesce(p_admin_note,'Paid manually by admin'),auth.uid());

  update public.payout_requests
  set status='approved', reviewed_by=auth.uid(), reviewed_at=now(), paid_at=now(),
      admin_note=coalesce(p_admin_note,admin_note)
  where id = v_req.id;

  insert into public.notifications(user_id,title,body,kind)
  values(v_req.requester_user_id,'داواکاری پارەدان تەواو بوو',
    'پارەکە بە دەرەوەی ئەپ بە دەستی سوپەر ئەدمین درا.','payout_paid');

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'mark_payout_paid','payout_request',v_req.id,
    jsonb_build_object('amount_iqd',v_req.amount_iqd,'method',v_req.payout_method));
end;
$fn$;

create policy payouts_admin_update on public.payout_requests for update
to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

revoke all on function public.settle_delivered_order(uuid) from public;
revoke all on function public.request_wallet_payout(bigint,text,text) from public;
revoke all on function public.admin_mark_payout_paid(uuid,text) from public;
grant execute on function public.settle_delivered_order(uuid) to authenticated;
grant execute on function public.request_wallet_payout(bigint,text,text) to authenticated;
grant execute on function public.admin_mark_payout_paid(uuid,text) to authenticated;
