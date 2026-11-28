-- Add concentric circular delivery zones while preserving existing polygon zones.
alter table public.service_zones
  add column if not exists zone_type text not null default 'polygon',
  add column if not exists circle_center_latitude double precision,
  add column if not exists circle_center_longitude double precision,
  add column if not exists circle_outer_radius_m integer,
  add column if not exists circle_ring_order integer;

do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.service_zones'::regclass and conname='service_zones_zone_type_check') then
    alter table public.service_zones add constraint service_zones_zone_type_check check(zone_type in ('polygon','circle'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.service_zones'::regclass and conname='service_zones_circle_config_check') then
    alter table public.service_zones add constraint service_zones_circle_config_check check(
      (zone_type='polygon' and circle_center_latitude is null and circle_center_longitude is null and circle_outer_radius_m is null and circle_ring_order is null)
      or
      (zone_type='circle' and boundary_geojson is null
        and circle_center_latitude between -90 and 90
        and circle_center_longitude between -180 and 180
        and circle_outer_radius_m between 1 and 100000
        and circle_ring_order>=1)
    );
  end if;
end $$;

create unique index if not exists service_zones_circle_ring_order_uidx
  on public.service_zones(circle_ring_order) where zone_type='circle';
create index if not exists service_zones_circle_center_radius_idx
  on public.service_zones(circle_center_latitude,circle_center_longitude,circle_outer_radius_m)
  where zone_type='circle';

CREATE OR REPLACE FUNCTION public.service_zone_circle_contains_point(p_center_latitude double precision, p_center_longitude double precision, p_inner_radius_m integer, p_outer_radius_m integer, p_delivery_latitude double precision, p_delivery_longitude double precision)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
declare
  v_lat1 double precision; v_lat2 double precision;
  v_delta_lat double precision; v_delta_lon double precision;
  v_a double precision; v_distance_m double precision;
begin
  if p_center_latitude is null or p_center_longitude is null or p_inner_radius_m is null
    or p_outer_radius_m is null or p_delivery_latitude is null or p_delivery_longitude is null then return false; end if;
  if p_center_latitude not between -90 and 90 or p_center_longitude not between -180 and 180
    or p_delivery_latitude not between -90 and 90 or p_delivery_longitude not between -180 and 180
    or p_inner_radius_m<0 or p_outer_radius_m<=p_inner_radius_m then return false; end if;
  v_lat1:=pg_catalog.radians(p_center_latitude);
  v_lat2:=pg_catalog.radians(p_delivery_latitude);
  v_delta_lat:=pg_catalog.radians(p_delivery_latitude-p_center_latitude);
  v_delta_lon:=pg_catalog.radians(p_delivery_longitude-p_center_longitude);
  v_a:=pg_catalog.sin(v_delta_lat/2)^2+pg_catalog.cos(v_lat1)*pg_catalog.cos(v_lat2)*pg_catalog.sin(v_delta_lon/2)^2;
  v_distance_m:=2*6371008.8*pg_catalog.asin(least(1,pg_catalog.sqrt(greatest(0,v_a))));
  return v_distance_m>=p_inner_radius_m and v_distance_m<=p_outer_radius_m;
exception when others then return false;
end
$function$;

revoke all on function public.service_zone_circle_contains_point(double precision,double precision,integer,integer,double precision,double precision) from public,anon;
grant execute on function public.service_zone_circle_contains_point(double precision,double precision,integer,integer,double precision,double precision) to authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_service_zone_circle(p_zone_id uuid DEFAULT NULL::uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_delivery_fee_iqd bigint DEFAULT NULL::bigint, p_shakh_share_iqd bigint DEFAULT NULL::bigint, p_captain_share_iqd bigint DEFAULT NULL::bigint, p_is_active boolean DEFAULT true, p_center_latitude double precision DEFAULT NULL::double precision, p_center_longitude double precision DEFAULT NULL::double precision, p_outer_radius_m integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_zone_id uuid; v_existing public.service_zones%rowtype;
  v_ring_order integer; v_inner_radius_m integer; v_other_count integer;
  v_existing_center_lat double precision; v_existing_center_lon double precision;
  v_action text;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  if nullif(trim(coalesce(p_name,'')),'') is null or length(trim(p_name))>120 then raise exception 'Zone name is required and must be at most 120 characters'; end if;
  if p_description is not null and length(trim(p_description))>500 then raise exception 'Zone description is too long'; end if;
  if p_delivery_fee_iqd is null or p_delivery_fee_iqd<0 or p_shakh_share_iqd is null or p_shakh_share_iqd<0 or p_captain_share_iqd is null or p_captain_share_iqd<0 then raise exception 'Delivery fee and shares must be zero or greater'; end if;
  if p_shakh_share_iqd>p_delivery_fee_iqd or p_captain_share_iqd<>p_delivery_fee_iqd-p_shakh_share_iqd then raise exception 'SHAKH share plus captain share must equal the delivery fee'; end if;
  if p_is_active is null then raise exception 'Zone active status is required'; end if;
  if p_center_latitude is null or p_center_longitude is null or p_center_latitude not between -90 and 90 or p_center_longitude not between -180 and 180 then raise exception 'Select the shop center on the map'; end if;
  if p_outer_radius_m is null or p_outer_radius_m<1 or p_outer_radius_m>100000 then raise exception 'Outer radius must be between 1 and 100000 meters'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shakh-circular-delivery-zones',0));
  if p_zone_id is not null then
    select * into v_existing from public.service_zones where id=p_zone_id for update;
    if not found then raise exception 'Service zone not found'; end if;
    if v_existing.zone_type='circle' then v_ring_order:=v_existing.circle_ring_order; end if;
  end if;

  select count(*) into v_other_count from public.service_zones z where z.zone_type='circle' and z.id is distinct from p_zone_id;
  if v_other_count>0 then
    select z.circle_center_latitude,z.circle_center_longitude into v_existing_center_lat,v_existing_center_lon
    from public.service_zones z where z.zone_type='circle' and z.id is distinct from p_zone_id order by z.circle_ring_order limit 1;
    if abs(v_existing_center_lat-p_center_latitude)>0.0000001 or abs(v_existing_center_lon-p_center_longitude)>0.0000001 then
      raise exception 'All circular delivery zones must use the same shop center';
    end if;
  end if;

  if v_ring_order is null then
    select coalesce(max(circle_ring_order),0)+1 into v_ring_order from public.service_zones where zone_type='circle';
  end if;
  select coalesce(max(circle_outer_radius_m),0)::integer into v_inner_radius_m
  from public.service_zones where zone_type='circle' and circle_ring_order<v_ring_order;
  if p_outer_radius_m<=v_inner_radius_m then raise exception 'The outer radius must be greater than the previous circular zone end (% meters)',v_inner_radius_m; end if;
  if exists(select 1 from public.service_zones later where later.zone_type='circle' and later.circle_ring_order>v_ring_order and later.circle_outer_radius_m<=p_outer_radius_m) then
    raise exception 'This radius would cross the next circular zone boundary';
  end if;

  if p_zone_id is null then
    insert into public.service_zones(name,description,delivery_fee_iqd,shakh_delivery_share_iqd,captain_delivery_share_iqd,is_active,boundary_geojson,zone_type,circle_center_latitude,circle_center_longitude,circle_outer_radius_m,circle_ring_order)
    values(trim(p_name),nullif(trim(coalesce(p_description,'')),''),p_delivery_fee_iqd,p_shakh_share_iqd,p_captain_share_iqd,p_is_active,null,'circle',p_center_latitude,p_center_longitude,p_outer_radius_m,v_ring_order)
    returning id into v_zone_id;
    v_action:='create_circular_service_zone';
  else
    update public.service_zones set name=trim(p_name),description=nullif(trim(coalesce(p_description,'')),''),
      delivery_fee_iqd=p_delivery_fee_iqd,shakh_delivery_share_iqd=p_shakh_share_iqd,captain_delivery_share_iqd=p_captain_share_iqd,
      is_active=p_is_active,boundary_geojson=null,zone_type='circle',circle_center_latitude=p_center_latitude,
      circle_center_longitude=p_center_longitude,circle_outer_radius_m=p_outer_radius_m,circle_ring_order=v_ring_order
    where id=p_zone_id returning id into v_zone_id;
    v_action:='update_circular_service_zone';
  end if;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),v_action,'service_zone',v_zone_id,jsonb_build_object(
    'name',trim(p_name),'zone_type','circle','circle_center_latitude',p_center_latitude,'circle_center_longitude',p_center_longitude,
    'circle_inner_radius_m',v_inner_radius_m,'circle_outer_radius_m',p_outer_radius_m,'circle_ring_order',v_ring_order,
    'delivery_fee_iqd',p_delivery_fee_iqd,'shakh_delivery_share_iqd',p_shakh_share_iqd,
    'captain_delivery_share_iqd',p_captain_share_iqd,'is_active',p_is_active
  ));
  return v_zone_id;
end
$function$;

revoke all on function public.admin_save_service_zone_circle(uuid,text,text,bigint,bigint,bigint,boolean,double precision,double precision,integer) from public,anon;
grant execute on function public.admin_save_service_zone_circle(uuid,text,text,bigint,bigint,bigint,boolean,double precision,double precision,integer) to authenticated;

CREATE OR REPLACE FUNCTION public.create_multi_store_orders_with_location_v1(p_service_zone_id uuid, p_groups jsonb, p_delivery_address text, p_delivery_phone text, p_delivery_notes text DEFAULT NULL::text, p_reward_campaign_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text, p_delivery_latitude double precision DEFAULT NULL::double precision, p_delivery_longitude double precision DEFAULT NULL::double precision)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_boundary jsonb;
  v_zone public.service_zones%rowtype;
  v_inner_radius_m integer;
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

  select z.boundary_geojson into v_boundary
  from public.service_zones z
  where z.id = p_service_zone_id and z.is_active = true;

  if not found then
    raise exception 'Delivery zone is unavailable';
  end if;

  if v_boundary is null then
    raise exception 'Delivery zone boundary is not configured yet. Please contact support.';
  end if;

  if p_delivery_latitude is null or p_delivery_longitude is null then
    raise exception 'Customer GPS location is required to check delivery coverage.';
  end if;

  if not public.service_zone_contains_point(v_boundary, p_delivery_longitude, p_delivery_latitude) then
    raise exception 'Delivery is not available at this location. The address is outside the selected service zone.';
  end if;

  if p_idempotency_key is null
     or length(p_idempotency_key) < 16
     or length(p_idempotency_key) > 80 then
    raise exception 'A valid checkout request key is required';
  end if;

  if p_groups is null or pg_catalog.jsonb_typeof(p_groups) <> 'array' then
    raise exception 'Checkout must contain store groups';
  end if;

  v_group_count := pg_catalog.jsonb_array_length(p_groups);
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text || ':multi-store:' || p_idempotency_key, 0)
  );

  for v_group in
    select value from pg_catalog.jsonb_array_elements(p_groups) with ordinality as g(value, ord)
    order by ord
  loop
    if pg_catalog.jsonb_typeof(v_group) <> 'object'
       or pg_catalog.jsonb_typeof(v_group->'items') <> 'array'
       or pg_catalog.jsonb_array_length(v_group->'items') = 0 then
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
      v_seen_merchants := pg_catalog.array_append(v_seen_merchants, v_merchant_id);
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

    v_order_ids := pg_catalog.array_append(v_order_ids, v_order_id);
  end loop;

  return v_order_ids;
end;
$function$;

revoke all on function public.create_multi_store_orders_with_location_v1(uuid,jsonb,text,text,text,uuid,text,double precision,double precision) from public,anon;
grant execute on function public.create_multi_store_orders_with_location_v1(uuid,jsonb,text,text,text,uuid,text,double precision,double precision) to authenticated;

comment on column public.service_zones.circle_outer_radius_m is 'Outer radius in meters for a concentric delivery ring; its inner edge is the previous ring outer radius.';
comment on column public.service_zones.circle_ring_order is 'Sequential order of concentric delivery rings sharing one shop center.';
