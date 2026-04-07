/**
 * @file dashboard/snapshots/page.tsx — Weekly growth snapshots summary
 *
 * Phase C.2 landing page: shows the current state of the weekly_snapshots
 * capture (last captured week, coverage, current-week summary), and
 * exposes a manual "Recompute snapshots" button for School Admins and
 * TILT Admins to rebuild the underlying rows.
 *
 * The underlying DAL is called directly by both this page and (later)
 * the Priority Matrix composer. We don't schedule an automatic cron yet;
 * the manual button is the trigger for now.
 */

import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import { getSchoolSnapshotSummary } from "@/lib/dal/weekly-snapshots";
import { formatPct, pctColor } from "@/lib/format/percent";
import { cn } from "@/lib/utils";
import { CaptureSnapshotsForm } from "./capture-form";

export default async function SnapshotsPage() {
  const user = await requireAuth();
  const schoolId = await getActiveSchoolId(user);

  const years = await listAcademicYears(schoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Weekly Snapshots</h1>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No active academic year for this school.
          </p>
        </div>
      </div>
    );
  }

  const summary = await getSchoolSnapshotSummary(schoolId, currentYear.yearId);
  const canCapture = user.role === "school_admin" || user.isTiltAdmin;

  const atOrAbovePct =
    summary.currentWeek.totalStudents > 0
      ? (summary.currentWeek.atOrAboveAimline / summary.currentWeek.totalStudents) * 100
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Weekly Snapshots</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Growth engine. Each snapshot records how many lessons a student
          passed in a given week vs. the 2-lessons/week aimline. Powers the
          sparklines on student detail pages and feeds the Priority Matrix
          growth metric.
        </p>
      </div>

      {/* Recompute button — admins only */}
      {canCapture && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">Manual capture</h2>
          <p className="mb-3 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Rebuild snapshot rows for the last N weeks. Idempotent — safe to
            re-run. Captures every active student in the current year.
          </p>
          <CaptureSnapshotsForm defaultWeeks={8} />
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Last captured week
          </p>
          <p className="mt-1 text-lg font-semibold">
            {summary.lastCapturedWeek ?? "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {summary.lastCapturedWeek
              ? "Monday of the most recent week on file"
              : "No snapshots captured yet"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Coverage
          </p>
          <p className="mt-1 text-3xl font-bold">{summary.weeksCovered}</p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {summary.weeksCovered === 1 ? "week" : "weeks"} on file ·{" "}
            {summary.studentsCovered} student
            {summary.studentsCovered !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            At/above aimline
          </p>
          <p className={cn("mt-1 text-3xl font-bold", pctColor(atOrAbovePct))}>
            {formatPct(atOrAbovePct)}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {summary.currentWeek.atOrAboveAimline} of{" "}
            {summary.currentWeek.totalStudents} this week (2 lessons/wk)
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Avg growth this week
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              pctColor(summary.currentWeek.avgGrowthPct),
            )}
          >
            {formatPct(summary.currentWeek.avgGrowthPct)}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Mean across students with activity
          </p>
        </div>
      </div>

      {summary.totalRows === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          No snapshots captured yet.
          {canCapture
            ? " Click 'Recompute snapshots' above to populate the last 8 weeks."
            : " Ask a school admin to run the initial capture."}
        </div>
      )}
    </div>
  );
}
