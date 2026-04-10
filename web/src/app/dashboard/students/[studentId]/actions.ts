/**
 * @file students/[studentId]/actions.ts — Admin manual lesson entry
 *
 * Server action for recording a single lesson outcome outside the
 * normal group session flow. Used for extra lessons, makeup sessions,
 * or corrections. Tagged with source='manual' for auditability.
 *
 * Role-gated to school_admin / tilt_admin only.
 *
 * @actionType mutation
 * @rls School-scoping via student lookup.
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { recordLessonOutcomes } from "@/lib/dal/sessions";
import { auditLog } from "@/lib/audit/log";
import { createClient } from "@/lib/supabase/server";

export interface ManualEntryFormState {
  error: string | null;
  success: boolean;
}

/**
 * Records a single lesson outcome for a student with source='manual'.
 * Group-independent (group_id = null).
 */
export async function recordManualLessonAction(
  _prevState: ManualEntryFormState,
  formData: FormData,
): Promise<ManualEntryFormState> {
  const user = await requireRole("school_admin", "tilt_admin");
  const activeSchoolId = await getActiveSchoolId(user);

  const studentId = Number(formData.get("studentId"));
  const lessonId = Number(formData.get("lessonId"));
  const yearId = Number(formData.get("yearId"));
  const status = formData.get("status") as string;
  const dateRecorded =
    (formData.get("dateRecorded") as string) ||
    new Date().toISOString().split("T")[0];

  if (!studentId || !lessonId || !yearId) {
    return { error: "Missing required fields.", success: false };
  }
  if (!["Y", "N", "A"].includes(status)) {
    return { error: "Status must be Y, N, or A.", success: false };
  }

  // Verify the student belongs to the user's school
  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("student_id")
    .eq("student_id", studentId)
    .eq("school_id", activeSchoolId)
    .maybeSingle();

  if (!student) {
    return { error: "Student not found in this school.", success: false };
  }

  try {
    await recordLessonOutcomes({
      groupId: null,
      lessonId,
      yearId,
      dateRecorded,
      recordedBy: user.staffId,
      outcomes: [{ studentId, status: status as "Y" | "N" | "A" }],
      source: "manual",
    });

    await auditLog({
      schoolId: activeSchoolId,
      userId: user.staffId,
      action: "MANUAL_LESSON_ENTRY",
      tableName: "lesson_progress",
      recordId: lessonId,
      newValue: { studentId, lessonId, yearId, status, dateRecorded },
    });

    revalidatePath(`/dashboard/students/${studentId}`);
    revalidatePath("/dashboard/ufli-map");
    return { error: null, success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to record lesson.";
    return { error: message, success: false };
  }
}
