-- Record explicit acceptance of the current SHAKH STORE privacy policy.
create table if not exists public.privacy_policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null check (length(trim(policy_version)) between 1 and 32),
  acceptance_method text not null check (
    acceptance_method in ('email_signup', 'google_signup', 'policy_update')
  ),
  accepted_at timestamptz not null default now(),
  constraint privacy_policy_acceptances_user_version_unique unique (user_id, policy_version)
);

create index if not exists privacy_policy_acceptances_user_accepted_idx
  on public.privacy_policy_acceptances (user_id, accepted_at desc);

alter table public.privacy_policy_acceptances enable row level security;

drop policy if exists privacy_policy_acceptances_read_own on public.privacy_policy_acceptances;
create policy privacy_policy_acceptances_read_own
  on public.privacy_policy_acceptances
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.privacy_policy_acceptances from anon, authenticated;
grant select on table public.privacy_policy_acceptances to authenticated;

create or replace function public.record_shakh_privacy_policy_acceptance(
  p_policy_version text,
  p_method text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_policy_version is null or p_policy_version <> '2026-11-26' then
    raise exception 'Unsupported privacy policy version';
  end if;

  if p_method is null or p_method not in ('email_signup', 'google_signup', 'policy_update') then
    raise exception 'Invalid privacy policy acceptance method';
  end if;

  insert into public.privacy_policy_acceptances (user_id, policy_version, acceptance_method)
  values (auth.uid(), p_policy_version, p_method)
  on conflict (user_id, policy_version) do nothing;
end;
$function$;

revoke all on function public.record_shakh_privacy_policy_acceptance(text, text) from public, anon;
grant execute on function public.record_shakh_privacy_policy_acceptance(text, text) to authenticated;
