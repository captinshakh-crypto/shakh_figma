-- Unified centralized category catalog and product options for SHAKH.
-- Existing product/order columns remain supported for legacy posts and carts.

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  store_type text not null check (store_type in ('supermarket','restaurant','butcher_poultry','grocery','shakh_store')),
  category_key text not null check (length(trim(category_key)) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 120),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_type, category_key)
);

create table if not exists public.product_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_categories(id) on delete restrict,
  subcategory_key text not null check (length(trim(subcategory_key)) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 120),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, subcategory_key)
);

insert into public.product_categories(store_type,category_key,name,sort_order) values
('butcher_poultry','beef','گۆشتی مانگا',10),
('butcher_poultry','lamb','گۆشتی مەڕ و بەرخ',20),
('butcher_poultry','chicken','گۆشتی مریشک',30),
('butcher_poultry','poultry','باڵندە',40),
('butcher_poultry','ground_meat','گۆشتی هاڕاو',50),
('butcher_poultry','prepared_meat','گۆشتی ئامادەکراو',60),
('butcher_poultry','spices','بەهارات و سپیاتی',70),
('butcher_poultry','herbs','سەوزە و گیا بەهاراتییەکان',80),
('grocery','vegetables','سەوزەوات',10),
('grocery','fruits','میوە',20),
('grocery','leafy_greens','سەوزەی گەڵادار',30),
('grocery','herbs','گیا و بەهارات',40),
('grocery','potatoes_onions','پەتاتە و پیاز',50),
('grocery','staples','بەرهەمی وشک و پێداویستی بنەڕەتی',60),
('grocery','dairy_eggs','شیرەمەنی و هێلکە',70),
('grocery','pickles','ترشی و هاوپێچ',80),
('restaurant','breakfast','نانی بەیانی',10),
('restaurant','meals','خواردنی سەرەکی',20),
('restaurant','grills','گریل و کەباب',30),
('restaurant','fast_food','فاست فوود',40),
('restaurant','sides','خواردنی لاوەکی',50),
('restaurant','drinks','خواردنەوەکان',60),
('restaurant','desserts','شیرینی',70),
('restaurant','extras','زیادکراوە',80),
('shakh_store','general','گشتی',10),
('shakh_store','household','پێداویستی ماڵ',20),
('shakh_store','electronics','ئەلیکترۆنیات',30),
('shakh_store','accessories','ئاکسسوارات',40),
('shakh_store','personal_care','چاودێری کەسی',50),
('shakh_store','kitchen_tools','ئامراز و پێداویستی چێشتخانە',60),
('supermarket','groceries','خواردەمەنی',10),
('supermarket','cleaning','پاککەرەوەکان',20),
('supermarket','biscuits_snacks','بسکویت و سناکس',30),
('supermarket','beverages','خواردنەوەکان',40),
('supermarket','dairy','شیرەمەنی و هێلکە',50),
('supermarket','personal_care','چاودێری کەسی',60),
('supermarket','frozen','بەرهەمی ساردکراو',70),
('supermarket','sweets','شیرینی و چۆکڵێت',80),
('supermarket','bread_bakery','نان و بەرهەمی نانەوا',90),
('supermarket','baby_care','پێداویستی منداڵ',100),
('supermarket','household','پێداویستی ماڵ',110),
('supermarket','tea_coffee','چای و قاوە',120)
on conflict (store_type,category_key) do update
set name=excluded.name,sort_order=excluded.sort_order;

