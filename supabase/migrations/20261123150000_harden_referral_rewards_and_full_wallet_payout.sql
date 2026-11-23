-- Harden SHAKH share-and-reward accounting.
-- Referral rewards are tracked as a dedicated wallet sub-balance so an ambassador's
-- cash-out never spends unrelated operating/top-up funds.

alter table public.wallets
  add column if not exists referral_balance_iqd bigint not null default 0;

alter table public.wallets
  drop constraint if exists wallets_referral_balance_nonnegative;
alter table public.wallets
  add constraint wallets_referral_balance_nonnegative
  check (referral_balance_iqd >= 0);

alter table public.payout_requests
  add column if not exists owner_paid_iqd bigint,
  add column if not exists platform_share_iqd bigint;

alter table public.payout_requests
  drop constraint if exists payout_requests_owner_paid_nonnegative;
alter table public.payout_requests
  add constraint payout_requests_owner_paid_nonnegative
  check (owner_paid_iqd is null or owner_paid_iqd >= 0);

alter table public.payout_requests
  drop constraint if exists payout_requests_platform_share_nonnegative;
alter table public.payout_requests
  add constraint payout_requests_platform_share_nonnegative
  check (platform_share_iqd is null or platform_share_iqd >= 0);

-- Backfill the dedicated referral sub-balance from its immutable ledger entries.
update public.wallets w
set referral_balance_iqd = greatest(coalesce((
  select sum(case
    when wl.entry_type::text = 'reward_credit' and wl.direction = 'credit' then wl.amount_iqd
    when wl.entry_type::text = 'payout_debit' and wl.direction = 'debit' then -wl.amount_iqd
    else 0
  end)
  from public.wallet_ledger wl
  where wl.wallet_user_id = w.user_id
), 0), 0),
updated_at = now();

create index if not exists payout_requests_pending_owner_idx
  on public.payout_requests(requester_user_id, created_at)
  where status = 'pending';

create unique index if not exists payout_requests_one_pending_per_owner_idx
  on public.payout_requests(requester_user_id)
  where status = 'pending';

-- New delivered referral rewards increase both the general wallet and the
-- separately tracked referral amount. The general wallet update remains in the
-- existing settle_delivered_order() function; this trigger maintains the sub-balance.
create or replace function private.sync_referral_reward_balance()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.entry_type::text = 'reward_credit' and new.direction = 'credit' then
    update public.wallets
       set referral_balance_iqd = referral_balance_iqd + new.amount_iqd,
           updated_at = now()
     where user_id = new.wallet_user_id;

    if not found then
      raise exception 'Referral wallet is not initialized for reward owner';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function private.sync_referral_reward_balance() from public, anon, authenticated;

drop trigger if exists wallet_ledger_sync_referral_reward_balance on public.wallet_ledger;
create trigger wallet_ledger_sync_referral_reward_balance
after insert on public.wallet_ledger
for each row
when (new.entry_type::text = 'reward_credit' and new.direction = 'credit')
execute function private.sync_referral_reward_balance();

-- A referral campaign cannot credit its own owner for their own purchase,
-- and a referral checkout must contain a positive product reward.
create or replace function private.validate_referral_order_owner()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_owner uuid;
begin
  if new.reward_campaign_id is null then
    if coalesce(new.reward_amount_iqd, 0) <> 0 then
      raise exception 'A referral reward requires a valid referral campaign';
    end if;
    return new;
  end if;

  select owner_user_id
    into v_owner
    from public.reward_campaigns
   where id = new.reward_campaign_id
     and is_active = true;

  if v_owner is null then
    raise exception 'Referral campaign is unavailable';
  end if;
  if v_owner = new.customer_id then
    raise exception 'Self-referral purchases are not eligible for rewards';
  end if;
  if coalesce(new.reward_amount_iqd, 0) <= 0 then
    raise exception 'No share reward is configured for the products in this order';
  end if;

  return new;
end;
$function$;

revoke all on function private.validate_referral_order_owner() from public, anon, authenticated;

drop trigger if exists orders_validate_referral_owner on public.orders;
create trigger orders_validate_referral_owner
before insert on public.orders
for each row
execute function private.validate_referral_order_owner();

