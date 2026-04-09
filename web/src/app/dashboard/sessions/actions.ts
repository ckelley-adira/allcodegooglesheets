/**
 * @file dashboard/sessions/actions.ts — Server Actions for lesson recording
 *
 * Handles the core daily write operation: recording Y/N/A lesson outcomes
 * for each student in a group. This is the Tutor Input Form backend.
 *
 * Per D-012: 'A' (absent) is a valid status, excluded from slope calculations.
 *
 * @actionType mutation
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { recordLessonOutcomes, type LessonOutcome } from "@/lib/dal/sessions";
import { getGroup } from "@/lib/dal/groups";
import { markSequenceLessonCompleted } from "@/lib/dal/sequences";
import { auditLog } from "@/lib/audit/log";

export interface SessionFormState {
  error: string | null;
  success: boolean;
  savedCount?: number;
}

/**
 * Records lesson outcomes for all students in a group.
 * Called from the Tutor Input Form.
 *
 * Form data contains:
 * - groupId: the group being recorded
 * - lessonId: the UFLI lesson
 * - yearId: the academic year
 * - dateRecorded: the date of the session
 * - outcomes: JSON string of [{studentId, status}]
 *
 * @actionType mutation
 * @rls schoolId from JWT claims; verifies group belongs to the user's school.
 */
export async function recordSessionAction(
  _prevState: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);

  const groupId = Number(formData.get("groupId"));
  const lessonId = Number(formData.get("lessonId"));
  const yearId = Number(formData.get("yearId"));
  const dateRecorded =
    (formData.get("dateRecorded") as string) ||
    new Date().toISOString().split("T")[0];
  const outcomesJson = formData.get("outcomes") as string;

  if (!Number.isInteger(groupId) || groupId <= 0) {
    return { error: "Please select a group.", success: false };
  }
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    return { error: "Please select a lesson.", success: false };
  }
  if (!Number.isInteger(yearId) || yearId <= 0) {
    return { error: "Academic year is required.", success: false };
  }
  if (!outcomesJson) {
    return { error: "No student outcomes provided.", success: false };
  }

  let outcomes: LessonOutcome[];
  try {
    outcomes = JSON.parse(outcomesJson);
  } catch {
    return { error: "Invalid outcomes data.", success: false };
  }

  // Filter to valid statuses only
  outcomes = outcomes.filter(
    (o) => o.status === "Y" || o.status === "N" || o.status === "A",
  );

  if (outcomes.length === 0) {
    return {
      error: "Please mark at least one student's status.",
      success: false,
    };
  }

  // Verify the group belongs to the active school
  const group = await getGroup(groupId, activeSchoolId);
  if (!group) {
    return { error: "Group not found.", success: false };
  }

  try {
    const savedCount = await recordLessonOutcomes({
      groupId,
      lessonId,
      yearId,
      dateRecorded,
      recordedBy: user.staffId,
      outcomes,
    });

    // Auto-advance the group's instructional sequence: mark this lesson
    // as completed and (if it was the current one) promote the next.
    // Best-effort — failure to advance shouldn't fail the save.
    try {
      await markSequenceLessonCompleted(groupId, lessonId);
    } catch (advanceErr) {
      console.error("Failed to auto-advance sequence:", advanceErr);
    }

    await auditLog({
      schoolId: activeSchoolId,
      userId: user.staffId,
      action: "RECORD_LESSON_OUTCOMES",
      tableName: "lesson_progress",
      recordId: lessonId,
      newValue: {
        groupId,
        lessonId,
        yearId,
        dateRecorded,
        savedCount,
        outcomes,
      },
    });

    revalidatePath("/dashboard/sessions");
    revalidatePath(`/dashboard/groups/${groupId}`);
    return { error: null, success: true, savedCount };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to save lesson data.";
    return { error: message, success: false };
  }
}
