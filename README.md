# SHAKH — شاخ

Kurdish-first multi-merchant delivery PWA for restaurants, supermarkets, butcher & poultry shops, groceries, captains and customers.

## Stack
- Next.js App Router + TypeScript + Tailwind CSS
- Supabase Auth, PostgreSQL, RLS, RPCs and Realtime-ready data model
- Vercel deployment
- PWA manifest and offline app shell

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key).
3. Run `npm install`, then `npm run dev`.
4. Use `npm run typecheck` and `npm run build` before deployment.

Never put the Supabase service-role key or Resend API key in browser variables or commit secrets.

## Supabase
Migrations are in `supabase/migrations`. The initial owner account is promoted only when Supabase Auth verifies `sardar.xano59@gmail.com`. Create/sign up with that email and verify it; then the database trigger provisions the super-admin profile and wallet.

## Business rules
- All prices and wallet values are integer IQD.
- The platform receives 200 IQD from a 1,000 IQD delivery fee; the captain receives the remaining 800 IQD.
- Merchant commission is configurable per merchant category by the super-admin. New orders snapshot the rate.
- Wallet top-ups are requests, not payments. The wallet is internal accounting only.
- FastPay/FIB payouts are manual off-platform payments and are marked paid only by the super-admin after verification.
- SHAKH Store product management is restricted to the super-admin.
- Checkout is one merchant per order in the initial release.

## Deployment
Connect this Git repository to Vercel and set the environment variables in the Vercel project settings. Attach `daim-post.online` only after the Vercel project is linked and DNS verification is complete.
