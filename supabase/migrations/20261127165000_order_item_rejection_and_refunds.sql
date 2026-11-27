-- Item-level merchant rejection with stock restoration and proportional prepaid commission refunds.
alter table public.order_items
  add column if not exists status text not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references public.profiles(id);

alter table public.order_items
  drop constraint if exists order_items_status_check;
alter table public.order_items
  add constraint order_items_status_check check (status in ('pending','accepted','rejected','cancelled'));

create or replace function public.merchant_reject_order_item(
  p_order_item_id uuid,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_item public.order_items%rowtype;
  v_order public.orders%rowtype;
  v_owner uuid;
  v_actor_role public.app_role;
  v_other_active_count integer;
  v_commission bigint;
  v_reward bigint;
  v_rows integer;
  v_reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(coalesce(p_reason,'')) > 500 then raise exception 'Rejection reason is too long'; end if;

  select * into v_item from public.order_items where id=p_order_item_id for update;
  if not found then raise exception 'Order item not found'; end if;
  select * into v_order from public.orders where id=v_item.order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status <> 'placed' then raise exception 'Items can only be rejected before the store accepts the order'; end if;
  if v_item.status <> 'pending' then raise exception 'This item has already been processed'; end if;

  v_actor_role := public.current_app_role();
  if v_order.merchant_id is null then
    if not public.is_super_admin() then raise exception 'Super admin only for Shakh Store orders'; end if;
    select id into v_owner from public.profiles where role='super_admin' and is_active=true order by created_at asc limit 1;
  else
    select user_id into v_owner from public.merchant_profiles
    where id=v_order.merchant_id and approval_status='approved';
    if v_owner is distinct from auth.uid()
      or v_actor_role not in ('supermarket','restaurant','butcher_poultry','grocery') then
      raise exception 'Only the owner of this store can reject its items';
    end if;
  end if;
  if v_owner is null then raise exception 'Store owner is unavailable'; end if;

  select count(*) into v_other_active_count
  from public.order_items
  where order_id=v_order.id
    and id <> v_item.id
    and status not in ('rejected','cancelled');

  if v_item.product_id is not null then
    update public.products
    set stock_quantity=stock_quantity+v_item.quantity
    where id=v_item.product_id and stock_quantity is not null;
  end if;

  v_commission := coalesce(v_item.merchant_commission_line_snapshot_iqd,0);
  v_reward := round(coalesce(v_item.referral_commission_snapshot_iqd,0) * v_item.quantity)::bigint;

  update public.order_items
  set status='rejected',
      rejection_reason=coalesce(v_reason,'دوکان ناتوانێت ئەم کاڵایە دابین بکات.'),
      rejected_at=now(),
      rejected_by=auth.uid()
  where id=v_item.id;

  if v_other_active_count=0 then
    -- The existing order-level cancellation trigger refunds the remaining prepaid totals once.
    update public.orders
    set subtotal_iqd=0,
        merchant_commission_iqd=0,
        reward_amount_iqd=0,
        total_iqd=delivery_fee_iqd,
        status='rejected'
    where id=v_order.id;

    insert into public.order_status_history(order_id,from_status,to_status,changed_by,actor_role,note)
    values(v_order.id,'placed','rejected',auth.uid(),v_actor_role,
      coalesce(v_reason,'هەموو کاڵاکان لەلایەن دوکانەوە ڕەتکرانەوە.'));
    insert into public.notifications(user_id,title,body,kind)
    values(v_order.customer_id,'داواکاری ڕەتکرایەوە',
      coalesce(v_reason,'دوکان ناتوانێت هیچ کام لە کاڵاکانی داواکارییەکەت دابین بکات.'),'order_status');
  else
    -- Return only the rejected line's prepaid commission and referral reserve.
    if v_commission > 0 then
      insert into public.wallets(user_id,balance_iqd) values(v_owner,0) on conflict(user_id) do nothing;
      insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
      values(v_owner,'refund',v_commission,'credit','merchant_item_commission_refund',v_order.id,
        'merchant-item-commission-refund:'||v_item.id::text,'Prepaid product commission refunded after item rejection',auth.uid())
      on conflict(idempotency_key) do nothing;
      get diagnostics v_rows=row_count;
      if v_rows=1 then update public.wallets set balance_iqd=balance_iqd+v_commission,updated_at=now() where user_id=v_owner; end if;
    end if;
    if v_reward > 0 then
      insert into public.wallets(user_id,balance_iqd) values(v_owner,0) on conflict(user_id) do nothing;
      insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
      values(v_owner,'refund',v_reward,'credit','referral_item_reserve_refund',v_order.id,
        'referral-item-reserve-refund:'||v_item.id::text,'Referral reward reserve refunded after item rejection',auth.uid())
      on conflict(idempotency_key) do nothing;
      get diagnostics v_rows=row_count;
      if v_rows=1 then update public.wallets set balance_iqd=balance_iqd+v_reward,updated_at=now() where user_id=v_owner; end if;
    end if;

    update public.orders
    set subtotal_iqd=greatest(0,subtotal_iqd-v_item.line_total_iqd),
        merchant_commission_iqd=greatest(0,merchant_commission_iqd-v_commission),
        reward_amount_iqd=greatest(0,reward_amount_iqd-v_reward),
        total_iqd=greatest(0,subtotal_iqd-v_item.line_total_iqd)+delivery_fee_iqd
    where id=v_order.id;

    insert into public.order_status_history(order_id,from_status,to_status,changed_by,actor_role,note)
    values(v_order.id,'placed','placed',auth.uid(),v_actor_role,
      'Item rejected: '||v_item.product_title_snapshot||' — '||coalesce(v_reason,'No reason provided'));
    insert into public.notifications(user_id,title,body,kind)
    values(v_order.customer_id,'کاڵایەک لە داواکاری ڕەتکرایەوە',
      v_item.product_title_snapshot||' ڕەتکرایەوە. '||coalesce(v_reason,'دوکان ناتوانێت ئەم کاڵایە دابین بکات.'),'order_item_rejected');
  end if;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'merchant_reject_order_item','order_item',v_item.id,
    jsonb_build_object('order_id',v_order.id,'reason',coalesce(v_reason,''),'commission_refund_iqd',v_commission,'reward_refund_iqd',v_reward));
