-- Allow Super Admin to permanently delete any product post.
-- Merchants may still permanently delete only their own approved-store posts.
-- A private trigger writes a durable snapshot before deletion, while order_items.product_id
-- is ON DELETE SET NULL so historical order title, quantity, price, cost and commissions remain.

drop policy if exists products_merchant_delete on public.products;

create policy products_merchant_delete
on public.products
for delete
to authenticated
using (
  (select public.is_super_admin())
  or (
    is_shakh_store = false
    and exists (
      select 1
      from public.merchant_profiles as m
      where m.id = products.merchant_id
        and m.user_id = (select auth.uid())
        and m.approval_status = 'approved'
    )
  )
);

create or replace function private.audit_product_permanent_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    'product_permanent_delete',
    'product',
    old.id,
    jsonb_build_object(
      'deleted_product', to_jsonb(old),
      'order_history_preserved', true,
      'deletion_type', 'permanent'
    )
  );

  return old;
end;
$function$;

revoke all on function private.audit_product_permanent_deletion() from public, anon, authenticated;

drop trigger if exists products_audit_permanent_delete on public.products;

create trigger products_audit_permanent_delete
before delete on public.products
for each row
execute function private.audit_product_permanent_deletion();

comment on policy products_merchant_delete on public.products is
  'Merchants can permanently delete their own partner-shop posts; Super Admin can permanently delete any product post.';

comment on function private.audit_product_permanent_deletion() is
  'Writes a complete product snapshot to audit_logs before permanent deletion; historical order_items remain intact.';
