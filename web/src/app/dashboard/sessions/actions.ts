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
import { recordLessonOutcomes, type LessonOutcome } from "@/lib/dal/sessions";
import { getGroup } from "@/lib/dal/groups";

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

  const groupId = Number(formData.get("groupId"));
  const lessonId = Number(formData.get("lessonId"));
  const yearId = Number(formData.get("yearId"));
  const dateRecorded =
    (formData.get("dateRecorded") as string) ||
    new Date().toISOString().split("T")[0];
  const outcomesJson = formData.get("outcomes") as string;

  if (!groupId || isNaN(groupId)) {
    return { error: "Please select a group.", success: false };
  }
  if (!lessonId || isNaN(lessonId)) {
    return { error: "Please select a lesson.", success: false };
  }
  if (!yearId || isNaN(yearId)) {
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

  // Verify the group belongs to this school
  const group = await getGroup(groupId, user.schoolId);
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

    revalidatePath("/dashboard/sessions");
    return { error: null, success: true, savedCount };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to save lesson data.";
    return { error: message, success: false };
  }
}
