-- SHAKH configurable commissions. Changes apply to new orders.
create table public.commission_settings (
  merchant_type public.app_role primary key check (merchant_type in ('supermarket','restaurant','butcher_poultry','grocery')),
  commission_rate_bps integer not null default 0 check (commission_rate_bps between 0 and 10000),
  platform_delivery_share_iqd bigint not null default 200 check (platform_delivery_share_iqd >= 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.commission_settings(merchant_type,commission_rate_bps,platform_delivery_share_iqd)
values ('supermarket',0,200),('restaurant',0,200),('butcher_poultry',0,200),('grocery',0,200)
on conflict (merchant_type) do nothing;

alter table public.commission_settings enable row level security;
create policy commission_settings_read on public.commission_settings
for select to authenticated using (true);
create policy commission_settings_admin_write on public.commission_settings
for all to authenticated using (public.is_super_admin())
with check (public.is_super_admin());

create or replace function public.set_commission_setting(
  p_merchant_type public.app_role,
  p_commission_rate_bps integer,
  p_platform_delivery_share_iqd bigint
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_super_admin() then raise exception 'Super admin only'; end if;
  if p_merchant_type not in ('supermarket','restaurant','butcher_poultry','grocery') then raise exception 'Invalid merchant type'; end if;
  if p_commission_rate_bps < 0 or p_commission_rate_bps > 10000 then raise exception 'Invalid commission rate'; end if;
  if p_platform_delivery_share_iqd < 0 then raise exception 'Invalid delivery share'; end if;
  insert into public.commission_settings(merchant_type,commission_rate_bps,platform_delivery_share_iqd,updated_by,updated_at)
  values(p_merchant_type,p_commission_rate_bps,p_platform_delivery_share_iqd,auth.uid(),now())
  on conflict(merchant_type) do update set
    commission_rate_bps=excluded.commission_rate_bps,
    platform_delivery_share_iqd=excluded.platform_delivery_share_iqd,
    updated_by=excluded.updated_by, updated_at=now();
  insert into public.audit_logs(actor_user_id,action,entity_type,details)
  values(auth.uid(),'update_commission_setting','commission_settings',
    jsonb_build_object('merchant_type',p_merchant_type,'commission_rate_bps',p_commission_rate_bps,
    'platform_delivery_share_iqd',p_platform_delivery_share_iqd));
end;
$$;

revoke all on function public.set_commission_setting(public.app_role,integer,bigint) from public;
grant execute on function public.set_commission_setting(public.app_role,integer,bigint) to authenticated;
