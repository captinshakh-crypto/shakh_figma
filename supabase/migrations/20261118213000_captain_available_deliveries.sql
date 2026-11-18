-- Allow eligible captains to see ready-for-pickup deliveries and claim them.
create or replace function public.claim_available_delivery(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_type public.captain_type;
  v_merchant_id uuid;
  v_commission bigint;
  v_captain_share bigint;
  v_rows integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select cp.captain_type, cp.merchant_id into v_type, v_merchant_id
  from public.captain_profiles cp
  join public.profiles p on p.id = cp.user_id
  where cp.user_id = v_user and cp.is_active = true
    and p.role = 'captain' and p.is_active = true;
  if not found then raise exception 'Active captain account required'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Delivery order not found'; end if;
  if v_order.status <> 'ready_for_pickup' or v_order.captain_user_id is not null then
    raise exception 'This delivery is no longer available';
  end if;
  if v_type = 'merchant' and v_merchant_id is distinct from v_order.merchant_id then
    raise exception 'This delivery belongs to another store';
  end if;

  v_commission := round(v_order.delivery_fee_iqd * 0.20)::bigint;
  v_captain_share := v_order.delivery_fee_iqd - v_commission;
  insert into public.wallets(user_id,balance_iqd) values(v_user,0) on conflict(user_id) do nothing;
  update public.wallets set balance_iqd = balance_iqd - v_commission, updated_at = now()
  where user_id = v_user and balance_iqd >= v_commission;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Your wallet does not have enough balance for the 20 percent delivery commission'; end if;

  insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
  values(v_user,'platform_delivery_share',v_commission,'debit','captain_delivery_commission',v_order.id,
    'captain-delivery-commission:'||v_order.id::text,'Prepaid 20 percent commission from delivery fee',v_user);

  update public.orders set captain_user_id = v_user, status = 'assigned',
    platform_delivery_share_iqd = v_commission,
    captain_delivery_share_iqd = v_captain_share
  where id = v_order.id;

  delete from public.order_live_locations where order_id = v_order.id;
  insert into public.order_status_history(order_id,from_status,to_status,changed_by,actor_role,note)
  values(v_order.id,'ready_for_pickup','assigned',v_user,'captain','Captain claimed available delivery; 20 percent commission prepaid');
  insert into public.notifications(user_id,title,body,kind)
  values(v_order.customer_id,'کاپتن دیاریکرا','کاپتنێک گەیاندنی داواکارییەکەت وەرگرت.','captain_assigned');
end;
$function$;

drop policy if exists orders_read_available_to_eligible_captains on public.orders;
create policy orders_read_available_to_eligible_captains on public.orders
for select to authenticated
using (
  status = 'ready_for_pickup' and captain_user_id is null
  and exists (
    select 1 from public.captain_profiles cp
    join public.profiles p on p.id = cp.user_id
    where cp.user_id = auth.uid() and cp.is_active = true
      and p.role = 'captain' and p.is_active = true
      and (cp.captain_type = 'shakh'
        or (cp.captain_type = 'merchant' and cp.merchant_id = orders.merchant_id))
  )
);

drop policy if exists order_items_read_participant on public.order_items;
create policy order_items_read_participant on public.order_items
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (
        o.customer_id = auth.uid()
        or o.captain_user_id = auth.uid()
        or public.is_super_admin()
        or exists (select 1 from public.merchant_profiles m where m.id = o.merchant_id and m.user_id = auth.uid())
        or (
          o.status = 'ready_for_pickup' and o.captain_user_id is null
          and exists (
            select 1 from public.captain_profiles cp
            join public.profiles p on p.id = cp.user_id
            where cp.user_id = auth.uid() and cp.is_active = true
              and p.role = 'captain' and p.is_active = true
              and (cp.captain_type = 'shakh'
                or (cp.captain_type = 'merchant' and cp.merchant_id = o.merchant_id))
          )
        )
      )
  )
);
