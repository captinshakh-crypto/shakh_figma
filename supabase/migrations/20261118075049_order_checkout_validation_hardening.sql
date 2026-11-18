CREATE OR REPLACE FUNCTION public.create_order_v2(p_merchant_id uuid, p_service_zone_id uuid, p_items jsonb, p_delivery_address text, p_delivery_phone text, p_delivery_notes text DEFAULT NULL::text, p_reward_campaign_id uuid DEFAULT NULL::uuid, p_reward_amount_iqd bigint DEFAULT 0, p_idempotency_key text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_order_id uuid;
  v_existing_customer uuid;
  v_subtotal bigint := 0;
  v_delivery bigint;
  v_total bigint;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty numeric(12,3);
  v_line bigint;
  v_campaign public.reward_campaigns%rowtype;
  v_role public.app_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_role := public.current_app_role();
  if v_role not in ('customer','super_admin') then raise exception 'Only customers can checkout'; end if;

  if nullif(trim(coalesce(p_delivery_address,'')), '') is null
     or length(trim(p_delivery_address)) < 8
     or length(trim(p_delivery_address)) > 500 then
    raise exception 'Enter a complete delivery address (8 to 500 characters)';
  end if;
  if p_delivery_phone is null
     or length(regexp_replace(p_delivery_phone, '[^0-9]', '', 'g')) < 7
     or length(regexp_replace(p_delivery_phone, '[^0-9]', '', 'g')) > 20
     or p_delivery_phone !~ '^[0-9+()[:space:]-]+$' then
    raise exception 'Enter a valid contact phone number';
  end if;
  if p_delivery_notes is not null and length(trim(p_delivery_notes)) > 500 then
    raise exception 'Delivery notes are too long';
  end if;

  if p_idempotency_key is null or length(p_idempotency_key) < 16 or length(p_idempotency_key) > 100 then
    raise exception 'A valid checkout request key is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_idempotency_key, 0));
  select id, customer_id into v_order_id, v_existing_customer
  from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if v_existing_customer <> auth.uid() then raise exception 'Checkout request key already used'; end if;
    return v_order_id;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Cart must be a JSON array';
  end if;
  if jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    group by item->>'product_id'
    having count(*) > 1
  ) then
    raise exception 'Duplicate product lines are not allowed';
  end if;

  if p_merchant_id is not null and not exists(
    select 1 from public.merchant_profiles
    where id=p_merchant_id and approval_status='approved'
  ) then
    raise exception 'Merchant is unavailable';
  end if;

  select delivery_fee_iqd into v_delivery
  from public.service_zones
  where id=p_service_zone_id and is_active=true;
  if v_delivery is null then raise exception 'Delivery zone is unavailable'; end if;

  if p_reward_campaign_id is null then
    if coalesce(p_reward_amount_iqd,0) <> 0 then
      raise exception 'Reward campaign is required for a reward amount';
    end if;
  else
    select * into v_campaign from public.reward_campaigns
    where id=p_reward_campaign_id and is_active=true;
    if not found then raise exception 'Reward campaign is unavailable'; end if;
    if coalesce(p_reward_amount_iqd,0) <> v_campaign.reward_amount_iqd then
      raise exception 'Reward amount does not match campaign';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if nullif(v_item->>'product_id','') is null then raise exception 'Invalid product'; end if;
    select * into v_product from public.products
    where id=(v_item->>'product_id')::uuid
      and merchant_id is not distinct from p_merchant_id
      and is_shakh_store=(p_merchant_id is null)
      and is_available=true
    for update;
    if not found then raise exception 'A product is unavailable'; end if;
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 10000 then raise exception 'Invalid product quantity'; end if;
    if v_product.stock_quantity is not null and v_product.stock_quantity < v_qty then
      raise exception 'Insufficient product stock for: %', v_product.title;
    end if;
    v_subtotal := v_subtotal + round(v_product.price_iqd*v_qty)::bigint;
  end loop;

  v_total := v_subtotal + v_delivery + coalesce(p_reward_amount_iqd,0);
  insert into public.orders(
    customer_id,merchant_id,service_zone_id,subtotal_iqd,delivery_fee_iqd,
    reward_campaign_id,reward_amount_iqd,total_iqd,status,
    delivery_address,delivery_phone,delivery_notes,idempotency_key
  )
  values(
    auth.uid(),p_merchant_id,p_service_zone_id,v_subtotal,v_delivery,
    p_reward_campaign_id,coalesce(p_reward_amount_iqd,0),v_total,'placed',
    trim(p_delivery_address),trim(p_delivery_phone),nullif(trim(coalesce(p_delivery_notes,'')),''),p_idempotency_key
  )
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
      update public.products
      set stock_quantity=stock_quantity-v_qty
      where id=v_product.id;
    end if;
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
;

CREATE OR REPLACE FUNCTION public.update_order_status(p_order_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    when 'ready_for_pickup' then 'داواکارییەکەت ئامادەی وەرگرتنی کپتنە.'
    when 'picked_up' then 'کپتن داواکارییەکەت وەرگرت.'
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
$function$
;
