-- Tighten delivery contact invariants and expose only participant reads for status history.
alter table public.orders
  alter column delivery_address set not null,
  alter column delivery_phone set not null,
  add constraint orders_delivery_address_length_check
    check (length(trim(delivery_address)) between 8 and 500),
  add constraint orders_delivery_phone_format_check
    check (
      delivery_phone ~ '^[0-9+()[:space:]-]+$'
      and length(regexp_replace(delivery_phone,'[^0-9]','','g')) between 7 and 20
    ),
  add constraint orders_delivery_notes_length_check
    check (delivery_notes is null or length(trim(delivery_notes)) <= 500);

revoke all on table public.order_status_history from anon, authenticated;
grant select on table public.order_status_history to authenticated;
