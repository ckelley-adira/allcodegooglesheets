/**
 * @file dashboard/school-context-actions.ts — Server Actions for school context
 *
 * Handles the school switcher in the top bar. Only TILT Admins can change
 * the active school; School Admins are locked to their own school.
 *
 * @actionType mutation
 */

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { ACTIVE_SCHOOL_COOKIE } from "@/lib/auth/school-context";

/**
 * Sets the active school for a TILT Admin via cookie.
 *
 * @actionType mutation
 * @rls TILT Admin only.
 */
export async function setActiveSchoolAction(formData: FormData): Promise<void> {
  await requireRole("tilt_admin");

  const schoolId = Number(formData.get("schoolId"));
  if (!schoolId || isNaN(schoolId)) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SCHOOL_COOKIE, String(schoolId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  revalidatePath("/", "layout");
}
