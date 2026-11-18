## Supabase password recovery template (cross-device)

In Supabase Dashboard → Authentication → Email Templates → Reset Password, use a token-hash link instead of `{{ .ConfirmationURL }}`. This allows users to request recovery on one device and open the email on another.

Subject:
`Reset your SHAKH password`

HTML:
```html
<h2>Reset your SHAKH password</h2>
<p>We received a request to reset your password. Follow the link below to choose a new one.</p>
<p>
  <a href="https://www.daim-post.online/auth/recovery?token_hash={{ .TokenHash }}&amp;type=recovery">
    Reset password
  </a>
</p>
<p>If you did not request this, you can safely ignore this email.</p>
```

The application route `/auth/recovery` verifies the one-time token hash with `supabase.auth.verifyOtp({ token_hash, type: "recovery" })`, writes the resulting session cookies, and redirects to `/reset-password`. Do not use `{{ .ConfirmationURL }}` in this template: the default PKCE recovery link requires the same browser/device that initiated the request.
