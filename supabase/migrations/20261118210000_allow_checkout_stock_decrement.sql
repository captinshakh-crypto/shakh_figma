-- Allow the checkout RPC to decrement stock while retaining product ownership
-- and wallet guards for all merchant product edits.
create or replace function private.enforce_product_wallet_minimum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid;
begin
  if tg_op = 'UPDATE'
     and current_setting('shakh.checkout_stock_update', true) = 'on'
     and new.stock_quantity is not null
     and old.stock_quantity is not null
     and new.stock_quantity < old.stock_quantity
     and (to_jsonb(new) - 'stock_quantity' - 'updated_at')
         = (to_jsonb(old) - 'stock_quantity' - 'updated_at') then
    return new;
  end if;

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

do $$
declare
  v_def text;
  v_old text := 'if v_product.stock_quantity is not null then update public.products set stock_quantity=stock_quantity-v_qty where id=v_product.id; end if;';
  v_new text := 'if v_product.stock_quantity is not null then perform set_config(''shakh.checkout_stock_update'',''on'',true); update public.products set stock_quantity=stock_quantity-v_qty where id=v_product.id; end if;';
begin
  select pg_get_functiondef('public.create_order_v2(uuid,uuid,jsonb,text,text,text,uuid,bigint,text)'::regprocedure)
    into v_def;
  if position(v_old in v_def) = 0 then
    raise exception 'Could not find stock update statement in create_order_v2; migration aborted';
  end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end;
$$;
