-- Keep the delivery split consistent with orders_delivery_split_matches_fee_check.
-- Before a captain is assigned, the entire delivery fee belongs to the captain.
-- When the platform share is later assigned, the matching captain share is
-- reduced by the same amount in the captain assignment workflow.
create or replace function public.snapshot_order_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_zone_fee bigint;
begin
  select delivery_fee_iqd
    into v_zone_fee
  from public.service_zones
  where id = new.service_zone_id
    and is_active = true;

  if not found then
    raise exception 'Delivery zone is unavailable';
  end if;

  new.delivery_fee_iqd := v_zone_fee;
  new.platform_delivery_share_iqd := 0;
  new.captain_delivery_share_iqd := v_zone_fee;
  new.merchant_commission_rate_bps := 0;
  new.merchant_commission_iqd := coalesce(new.merchant_commission_iqd, 0);
  return new;
end;
$function$;
