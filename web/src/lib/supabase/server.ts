/**
 * @file supabase/server.ts — Server-side Supabase client for Next.js App Router
 *
 * Creates a Supabase client that reads/writes cookies for auth session
 * management. Used in Server Components, Server Actions, and Route Handlers.
 *
 * @rls Queries through this client respect RLS policies because the JWT
 *   from the authenticated user's session is passed to Supabase.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase server client with cookie-based auth.
 * Must be called inside a Server Component, Server Action, or Route Handler.
 *
 * @rls Returns a client scoped to the authenticated user's school_id via JWT claims.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll is called from Server Components where cookies can't be set.
            // This is expected when refreshing tokens in middleware — the middleware
            // handles the actual cookie write.
          }
        },
      },
    },
  );
}
