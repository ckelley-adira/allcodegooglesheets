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
import { getActiveSchoolId } from "@/lib/auth/school-context";
import {
  createGroup as dalCreateGroup,
  getGroup as dalGetGroup,
  updateGroup as dalUpdateGroup,
  addStudentToGroup as dalAddStudent,
  removeStudentFromGroup as dalRemoveStudent,
} from "@/lib/dal/groups";
import { auditLog } from "@/lib/audit/log";

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
  const activeSchoolId = await getActiveSchoolId(user);

  const groupName = (formData.get("groupName") as string)?.trim();
  const yearId = Number(formData.get("yearId"));
  const staffId = Number(formData.get("staffId"));
  const isMixedGrade = formData.get("isMixedGrade") === "true";

  // When mixed grade: read gradeIds[] from the checkbox group.
  // When single grade: read gradeId from the dropdown.
  let gradeIds: number[];
  if (isMixedGrade) {
    gradeIds = formData
      .getAll("gradeIds")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0);
  } else {
    const single = Number(formData.get("gradeId"));
    gradeIds = Number.isInteger(single) && single > 0 ? [single] : [];
  }

  if (!groupName) {
    return { error: "Group name is required.", success: false };
  }
  if (gradeIds.length === 0) {
    return {
      error: isMixedGrade
        ? "Please select at least one grade level."
        : "Please select a grade level.",
      success: false,
    };
  }
  if (isMixedGrade && gradeIds.length < 2) {
    return {
      error: "Mixed-grade groups must have at least two grades.",
      success: false,
    };
  }
  if (!Number.isInteger(yearId) || yearId <= 0) {
    return { error: "Please select an academic year.", success: false };
  }
  if (!Number.isInteger(staffId) || staffId <= 0) {
    return { error: "Please assign a staff member.", success: false };
  }

  // Primary grade is the lowest-sorted grade (smallest gradeId isn't
  // reliable — we'll use the first one from the form; the DAL
  // deduplicates and stores all in the junction)
  const primaryGradeId = gradeIds[0];

  try {
    const newGroupId = await dalCreateGroup({
      schoolId: activeSchoolId,
      gradeId: primaryGradeId,
      gradeIds,
      yearId,
      staffId,
      groupName,
      isMixedGrade,
    });

    await auditLog({
      schoolId: activeSchoolId,
      userId: user.staffId,
      action: "INSERT",
      tableName: "instructional_groups",
      recordId: newGroupId,
      newValue: {
        groupName,
        gradeIds,
        yearId,
        staffId,
        isMixedGrade,
      },
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
  const activeSchoolId = await getActiveSchoolId(user);

  const groupId = Number(formData.get("groupId"));
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return { error: "Invalid group.", success: false };
  }

  const groupName = (formData.get("groupName") as string)?.trim() || undefined;
  const staffId = formData.get("staffId")
    ? Number(formData.get("staffId"))
    : undefined;
  const isMixedGradeRaw = formData.get("isMixedGrade");
  const isMixedGrade =
    isMixedGradeRaw !== null ? isMixedGradeRaw === "true" : undefined;
  const isActiveRaw = formData.get("isActive");
  const isActive =
    isActiveRaw !== null ? isActiveRaw === "true" : undefined;

  // Read grades based on mixed-grade intent. When the checkbox is on,
  // the form posts gradeIds[]. When off, the form posts a single gradeId.
  let gradeId: number | undefined;
  let gradeIds: number[] | undefined;
  if (isMixedGrade) {
    const ids = formData
      .getAll("gradeIds")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length > 0) {
      gradeIds = ids;
      gradeId = ids[0];
    }
  } else if (formData.get("gradeId")) {
    const single = Number(formData.get("gradeId"));
    if (Number.isInteger(single) && single > 0) {
      gradeId = single;
      gradeIds = [single];
    }
  }

  if (isMixedGrade && gradeIds && gradeIds.length < 2) {
    return {
      error: "Mixed-grade groups must have at least two grades.",
      success: false,
    };
  }

  try {
    const previous = await dalGetGroup(groupId, activeSchoolId);
    if (!previous) {
      return { error: "Group not found.", success: false };
    }

    const updated = await dalUpdateGroup(
      { groupId, groupName, gradeId, gradeIds, staffId, isMixedGrade, isActive },
      activeSchoolId,
    );
    if (!updated) {
      return { error: "Group not found.", success: false };
    }

    const after = await dalGetGroup(groupId, activeSchoolId);
    await auditLog({
      schoolId: activeSchoolId,
      userId: user.staffId,
      action: "UPDATE",
      tableName: "instructional_groups",
      recordId: groupId,
      oldValue: previous as unknown as Record<string, unknown>,
      newValue: (after ?? {}) as unknown as Record<string, unknown>,
    });
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
  const user = await requireRole("coach", "school_admin", "tilt_admin");
  const activeSchoolId = await getActiveSchoolId(user);

  const groupId = Number(formData.get("groupId"));
  const studentId = Number(formData.get("studentId"));

  if (!groupId || !studentId) {
    return { error: "Group and student are required.", success: false };
  }

  try {
    await dalAddStudent(groupId, studentId);

    await auditLog({
      schoolId: activeSchoolId,
      userId: user.staffId,
      action: "INSERT",
      tableName: "group_memberships",
      recordId: null,
      newValue: { groupId, studentId },
    });
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
): Promise<GroupFormState> {
  const user = await requireRole("coach", "school_admin", "tilt_admin");
  const activeSchoolId = await getActiveSchoolId(user);

  const membershipId = Number(formData.get("membershipId"));
  const groupId = formData.get("groupId") as string;

  // Validate input: membershipId must be a positive integer
  if (!Number.isInteger(membershipId) || membershipId <= 0) {
    return { error: "Invalid membership ID.", success: false };
  }

  if (!groupId) {
    return { error: "Invalid group ID.", success: false };
  }

  try {
    await dalRemoveStudent(membershipId);

    await auditLog({
      schoolId: activeSchoolId,
      userId: user.staffId,
      action: "UPDATE",
      tableName: "group_memberships",
      recordId: membershipId,
      newValue: { isActive: false, leftDate: "now" },
    });

    revalidatePath(`/dashboard/groups/${groupId}`);
    return { error: null, success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to remove student from group.";
    return { error: message, success: false };
  }
}
