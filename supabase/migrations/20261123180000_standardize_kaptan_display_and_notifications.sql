-- Standardize the public-facing Kurdish spelling of Captain to "کاپتن"
-- in all database-generated notifications. Internal role/function identifiers stay unchanged.

create or replace function private.notify_order_status_participants()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_merchant_user uuid;
begin
  select * into v_order from public.orders where id = new.order_id;
  if not found then return new; end if;

  if new.to_status = 'ready_for_pickup' then
    insert into public.notifications(user_id,title,body,kind)
    select cp.user_id,'گەیاندنێکی نوێ بەردەستە','داواکارییەکی ئامادە بۆ وەرگرتن هەیە؛ بچۆ بەشی گەیاندنەکان.','delivery_available'
    from public.captain_profiles cp
    join public.profiles p on p.id = cp.user_id
    where cp.is_active = true and p.role='captain' and p.is_active=true
      and (cp.captain_type='shakh'
        or (cp.captain_type='merchant' and cp.merchant_id=v_order.merchant_id));
  elsif new.to_status = 'assigned' and new.actor_role = 'captain' and v_order.captain_user_id is not null then
    insert into public.notifications(user_id,title,body,kind)
    values(v_order.captain_user_id,'گەیاندنەکە بۆ تۆ تۆمار کرا','گەیاندنەکە بە سەرکەوتوویی وەرگیرا؛ ئێستا بۆ دوکان بڕۆ.','delivery_claimed');
  elsif new.to_status = 'picked_up' then
    select user_id into v_merchant_user from public.merchant_profiles where id=v_order.merchant_id;
    if v_merchant_user is not null then
      insert into public.notifications(user_id,title,body,kind)
      values(v_merchant_user,'کاپتن داواکاری وەرگرت','کاپتن داواکارییەکەی لە دوکان وەرگرت و لە ڕێگایە.','order_picked_up');
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.request_captain_application(
  p_captain_type public.captain_type,
  p_merchant_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_role public.app_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles
  where id = auth.uid() and is_active = true;
  if not found then raise exception 'Active profile not found'; end if;
  if v_role <> 'customer' then raise exception 'Only customer accounts can apply to become a captain'; end if;

  if exists (select 1 from public.captain_profiles where user_id = auth.uid() and is_active) then
    raise exception 'An active captain profile already exists';
  end if;
  if exists (select 1 from public.captain_applications where user_id = auth.uid() and status = 'pending') then
    raise exception 'A captain application is already pending';
  end if;

  if p_captain_type = 'shakh' then
    if p_merchant_id is not null then raise exception 'SHAKH captain applications cannot be linked to a store'; end if;
  elsif p_captain_type = 'merchant' then
    if p_merchant_id is null then raise exception 'Choose the store this captain will serve'; end if;
    if not exists (
      select 1 from public.merchant_profiles
      where id = p_merchant_id and approval_status = 'approved'
    ) then raise exception 'The selected store is not approved or does not exist'; end if;
  else
    raise exception 'Invalid captain type';
  end if;

  insert into public.captain_applications(user_id,captain_type,merchant_id,note)
  values(auth.uid(),p_captain_type,p_merchant_id,nullif(trim(coalesce(p_note,'')), ''))
  returning id into v_id;

  insert into public.notifications(user_id,title,body,kind)
  select id,'داواکاری کاپتن نێردرا','داواکاری بوون بە کاپتن بۆ پەسەندکردن نێردرا.','captain_application'
  from public.profiles where role='super_admin' and is_active=true;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'request_captain_application','captain_application',v_id,
    jsonb_build_object('captain_type',p_captain_type,'merchant_id',p_merchant_id));
  return v_id;
end;
$function$;

create or replace function public.review_captain_application(
  p_application_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_app public.captain_applications%rowtype;
  v_old_role public.app_role;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;

  select * into v_app from public.captain_applications
  where id = p_application_id for update;
  if not found then raise exception 'Captain application not found'; end if;
  if v_app.status <> 'pending' then raise exception 'Application already reviewed'; end if;

  select role into v_old_role from public.profiles
  where id = v_app.user_id and is_active = true for update;
  if not found then raise exception 'Applicant profile is inactive or missing'; end if;
  if v_old_role <> 'customer' then raise exception 'Applicant is no longer a customer'; end if;

  if p_approve then
    if v_app.captain_type = 'merchant' and not exists (
      select 1 from public.merchant_profiles
      where id = v_app.merchant_id and approval_status = 'approved'
    ) then raise exception 'The selected store is no longer approved'; end if;

    update public.profiles set role = 'captain', updated_at = now()
    where id = v_app.user_id;

    insert into public.captain_profiles(user_id,captain_type,merchant_id,is_active,approved_by,approved_at)
    values(v_app.user_id,v_app.captain_type,v_app.merchant_id,true,auth.uid(),now())
    on conflict (user_id) do update set
      captain_type = excluded.captain_type,
      merchant_id = excluded.merchant_id,
      is_active = true,
      approved_by = excluded.approved_by,
      approved_at = excluded.approved_at;
  end if;

  update public.captain_applications
  set status = case when p_approve then 'approved'::public.record_status else 'rejected'::public.record_status end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_application_id;

  insert into public.notifications(user_id,title,body,kind)
  values(
    v_app.user_id,
    case when p_approve then 'داواکاری کاپتنی تۆ پەسەند کرا' else 'داواکاری کاپتنی تۆ ڕەتکرایەوە' end,
    case when p_approve
      then case when v_app.captain_type='shakh' then 'تۆ ئێستا کاپتنی شاخیت.' else 'تۆ ئێستا کاپتنی تایبەت بە دوکانی هەڵبژێردراویت.' end
      else coalesce(nullif(trim(p_admin_note),''),'داواکارییەکەت پەسەند نەکرا.') end,
    'captain_application_result'
  );

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),case when p_approve then 'approve_captain_application' else 'reject_captain_application' end,
    'captain_application',v_app.id,
    jsonb_build_object('user_id',v_app.user_id,'captain_type',v_app.captain_type,'merchant_id',v_app.merchant_id));
end;
$function$;

create or replace function public.settle_delivered_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
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
      from public.order_items where order_id=v_order.id;
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

create or replace function public.update_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
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

  update public.orders set status=p_status where id=p_order_id;

  if p_status in ('delivered','cancelled','rejected') then
    delete from public.order_live_locations where order_id=p_order_id;
  end if;

  if p_status in ('rejected','cancelled') then
    update public.products p
    set stock_quantity=p.stock_quantity+oi.quantity
    from public.order_items oi
    where oi.order_id=p_order_id and oi.product_id=p.id and p.stock_quantity is not null;
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

-- Update already-created notices as well as notifications inserted by the functions above.
update public.notifications
set title = replace(title, 'کپتن', 'کاپتن'),
    body = replace(body, 'کپتن', 'کاپتن')
where title like '%کپتن%' or body like '%کپتن%';
