insert into public.product_subcategories
  (category_id, subcategory_key, name, sort_order, is_active)
select category.id, added.subcategory_key, added.name, added.sort_order, true
from (
  values
    ('supermarket', 'rice', 'برنج', 60),
    ('supermarket', 'legumes', 'فاسۆلیا و پاقلەمەنییەکان', 70),
    ('restaurant', 'meat_rice', 'گۆشت و برنج', 90),
    ('restaurant', 'quzi', 'قۆزی', 100),
    ('restaurant', 'wraps', 'لێفە و ڕاپ', 110),
    ('restaurant', 'fried_foods', 'خواردنی سوورکراوە', 120)
) as added(category_key, subcategory_key, name, sort_order)
join public.product_categories category
  on category.store_type = 'shakh_store'
 and category.category_key = added.category_key
on conflict (category_id, subcategory_key)
do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;
