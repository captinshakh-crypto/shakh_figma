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

Never put the Supabase service-role key, Google OAuth client secret, or Resend API key in browser variables or commit secrets.

## Supabase
Migrations are in `supabase/migrations`. The initial owner account is promoted only when Supabase Auth verifies `sardar.xano59@gmail.com`. Create/sign up with that email and verify it; then the database trigger provisions the super-admin profile and wallet.

## Google sign-in
The login page uses Supabase OAuth with the PKCE callback at `https://daim-post.online/auth/callback`.

1. In Google Cloud Console, create an OAuth Client ID for a **Web application** and configure the OAuth consent screen.
2. In Google Cloud, add this exact **Authorized redirect URI** (replace with your own Supabase project URL if different): `https://zafspwzqxxddbfmtjziq.supabase.co/auth/v1/callback`.
3. In Supabase Dashboard → Authentication → Providers → Google, enable Google and enter the Google OAuth Client ID and Client Secret. Save these credentials only in Supabase.
4. In Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, allow `https://daim-post.online/auth/callback` (or `https://daim-post.online/**`).
5. Test Google sign-in on the production domain. If the Google consent screen is in Testing mode, add your Google account as a test user.

The Google Client Secret must never be placed in `NEXT_PUBLIC_*` variables or committed to Git.

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

## Email notifications (Resend)
The `send-wallet-email` Supabase Edge Function is deployed with JWT verification enabled. Add these secrets in Supabase Dashboard → Edge Functions → Secrets:
- `RESEND_API_KEY` — a newly rotated Resend API key
- `RESEND_FROM_EMAIL` — a sender on the verified `daim-post.online` domain
- `SHAKH_ADMIN_EMAIL` — `sardar.xano59@gmail.com`
- `SHAKH_ALLOWED_ORIGIN` — `https://daim-post.online`

The Resend sender domain must be verified before delivery succeeds. Never commit these secrets.

## Vercel environment variables
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production, Preview and Development. These are client-safe values; do not add a service-role key to Vercel's public variables.