with seed(store_type,category_key,subcategory_key,name,sort_order) as (
  values
('butcher_poultry','beef','boneless','گۆشتی بێ ئێسک',10),
('butcher_poultry','beef','bone_in','گۆشتی ئێسکدار',20),
('butcher_poultry','lamb','lamb_cuts','پارچەی گۆشتی مەڕ',10),
('butcher_poultry','lamb','lamb_ribs','پەراسووی مەڕ',20),
('butcher_poultry','chicken','whole_chicken','مریشکی تەواو',10),
('butcher_poultry','chicken','breast','سینگی مریشک',20),
('butcher_poultry','chicken','wings','باڵی مریشک',30),
('butcher_poultry','chicken','legs','لاقی مریشک',40),
('butcher_poultry','ground_meat','beef_mince','گۆشتی هاڕاوی مانگا',10),
('butcher_poultry','ground_meat','lamb_mince','گۆشتی هاڕاوی مەڕ',20),
('butcher_poultry','prepared_meat','kebab_ready','کەبابی ئامادە',10),
('butcher_poultry','prepared_meat','kofta','کوفتە',20),
('butcher_poultry','spices','pepper','فلفل',10),
('butcher_poultry','spices','turmeric','زەردەچاوە',20),
('butcher_poultry','spices','curry','کاری',30),
('butcher_poultry','spices','mixed_spices','تێکەڵەی بەهارات',40),
('butcher_poultry','herbs','garlic','سیر',10),
('butcher_poultry','herbs','onion','پیاز',20),
('butcher_poultry','herbs','lemon','لیمۆ',30),
('grocery','vegetables','tomatoes','تەماتە',10),
('grocery','vegetables','cucumbers','خیار',20),
('grocery','vegetables','eggplant','بادمجان',30),
('grocery','vegetables','peppers','فلفل',40),
('grocery','fruits','apples','سێو',10),
('grocery','fruits','oranges','پرتەقاڵ',20),
('grocery','fruits','bananas','مۆز',30),
('grocery','fruits','grapes','ترێ',40),
('grocery','leafy_greens','lettuce','کاهو',10),
('grocery','leafy_greens','spinach','سپێناخ',20),
('grocery','leafy_greens','celery','کرفس',30),
('grocery','herbs','mint','نەعناع',10),
('grocery','herbs','parsley','مەعدەنوس',20),
('grocery','herbs','coriander','گشنیز',30),
('grocery','potatoes_onions','potatoes','پەتاتە',10),
('grocery','potatoes_onions','onions','پیاز',20),
('grocery','potatoes_onions','garlic','سیر',30),
('grocery','staples','lentils','نیسک',10),
('grocery','staples','chickpeas','نۆک',20),
('grocery','staples','beans','لوبیا',30),
('grocery','staples','rice','برنج',40),
('grocery','dairy_eggs','milk','شیر',10),
('grocery','dairy_eggs','yogurt','ماست',20),
('grocery','dairy_eggs','cheese','پەنیر',30),
('grocery','dairy_eggs','eggs','هێلکە',40),
('grocery','pickles','pickles','ترشی',10),
('grocery','pickles','olives','زەیتوون',20),
('restaurant','breakfast','eggs','هێلکە',10),
('restaurant','breakfast','sandwiches','ساندویچی بەیانی',20),
('restaurant','breakfast','falafel','فەلافل',30),
('restaurant','meals','rice_dishes','خواردنی برنج',10),
('restaurant','meals','dolma','دۆڵمە',20),
('restaurant','meals','local_food','خواردنی ناوخۆیی',30),
('restaurant','grills','kebab','کەباب',10),
('restaurant','grills','chicken_grill','مریشکی گریل',20),
('restaurant','grills','meat_grill','گۆشتی گریل',30),
('restaurant','fast_food','burger','برگر',10),
('restaurant','fast_food','pizza','پیتزا',20),
('restaurant','fast_food','shawarma','شاورمە',30),
('restaurant','sides','fries','فرێ',10),
('restaurant','sides','salad','سالات',20),
('restaurant','sides','soup','سوپ',30),
('restaurant','drinks','water','ئاو',10),
('restaurant','drinks','juice','شەربەت',20),
('restaurant','drinks','tea_coffee','چای و قاوە',30),
('restaurant','desserts','cake','کێک',10),
('restaurant','desserts','ice_cream','ئایسکرێم',20),
('restaurant','desserts','kunafa','کنافی',30),
('restaurant','extras','cheese','پەنیر',10),
('restaurant','extras','sauce','سۆس',20),
('restaurant','extras','extra_meat','زیادەی گۆشت',30),
('shakh_store','household','kitchen','پێداویستی چێشتخانە',10),
('shakh_store','household','home_tools','ئامرازی ماڵ',20),
('shakh_store','electronics','small_appliances','ئامێری کارەبایی',10),
('shakh_store','electronics','lighting','چراغ و ڕووناکی',20),
('shakh_store','electronics','electronic_devices','ئامێری ئەلیکترۆنی',30),
('shakh_store','accessories','phone_accessories','ئاکسسواراتی مۆبایل',10),
('shakh_store','accessories','cables_chargers','کێبڵ و شارژەر',20),
('shakh_store','accessories','headphones','هێدفۆن',30),
('shakh_store','personal_care','hygiene','پاکوخاوێنی کەسی',10),
('shakh_store','kitchen_tools','utensils','ئامرازی چێشتخانە',10),
('shakh_store','kitchen_tools','storage','کۆگاکردن و ڕێکخستن',20),
('supermarket','groceries','rice','برنج',10),
('supermarket','groceries','grains','دانەوێڵە و حبوبات',20),
('supermarket','groceries','pasta','ماکارۆنی و پاستا',30),
('supermarket','groceries','oil','ڕۆن',40),
('supermarket','groceries','sugar_salt','شەکر و خوێ',50),
('supermarket','cleaning','laundry','پۆدری جلشۆر و جلپاککەرەوە',10),
('supermarket','cleaning','dishwashing','مایعی قاپشۆر',20),
('supermarket','cleaning','floor','پاککەرەوەی زەوی',30),
('supermarket','cleaning','bathroom','پاککەرەوەی حەمام',40),
('supermarket','biscuits_snacks','biscuits','بسکویت',10),
('supermarket','biscuits_snacks','wafers','وەیفەر',20),
('supermarket','biscuits_snacks','chips','چیپس',30),
('supermarket','biscuits_snacks','popcorn','پۆپکۆرن',40),
('supermarket','beverages','water','ئاو',10),
('supermarket','beverages','juice','شەربەت',20),
('supermarket','beverages','soft_drinks','خواردنەوەی گازی',30),
('supermarket','beverages','energy_drinks','خواردنەوەی وزەبەخش',40),
('supermarket','dairy','milk','شیر',10),
('supermarket','dairy','yogurt','ماست',20),
('supermarket','dairy','cheese','پەنیر',30),
('supermarket','dairy','eggs','هێلکە',40),
('supermarket','personal_care','soap','سابون',10),
('supermarket','personal_care','shampoo','شامپۆ',20),
('supermarket','personal_care','cream','کرێم',30),
('supermarket','personal_care','oral_care','مسواک و خمیرەدەن',40),
('supermarket','frozen','frozen_meat','گۆشتی ساردکراو',10),
('supermarket','frozen','frozen_chicken','مریشکی ساردکراو',20),
('supermarket','frozen','ready_meals','خواردنی ئامادە',30),
('supermarket','sweets','chocolate','چۆکڵێت',10),
('supermarket','sweets','cakes','کێک و شیرینی',20),
('supermarket','bread_bakery','bread','نان',10),
('supermarket','bread_bakery','pastries','کلێچە و بەرهەمی نانەوا',20),
('supermarket','baby_care','diapers','پەمپەرس',10),
('supermarket','baby_care','formula','شیرەوشک',20),
('supermarket','household','bags','کیسە و پاکەت',10),
('supermarket','household','cleaning_tools','ئامرازی پاککردنەوە',20),
('supermarket','tea_coffee','tea','چای',10),
('supermarket','tea_coffee','coffee','قاوە',20)
)
insert into public.product_subcategories(category_id,subcategory_key,name,sort_order)
select c.id,s.subcategory_key,s.name,s.sort_order
from seed s join public.product_categories c
  on c.store_type=s.store_type and c.category_key=s.category_key
