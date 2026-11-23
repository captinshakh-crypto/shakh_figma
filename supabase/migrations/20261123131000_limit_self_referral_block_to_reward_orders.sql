-- A self-referral is only relevant when the order actually accrues a share
-- reward. A referral URL with zero-reward products must not block an ordinary
-- purchase simply because the customer happens to own that link.

create or replace function private.validate_referral_order_owner()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare v_owner uuid;
begin
  if new.reward_campaign_id is null then
    if coalesce(new.reward_amount_iqd, 0) <> 0 then
      raise exception 'A referral reward requires a valid referral campaign';
    end if;
    return new;
  end if;

  select owner_user_id into v_owner
  from public.reward_campaigns
  where id = new.reward_campaign_id and is_active = true;

  if v_owner is null then
    raise exception 'Referral campaign is unavailable';
  end if;

  if v_owner = new.customer_id and coalesce(new.reward_amount_iqd, 0) > 0 then
    raise exception 'Self-referral purchases are not eligible for rewards';
  end if;

  if coalesce(new.reward_amount_iqd, 0) < 0 then
    raise exception 'Referral reward amount cannot be negative';
  end if;

  return new;
end;
$function$;

revoke all on function private.validate_referral_order_owner() from public, anon, authenticated;
