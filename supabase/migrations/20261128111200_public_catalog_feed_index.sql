create index if not exists products_public_catalog_created_idx
  on public.products (created_at desc)
  where is_available is true
    and approval_status = 'approved';
