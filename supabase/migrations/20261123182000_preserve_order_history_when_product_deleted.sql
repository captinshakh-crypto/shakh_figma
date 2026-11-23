alter table public.order_items
  drop constraint if exists order_items_product_id_fkey;

alter table public.order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id)
  references public.products(id)
  on delete set null;

comment on column public.order_items.product_id is
  'Nullable link to the live product. Historical order title, quantity, price, cost and commission snapshots remain intact when a product post is deleted.';
