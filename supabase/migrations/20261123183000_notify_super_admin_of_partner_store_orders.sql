create or replace function private.notify_order_created()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_merchant_user uuid;
  v_merchant_name text;
  v_admin_user uuid;
begin
  insert into public.notifications(user_id,title,body,kind)
  values(new.customer_id,'داواکارییەکەت نێردرا','داواکارییەکەت بە سەرکەوتوویی تۆمار کرا و نێردرا بۆ دوکان.','order_created');

  select id into v_admin_user
  from public.profiles
  where role='super_admin' and is_active=true
  order by created_at asc
  limit 1;

  if new.merchant_id is not null then
    select user_id,business_name
      into v_merchant_user,v_merchant_name
    from public.merchant_profiles
    where id=new.merchant_id and approval_status='approved';

    if v_merchant_user is not null then
      insert into public.notifications(user_id,title,body,kind)
      values(v_merchant_user,'داواکارییەکی نوێت هەیە','کڕیارێک داواکارییەکی نوێی بۆ دوکانەکەت ناردووە.','new_order');
    end if;

    if v_admin_user is not null then
      insert into public.notifications(user_id,title,body,kind)
      values(
        v_admin_user,
        'داواکارییەکی نوێ بۆ دوکان: ' || coalesce(v_merchant_name,'دوکانی هاوبەش'),
        'داواکارییەکی نوێ بۆ دوکانێکی هاوبەش تۆمار کرا. بچۆ بەشی هەموو داواکارییەکان بۆ بینینی وەسڵ و ناردنی بە واتسئاپ.',
        'new_order'
      );
    end if;
  else
    if v_admin_user is not null then
      insert into public.notifications(user_id,title,body,kind)
      values(v_admin_user,'داواکارییەکی نوێ بۆ شاخ ستۆر','داواکارییەکی نوێ بۆ شاخ ستۆر تۆمار کرا.','new_order');
    end if;
  end if;

  return new;
end;
$function$;
