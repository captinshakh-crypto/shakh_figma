-- Require a phone number in the Shakh profile without phone OTP verification.
-- The phone is application profile data; it is deliberately NOT written to auth.users.phone,
-- so Supabase phone verification/SMS OTP is not invoked.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.profiles(id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone','')), ''),
    'customer'
  )
  on conflict (id) do nothing;

  insert into public.wallets(user_id, balance_iqd)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.update_my_profile(
  p_full_name text,
  p_phone text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_full_name), '') is null then raise exception 'Full name is required'; end if;
  if length(trim(p_full_name)) > 120 then raise exception 'Full name is too long'; end if;
  if nullif(trim(coalesce(p_phone,'')), '') is null then raise exception 'Phone number is required'; end if;
  if length(trim(p_phone)) < 7 or length(trim(p_phone)) > 30 then raise exception 'Phone number is invalid'; end if;

  update public.profiles
  set full_name = trim(p_full_name),
      phone = trim(p_phone),
      updated_at = now()
  where id = auth.uid() and is_active = true;

  if not found then raise exception 'Active user profile not found'; end if;
end;
$fn$;
