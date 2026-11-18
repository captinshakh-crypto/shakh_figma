-- Replace percentage/minimum-wallet rules with fixed prepaid merchant and 20% captain commissions.
alter table public.commission_settings
  add column if not exists fixed_commission_per_unit_iqd bigint not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='commission_settings_fixed_nonnegative') then
    alter table public.commission_settings add constraint commission_settings_fixed_nonnegative check (fixed_commission_per_unit_iqd >= 0);
  end if;
end $$;
update public.commission_settings set fixed_commission_per_unit_iqd=100 where merchant_type='restaurant';

create or replace function public.set_fixed_commission_setting(p_merchant_type public.app_role,p_fixed_commission_per_unit_iqd bigint)
returns void language plpgsql security definer set search_path='public','pg_temp'
as $$
begin
 if not public.is_super_admin() then raise exception 'Super admin only'; end if;
 if p_merchant_type not in ('supermarket','restaurant','butcher_poultry','grocery') then raise exception 'Invalid merchant type'; end if;
 if p_fixed_commission_per_unit_iqd is null or p_fixed_commission_per_unit_iqd < 0 then raise exception 'Commission must be zero or greater'; end if;
 update public.commission_settings set fixed_commission_per_unit_iqd=p_fixed_commission_per_unit_iqd,commission_rate_bps=0,updated_by=auth.uid(),updated_at=now() where merchant_type=p_merchant_type;
 if not found then
   insert into public.commission_settings(merchant_type,commission_rate_bps,fixed_commission_per_unit_iqd,platform_delivery_share_iqd,updated_by,updated_at)
   values(p_merchant_type,0,p_fixed_commission_per_unit_iqd,0,auth.uid(),now());
 end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,details)
 values(auth.uid(),'update_fixed_commission_setting','commission_settings',jsonb_build_object('merchant_type',p_merchant_type,'fixed_commission_per_unit_iqd',p_fixed_commission_per_unit_iqd));
end $$;
revoke all on function public.set_fixed_commission_setting(public.app_role,bigint) from public,anon;
grant execute on function public.set_fixed_commission_setting(public.app_role,bigint) to authenticated;

create or replace function private.enforce_product_wallet_minimum()
returns trigger language plpgsql security definer set search_path='public','private','pg_temp'
as $$
declare v_owner uuid; v_balance bigint;
begin
 if new.is_shakh_store then
   if not public.is_super_admin() then raise exception 'Only super admin can manage SHAKH Store'; end if;
   if new.cost_price_iqd is null then raise exception 'Purchase cost is required for SHAKH Store products'; end if;
   return new;
 end if;
 select user_id into v_owner from public.merchant_profiles where id=new.merchant_id and approval_status='approved';
 if v_owner is null then raise exception 'Approved merchant account required'; end if;
 if v_owner<>auth.uid() and not public.is_super_admin() then raise exception 'You cannot manage another merchant products'; end if;
 if not public.is_super_admin() then
   select balance_iqd into v_balance from public.wallets where user_id=v_owner;
   if coalesce(v_balance,0)<=0 then raise exception 'Wallet must have a positive balance before posting products'; end if;
 end if;
 return new;
end $$;
drop trigger if exists products_wallet_minimum_guard on public.products;
create trigger products_wallet_minimum_guard before insert or update on public.products for each row execute function private.enforce_product_wallet_minimum();

create or replace function public.snapshot_order_commission()
returns trigger language plpgsql security definer set search_path='public','pg_temp'
as $$
declare v_zone_fee bigint;
begin
 select delivery_fee_iqd into v_zone_fee from public.service_zones where id=new.service_zone_id and is_active=true;
 if not found then raise exception 'Delivery zone is unavailable'; end if;
 new.delivery_fee_iqd:=v_zone_fee;
 new.platform_delivery_share_iqd:=0;
 new.captain_delivery_share_iqd:=0;
 new.merchant_commission_rate_bps:=0;
 new.merchant_commission_iqd:=0;
 return new;
end $$;

create or replace function private.snapshot_fixed_item_commission()
returns trigger language plpgsql security definer set search_path='public','private','pg_temp'
as $$
declare v_merchant uuid; v_type public.app_role;
begin
 select merchant_id into v_merchant from public.orders where id=new.order_id;
 if v_merchant is not null then
   select merchant_type into v_type from public.merchant_profiles where id=v_merchant;
   update public.orders o
   set merchant_commission_iqd=coalesce((
     select sum(round(oi.quantity*coalesce(cs.fixed_commission_per_unit_iqd,0))::bigint)
     from public.order_items oi
     join public.products p on p.id=oi.product_id
     left join public.commission_settings cs on cs.merchant_type=v_type
     where oi.order_id=new.order_id
   ),0),merchant_commission_rate_bps=0
   where o.id=new.order_id;
 end if;
 return new;
