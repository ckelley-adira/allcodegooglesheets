/**
 * @file auth/index.ts — Auth utility helpers for Adira Reads
 *
 * Centralized auth functions used by Server Components, Server Actions,
 * and Route Handlers. Wraps Supabase Auth with role-aware helpers.
 *
 * Per D-002: JWT carries school_id and role claims for RLS.
 * Per D-003: Five roles — tutor, coach, school_admin, tilt_admin (parent deferred).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** The app_metadata shape embedded in Supabase JWTs */
export interface AppMetadata {
  school_id: number;
  role: "tutor" | "coach" | "school_admin" | "tilt_admin";
  is_tilt_admin: boolean;
}

/** Authenticated user with Adira Reads-specific metadata */
export interface AuthUser {
  id: string;
  email: string;
  schoolId: number;
  role: AppMetadata["role"];
  isTiltAdmin: boolean;
}

/**
 * Returns the current authenticated user, or null if not logged in.
 * Does NOT redirect — use requireAuth() when auth is mandatory.
 *
 * @rls The returned user's school_id is what RLS policies filter on.
 */
export async function getUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const meta = (user.app_metadata ?? {}) as Partial<AppMetadata>;

  return {
    id: user.id,
    email: user.email ?? "",
    schoolId: meta.school_id ?? 0,
    role: meta.role ?? "tutor",
    isTiltAdmin: meta.is_tilt_admin ?? false,
  };
}

/**
 * Returns the current authenticated user, or redirects to /login.
 * Use in Server Components and Server Actions where auth is required.
 *
 * @rls Guarantees the returned user has a valid session with school_id claim.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Returns the current user if they have one of the allowed roles,
 * or redirects to /dashboard with an implicit "access denied."
 *
 * @rls Role check is an application-layer guard (D-002 layer 3).
 *   RLS handles row-level filtering; this handles action-level gating.
 */
export async function requireRole(
  ...allowedRoles: AppMetadata["role"][]
): Promise<AuthUser> {
  const user = await requireAuth();

  // TILT Admin bypasses role checks (they can do anything)
  if (user.isTiltAdmin) return user;

  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  return user;
}
