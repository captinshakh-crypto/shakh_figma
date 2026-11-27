-- Raise the product image bucket limit to 10 MiB.
-- Client uploads are resized and encoded to WebP when supported.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[]
where id = 'product-images';
