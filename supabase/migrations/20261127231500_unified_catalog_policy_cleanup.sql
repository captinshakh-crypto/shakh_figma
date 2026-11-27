-- Avoid duplicated permissive SELECT policies and keep internal checkout helpers private.
drop policy if exists product_categories_admin_manage on public.product_categories;
create policy product_categories_admin_insert on public.product_categories
for insert to authenticated with check ((select public.is_super_admin()));
create policy product_categories_admin_update on public.product_categories
for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy product_categories_admin_delete on public.product_categories
for delete to authenticated using ((select public.is_super_admin()));

drop policy if exists product_subcategories_admin_manage on public.product_subcategories;
create policy product_subcategories_admin_insert on public.product_subcategories
for insert to authenticated with check ((select public.is_super_admin()));
create policy product_subcategories_admin_update on public.product_subcategories
for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy product_subcategories_admin_delete on public.product_subcategories
for delete to authenticated using ((select public.is_super_admin()));

revoke all on function public.create_order_v2(uuid,uuid,jsonb,text,text,text,uuid,bigint,text) from public,anon,authenticated;

drop trigger if exists product_categories_set_updated_at on public.product_categories;
create trigger product_categories_set_updated_at before update on public.product_categories
for each row execute function public.set_products_updated_at();
drop trigger if exists product_subcategories_set_updated_at on public.product_subcategories;
create trigger product_subcategories_set_updated_at before update on public.product_subcategories
for each row execute function public.set_products_updated_at();
drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_products_updated_at();
