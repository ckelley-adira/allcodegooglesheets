/**
 * @file drizzle.config.ts — Drizzle Kit configuration for migrations
 *
 * Reads DATABASE_URL from .env.local. For local dev, this points to the
 * Supabase CLI's local Postgres instance (port 54322 by default).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
