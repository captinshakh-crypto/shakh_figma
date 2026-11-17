-- SHAKH profile onboarding and two scoped captain types.
create type public.captain_type as enum ('shakh','merchant');

create table public.captain_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  captain_type public.captain_type not null,
  merchant_id uuid references public.merchant_profiles(id) on delete restrict,
  is_active boolean not null default true,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint captain_profiles_scope_check check (
    (captain_type = 'shakh' and merchant_id is null) or
    (captain_type = 'merchant' and merchant_id is not null)
  )
);

create table public.captain_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  captain_type public.captain_type not null,
  merchant_id uuid references public.merchant_profiles(id) on delete restrict,
  note text,
  status public.record_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint captain_applications_scope_check check (
    (captain_type = 'shakh' and merchant_id is null) or
    (captain_type = 'merchant' and merchant_id is not null)
  )
);

create unique index captain_applications_one_pending_per_user
  on public.captain_applications(user_id) where status = 'pending';
create index captain_applications_admin_queue_idx
  on public.captain_applications(status, created_at desc);
create index captain_profiles_merchant_active_idx
  on public.captain_profiles(merchant_id) where is_active = true;

alter table public.captain_profiles enable row level security;
alter table public.captain_applications enable row level security;

grant select on public.captain_profiles to authenticated;
grant select on public.captain_applications to authenticated;

create policy captain_profiles_read_self_admin_store
on public.captain_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_super_admin())
  or exists (
    select 1 from public.merchant_profiles m
    where m.id = captain_profiles.merchant_id
      and m.user_id = (select auth.uid())
  )
);

create policy captain_applications_read_self_admin
on public.captain_applications for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_super_admin())
);

create or replace function public.update_my_profile(
  p_full_name text,
  p_phone text
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_full_name), '') is null then raise exception 'Full name is required'; end if;
  if length(trim(p_full_name)) > 120 then raise exception 'Full name is too long'; end if;
  if p_phone is not null and length(trim(p_phone)) > 30 then raise exception 'Phone number is too long'; end if;
  update public.profiles
  set full_name = trim(p_full_name),
      phone = nullif(trim(coalesce(p_phone,'')), ''),
      updated_at = now()
  where id = auth.uid() and is_active = true;
  if not found then raise exception 'Active user profile not found'; end if;
end;
$fn$;

create or replace function public.request_captain_application(
  p_captain_type public.captain_type,
  p_merchant_id uuid default null,
  p_note text default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v_id uuid; v_role public.app_role;
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
    if not exists (select 1 from public.merchant_profiles where id = p_merchant_id and approval_status = 'approved') then
      raise exception 'The selected store is not approved or does not exist';
    end if;
  else
    raise exception 'Invalid captain type';
  end if;

  insert into public.captain_applications(user_id,captain_type,merchant_id,note)
  values(auth.uid(),p_captain_type,p_merchant_id,nullif(trim(coalesce(p_note,'')), ''))
  returning id into v_id;

  insert into public.notifications(user_id,title,body,kind)
  select id,'داواکاری کپتن نێردرا','داواکاری بوون بە کپتن بۆ پەسەندکردن نێردرا.','captain_application'
  from public.profiles where role='super_admin' and is_active=true;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'request_captain_application','captain_application',v_id,
    jsonb_build_object('captain_type',p_captain_type,'merchant_id',p_merchant_id));
  return v_id;
end;
$fn$;

