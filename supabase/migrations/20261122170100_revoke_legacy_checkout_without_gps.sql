-- Prevent coordinate-free legacy checkout paths from bypassing the zone boundary.
revoke all on function public.create_order_v2(uuid,uuid,jsonb,text,text,text,uuid,bigint,text) from public,anon,authenticated;
revoke all on function public.create_shakh_store_order_v2(uuid,jsonb,text,text,text,uuid,bigint,text) from public,anon,authenticated;

-- Treat points exactly on a service-zone edge as inside.
create or replace function public.service_zone_contains_point(
 p_boundary_geojson jsonb,p_longitude double precision,p_latitude double precision
)
returns boolean
language plpgsql
immutable
parallel safe
set search_path=''
as $function$
declare
 v_ring jsonb; v_point jsonb; v_first jsonb; v_last jsonb;
 v_prev_x double precision; v_prev_y double precision; v_x double precision; v_y double precision;
 v_min_x double precision; v_max_x double precision; v_min_y double precision; v_max_y double precision;
 v_cross double precision; v_inside boolean:=false;
begin
 if p_boundary_geojson is null or p_boundary_geojson->>'type'<>'Polygon'
   or pg_catalog.jsonb_typeof(p_boundary_geojson->'coordinates')<>'array' then return false; end if;
 v_ring:=p_boundary_geojson->'coordinates'->0;
 if pg_catalog.jsonb_typeof(v_ring)<>'array' or pg_catalog.jsonb_array_length(v_ring)<4 then return false; end if;
 v_first:=v_ring->0; v_last:=v_ring->(pg_catalog.jsonb_array_length(v_ring)-1);
 if pg_catalog.jsonb_typeof(v_first)<>'array' or pg_catalog.jsonb_typeof(v_last)<>'array'
   or pg_catalog.jsonb_array_length(v_first)<2 or pg_catalog.jsonb_array_length(v_last)<2
   or v_first->>0<>v_last->>0 or v_first->>1<>v_last->>1 then return false; end if;
 v_prev_x:=(v_last->>0)::double precision; v_prev_y:=(v_last->>1)::double precision;
 for v_point in select value from pg_catalog.jsonb_array_elements(v_ring) loop
  if pg_catalog.jsonb_typeof(v_point)<>'array' or pg_catalog.jsonb_array_length(v_point)<2
    or pg_catalog.jsonb_typeof(v_point->0)<>'number' or pg_catalog.jsonb_typeof(v_point->1)<>'number' then return false; end if;
  v_x:=(v_point->>0)::double precision; v_y:=(v_point->>1)::double precision;
  if v_x not between -180 and 180 or v_y not between -90 and 90 then return false; end if;
  v_cross:=(p_longitude-v_prev_x)*(v_y-v_prev_y)-(p_latitude-v_prev_y)*(v_x-v_prev_x);
  v_min_x:=case when v_prev_x<v_x then v_prev_x else v_x end;
  v_max_x:=case when v_prev_x>v_x then v_prev_x else v_x end;
  v_min_y:=case when v_prev_y<v_y then v_prev_y else v_y end;
  v_max_y:=case when v_prev_y>v_y then v_prev_y else v_y end;
  if pg_catalog.abs(v_cross)<1e-10 and p_longitude>=v_min_x and p_longitude<=v_max_x
    and p_latitude>=v_min_y and p_latitude<=v_max_y then return true; end if;
  if ((v_y>p_latitude)<>(v_prev_y>p_latitude))
    and (p_longitude<((v_prev_x-v_x)*(p_latitude-v_y)/nullif(v_prev_y-v_y,0)+v_x)) then v_inside:=not v_inside; end if;
  v_prev_x:=v_x; v_prev_y:=v_y;
 end loop;
 return v_inside;
exception when others then return false;
end;
$function$;
