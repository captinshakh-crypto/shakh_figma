-- Product image storage bucket and least-privilege notification updates.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
for select to anon,authenticated using (bucket_id='product-images');

drop policy if exists product_images_owner_upload on storage.objects;
create policy product_images_owner_upload on storage.objects
for insert to authenticated with check (
  bucket_id='product-images'
  and ((storage.foldername(name))[1]=auth.uid()::text or public.is_super_admin())
);

drop policy if exists product_images_owner_update on storage.objects;
create policy product_images_owner_update on storage.objects
for update to authenticated using (
  bucket_id='product-images'
  and ((storage.foldername(name))[1]=auth.uid()::text or public.is_super_admin())
) with check (
  bucket_id='product-images'
  and ((storage.foldername(name))[1]=auth.uid()::text or public.is_super_admin())
);

drop policy if exists product_images_owner_delete on storage.objects;
create policy product_images_owner_delete on storage.objects
for delete to authenticated using (
  bucket_id='product-images'
  and ((storage.foldername(name))[1]=auth.uid()::text or public.is_super_admin())
);

revoke update on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;
