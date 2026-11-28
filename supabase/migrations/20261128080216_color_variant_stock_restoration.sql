-- Track which inventory balance checkout consumed, and restore the same balance on rejection/cancellation.
-- Color options use one shared product inventory; price and cost remain per color.
CREATE OR REPLACE FUNCTION public.create_order_v2(p_merchant_id uuid, p_service_zone_id uuid, p_items jsonb, p_delivery_address text, p_delivery_phone text, p_delivery_notes text DEFAULT NULL::text, p_reward_campaign_id uuid DEFAULT NULL::uuid, p_reward_amount_iqd bigint DEFAULT 0, p_idempotency_key text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order_id uuid;
  v_existing_customer uuid;
  v_subtotal bigint:=0;
  v_delivery bigint;
  v_total bigint;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_variant_id uuid;
  v_qty numeric(12,3);
  v_line bigint;
  v_price bigint;
  v_available_stock numeric(12,3);
  v_variant_snapshot jsonb;
  v_variant_text text;
  v_reward_total bigint:=0;
  v_merchant_commission bigint:=0;
  v_fixed_per_unit bigint:=0;
  v_reward_owner uuid;
  v_merchant_owner uuid;
  v_merchant_type public.app_role;
  v_prepaid_total bigint;
  v_rows integer;
  v_role public.app_role;
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
  if exists(
    select 1 from jsonb_array_elements(p_items) item
    group by item->>'product_id', coalesce(nullif(item->>'variant_id',''),'base')
    having count(*)>1
  ) then raise exception 'Duplicate product option lines are not allowed'; end if;
  if coalesce(p_reward_amount_iqd,0)<>0 then raise exception 'Referral rewards are paid by the merchant, not added to the customer total'; end if;
  if p_merchant_id is not null then
    select user_id,merchant_type into v_merchant_owner,v_merchant_type
    from public.merchant_profiles where id=p_merchant_id and approval_status='approved';
    if v_merchant_owner is null then raise exception 'Merchant is unavailable'; end if;
    select coalesce(fixed_commission_per_unit_iqd,0) into v_fixed_per_unit
    from public.commission_settings where merchant_type=v_merchant_type;
  else
    select id into v_merchant_owner from public.profiles
    where role='super_admin' and is_active=true order by created_at asc limit 1;
  end if;
  if v_merchant_owner is null then raise exception 'Store owner is unavailable'; end if;
  select delivery_fee_iqd into v_delivery from public.service_zones where id=p_service_zone_id and is_active=true;
  if v_delivery is null then raise exception 'Delivery zone is unavailable'; end if;
  if p_reward_campaign_id is not null then
    select owner_user_id into v_reward_owner from public.reward_campaigns
    where id=p_reward_campaign_id and is_active=true;
    if v_reward_owner is null then raise exception 'Referral link is unavailable'; end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if nullif(v_item->>'product_id','') is null then raise exception 'Invalid product'; end if;
    select * into v_product from public.products
    where id=(v_item->>'product_id')::uuid
      and merchant_id is not distinct from p_merchant_id
      and is_shakh_store=(p_merchant_id is null)
      and is_available=true
      and approval_status='approved'
    for update;
    if not found then raise exception 'A product is unavailable'; end if;
    v_variant_id:=nullif(v_item->>'variant_id','')::uuid;
    v_variant:=null;
    if v_variant_id is not null then
      select * into v_variant from public.product_variants
      where id=v_variant_id and product_id=v_product.id and is_active=true
      for update;
      if not found then raise exception 'The selected product option is unavailable'; end if;
      v_price:=v_variant.price_iqd;
      v_available_stock:=coalesce(v_product.stock_quantity,v_variant.stock_quantity);
    else
      if exists(select 1 from public.product_variants where product_id=v_product.id and is_active=true) then
        raise exception 'Select an option for: %',v_product.title;
      end if;
      v_price:=v_product.price_iqd;
      v_available_stock:=v_product.stock_quantity;
    end if;
    v_qty:=(v_item->>'quantity')::numeric;
    if v_qty is null or v_qty<=0 or v_qty>10000 then raise exception 'Invalid product quantity'; end if;
    if v_available_stock is not null and v_available_stock<v_qty then
      raise exception 'Insufficient product option stock for: %',v_product.title;
    end if;
    v_subtotal:=v_subtotal+round(v_price*v_qty)::bigint;
    if p_merchant_id is not null then
      v_merchant_commission:=v_merchant_commission+round(v_fixed_per_unit*v_qty)::bigint;
    end if;
    if p_reward_campaign_id is not null then
      v_reward_total:=v_reward_total+round(v_product.referral_commission_iqd*v_qty)::bigint;
    end if;
  end loop;

  -- All color options share a product-level stock balance.
  if exists (
    select 1
    from (
      select (item->>'product_id')::uuid as product_id,
             sum((item->>'quantity')::numeric) as requested_quantity
      from jsonb_array_elements(p_items) item
      group by (item->>'product_id')::uuid
    ) requested
    join public.products p on p.id=requested.product_id
    where p.stock_quantity is not null
      and requested.requested_quantity>p.stock_quantity
  ) then
    raise exception 'Insufficient shared product stock across selected colors';
  end if;

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

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
    where id=(v_item->>'product_id')::uuid
      and merchant_id is not distinct from p_merchant_id
      and is_shakh_store=(p_merchant_id is null)
      and is_available=true
      and approval_status='approved'
    for update;
    v_variant_id:=nullif(v_item->>'variant_id','')::uuid;
    v_variant:=null;
    if v_variant_id is not null then
      select * into v_variant from public.product_variants
      where id=v_variant_id and product_id=v_product.id and is_active=true
      for update;
      if not found then raise exception 'The selected product option is unavailable'; end if;
      v_price:=v_variant.price_iqd;
      v_available_stock:=coalesce(v_product.stock_quantity,v_variant.stock_quantity);
      v_variant_snapshot:=jsonb_build_object(
        'variant_id',v_variant.id,
        'label',v_variant.variant_label,
        'color_name',v_variant.color_name,
        'color_hex',v_variant.color_hex,
        'scent',v_variant.scent,
        'size_label',v_variant.size_label,
        'unit',coalesce(v_variant.unit,v_product.unit),
        'sku',v_variant.sku,
        'stock_source',case when v_product.stock_quantity is not null then 'product' else 'variant' end
      );
      v_variant_text:=concat_ws(' / ',nullif(v_variant.variant_label,''),nullif(v_variant.color_name,''),nullif(v_variant.scent,''),nullif(v_variant.size_label,''));
    else
      if exists(select 1 from public.product_variants where product_id=v_product.id and is_active=true) then
        raise exception 'Select an option for: %',v_product.title;
      end if;
      v_price:=v_product.price_iqd;
      v_available_stock:=v_product.stock_quantity;
      v_variant_snapshot:='{}'::jsonb;
      v_variant_text:=null;
    end if;
    v_qty:=(v_item->>'quantity')::numeric;
    v_line:=round(v_price*v_qty)::bigint;
    insert into public.order_items(
      order_id,product_id,product_title_snapshot,quantity,unit_price_iqd,line_total_iqd,
      referral_commission_snapshot_iqd,variant_id,variant_snapshot
    )
    values(
      v_order_id,v_product.id,
      case when v_variant_text is null then v_product.title else v_product.title||' — '||v_variant_text end,
      v_qty,v_price,v_line,
      case when p_reward_campaign_id is not null then v_product.referral_commission_iqd else 0 end,
      v_variant_id,v_variant_snapshot
    );
    if v_product.stock_quantity is not null then
      perform set_config('shakh.checkout_stock_update','on',true);
      update public.products set stock_quantity=stock_quantity-v_qty where id=v_product.id;
    elsif v_variant_id is not null and v_available_stock is not null then
      -- Preserve existing per-option stock only for legacy products without shared stock.
      update public.product_variants set stock_quantity=stock_quantity-v_qty,updated_at=now()
      where id=v_variant_id;
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
$function$;

revoke all on function public.create_order_v2(uuid,uuid,jsonb,text,text,text,uuid,bigint,text) from public, anon, authenticated;

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

  if p_status in ('delivered','cancelled','rejected') then
    delete from public.order_live_locations where order_id=p_order_id;
  end if;

  if p_status in ('rejected','cancelled') then
    -- Restore per-option stock only for legacy orders that consumed that option's own balance.
    update public.product_variants pv
    set stock_quantity=pv.stock_quantity+oi.quantity, updated_at=now()
    from public.order_items oi
    where oi.order_id=p_order_id and oi.variant_id=pv.id
      and pv.stock_quantity is not null
      and coalesce(oi.variant_snapshot->>'stock_source','variant')='variant';

    -- New color orders consume one shared product stock across every selected color.
    update public.products p
    set stock_quantity=p.stock_quantity+restored.quantity
    from (
      select oi.product_id,sum(oi.quantity) as quantity
      from public.order_items oi
      where oi.order_id=p_order_id
        and oi.variant_id is not null
        and oi.variant_snapshot->>'stock_source'='product'
      group by oi.product_id
    ) restored
    where p.id=restored.product_id and p.stock_quantity is not null;

    -- Products without options continue using their own product-level stock.
    update public.products p
    set stock_quantity=p.stock_quantity+oi.quantity
    from public.order_items oi
    where oi.order_id=p_order_id and oi.variant_id is null
      and oi.product_id=p.id and p.stock_quantity is not null;
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
