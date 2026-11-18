-- Shakh wallet receipts, fixed prepaid commissions, captain delivery commission,
-- and product referral rewards. This migration mirrors the production changes applied
-- to Supabase project zafspwzqxxddbfmtjziq.

alter table public.wallet_topup_requests add column if not exists receipt_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('wallet-receipts','wallet-receipts',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];
drop policy if exists wallet_receipts_owner_upload on storage.objects;
create policy wallet_receipts_owner_upload on storage.objects for insert to authenticated
with check (bucket_id='wallet-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists wallet_receipts_owner_or_admin_read on storage.objects;
create policy wallet_receipts_owner_or_admin_read on storage.objects for select to authenticated
using (bucket_id='wallet-receipts' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_super_admin())));

alter table public.products add column if not exists referral_commission_iqd bigint not null default 0;
alter table public.products drop constraint if exists products_referral_commission_nonnegative;
alter table public.products add constraint products_referral_commission_nonnegative check (referral_commission_iqd>=0);
alter table public.order_items add column if not exists referral_commission_snapshot_iqd bigint not null default 0;
alter table public.order_items drop constraint if exists order_items_referral_commission_snapshot_nonnegative;
alter table public.order_items add constraint order_items_referral_commission_snapshot_nonnegative check (referral_commission_snapshot_iqd>=0);
alter table public.reward_campaigns alter column reward_amount_iqd set default 0;
alter table public.reward_campaigns drop constraint if exists reward_campaigns_reward_amount_iqd_check;
alter table public.reward_campaigns add constraint reward_campaigns_reward_amount_iqd_check check (reward_amount_iqd>=0);

insert into public.platform_settings(key,value)
values('operating_wallet_minimum_iqd','1'::jsonb)
on conflict(key) do update set value=excluded.value,updated_at=now();

