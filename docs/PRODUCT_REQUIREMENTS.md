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
- Merchant commission rates and captain/platform delivery fee split must be configurable and snapshotted on each order/settlement.
- On a completed/settled sale, deduct the configured merchant commission from the merchant wallet and credit the platform wallet. Any selected reward/gift amount is credited to the reward owner’s wallet and recorded separately.
- Example delivery fee: 1,000 IQD; platform share: 200 IQD. The remaining 800 IQD is the captain share unless the platform admin configures another split. The fee and split are snapshotted at order settlement.
- Reward owners may request a cash payout through the platform admin. Requests can specify FastPay or FIB as the requested payout channel. Actual cash transfer is manual and must only be marked paid by an authorized admin after off-platform payment is verified.
- Top-up approval, commissions, rewards, delivery settlement, and payout processing must be idempotent and auditable; prevent duplicate settlement and negative balances unless explicitly configured.

## Order lifecycle
- draft/cart -> placed -> accepted/rejected by merchant -> preparing -> ready_for_pickup -> assigned -> picked_up -> delivered; cancellation/refund paths are separately permissioned and audited.
- Orders may contain items from multiple merchants only if checkout explicitly supports split sub-orders; otherwise checkout must enforce one merchant per order in the first release.

## Security and reliability
- Enable RLS on all user/business data tables.
- Use least-privilege policies; never trust role IDs or amounts sent by the browser.
- Secrets (Supabase service-role key, Resend API key) must exist only in server-side environment variables / secret store and never be committed.
- Validate all monetary amounts as positive integer IQD values; use database transactions for all financial operations.
- Add audit logs for admin actions and financial mutations.
- Use database constraints, indexes, idempotency keys, and tests for settlement and wallet functions.

## Open business decisions before production settlement
- Confirm whether checkout is one merchant per order or a single cart can split across merchants.
- Confirm whether the 200 IQD platform share is deducted from the captain’s 1,000 IQD delivery fee (leaving 800 IQD to captain), or is an additional fee paid by the customer.
- Set default merchant commission rates and reward/gift rules; admin-configurable values can be introduced, but initial rates must be approved before live charging.
