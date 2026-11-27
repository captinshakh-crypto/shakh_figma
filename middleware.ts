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
  const pathname = request.nextUrl.pathname;
  const isProtectedAppPath = pathname.startsWith("/dashboard") || pathname.startsWith("/cart");
  const isProfileCompletionPath = pathname === "/dashboard/profile";
  if (user && isProtectedAppPath && !isProfileCompletionPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.phone?.trim()) {
      const target = request.nextUrl.clone();
      target.pathname = "/dashboard/profile";
      target.search = "?require_phone=1";
      const redirect = NextResponse.redirect(target);
      request.cookies.getAll().forEach(({ name, value }) => redirect.cookies.set(name, value));
      return redirect;
    }
  }
  return response;
}
export const config = { matcher: ["/dashboard/:path*", "/cart/:path*", "/reset-password/:path*"] };