on conflict(category_id,subcategory_key) do update
set name=excluded.name,sort_order=excluded.sort_order;

alter table public.products
  add column if not exists category_id uuid references public.product_categories(id) on delete set null,
  add column if not exists subcategory_id uuid references public.product_subcategories(id) on delete set null;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,
  variant_label text not null check (length(trim(variant_label)) between 1 and 160),
  color_name text,
  color_hex text check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  scent text,
  size_label text,
  unit text,
  price_iqd bigint not null check (price_iqd > 0),
  cost_price_iqd bigint check (cost_price_iqd is null or cost_price_iqd >= 0),
  stock_quantity numeric(12,3) check (stock_quantity is null or stock_quantity >= 0),
  image_path text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id,sku)
);

alter table public.order_items
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null,
  add column if not exists variant_snapshot jsonb not null default '{}'::jsonb;

create index if not exists product_categories_store_active_sort_idx on public.product_categories(store_type,is_active,sort_order,name);
create index if not exists product_subcategories_category_active_sort_idx on public.product_subcategories(category_id,is_active,sort_order,name);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_subcategory_id_idx on public.products(subcategory_id);
create index if not exists product_variants_product_active_sort_idx on public.product_variants(product_id,is_active,sort_order);
create index if not exists product_variants_sku_idx on public.product_variants(sku) where sku is not null;
create index if not exists order_items_variant_id_idx on public.order_items(variant_id);