end;
$fn$;

revoke all on function public.merchant_reject_order_item(uuid,text) from public,anon;
grant execute on function public.merchant_reject_order_item(uuid,text) to authenticated;

create or replace function public.update_order_status(p_order_id uuid,p_status text)
returns void
language plpgsql
security definer
set search_path = 'public','pg_temp'
as $function$
declare
  v public.orders%rowtype;
  v_merchant_user uuid;
  v_allowed boolean := false;
  v_actor_role public.app_role;
  v_body text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status is null or p_status not in ('accepted','rejected','preparing','ready_for_pickup','picked_up','delivered','cancelled') then
    raise exception 'Invalid order status';
  end if;

  v_actor_role := public.current_app_role();
  select * into v from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select user_id into v_merchant_user from public.merchant_profiles where id=v.merchant_id;

  if public.is_super_admin() then
    v_allowed :=
      (v.status='placed' and p_status in ('accepted','rejected','cancelled'))
      or (v.status='accepted' and p_status in ('preparing','cancelled'))
      or (v.status='preparing' and p_status in ('ready_for_pickup','cancelled'))
      or (v.status='ready_for_pickup' and p_status='cancelled');
  elsif v.customer_id=auth.uid() and v_actor_role='customer' then
    v_allowed := v.status='placed' and p_status='cancelled';
  elsif v_merchant_user=auth.uid() and v_actor_role in ('supermarket','restaurant','butcher_poultry','grocery') then
    v_allowed :=
      (v.status='placed' and p_status in ('accepted','rejected'))
      or (v.status='accepted' and p_status='preparing')
      or (v.status='preparing' and p_status='ready_for_pickup');
  elsif v.captain_user_id=auth.uid() and v_actor_role='captain' then
    v_allowed :=
      (v.status='assigned' and p_status='picked_up')
      or (v.status='picked_up' and p_status='delivered');
  end if;

  if not v_allowed then raise exception 'You are not allowed to perform this status transition'; end if;

  if p_status='accepted' then
    update public.order_items set status='accepted'
    where order_id=p_order_id and status='pending';
  end if;

  if p_status in ('rejected','cancelled') then
    update public.products p
    set stock_quantity=p.stock_quantity+oi.quantity
    from public.order_items oi
    where oi.order_id=p_order_id
      and oi.product_id=p.id
      and oi.status not in ('rejected','cancelled')
      and p.stock_quantity is not null;

    update public.order_items
    set status=case when p_status='rejected' then 'rejected' else 'cancelled' end,
        rejection_reason=case when p_status='rejected' then coalesce(rejection_reason,'هەموو ئۆردەرەکە ڕەتکرایەوە.') else rejection_reason end,
        rejected_at=case when p_status='rejected' then now() else rejected_at end,
        rejected_by=case when p_status='rejected' then auth.uid() else rejected_by end
    where order_id=p_order_id and status not in ('rejected','cancelled');
  end if;

  update public.orders set status=p_status where id=p_order_id;

  if p_status in ('delivered','cancelled','rejected') then
    delete from public.order_live_locations where order_id=p_order_id;
  end if;

  insert into public.order_status_history(order_id,from_status,to_status,changed_by,actor_role,note)
  values(p_order_id,v.status,p_status,auth.uid(),v_actor_role,null);

  v_body := case p_status
    when 'accepted' then 'داواکارییەکەت پەسەند کرا.'
    when 'rejected' then 'داواکارییەکەت ڕەتکرایەوە.'
    when 'preparing' then 'دوکان دەستی بە ئامادەکردنی داواکارییەکەت کرد.'
    when 'ready_for_pickup' then 'داواکارییەکەت ئامادەی وەرگرتنی کاپتنە.'
    when 'picked_up' then 'کاپتن داواکارییەکەت وەرگرت.'
    when 'delivered' then 'داواکارییەکەت گەیەنرا.'
    when 'cancelled' then 'داواکارییەکەت هەڵوەشێندرایەوە.'
    else 'دۆخی داواکاری گۆڕا.'
  end;

  insert into public.notifications(user_id,title,body,kind)
  values(v.customer_id,'نوێکردنەوەی داواکاری',v_body,'order_status');

  if p_status='delivered' and v_merchant_user is not null then
    insert into public.notifications(user_id,title,body,kind)
    values(v_merchant_user,'داواکاری گەیەنرا','داواکارییەکەت گەیەنرا.','order_delivered');
  end if;