end $$;
drop trigger if exists order_items_fixed_commission_snapshot on public.order_items;
create trigger order_items_fixed_commission_snapshot after insert on public.order_items for each row execute function private.snapshot_fixed_item_commission();

create or replace function private.enforce_order_wallet_minimum()
returns trigger language plpgsql security definer set search_path='public','private','pg_temp'
as $$
declare
 v_merchant_owner uuid; v_balance bigint; v_commission bigint; v_captain_fee bigint;
 v_captain_type public.captain_type; v_captain_merchant uuid; v_old_commission bigint;
begin
 if tg_op='UPDATE' and new.status is distinct from old.status and new.status='accepted' and new.merchant_id is not null then
   select user_id into v_merchant_owner from public.merchant_profiles where id=new.merchant_id and approval_status='approved';
   if v_merchant_owner is null then raise exception 'Approved merchant account required'; end if;
   v_commission:=coalesce(new.merchant_commission_iqd,0);
   select balance_iqd into v_balance from public.wallets where user_id=v_merchant_owner for update;
   if coalesce(v_balance,0)<=0 or coalesce(v_balance,0)<v_commission then
     raise exception 'Merchant wallet balance is insufficient for prepaid sale commission (% IQD)',v_commission;
   end if;
   if v_commission>0 and not exists(select 1 from public.wallet_ledger where idempotency_key='merchant-commission:'||new.id::text) then
     update public.wallets set balance_iqd=balance_iqd-v_commission,updated_at=now() where user_id=v_merchant_owner;
     insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
     values(v_merchant_owner,'merchant_commission',v_commission,'debit','order',new.id,'merchant-commission:'||new.id::text,'Prepaid fixed commission per sold unit',auth.uid());
   end if;
 end if;
 if tg_op='UPDATE' and new.captain_user_id is distinct from old.captain_user_id then
   if old.captain_user_id is not null and exists(select 1 from public.wallet_ledger where idempotency_key='captain-delivery-commission:'||new.id::text||':'||old.captain_user_id::text) then
     v_old_commission:=floor(coalesce(old.delivery_fee_iqd,0)*0.20)::bigint;
     if v_old_commission>0 then
       update public.wallets set balance_iqd=balance_iqd+v_old_commission,updated_at=now() where user_id=old.captain_user_id;
       insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
       values(old.captain_user_id,'refund',v_old_commission,'credit','order',new.id,'captain-delivery-commission-refund:'||new.id::text||':'||old.captain_user_id::text,'Refund prepaid captain delivery commission after reassignment',auth.uid());
     end if;
   end if;
   if new.captain_user_id is not null then
     select cp.captain_type,cp.merchant_id into v_captain_type,v_captain_merchant
     from public.captain_profiles cp join public.profiles p on p.id=cp.user_id
     where cp.user_id=new.captain_user_id and cp.is_active=true and p.role='captain' and p.is_active=true;
     if not found then raise exception 'Captain account is not active or approved'; end if;
     if v_captain_type='merchant' and v_captain_merchant is distinct from new.merchant_id then raise exception 'This captain is restricted to a different store'; end if;
     v_captain_fee:=floor(coalesce(new.delivery_fee_iqd,0)*0.20)::bigint;
     if v_captain_fee>0 and not exists(select 1 from public.wallet_ledger where idempotency_key='captain-delivery-commission:'||new.id::text||':'||new.captain_user_id::text) then
       select balance_iqd into v_balance from public.wallets where user_id=new.captain_user_id for update;
       if coalesce(v_balance,0)<v_captain_fee then raise exception 'Captain wallet needs % IQD prepaid commission to accept this delivery',v_captain_fee; end if;
       update public.wallets set balance_iqd=balance_iqd-v_captain_fee,updated_at=now() where user_id=new.captain_user_id;
       insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
       values(new.captain_user_id,'platform_delivery_share',v_captain_fee,'debit','order',new.id,'captain-delivery-commission:'||new.id::text||':'||new.captain_user_id::text,'Prepaid 20% commission from delivery fee',auth.uid());
     end if;
     new.platform_delivery_share_iqd:=v_captain_fee;
     new.captain_delivery_share_iqd:=0;
   else
     new.platform_delivery_share_iqd:=0;
     new.captain_delivery_share_iqd:=0;
   end if;
 end if;
 if tg_op='UPDATE' and new.status in ('cancelled','rejected') and old.status not in ('cancelled','rejected','delivered') then
   if old.merchant_id is not null and old.merchant_commission_iqd>0 then
     select user_id into v_merchant_owner from public.merchant_profiles where id=old.merchant_id;
     if exists(select 1 from public.wallet_ledger where idempotency_key='merchant-commission:'||old.id::text)
       and not exists(select 1 from public.wallet_ledger where idempotency_key='merchant-commission-refund:'||old.id::text) then
       update public.wallets set balance_iqd=balance_iqd+old.merchant_commission_iqd,updated_at=now() where user_id=v_merchant_owner;
       insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
       values(v_merchant_owner,'refund',old.merchant_commission_iqd,'credit','order',old.id,'merchant-commission-refund:'||old.id::text,'Refund prepaid merchant commission for cancelled order',auth.uid());
     end if;
   end if;
   if old.captain_user_id is not null then
     v_old_commission:=floor(coalesce(old.delivery_fee_iqd,0)*0.20)::bigint;
     if v_old_commission>0 and exists(select 1 from public.wallet_ledger where idempotency_key='captain-delivery-commission:'||old.id::text||':'||old.captain_user_id::text)
       and not exists(select 1 from public.wallet_ledger where idempotency_key='captain-delivery-commission-refund:'||old.id::text||':'||old.captain_user_id::text) then
       update public.wallets set balance_iqd=balance_iqd+v_old_commission,updated_at=now() where user_id=old.captain_user_id;
       insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
       values(old.captain_user_id,'refund',v_old_commission,'credit','order',old.id,'captain-delivery-commission-refund:'||old.id::text||':'||old.captain_user_id::text,'Refund prepaid captain commission for cancelled order',auth.uid());
     end if;
   end if;
   new.platform_delivery_share_iqd:=0; new.captain_delivery_share_iqd:=0;
 end if;
 return new;
