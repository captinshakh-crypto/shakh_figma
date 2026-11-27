import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const flowId = requestUrl.searchParams.get("sb_flow_id");
  const requestedNext = requestUrl.searchParams.get("next") ?? "/dashboard";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
  const recovery = next === "/reset-password";
  const failureUrl = recovery
    ? new URL("/reset-password?error=verification", request.url)
    : new URL("/login?auth_error=verification", request.url);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!code || !supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(
      recovery ? new URL("/reset-password?error=missing_code", request.url) : new URL("/login?auth_error=callback", request.url)
    );
  }

  const response = NextResponse.redirect(new URL(next, request.url));
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

  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined
  );
  if (error) {
    // Keep the user in the recovery flow and log only diagnostic metadata.
    console.error("[auth/callback] PKCE code exchange failed", {
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return NextResponse.redirect(failureUrl);
  }
  const privacyVersion = requestUrl.searchParams.get("privacy_policy_version");
  const privacyMethod = requestUrl.searchParams.get("privacy_method");
  if (
    privacyVersion === "2026-11-26" &&
    (privacyMethod === "email_signup" || privacyMethod === "google_signup")
  ) {
    const { error: acceptanceError } = await supabase.rpc("record_shakh_privacy_policy_acceptance", {
      p_policy_version: privacyVersion,
      p_method: privacyMethod,
    });
    if (acceptanceError) {
      console.error("[auth/callback] privacy acceptance record failed", {
        code: acceptanceError.code,
      });
    }
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!recovery && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.phone) {
      const completionUrl = new URL("/complete-profile", request.url);
      completionUrl.searchParams.set("next", next);
      response.headers.set("Location", completionUrl.toString());
      return response;
    }
  }

  return response;
}
