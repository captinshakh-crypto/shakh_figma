-- Captain identity records and versioned acceptance of the delivery code of conduct.
alter table public.captain_applications
  add column if not exists national_id_number text,
  add column if not exists identity_document_path text,
  add column if not exists agreement_version text,
  add column if not exists agreement_accepted_at timestamptz;

alter table public.captain_profiles
  add column if not exists captain_code text not null default ('CAP-' || upper(substr(gen_random_uuid()::text,1,8))),
  add column if not exists national_id_number text,
  add column if not exists identity_document_path text;

-- Identity numbers and document paths are visible only to the captain and super admins.
drop policy if exists captain_profiles_read_self_admin_store on public.captain_profiles;
drop policy if exists captain_profiles_read_self_admin on public.captain_profiles;
create policy captain_profiles_read_self_admin
on public.captain_profiles for select to authenticated
using (user_id=auth.uid() or public.is_super_admin());

create unique index if not exists captain_profiles_captain_code_uidx
  on public.captain_profiles(captain_code);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('captain-documents','captain-documents',false,10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[])
on conflict(id) do update set
  public=false,
  file_size_limit=10485760,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists captain_documents_insert_own on storage.objects;
create policy captain_documents_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id='captain-documents'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists captain_documents_read_owner_or_admin on storage.objects;
create policy captain_documents_read_owner_or_admin
on storage.objects for select to authenticated
using (
  bucket_id='captain-documents'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or public.is_super_admin()
  )
);

drop policy if exists captain_documents_delete_owner_or_admin on storage.objects;
create policy captain_documents_delete_owner_or_admin
on storage.objects for delete to authenticated
using (
  bucket_id='captain-documents'
  and (
    public.is_super_admin()
    or (
      (storage.foldername(name))[1]=auth.uid()::text
      and not exists (
        select 1 from public.captain_applications a
        where a.user_id=auth.uid()
          and a.identity_document_path=name
          and a.status in ('pending','approved')
      )
      and not exists (
        select 1 from public.captain_profiles cp
        where cp.user_id=auth.uid() and cp.identity_document_path=name
      )
    )
  )
);

create table if not exists public.captain_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.captain_applications(id) on delete cascade,
  agreement_version text not null,
  accepted_at timestamptz not null default now(),
  accepted_user_agent text,
  created_at timestamptz not null default now(),
  constraint captain_agreement_acceptances_application_unique unique(application_id)
);

create unique index if not exists captain_agreement_acceptances_user_version_uidx
  on public.captain_agreement_acceptances(user_id,agreement_version);

-- Existing captains must explicitly accept the current terms before becoming available.
update public.captain_profiles cp
set is_available=false
where not exists (
  select 1 from public.captain_agreement_acceptances ca
  where ca.user_id=cp.user_id and ca.agreement_version='shakh-captain-terms-v1'
);

create or replace function public.accept_current_captain_agreement(p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.captain_profiles cp
    join public.profiles p on p.id=cp.user_id
    where cp.user_id=auth.uid() and cp.is_active=true
      and p.role='captain' and p.is_active=true
  ) then raise exception 'Active captain account required'; end if;

  insert into public.captain_agreement_acceptances(user_id,application_id,agreement_version,accepted_user_agent)
  values(auth.uid(),null,'shakh-captain-terms-v1',left(coalesce(p_user_agent,''),500))
  on conflict(user_id,agreement_version) do nothing;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'accept_captain_agreement','captain_profile',auth.uid(),
    jsonb_build_object('agreement_version','shakh-captain-terms-v1'));
end;
$fn$;

revoke all on function public.accept_current_captain_agreement(text) from public,anon;
grant execute on function public.accept_current_captain_agreement(text) to authenticated;

alter table public.captain_agreement_acceptances enable row level security;
drop policy if exists captain_agreement_acceptances_read_self_or_admin on public.captain_agreement_acceptances;
create policy captain_agreement_acceptances_read_self_or_admin
on public.captain_agreement_acceptances for select to authenticated
using (user_id=auth.uid() or public.is_super_admin());
grant select on public.captain_agreement_acceptances to authenticated;

