# SHAKH — Product Requirements

## Product
- Brand: SHAKH (شاخ)
- Domain: daim-post.online
- Locale/currency: Kurdish-first UI; IQD (Iraqi dinar) as the primary currency.
- Visual identity: orange, blue, white; responsive web app and installable PWA.
- Production integrations: Supabase (Auth, Postgres, Storage, Realtime), Vercel hosting, Resend transactional email. No mock/demo records in production.

## Roles and access
- super_admin: full platform administration; owns and exclusively manages SHAKH Store.
- captain: delivery operations and assigned deliveries.
- Captain subtype is stored separately from the top-level app role: `shakh` (platform-wide dispatch) or `merchant` (one approved merchant only).
- Becoming a captain requires a customer-submitted application and explicit super-admin approval. A merchant-scoped captain can only be assigned orders belonging to the linked merchant; a SHAKH captain may be assigned any merchant's order, including SHAKH Store.
- Customer profile edits are limited to full name and phone through a validated RPC; users cannot change their own role or captain scope.
- customer: browse, cart, checkout, orders, wallet, rewards.
- supermarket, restaurant, butcher_poultry, grocery: merchant roles; each merchant can manage only its own store, category, products/posts, inventory, and orders.
- A user may have a merchant profile only after admin approval. Authorization is enforced in PostgreSQL RLS and server-side functions, not only in the UI.
- Initial super-admin email: sardar.xano59@gmail.com. Bootstrap must verify the authenticated email and must not allow public self-promotion to super_admin.

## Main modules
1. Public storefront and category discovery.
2. Merchant-specific dashboards and product/post management.
3. SHAKH Store, visible and editable only by super_admin.
4. Cart and checkout; order lifecycle and delivery assignment.
5. Service zones and availability.
6. Captain dashboard, delivery status, and delivery fee accounting.
7. Internal wallet ledger and top-up requests.
8. Merchant commissions and configurable platform fee rules.
9. Rewards and reward redemption.
10. Notifications (in-app and email via Resend).
11. Admin dashboard, audit trail, reports, and configuration.
12. PWA installability, offline app shell, and responsive UX.

## Wallet and financial rules
- Wallet is an internal accounting ledger only; it is not a bank account and does not initiate bank transfers.
- Any role may request a wallet top-up without paying at request time. A request records the requested IQD amount and remains pending until a super-admin approves or rejects it. Approval creates a corresponding wallet credit and notification; rejection does not change the balance.
- Example: request 10,000 IQD -> pending request; on approval, credit 10,000 IQD.
- Super-admin may manually credit their own wallet, with an auditable ledger entry.
- All balance changes must be append-only ledger transactions, performed atomically by trusted database functions; never accept a client-supplied balance.
- Merchant commission rates remain configurable by merchant category. Delivery fee, SHAKH share, and captain share are configured independently for each service zone; the three amounts must reconcile exactly.
- Each order snapshots the selected service zone's delivery fee, SHAKH share, and captain share at creation. Later zone price edits must not change existing orders or earnings.
- On a completed/settled sale, deduct the configured merchant commission from the merchant wallet and credit the platform wallet. Any selected reward/gift amount is credited to the reward owner’s wallet and recorded separately.
- Default example for a new zone: 1,000 IQD delivery fee = 200 IQD SHAKH share + 800 IQD captain share. The super-admin may configure a different exact split for each zone. The fee and both shares are snapshotted when the order is created.
- Reward owners may request a cash payout through the platform admin. Requests can specify FastPay or FIB as the requested payout channel. Actual cash transfer is manual and must only be marked paid by an authorized admin after off-platform payment is verified.
- Top-up approval, commissions, rewards, delivery settlement, and payout processing must be idempotent and auditable; prevent duplicate settlement and negative balances unless explicitly configured.

