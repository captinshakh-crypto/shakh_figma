# SHAKH branded authentication emails through Resend

The SHAKH sign-up confirmation, password recovery, and account-security notices use published Resend templates:

| Resend alias | Purpose |
| --- | --- |
| `shakh-confirm-email` | Sign-up confirmation (also reused for invite and magic-link actions) |
| `shakh-password-recovery` | Password recovery link |
| `shakh-password-changed` | Notice after a password is changed |
| `shakh-security-notice` | Other supported account-security notices |

All templates use the SHAKH navy/orange email layout and the verified `daim-post.online` sender domain. Open and click tracking should stay disabled for authentication messages so one-time links are not rewritten.

## Supabase Edge Function

Function source: `supabase/functions/send-auth-email/index.ts`

The function verifies the Supabase Auth Send Email Hook signature with `standardwebhooks`, then sends a published Resend template. Deploy it with JWT verification disabled because Supabase Auth authenticates the request with the signed webhook headers:

```bash
supabase functions deploy send-auth-email --no-verify-jwt
```

The deployed function URL is:

```
https://zafspwzqxxddbfmtjziq.supabase.co/functions/v1/send-auth-email
```

The function requires these server-side Edge Function secrets:

- `RESEND_API_KEY`: the existing server-side Resend API key already used by `send-wallet-email`.
- `RESEND_FROM_EMAIL`: `SHAKH <notifications@daim-post.online>` (the function has this as its fallback).
- `SEND_EMAIL_HOOK_SECRET`: the signing secret generated when the Send Email Hook is created in Supabase.

Never expose any of these values through a `NEXT_PUBLIC_*` variable or frontend code.

## One-time Supabase Dashboard configuration

1. Open the SHAKH Supabase project, **Authentication → Hooks**, and create a **Send Email** hook using HTTPS.
2. Set the hook URL to the function URL above.
3. Generate the hook secret in that screen and save the exact `v1,whsec_...` value as the Edge Function secret `SEND_EMAIL_HOOK_SECRET`.
4. Keep the Email provider enabled and enable the hook. With the Send Email Hook enabled, Supabase Auth still generates and validates the one-time tokens; the Edge Function only delivers the emails through Resend.
5. In the Auth notification settings, enable **Password changed** if users should receive the post-change security notice.

The signing secret must be generated in the Supabase dashboard and stored in the Edge Function secrets. It is not committed to this repository.

## Confirmation and recovery flow

- Sign-up confirmation emails link to `/auth/confirm`. That server route verifies the one-time token hash using Supabase Auth and sets the session cookies before redirecting to the dashboard (or cart).
- Password recovery emails link to the existing `/auth/recovery` route. It verifies the recovery token hash and redirects to `/reset-password`, preserving cross-device recovery.
- Password-change notices and supported security notifications use separate Resend templates and never include a password or reusable token.

The hook currently handles sign-up, invite, magic-link, recovery, password-changed, and the listed account-security notification actions. Add explicit handling before enabling any new Auth email action in the product.
