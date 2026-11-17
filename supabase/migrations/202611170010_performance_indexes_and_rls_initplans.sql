-- Index foreign keys and optimize RLS policy evaluation.
create index if not exists audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);
create index if not exists commission_settings_updated_by_idx on public.commission_settings(updated_by);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists orders_captain_user_id_idx on public.orders(captain_user_id);
create index if not exists orders_reward_campaign_id_idx on public.orders(reward_campaign_id);
create index if not exists orders_service_zone_id_idx on public.orders(service_zone_id);
create index if not exists payout_requests_requester_user_id_idx on public.payout_requests(requester_user_id);
create index if not exists payout_requests_reviewed_by_idx on public.payout_requests(reviewed_by);
create index if not exists platform_settings_updated_by_idx on public.platform_settings(updated_by);
create index if not exists reward_campaigns_owner_user_id_idx on public.reward_campaigns(owner_user_id);
create index if not exists wallet_ledger_created_by_idx on public.wallet_ledger(created_by);
create index if not exists wallet_topup_requests_reviewed_by_idx on public.wallet_topup_requests(reviewed_by);

-- Commission settings: one SELECT policy and narrowly scoped admin write policies.
drop policy if exists commission_settings_read on public.commission_settings;
drop policy if exists commission_settings_admin_write on public.commission_settings;
create policy commission_settings_read on public.commission_settings
for select to authenticated using (true);
create policy commission_settings_admin_insert on public.commission_settings
for insert to authenticated with check ((select public.is_super_admin()));
create policy commission_settings_admin_update on public.commission_settings
for update to authenticated using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));
create policy commission_settings_admin_delete on public.commission_settings
for delete to authenticated using ((select public.is_super_admin()));

-- Merchant reads: anonymous users see only approved stores; authenticated owners/admins see their own/admin data.
drop policy if exists merchants_public_approved on public.merchant_profiles;
drop policy if exists merchants_owner_read on public.merchant_profiles;
drop policy if exists merchants_admin_read_all on public.merchant_profiles;
create policy merchants_public_approved on public.merchant_profiles
for select to anon using (approval_status='approved');
create policy merchants_authenticated_read on public.merchant_profiles
for select to authenticated using (
  approval_status='approved' or user_id=(select auth.uid()) or (select public.is_super_admin())
);

-- Products: public catalog reads remain simple; signed-in owners/admins can also read their inactive listings.
drop policy if exists products_public_available on public.products;
drop policy if exists products_owner_or_admin_read on public.products;
create policy products_public_available on public.products
for select to anon using (is_available=true);
create policy products_authenticated_read on public.products
for select to authenticated using (
  is_available=true or (select public.is_super_admin()) or exists(
    select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=(select auth.uid())
  )
);

-- Zones: public users see active zones; authenticated admins can manage all zones.
drop policy if exists zones_public_active on public.service_zones;
drop policy if exists zones_admin_read on public.service_zones;
drop policy if exists zones_admin_all on public.service_zones;
create policy zones_public_active on public.service_zones
for select to anon using (is_active=true);
create policy zones_authenticated_read on public.service_zones
for select to authenticated using (is_active=true or (select public.is_super_admin()));
create policy zones_admin_insert on public.service_zones
for insert to authenticated with check ((select public.is_super_admin()));
create policy zones_admin_update on public.service_zones
for update to authenticated using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));
create policy zones_admin_delete on public.service_zones
for delete to authenticated using ((select public.is_super_admin()));

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
for select to authenticated using (id=(select auth.uid()) or (select public.is_super_admin()));

drop policy if exists merchants_insert_self on public.merchant_profiles;
create policy merchants_insert_self on public.merchant_profiles
for insert to authenticated with check (user_id=(select auth.uid()) and (select public.current_app_role())=merchant_type);
drop policy if exists merchants_update_admin_only on public.merchant_profiles;
create policy merchants_update_admin_only on public.merchant_profiles
for update to authenticated using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));

drop policy if exists products_merchant_insert on public.products;
create policy products_merchant_insert on public.products
for insert to authenticated with check (
  (is_shakh_store=true and (select public.is_super_admin()))
  or (is_shakh_store=false and exists(
    select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=(select auth.uid()) and m.approval_status='approved'
  ))
);
drop policy if exists products_merchant_update on public.products;
create policy products_merchant_update on public.products
for update to authenticated using (
  (select public.is_super_admin()) or exists(
    select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=(select auth.uid())
  )
) with check (
  (select public.is_super_admin()) or exists(
    select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=(select auth.uid())
  )
);
drop policy if exists products_merchant_delete on public.products;
create policy products_merchant_delete on public.products
for delete to authenticated using (
  (select public.is_super_admin()) or exists(
    select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=(select auth.uid())
  )
);

