-- Share-and-earn is optional for every product.
-- A zero reward means the product is sold normally and is not advertised as a
-- share-and-earn product. It must not block product submission or activation.

create or replace function private.enforce_product_wallet_minimum()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare v_owner uuid;
begin
  -- Preserve the narrowly scoped checkout stock update exception.
  if tg_op = 'UPDATE'
     and current_setting('shakh.checkout_stock_update', true) = 'on'
     and new.stock_quantity is not null
     and old.stock_quantity is not null
     and new.stock_quantity < old.stock_quantity
     and (to_jsonb(new) - 'stock_quantity' - 'updated_at')
         = (to_jsonb(old) - 'stock_quantity' - 'updated_at') then
    return new;
  end if;

  -- Zero is an intentional "no share reward" setting. The products table
  -- already enforces referral_commission_iqd >= 0.
  if new.is_shakh_store then
    if not public.is_super_admin() then
      raise exception 'Only super admin can manage SHAKH Store';
    end if;
    if new.cost_price_iqd is null then
      raise exception 'Purchase cost is required for SHAKH Store products';
    end if;
    return new;
  end if;

  select user_id into v_owner
  from public.merchant_profiles
  where id = new.merchant_id and approval_status = 'approved';

  if v_owner is null then
    raise exception 'Approved merchant account required';
  end if;
  if v_owner <> auth.uid() and not public.is_super_admin() then
    raise exception 'You cannot manage another merchant products';
  end if;
  if not public.is_super_admin() and not private.has_operating_wallet(v_owner) then
    raise exception 'Wallet must have a positive balance before posting products';
  end if;
  return new;
end;
$function$;

revoke all on function private.enforce_product_wallet_minimum() from public, anon, authenticated;

create or replace function public.admin_set_product_referral_reward(
  p_product_id uuid,
  p_reward_iqd bigint
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_owner uuid;
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'not_authorized';
  end if;

  if p_reward_iqd is null or p_reward_iqd < 0 then
    raise exception 'share_reward_must_be_zero_or_positive';
  end if;

  update public.products
     set referral_commission_iqd = p_reward_iqd,
         updated_at = now()
   where id = p_product_id
  returning merchant_id into v_owner;

  if not found then
    raise exception 'product_not_found';
  end if;

  if v_owner is not null then
    insert into public.notifications(user_id, title, body, kind)
    select mp.user_id,
      case when p_reward_iqd = 0
        then 'خەڵاتی شێر بۆ کاڵاکەت ناچالاک کرا'
        else 'خەڵاتی شێر بۆ کاڵاکەت نوێکرایەوە'
      end,
      case when p_reward_iqd = 0
        then 'سوپەر ئەدمین خەڵاتی شێر و خەڵاتی ئەم کاڵایەی کردە سفر؛ کاڵاکە بە شێوەی ئاسایی دەفرۆشرێت.'
        else 'سوپەر ئەدمین خەڵاتی شێری ئەم کاڵایەی کردە ' || p_reward_iqd::text ||
             ' دینار بۆ هەر دانە.'
      end,
      'product_referral_reward_updated'
    from public.merchant_profiles mp
    where mp.id = v_owner;
  end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'set_product_referral_reward',
    'product',
    p_product_id,
    jsonb_build_object('referral_reward_iqd', p_reward_iqd)
  );
end;
$function$;

revoke all on function public.admin_set_product_referral_reward(uuid, bigint) from public, anon;
grant execute on function public.admin_set_product_referral_reward(uuid, bigint) to authenticated;
