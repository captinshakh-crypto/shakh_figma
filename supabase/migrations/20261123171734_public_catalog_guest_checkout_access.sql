-- Public visitors may browse approved/available products without executing
-- privileged admin helpers. Keep authenticated seller/admin visibility separate.
DROP POLICY IF EXISTS products_public_available ON public.products;

CREATE POLICY products_public_available
ON public.products
FOR SELECT
TO anon
USING (
  approval_status = 'approved'
  AND is_available = true
);

CREATE POLICY products_authenticated_read_scope
ON public.products
FOR SELECT
TO authenticated
USING (
  (
    approval_status = 'approved'
    AND is_available = true
  )
  OR (SELECT public.is_super_admin())
  OR EXISTS (
    SELECT 1
    FROM public.merchant_profiles AS m
    WHERE m.id = products.merchant_id
      AND m.user_id = (SELECT auth.uid())
  )
);

-- Do not expose private cost/commission/admin fields through the public catalog.
REVOKE ALL PRIVILEGES ON TABLE public.products FROM anon;
GRANT SELECT (
  id,
  title,
  description,
  price_iqd,
  category_key,
  merchant_id,
  is_shakh_store,
  image_path,
  referral_commission_iqd,
  stock_quantity,
  unit,
  approval_status,
  is_available,
  created_at
) ON TABLE public.products TO anon;

-- Anonymous shoppers only need the public store identity and location.
REVOKE ALL PRIVILEGES ON TABLE public.merchant_profiles FROM anon;
GRANT SELECT (
  id,
  business_name,
  merchant_type,
  address,
  approval_status
) ON TABLE public.merchant_profiles TO anon;
