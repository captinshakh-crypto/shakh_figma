-- GeoJSON boundaries for delivery zones and server-side GPS coverage checks.
alter table public.service_zones add column if not exists boundary_geojson jsonb;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.service_zones'::regclass and conname='service_zones_boundary_geojson_shape_check') then
  alter table public.service_zones add constraint service_zones_boundary_geojson_shape_check check(boundary_geojson is null or (pg_catalog.jsonb_typeof(boundary_geojson)='object' and boundary_geojson->>'type'='Polygon' and pg_catalog.jsonb_typeof(boundary_geojson->'coordinates')='array' and pg_catalog.jsonb_typeof(boundary_geojson->'coordinates'->0)='array'));
 end if;
end $$;
create or replace function public.service_zone_contains_point(p_boundary_geojson jsonb,p_longitude double precision,p_latitude double precision)
returns boolean language plpgsql immutable parallel safe set search_path=''
as $$
declare v_ring jsonb;v_point jsonb;v_first jsonb;v_last jsonb;v_prev_x double precision;v_prev_y double precision;v_x double precision;v_y double precision;v_inside boolean:=false;
begin
 if p_boundary_geojson is null or p_boundary_geojson->>'type'<>'Polygon' or pg_catalog.jsonb_typeof(p_boundary_geojson->'coordinates')<>'array' then return false;end if;
 v_ring:=p_boundary_geojson->'coordinates'->0;
 if pg_catalog.jsonb_typeof(v_ring)<>'array' or pg_catalog.jsonb_array_length(v_ring)<4 then return false;end if;
 v_first:=v_ring->0;v_last:=v_ring->(pg_catalog.jsonb_array_length(v_ring)-1);
 if pg_catalog.jsonb_typeof(v_first)<>'array' or pg_catalog.jsonb_typeof(v_last)<>'array' or pg_catalog.jsonb_array_length(v_first)<2 or pg_catalog.jsonb_array_length(v_last)<2 or v_first->>0<>v_last->>0 or v_first->>1<>v_last->>1 then return false;end if;
 v_prev_x:=(v_last->>0)::double precision;v_prev_y:=(v_last->>1)::double precision;
 for v_point in select value from pg_catalog.jsonb_array_elements(v_ring) loop
  if pg_catalog.jsonb_typeof(v_point)<>'array' or pg_catalog.jsonb_array_length(v_point)<2 or pg_catalog.jsonb_typeof(v_point->0)<>'number' or pg_catalog.jsonb_typeof(v_point->1)<>'number' then return false;end if;
  v_x:=(v_point->>0)::double precision;v_y:=(v_point->>1)::double precision;
  if v_x not between -180 and 180 or v_y not between -90 and 90 then return false;end if;
  if ((v_y>p_latitude)<>(v_prev_y>p_latitude)) and (p_longitude<((v_prev_x-v_x)*(p_latitude-v_y)/nullif(v_prev_y-v_y,0)+v_x)) then v_inside:=not v_inside;end if;
  v_prev_x:=v_x;v_prev_y:=v_y;
 end loop;return v_inside;
exception when others then return false;
end $$;
revoke all on function public.service_zone_contains_point(jsonb,double precision,double precision) from public,anon;
grant execute on function public.service_zone_contains_point(jsonb,double precision,double precision) to authenticated;
create or replace function public.admin_save_service_zone_boundary(p_zone_id uuid,p_boundary_geojson jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare v_ring jsonb;v_first jsonb;v_last jsonb;v_point jsonb;v_count integer;v_x double precision;v_y double precision;
begin
 if not public.is_super_admin() then raise exception 'Super admin only';end if;
 if p_zone_id is null then raise exception 'Service zone is required';end if;
 if p_boundary_geojson is not null then
  if p_boundary_geojson->>'type'<>'Polygon' or pg_catalog.jsonb_typeof(p_boundary_geojson->'coordinates')<>'array' or pg_catalog.jsonb_array_length(p_boundary_geojson->'coordinates')<>1 then raise exception 'A single GeoJSON Polygon boundary is required';end if;
  v_ring:=p_boundary_geojson->'coordinates'->0;if pg_catalog.jsonb_typeof(v_ring)<>'array' then raise exception 'Invalid polygon coordinate ring';end if;
  v_count:=pg_catalog.jsonb_array_length(v_ring);if v_count<4 or v_count>1000 then raise exception 'A boundary needs at least three points and no more than 999 vertices';end if;
  v_first:=v_ring->0;v_last:=v_ring->(v_count-1);
  if pg_catalog.jsonb_typeof(v_first)<>'array' or pg_catalog.jsonb_typeof(v_last)<>'array' or pg_catalog.jsonb_array_length(v_first)<>2 or pg_catalog.jsonb_array_length(v_last)<>2 or v_first->>0<>v_last->>0 or v_first->>1<>v_last->>1 then raise exception 'The polygon must be closed by returning to the first point';end if;
  for v_point in select value from pg_catalog.jsonb_array_elements(v_ring) loop
   if pg_catalog.jsonb_typeof(v_point)<>'array' or pg_catalog.jsonb_array_length(v_point)<>2 or pg_catalog.jsonb_typeof(v_point->0)<>'number' or pg_catalog.jsonb_typeof(v_point->1)<>'number' then raise exception 'Invalid polygon vertex';end if;
   v_x:=(v_point->>0)::double precision;v_y:=(v_point->>1)::double precision;if v_x not between -180 and 180 or v_y not between -90 and 90 then raise exception 'Polygon vertex is outside valid GPS coordinates';end if;
  end loop;
 end if;
 update public.service_zones set boundary_geojson=p_boundary_geojson where id=p_zone_id;if not found then raise exception 'Service zone not found';end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details) values(auth.uid(),case when p_boundary_geojson is null then 'clear_service_zone_boundary' else 'save_service_zone_boundary' end,'service_zone',p_zone_id,jsonb_build_object('vertex_count',case when p_boundary_geojson is null then 0 else pg_catalog.jsonb_array_length(p_boundary_geojson->'coordinates'->0)-1 end));