create or replace function public.request_captain_application_v2(
  p_captain_type public.captain_type,
  p_merchant_id uuid default null,
  p_note text default null,
  p_national_id_number text default null,
  p_identity_document_path text default null,
  p_agreement_version text default null,
  p_user_agent text default null
) returns uuid
language plpgsql
security definer
set search_path = 'public', 'auth', 'storage', 'pg_temp'
as $fn$
declare
  v_id uuid;
  v_role public.app_role;
  v_national_id text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles
  where id=auth.uid() and is_active=true and nullif(trim(phone),'') is not null;
  if not found then raise exception 'Active profile with a phone number is required'; end if;
  if v_role <> 'customer' then raise exception 'Only customer accounts can apply to become a captain'; end if;

  v_national_id := regexp_replace(coalesce(p_national_id_number,''),'[^0-9]','','g');
  if length(v_national_id) < 5 or length(v_national_id) > 20 then
    raise exception 'A valid national identity number is required';
  end if;
  if p_agreement_version is distinct from 'shakh-captain-terms-v1' then
    raise exception 'Please review and accept the current captain agreement';
  end if;
  if p_identity_document_path is null
    or split_part(p_identity_document_path,'/',1) <> auth.uid()::text
    or not exists (
      select 1 from storage.objects
      where bucket_id='captain-documents' and name=p_identity_document_path
    ) then
    raise exception 'Upload a valid identity document before applying';
  end if;

  if exists (select 1 from public.captain_profiles where user_id=auth.uid() and is_active) then
    raise exception 'An active captain profile already exists';
  end if;
  if exists (select 1 from public.captain_applications where user_id=auth.uid() and status='pending') then
    raise exception 'A captain application is already pending';
  end if;

  if p_captain_type='shakh' then
    if p_merchant_id is not null then raise exception 'SHAKH captain applications cannot be linked to a store'; end if;
  elsif p_captain_type='merchant' then
    if p_merchant_id is null then raise exception 'Choose the store this captain will serve'; end if;
    if not exists (select 1 from public.merchant_profiles where id=p_merchant_id and approval_status='approved') then
      raise exception 'The selected store is not approved or does not exist';
    end if;
  else
    raise exception 'Invalid captain type';
  end if;

  insert into public.captain_applications(
    user_id,captain_type,merchant_id,note,national_id_number,identity_document_path,agreement_version,agreement_accepted_at
  )
  values(
    auth.uid(),p_captain_type,p_merchant_id,nullif(trim(coalesce(p_note,'')),''),
    v_national_id,p_identity_document_path,p_agreement_version,now()
  )
  returning id into v_id;

  insert into public.captain_agreement_acceptances(user_id,application_id,agreement_version,accepted_user_agent)
  values(auth.uid(),v_id,p_agreement_version,left(coalesce(p_user_agent,''),500));

  insert into public.notifications(user_id,title,body,kind)
  select id,'داواکاری کاپتن نێردرا','داواکاری بوون بە کاپتن بۆ پەسەندکردن نێردرا.','captain_application'
  from public.profiles where role='super_admin' and is_active=true;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'request_captain_application','captain_application',v_id,
    jsonb_build_object('captain_type',p_captain_type,'merchant_id',p_merchant_id,
      'agreement_version',p_agreement_version,'national_id_last4',right(v_national_id,4)));
  return v_id;
end;
$fn$;

revoke all on function public.request_captain_application_v2(public.captain_type,uuid,text,text,text,text,text) from public,anon;
grant execute on function public.request_captain_application_v2(public.captain_type,uuid,text,text,text,text,text) to authenticated;

create or replace function public.review_captain_application(
  p_application_id uuid,
  p_approve boolean,
  p_admin_note text default null
) returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $fn$
declare
  v_app public.captain_applications%rowtype;
  v_old_role public.app_role;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;

  select * into v_app from public.captain_applications
  where id=p_application_id for update;
  if not found then raise exception 'Captain application not found'; end if;
  if v_app.status <> 'pending' then raise exception 'Application already reviewed'; end if;

  select role into v_old_role from public.profiles
  where id=v_app.user_id and is_active=true for update;
  if not found then raise exception 'Applicant profile is inactive or missing'; end if;
  if v_old_role <> 'customer' then raise exception 'Applicant is no longer a customer'; end if;

  if p_approve then
    if v_app.agreement_version is distinct from 'shakh-captain-terms-v1'
      or v_app.agreement_accepted_at is null then
      raise exception 'Captain agreement acceptance is missing';
    end if;
    if v_app.national_id_number is null or v_app.identity_document_path is null then
      raise exception 'Captain identity information is missing';
    end if;
    if v_app.captain_type='merchant' and not exists (
      select 1 from public.merchant_profiles
      where id=v_app.merchant_id and approval_status='approved'
    ) then raise exception 'The selected store is no longer approved'; end if;

    update public.profiles set role='captain',updated_at=now()
    where id=v_app.user_id;

    insert into public.captain_profiles(
      user_id,captain_type,merchant_id,is_active,approved_by,approved_at,national_id_number,identity_document_path
    )
    values(
      v_app.user_id,v_app.captain_type,v_app.merchant_id,true,auth.uid(),now(),v_app.national_id_number,v_app.identity_document_path
    )
    on conflict(user_id) do update set
      captain_type=excluded.captain_type,
      merchant_id=excluded.merchant_id,
      is_active=true,
      approved_by=excluded.approved_by,
      approved_at=excluded.approved_at,
      national_id_number=excluded.national_id_number,
      identity_document_path=excluded.identity_document_path;
  end if;

  update public.captain_applications
  set status=case when p_approve then 'approved'::public.record_status else 'rejected'::public.record_status end,
      reviewed_by=auth.uid(),reviewed_at=now()
  where id=p_application_id;

  insert into public.notifications(user_id,title,body,kind)
  values(
    v_app.user_id,
    case when p_approve then 'داواکاری کاپتنی تۆ پەسەند کرا' else 'داواکاری کاپتنی تۆ ڕەتکرایەوە' end,
    case when p_approve
      then case when v_app.captain_type='shakh' then 'تۆ ئێستا کاپتنی شاخیت.' else 'تۆ ئێستا کاپتنی تایبەت بە دوکانی هەڵبژێردراویت.' end
      else coalesce(nullif(trim(p_admin_note),''),'داواکارییەکەت پەسەند نەکرا.') end,
    'captain_application_result'
  );

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),case when p_approve then 'approve_captain_application' else 'reject_captain_application' end,
    'captain_application',v_app.id,
    jsonb_build_object('user_id',v_app.user_id,'captain_type',v_app.captain_type,'merchant_id',v_app.merchant_id,
      'agreement_version',v_app.agreement_version,'national_id_last4',right(coalesce(v_app.national_id_number,''),4)));
end;
$fn$;
