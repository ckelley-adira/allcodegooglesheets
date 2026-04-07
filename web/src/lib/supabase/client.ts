/**
 * @file supabase/client.ts — Browser-side Supabase client
 *
 * Creates a singleton Supabase client for use in Client Components.
 * Auth state is managed via cookies set by the server-side client and
 * refreshed by middleware.
 */

"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase browser client. Safe to call multiple times —
 * @supabase/ssr deduplicates internally.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
