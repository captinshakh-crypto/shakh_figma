insert into public.product_subcategories
  (category_id, subcategory_key, name, sort_order, is_active)
select category.id, added.subcategory_key, added.name, added.sort_order, true
from (
  values
    ('supermarket', 'groceries', 'legumes', 'فاسۆلیا و پاقلەمەنییەکان', 60),
    ('restaurant', 'meals', 'meat_rice', 'گۆشت و برنج', 40),
    ('restaurant', 'meals', 'quzi', 'قۆزی', 50),
    ('restaurant', 'fast_food', 'wraps', 'لێفە و ڕاپ', 40),
    ('restaurant', 'sides', 'fried_foods', 'خواردنی سوورکراوە', 40)
) as added(store_type, category_key, subcategory_key, name, sort_order)
join public.product_categories category
  on category.store_type = added.store_type
 and category.category_key = added.category_key
on conflict (category_id, subcategory_key)
do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;
