/**
 * @file sequences/actions.ts — Server Actions for Instructional Sequences
 *
 * Handles building, advancing, and deleting instructional sequences for a
 * group. All actions require coach+ role and enforce school scoping via
 * the active school context.
 *
 * @actionType mutation
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { getGroup } from "@/lib/dal/groups";
import type { CadenceDayCode } from "@/config/cadence";
import {
  buildSequence as dalBuildSequence,
  advanceSequence as dalAdvanceSequence,
  deleteSequence as dalDeleteSequence,
} from "@/lib/dal/sequences";

export interface SequenceFormState {
  error: string | null;
  success: boolean;
}

/**
 * Role-gates the action, resolves the active school, and verifies the
 * group belongs to it. Returns null if the group can't be reached; the
 * caller should bail with the group-not-found error in that case.
 */
async function assertGroupInActiveSchool(groupId: number) {
  const user = await requireRole("coach", "school_admin", "tilt_admin");
  const activeSchoolId = await getActiveSchoolId(user);
  const group = await getGroup(groupId, activeSchoolId);
  return group ? { user, activeSchoolId, group } : null;
}

/**
 * Builds a new instructional sequence for a group. Accepts an ordered list
 * of lesson IDs, a start date, a name, and the cadence days (used to
 * auto-populate planned dates).
 *
 * @actionType mutation
 * @rls coach+ role; group must belong to active school.
 */
export async function buildSequenceAction(
  _prevState: SequenceFormState,
  formData: FormData,
): Promise<SequenceFormState> {
  const groupId = Number(formData.get("groupId"));
  if (!groupId || Number.isNaN(groupId)) {
    return { error: "Invalid group.", success: false };
  }

  const yearId = Number(formData.get("yearId"));
  const name = (formData.get("name") as string)?.trim();
  const startDate = formData.get("startDate") as string;
  const cadenceDays = formData
    .getAll("cadenceDays")
    .map((v) => String(v)) as CadenceDayCode[];
  const lessonIds = formData
    .getAll("lessonIds")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!yearId || Number.isNaN(yearId)) {
    return { error: "Academic year is required.", success: false };
  }
  if (!name) {
    return { error: "Sequence name is required.", success: false };
  }
  if (!startDate) {
    return { error: "Start date is required.", success: false };
  }
  if (cadenceDays.length === 0) {
    return {
      error: "Select at least one cadence day (e.g. TUE, THU).",
      success: false,
    };
  }
  if (lessonIds.length === 0) {
    return {
      error: "Select at least one lesson for the sequence.",
      success: false,
    };
  }

  const context = await assertGroupInActiveSchool(groupId);
  if (!context) {
    return { error: "Group not found.", success: false };
  }

  try {
    await dalBuildSequence({
      groupId,
      yearId,
      name,
      startDate,
      cadenceDays,
      lessonIds,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to build sequence.";
    return { error: message, success: false };
  }

  revalidatePath(`/dashboard/groups/${groupId}`);
  return { error: null, success: true };
}

/**
 * Advances the active sequence for a group — marks the current lesson as
 * completed and promotes the next upcoming lesson to current. If no more
 * upcoming lessons, marks the sequence itself as completed.
 *
 * @actionType mutation
 * @rls coach+ role; group must belong to active school.
 */
export async function advanceSequenceAction(formData: FormData): Promise<void> {
  const sequenceId = Number(formData.get("sequenceId"));
  const groupId = Number(formData.get("groupId"));
  if (!sequenceId || !groupId) return;

  const context = await assertGroupInActiveSchool(groupId);
  if (!context) return;

  await dalAdvanceSequence(sequenceId);
  revalidatePath(`/dashboard/groups/${groupId}`);
}

/**
 * Deletes a sequence. Used for drafts or when a coach wants to start over.
 *
 * @actionType mutation
 * @rls coach+ role; group must belong to active school.
 */
export async function deleteSequenceAction(formData: FormData): Promise<void> {
  const sequenceId = Number(formData.get("sequenceId"));
  const groupId = Number(formData.get("groupId"));
  if (!sequenceId || !groupId) return;

  const context = await assertGroupInActiveSchool(groupId);
  if (!context) return;

  await dalDeleteSequence(sequenceId);
  revalidatePath(`/dashboard/groups/${groupId}`);
}
