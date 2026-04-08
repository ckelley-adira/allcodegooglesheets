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
import { captureBandAssignments } from "@/lib/dal/bands";

export interface CaptureSnapshotsResult {
  ok: boolean;
  message: string;
  weeksProcessed?: number;
  studentsProcessed?: number;
  snapshotsWritten?: number;
  /** Band assignments written in the same pass (Phase D.1) */
  bandAssignmentsWritten?: number;
  bandAssignedDate?: string;
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
    // Capture weekly snapshots first — the growth slope metric + the
    // banding engine both read from the resulting dataset. The
    // Banding Engine runs against high-water-mark Y lesson sets, so
    // it technically doesn't require the weekly rollup, but running
    // them together matches Section 5.3 cadence ("weekly, Friday,
    // after the Dashboard snapshot is computed").
    const snapshotResult = await captureWeeklySnapshots({
      schoolId,
      yearId: currentYear.yearId,
      weeks,
    });

    const bandResult = await captureBandAssignments(
      schoolId,
      currentYear.yearId,
    );

    revalidatePath("/dashboard/snapshots");
    revalidatePath("/dashboard/bands");
    revalidatePath("/dashboard/students", "layout");

    return {
      ok: true,
      message: `Captured ${snapshotResult.weeksProcessed} weeks × ${snapshotResult.studentsProcessed} students (${snapshotResult.snapshotsWritten} snapshot rows). Banded ${bandResult.assignmentsWritten} students for ${bandResult.assignedDate}.`,
      weeksProcessed: snapshotResult.weeksProcessed,
      studentsProcessed: snapshotResult.studentsProcessed,
      snapshotsWritten: snapshotResult.snapshotsWritten,
      bandAssignmentsWritten: bandResult.assignmentsWritten,
      bandAssignedDate: bandResult.assignedDate,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}
