-- Commission amounts are tracked from delivered order snapshots, not deposited into the super-admin wallet.
create or replace function public.settle_delivered_order(p_order_id uuid)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_order public.orders%rowtype; v_admin_id uuid; v_reward_owner uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.settled_at is not null then raise exception 'Order already settled'; end if;
 if v_order.status<>'delivered' then raise exception 'Order must be marked delivered first'; end if;
 if not public.is_super_admin() and v_order.captain_user_id is distinct from auth.uid() then raise exception 'Only assigned captain or super admin can settle this order'; end if;
 select id into v_admin_id from public.profiles where role='super_admin' and is_active=true order by created_at asc limit 1;
 if v_admin_id is null then raise exception 'Super admin account is not initialized'; end if;
 if v_order.reward_campaign_id is not null and v_order.reward_amount_iqd>0 then
   select owner_user_id into v_reward_owner from public.reward_campaigns where id=v_order.reward_campaign_id;
   if v_reward_owner is null then raise exception 'Referral link owner is unavailable'; end if;
   insert into public.wallets(user_id,balance_iqd) values(v_reward_owner,0) on conflict(user_id) do nothing;
   update public.wallets set balance_iqd=balance_iqd+v_order.reward_amount_iqd,updated_at=now() where user_id=v_reward_owner;
   insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
   values(v_reward_owner,'reward_credit',v_order.reward_amount_iqd,'credit','order',v_order.id,'reward-credit:'||v_order.id::text,'Referral reward paid from prepaid store wallet after delivered order',auth.uid());
   insert into public.notifications(user_id,title,body,kind) values(v_reward_owner,'پارەی شێر و خەڵات زیاد کرا','کۆمسیۆنی فرۆشتنی لینکەکەت بۆ جزدان زیاد کرا. لە کۆتایی مانگ دەتوانیت داوای کاشکردنی بکەیت.','reward_credit');
 end if;
 update public.orders set settled_at=now() where id=v_order.id;
 insert into public.notifications(user_id,title,body,kind) values(v_admin_id,'داواکاری گەیاندن تەواو بوو','کۆمسیۆنی دوکان و بەشی پلاتفۆرمی گەیاندن لە ڕاپۆرت تۆمار کرا؛ باڵانسی جزدان ناگۆڕێت.','order_settled');
 if v_order.captain_user_id is not null then
  insert into public.notifications(user_id,title,body,kind) values(v_order.captain_user_id,'گەیاندن تەواو بوو','کرێی گەیاندن بە کاش لە کڕیار وەرگیرا؛ کۆمسیۆنی پلاتفۆرم پێشتر لە جزدان کەمکرایەوە.','captain_earning');
 end if;
end; $function$;

create or replace function public.admin_commission_trend(p_days integer default 30)
returns table(day date,merchant_type text,order_count bigint,sales_iqd bigint,merchant_commission_iqd bigint,platform_delivery_commission_iqd bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $function$
begin
 if not public.is_super_admin() then raise exception 'Super admin only'; end if;
 return query
 select date_trunc('day',o.placed_at)::date,coalesce(mp.merchant_type::text,case when o.merchant_id is null then 'shakh_store' else 'other' end),
 count(*)::bigint,coalesce(sum(o.subtotal_iqd),0)::bigint,coalesce(sum(o.merchant_commission_iqd),0)::bigint,coalesce(sum(o.platform_delivery_share_iqd),0)::bigint
 from public.orders o left join public.merchant_profiles mp on mp.id=o.merchant_id
 where o.status='delivered' and o.placed_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,30),365)))
 group by 1,2 order by 1,2;
end; $function$;
revoke all on function public.admin_commission_trend(integer) from public;
grant execute on function public.admin_commission_trend(integer) to authenticated;
