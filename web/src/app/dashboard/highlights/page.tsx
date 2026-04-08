/**
 * @file dashboard/highlights/page.tsx — Growth Highlighter (Phase D.3)
 *
 * The celebration feed. Inverse of the cliff alert system: instead of
 * surfacing groups about to fall, this surfaces students who just did
 * something exceptional.
 *
 * Three categories:
 *   🏆 Top Movers      — highest avg lessons/week over 4 weeks (above aimline)
 *   🚀 Band Advancers  — band movement is accelerating or advancing
 *   ⭐ Cliff Survivors — crossed one of the 6 canonical cliffs in 4 weeks
 *
 * Role-gated to coach / school_admin / tilt_admin. Populated from data
 * already in place — no new schema, no new captures.
 */

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import { getGrowthHighlights } from "@/lib/dal/highlights";
import { cn } from "@/lib/utils";

export default async function HighlightsPage() {
  const user = await requireRole("coach", "school_admin", "tilt_admin");
  const schoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(schoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Growth Highlights</h1>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No active academic year for this school.
          </p>
        </div>
      </div>
    );
  }

  const highlights = await getGrowthHighlights(schoolId, currentYear.yearId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Growth Highlights
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          The inverse of cliff alerts. Last {highlights.windowWeeks} weeks —
          who&rsquo;s doing exceptional work, so a coach can call them out on
          Monday.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            🏆 Top Movers
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              highlights.topMovers.length > 0
                ? "text-green-600 dark:text-green-400"
                : "text-zinc-400",
            )}
          >
            {highlights.topMovers.length}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Students at or above the aimline
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            🚀 Band Advancers
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              highlights.bandAdvancers.length > 0
                ? "text-purple-600 dark:text-purple-400"
                : "text-zinc-400",
            )}
          >
            {highlights.bandAdvancers.length}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Advanced or accelerated at the latest capture
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            ⭐ Cliff Survivors
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              highlights.cliffSurvivors.length > 0
                ? "text-blue-600 dark:text-blue-400"
                : "text-zinc-400",
            )}
          >
            {highlights.cliffSurvivors.length}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Crossings of the 6 canonical cliffs
          </p>
        </div>
      </div>

      {/* Top Movers */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            🏆 Top Movers
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Top {highlights.topMovers.length} students by lessons passed per
            week over the last {highlights.windowWeeks} weeks, at or above the
            2-lessons/week aimline.
          </p>
        </div>
        {highlights.topMovers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            No students at or above the aimline in the window.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Student
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Grade
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Avg lessons/wk
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    % of aimline
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Weeks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {highlights.topMovers.map((m) => (
                  <tr
                    key={m.studentId}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-2 text-sm">
                      <Link
                        href={`/dashboard/students/${m.studentId}`}
                        className="font-medium hover:underline"
                      >
                        {m.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {m.gradeName ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-sm font-semibold tabular-nums">
                      {m.avgPerWeek}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-4 py-2 text-right text-sm font-semibold tabular-nums",
                        m.aimlineRatioPct >= 150
                          ? "text-green-600 dark:text-green-400"
                          : "text-green-700 dark:text-green-500",
                      )}
                    >
                      {m.aimlineRatioPct}%
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-zinc-500 dark:text-zinc-400">
                      {m.weeksTracked}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Band Advancers */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            🚀 Band Advancers
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Students whose band moved up at the latest weekly capture.
            Accelerating = 2+ band jumps in a semester, Advancing = 1 jump.
          </p>
        </div>
        {highlights.bandAdvancers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            No band advancers at the latest capture. Run Snapshots to
            refresh if needed.
          </div>
        ) : (
          <div className="space-y-2">
            {highlights.bandAdvancers.map((a) => (
              <div
                key={`band-${a.studentId}`}
                className={cn(
                  "rounded-r-lg border border-l-4 border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
                  a.movement === "accelerating"
                    ? "border-l-purple-600"
                    : "border-l-green-500",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">
                    {a.movement === "accelerating" ? "🚀🚀" : "🚀"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                      a.movement === "accelerating"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                        : "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
                    )}
                  >
                    {a.movement === "accelerating" ? "Accelerating ↑↑" : "Advancing ↑"}
                  </span>
                  <Link
                    href={`/dashboard/students/${a.studentId}`}
                    className="text-sm font-semibold hover:underline"
                  >
                    {a.studentName}
                  </Link>
                  {a.gradeName && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      · {a.gradeName}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-zinc-400">
                    as of {a.assignedDate}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                  Now <span className="font-semibold">{formatBand(a.band)}</span> ·{" "}
                  <span className="font-semibold">{a.archetypeLabel}</span>
                  {a.ceilingSection && (
                    <> · Ceiling: {a.ceilingSection}</>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cliff Survivors */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            ⭐ Cliff Survivors
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Students who crossed one of the 6 canonical UFLI cliffs in the
            last {highlights.windowWeeks} weeks. These lessons have empirical
            hazard rates up to 35.1% — clearing them is worth celebrating.
          </p>
        </div>
        {highlights.cliffSurvivors.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            No cliff crossings in the window.
          </div>
        ) : (
          <div className="space-y-2">
            {highlights.cliffSurvivors.map((s, i) => (
              <div
                key={`cliff-survivor-${s.studentId}-${s.cliff.id}-${i}`}
                className="rounded-r-lg border border-l-4 border-l-blue-500 border-zinc-200 bg-blue-50 p-4 shadow-sm dark:border-zinc-800 dark:bg-blue-950/20"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">⭐</span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                    {s.cliff.label}
                  </span>
                  <Link
                    href={`/dashboard/students/${s.studentId}`}
                    className="text-sm font-semibold hover:underline"
                  >
                    {s.studentName}
                  </Link>
                  {s.gradeName && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      · {s.gradeName}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-zinc-400">
                    {s.crossedAt}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold">{s.cliff.concept}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Hazard rate {s.cliff.hazardRateLabel} · passed L
                  {s.crossedAtLessonNumber}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatBand(band: string): string {
  switch (band) {
    case "not_started":
      return "Not Started";
    case "intervention":
      return "Intervention";
    case "on_track":
      return "On Track";
    case "advanced":
      return "Advanced";
    default:
      return band;
  }
}
