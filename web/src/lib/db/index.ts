/**
 * @file db/index.ts — Drizzle database client
 *
 * Creates a singleton Drizzle client connected to the Supabase Postgres
 * instance. Uses the `postgres` driver for connection pooling.
 *
 * @rls All queries through this client are subject to Supabase RLS policies
 *   when using the anon/service role keys. Direct `postgres` connections
 *   bypass RLS — use only for migrations and admin operations.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Direct Postgres connection for Drizzle.
 * Uses DATABASE_URL which should point to the Supabase Postgres instance.
 * In production, this is the pooler connection string (port 6543).
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Check your .env.local file.\n" +
      "For local dev: postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  );
}

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
