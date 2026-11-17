-- Keep public storefront reads independent of privileged SECURITY DEFINER helpers.
drop policy if exists products_read_available on public.products;
create policy products_public_available on public.products
for select to anon, authenticated using (is_available = true);
create policy products_owner_or_admin_read on public.products
for select to authenticated using (
  public.is_super_admin() or exists(
    select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=auth.uid()
  )
);

drop policy if exists zones_read_active on public.service_zones;
create policy zones_public_active on public.service_zones
for select to anon, authenticated using (is_active = true);
create policy zones_admin_read on public.service_zones
for select to authenticated using (public.is_super_admin());

drop policy if exists merchants_read_active_or_owner_or_admin on public.merchant_profiles;
create policy merchants_public_approved on public.merchant_profiles
for select to anon, authenticated using (approval_status='approved');
create policy merchants_owner_read on public.merchant_profiles
for select to authenticated using (user_id=auth.uid());

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
for select to authenticated using (id=auth.uid() or public.is_super_admin());

drop policy if exists zones_admin_all on public.service_zones;
create policy zones_admin_all on public.service_zones
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists merchants_insert_self on public.merchant_profiles;
create policy merchants_insert_self on public.merchant_profiles
for insert to authenticated with check (user_id=auth.uid() and public.current_app_role()=merchant_type);

drop policy if exists merchants_update_admin_only on public.merchant_profiles;
create policy merchants_update_admin_only on public.merchant_profiles
for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists products_merchant_insert on public.products;
create policy products_merchant_insert on public.products
for insert to authenticated with check (
  (is_shakh_store=true and public.is_super_admin())
  or (is_shakh_store=false and exists(
    select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=auth.uid() and m.approval_status='approved'
  ))
);

drop policy if exists products_merchant_update on public.products;
create policy products_merchant_update on public.products
for update to authenticated using (
  public.is_super_admin() or exists(select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=auth.uid())
) with check (
  public.is_super_admin() or exists(select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=auth.uid())
);

drop policy if exists products_merchant_delete on public.products;
create policy products_merchant_delete on public.products
for delete to authenticated using (
  public.is_super_admin() or exists(select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=auth.uid())
);

drop policy if exists wallets_read_self_or_admin on public.wallets;
create policy wallets_read_self_or_admin on public.wallets
for select to authenticated using (user_id=auth.uid() or public.is_super_admin());
drop policy if exists ledger_read_self_or_admin on public.wallet_ledger;
create policy ledger_read_self_or_admin on public.wallet_ledger
for select to authenticated using (wallet_user_id=auth.uid() or public.is_super_admin());
drop policy if exists topups_read_self_or_admin on public.wallet_topup_requests;
create policy topups_read_self_or_admin on public.wallet_topup_requests
for select to authenticated using (user_id=auth.uid() or public.is_super_admin());
drop policy if exists topups_insert_self on public.wallet_topup_requests;
create policy topups_insert_self on public.wallet_topup_requests
for insert to authenticated with check (user_id=auth.uid() and status='pending');

drop policy if exists rewards_read_active_or_owner_or_admin on public.reward_campaigns;
create policy rewards_read_active_or_owner_or_admin on public.reward_campaigns
for select to authenticated using (is_active or owner_user_id=auth.uid() or public.is_super_admin());
drop policy if exists rewards_owner_insert on public.reward_campaigns;
create policy rewards_owner_insert on public.reward_campaigns
for insert to authenticated with check (owner_user_id=auth.uid());

drop policy if exists orders_read_participant_or_admin on public.orders;
create policy orders_read_participant_or_admin on public.orders
for select to authenticated using (
  customer_id=auth.uid() or captain_user_id=auth.uid() or public.is_super_admin()
  or exists(select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=auth.uid())
);
drop policy if exists order_items_read_participant on public.order_items;
create policy order_items_read_participant on public.order_items
for select to authenticated using (
  exists(select 1 from public.orders o where o.id=order_id and (
    o.customer_id=auth.uid() or o.captain_user_id=auth.uid() or public.is_super_admin()
    or exists(select 1 from public.merchant_profiles m where m.id=o.merchant_id and m.user_id=auth.uid())
  ))
);

drop policy if exists payouts_read_self_or_admin on public.payout_requests;
create policy payouts_read_self_or_admin on public.payout_requests
for select to authenticated using (requester_user_id=auth.uid() or public.is_super_admin());
drop policy if exists payouts_insert_self on public.payout_requests;
create policy payouts_insert_self on public.payout_requests
for insert to authenticated with check (requester_user_id=auth.uid() and status='pending');
drop policy if exists payouts_admin_update on public.payout_requests;
create policy payouts_admin_update on public.payout_requests
for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists notifications_read_self on public.notifications;
create policy notifications_read_self on public.notifications
for select to authenticated using (user_id=auth.uid());
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read on public.audit_logs
for select to authenticated using (public.is_super_admin());
drop policy if exists settings_admin_all on public.platform_settings;
create policy settings_admin_all on public.platform_settings
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- RLS helper functions are used only by signed-in policies.
revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