## Product catalog and inventory
- Each merchant manages only its own catalog; the super-admin exclusively manages SHAKH Store products.
- Product records include name, description, category, integer IQD price, sale unit, optional stock quantity, image, and availability.
- Supported merchant catalog types are supermarket, restaurant, butcher/poultry, and grocery, with category choices relevant to each store type.
- A blank stock quantity means inventory is not tracked; zero stock prevents adding the product to a cart. Negative stock is rejected by the database.
- New prices and stock values appear in the public shop and are refreshed in the cart before checkout. The checkout RPC revalidates product availability and stock and uses database prices.
- Product updates refresh the updated_at timestamp. Product images are limited to JPG, PNG, or WebP and 5 MB in the product-images bucket.
- Existing order item title and price snapshots remain unchanged when the catalog is edited later.

## Order lifecycle
- draft/cart -> placed -> accepted/rejected by merchant -> preparing -> ready_for_pickup -> assigned -> picked_up -> delivered; cancellation/refund paths are separately permissioned and audited.
- Checkout is limited to one merchant/store per order. SHAKH Store uses its own platform-owned checkout endpoint.
- Every order requires a delivery address (8–500 characters) and contact phone number (7–20 digits); optional delivery notes are limited to 500 characters. These details are immutable snapshots on the order.
- Checkout accepts prices and stock only from the database, reserves tracked stock within the transaction, and uses an idempotency key to prevent duplicate orders on retries.
- Initial order state is `placed`. Merchant transitions are `placed -> accepted/rejected -> preparing -> ready_for_pickup`; customer cancellation is allowed only while `placed`. Super-admin can cancel before captain pickup.
- Only the super-admin assigns a captain to a `ready_for_pickup` order. SHAKH captains can serve all stores; merchant captains are restricted to their linked merchant. The assigned captain transitions `assigned -> picked_up -> delivered`.
- Every state transition is stored in `order_status_history`, visible only to the order customer, assigned captain, owning merchant, or super-admin. The order and history tables are added to the Supabase Realtime publication for live tracking.
- Rejecting an order or cancelling it before pickup restores reserved stock in the same database transaction. Delivered orders are settled separately through the existing idempotent settlement process.

## Security and reliability
- Enable RLS on all user/business data tables.
- Use least-privilege policies; never trust role IDs or amounts sent by the browser.
- Secrets (Supabase service-role key, Resend API key) must exist only in server-side environment variables / secret store and never be committed.
- Validate all monetary amounts as positive integer IQD values; use database transactions for all financial operations.
- Add audit logs for admin actions and financial mutations.
- Use database constraints, indexes, idempotency keys, and tests for settlement and wallet functions.

## Confirmed decisions and production setup
- Delivery fee split is configured per service zone, not by merchant category. A 1,000 IQD example zone uses 200 IQD for SHAKH and 800 IQD for the assigned captain. The database enforces that both shares sum exactly to the zone delivery fee, and each order stores immutable fee/share snapshots.
- Merchant commission is configurable separately for supermarket, restaurant, butcher/poultry, and grocery. The initial rates are set to 0 basis points until the super-admin chooses the real rates; no unapproved commission is charged.
- One order belongs to one merchant in the first release. SHAKH Store is represented as a platform-owned store with no merchant owner. SHAKH Store orders use a dedicated authenticated checkout RPC that retains product, stock, and service-zone validation and notifies the super-admin.
- Reward/gift campaign amount is added to the customer's order total. After delivery settlement, the exact amount is credited to the campaign owner's internal wallet.
- Reward owners may request a cash payout using FastPay or FIB. The platform admin must complete the off-platform payment and then mark the request paid.
- Before launch, the super-admin must sign up with the verified email `sardar.xano59@gmail.com`; the Auth trigger promotes that exact verified account.
- The super-admin must create the active delivery zones and delivery fees before checkout can accept orders.
- Resend credentials must be rotated and added as Supabase Edge Function secrets. The sender domain must be verified in Resend before email delivery is live.
- Vercel team access and the domain `daim-post.online` must be authorized/verified before production deployment.