drop policy if exists wallets_read_self_or_admin on public.wallets;
create policy wallets_read_self_or_admin on public.wallets
for select to authenticated using (user_id=(select auth.uid()) or (select public.is_super_admin()));
drop policy if exists ledger_read_self_or_admin on public.wallet_ledger;
create policy ledger_read_self_or_admin on public.wallet_ledger
for select to authenticated using (wallet_user_id=(select auth.uid()) or (select public.is_super_admin()));
drop policy if exists topups_read_self_or_admin on public.wallet_topup_requests;
create policy topups_read_self_or_admin on public.wallet_topup_requests
for select to authenticated using (user_id=(select auth.uid()) or (select public.is_super_admin()));
drop policy if exists topups_insert_self on public.wallet_topup_requests;
create policy topups_insert_self on public.wallet_topup_requests
for insert to authenticated with check (user_id=(select auth.uid()) and status='pending');

drop policy if exists rewards_read_active_or_owner_or_admin on public.reward_campaigns;
create policy rewards_read_active_or_owner_or_admin on public.reward_campaigns
for select to authenticated using (is_active or owner_user_id=(select auth.uid()) or (select public.is_super_admin()));
drop policy if exists rewards_owner_insert on public.reward_campaigns;
create policy rewards_owner_insert on public.reward_campaigns
for insert to authenticated with check (owner_user_id=(select auth.uid()));
drop policy if exists rewards_owner_update on public.reward_campaigns;
create policy rewards_owner_update on public.reward_campaigns
for update to authenticated using (owner_user_id=(select auth.uid()) or (select public.is_super_admin()))
with check (owner_user_id=(select auth.uid()) or (select public.is_super_admin()));
drop policy if exists rewards_owner_delete on public.reward_campaigns;
create policy rewards_owner_delete on public.reward_campaigns
for delete to authenticated using (owner_user_id=(select auth.uid()) or (select public.is_super_admin()));

drop policy if exists orders_read_participant_or_admin on public.orders;
create policy orders_read_participant_or_admin on public.orders
for select to authenticated using (
  customer_id=(select auth.uid()) or captain_user_id=(select auth.uid()) or (select public.is_super_admin())
  or exists(select 1 from public.merchant_profiles m where m.id=merchant_id and m.user_id=(select auth.uid()))
);
drop policy if exists order_items_read_participant on public.order_items;
create policy order_items_read_participant on public.order_items
for select to authenticated using (
  exists(select 1 from public.orders o where o.id=order_id and (
    o.customer_id=(select auth.uid()) or o.captain_user_id=(select auth.uid()) or (select public.is_super_admin())
    or exists(select 1 from public.merchant_profiles m where m.id=o.merchant_id and m.user_id=(select auth.uid()))
  ))
);

drop policy if exists payouts_read_self_or_admin on public.payout_requests;
create policy payouts_read_self_or_admin on public.payout_requests
for select to authenticated using (requester_user_id=(select auth.uid()) or (select public.is_super_admin()));
drop policy if exists payouts_insert_self on public.payout_requests;
create policy payouts_insert_self on public.payout_requests
for insert to authenticated with check (requester_user_id=(select auth.uid()) and status='pending');
drop policy if exists payouts_admin_update on public.payout_requests;
create policy payouts_admin_update on public.payout_requests
for update to authenticated using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));

drop policy if exists notifications_read_self on public.notifications;
create policy notifications_read_self on public.notifications
for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
for update to authenticated using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read on public.audit_logs
for select to authenticated using ((select public.is_super_admin()));
drop policy if exists settings_admin_all on public.platform_settings;
create policy settings_admin_all on public.platform_settings
for all to authenticated using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));

-- Storage policy user identity is evaluated once per statement.
drop policy if exists product_images_owner_upload on storage.objects;
create policy product_images_owner_upload on storage.objects
for insert to authenticated with check (
  bucket_id='product-images'
  and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_super_admin()))
);
drop policy if exists product_images_owner_update on storage.objects;
create policy product_images_owner_update on storage.objects
for update to authenticated using (
  bucket_id='product-images'
  and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_super_admin()))
) with check (
  bucket_id='product-images'
  and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_super_admin()))
);
drop policy if exists product_images_owner_delete on storage.objects;
create policy product_images_owner_delete on storage.objects
for delete to authenticated using (
  bucket_id='product-images'
  and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_super_admin()))
);