drop function if exists public.request_wallet_topup(bigint,text);
CREATE OR REPLACE FUNCTION private.enforce_order_wallet_minimum()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_captain_type public.captain_type; v_captain_merchant uuid;
begin
  if tg_op='UPDATE' and new.captain_user_id is distinct from old.captain_user_id and new.captain_user_id is not null then
    select cp.captain_type,cp.merchant_id into v_captain_type,v_captain_merchant
    from public.captain_profiles cp join public.profiles p on p.id=cp.user_id
    where cp.user_id=new.captain_user_id and cp.is_active=true and p.role='captain' and p.is_active=true;
    if not found then raise exception 'Captain account is not active or approved'; end if;
    if v_captain_type='merchant' and v_captain_merchant is distinct from new.merchant_id then
      raise exception 'This captain is restricted to a different store';
    end if;
  end if;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION private.enforce_product_wallet_minimum()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    raise exception 'Wallet must have a positive balance before posting products';
  end if;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION private.has_operating_wallet(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select coalesce((select w.balance_iqd>=1 from public.wallets w where w.user_id=p_user_id),false) $function$


CREATE OR REPLACE FUNCTION private.operating_wallet_minimum_iqd()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select 1::bigint $function$


CREATE OR REPLACE FUNCTION private.refund_order_commissions_on_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_merchant_owner uuid; v_rows integer;
begin
  if old.status not in ('cancelled','rejected') and new.status in ('cancelled','rejected') and old.settled_at is null then
    if old.merchant_id is null then
      select id into v_merchant_owner from public.profiles where role='super_admin' and is_active=true order by created_at asc limit 1;
    else
      select user_id into v_merchant_owner from public.merchant_profiles where id=old.merchant_id;
    end if;
    if v_merchant_owner is not null and old.merchant_commission_iqd>0 then
      insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
      values(v_merchant_owner,'refund',old.merchant_commission_iqd,'credit','merchant_commission_refund',old.id,
        'merchant-commission-refund:'||old.id::text,'Prepaid fixed merchant commission refunded after cancellation',auth.uid())
      on conflict(idempotency_key) do nothing;
      get diagnostics v_rows=row_count;
      if v_rows=1 then update public.wallets set balance_iqd=balance_iqd+old.merchant_commission_iqd,updated_at=now() where user_id=v_merchant_owner; end if;
    end if;
    if v_merchant_owner is not null and old.reward_amount_iqd>0 and old.reward_campaign_id is not null then
      insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
      values(v_merchant_owner,'refund',old.reward_amount_iqd,'credit','referral_reward_refund',old.id,
        'referral-refund:'||old.id::text,'Prepaid referral reward refunded after cancellation',auth.uid())
      on conflict(idempotency_key) do nothing;
      get diagnostics v_rows=row_count;
      if v_rows=1 then update public.wallets set balance_iqd=balance_iqd+old.reward_amount_iqd,updated_at=now() where user_id=v_merchant_owner; end if;
    end if;
    if old.captain_user_id is not null and old.platform_delivery_share_iqd>0 then
      insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
      values(old.captain_user_id,'refund',old.platform_delivery_share_iqd,'credit','captain_commission_refund',old.id,
        'captain-commission-refund:'||old.id::text,'Prepaid captain delivery commission refunded after cancellation',auth.uid())
      on conflict(idempotency_key) do nothing;
      get diagnostics v_rows=row_count;
      if v_rows=1 then update public.wallets set balance_iqd=balance_iqd+old.platform_delivery_share_iqd,updated_at=now() where user_id=old.captain_user_id; end if;
    end if;
  end if;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION private.require_positive_merchant_wallet_for_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid;
begin
  if new.merchant_id is not null then
    select user_id into v_owner from public.merchant_profiles
    where id=new.merchant_id and approval_status='approved';
    if v_owner is null then raise exception 'Approved merchant account required'; end if;
    if not private.has_operating_wallet(v_owner) then
      raise exception 'Merchant wallet must have a positive balance to receive orders';
    end if;
  end if;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_assign_captain(p_order_id uuid, p_captain_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_order public.orders%rowtype; v_type public.captain_type; v_merchant_id uuid;
  v_commission bigint; v_captain_share bigint; v_rows integer;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  select cp.captain_type,cp.merchant_id into v_type,v_merchant_id
  from public.captain_profiles cp join public.profiles p on p.id=cp.user_id
  where cp.user_id=p_captain_user_id and cp.is_active=true and p.role='captain' and p.is_active=true;
  if not found then raise exception 'Captain account is not active or has no approved captain type'; end if;
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
$function$


CREATE OR REPLACE FUNCTION public.admin_mark_payout_paid(p_request_id uuid, p_admin_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_req public.payout_requests%rowtype;
  v_rows integer;
  v_admin_id uuid;
  v_owner_net bigint;
  v_platform_share bigint;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  select * into v_req from public.payout_requests where id=p_request_id for update;
  if not found then raise exception 'Payout request not found'; end if;
  if v_req.status<>'pending' then raise exception 'Payout request already reviewed'; end if;

  v_owner_net := floor(v_req.amount_iqd*0.75)::bigint;
  v_platform_share := v_req.amount_iqd-v_owner_net;
  update public.wallets set balance_iqd=balance_iqd-v_req.amount_iqd,updated_at=now()
  where user_id=v_req.requester_user_id and balance_iqd>=v_req.amount_iqd;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Insufficient wallet balance to settle referral rewards'; end if;

  insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
  values(v_req.requester_user_id,'payout_debit',v_req.amount_iqd,'debit','payout_request',v_req.id,
    'payout-debit:'||v_req.id::text,'Gross referral rewards settled; 75% paid to owner and 25% retained by SHAKH',auth.uid());

  select id into v_admin_id from public.profiles where role='super_admin' and is_active=true order by created_at asc limit 1;
  if v_admin_id is null then raise exception 'Super admin account is not initialized'; end if;
  if v_platform_share>0 then
    insert into public.wallets(user_id,balance_iqd) values(v_admin_id,0)
    on conflict(user_id) do nothing;
    update public.wallets set balance_iqd=balance_iqd+v_platform_share,updated_at=now() where user_id=v_admin_id;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_admin_id,'admin_adjustment',v_platform_share,'credit','referral_platform_share',v_req.id,
      'referral-platform-share:'||v_req.id::text,'25% SHAKH platform share from referral reward payout',auth.uid());
  end if;

  update public.payout_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),paid_at=now(),
    admin_note=coalesce(p_admin_note,'Paid 75% of gross referral reward amount ('||v_owner_net::text||' IQD)')
  where id=v_req.id;
  insert into public.notifications(user_id,title,body,kind)
  values(v_req.requester_user_id,'داواکاری خەڵات تەواو بوو',
    'لە کۆی '||v_req.amount_iqd::text||' دینار، بڕی '||v_owner_net::text||' دینار (٧٥٪) بۆت درا؛ ٢٥٪ بۆ پلاتفۆرمی شاخ مایەوە.','payout_paid');
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'mark_referral_payout_paid','payout_request',v_req.id,
    jsonb_build_object('gross_amount_iqd',v_req.amount_iqd,'owner_paid_iqd',v_owner_net,'platform_share_iqd',v_platform_share,'method',v_req.payout_method));
