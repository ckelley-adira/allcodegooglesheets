/**
 * @file db/index.ts — Drizzle database client
 *
 * Creates a lazily-initialized singleton Drizzle client connected to the
 * Supabase Postgres instance. Uses the `postgres` driver for connection pooling.
 *
 * Lazy initialization is required because Next.js evaluates module scope
 * at build time for page data collection, but DATABASE_URL is only
 * available at runtime.
 *
 * Connection config:
 * - ssl: 'require' — Supabase requires TLS
 * - prepare: false — required for Supabase's transaction pooler (pgBouncer)
 *   to work with prepared statements
 * - max: 1 — serverless functions should not hold open multiple connections
 *
 * @rls All queries through this client are subject to Supabase RLS policies
 *   when using the anon/service role keys. Direct `postgres` connections
 *   bypass RLS — use only for migrations and admin operations.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: PostgresJsDatabase<typeof schema> | null = null;

/**
 * Returns the singleton Drizzle client. Initializes on first call.
 * Safe to call at any point — will throw at runtime if DATABASE_URL
 * is not set, but won't break the build.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Check your .env.local file.\n" +
        "For local dev: postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    );
  }

  const client = postgres(connectionString, {
    ssl: "require",
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 30,
    connection: {
      // Disable statement timeout at the session level — Supabase pooler
      // defaults to a low timeout that can kill cold-start queries
      statement_timeout: 0,
    },
  });
  _db = drizzle(client, { schema });
  return _db;
}

/**
 * Convenience alias — same as getDb() but reads as a value.
 * Use in DAL functions: `const rows = await db.select(...)`.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});
