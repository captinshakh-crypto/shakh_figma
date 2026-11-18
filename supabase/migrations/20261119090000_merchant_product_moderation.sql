-- Merchant product moderation is separate from Shakh Store.
alter table public.products
  add column if not exists approval_status text not null default 'approved',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists rejection_reason text;
alter table public.products drop constraint if exists products_approval_status_check;
alter table public.products add constraint products_approval_status_check check (approval_status in ('pending','approved','rejected'));

create or replace function public.set_product_submission_defaults()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_shakh_store then
    new.approval_status := 'approved';
    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
    new.rejection_reason := null;
  else
    new.approval_status := 'pending';
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.rejection_reason := null;
  end if;
  return new;
end; $$;
drop trigger if exists products_submission_defaults on public.products;
create trigger products_submission_defaults before insert on public.products for each row execute function public.set_product_submission_defaults();

create or replace function public.protect_product_moderation_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_super_admin() then
    new.approval_status := old.approval_status;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
    new.rejection_reason := old.rejection_reason;
    new.is_shakh_store := old.is_shakh_store;
    new.merchant_id := old.merchant_id;
  end if;
  return new;
end; $$;
drop trigger if exists products_protect_moderation_fields on public.products;
create trigger products_protect_moderation_fields before update on public.products for each row execute function public.protect_product_moderation_fields();

create or replace function public.admin_review_product(p_product_id uuid,p_approve boolean,p_rejection_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_super_admin() then raise exception 'not_authorized'; end if;
  update public.products
  set approval_status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_at = now(), reviewed_by = auth.uid(),
      rejection_reason = case when p_approve then null else nullif(trim(p_rejection_reason),'') end,
      is_available = case when p_approve then is_available else false end
  where id = p_product_id and is_shakh_store = false;
  if not found then raise exception 'merchant_product_not_found'; end if;
end; $$;
revoke all on function public.admin_review_product(uuid,boolean,text) from public;
grant execute on function public.admin_review_product(uuid,boolean,text) to authenticated;

drop policy if exists products_authenticated_read on public.products;
drop policy if exists products_public_available on public.products;
create policy products_public_available on public.products for select to anon,authenticated using (
 (approval_status='approved' and is_available=true)
 or public.is_super_admin()
 or exists(select 1 from public.merchant_profiles m where m.id=products.merchant_id and m.user_id=(select auth.uid()))
);
