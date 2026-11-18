-- Merchants own and fully manage their own posts.
-- Super admin has read access to all merchant posts, but write access only to Shakh Store.
drop policy if exists products_merchant_update on public.products;
create policy products_merchant_update on public.products
for update to authenticated
using (
  (is_shakh_store = true and public.is_super_admin())
  or (is_shakh_store = false and exists (
    select 1 from public.merchant_profiles m
    where m.id = products.merchant_id and m.user_id = (select auth.uid())
      and m.approval_status = 'approved'
  ))
)
with check (
  (is_shakh_store = true and public.is_super_admin())
  or (is_shakh_store = false and exists (
    select 1 from public.merchant_profiles m
    where m.id = products.merchant_id and m.user_id = (select auth.uid())
      and m.approval_status = 'approved'
  ))
);

drop policy if exists products_merchant_delete on public.products;
create policy products_merchant_delete on public.products
for delete to authenticated
using (
  (is_shakh_store = true and public.is_super_admin())
  or (is_shakh_store = false and exists (
    select 1 from public.merchant_profiles m
    where m.id = products.merchant_id and m.user_id = (select auth.uid())
      and m.approval_status = 'approved'
  ))
);
