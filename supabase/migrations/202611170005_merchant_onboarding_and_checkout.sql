-- Merchant onboarding and secure single-merchant checkout lifecycle.
create or replace function public.request_merchant_account(
  p_business_name text,
  p_merchant_type public.app_role,
  p_address text default null,
  p_description text default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_business_name),'') is null then raise exception 'Business name is required'; end if;
  if p_merchant_type not in ('supermarket','restaurant','butcher_poultry','grocery') then raise exception 'Invalid merchant category'; end if;
  if exists(select 1 from public.merchant_profiles where user_id=auth.uid()) then
    raise exception 'Merchant application already exists';
  end if;
  insert into public.merchant_profiles(user_id,business_name,merchant_type,address,description,approval_status)
  values(auth.uid(),trim(p_business_name),p_merchant_type,p_address,p_description,'pending')
  returning id into v_id;
  insert into public.notifications(user_id,title,body,kind)
  select id,'داواکاری دوکان نێردرا','داواکارییەکەت بۆ پەسەندکردنی سوپەر ئەدمین نێردرا.','merchant_application'
  from public.profiles where role='super_admin' and is_active=true;
  return v_id;
end;
$fn$;

create or replace function public.admin_review_merchant(p_merchant_id uuid,p_approve boolean)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v public.merchant_profiles%rowtype;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  select * into v from public.merchant_profiles where id=p_merchant_id for update;
  if not found then raise exception 'Merchant application not found'; end if;
  if v.approval_status <> 'pending' then raise exception 'Application already reviewed'; end if;
  update public.merchant_profiles set approval_status=case when p_approve then 'approved'::public.record_status else 'rejected'::public.record_status end where id=v.id;
  update public.profiles set role=case when p_approve then v.merchant_type else 'customer'::public.app_role end where id=v.user_id;
  insert into public.notifications(user_id,title,body,kind)
  values(v.user_id,
    case when p_approve then 'دوکانەکەت پەسەند کرا' else 'داواکاری دوکان ڕەتکرایەوە' end,
    case when p_approve then 'ئێستا دەتوانیت بەشی دوکانەکەت بەڕێوە ببەیت.' else 'داواکاری دوکانەکەت پەسەند نەکرا.' end,
    'merchant_application_result');
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),case when p_approve then 'approve_merchant' else 'reject_merchant' end,'merchant_profile',v.id,jsonb_build_object('user_id',v.user_id));
end;
$fn$;

create policy products_merchant_delete on public.products for delete
to authenticated using (
  public.is_super_admin() or exists(
    select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=auth.uid()
  )
);

create policy merchants_admin_read_all on public.merchant_profiles for select
to authenticated using (public.is_super_admin());

