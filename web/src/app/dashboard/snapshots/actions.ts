/**
 * @file dashboard/snapshots/actions.ts — Weekly snapshot server actions
 *
 * Manual capture trigger for the weekly growth snapshots. TILT Admin +
 * School Admin only — this is an operational action that rebuilds the
 * underlying weekly_snapshots rows for the school's active year, used by
 * the sparklines and (later) the Priority Matrix growth-slope metric.
 *
 * Idempotent: re-running on the same day just refreshes the current
 * week's numbers plus any prior-week corrections.
 *
 * @actionType mutation
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import { captureWeeklySnapshots } from "@/lib/dal/weekly-snapshots";

export interface CaptureSnapshotsResult {
  ok: boolean;
  message: string;
  weeksProcessed?: number;
  studentsProcessed?: number;
  snapshotsWritten?: number;
}

/**
 * Triggers a capture of the last N weeks of snapshots for the active
 * school's current year. Called from the "Recompute snapshots" button.
 */
export async function captureWeeklySnapshotsAction(
  formData: FormData,
): Promise<CaptureSnapshotsResult> {
  const user = await requireRole("school_admin", "tilt_admin");

  const rawWeeks = formData.get("weeks");
  const weeks = rawWeeks ? Math.max(1, Math.min(52, Number(rawWeeks))) : 8;

  const schoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(schoolId);
  const currentYear = years.find((y) => y.isCurrent);
  if (!currentYear) {
    return {
      ok: false,
      message: "No active academic year for this school.",
    };
  }

  try {
    const result = await captureWeeklySnapshots({
      schoolId,
      yearId: currentYear.yearId,
      weeks,
    });

    revalidatePath("/dashboard/snapshots");
    revalidatePath("/dashboard/students", "layout");

    return {
      ok: true,
      message: `Captured ${result.weeksProcessed} weeks × ${result.studentsProcessed} students (${result.snapshotsWritten} rows upserted).`,
      weeksProcessed: result.weeksProcessed,
      studentsProcessed: result.studentsProcessed,
      snapshotsWritten: result.snapshotsWritten,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}
