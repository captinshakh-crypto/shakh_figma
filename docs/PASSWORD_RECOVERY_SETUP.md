## SHAKH password recovery email (cross-device)

Password recovery is delivered through the Supabase Auth **Send Email Hook** and the published Resend template alias `shakh-password-recovery`.

The hook creates a link in this form:

```
https://daim-post.online/auth/recovery?token_hash=<one-time-token-hash>&type=recovery
```

The application route `/auth/recovery` verifies the one-time token hash with `supabase.auth.verifyOtp({ token_hash, type: "recovery" })`, writes the resulting session cookies, and redirects to `/reset-password`. This allows users to request recovery on one device and open the email on another.

Do not replace the token-hash link with a PKCE `{{ .ConfirmationURL }}` link: the default PKCE recovery link requires the same browser/device that initiated the request.

See [RESEND_AUTH_EMAIL_SETUP.md](./RESEND_AUTH_EMAIL_SETUP.md) for the one-time Supabase Send Email Hook setup and required Edge Function secrets.
