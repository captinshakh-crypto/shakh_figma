-- Typed checkout entry point for the platform-owned SHAKH Store.
-- The underlying create_order function validates that null merchant_id means
-- every cart product must be an available SHAKH Store item.
create or replace function public.create_shakh_store_order(
  p_service_zone_id uuid,
  p_items jsonb,
  p_reward_campaign_id uuid default null,
  p_reward_amount_iqd bigint default 0
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  return public.create_order(
    null::uuid,
    p_service_zone_id,
    p_items,
    p_reward_campaign_id,
    p_reward_amount_iqd
  );
end;
$fn$;

revoke all on function public.create_shakh_store_order(uuid,jsonb,uuid,bigint) from public, anon;
grant execute on function public.create_shakh_store_order(uuid,jsonb,uuid,bigint) to authenticated;
