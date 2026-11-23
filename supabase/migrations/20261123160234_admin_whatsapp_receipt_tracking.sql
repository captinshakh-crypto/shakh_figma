-- Track WhatsApp receipt handoff separately from actual message delivery.
-- Opening WhatsApp is not proof that the user sent the message; sent_at is
-- written only after the Super Admin explicitly confirms the manual send.

alter table public.orders
  add column if not exists merchant_receipt_whatsapp_opened_at timestamptz,
  add column if not exists merchant_receipt_whatsapp_sent_at timestamptz,
  add column if not exists merchant_receipt_whatsapp_shared_by uuid
    references public.profiles(id) on delete set null;

comment on column public.orders.merchant_receipt_whatsapp_opened_at is
  'Latest time the Super Admin opened the prepared merchant WhatsApp receipt link; not proof of message delivery.';
comment on column public.orders.merchant_receipt_whatsapp_sent_at is
  'Latest time the Super Admin manually confirmed sending the receipt in WhatsApp.';
comment on column public.orders.merchant_receipt_whatsapp_shared_by is
  'Super Admin who last recorded the WhatsApp receipt handoff or manual send confirmation.';

create or replace function public.admin_record_order_receipt_share(
  p_order_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_action text;
begin
  if v_admin_id is null or not public.is_super_admin() then
    raise exception 'Super admin only';
  end if;

  if p_status is null or p_status not in ('opened', 'sent_confirmed') then
    raise exception 'Invalid WhatsApp receipt status';
  end if;

  select *
    into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.merchant_id is null then
    raise exception 'WhatsApp merchant receipts are only available for partner-store orders';
  end if;

  if p_status = 'opened' then
    update public.orders
      set merchant_receipt_whatsapp_opened_at = now(),
          merchant_receipt_whatsapp_shared_by = v_admin_id
    where id = p_order_id;
    v_action := 'merchant_receipt_whatsapp_opened';
  else
    if v_order.merchant_receipt_whatsapp_opened_at is null then
      raise exception 'Open the WhatsApp receipt before confirming that it was sent';
    end if;

    update public.orders
      set merchant_receipt_whatsapp_sent_at = now(),
          merchant_receipt_whatsapp_shared_by = v_admin_id
    where id = p_order_id;
    v_action := 'merchant_receipt_whatsapp_sent_confirmed';
  end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, details)
  values (
    v_admin_id,
    v_action,
    'order',
    p_order_id,
    jsonb_build_object('status', p_status, 'merchant_id', v_order.merchant_id)
  );
end;
$function$;

revoke execute on function public.admin_record_order_receipt_share(uuid, text) from public;
revoke execute on function public.admin_record_order_receipt_share(uuid, text) from anon;
grant execute on function public.admin_record_order_receipt_share(uuid, text) to authenticated;
