alter table public.products
  add column if not exists views_count bigint not null default 0;

create or replace function public.increment_product_view(p_product_id uuid)
returns bigint
language sql
security definer
set search_path = ''
as $$
  update public.products
  set views_count = coalesce(views_count, 0) + 1
  where id = p_product_id
    and is_available is true
    and approval_status = 'approved'
  returning views_count;
$$;

revoke all on function public.increment_product_view(uuid) from public;
grant execute on function public.increment_product_view(uuid) to anon, authenticated;
grant select (views_count) on public.products to anon, authenticated;
