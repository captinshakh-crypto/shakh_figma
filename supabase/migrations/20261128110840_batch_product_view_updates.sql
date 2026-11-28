create or replace function public.increment_product_views(p_product_ids uuid[])
returns table(product_id uuid, views_count bigint)
language sql
security definer
set search_path = ''
as $$
  update public.products as product
  set views_count = coalesce(product.views_count, 0) + 1
  where product.id = any(coalesce(p_product_ids, array[]::uuid[]))
    and product.is_available is true
    and product.approval_status = 'approved'
  returning product.id, product.views_count;
$$;

revoke all on function public.increment_product_views(uuid[]) from public;
grant execute on function public.increment_product_views(uuid[]) to anon, authenticated;
drop function if exists public.increment_product_view(uuid);
