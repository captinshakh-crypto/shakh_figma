-- Automatically settle prepaid merchant, captain, and referral commissions
-- after a captain or super admin marks an order as delivered.

create or replace function private.settle_order_when_delivered()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.status is distinct from 'delivered' and new.status='delivered' and new.settled_at is null then
    perform public.settle_delivered_order(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists orders_settle_when_delivered on public.orders;
create trigger orders_settle_when_delivered
after update of status on public.orders
for each row execute function private.settle_order_when_delivered();
revoke all on function private.settle_order_when_delivered() from public,anon,authenticated;