end;
$function$


CREATE OR REPLACE FUNCTION public.create_order_v2(p_merchant_id uuid, p_service_zone_id uuid, p_items jsonb, p_delivery_address text, p_delivery_phone text, p_delivery_notes text DEFAULT NULL::text, p_reward_campaign_id uuid DEFAULT NULL::uuid, p_reward_amount_iqd bigint DEFAULT 0, p_idempotency_key text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order_id uuid; v_existing_customer uuid; v_subtotal bigint:=0; v_delivery bigint; v_total bigint;
  v_item jsonb; v_product public.products%rowtype; v_qty numeric(12,3); v_line bigint;
  v_reward_total bigint:=0; v_merchant_commission bigint:=0; v_fixed_per_unit bigint:=0;
  v_reward_owner uuid; v_merchant_owner uuid; v_merchant_type public.app_role; v_prepaid_total bigint;
  v_rows integer; v_role public.app_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('customer','super_admin') then raise exception 'Only customers can checkout'; end if;
  if nullif(trim(coalesce(p_delivery_address,'')),'') is null or length(trim(p_delivery_address))<8 or length(trim(p_delivery_address))>500 then
    raise exception 'Enter a complete delivery address (8 to 500 characters)';
  end if;
  if p_delivery_phone is null or length(regexp_replace(p_delivery_phone,'[^0-9]','','g'))<7
     or length(regexp_replace(p_delivery_phone,'[^0-9]','','g'))>20 or p_delivery_phone !~ '^[0-9+()[:space:]-]+$' then
    raise exception 'Enter a valid contact phone number';
  end if;
  if p_delivery_notes is not null and length(trim(p_delivery_notes))>500 then raise exception 'Delivery notes are too long'; end if;
  if p_idempotency_key is null or length(p_idempotency_key)<16 or length(p_idempotency_key)>100 then raise exception 'A valid checkout request key is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_idempotency_key,0));
  select id,customer_id into v_order_id,v_existing_customer from public.orders where idempotency_key=p_idempotency_key;
  if found then
    if v_existing_customer<>auth.uid() then raise exception 'Checkout request key already used'; end if;
    return v_order_id;
  end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) item group by item->>'product_id' having count(*)>1) then raise exception 'Duplicate product lines are not allowed'; end if;
  if coalesce(p_reward_amount_iqd,0)<>0 then raise exception 'Referral rewards are paid by the merchant, not added to the customer total'; end if;
  if p_merchant_id is not null then
    select user_id,merchant_type into v_merchant_owner,v_merchant_type from public.merchant_profiles where id=p_merchant_id and approval_status='approved';
    if v_merchant_owner is null then raise exception 'Merchant is unavailable'; end if;
    select coalesce(fixed_commission_per_unit_iqd,0) into v_fixed_per_unit from public.commission_settings where merchant_type=v_merchant_type;
  else
    select id into v_merchant_owner from public.profiles where role='super_admin' and is_active=true order by created_at asc limit 1;
  end if;
  if v_merchant_owner is null then raise exception 'Store owner is unavailable'; end if;
  select delivery_fee_iqd into v_delivery from public.service_zones where id=p_service_zone_id and is_active=true;
  if v_delivery is null then raise exception 'Delivery zone is unavailable'; end if;
  if p_reward_campaign_id is not null then
    select owner_user_id into v_reward_owner from public.reward_campaigns where id=p_reward_campaign_id and is_active=true;
    if v_reward_owner is null then raise exception 'Referral link is unavailable'; end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if nullif(v_item->>'product_id','') is null then raise exception 'Invalid product'; end if;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid
      and merchant_id is not distinct from p_merchant_id and is_shakh_store=(p_merchant_id is null) and is_available=true for update;
    if not found then raise exception 'A product is unavailable'; end if;
    v_qty:=(v_item->>'quantity')::numeric;
    if v_qty is null or v_qty<=0 or v_qty>10000 then raise exception 'Invalid product quantity'; end if;
    if v_product.stock_quantity is not null and v_product.stock_quantity<v_qty then raise exception 'Insufficient product stock for: %',v_product.title; end if;
    v_subtotal:=v_subtotal+round(v_product.price_iqd*v_qty)::bigint;
    if p_merchant_id is not null then v_merchant_commission:=v_merchant_commission+round(v_fixed_per_unit*v_qty)::bigint; end if;
    if p_reward_campaign_id is not null then v_reward_total:=v_reward_total+round(v_product.referral_commission_iqd*v_qty)::bigint; end if;
  end loop;

  v_total:=v_subtotal+v_delivery;
  v_prepaid_total:=v_merchant_commission+v_reward_total;
  insert into public.orders(customer_id,merchant_id,service_zone_id,subtotal_iqd,delivery_fee_iqd,
    merchant_commission_iqd,reward_campaign_id,reward_amount_iqd,total_iqd,status,
    delivery_address,delivery_phone,delivery_notes,idempotency_key)
  values(auth.uid(),p_merchant_id,p_service_zone_id,v_subtotal,v_delivery,
    v_merchant_commission,p_reward_campaign_id,v_reward_total,v_total,'placed',
    trim(p_delivery_address),trim(p_delivery_phone),nullif(trim(coalesce(p_delivery_notes,'')),''),p_idempotency_key)
  returning id into v_order_id;

  if v_prepaid_total>0 then
    insert into public.wallets(user_id,balance_iqd) values(v_merchant_owner,0) on conflict(user_id) do nothing;
    update public.wallets set balance_iqd=balance_iqd-v_prepaid_total,updated_at=now()
    where user_id=v_merchant_owner and balance_iqd>=v_prepaid_total;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Store wallet balance is insufficient for prepaid sale and referral commissions'; end if;
    if v_merchant_commission>0 then
      insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
      values(v_merchant_owner,'merchant_commission',v_merchant_commission,'debit','merchant_sale_commission',v_order_id,
        'merchant-sale-commission:'||v_order_id::text,'Prepaid fixed commission for products sold',auth.uid());
    end if;
    if v_reward_total>0 then
      insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
      values(v_merchant_owner,'merchant_commission',v_reward_total,'debit','referral_reward_reserve',v_order_id,
        'referral-reserve:'||v_order_id::text,'Prepaid referral reward reserved for this order',auth.uid());
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid
      and merchant_id is not distinct from p_merchant_id and is_shakh_store=(p_merchant_id is null) and is_available=true for update;
    v_qty:=(v_item->>'quantity')::numeric;
    v_line:=round(v_product.price_iqd*v_qty)::bigint;
    insert into public.order_items(order_id,product_id,product_title_snapshot,quantity,unit_price_iqd,line_total_iqd,referral_commission_snapshot_iqd)
    values(v_order_id,v_product.id,v_product.title,v_qty,v_product.price_iqd,v_line,
      case when p_reward_campaign_id is not null then v_product.referral_commission_iqd else 0 end);
    if v_product.stock_quantity is not null then update public.products set stock_quantity=stock_quantity-v_qty where id=v_product.id; end if;
  end loop;

  insert into public.order_status_history(order_id,from_status,to_status,changed_by,actor_role,note)
  values(v_order_id,null,'placed',auth.uid(),v_role,'Order created');
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
$function$


