-- Explicitly remove direct grants to anon; Supabase projects may have default ACL grants.
revoke execute on function public.admin_credit_own_wallet(bigint,text) from anon;
revoke execute on function public.admin_mark_payout_paid(uuid,text) from anon;
revoke execute on function public.bootstrap_shakh_super_admin() from anon, authenticated;
revoke execute on function public.current_app_role() from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.is_super_admin() from anon;
revoke execute on function public.request_wallet_payout(bigint,text,text) from anon;
revoke execute on function public.request_wallet_topup(bigint,text) from anon;
revoke execute on function public.review_wallet_topup(uuid,boolean,text) from anon;
revoke execute on function public.set_commission_setting(public.app_role,integer,bigint) from anon;
revoke execute on function public.settle_delivered_order(uuid) from anon;
revoke execute on function public.snapshot_order_commission() from anon, authenticated;

-- Trigger-only functions are not RPC endpoints.
revoke execute on function public.bootstrap_shakh_super_admin() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.snapshot_order_commission() from public;

-- Ensure the verified owner is promoted if the account existed before the bootstrap trigger.
update public.profiles p
set role = 'super_admin', is_active = true
from auth.users u
where p.id = u.id
  and lower(u.email) = 'sardar.xano59@gmail.com'
  and u.email_confirmed_at is not null;

insert into public.wallets(user_id,balance_iqd)
select id,0 from public.profiles where role='super_admin'
on conflict(user_id) do nothing;
