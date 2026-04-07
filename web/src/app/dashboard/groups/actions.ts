/**
 * @file dashboard/groups/actions.ts — Server Actions for group management
 *
 * Wraps the groups DAL with authentication and role checks.
 * Coach+ can manage groups; all staff can view.
 *
 * @actionType mutation
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  createGroup as dalCreateGroup,
  updateGroup as dalUpdateGroup,
  addStudentToGroup as dalAddStudent,
  removeStudentFromGroup as dalRemoveStudent,
} from "@/lib/dal/groups";

export interface GroupFormState {
  error: string | null;
  success: boolean;
}

/**
 * Creates a new instructional group for the current user's school.
 *
 * @actionType mutation
 * @rls schoolId from JWT claims; role check: coach+.
 */
export async function createGroupAction(
  _prevState: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await requireRole("coach", "school_admin", "tilt_admin");

  const groupName = (formData.get("groupName") as string)?.trim();
  const gradeId = Number(formData.get("gradeId"));
  const yearId = Number(formData.get("yearId"));
  const staffId = Number(formData.get("staffId"));
  const isMixedGrade = formData.get("isMixedGrade") === "true";

  if (!groupName) {
    return { error: "Group name is required.", success: false };
  }
  if (!gradeId || isNaN(gradeId)) {
    return { error: "Please select a grade level.", success: false };
  }
  if (!yearId || isNaN(yearId)) {
    return { error: "Please select an academic year.", success: false };
  }
  if (!staffId || isNaN(staffId)) {
    return { error: "Please assign a staff member.", success: false };
  }

  try {
    await dalCreateGroup({
      schoolId: user.schoolId,
      gradeId,
      yearId,
      staffId,
      groupName,
      isMixedGrade,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create group.";
    if (message.includes("unique") || message.includes("duplicate")) {
      return {
        error: "A group with this name already exists for this year.",
        success: false,
      };
    }
    return { error: message, success: false };
  }

  revalidatePath("/dashboard/groups");
  return { error: null, success: true };
}

/**
 * Updates an existing group's details.
 *
 * @actionType mutation
 * @rls schoolId from JWT claims; role check: coach+.
 */
export async function updateGroupAction(
  _prevState: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await requireRole("coach", "school_admin", "tilt_admin");

  const groupId = Number(formData.get("groupId"));
  if (!groupId || isNaN(groupId)) {
    return { error: "Invalid group.", success: false };
  }

  const groupName = (formData.get("groupName") as string)?.trim() || undefined;
  const gradeId = formData.get("gradeId")
    ? Number(formData.get("gradeId"))
    : undefined;
  const staffId = formData.get("staffId")
    ? Number(formData.get("staffId"))
    : undefined;
  const isMixedGradeRaw = formData.get("isMixedGrade");
  const isMixedGrade =
    isMixedGradeRaw !== null ? isMixedGradeRaw === "true" : undefined;
  const isActiveRaw = formData.get("isActive");
  const isActive =
    isActiveRaw !== null ? isActiveRaw === "true" : undefined;

  try {
    const updated = await dalUpdateGroup(
      { groupId, groupName, gradeId, staffId, isMixedGrade, isActive },
      user.schoolId,
    );
    if (!updated) {
      return { error: "Group not found.", success: false };
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update group.";
    if (message.includes("unique") || message.includes("duplicate")) {
      return {
        error: "A group with this name already exists for this year.",
        success: false,
      };
    }
    return { error: message, success: false };
  }

  revalidatePath("/dashboard/groups");
  return { error: null, success: true };
}

/**
 * Adds a student to a group.
 *
 * @actionType mutation
 * @rls schoolId from JWT claims; role check: coach+.
 */
export async function addStudentAction(
  _prevState: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  await requireRole("coach", "school_admin", "tilt_admin");

  const groupId = Number(formData.get("groupId"));
  const studentId = Number(formData.get("studentId"));

  if (!groupId || !studentId) {
    return { error: "Group and student are required.", success: false };
  }

  try {
    await dalAddStudent(groupId, studentId);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to add student.";
    if (message.includes("unique") || message.includes("duplicate")) {
      return { error: "Student is already in this group.", success: false };
    }
    return { error: message, success: false };
  }

  revalidatePath(`/dashboard/groups/${groupId}`);
  return { error: null, success: true };
}

/**
 * Removes a student from a group (soft-delete: sets is_active=false, records left_date).
 *
 * @actionType mutation
 * @rls schoolId from JWT claims; role check: coach+.
 */
export async function removeStudentAction(
  formData: FormData,
): Promise<void> {
  await requireRole("coach", "school_admin", "tilt_admin");

  const membershipId = Number(formData.get("membershipId"));
  const groupId = formData.get("groupId") as string;

  if (!membershipId) return;

  await dalRemoveStudent(membershipId);
  revalidatePath(`/dashboard/groups/${groupId}`);
}