CREATE OR REPLACE FUNCTION public.request_wallet_payout(p_amount_iqd bigint, p_method text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_available bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount_iqd is null or p_amount_iqd<=0 then raise exception 'Amount must be positive'; end if;
  if p_method not in ('fastpay','fib') then raise exception 'Unsupported payout method'; end if;
  if not exists(select 1 from public.reward_campaigns where owner_user_id=auth.uid()) then
    raise exception 'Only referral link owners can request a payout';
  end if;
  select coalesce(sum(case when direction='credit' and entry_type='reward_credit' then amount_iqd
                           when direction='debit' and entry_type='payout_debit' then -amount_iqd else 0 end),0)
  into v_available from public.wallet_ledger where wallet_user_id=auth.uid();
  if p_amount_iqd>v_available then raise exception 'Requested amount exceeds your available referral rewards'; end if;
  insert into public.payout_requests(requester_user_id,amount_iqd,payout_method,admin_note)
  values(auth.uid(),p_amount_iqd,p_method,p_note) returning id into v_id;
  insert into public.notifications(user_id,title,body,kind)
  select id,'داواکاری دەرکردنی خەڵات','داواکاری کاشکردنی خەڵات لە چاوەڕوانی پەسەندکردندایە. ٧٥٪ بۆ خاوەن لینک و ٢٥٪ بۆ شاخە.','payout_pending'
  from public.profiles where role='super_admin' and is_active=true;
  return v_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.request_wallet_topup(p_amount_iqd bigint, p_note text DEFAULT NULL::text, p_receipt_path text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount_iqd is null or p_amount_iqd <= 0 then raise exception 'Amount must be positive'; end if;
  if p_receipt_path is null
     or split_part(p_receipt_path,'/',1) <> auth.uid()::text
     or length(p_receipt_path)>500
     or not exists (
       select 1 from storage.objects o
       where o.bucket_id='wallet-receipts' and o.name=p_receipt_path
     ) then
    raise exception 'Upload a valid payment receipt before submitting the top-up request';
  end if;

  insert into public.wallet_topup_requests(user_id,amount_iqd,note,receipt_path)
  values(auth.uid(),p_amount_iqd,p_note,p_receipt_path)
  returning id into v_id;

  insert into public.notifications(user_id,title,body,kind)
  values(auth.uid(),'داواکاری جزدان نێردرا','وەسڵی پارەدان و داواکاری پڕکردنەوە نێردرا؛ لە چاوەڕوانی پشکنینی سوپەر ئەدمین دایە.','wallet_topup_pending');

  insert into public.notifications(user_id,title,body,kind)
  select id,'داواکاری نوێی جزدان','داواکاری پڕکردنەوەی جزدان بە بڕی '||p_amount_iqd::text||' دینار لەگەڵ وەسڵ نێردرا.','admin_wallet_topup_request'
  from public.profiles where role='super_admin' and is_active=true;

  return v_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.review_wallet_topup(p_request_id uuid, p_approve boolean, p_admin_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_req public.wallet_topup_requests%rowtype;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  select * into v_req from public.wallet_topup_requests where id=p_request_id for update;
  if not found then raise exception 'Top-up request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'Request already reviewed'; end if;

  if p_approve and (
    v_req.receipt_path is null
    or not exists (
      select 1 from storage.objects o
      where o.bucket_id='wallet-receipts' and o.name=v_req.receipt_path
    )
  ) then
    raise exception 'A valid payment receipt is required before approval';
  end if;

  update public.wallet_topup_requests
  set status=case when p_approve then 'approved'::public.record_status else 'rejected'::public.record_status end,
      reviewed_by=auth.uid(),reviewed_at=now()
  where id=p_request_id;

  if p_approve then
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_req.user_id,'topup',v_req.amount_iqd,'credit','wallet_topup_request',v_req.id,
      'topup:'||v_req.id::text,'Admin-approved wallet top-up after receipt verification',auth.uid());
    update public.wallets set balance_iqd=balance_iqd+v_req.amount_iqd,updated_at=now()
    where user_id=v_req.user_id;
  end if;

  insert into public.notifications(user_id,title,body,kind)
  values(v_req.user_id,
    case when p_approve then 'جزدان پڕکرایەوە' else 'داواکاری جزدان ڕەتکرایەوە' end,
    case when p_approve then 'وەسڵ پشتڕاست کرایەوە و بڕی داواکراو بۆ جزدان زیاد کرا.' else coalesce(p_admin_note,'داواکارییەکەت پەسەند نەکرا.') end,
    case when p_approve then 'wallet_topup_approved' else 'wallet_topup_rejected' end);
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),case when p_approve then 'approve_topup' else 'reject_topup' end,
    'wallet_topup_request',v_req.id,jsonb_build_object('amount_iqd',v_req.amount_iqd,'receipt_path',v_req.receipt_path));