-- A share reward is now a required pre-post setting. Existing published products
-- are not silently assigned a made-up reward; their owner/admin must set one before
-- editing or re-publishing them.
create or replace function private.enforce_product_wallet_minimum()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_owner uuid;
begin
  if tg_op = 'UPDATE'
     and current_setting('shakh.checkout_stock_update', true) = 'on'
     and new.stock_quantity is not null
     and old.stock_quantity is not null
     and new.stock_quantity < old.stock_quantity
     and (to_jsonb(new) - 'stock_quantity' - 'updated_at')
         = (to_jsonb(old) - 'stock_quantity' - 'updated_at') then
    return new;
  end if;

  if coalesce(new.referral_commission_iqd, 0) <= 0 then
    raise exception 'Set a positive per-unit share reward before posting this product';
  end if;

  if new.is_shakh_store then
    if not public.is_super_admin() then
      raise exception 'Only super admin can manage SHAKH Store';
    end if;
    if new.cost_price_iqd is null then
      raise exception 'Purchase cost is required for SHAKH Store products';
    end if;
    return new;
  end if;

  select user_id into v_owner
  from public.merchant_profiles
  where id = new.merchant_id and approval_status = 'approved';

  if v_owner is null then
    raise exception 'Approved merchant account required';
  end if;
  if v_owner <> auth.uid() and not public.is_super_admin() then
    raise exception 'You cannot manage another merchant products';
  end if;
  if not public.is_super_admin() and not private.has_operating_wallet(v_owner) then
    raise exception 'Wallet must have a positive balance before posting products';
  end if;
  return new;
end;
$function$;

revoke all on function private.enforce_product_wallet_minimum() from public, anon, authenticated;

-- A share owner requests the whole available referral balance, not an arbitrary
-- partial amount. Pending requests reserve the amount and cannot be requested twice.
create or replace function public.request_wallet_payout(
  p_amount_iqd bigint,
  p_method text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_wallet_balance bigint;
  v_referral_balance bigint;
  v_pending bigint;
  v_available bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_amount_iqd is null or p_amount_iqd <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_method not in ('fastpay', 'fib') then
    raise exception 'Unsupported payout method';
  end if;
  if not exists (
    select 1 from public.reward_campaigns
    where owner_user_id = auth.uid()
  ) then
    raise exception 'Only referral link owners can request a payout';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(auth.uid()::text || ':shakh-referral-payout', 0)
  );

  select balance_iqd, referral_balance_iqd
    into v_wallet_balance, v_referral_balance
    from public.wallets
   where user_id = auth.uid()
   for update;

  if not found then
    raise exception 'Referral wallet is not initialized';
  end if;

  select coalesce(sum(amount_iqd), 0)
    into v_pending
    from public.payout_requests
   where requester_user_id = auth.uid()
     and status = 'pending';

  v_available := greatest(coalesce(v_referral_balance, 0) - v_pending, 0);

  if v_available <= 0 then
    raise exception 'There is no available referral reward balance to cash out';
  end if;
  if p_amount_iqd <> v_available then
    raise exception 'Cash-out must request the full available referral balance (% IQD). Refresh the wallet and try again.', v_available;
  end if;
  if v_wallet_balance < p_amount_iqd then
    raise exception 'The general wallet balance is lower than the referral reward balance. Contact super admin';
  end if;

  insert into public.payout_requests(
    requester_user_id, amount_iqd, payout_method, admin_note
  )
  values (auth.uid(), p_amount_iqd, p_method, p_note)
  returning id into v_id;

  insert into public.notifications(user_id, title, body, kind)
  select id,
         'داواکاری کاشکردنی شێر و خەڵات',
         'داواکاری کاشکردنی تەواوی باڵانسی شێر و خەڵات نێردرا. لە کاتی پەسەندکردن ٧٥٪ بۆ خاوەن لینک و ٢٥٪ بۆ شاخ دەبێت.',
         'payout_pending'
    from public.profiles
   where role = 'super_admin' and is_active = true;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'request_full_referral_payout',
    'payout_request',
    v_id,
    jsonb_build_object('gross_amount_iqd', p_amount_iqd, 'payout_method', p_method)
  );

  return v_id;
end;
$function$;

