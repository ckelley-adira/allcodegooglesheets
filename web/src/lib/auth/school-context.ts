/**
 * @file auth/school-context.ts — Active school context for TILT Admins
 *
 * TILT Admins manage multiple schools. Rather than rebuilding the auth
 * model to handle multi-school membership, we use a "context school":
 * the school the user is currently operating on.
 *
 * For TILT Admin: the context school is read from the `active_school_id`
 *   cookie. They can switch by setting the cookie via setActiveSchoolId().
 *
 * For all other roles: the context school is always their own school
 *   from the JWT claim. They cannot switch.
 *
 * This is the layer all DAL writes and Server Actions should consult
 * instead of reading user.schoolId directly. Reads via Supabase JS client
 * still go through RLS, which respects the JWT claim — so TILT Admins
 * see all schools' data via RLS bypass (is_tilt_admin claim), and the
 * activeSchoolId only affects which school they're WRITING to.
 *
 * @see lib/auth/index.ts for the underlying user/role helpers
 */

import { cookies } from "next/headers";
import { requireAuth, type AuthUser } from "@/lib/auth";

/** Cookie name for the TILT Admin's active school selection */
const ACTIVE_SCHOOL_COOKIE = "active_school_id";

/**
 * Returns the school ID the user is currently operating on.
 *
 * - TILT Admin: reads `active_school_id` cookie, falls back to user.schoolId
 *   (the one in their staff record) if no cookie is set
 * - All other roles: returns user.schoolId from the JWT claim
 *
 * @rls Use this for all writes (creates, updates) so TILT Admins create
 *   data in the school they're currently viewing, not their default school.
 */
export async function getActiveSchoolId(user?: AuthUser): Promise<number> {
  const u = user ?? (await requireAuth());

  if (u.isTiltAdmin) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value;
    if (cookieValue) {
      const parsed = Number(cookieValue);
      if (parsed && !isNaN(parsed)) return parsed;
    }
  }

  return u.schoolId;
}

/**
 * Combined helper: returns both the auth user and the active school ID
 * in one call. Use in Server Components and Server Actions.
 */
export async function requireAuthWithSchool(): Promise<{
  user: AuthUser;
  activeSchoolId: number;
}> {
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);
  return { user, activeSchoolId };
}

export { ACTIVE_SCHOOL_COOKIE };