end;
$function$


CREATE OR REPLACE FUNCTION public.settle_delivered_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order public.orders%rowtype;
  v_admin_id uuid;
  v_reward_owner uuid;
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

  if v_order.merchant_id is not null and v_order.merchant_commission_iqd>0 then
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_admin_id,'merchant_commission',v_order.merchant_commission_iqd,'credit','order',v_order.id,
      'admin-merchant-commission:'||v_order.id::text,'Prepaid merchant sale commission received',auth.uid());
    update public.wallets set balance_iqd=balance_iqd+v_order.merchant_commission_iqd,updated_at=now() where user_id=v_admin_id;
  end if;
  if v_order.platform_delivery_share_iqd>0 then
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_admin_id,'platform_delivery_share',v_order.platform_delivery_share_iqd,'credit','order',v_order.id,
      'admin-delivery-share:'||v_order.id::text,'Captain prepaid 20% delivery commission received',auth.uid());
    update public.wallets set balance_iqd=balance_iqd+v_order.platform_delivery_share_iqd,updated_at=now() where user_id=v_admin_id;
  end if;

  if v_order.reward_campaign_id is not null and v_order.reward_amount_iqd>0 then
    select owner_user_id into v_reward_owner
    from public.reward_campaigns where id=v_order.reward_campaign_id;
    if v_reward_owner is null then raise exception 'Referral link owner is unavailable'; end if;
    insert into public.wallets(user_id,balance_iqd) values(v_reward_owner,0)
    on conflict(user_id) do nothing;
    update public.wallets set balance_iqd=balance_iqd+v_order.reward_amount_iqd,updated_at=now()
    where user_id=v_reward_owner;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_reward_owner,'reward_credit',v_order.reward_amount_iqd,'credit','order',v_order.id,
      'reward-credit:'||v_order.id::text,'Referral reward paid from prepaid store wallet after delivered order',auth.uid());
    insert into public.notifications(user_id,title,body,kind)
    values(v_reward_owner,'پارەی شێر و خەڵات زیاد کرا',
      'کۆمسیۆنی فرۆشتنی لینکەکەت بۆ جزدان زیاد کرا. لە کۆتایی مانگ دەتوانیت داوای کاشکردنی بکەیت.','reward_credit');
  end if;

  update public.orders set settled_at=now() where id=v_order.id;
  insert into public.notifications(user_id,title,body,kind)
  values(v_admin_id,'داواکاری گەیاندن تەواو بوو','کۆمسیۆنی دوکان و کاپتن بۆ جزدان زیاد کرا.','order_settled');
  if v_order.captain_user_id is not null then
    insert into public.notifications(user_id,title,body,kind)
    values(v_order.captain_user_id,'گەیاندن تەواو بوو',
      'کرێی تەواوی گەیاندن بە کاش لە کڕیار وەرگیرا؛ کۆمسیۆنی ٢٠٪ پێشتر لە جزدان کەمکرایەوە. هیچ پارەیەک بۆ جزدان زیاد نەکرا.','captain_earning');
  end if;
