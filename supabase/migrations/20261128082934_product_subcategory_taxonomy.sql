insert into public.product_subcategories (category_id,subcategory_key,name,sort_order,is_active)
select c.id, v.subcategory_key, v.name, v.sort_order, true
from (values
('supermarket','groceries','خواردەمەنی',10),('supermarket','beverages','خواردنەوەکان',20),('supermarket','cleaning','پاککەرەوەکان',30),('supermarket','biscuits_snacks','بسکویت و سناکس',40),('supermarket','dairy','شیرەمەنی و هێلکە',50),('supermarket','personal_care','چاودێری کەسی',60),('supermarket','frozen','بەرهەمی ساردکراو',70),('supermarket','sweets','شیرینی و چۆکڵێت',80),('supermarket','bread_bakery','نان و بەرهەمی نانەوا',90),('supermarket','baby_care','پێداویستی منداڵ',100),('supermarket','household','پێداویستی ماڵ',110),('supermarket','tea_coffee','چای و قاوە',120),('supermarket','miscellaneous','کاڵای جۆراوجۆر',130),
('restaurant','breakfast','نانی بەیانی',10),('restaurant','meals','خواردنی سەرەکی',20),('restaurant','grills','گریل و کەباب',30),('restaurant','fast_food','فاست فوود',40),('restaurant','sides','خواردنی لاوەکی',50),('restaurant','drinks','خواردنەوەکان',60),('restaurant','desserts','شیرینی',70),('restaurant','extras','زیادکراوە',80),
('grocery','vegetables','سەوزەوات',10),('grocery','fruits','میوە',20),('grocery','leafy_greens','سەوزەی گەڵادار',30),('grocery','herbs','گیا و بەهارات',40),('grocery','potatoes_onions','پەتاتە و پیاز',50),('grocery','staples','بەرهەمی وشک و پێداویستی بنەڕەتی',60),('grocery','dairy_eggs','شیرەمەنی و هێلکە',70),('grocery','pickles','ترشی و هاوپێچ',80),
('butcher_poultry','beef','گۆشتی مانگا',10),('butcher_poultry','lamb','گۆشتی مەڕ و بەرخ',20),('butcher_poultry','chicken','گۆشتی مریشک',30),('butcher_poultry','poultry','باڵندە',40),('butcher_poultry','ground_meat','گۆشتی هاڕاو',50),('butcher_poultry','prepared_meat','گۆشتی ئامادەکراو',60),('butcher_poultry','spices','بەهارات و سپیاتی',70),('butcher_poultry','herbs','سەوزە و گیا بەهاراتییەکان',80),('butcher_poultry','dairy','پەنیر و شیرەمەنی',90),('butcher_poultry','miscellaneous','کاڵای جۆراوجۆر',100),
('general','miscellaneous','کاڵای جۆراوجۆر',10)
) as v(parent_key,subcategory_key,name,sort_order)
join public.product_categories c on c.store_type='shakh_store' and c.category_key=v.parent_key
on conflict(category_id,subcategory_key) do update set
 name=excluded.name,sort_order=excluded.sort_order,is_active=true;

insert into public.product_subcategories (category_id,subcategory_key,name,sort_order,is_active)
select c.id,v.subcategory_key,v.name,v.sort_order,true
from (values ('turkey','بوقلمون',10),('duck','مریشکی ئاوایی و مراوی',20),('quail','کەوتر',30)) as v(subcategory_key,name,sort_order)
join public.product_categories c on c.store_type='butcher_poultry' and c.category_key='poultry'
on conflict(category_id,subcategory_key) do update set
 name=excluded.name,sort_order=excluded.sort_order,is_active=true;

