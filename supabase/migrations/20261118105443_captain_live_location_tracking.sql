-- Store only the latest captain location for each active delivery.
-- Location writes are RPC-only; participant reads are enforced by RLS.
create table public.order_live_locations (
  order_id uuid primary key references public.orders(id) on delete cascade,
  captain_user_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m between 0 and 10000),
  updated_at timestamptz not null default now()
);
create index order_live_locations_captain_updated_idx on public.order_live_locations(captain_user_id,updated_at desc);
alter table public.order_live_locations enable row level security;
revoke all on table public.order_live_locations from public,anon,authenticated;
grant select on table public.order_live_locations to authenticated;
create policy order_live_locations_read_participant on public.order_live_locations for select to authenticated using (
 exists(select 1 from public.orders o where o.id=order_live_locations.order_id
  and (o.customer_id=(select auth.uid()) or o.captain_user_id=(select auth.uid())
   or (select public.is_super_admin())
   or exists(select 1 from public.merchant_profiles m where m.id=o.merchant_id and m.user_id=(select auth.uid()))))
);

create or replace function public.update_captain_live_location(
 p_order_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_m double precision default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_order public.orders%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if public.current_app_role()<>'captain' then raise exception 'Only an active captain can share live location'; end if;
 if p_latitude is null or p_latitude not between -90 and 90 then raise exception 'Invalid latitude'; end if;
 if p_longitude is null or p_longitude not between -180 and 180 then raise exception 'Invalid longitude'; end if;
 if p_accuracy_m is not null and (p_accuracy_m<0 or p_accuracy_m>10000) then raise exception 'Invalid GPS accuracy'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.captain_user_id is distinct from auth.uid() then raise exception 'You are not the captain assigned to this order'; end if;
 if v_order.status not in ('assigned','picked_up') then raise exception 'Live location is available only during an active delivery'; end if;
 insert into public.order_live_locations(order_id,captain_user_id,latitude,longitude,accuracy_m,updated_at)
 values(p_order_id,auth.uid(),p_latitude,p_longitude,p_accuracy_m,now())
 on conflict(order_id) do update set captain_user_id=excluded.captain_user_id,latitude=excluded.latitude,
 longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,updated_at=now()
 where public.order_live_locations.captain_user_id=auth.uid();
 if not found then raise exception 'Live location belongs to a different captain'; end if;
end;
$fn$;
revoke all on function public.update_captain_live_location(uuid,double precision,double precision,double precision) from public,anon;
grant execute on function public.update_captain_live_location(uuid,double precision,double precision,double precision) to authenticated;

create or replace function public.clear_captain_live_location(p_order_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if public.current_app_role()<>'captain' then raise exception 'Only an active captain can stop location sharing'; end if;
 delete from public.order_live_locations where order_id=p_order_id and captain_user_id=auth.uid();
end;
$fn$;
revoke all on function public.clear_captain_live_location(uuid) from public,anon;
grant execute on function public.clear_captain_live_location(uuid) to authenticated;

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

  -- Stop and remove captain location sharing as soon as delivery ends or is cancelled.
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

CREATE OR REPLACE FUNCTION public.admin_assign_captain(p_order_id uuid, p_captain_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_order public.orders%rowtype;
  v_type public.captain_type;
  v_merchant_id uuid;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;

  select cp.captain_type,cp.merchant_id
  into v_type,v_merchant_id
  from public.captain_profiles cp
  join public.profiles p on p.id=cp.user_id
  where cp.user_id=p_captain_user_id
    and cp.is_active=true
    and p.role='captain'
    and p.is_active=true;

  if not found then raise exception 'Captain account is not active or has no approved captain type'; end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status <> 'ready_for_pickup' then
    raise exception 'Order must be ready for pickup before captain assignment';
  end if;

  if v_type='merchant' and v_merchant_id is distinct from v_order.merchant_id then
    raise exception 'This captain is restricted to a different store';
  end if;

  update public.orders
  set captain_user_id=p_captain_user_id,status='assigned'
  where id=p_order_id;

  delete from public.order_live_locations where order_id=p_order_id;

  insert into public.order_status_history(order_id,from_status,to_status,changed_by,actor_role,note)
  values(p_order_id,'ready_for_pickup','assigned',auth.uid(),'super_admin','Captain assigned');

  insert into public.notifications(user_id,title,body,kind)
  values(p_captain_user_id,'گەیاندنی نوێت هەیە','داواکارییەکی نوێت بۆ گەیاندن دیاریکرا.','delivery_assigned');

  insert into public.notifications(user_id,title,body,kind)
  values(v_order.customer_id,'کپتن دیاریکرا','کپتن بۆ گەیاندنی داواکارییەکەت دیاریکرا.','captain_assigned');
end;
$function$
;

do $pub$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='order_live_locations') then
  execute 'alter publication supabase_realtime add table public.order_live_locations';
 end if;
end; $pub$;
