-- Notify both the requester and the super-admin queue when a wallet top-up is requested.
create or replace function public.request_wallet_topup(p_amount_iqd bigint,p_note text default null)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount_iqd is null or p_amount_iqd <= 0 then raise exception 'Amount must be positive'; end if;

  insert into public.wallet_topup_requests(user_id,amount_iqd,note)
  values(auth.uid(),p_amount_iqd,p_note)
  returning id into v_id;

  insert into public.notifications(user_id,title,body,kind)
  values(auth.uid(),'داواکاری جزدان نێردرا','داواکاری پڕکردنەوەی جزدان لە چاوەڕوانی پەسەندکردندایە.','wallet_topup_pending');

  insert into public.notifications(user_id,title,body,kind)
  select id,'داواکاری نوێی جزدان','داواکاری پڕکردنەوەی جزدان بە بڕی '||p_amount_iqd::text||' دینار نێردرا.','admin_wallet_topup_request'
  from public.profiles where role='super_admin' and is_active=true;

  return v_id;
end;
$fn$;

revoke execute on function public.request_wallet_topup(bigint,text) from public,anon;
grant execute on function public.request_wallet_topup(bigint,text) to authenticated;

drop policy if exists rewards_public_active on public.reward_campaigns;
create policy rewards_public_active on public.reward_campaigns
for select to anon using (is_active=true);
