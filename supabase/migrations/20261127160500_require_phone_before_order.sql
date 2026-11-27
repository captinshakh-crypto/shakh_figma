-- Enforce mandatory profile phone at the database boundary, not only in the UI.
create or replace function private.require_customer_phone_for_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $trigger$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.customer_id
      and p.is_active = true
      and nullif(trim(coalesce(p.phone,'')), '') is not null
  ) then
    raise exception 'Add your mobile number to your profile before placing an order';
  end if;
  return new;
end;
$trigger$;

drop trigger if exists orders_require_customer_phone on public.orders;
create trigger orders_require_customer_phone
before insert on public.orders
for each row execute function private.require_customer_phone_for_order();