end;
$function$


CREATE OR REPLACE FUNCTION public.snapshot_order_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_zone_fee bigint;
begin
  select delivery_fee_iqd into v_zone_fee from public.service_zones where id=new.service_zone_id and is_active=true;
  if not found then raise exception 'Delivery zone is unavailable'; end if;
  new.delivery_fee_iqd:=v_zone_fee;
  new.platform_delivery_share_iqd:=0;
  new.captain_delivery_share_iqd:=0;
  new.merchant_commission_rate_bps:=0;
  new.merchant_commission_iqd:=coalesce(new.merchant_commission_iqd,0);
  return new;
end;
$function$


drop trigger if exists refund_referral_reward_on_cancel on public.orders;
drop trigger if exists refund_order_commissions_on_cancel on public.orders;
create trigger refund_order_commissions_on_cancel after update of status on public.orders
for each row execute function private.refund_order_commissions_on_cancel();

drop trigger if exists orders_merchant_wallet_positive_guard on public.orders;
create trigger orders_merchant_wallet_positive_guard before insert on public.orders
for each row execute function private.require_positive_merchant_wallet_for_order();

revoke all on function public.request_wallet_topup(bigint,text,text) from public,anon;
grant execute on function public.request_wallet_topup(bigint,text,text) to authenticated;
revoke all on function public.review_wallet_topup(uuid,boolean,text) from public,anon;
grant execute on function public.review_wallet_topup(uuid,boolean,text) to authenticated;
revoke all on function public.create_order_v2(uuid,uuid,jsonb,text,text,text,uuid,bigint,text) from public,anon;
grant execute on function public.create_order_v2(uuid,uuid,jsonb,text,text,text,uuid,bigint,text) to authenticated;
revoke all on function public.request_wallet_payout(bigint,text,text) from public,anon;
grant execute on function public.request_wallet_payout(bigint,text,text) to authenticated;
revoke all on function public.admin_mark_payout_paid(uuid,text) from public,anon;
grant execute on function public.admin_mark_payout_paid(uuid,text) to authenticated;
revoke all on function public.admin_assign_captain(uuid,uuid) from public,anon;
grant execute on function public.admin_assign_captain(uuid,uuid) to authenticated;
revoke all on function public.settle_delivered_order(uuid) from public,anon;
grant execute on function public.settle_delivered_order(uuid) to authenticated;
revoke all on function public.create_order(uuid,uuid,jsonb,uuid,bigint) from public,anon,authenticated;
revoke all on function public.create_shakh_store_order(uuid,jsonb,uuid,bigint) from public,anon,authenticated;
revoke all on function private.refund_order_commissions_on_cancel() from public,anon,authenticated;
revoke all on function private.require_positive_merchant_wallet_for_order() from public,anon,authenticated;