create or replace function public.create_order(
  p_merchant_id uuid,
  p_service_zone_id uuid,
  p_items jsonb
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare
  v_order_id uuid;
  v_subtotal bigint := 0;
  v_delivery bigint;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty numeric(12,3);
  v_line bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.current_app_role() not in ('customer','super_admin') then raise exception 'Only customers can checkout'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
  if not exists(select 1 from public.merchant_profiles where id=p_merchant_id and approval_status='approved') then
    raise exception 'Merchant is unavailable';
  end if;
  select delivery_fee_iqd into v_delivery from public.service_zones where id=p_service_zone_id and is_active=true;
  if v_delivery is null then raise exception 'Delivery zone is unavailable'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
    where id=(v_item->>'product_id')::uuid and merchant_id=p_merchant_id and is_available=true
    for update;
    if not found then raise exception 'A product is unavailable'; end if;
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid product quantity'; end if;
    if v_product.stock_quantity is not null and v_product.stock_quantity < v_qty then raise exception 'Insufficient product stock'; end if;
    v_line := round(v_product.price_iqd * v_qty)::bigint;
    v_subtotal := v_subtotal + v_line;
  end loop;

  insert into public.orders(customer_id,merchant_id,service_zone_id,subtotal_iqd,delivery_fee_iqd,status)
  values(auth.uid(),p_merchant_id,p_service_zone_id,v_subtotal,v_delivery,'placed')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
    where id=(v_item->>'product_id')::uuid and merchant_id=p_merchant_id and is_available=true
    for update;
    v_qty := (v_item->>'quantity')::numeric;
    v_line := round(v_product.price_iqd * v_qty)::bigint;
    insert into public.order_items(order_id,product_id,product_title_snapshot,quantity,unit_price_iqd,line_total_iqd)
    values(v_order_id,v_product.id,v_product.title,v_qty,v_product.price_iqd,v_line);
    if v_product.stock_quantity is not null then
      update public.products set stock_quantity=stock_quantity-v_qty,updated_at=now() where id=v_product.id;
    end if;
  end loop;
  insert into public.notifications(user_id,title,body,kind)
  select m.user_id,'داواکاری نوێ','داواکارییەکی نوێت هەیە.','new_order'
  from public.merchant_profiles m where m.id=p_merchant_id;
  return v_order_id;
end;
$fn$;

create or replace function public.update_order_status(p_order_id uuid,p_status text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v public.orders%rowtype; v_merchant_user uuid; v_allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select user_id into v_merchant_user from public.merchant_profiles where id=v.merchant_id;

  if public.is_super_admin() then
    v_allowed := p_status in ('accepted','rejected','preparing','ready_for_pickup','assigned','picked_up','delivered','cancelled');
  elsif v_merchant_user=auth.uid() then
    v_allowed := (v.status='placed' and p_status in ('accepted','rejected'))
      or (v.status='accepted' and p_status='preparing')
      or (v.status='preparing' and p_status='ready_for_pickup');
  elsif v.captain_user_id=auth.uid() then
    v_allowed := (v.status='assigned' and p_status='picked_up')
      or (v.status='picked_up' and p_status='delivered');
  end if;
  if not v_allowed then raise exception 'You are not allowed to perform this status transition'; end if;

  update public.orders set status=p_status where id=p_order_id;
  if p_status='rejected' or p_status='cancelled' then
    -- Restore reserved inventory on cancellation/rejection.
    update public.products p set stock_quantity=p.stock_quantity+oi.quantity,updated_at=now()
    from public.order_items oi
    where oi.order_id=p_order_id and oi.product_id=p.id and p.stock_quantity is not null;
  end if;
  insert into public.notifications(user_id,title,body,kind)
  values(v.customer_id,'گۆڕانی دۆخی داواکاری','دۆخی داواکارییەکەت گۆڕا بۆ: '||p_status,'order_status');
end;
$fn$;

create or replace function public.admin_assign_captain(p_order_id uuid,p_captain_user_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v public.orders%rowtype;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  if not exists(select 1 from public.profiles where id=p_captain_user_id and role='captain' and is_active=true) then
    raise exception 'Captain account is not active';
  end if;
  select * into v from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v.status not in ('ready_for_pickup','assigned') then raise exception 'Order is not ready for assignment'; end if;
  update public.orders set captain_user_id=p_captain_user_id,status='assigned' where id=p_order_id;
  insert into public.notifications(user_id,title,body,kind)
  values(p_captain_user_id,'گەیاندنی نوێت هەیە','داواکارییەکی نوێت بۆ گەیاندن دیاریکرا.','delivery_assigned');
end;
$fn$;

revoke execute on function public.request_merchant_account(text,public.app_role,text,text) from public,anon;
revoke execute on function public.admin_review_merchant(uuid,boolean) from public,anon;
revoke execute on function public.create_order(uuid,uuid,jsonb) from public,anon;
revoke execute on function public.update_order_status(uuid,text) from public,anon;
revoke execute on function public.admin_assign_captain(uuid,uuid) from public,anon;
grant execute on function public.request_merchant_account(text,public.app_role,text,text) to authenticated;
grant execute on function public.admin_review_merchant(uuid,boolean) to authenticated;
grant execute on function public.create_order(uuid,uuid,jsonb) to authenticated;
grant execute on function public.update_order_status(uuid,text) to authenticated;
grant execute on function public.admin_assign_captain(uuid,uuid) to authenticated;
