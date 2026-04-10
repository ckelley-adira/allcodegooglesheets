/**
 * @file dashboard/big-four/page.tsx — Big Four metrics by grade
 *
 * Drill-down from the dashboard's Big Four summary tiles. Shows all
 * four metrics broken down per grade in a color-coded table so coaches
 * can see where each grade stands at a glance.
 *
 * Per D-006: the metric definitions are canonical and used in funder
 * communications. The DAL computes them — this page only displays.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import { getBigFourByGrade, getBigFourMetrics } from "@/lib/dal/metrics";
import { formatPct, pctColor } from "@/lib/format/percent";
import { cn } from "@/lib/utils";

export default async function BigFourPage() {
  const user = await requireAuth();
  const schoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(schoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-zinc-500">No active academic year.</p>
      </div>
    );
  }

  const [gradeRows, schoolWide] = await Promise.all([
    getBigFourByGrade(schoolId, currentYear.yearId),
    getBigFourMetrics(schoolId, currentYear.yearId),
  ]);

  return (
    <div className="space-y-5">
      <BackLink />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Big Four by Grade
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          All four canonical metrics broken down per grade. School-wide
          averages shown in the footer row. Color thresholds: green
          &ge;80%, amber &ge;50%, red &lt;50%.
        </p>
      </div>

      {gradeRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          No active students with grade data.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Grade
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Students
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Foundational
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Min Grade
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Year Progress
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Growth Slope
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {gradeRows.map((row) => (
                <tr
                  key={row.gradeName}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-2.5 text-sm font-semibold">
                    {row.gradeName}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
                    {row.studentCount}
                  </td>
                  <MetricCell value={row.foundationalPct} />
                  <MetricCell value={row.minGradePct} />
                  <MetricCell value={row.currentYearGoalPct} />
                  <MetricCell
                    value={row.onPacePct}
                    suffix={
                      row.presenceConcernCount > 0
                        ? ` (${row.presenceConcernCount} PC)`
                        : undefined
                    }
                  />
                </tr>
              ))}
            </tbody>
            {/* School-wide footer */}
            <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
              <tr>
                <td className="px-4 py-2.5 text-sm font-bold">All Grades</td>
                <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-zinc-500">
                  {schoolWide.foundational.studentCount}
                </td>
                <MetricCell value={schoolWide.foundational.percentage} bold />
                <MetricCell value={schoolWide.minGrade.percentage} bold />
                <MetricCell
                  value={schoolWide.currentYearGoal.percentage}
                  bold
                />
                <MetricCell
                  value={schoolWide.growthSlope.onPacePercentage}
                  bold
                  suffix={
                    schoolWide.growthSlope.presenceConcernCount > 0
                      ? ` (${schoolWide.growthSlope.presenceConcernCount} PC)`
                      : undefined
                  }
                />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Metric definitions */}
      <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <p className="font-semibold text-zinc-700 dark:text-zinc-300">
          Metric Definitions (D-006)
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong>Foundational</strong> &mdash; % of L1&ndash;L34 mastered
            (high-water mark). Denominator: 34.
          </li>
          <li>
            <strong>Min Grade</strong> &mdash; Grade-specific MTSS floor
            (KG=34, G1=57, G2=67, G3+=107 non-review lessons).
          </li>
          <li>
            <strong>Year Progress</strong> &mdash; This year&rsquo;s curriculum
            goal (excluding reviews). Grade-specific denominator.
          </li>
          <li>
            <strong>Growth Slope</strong> &mdash; % of students on pace
            (&ge;85% of 2 lessons/week over 4 weeks). Absences reduce expected,
            never counted as zeros (D-012).
          </li>
          <li>
            <strong>PC</strong> = Presence Concern &mdash; students whose
            absences consumed the entire expected window.
          </li>
        </ul>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
    >
      &larr; Dashboard
    </Link>
  );
}

function MetricCell({
  value,
  bold,
  suffix,
}: {
  value: number | null;
  bold?: boolean;
  suffix?: string;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums",
        pctColor(value),
        bold && "font-bold",
      )}
    >
      {formatPct(value)}
      {suffix && (
        <span className="ml-1 text-[10px] text-zinc-400">{suffix}</span>
      )}
    </td>
  );
}