revoke all on function public.request_wallet_payout(bigint, text, text) from public, anon;
grant execute on function public.request_wallet_payout(bigint, text, text) to authenticated;

-- Super admin confirms the manual 75% payment. In one transaction, the full
-- referral balance is removed, 25% is posted to SHAKH, and the net payment
-- is written to the payout request for audit/history.
create or replace function public.admin_mark_payout_paid(
  p_request_id uuid,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_req public.payout_requests%rowtype;
  v_rows integer;
  v_admin_id uuid;
  v_owner_net bigint;
  v_platform_share bigint;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin only';
  end if;

  select *
    into v_req
    from public.payout_requests
   where id = p_request_id
   for update;

  if not found then
    raise exception 'Payout request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Payout request already reviewed';
  end if;

  v_owner_net := floor(v_req.amount_iqd::numeric * 75 / 100)::bigint;
  v_platform_share := v_req.amount_iqd - v_owner_net;

  update public.wallets
     set balance_iqd = balance_iqd - v_req.amount_iqd,
         referral_balance_iqd = referral_balance_iqd - v_req.amount_iqd,
         updated_at = now()
   where user_id = v_req.requester_user_id
     and balance_iqd >= v_req.amount_iqd
     and referral_balance_iqd >= v_req.amount_iqd;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Insufficient referral wallet balance to settle payout';
  end if;

  insert into public.wallet_ledger(
    wallet_user_id, entry_type, amount_iqd, direction,
    reference_type, reference_id, idempotency_key, note, created_by
  )
  values (
    v_req.requester_user_id, 'payout_debit', v_req.amount_iqd, 'debit',
    'payout_request', v_req.id, 'payout-debit:' || v_req.id::text,
    'Full referral reward balance cashed out; 75% paid to owner and 25% retained by SHAKH',
    auth.uid()
  );

  select id
    into v_admin_id
    from public.profiles
   where role = 'super_admin' and is_active = true
   order by created_at asc
   limit 1;

  if v_admin_id is null then
    raise exception 'Super admin account is not initialized';
  end if;

  if v_platform_share > 0 then
    insert into public.wallets(user_id, balance_iqd)
    values (v_admin_id, 0)
    on conflict (user_id) do nothing;

    update public.wallets
       set balance_iqd = balance_iqd + v_platform_share,
           updated_at = now()
     where user_id = v_admin_id;

    insert into public.wallet_ledger(
      wallet_user_id, entry_type, amount_iqd, direction,
      reference_type, reference_id, idempotency_key, note, created_by
    )
    values (
      v_admin_id, 'admin_adjustment', v_platform_share, 'credit',
      'referral_platform_share', v_req.id,
      'referral-platform-share:' || v_req.id::text,
      '25% SHAKH platform share from referral reward payout',
      auth.uid()
    );
  end if;

  update public.payout_requests
     set status = 'approved',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         paid_at = now(),
         owner_paid_iqd = v_owner_net,
         platform_share_iqd = v_platform_share,
         admin_note = coalesce(
           p_admin_note,
           'Manual 75% cash payment confirmed (' || v_owner_net::text || ' IQD); 25% SHAKH share (' || v_platform_share::text || ' IQD)'
         )
   where id = v_req.id;

  insert into public.notifications(user_id, title, body, kind)
  values (
    v_req.requester_user_id,
    'داواکاری خەڵات کاشکرایەوە',
    'لە کۆی ' || v_req.amount_iqd::text || ' دینار، ' ||
      v_owner_net::text || ' دینار (٧٥٪) وەک پارەدان بۆت تۆمار کرا؛ ' ||
      v_platform_share::text || ' دینار (٢٥٪) بۆ پلاتفۆرمی شاخ مایەوە.',
    'payout_paid'
  );

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'mark_full_referral_payout_paid',
    'payout_request',
    v_req.id,
    jsonb_build_object(
      'gross_amount_iqd', v_req.amount_iqd,
      'owner_paid_iqd', v_owner_net,
      'platform_share_iqd', v_platform_share,
      'payout_method', v_req.payout_method
    )
  );
end;
$function$;

revoke all on function public.admin_mark_payout_paid(uuid, text) from public, anon;
grant execute on function public.admin_mark_payout_paid(uuid, text) to authenticated;
