-- Capture the customer's delivery pin at checkout so captain routing can use exact coordinates.
alter table public.orders
  add column if not exists delivery_latitude double precision,
  add column if not exists delivery_longitude double precision;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_delivery_coordinates_pair_check'
  ) then
    alter table public.orders
      add constraint orders_delivery_coordinates_pair_check
      check (
        (delivery_latitude is null and delivery_longitude is null)
        or (
          delivery_latitude is not null
          and delivery_longitude is not null
          and delivery_latitude between -90 and 90
          and delivery_longitude between -180 and 180
        )
      );
  end if;
end;
$$;

create or replace function public.create_multi_store_orders_with_location_v1(
  p_service_zone_id uuid,
  p_groups jsonb,
  p_delivery_address text,
  p_delivery_phone text,
  p_delivery_notes text default null,
  p_reward_campaign_id uuid default null,
  p_idempotency_key text default null,
  p_delivery_latitude double precision default null,
  p_delivery_longitude double precision default null
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group jsonb;
  v_merchant_id uuid;
  v_merchant_text text;
  v_order_id uuid;
  v_order_ids uuid[] := array[]::uuid[];
  v_seen_merchants uuid[] := array[]::uuid[];
  v_seen_shakh_store boolean := false;
  v_group_key text;
  v_group_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.current_app_role() not in ('customer', 'super_admin') then
    raise exception 'Only customers can checkout';
  end if;

  if (p_delivery_latitude is null) <> (p_delivery_longitude is null) then
    raise exception 'Both delivery coordinates must be supplied together';
  end if;

  if p_delivery_latitude is not null and (
    p_delivery_latitude not between -90 and 90
    or p_delivery_longitude not between -180 and 180
  ) then
    raise exception 'Invalid delivery coordinates';
  end if;

  if p_idempotency_key is null
     or length(p_idempotency_key) < 16
     or length(p_idempotency_key) > 80 then
    raise exception 'A valid checkout request key is required';
  end if;

  if p_groups is null or jsonb_typeof(p_groups) <> 'array' then
    raise exception 'Checkout must contain store groups';
  end if;

  v_group_count := jsonb_array_length(p_groups);
  if v_group_count < 1 or v_group_count > 2 then
    raise exception 'One checkout can contain products from one or two stores';
  end if;

  if p_reward_campaign_id is not null then
    if not exists (
      select 1 from public.reward_campaigns
      where id = p_reward_campaign_id and is_active = true
    ) then
      raise exception 'Referral link is unavailable';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(auth.uid()::text || ':multi-store:' || p_idempotency_key, 0)
  );

  for v_group in
    select value from jsonb_array_elements(p_groups) with ordinality as g(value, ord)
    order by ord
  loop
    if jsonb_typeof(v_group) <> 'object'
       or jsonb_typeof(v_group->'items') <> 'array'
       or jsonb_array_length(v_group->'items') = 0 then
      raise exception 'Each store must contain at least one product';
    end if;

    v_merchant_text := v_group->>'merchant_id';
    if v_merchant_text is null then
      v_merchant_id := null;
      if v_seen_shakh_store then
        raise exception 'Duplicate store group';
      end if;
      v_seen_shakh_store := true;
    else
      begin
        v_merchant_id := v_merchant_text::uuid;
      exception when invalid_text_representation then
        raise exception 'Invalid store identifier';
      end;
      if v_merchant_id = any(v_seen_merchants) then
        raise exception 'Duplicate store group';
      end if;
      v_seen_merchants := array_append(v_seen_merchants, v_merchant_id);
    end if;

    v_group_key := p_idempotency_key || ':store:' ||
      case when v_merchant_id is null then 'shakh' else v_merchant_id::text end;

    v_order_id := public.create_order_v2(
      v_merchant_id,
      p_service_zone_id,
      v_group->'items',
      p_delivery_address,
      p_delivery_phone,
      p_delivery_notes,
      p_reward_campaign_id,
      0,
      v_group_key
    );

    update public.orders
    set delivery_latitude = p_delivery_latitude,
        delivery_longitude = p_delivery_longitude
    where id = v_order_id
      and customer_id = auth.uid();

    v_order_ids := array_append(v_order_ids, v_order_id);
  end loop;

  return v_order_ids;
end;
$function$;

revoke all on function public.create_multi_store_orders_with_location_v1(uuid, jsonb, text, text, text, uuid, text, double precision, double precision) from public, anon;
grant execute on function public.create_multi_store_orders_with_location_v1(uuid, jsonb, text, text, text, uuid, text, double precision, double precision) to authenticated;
