-- SKU uniqueness applies to active options only. A removed option can be re-created later.
alter table public.product_variants
  drop constraint if exists product_variants_product_id_sku_key;
create unique index if not exists product_variants_active_sku_uidx
  on public.product_variants(product_id,sku)
  where sku is not null and is_active=true;
