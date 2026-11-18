drop trigger if exists products_wallet_minimum_guard on public.products;
create trigger products_wallet_minimum_guard
before insert or update on public.products
for each row execute function private.enforce_product_wallet_minimum();