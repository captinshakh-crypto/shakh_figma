-- Product catalog and inventory integrity for merchant stores and SHAKH Store.
alter table public.products
  add constraint products_stock_nonnegative_check
    check (stock_quantity is null or stock_quantity >= 0),
  add constraint products_title_nonblank_check
    check (length(trim(title)) between 1 and 180),
  add constraint products_category_nonblank_check
    check (length(trim(category_key)) between 1 and 80),
  add constraint products_unit_nonblank_check
    check (length(trim(unit)) between 1 and 24);

create index if not exists products_store_catalog_created_idx
  on public.products (merchant_id, created_at desc)
  where is_shakh_store = false;

create index if not exists products_shakh_store_catalog_created_idx
  on public.products (created_at desc)
  where is_shakh_store = true;

create or replace function public.set_products_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_products_updated_at();
