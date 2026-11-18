import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const safeRedirect = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    redirect.headers.set("Cache-Control", "no-store, max-age=0");
    redirect.headers.set("Referrer-Policy", "no-referrer");
    return redirect;
  };

  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!tokenHash || type !== "recovery" || !supabaseUrl || !supabaseKey) {
    return safeRedirect("/reset-password?error=missing_token");
  }

  // A token hash is self-contained: unlike a PKCE auth code, it does not
  // depend on the browser/device that requested the recovery email.
  const response = safeRedirect("/reset-password?verified=1");

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(cacheHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    // Never log the token hash: it is a one-time credential.
    console.error("[auth/recovery] token verification failed", {
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return safeRedirect("/reset-password?error=verification");
  }

  return response;
}
