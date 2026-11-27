-- SHAKH phone, store operating hours, captain pledge and order batch actions.
-- Additive migration. Apply to production only after verified backup and restore test.

-- Mandatory mobile number for new email accounts; OAuth users finish their phone after callback.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_phone text := nullif(btrim(coalesce(new.raw_user_meta_data->>'phone','')), '');
  v_provider text := coalesce(new.raw_app_meta_data->>'provider','email');
begin
  if v_provider = 'email' and (
    v_phone is null or v_phone !~ '^\+?(964)?0?7[0-9]{9}$'
  ) then
    raise exception 'A valid Iraqi mobile number is required to create an email account';
  end if;

  insert into public.profiles(id,email,full_name,phone,role)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),v_phone,'customer')
  on conflict(id) do update
    set phone=coalesce(public.profiles.phone,excluded.phone),
        email=coalesce(excluded.email,public.profiles.email);

  insert into public.wallets(user_id,balance_iqd)
  values(new.id,0) on conflict(user_id) do nothing;
  return new;
end;
$function$;

create or replace function public.complete_my_phone(p_phone text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_phone text := btrim(coalesce(p_phone,''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_phone !~ '^\+?(964)?0?7[0-9]{9}$' then
    raise exception 'Enter a valid Iraqi mobile number, for example 0750XXXXXXX';
  end if;
  update public.profiles set phone=v_phone,updated_at=now()
  where id=auth.uid() and is_active=true;
  if not found then raise exception 'Active profile not found'; end if;
end;
$function$;
revoke all on function public.complete_my_phone(text) from public,anon;
grant execute on function public.complete_my_phone(text) to authenticated;

-- Store schedule and temporary closure switch; days use ISO weekday numbers 1=Mon ... 7=Sun.
alter table public.merchant_profiles
  add column if not exists opening_time time not null default '00:00'::time,
  add column if not exists closing_time time not null default '23:59'::time,
  add column if not exists opening_days smallint[] not null default array[1,2,3,4,5,6,7]::smallint[],
  add column if not exists is_manually_closed boolean not null default false;

do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.merchant_profiles'::regclass and conname='merchant_profiles_opening_days_valid') then
    alter table public.merchant_profiles add constraint merchant_profiles_opening_days_valid
    check(cardinality(opening_days) between 1 and 7 and opening_days <@ array[1,2,3,4,5,6,7]::smallint[]);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.merchant_profiles'::regclass and conname='merchant_profiles_opening_time_differs') then
    alter table public.merchant_profiles add constraint merchant_profiles_opening_time_differs
    check(opening_time <> closing_time);
  end if;
end;
$$;

create or replace function public.merchant_store_is_open_now(p_merchant_id uuid,p_at timestamptz default now())
returns boolean language plpgsql stable security definer set search_path=''
as $function$
declare
  v_open time; v_close time; v_days smallint[]; v_closed boolean;
  v_local timestamp; v_day integer; v_previous_day integer;
begin
  select opening_time,closing_time,opening_days,is_manually_closed
  into v_open,v_close,v_days,v_closed
  from public.merchant_profiles where id=p_merchant_id and approval_status='approved';
  if not found or coalesce(v_closed,true) then return false; end if;

  v_local := p_at at time zone 'Asia/Baghdad';
  v_day := extract(isodow from v_local)::integer;
  v_previous_day := case when v_day=1 then 7 else v_day-1 end;

  if v_open < v_close then
    return v_day=any(v_days) and v_local::time >= v_open and v_local::time < v_close;
  elsif v_open > v_close then
    return (v_day=any(v_days) and v_local::time >= v_open)
      or (v_previous_day=any(v_days) and v_local::time < v_close);
  end if;
  return v_day=any(v_days);
end;
$function$;
revoke all on function public.merchant_store_is_open_now(uuid,timestamptz) from public,anon,authenticated;

create or replace function public.update_my_store_hours(
  p_opening_time time,p_closing_time time,p_opening_days smallint[],p_is_manually_closed boolean
)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_merchant_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_opening_time is null or p_closing_time is null or p_opening_time=p_closing_time then
    raise exception 'Opening and closing times must be different';
  end if;
  if p_opening_days is null or cardinality(p_opening_days) not between 1 and 7
    or not (p_opening_days <@ array[1,2,3,4,5,6,7]::smallint[])
    or cardinality(p_opening_days) <> (select count(distinct d) from unnest(p_opening_days) as days(d)) then
    raise exception 'Choose at least one valid opening day';
  end if;

  update public.merchant_profiles
  set opening_time=p_opening_time,closing_time=p_closing_time,
      opening_days=p_opening_days,is_manually_closed=coalesce(p_is_manually_closed,false)
  where user_id=auth.uid() and approval_status='approved'
  returning id into v_merchant_id;
  if v_merchant_id is null then raise exception 'Approved store profile not found'; end if;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'update_store_hours','merchant_profile',v_merchant_id,
    jsonb_build_object('opening_time',p_opening_time,'closing_time',p_closing_time,
      'opening_days',p_opening_days,'is_manually_closed',coalesce(p_is_manually_closed,false)));
end;
$function$;
revoke all on function public.update_my_store_hours(time,time,smallint[],boolean) from public,anon;
grant execute on function public.update_my_store_hours(time,time,smallint[],boolean) to authenticated;

create or replace function private.guard_merchant_store_hours()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if new.merchant_id is not null and not public.merchant_store_is_open_now(new.merchant_id,now()) then
    raise exception 'This store is currently closed. Please place the order during its opening hours.';
  end if;
  return new;
end;
$function$;
drop trigger if exists orders_require_store_open on public.orders;
create trigger orders_require_store_open before insert on public.orders
for each row execute function private.guard_merchant_store_hours();

-- One transaction for multi-order rejection. Each order still runs the established rejection triggers.
create or replace function public.merchant_reject_orders(p_order_ids uuid[])
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_merchant_id uuid; v_order_id uuid; v_total integer:=0; v_found integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into v_merchant_id from public.merchant_profiles
  where user_id=auth.uid() and approval_status='approved' and merchant_type=public.current_app_role()
  for update;
  if v_merchant_id is null then raise exception 'Approved store owner only'; end if;
  if p_order_ids is null or cardinality(p_order_ids) not between 1 and 100 then
    raise exception 'Select between 1 and 100 pending orders';
  end if;
  if cardinality(p_order_ids) <> (select count(distinct id) from unnest(p_order_ids) as selected(id)) then
    raise exception 'Duplicate order identifiers are not allowed';
  end if;
  select count(*) into v_found from public.orders
  where id=any(p_order_ids) and merchant_id=v_merchant_id and status='placed';
  if v_found <> cardinality(p_order_ids) then
    raise exception 'Every selected order must belong to your store and still be pending';
  end if;
  for v_order_id in
    select o.id from public.orders o
    where o.id=any(p_order_ids) and o.merchant_id=v_merchant_id and o.status='placed'
    order by o.placed_at,o.id for update
  loop
    perform public.update_order_status(v_order_id,'rejected');
    v_total:=v_total+1;
  end loop;
  return v_total;
end;
$function$;
revoke all on function public.merchant_reject_orders(uuid[]) from public,anon;
grant execute on function public.merchant_reject_orders(uuid[]) to authenticated;

-- Captain ID number: only the captain and active Super Admin can read it.
create table if not exists public.captain_identity_details (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  national_id_number text not null check(length(trim(national_id_number)) between 6 and 30),
  updated_at timestamptz not null default now()
);
alter table public.captain_identity_details enable row level security;
drop policy if exists captain_identity_read_own_or_admin on public.captain_identity_details;
create policy captain_identity_read_own_or_admin on public.captain_identity_details
for select to authenticated using (
  user_id=(select auth.uid()) or exists(
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='super_admin' and p.is_active=true
  )
);
revoke all on table public.captain_identity_details from anon,authenticated;
grant select on table public.captain_identity_details to authenticated;

create or replace function public.update_my_captain_identity(p_national_id_number text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_id text:=upper(regexp_replace(trim(coalesce(p_national_id_number,'')),'[[:space:]]+','','g'));
  v_role public.app_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id=auth.uid() and is_active=true;
  if not found or v_role not in ('customer','captain') then
    raise exception 'Captain identity can only be submitted by a customer or captain';
  end if;
  if length(v_id) not between 6 and 30 or v_id !~ '^[A-Z0-9-]+$' then
    raise exception 'Enter a valid national identity number (6 to 30 letters or digits)';
  end if;
  insert into public.captain_identity_details(user_id,national_id_number,updated_at)
  values(auth.uid(),v_id,now())
  on conflict(user_id) do update set national_id_number=excluded.national_id_number,updated_at=now();
  insert into public.audit_logs(actor_user_id,action,entity_type,details)
  values(auth.uid(),'update_captain_identity','captain_identity',jsonb_build_object('identity_number_updated',true));
end;
$function$;
revoke all on function public.update_my_captain_identity(text) from public,anon;
grant execute on function public.update_my_captain_identity(text) to authenticated;

alter table public.captain_applications
  add column if not exists pledge_version text,
  add column if not exists pledge_full_name text,
  add column if not exists pledge_accepted_at timestamptz,
  add column if not exists pledge_terms jsonb;

create or replace function public.request_captain_application_with_pledge(
  p_captain_type public.captain_type,
  p_merchant_id uuid default null,
  p_note text default null,
  p_national_id_number text default null,
  p_pledge_full_name text default null,
  p_pledge_terms jsonb default null
)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare
  v_id uuid; v_role public.app_role; v_phone text; v_identity text;
  v_terms jsonb:=coalesce(p_pledge_terms,'{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role,phone into v_role,v_phone from public.profiles where id=auth.uid() and is_active=true;
  if not found or v_role<>'customer' then raise exception 'Only active customer accounts can apply to become a captain'; end if;
  if coalesce(v_phone,'') !~ '^\+?(964)?0?7[0-9]{9}$' then
    raise exception 'Add your mobile number to your profile before applying';
  end if;
  if exists(select 1 from public.captain_profiles where user_id=auth.uid() and is_active) then
    raise exception 'An active captain profile already exists';
  end if;
  if exists(select 1 from public.captain_applications where user_id=auth.uid() and status='pending') then
    raise exception 'A captain application is already pending';
  end if;

  if p_captain_type='shakh' then
    if p_merchant_id is not null then raise exception 'SHAKH captain applications cannot be linked to a store'; end if;
  elsif p_captain_type='merchant' then
    if p_merchant_id is null or not exists(select 1 from public.merchant_profiles where id=p_merchant_id and approval_status='approved') then
      raise exception 'Choose an approved store';
    end if;
  else raise exception 'Invalid captain type';
  end if;

  v_identity:=upper(regexp_replace(trim(coalesce(p_national_id_number,'')),'[[:space:]]+','','g'));
  if length(v_identity) not between 6 and 30 or v_identity !~ '^[A-Z0-9-]+$' then
    raise exception 'A valid national identity number is required';
  end if;
  if nullif(trim(coalesce(p_pledge_full_name,'')),'') is null or length(trim(p_pledge_full_name))>120 then
    raise exception 'Enter your full name as your captain pledge signature';
  end if;
  if jsonb_typeof(v_terms)<>'object'
    or coalesce((v_terms->>'protect_goods')::boolean,false) is not true
    or coalesce((v_terms->>'honest_delivery')::boolean,false) is not true
    or coalesce((v_terms->>'respect_community')::boolean,false) is not true
    or coalesce((v_terms->>'protect_privacy')::boolean,false) is not true
    or coalesce((v_terms->>'follow_rules')::boolean,false) is not true then
    raise exception 'All captain pledge commitments must be accepted';
  end if;

  insert into public.captain_identity_details(user_id,national_id_number,updated_at)
  values(auth.uid(),v_identity,now())
  on conflict(user_id) do update set national_id_number=excluded.national_id_number,updated_at=now();

  insert into public.captain_applications(
    user_id,captain_type,merchant_id,note,pledge_version,pledge_full_name,pledge_accepted_at,pledge_terms
  ) values(
    auth.uid(),p_captain_type,p_merchant_id,nullif(trim(coalesce(p_note,'')),''),
    'captain-pledge-v1',trim(p_pledge_full_name),now(),v_terms
  ) returning id into v_id;

  insert into public.notifications(user_id,title,body,kind)
  select id,'داواکاری کاپتن نێردرا','داواکاری کاپتن لەگەڵ پەیمانی پاراستنی کەل و پەل و ڕەفتاری پیشەیی نێردرا.','captain_application'
  from public.profiles where role='super_admin' and is_active=true;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'request_captain_application_with_pledge','captain_application',v_id,
    jsonb_build_object('captain_type',p_captain_type,'merchant_id',p_merchant_id,'pledge_version','captain-pledge-v1'));
  return v_id;
end;
$function$;
revoke all on function public.request_captain_application_with_pledge(public.captain_type,uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.request_captain_application_with_pledge(public.captain_type,uuid,text,text,text,jsonb) to authenticated;

create or replace function public.request_captain_application(
  p_captain_type public.captain_type,p_merchant_id uuid default null,p_note text default null
)
returns uuid language plpgsql security definer set search_path=''
as $function$
begin
  raise exception 'Captain pledge is required. Please submit the new captain application form.';
end;
$function$;
revoke all on function public.request_captain_application(public.captain_type,uuid,text) from public,anon,authenticated;

create or replace function public.set_my_captain_availability(p_is_active boolean)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_rows integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role='captain' and is_active=true) then
    raise exception 'Only an active captain account can change delivery availability';
  end if;
  update public.captain_profiles set is_active=coalesce(p_is_active,false) where user_id=auth.uid();
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Captain profile not found'; end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'set_captain_availability','captain_profile',auth.uid(),
    jsonb_build_object('is_active',coalesce(p_is_active,false)));
end;
$function$;
revoke all on function public.set_my_captain_availability(boolean) from public,anon;
grant execute on function public.set_my_captain_availability(boolean) to authenticated;

-- Product imagery accepts files up to 10 MiB; client-side resizing/compression keeps payloads lighter.
update storage.buckets
set file_size_limit=10485760,
    allowed_mime_types=array['image/jpeg','image/png','image/webp']
where id='product-images';