alter table public.product_categories enable row level security;
alter table public.product_subcategories enable row level security;
alter table public.product_variants enable row level security;

grant select on public.product_categories,public.product_subcategories to anon,authenticated;
grant select,insert,update,delete on public.product_categories,public.product_subcategories to authenticated;
grant select on public.product_variants to anon;
grant select,insert,update,delete on public.product_variants to authenticated;
grant all on public.product_categories,public.product_subcategories,public.product_variants to service_role;
revoke insert,update,delete on public.product_categories,public.product_subcategories,public.product_variants from anon;

drop policy if exists product_categories_active_read on public.product_categories;
create policy product_categories_active_read on public.product_categories
for select to anon,authenticated
using (is_active or (select public.is_super_admin()));

drop policy if exists product_categories_admin_manage on public.product_categories;
create policy product_categories_admin_manage on public.product_categories
for all to authenticated
using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));

drop policy if exists product_subcategories_active_read on public.product_subcategories;
create policy product_subcategories_active_read on public.product_subcategories
for select to anon,authenticated
using (
  (is_active and exists(select 1 from public.product_categories c where c.id=category_id and c.is_active=true))
  or (select public.is_super_admin())
);

drop policy if exists product_subcategories_admin_manage on public.product_subcategories;
create policy product_subcategories_admin_manage on public.product_subcategories
for all to authenticated
using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));

drop policy if exists product_variants_public_catalog_read on public.product_variants;
create policy product_variants_public_catalog_read on public.product_variants
for select to anon
using (is_active and exists(select 1 from public.products p where p.id=product_id and p.is_available=true and p.approval_status='approved'));

drop policy if exists product_variants_authenticated_catalog_or_owner_read on public.product_variants;
create policy product_variants_authenticated_catalog_or_owner_read on public.product_variants
for select to authenticated
using (
  (is_active and exists(select 1 from public.products p where p.id=product_id and p.is_available=true and p.approval_status='approved'))
  or (select public.is_super_admin())
  or exists(select 1 from public.products p join public.merchant_profiles m on m.id=p.merchant_id
    where p.id=product_id and m.user_id=(select auth.uid()))
);

drop policy if exists product_variants_owner_insert on public.product_variants;
create policy product_variants_owner_insert on public.product_variants
for insert to authenticated
with check (
  (select public.is_super_admin())
  or exists(select 1 from public.products p join public.merchant_profiles m on m.id=p.merchant_id
    where p.id=product_id and p.is_shakh_store=false and m.user_id=(select auth.uid()) and m.approval_status='approved')
);

drop policy if exists product_variants_owner_update on public.product_variants;
create policy product_variants_owner_update on public.product_variants
for update to authenticated
using (
  (select public.is_super_admin())
  or exists(select 1 from public.products p join public.merchant_profiles m on m.id=p.merchant_id
    where p.id=product_id and p.is_shakh_store=false and m.user_id=(select auth.uid()) and m.approval_status='approved')
)
with check (
  (select public.is_super_admin())
  or exists(select 1 from public.products p join public.merchant_profiles m on m.id=p.merchant_id
    where p.id=product_id and p.is_shakh_store=false and m.user_id=(select auth.uid()) and m.approval_status='approved')
);

