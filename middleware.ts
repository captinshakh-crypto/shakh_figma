import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
      }
    }
  });
  const { data: { user } } = await supabase.auth.getUser();
  const protectedForPhone = request.nextUrl.pathname.startsWith("/dashboard")
    || request.nextUrl.pathname.startsWith("/cart");

  if (user && protectedForPhone) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.phone) {
      const completionUrl = request.nextUrl.clone();
      completionUrl.pathname = "/complete-profile";
      completionUrl.search = "";
      completionUrl.searchParams.set(
        "next",
        request.nextUrl.pathname.startsWith("/cart") ? "/cart" : "/dashboard"
      );
      const redirect = NextResponse.redirect(completionUrl);
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  }

  return response;
}
export const config = { matcher: ["/dashboard/:path*", "/cart/:path*", "/reset-password/:path*"] };