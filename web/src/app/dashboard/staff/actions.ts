/**
 * @file dashboard/staff/actions.ts — Server Actions for staff management
 *
 * Wraps the staff DAL with authentication and role checks.
 * Only school_admin and tilt_admin can manage staff (D-003).
 *
 * @actionType mutation
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  createStaff as dalCreateStaff,
  updateStaff as dalUpdateStaff,
} from "@/lib/dal/staff";

export interface StaffFormState {
  error: string | null;
  success: boolean;
}

/**
 * Creates a new staff member for the current user's school.
 *
 * @actionType mutation
 * @rls schoolId from JWT claims; role check: school_admin or tilt_admin.
 */
export async function createStaffAction(
  _prevState: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const user = await requireRole("school_admin", "tilt_admin");

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = formData.get("role") as string;

  if (!firstName || !lastName || !email) {
    return { error: "First name, last name, and email are required.", success: false };
  }

  const validRoles = ["tutor", "coach", "school_admin", "tilt_admin"] as const;
  if (!validRoles.includes(role as (typeof validRoles)[number])) {
    return { error: "Invalid role selected.", success: false };
  }

  // Only TILT Admin can create other TILT Admins
  if (role === "tilt_admin" && !user.isTiltAdmin) {
    return { error: "Only TILT Admin can assign the TILT Admin role.", success: false };
  }

  try {
    await dalCreateStaff({
      schoolId: user.schoolId,
      firstName,
      lastName,
      email,
      role: role as (typeof validRoles)[number],
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create staff member.";
    if (message.includes("unique") || message.includes("duplicate")) {
      return { error: "A staff member with this email already exists.", success: false };
    }
    return { error: message, success: false };
  }

  revalidatePath("/dashboard/staff");
  return { error: null, success: true };
}

/**
 * Updates an existing staff member.
 *
 * @actionType mutation
 * @rls schoolId from JWT claims; role check: school_admin or tilt_admin.
 */
export async function updateStaffAction(
  _prevState: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const user = await requireRole("school_admin", "tilt_admin");

  const staffId = Number(formData.get("staffId"));
  if (!staffId || isNaN(staffId)) {
    return { error: "Invalid staff member.", success: false };
  }

  const firstName = (formData.get("firstName") as string)?.trim() || undefined;
  const lastName = (formData.get("lastName") as string)?.trim() || undefined;
  const email =
    (formData.get("email") as string)?.trim().toLowerCase() || undefined;
  const role = (formData.get("role") as string) || undefined;
  const isActiveRaw = formData.get("isActive");
  const isActive =
    isActiveRaw !== null ? isActiveRaw === "true" : undefined;

  if (role === "tilt_admin" && !user.isTiltAdmin) {
    return { error: "Only TILT Admin can assign the TILT Admin role.", success: false };
  }

  try {
    const result = await dalUpdateStaff(
      {
        staffId,
        firstName,
        lastName,
        email,
        role: role as
          | "tutor"
          | "coach"
          | "school_admin"
          | "tilt_admin"
          | undefined,
        isActive,
      },
      user.schoolId,
    );

    if (!result) {
      return { error: "Staff member not found.", success: false };
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update staff member.";
    if (message.includes("unique") || message.includes("duplicate")) {
      return { error: "A staff member with this email already exists.", success: false };
    }
    return { error: message, success: false };
  }

  revalidatePath("/dashboard/staff");
  return { error: null, success: true };
}
