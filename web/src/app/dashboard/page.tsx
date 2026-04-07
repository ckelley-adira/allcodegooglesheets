/**
 * @file dashboard/page.tsx — Dashboard home page
 *
 * Big Four metrics for the active school + current academic year.
 * Per D-006: definitions are used in funder communications and must
 * not drift. The DAL functions in lib/dal/metrics.ts are the canonical
 * implementation.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import { getBigFourMetrics } from "@/lib/dal/metrics";
import { getSchoolPacingSummary } from "@/lib/dal/school-pacing";
import { cn } from "@/lib/utils";
import { formatPct, pctColor } from "@/lib/format/percent";

export default async function DashboardPage() {
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(activeSchoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No active academic year for this school.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Set a current academic year on the school detail page to see metrics.
          </p>
        </div>
      </div>
    );
  }

  const [metrics, pacing] = await Promise.all([
    getBigFourMetrics(activeSchoolId, currentYear.yearId),
    getSchoolPacingSummary(activeSchoolId),
  ]);

  const attentionCount =
    pacing.staleOneWeekGroupCount +
    pacing.staleTwoWeekGroupCount +
    pacing.neverLoggedGroupCount;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Welcome back, {user.email} &middot; Academic year {currentYear.label}
        </p>
      </div>

      {/* Big Four metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Foundational Skills */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Foundational Skills
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              pctColor(metrics.foundational.percentage),
            )}
          >
            {formatPct(metrics.foundational.percentage)}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            L1&ndash;L34 mastery &middot; {metrics.foundational.studentCount}{" "}
            student
            {metrics.foundational.studentCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Metric 2: Min Grade Skills */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Min Grade Skills
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              pctColor(metrics.minGrade.percentage),
            )}
          >
            {formatPct(metrics.minGrade.percentage)}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            MTSS metric by grade &middot; {metrics.minGrade.studentCount}{" "}
            student{metrics.minGrade.studentCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Metric 3: Current Year Goal Progress */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Current Year Progress
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              pctColor(metrics.currentYearGoal.percentage),
            )}
          >
            {formatPct(metrics.currentYearGoal.percentage)}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            This year&rsquo;s curriculum (no reviews) &middot;{" "}
            {metrics.currentYearGoal.studentCount} student
            {metrics.currentYearGoal.studentCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Metric 4: Growth Slope */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Growth vs. Expected
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              pctColor(metrics.growthSlope.onPacePercentage),
            )}
          >
            {formatPct(metrics.growthSlope.onPacePercentage)}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {metrics.growthSlope.onPaceCount} of{" "}
            {metrics.growthSlope.evaluableStudentCount} on pace
            {metrics.growthSlope.presenceConcernCount > 0
              ? ` · ${metrics.growthSlope.presenceConcernCount} presence concern${
                  metrics.growthSlope.presenceConcernCount !== 1 ? "s" : ""
                }`
              : ""}
          </p>
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        4-week rolling window for growth slope. Thresholds: ≥80% on track,
        ≥50% needs support, &lt;50% intervention. Absences are excluded
        from the slope (D-012, Equity of Visibility).
      </p>

      {/* Pacing & Coverage section */}
      <section className="space-y-3 pt-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Pacing &amp; Coverage
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Group activity health and student lesson coverage across the school.
          </p>
        </div>

        {/* Coverage + group health rollup cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Coverage (7 days)
            </p>
            <p
              className={cn(
                "mt-1 text-3xl font-bold",
                pctColor(pacing.coveragePct),
              )}
            >
              {formatPct(pacing.coveragePct)}
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              {pacing.studentsWithRecentActivity} of {pacing.totalActiveStudents}{" "}
              students with a lesson recorded in the last week
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Active Groups
            </p>
            <p className="mt-1 text-3xl font-bold text-green-600 dark:text-green-400">
              {pacing.freshGroupCount}
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Logged within the last 7 days
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Stale Groups
            </p>
            <p
              className={cn(
                "mt-1 text-3xl font-bold",
                pacing.staleOneWeekGroupCount + pacing.staleTwoWeekGroupCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-400",
              )}
            >
              {pacing.staleOneWeekGroupCount + pacing.staleTwoWeekGroupCount}
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              {pacing.staleOneWeekGroupCount} 1+ wk · {pacing.staleTwoWeekGroupCount} 2+ wk
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Never Logged
            </p>
            <p
              className={cn(
                "mt-1 text-3xl font-bold",
                pacing.neverLoggedGroupCount > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-400",
              )}
            >
              {pacing.neverLoggedGroupCount}
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Active groups with no recordings yet
            </p>
          </div>
        </div>

        {/* Groups needing attention — drill-down tile */}
        {pacing.groups.length > 0 ? (
          attentionCount > 0 ? (
            <Link
              href="/dashboard/attention"
              className="group block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-amber-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-amber-500"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Groups Needing Attention
                  </p>
                  <p className="mt-1 text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {attentionCount}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                    {pacing.staleOneWeekGroupCount} stale 1+ wk ·{" "}
                    {pacing.staleTwoWeekGroupCount} stale 2+ wk ·{" "}
                    {pacing.neverLoggedGroupCount} never logged
                  </p>
                </div>
                <span className="text-sm text-zinc-400 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  View all →
                </span>
              </div>
            </Link>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
              All active groups are fresh. Nothing needs attention.
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}
