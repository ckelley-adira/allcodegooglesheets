/**
 * @file supabase/middleware.ts — Supabase auth session refresh for middleware
 *
 * Refreshes the Supabase auth session on every request so the JWT stays
 * valid. Called from the root middleware.ts.
 */

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Refreshes the Supabase auth session by reading/writing cookies in
 * the middleware request/response cycle.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh the session — this is the critical call that keeps the JWT alive.
  // Do not remove this even if you don't need the user object here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login, except for public routes
  const isPublicRoute =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/auth/");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