create or replace function public.review_captain_application(
  p_application_id uuid,
  p_approve boolean,
  p_admin_note text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v_app public.captain_applications%rowtype; v_old_role public.app_role;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  select * into v_app from public.captain_applications where id = p_application_id for update;
  if not found then raise exception 'Captain application not found'; end if;
  if v_app.status <> 'pending' then raise exception 'Application already reviewed'; end if;
  select role into v_old_role from public.profiles
  where id = v_app.user_id and is_active = true for update;
  if not found then raise exception 'Applicant profile is inactive or missing'; end if;
  if v_old_role <> 'customer' then raise exception 'Applicant is no longer a customer'; end if;

  if p_approve then
    if v_app.captain_type = 'merchant' and not exists (
      select 1 from public.merchant_profiles where id = v_app.merchant_id and approval_status = 'approved'
    ) then raise exception 'The selected store is no longer approved'; end if;
    update public.profiles set role = 'captain', updated_at = now() where id = v_app.user_id;
    insert into public.captain_profiles(user_id,captain_type,merchant_id,is_active,approved_by,approved_at)
    values(v_app.user_id,v_app.captain_type,v_app.merchant_id,true,auth.uid(),now())
    on conflict (user_id) do update set
      captain_type = excluded.captain_type, merchant_id = excluded.merchant_id,
      is_active = true, approved_by = excluded.approved_by, approved_at = excluded.approved_at;
  end if;

  update public.captain_applications
  set status = case when p_approve then 'approved'::public.record_status else 'rejected'::public.record_status end,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_application_id;

  insert into public.notifications(user_id,title,body,kind)
  values(
    v_app.user_id,
    case when p_approve then 'داواکاری کپتنی تۆ پەسەند کرا' else 'داواکاری کپتنی تۆ ڕەتکرایەوە' end,
    case when p_approve
      then case when v_app.captain_type='shakh' then 'تۆ ئێستا کپتنی شاخیت.' else 'تۆ ئێستا کپتنی تایبەت بە دوکانی هەڵبژێردراویت.' end
      else coalesce(nullif(trim(p_admin_note),''),'داواکارییەکەت پەسەند نەکرا.') end,
    'captain_application_result'
  );
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),case when p_approve then 'approve_captain_application' else 'reject_captain_application' end,
    'captain_application',v_app.id,
    jsonb_build_object('user_id',v_app.user_id,'captain_type',v_app.captain_type,'merchant_id',v_app.merchant_id));
end;
$fn$;

create or replace function public.admin_set_user_role(p_user_id uuid,p_role public.app_role)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v_old public.app_role;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  if p_role not in ('captain','customer') then raise exception 'Only captain/customer roles can be assigned here'; end if;
  select role into v_old from public.profiles where id=p_user_id for update;
  if not found then raise exception 'User profile not found'; end if;
  if v_old='super_admin' then raise exception 'Super admin role cannot be changed here'; end if;
  if v_old in ('supermarket','restaurant','butcher_poultry','grocery') and p_role='customer' then
    update public.merchant_profiles set approval_status='inactive' where user_id=p_user_id;
  end if;
  update public.profiles set role=p_role,updated_at=now() where id=p_user_id;
  if p_role='captain' then
    insert into public.captain_profiles(user_id,captain_type,merchant_id,is_active,approved_by,approved_at)
    values(p_user_id,'shakh',null,true,auth.uid(),now())
    on conflict (user_id) do update set
      captain_type='shakh',merchant_id=null,is_active=true,approved_by=auth.uid(),approved_at=now();
  else
    delete from public.captain_profiles where user_id=p_user_id;
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'change_user_role','profile',p_user_id,jsonb_build_object('old_role',v_old,'new_role',p_role));
end;
$fn$;

create or replace function public.admin_assign_captain(p_order_id uuid,p_captain_user_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v_order public.orders%rowtype; v_type public.captain_type; v_merchant_id uuid;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  select cp.captain_type,cp.merchant_id into v_type,v_merchant_id
  from public.captain_profiles cp
  join public.profiles p on p.id=cp.user_id
  where cp.user_id=p_captain_user_id and cp.is_active=true and p.role='captain' and p.is_active=true;
  if not found then raise exception 'Captain account is not active or has no approved captain type'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status not in ('ready_for_pickup','assigned') then raise exception 'Order is not ready for assignment'; end if;
  if v_type='merchant' and v_merchant_id is distinct from v_order.merchant_id then
    raise exception 'This captain is restricted to a different store';
  end if;
  update public.orders set captain_user_id=p_captain_user_id,status='assigned' where id=p_order_id;
  insert into public.notifications(user_id,title,body,kind)
  values(p_captain_user_id,'گەیاندنی نوێت هەیە','داواکارییەکی نوێت بۆ گەیاندن دیاریکرا.','delivery_assigned');
end;
$fn$;

revoke all on function public.update_my_profile(text,text) from public,anon;
revoke all on function public.request_captain_application(public.captain_type,uuid,text) from public,anon;
revoke all on function public.review_captain_application(uuid,boolean,text) from public,anon;
grant execute on function public.update_my_profile(text,text) to authenticated;
grant execute on function public.request_captain_application(public.captain_type,uuid,text) to authenticated;
grant execute on function public.review_captain_application(uuid,boolean,text) to authenticated;
revoke all on function public.admin_set_user_role(uuid,public.app_role) from public,anon;
grant execute on function public.admin_set_user_role(uuid,public.app_role) to authenticated;
revoke all on function public.admin_assign_captain(uuid,uuid) from public,anon;
grant execute on function public.admin_assign_captain(uuid,uuid) to authenticated;
