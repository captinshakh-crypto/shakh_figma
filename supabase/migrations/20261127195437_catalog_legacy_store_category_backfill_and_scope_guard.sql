-- Include the legacy SHAKH Store taxonomy keys used by earlier posts.
insert into public.product_categories(store_type,category_key,name,sort_order) values
('shakh_store','supermarket','سوپەرمارکێت',5),
('shakh_store','restaurant','چێشتخانە',6),
('shakh_store','grocery','بەقالی',7),
('shakh_store','butcher_poultry','گۆشت و سپیاتی',8)
on conflict(store_type,category_key) do update set name=excluded.name,sort_order=excluded.sort_order;

-- Metadata-only backfill: do not run the product wallet guard for historical rows.
alter table public.products disable trigger products_wallet_minimum_guard;
update public.products p set category_id=c.id
from public.product_categories c
where p.is_shakh_store=true and c.store_type='shakh_store'
  and c.category_key=p.category_key and p.category_id is null;
alter table public.products enable trigger products_wallet_minimum_guard;

create or replace function public.validate_product_category_scope()
returns trigger language plpgsql set search_path=public,pg_temp
as $function$
declare v_store_type text; v_category_store_type text; v_subcategory_category_id uuid;
begin
  if new.category_id is null then
    if new.subcategory_id is not null then raise exception 'A subcategory requires a selected main category'; end if;
    return new;
  end if;
  select store_type into v_category_store_type from public.product_categories
    where id=new.category_id and is_active=true;
  if v_category_store_type is null then raise exception 'The selected product category is inactive or unavailable'; end if;
  if new.is_shakh_store then
    v_store_type:='shakh_store';
  else
    select merchant_type::text into v_store_type from public.merchant_profiles
      where id=new.merchant_id and approval_status='approved';
  end if;
  if v_store_type is null or v_store_type<>v_category_store_type then
    raise exception 'The selected category does not belong to this store type';
  end if;
  if new.subcategory_id is not null then
    select category_id into v_subcategory_category_id from public.product_subcategories
      where id=new.subcategory_id and is_active=true;
    if v_subcategory_category_id is null or v_subcategory_category_id<>new.category_id then
      raise exception 'The selected subcategory does not belong to the selected category';
    end if;
  end if;
  return new;
end;
$function$;
drop trigger if exists products_validate_category_scope on public.products;
create trigger products_validate_category_scope
before insert or update of category_id,subcategory_id,merchant_id,is_shakh_store on public.products
for each row execute function public.validate_product_category_scope();

revoke insert,update,delete on public.product_categories,public.product_subcategories,public.product_variants from anon;