end $$;
revoke all on function public.admin_save_service_zone_boundary(uuid,jsonb) from public,anon;
grant execute on function public.admin_save_service_zone_boundary(uuid,jsonb) to authenticated;
create or replace function public.create_multi_store_orders_with_location_v1(p_service_zone_id uuid,p_groups jsonb,p_delivery_address text,p_delivery_phone text,p_delivery_notes text default null,p_reward_campaign_id uuid default null,p_idempotency_key text default null,p_delivery_latitude double precision default null,p_delivery_longitude double precision default null)
returns uuid[] language plpgsql security definer set search_path=''
as $$
declare v_group jsonb;v_merchant_id uuid;v_merchant_text text;v_order_id uuid;v_order_ids uuid[]:=array[]::uuid[];v_seen_merchants uuid[]:=array[]::uuid[];v_seen_shakh_store boolean:=false;v_group_key text;v_group_count integer;v_boundary jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if public.current_app_role() not in('customer','super_admin') then raise exception 'Only customers can checkout';end if;
 if (p_delivery_latitude is null)<>(p_delivery_longitude is null) then raise exception 'Both delivery coordinates must be supplied together';end if;
 if p_delivery_latitude is not null and (p_delivery_latitude not between -90 and 90 or p_delivery_longitude not between -180 and 180) then raise exception 'Invalid delivery coordinates';end if;
 select z.boundary_geojson into v_boundary from public.service_zones z where z.id=p_service_zone_id and z.is_active=true;
 if not found then raise exception 'Delivery zone is unavailable';end if;
 if v_boundary is null then raise exception 'Delivery zone boundary is not configured yet. Please contact support.';end if;
 if p_delivery_latitude is null or p_delivery_longitude is null then raise exception 'Customer GPS location is required to check delivery coverage.';end if;
 if not public.service_zone_contains_point(v_boundary,p_delivery_longitude,p_delivery_latitude) then raise exception 'Delivery is not available at this location. The address is outside the selected service zone.';end if;
 if p_idempotency_key is null or length(p_idempotency_key)<16 or length(p_idempotency_key)>80 then raise exception 'A valid checkout request key is required';end if;
 if p_groups is null or pg_catalog.jsonb_typeof(p_groups)<>'array' then raise exception 'Checkout must contain store groups';end if;
 v_group_count:=pg_catalog.jsonb_array_length(p_groups);if v_group_count<1 or v_group_count>2 then raise exception 'One checkout can contain products from one or two stores';end if;
 if p_reward_campaign_id is not null and not exists(select 1 from public.reward_campaigns where id=p_reward_campaign_id and is_active=true) then raise exception 'Referral link is unavailable';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||':multi-store:'||p_idempotency_key,0));
 for v_group in select value from pg_catalog.jsonb_array_elements(p_groups) with ordinality as g(value,ord) order by ord loop
  if pg_catalog.jsonb_typeof(v_group)<>'object' or pg_catalog.jsonb_typeof(v_group->'items')<>'array' or pg_catalog.jsonb_array_length(v_group->'items')=0 then raise exception 'Each store must contain at least one product';end if;
  v_merchant_text:=v_group->>'merchant_id';
  if v_merchant_text is null then v_merchant_id:=null;if v_seen_shakh_store then raise exception 'Duplicate store group';end if;v_seen_shakh_store:=true;
  else begin v_merchant_id:=v_merchant_text::uuid;exception when invalid_text_representation then raise exception 'Invalid store identifier';end;if v_merchant_id=any(v_seen_merchants) then raise exception 'Duplicate store group';end if;v_seen_merchants:=pg_catalog.array_append(v_seen_merchants,v_merchant_id);end if;
  v_group_key:=p_idempotency_key||':store:'||case when v_merchant_id is null then 'shakh' else v_merchant_id::text end;
  v_order_id:=public.create_order_v2(v_merchant_id,p_service_zone_id,v_group->'items',p_delivery_address,p_delivery_phone,p_delivery_notes,p_reward_campaign_id,0,v_group_key);
  update public.orders set delivery_latitude=p_delivery_latitude,delivery_longitude=p_delivery_longitude where id=v_order_id and customer_id=auth.uid();
  v_order_ids:=pg_catalog.array_append(v_order_ids,v_order_id);
 end loop;return v_order_ids;
end $$;
revoke all on function public.create_multi_store_orders_with_location_v1(uuid,jsonb,text,text,text,uuid,text,double precision,double precision) from public,anon;
grant execute on function public.create_multi_store_orders_with_location_v1(uuid,jsonb,text,text,text,uuid,text,double precision,double precision) to authenticated;
revoke all on function public.create_multi_store_orders_v1(uuid,jsonb,text,text,text,uuid,text) from public,anon,authenticated;
