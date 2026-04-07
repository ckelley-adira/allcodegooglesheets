/**
 * @file auth/callback/route.ts — OAuth/email-confirm callback handler
 *
 * Supabase redirects here after email confirmation or OAuth sign-in.
 * Exchanges the auth code for a session, then redirects to /dashboard.
 *
 * Route: GET /auth/callback?code=<auth_code>
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If code exchange fails, redirect to login with error hint
  return NextResponse.redirect(`${origin}/login`);
}