alter table public.products disable trigger products_wallet_minimum_guard;
with assignments(product_id,parent_key,subcategory_key) as (values
('0f314f1a-1c78-404a-b853-c77054e975b2'::uuid,'restaurant','meals'),
('ac7458d7-4d10-4e2a-9fe1-aa970fb5cdd6'::uuid,'restaurant','drinks'),
('3b8deba5-6e9d-4085-ac64-593be789310c'::uuid,'restaurant','drinks'),
('a7c82584-c8a7-47e1-b02d-77ce1e842f8e'::uuid,'supermarket','personal_care'),
('294b0383-ffc8-480e-b11a-fa95d12ddea3'::uuid,'supermarket','personal_care'),
('4a0acbe2-848f-4a24-a886-7a45f732fcb0'::uuid,'supermarket','miscellaneous'),
('2210fba6-4fc3-4c35-b454-85226558dc14'::uuid,'supermarket','miscellaneous'),
('82e51d62-2051-4dd5-9627-6e0b0a42ef80'::uuid,'supermarket','cleaning'),
('43faaa17-b549-47f4-ac37-bc7473fec80e'::uuid,'supermarket','cleaning'),
('8800eaa6-d5e0-40e8-9b70-9cd22142e7cb'::uuid,'supermarket','cleaning'),
('b00072da-e0bb-443b-89c8-4939c2596267'::uuid,'supermarket','cleaning'),
('c63fd05b-2bbc-45dc-8727-52b23b70b7be'::uuid,'supermarket','personal_care'),
('6d15041d-f8aa-45f0-a5e0-f18497bf98dd'::uuid,'supermarket','personal_care'),
('9e4bb292-b396-4406-89b1-59d08b1d752a'::uuid,'supermarket','personal_care'),
('bf1e2052-d42d-4dbc-a2d9-64d393999527'::uuid,'supermarket','personal_care'),
('9d40453a-4cf2-424a-bf80-bf06016d8edb'::uuid,'supermarket','personal_care'),
('e56f65cc-c4b4-4f68-b87b-476a0a6481aa'::uuid,'supermarket','personal_care'),
('bd46c5f5-c5e7-4ac5-810b-dcc876986f8b'::uuid,'supermarket','personal_care'),
('53c59863-fe54-4f9a-944e-b8f1ffcf35e8'::uuid,'supermarket','personal_care'),
('9a7385c5-e3f5-4273-9d42-e7428156ed91'::uuid,'supermarket','personal_care'),
('e1586045-27a5-45b3-916d-e6f7afcd7b64'::uuid,'supermarket','tea_coffee'),
('074a0c0d-7e65-4b79-adde-e3374616ba9c'::uuid,'supermarket','groceries'),
('2096b7ab-8f10-4bf7-8d31-bbf17251a5eb'::uuid,'supermarket','groceries'),
('4e39f541-36d5-428b-b653-849c8947315b'::uuid,'supermarket','tea_coffee'),
('97215403-5191-4cb5-a4ea-a323a9402d19'::uuid,'butcher_poultry','dairy'),
('1d89059f-0985-4b3d-95f3-c91110a8ebf5'::uuid,'butcher_poultry','dairy')
)
update public.products p set subcategory_id=s.id
from assignments a
join public.product_categories c on c.store_type='shakh_store' and c.category_key=a.parent_key
join public.product_subcategories s on s.category_id=c.id and s.subcategory_key=a.subcategory_key
where p.id=a.product_id and p.category_id=c.id and p.subcategory_id is null;
alter table public.products enable trigger products_wallet_minimum_guard;

create or replace function public.validate_product_category_scope()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_store_type text;
  v_category_store_type text;
  v_subcategory_category_id uuid;
begin
  if new.category_id is null then
    if new.subcategory_id is not null then
      raise exception 'A subcategory requires a selected main category';
    end if;
    return new;
  end if;
  select store_type into v_category_store_type
  from public.product_categories where id=new.category_id and is_active=true;
  if v_category_store_type is null then raise exception 'The selected product category is inactive or unavailable'; end if;
  if new.is_shakh_store then
    v_store_type := 'shakh_store';
  else
    select merchant_type::text into v_store_type
    from public.merchant_profiles where id=new.merchant_id and approval_status='approved';
  end if;
  if v_store_type is null or v_store_type <> v_category_store_type then
    raise exception 'The selected category does not belong to this store type';
  end if;
  if new.subcategory_id is null and exists (
    select 1 from public.product_subcategories where category_id=new.category_id and is_active=true
  ) then
    raise exception 'A subcategory is required for this product category';
  end if;
  if new.subcategory_id is not null then
    select category_id into v_subcategory_category_id
    from public.product_subcategories where id=new.subcategory_id and is_active=true;
    if v_subcategory_category_id is null or v_subcategory_category_id <> new.category_id then
      raise exception 'The selected subcategory does not belong to the selected category';
    end if;
  end if;
  return new;
end;
$function$;