drop policy if exists product_variants_owner_delete on public.product_variants;
create policy product_variants_owner_delete on public.product_variants
for delete to authenticated
using (
  (select public.is_super_admin())
  or exists(select 1 from public.products p join public.merchant_profiles m on m.id=p.merchant_id
    where p.id=product_id and p.is_shakh_store=false and m.user_id=(select auth.uid()) and m.approval_status='approved')
);

CREATE OR REPLACE FUNCTION private.snapshot_product_cost()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_variant_cost bigint;
  v_product_cost bigint;
begin
  if new.variant_id is not null then
    select v.cost_price_iqd, p.cost_price_iqd
      into v_variant_cost, v_product_cost
    from public.product_variants v
    join public.products p on p.id=v.product_id
    where v.id=new.variant_id;
    new.cost_price_snapshot_iqd := coalesce(v_variant_cost, v_product_cost);
  elsif new.product_id is not null then
    select cost_price_iqd into new.cost_price_snapshot_iqd
    from public.products where id=new.product_id;
  end if;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.create_order_v2(p_merchant_id uuid, p_service_zone_id uuid, p_items jsonb, p_delivery_address text, p_delivery_phone text, p_delivery_notes text DEFAULT NULL::text, p_reward_campaign_id uuid DEFAULT NULL::uuid, p_reward_amount_iqd bigint DEFAULT 0, p_idempotency_key text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order_id uuid;
  v_existing_customer uuid;
  v_subtotal bigint:=0;
  v_delivery bigint;
  v_total bigint;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_variant_id uuid;
  v_qty numeric(12,3);
  v_line bigint;
  v_price bigint;
  v_available_stock numeric(12,3);
  v_variant_snapshot jsonb;
  v_variant_text text;
  v_reward_total bigint:=0;
  v_merchant_commission bigint:=0;
  v_fixed_per_unit bigint:=0;
  v_reward_owner uuid;
  v_merchant_owner uuid;
  v_merchant_type public.app_role;
  v_prepaid_total bigint;
  v_rows integer;
  v_role public.app_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('customer','super_admin') then raise exception 'Only customers can checkout'; end if;
  if nullif(trim(coalesce(p_delivery_address,'')),'') is null or length(trim(p_delivery_address))<8 or length(trim(p_delivery_address))>500 then
    raise exception 'Enter a complete delivery address (8 to 500 characters)';
  end if;
  if p_delivery_phone is null or length(regexp_replace(p_delivery_phone,'[^0-9]','','g'))<7
     or length(regexp_replace(p_delivery_phone,'[^0-9]','','g'))>20 or p_delivery_phone !~ '^[0-9+()[:space:]-]+$' then
    raise exception 'Enter a valid contact phone number';
  end if;
  if p_delivery_notes is not null and length(trim(p_delivery_notes))>500 then raise exception 'Delivery notes are too long'; end if;
  if p_idempotency_key is null or length(p_idempotency_key)<16 or length(p_idempotency_key)>100 then raise exception 'A valid checkout request key is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_idempotency_key,0));
  select id,customer_id into v_order_id,v_existing_customer from public.orders where idempotency_key=p_idempotency_key;
  if found then
    if v_existing_customer<>auth.uid() then raise exception 'Checkout request key already used'; end if;
    return v_order_id;
  end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_items) item
    group by item->>'product_id', coalesce(nullif(item->>'variant_id',''),'base')
    having count(*)>1
  ) then raise exception 'Duplicate product option lines are not allowed'; end if;
  if coalesce(p_reward_amount_iqd,0)<>0 then raise exception 'Referral rewards are paid by the merchant, not added to the customer total'; end if;
  if p_merchant_id is not null then
    select user_id,merchant_type into v_merchant_owner,v_merchant_type
    from public.merchant_profiles where id=p_merchant_id and approval_status='approved';
    if v_merchant_owner is null then raise exception 'Merchant is unavailable'; end if;
    select coalesce(fixed_commission_per_unit_iqd,0) into v_fixed_per_unit
    from public.commission_settings where merchant_type=v_merchant_type;
  else
    select id into v_merchant_owner from public.profiles
    where role='super_admin' and is_active=true order by created_at asc limit 1;
  end if;
  if v_merchant_owner is null then raise exception 'Store owner is unavailable'; end if;
  select delivery_fee_iqd into v_delivery from public.service_zones where id=p_service_zone_id and is_active=true;
  if v_delivery is null then raise exception 'Delivery zone is unavailable'; end if;
  if p_reward_campaign_id is not null then
    select owner_user_id into v_reward_owner from public.reward_campaigns
    where id=p_reward_campaign_id and is_active=true;
    if v_reward_owner is null then raise exception 'Referral link is unavailable'; end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if nullif(v_item->>'product_id','') is null then raise exception 'Invalid product'; end if;
    select * into v_product from public.products
    where id=(v_item->>'product_id')::uuid
      and merchant_id is not distinct from p_merchant_id
      and is_shakh_store=(p_merchant_id is null)
      and is_available=true
      and approval_status='approved'
    for update;
    if not found then raise exception 'A product is unavailable'; end if;
    v_variant_id:=nullif(v_item->>'variant_id','')::uuid;
    v_variant:=null;
    if v_variant_id is not null then
      select * into v_variant from public.product_variants
      where id=v_variant_id and product_id=v_product.id and is_active=true
      for update;
      if not found then raise exception 'The selected product option is unavailable'; end if;
      v_price:=v_variant.price_iqd;
      v_available_stock:=v_variant.stock_quantity;
    else
      if exists(select 1 from public.product_variants where product_id=v_product.id and is_active=true) then
        raise exception 'Select an option for: %',v_product.title;
      end if;
      v_price:=v_product.price_iqd;
      v_available_stock:=v_product.stock_quantity;
    end if;
    v_qty:=(v_item->>'quantity')::numeric;
    if v_qty is null or v_qty<=0 or v_qty>10000 then raise exception 'Invalid product quantity'; end if;
    if v_available_stock is not null and v_available_stock<v_qty then
      raise exception 'Insufficient product option stock for: %',v_product.title;
    end if;
    v_subtotal:=v_subtotal+round(v_price*v_qty)::bigint;
    if p_merchant_id is not null then
      v_merchant_commission:=v_merchant_commission+round(v_fixed_per_unit*v_qty)::bigint;
    end if;
    if p_reward_campaign_id is not null then
      v_reward_total:=v_reward_total+round(v_product.referral_commission_iqd*v_qty)::bigint;
    end if;
  end loop;

  v_total:=v_subtotal+v_delivery;
  v_prepaid_total:=v_merchant_commission+v_reward_total;
  insert into public.orders(customer_id,merchant_id,service_zone_id,subtotal_iqd,delivery_fee_iqd,
    merchant_commission_iqd,reward_campaign_id,reward_amount_iqd,total_iqd,status,
    delivery_address,delivery_phone,delivery_notes,idempotency_key)
  values(auth.uid(),p_merchant_id,p_service_zone_id,v_subtotal,v_delivery,
    v_merchant_commission,p_reward_campaign_id,v_reward_total,v_total,'placed',
    trim(p_delivery_address),trim(p_delivery_phone),nullif(trim(coalesce(p_delivery_notes,'')),''),p_idempotency_key)
  returning id into v_order_id;

  if v_prepaid_total>0 then
    insert into public.wallets(user_id,balance_iqd) values(v_merchant_owner,0) on conflict(user_id) do nothing;
    update public.wallets set balance_iqd=balance_iqd-v_prepaid_total,updated_at=now()
    where user_id=v_merchant_owner and balance_iqd>=v_prepaid_total;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Store wallet balance is insufficient for prepaid sale and referral commissions'; end if;
    if v_merchant_commission>0 then
      insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
      values(v_merchant_owner,'merchant_commission',v_merchant_commission,'debit','merchant_sale_commission',v_order_id,
        'merchant-sale-commission:'||v_order_id::text,'Prepaid fixed commission for products sold',auth.uid());
    end if;
    if v_reward_total>0 then
      insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
      values(v_merchant_owner,'merchant_commission',v_reward_total,'debit','referral_reward_reserve',v_order_id,
        'referral-reserve:'||v_order_id::text,'Prepaid referral reward reserved for this order',auth.uid());
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
    where id=(v_item->>'product_id')::uuid
      and merchant_id is not distinct from p_merchant_id
      and is_shakh_store=(p_merchant_id is null)
      and is_available=true
      and approval_status='approved'
    for update;
    v_variant_id:=nullif(v_item->>'variant_id','')::uuid;
    v_variant:=null;
    if v_variant_id is not null then
      select * into v_variant from public.product_variants
      where id=v_variant_id and product_id=v_product.id and is_active=true
      for update;
      if not found then raise exception 'The selected product option is unavailable'; end if;
      v_price:=v_variant.price_iqd;
      v_available_stock:=v_variant.stock_quantity;
      v_variant_snapshot:=jsonb_build_object(
        'variant_id',v_variant.id,
        'label',v_variant.variant_label,
        'color_name',v_variant.color_name,
        'color_hex',v_variant.color_hex,
        'scent',v_variant.scent,
        'size_label',v_variant.size_label,
        'unit',coalesce(v_variant.unit,v_product.unit),
        'sku',v_variant.sku
      );
      v_variant_text:=concat_ws(' / ',nullif(v_variant.variant_label,''),nullif(v_variant.color_name,''),nullif(v_variant.scent,''),nullif(v_variant.size_label,''));
    else
      if exists(select 1 from public.product_variants where product_id=v_product.id and is_active=true) then
        raise exception 'Select an option for: %',v_product.title;
      end if;
      v_price:=v_product.price_iqd;
      v_available_stock:=v_product.stock_quantity;
      v_variant_snapshot:='{}'::jsonb;
      v_variant_text:=null;
    end if;
    v_qty:=(v_item->>'quantity')::numeric;
    v_line:=round(v_price*v_qty)::bigint;
    insert into public.order_items(
      order_id,product_id,product_title_snapshot,quantity,unit_price_iqd,line_total_iqd,
      referral_commission_snapshot_iqd,variant_id,variant_snapshot
    )
    values(
      v_order_id,v_product.id,
      case when v_variant_text is null then v_product.title else v_product.title||' — '||v_variant_text end,
      v_qty,v_price,v_line,
      case when p_reward_campaign_id is not null then v_product.referral_commission_iqd else 0 end,
      v_variant_id,v_variant_snapshot
    );
    if v_variant_id is not null then
      if v_available_stock is not null then
        update public.product_variants set stock_quantity=stock_quantity-v_qty,updated_at=now()
        where id=v_variant_id;
      end if;
    elsif v_product.stock_quantity is not null then
      perform set_config('shakh.checkout_stock_update','on',true);
      update public.products set stock_quantity=stock_quantity-v_qty where id=v_product.id;
    end if;
  end loop;

  insert into public.order_status_history(order_id,from_status,to_status,changed_by,actor_role,note)
  values(v_order_id,null,'placed',auth.uid(),v_role,'Order created');
  if p_merchant_id is null then
    insert into public.notifications(user_id,title,body,kind)
    select id,'داواکاری نوێ بۆ شاخ ستۆر','داواکارییەکی نوێ لە شاخ ستۆر هەیە.','new_shakh_store_order'
    from public.profiles where role='super_admin' and is_active=true;
  else
    insert into public.notifications(user_id,title,body,kind)
    select user_id,'داواکاری نوێ','داواکارییەکی نوێت هەیە.','new_order'
    from public.merchant_profiles where id=p_merchant_id;
  end if;
  return v_order_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.update_order_status(p_order_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v public.orders%rowtype;
  v_merchant_user uuid;
  v_allowed boolean := false;
  v_actor_role public.app_role;
  v_body text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status is null or p_status not in ('accepted','rejected','preparing','ready_for_pickup','picked_up','delivered','cancelled') then
    raise exception 'Invalid order status';
  end if;

  v_actor_role := public.current_app_role();
  select * into v from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select user_id into v_merchant_user from public.merchant_profiles where id=v.merchant_id;

  if public.is_super_admin() then
    v_allowed :=
      (v.status='placed' and p_status in ('accepted','rejected','cancelled'))
      or (v.status='accepted' and p_status in ('preparing','cancelled'))
      or (v.status='preparing' and p_status in ('ready_for_pickup','cancelled'))
      or (v.status='ready_for_pickup' and p_status='cancelled');
  elsif v.customer_id=auth.uid() and v_actor_role='customer' then
    v_allowed := v.status='placed' and p_status='cancelled';
  elsif v_merchant_user=auth.uid() and v_actor_role in ('supermarket','restaurant','butcher_poultry','grocery') then
    v_allowed :=
      (v.status='placed' and p_status in ('accepted','rejected'))
      or (v.status='accepted' and p_status='preparing')
      or (v.status='preparing' and p_status='ready_for_pickup');
  elsif v.captain_user_id=auth.uid() and v_actor_role='captain' then
    v_allowed :=
      (v.status='assigned' and p_status='picked_up')
      or (v.status='picked_up' and p_status='delivered');
  end if;

  if not v_allowed then raise exception 'You are not allowed to perform this status transition'; end if;

  update public.orders set status=p_status where id=p_order_id;

  if p_status in ('delivered','cancelled','rejected') then
    delete from public.order_live_locations where order_id=p_order_id;
  end if;

  if p_status in ('rejected','cancelled') then
    update public.product_variants pv
    set stock_quantity=pv.stock_quantity+oi.quantity, updated_at=now()
    from public.order_items oi
    where oi.order_id=p_order_id and oi.variant_id=pv.id and pv.stock_quantity is not null;

    update public.products p
    set stock_quantity=p.stock_quantity+oi.quantity
    from public.order_items oi
    where oi.order_id=p_order_id and oi.variant_id is null
      and oi.product_id=p.id and p.stock_quantity is not null;
  end if;

  insert into public.order_status_history(order_id,from_status,to_status,changed_by,actor_role,note)
  values(p_order_id,v.status,p_status,auth.uid(),v_actor_role,null);

  v_body := case p_status
    when 'accepted' then 'داواکارییەکەت پەسەند کرا.'
    when 'rejected' then 'داواکارییەکەت ڕەتکرایەوە.'
    when 'preparing' then 'دوکان دەستی بە ئامادەکردنی داواکارییەکەت کرد.'
    when 'ready_for_pickup' then 'داواکارییەکەت ئامادەی وەرگرتنی کاپتنە.'
    when 'picked_up' then 'کاپتن داواکارییەکەت وەرگرت.'
    when 'delivered' then 'داواکارییەکەت گەیەنرا.'
    when 'cancelled' then 'داواکارییەکەت هەڵوەشێندرایەوە.'
    else 'دۆخی داواکاری گۆڕا.'
  end;

  insert into public.notifications(user_id,title,body,kind)
  values(v.customer_id,'نوێکردنەوەی داواکاری',v_body,'order_status');

  if p_status='delivered' and v_merchant_user is not null then
    insert into public.notifications(user_id,title,body,kind)
    values(v_merchant_user,'داواکاری گەیەنرا','داواکارییەکەت گەیەنرا.','order_delivered');
  end if;
end;
$function$


revoke all on function public.create_order_v2(uuid,uuid,jsonb,text,text,text,uuid,bigint,text) from public,anon,authenticated;
comment on table public.product_categories is 'Central, Super Admin-managed categories scoped to each existing Shakh store type.';
comment on table public.product_subcategories is 'Super Admin-managed subcategories belonging to a central store category.';
comment on table public.product_variants is 'Selectable product options with independent price, stock, color, scent, and size.';
comment on column public.order_items.variant_snapshot is 'Immutable option selection captured at checkout to preserve the exact item ordered.';
