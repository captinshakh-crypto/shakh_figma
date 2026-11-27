-- Restrict catalog tables to the minimum required Data API privileges.
-- RLS decides which rows an authenticated merchant can modify.
revoke all on table public.product_categories,public.product_subcategories,public.product_variants
from public,anon,authenticated;

grant select on public.product_categories,public.product_subcategories to anon,authenticated;
grant insert,update,delete on public.product_categories,public.product_subcategories to authenticated;
grant select on public.product_variants to anon,authenticated;
grant insert,update,delete on public.product_variants to authenticated;
grant all on public.product_categories,public.product_subcategories,public.product_variants to service_role;
