-- Admin-managed captain role assignment and reward-owner payout eligibility.
create or replace function public.admin_set_user_role(p_user_id uuid,p_role public.app_role)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v_old public.app_role;
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  if p_role not in ('captain','customer') then raise exception 'Only captain/customer roles can be assigned here'; end if;
  select role into v_old from public.profiles where id=p_user_id for update;
  if not found then raise exception 'User profile not found'; end if;
  if v_old='super_admin' then raise exception 'Super admin role cannot be changed here'; end if;
  if v_old in ('supermarket','restaurant','butcher_poultry','grocery') and p_role='customer' then
    update public.merchant_profiles set approval_status='inactive' where user_id=p_user_id;
  end if;
  update public.profiles set role=p_role where id=p_user_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'change_user_role','profile',p_user_id,jsonb_build_object('old_role',v_old,'new_role',p_role));
end;
$fn$;

create or replace function public.request_wallet_payout(p_amount_iqd bigint,p_method text,p_note text default null)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount_iqd is null or p_amount_iqd <= 0 then raise exception 'Amount must be positive'; end if;
  if p_method not in ('fastpay','fib') then raise exception 'Unsupported payout method'; end if;
  if not exists(select 1 from public.reward_campaigns where owner_user_id=auth.uid()) then
    raise exception 'Only reward owners can request a payout';
  end if;
  insert into public.payout_requests(requester_user_id,amount_iqd,payout_method,admin_note)
  values(auth.uid(),p_amount_iqd,p_method,p_note)
  returning id into v_id;
  insert into public.notifications(user_id,title,body,kind)
  select id,'داواکاری دەرکردنی پارە','داواکاری کاشکردنی جزدان لە چاوەڕوانی پەسەندکردندایە.','payout_pending'
  from public.profiles where role='super_admin' and is_active=true;
  return v_id;
end;
$fn$;

drop policy if exists rewards_owner_update on public.reward_campaigns;
create policy rewards_owner_update on public.reward_campaigns
for update to authenticated using (owner_user_id=auth.uid() or public.is_super_admin())
with check (owner_user_id=auth.uid() or public.is_super_admin());

drop policy if exists rewards_owner_delete on public.reward_campaigns;
create policy rewards_owner_delete on public.reward_campaigns
for delete to authenticated using (owner_user_id=auth.uid() or public.is_super_admin());

revoke execute on function public.admin_set_user_role(uuid,public.app_role) from public,anon;
grant execute on function public.admin_set_user_role(uuid,public.app_role) to authenticated;
revoke execute on function public.request_wallet_payout(bigint,text,text) from public,anon;
grant execute on function public.request_wallet_payout(bigint,text,text) to authenticated;
