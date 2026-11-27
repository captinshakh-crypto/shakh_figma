-- Weekly store hours and a manual emergency open/close override.
alter table public.merchant_profiles
  add column if not exists operating_hours jsonb not null default '{
    "mon":{"open":"00:00","close":"23:59","closed":false},
    "tue":{"open":"00:00","close":"23:59","closed":false},
    "wed":{"open":"00:00","close":"23:59","closed":false},
    "thu":{"open":"00:00","close":"23:59","closed":false},
    "fri":{"open":"00:00","close":"23:59","closed":false},
    "sat":{"open":"00:00","close":"23:59","closed":false},
    "sun":{"open":"00:00","close":"23:59","closed":false}
  }'::jsonb,
  add column if not exists manual_open boolean not null default true;

create or replace function public.update_my_store_schedule(
  p_operating_hours jsonb,
  p_manual_open boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_day_key text;
  v_day jsonb;
  v_open text;
  v_close text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_manual_open is null then raise exception 'Manual store status is required'; end if;
  if jsonb_typeof(p_operating_hours) <> 'object' then raise exception 'Operating hours must be an object'; end if;

  foreach v_day_key in array array['mon','tue','wed','thu','fri','sat','sun'] loop
    v_day := p_operating_hours -> v_day_key;
    if jsonb_typeof(v_day) <> 'object' then raise exception 'Missing or invalid operating hours for %', v_day_key; end if;
    if jsonb_typeof(v_day -> 'closed') <> 'boolean' then raise exception 'Closed flag is required for %', v_day_key; end if;
    v_open := v_day ->> 'open';
    v_close := v_day ->> 'close';
    if v_open !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or v_close !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Invalid opening or closing time for %', v_day_key;
    end if;
    if v_open >= v_close then raise exception 'Opening time must be earlier than closing time for %', v_day_key; end if;
  end loop;

  update public.merchant_profiles mp
  set operating_hours = p_operating_hours,
      manual_open = p_manual_open
  from public.profiles p
  where mp.user_id = v_user
    and p.id = v_user
    and p.is_active = true
    and mp.approval_status = 'approved';

  if not found then raise exception 'Approved active merchant account required'; end if;
end;
$fn$;

revoke all on function public.update_my_store_schedule(jsonb,boolean) from public, anon;
grant execute on function public.update_my_store_schedule(jsonb,boolean) to authenticated;

create or replace function private.enforce_merchant_store_hours()
returns trigger
language plpgsql
security definer
set search_path = ''
as $trigger$
declare
  v_manual_open boolean;
  v_hours jsonb;
  v_day_key text;
  v_day jsonb;
  v_local_time time;
  v_open time;
  v_close time;
begin
  if new.merchant_id is null then return new; end if;

  select mp.manual_open, mp.operating_hours
    into v_manual_open, v_hours
  from public.merchant_profiles mp
  where mp.id = new.merchant_id
    and mp.approval_status = 'approved';

  if not found then raise exception 'This store is not approved for orders'; end if;
  if not v_manual_open then raise exception 'This store is currently closed'; end if;

  v_day_key := (array['mon','tue','wed','thu','fri','sat','sun'])[extract(isodow from (now() at time zone 'Asia/Baghdad'))::integer];
  v_day := v_hours -> v_day_key;
  if v_day is null or coalesce((v_day ->> 'closed')::boolean, true) then
    raise exception 'This store is closed today';
  end if;

  v_open := (v_day ->> 'open')::time;
  v_close := (v_day ->> 'close')::time;
  v_local_time := (now() at time zone 'Asia/Baghdad')::time;
  if v_local_time < v_open or v_local_time >= v_close then
    raise exception 'This store is outside its opening hours';
  end if;
  return new;
end;
$trigger$;

drop trigger if exists orders_guard_merchant_store_hours on public.orders;
create trigger orders_guard_merchant_store_hours
before insert on public.orders
for each row execute function private.enforce_merchant_store_hours();
