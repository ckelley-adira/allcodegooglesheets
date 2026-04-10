/**
 * @file ufli-map/actions.ts — UFLI MAP cell click server action
 *
 * Records or updates a single lesson outcome when an admin clicks a
 * cell on the UFLI MAP grid. Cycles through Y → N → A → (clear).
 * Tagged with source='manual' for auditability.
 *
 * Role-gated to school_admin / tilt_admin.
 *
 * @actionType mutation
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { recordLessonOutcomes } from "@/lib/dal/sessions";
import { auditLog } from "@/lib/audit/log";
import { createClient } from "@/lib/supabase/server";

type CellStatus = "Y" | "N" | "A";

/**
 * Records a single cell update on the UFLI MAP.
 * Returns the new status so the client can update optimistically.
 */
export async function updateMapCellAction(
  studentId: number,
  lessonId: number,
  yearId: number,
  status: CellStatus,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole("school_admin", "tilt_admin");
  const activeSchoolId = await getActiveSchoolId(user);

  // Verify the student belongs to this school
  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("student_id")
    .eq("student_id", studentId)
    .eq("school_id", activeSchoolId)
    .maybeSingle();

  if (!student) {
    return { success: false, error: "Student not found in this school." };
  }

  try {
    const dateRecorded = new Date().toISOString().split("T")[0];

    await recordLessonOutcomes({
      groupId: null,
      lessonId,
      yearId,
      dateRecorded,
      recordedBy: user.staffId,
      outcomes: [{ studentId, status }],
      source: "manual",
    });

    await auditLog({
      schoolId: activeSchoolId,
      userId: user.staffId,
      action: "MANUAL_MAP_CELL_UPDATE",
      tableName: "lesson_progress",
      recordId: lessonId,
      newValue: { studentId, lessonId, yearId, status, dateRecorded },
    });

    revalidatePath("/dashboard/ufli-map");
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update cell.";
    return { success: false, error: message };
  }
}