end $$;
drop trigger if exists orders_wallet_minimum_guard on public.orders;
create trigger orders_wallet_minimum_guard before update of status,captain_user_id on public.orders for each row execute function private.enforce_order_wallet_minimum();

create or replace function public.settle_delivered_order(p_order_id uuid)
returns void language plpgsql security definer set search_path='public','pg_temp'
as $$
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
 if v_order.merchant_id is not null and v_order.merchant_commission_iqd>0 then
   insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
   values(v_admin_id,'merchant_commission',v_order.merchant_commission_iqd,'credit','order',v_order.id,'admin-merchant-commission:'||v_order.id::text,'Prepaid merchant sale commission received',auth.uid());
   update public.wallets set balance_iqd=balance_iqd+v_order.merchant_commission_iqd,updated_at=now() where user_id=v_admin_id;
 end if;
 if v_order.platform_delivery_share_iqd>0 then
   insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
   values(v_admin_id,'platform_delivery_share',v_order.platform_delivery_share_iqd,'credit','order',v_order.id,'admin-delivery-share:'||v_order.id::text,'Captain prepaid 20% delivery commission received',auth.uid());
   update public.wallets set balance_iqd=balance_iqd+v_order.platform_delivery_share_iqd,updated_at=now() where user_id=v_admin_id;
 end if;
 if v_order.reward_campaign_id is not null and v_order.reward_amount_iqd>0 then
   select owner_user_id into v_reward_owner from public.reward_campaigns where id=v_order.reward_campaign_id and is_active=true;
   if v_reward_owner is null then raise exception 'Reward owner is unavailable'; end if;
   update public.wallets set balance_iqd=balance_iqd+v_order.reward_amount_iqd,updated_at=now() where user_id=v_reward_owner;
   insert into public.wallet_ledger(wallet_user_id,entry_type,amount_iqd,direction,reference_type,reference_id,idempotency_key,note,created_by)
   values(v_reward_owner,'reward_credit',v_order.reward_amount_iqd,'credit','order',v_order.id,'reward-credit:'||v_order.id::text,'Reward amount collected with order',auth.uid());
   insert into public.notifications(user_id,title,body,kind) values(v_reward_owner,'پارەی شێرو خەلات زیاد کرا','بڕی شێرو خەلات بۆ جزدانەکەت زیاد کرا.','reward_credit');
 end if;
 update public.orders set settled_at=now() where id=v_order.id;
 insert into public.notifications(user_id,title,body,kind) values(v_admin_id,'داواکاری گەیاندن تەواو بوو','کۆمسیۆنی دوکان و کاپتن بۆ جزدان زیاد کرا.','order_settled');
 if v_order.captain_user_id is not null then
   insert into public.notifications(user_id,title,body,kind)
   values(v_order.captain_user_id,'گەیاندن تەواو بوو','کرێی تەواوی گەیاندن بە کاش لە کڕیار وەرگیرا؛ کۆمسیۆنی ٢٠٪ پێشتر لە جزدان کەمکرایەوە.','captain_earning');
 end if;
end $$;

revoke all on function private.enforce_product_wallet_minimum() from public,anon,authenticated;
revoke all on function private.snapshot_fixed_item_commission() from public,anon,authenticated;
revoke all on function private.enforce_order_wallet_minimum() from public,anon,authenticated;
revoke all on function public.settle_delivered_order(uuid) from public,anon;
grant execute on function public.settle_delivered_order(uuid) to authenticated;
