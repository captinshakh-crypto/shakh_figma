-- Allow Super Admin moderation of every product, including SHAKH STORE.
-- Merchant commission remains mandatory only when approving partner-shop posts.

create or replace function public.admin_review_product(
  p_product_id uuid,
  p_approve boolean,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_commission bigint;
  v_owner uuid;
  v_is_shakh_store boolean;
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'not_authorized';
  end if;

  select
    p.merchant_commission_per_unit_iqd,
    p.is_shakh_store,
    mp.user_id
  into
    v_commission,
    v_is_shakh_store,
    v_owner
  from public.products p
  left join public.merchant_profiles mp on mp.id = p.merchant_id
  where p.id = p_product_id
  for update of p;

  if not found then
    raise exception 'product_not_found';
  end if;

  -- Partner shops still require their normal operating commission before
  -- activation. SHAKH STORE is owned by Super Admin and has no merchant fee.
  if p_approve and not coalesce(v_is_shakh_store, false)
     and coalesce(v_commission, 0) <= 0 then
    raise exception 'set_product_commission_before_activation';
  end if;

  update public.products
  set approval_status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      rejection_reason = case
        when p_approve then null
        else nullif(trim(p_rejection_reason), '')
      end,
      is_available = p_approve,
      updated_at = now()
  where id = p_product_id;

  -- Notify partner-shop owners. SHAKH STORE products have no merchant owner;
  -- the moderation action is instead retained in the admin audit log.
  if v_owner is not null then
    insert into public.notifications(user_id, title, body, kind)
    values (
      v_owner,
      case when p_approve then 'پۆستەکەت پەسەند کرا' else 'پۆستەکەت ڕەتکرایەوە' end,
      case
        when p_approve then 'سوپەر ئەدمین پۆستەکەت پەسەند کرد و چالاک کرایەوە.'
        else 'پۆستەکەت لەلایەن سوپەر ئەدمینەوە ڕەتکرایەوە. ' ||
             coalesce(nullif(trim(p_rejection_reason), ''), 'بۆ زانیاری زیاتر پەیوەندی بە سوپەر ئەدمینەوە بکە.')
      end,
      case when p_approve then 'product_approved' else 'product_rejected' end
    );
  end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    case when p_approve then 'admin_approve_product' else 'admin_reject_product' end,
    'product',
    p_product_id,
    jsonb_build_object(
      'is_shakh_store', coalesce(v_is_shakh_store, false),
      'approval_status', case when p_approve then 'approved' else 'rejected' end,
      'rejection_reason', case when p_approve then null else nullif(trim(p_rejection_reason), '') end
    )
  );
end;
$function$;

revoke all on function public.admin_review_product(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_product(uuid, boolean, text) to authenticated;

comment on function public.admin_review_product(uuid, boolean, text)
is 'Super Admin can approve or reject partner-shop and SHAKH STORE products; partner-shop approvals still require positive merchant commission.';
