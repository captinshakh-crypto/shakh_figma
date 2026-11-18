-- Realtime notifications for customers, merchants, captains and Shakh Store.
create or replace function private.notify_order_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_merchant_user uuid;
  v_admin_user uuid;
begin
  insert into public.notifications(user_id,title,body,kind)
  values(new.customer_id,'داواکارییەکەت نێردرا','داواکارییەکەت بە سەرکەوتوویی تۆمار کرا و نێردرا بۆ دوکان.','order_created');

  if new.merchant_id is not null then
    select user_id into v_merchant_user from public.merchant_profiles
    where id = new.merchant_id and approval_status = 'approved';
    if v_merchant_user is not null then
      insert into public.notifications(user_id,title,body,kind)
      values(v_merchant_user,'داواکارییەکی نوێت هەیە','کڕیارێک داواکارییەکی نوێی بۆ دوکانەکەت ناردووە.','new_order');
    end if;
  else
    select id into v_admin_user from public.profiles
    where role='super_admin' and is_active=true order by created_at asc limit 1;
    if v_admin_user is not null then
      insert into public.notifications(user_id,title,body,kind)
      values(v_admin_user,'داواکارییەکی نوێ بۆ شاخ ستۆر','داواکارییەکی نوێ بۆ شاخ ستۆر تۆمار کرا.','new_order');
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists orders_notify_created on public.orders;
create trigger orders_notify_created after insert on public.orders
for each row execute function private.notify_order_created();

create or replace function private.notify_order_status_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_merchant_user uuid;
begin
  select * into v_order from public.orders where id = new.order_id;
  if not found then return new; end if;

  if new.to_status = 'ready_for_pickup' then
    insert into public.notifications(user_id,title,body,kind)
    select cp.user_id,'گەیاندنێکی نوێ بەردەستە','داواکارییەکی ئامادە بۆ وەرگرتن هەیە؛ بچۆ بەشی گەیاندنەکان.','delivery_available'
    from public.captain_profiles cp
    join public.profiles p on p.id = cp.user_id
    where cp.is_active = true and p.role='captain' and p.is_active=true
      and (cp.captain_type='shakh' or (cp.captain_type='merchant' and cp.merchant_id=v_order.merchant_id));
  elsif new.to_status = 'assigned' and new.actor_role = 'captain' and v_order.captain_user_id is not null then
    insert into public.notifications(user_id,title,body,kind)
    values(v_order.captain_user_id,'گەیاندنەکە بۆ تۆ تۆمار کرا','گەیاندنەکە بە سەرکەوتوویی وەرگیرا؛ ئێستا بۆ دوکان بڕۆ.','delivery_claimed');
  elsif new.to_status = 'picked_up' then
    select user_id into v_merchant_user from public.merchant_profiles where id=v_order.merchant_id;
    if v_merchant_user is not null then
      insert into public.notifications(user_id,title,body,kind)
      values(v_merchant_user,'کپتن داواکاری وەرگرت','کپتن داواکارییەکەی لە دوکان وەرگرت و لە ڕێگایە.','order_picked_up');
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists order_status_notify_participants on public.order_status_history;
create trigger order_status_notify_participants after insert on public.order_status_history
for each row execute function private.notify_order_status_participants();

alter publication supabase_realtime add table public.notifications;
