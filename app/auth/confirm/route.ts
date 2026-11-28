import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

const allowedTypes = new Set<EmailOtpType>(["email", "invite", "magiclink"]);

function redirect(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const requestedType = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const requestedNext = requestUrl.searchParams.get("next");
  const next = requestedNext === "/cart" ? "/cart" : "/dashboard";

  if (!tokenHash || !requestedType || !allowedTypes.has(requestedType)) {
    return redirect(request, "/login?auth_error=verification");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return redirect(request, "/login?auth_error=verification");
  }

  const response = redirect(request, next);
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
    type: requestedType,
  });

  if (error) {
    // Never log the one-time token hash.
    console.error("[auth/confirm] email token verification failed", {
      code: error.code,
      status: error.status,
      message: error.message,
      type: requestedType,
    });
    return redirect(request, "/login?auth_error=verification");
  }

  return response;
}