end;
$function$;

create or replace function public.settle_delivered_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_admin_id uuid;
  v_reward_owner uuid;
  v_merchant_owner uuid;
  v_merchant_commission bigint := 0;
  v_balance bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.settled_at is not null then raise exception 'Order already settled'; end if;
  if v_order.status <> 'delivered' then raise exception 'Order must be marked delivered first'; end if;
  if not public.is_super_admin() and v_order.captain_user_id is distinct from auth.uid() then
    raise exception 'Only assigned captain or super admin can settle this order';
  end if;

  select id into v_admin_id from public.profiles where role='super_admin' and is_active=true order by created_at asc limit 1;
  if v_admin_id is null then raise exception 'Super admin account is not initialized'; end if;

  if v_order.merchant_id is not null then
    select user_id into v_merchant_owner from public.merchant_profiles where id=v_order.merchant_id;
    select coalesce(sum(merchant_commission_line_snapshot_iqd),0) into v_merchant_commission
      from public.order_items where order_id=v_order.id and status not in ('rejected','cancelled');
    if v_merchant_owner is null then raise exception 'Merchant account is unavailable'; end if;
    if v_merchant_commission > 0 then
      select balance_iqd into v_balance from public.wallets where user_id=v_merchant_owner for update;
      if coalesce(v_balance,0) < v_merchant_commission then
        raise exception 'Merchant wallet has insufficient balance for product commissions';
      end if;
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

  insert into public.platform_revenue_ledger(revenue_type,source_ledger_id,order_id,amount_iqd,created_at,note)
  select case when wl.entry_type::text='merchant_commission' then 'merchant_product_commission'
              when wl.entry_type::text='platform_delivery_share' then 'captain_delivery_share' end,
         wl.id, wl.reference_id, wl.amount_iqd, wl.created_at,
         'Recognized from actual wallet debit'
  from public.wallet_ledger wl
  where wl.reference_id=v_order.id and wl.direction='debit'
    and wl.entry_type::text in ('merchant_commission','platform_delivery_share')
  on conflict(source_ledger_id) do nothing;

  if v_order.reward_campaign_id is not null and v_order.reward_amount_iqd>0 then
    select owner_user_id into v_reward_owner from public.reward_campaigns where id=v_order.reward_campaign_id;
    if v_reward_owner is null then raise exception 'Referral link owner is unavailable'; end if;
    insert into public.wallets(user_id,balance_iqd) values(v_reward_owner,0) on conflict(user_id) do nothing;
    update public.wallets set balance_iqd=balance_iqd+v_order.reward_amount_iqd,updated_at=now() where user_id=v_reward_owner;
    insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_reward_owner,'reward_credit',v_order.reward_amount_iqd,'credit','order',v_order.id,
      'reward-credit:'||v_order.id::text,'Referral reward paid after delivered order',auth.uid());
    insert into public.notifications(user_id,title,body,kind)
    values(v_reward_owner,'پارەی شێر و خەڵات زیاد کرا','کۆمسیۆنی لینکەکەت بۆ جزدان زیاد کرا.','reward_credit');
  end if;

  update public.orders set merchant_commission_iqd=v_merchant_commission, settled_at=now() where id=v_order.id;
  insert into public.notifications(user_id,title,body,kind)
  values(v_admin_id,'داواکاری گەیاندن تەواو بوو',
    'کۆمسیۆنی دوکان و بەشی کاپتن لە تۆماری داهاتی شاخ زیاد کران؛ جزدانی کەسی سوپەر ئەدمین ناگۆڕێت.','order_settled');
  if v_order.captain_user_id is not null then
    insert into public.notifications(user_id,title,body,kind)
    values(v_order.captain_user_id,'گەیاندن تەواو بوو',
      'لیستی فرۆشتن و کۆمسیۆنی هەر کاڵایەک لە وردەکاریی داواکارییەکە ببینە.','captain_earning');
  end if;
end;
$function$;
