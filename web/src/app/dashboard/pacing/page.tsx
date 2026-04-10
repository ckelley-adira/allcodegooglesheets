/**
 * @file dashboard/pacing/page.tsx — Pacing Dashboard
 *
 * The "who have we seen / who haven't we seen?" view. Replaces the
 * GAS Pacing Dashboard/Log with three sections:
 *
 *   1. Coverage Timeline  — week-over-week coverage % (8-week trend)
 *   2. Group Breakdown    — expandable per-group view with member health
 *   3. Student Log        — flat table of every student, sorted by staleness
 *
 * Grade and health filters narrow all three sections simultaneously.
 *
 * @rls School-scoping via getActiveSchoolId.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { getPacingDetail, type GroupHealth } from "@/lib/dal/school-pacing";
import { GradeFilterChips, parseGradeFilter } from "@/components/filters";
import { Badge } from "@/components/ui/badge";
import { formatPct } from "@/lib/format/percent";
import { cn } from "@/lib/utils";
import { StudentLogTable } from "./student-log-table";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const HEALTH_OPTIONS: { value: GroupHealth; label: string }[] = [
  { value: "fresh", label: "Fresh" },
  { value: "stale_1w", label: "Stale 1w" },
  { value: "stale_2w", label: "Stale 2w+" },
  { value: "never_logged", label: "Never" },
];

export default async function PacingPage({ searchParams }: Props) {
  const user = await requireAuth();
  const schoolId = await getActiveSchoolId(user);

  const params = await searchParams;
  const gradeFilter = parseGradeFilter(params.grade);
  const healthRaw = params.health;
  const healthFilter: GroupHealth[] = healthRaw
    ? (Array.isArray(healthRaw) ? healthRaw : [healthRaw]).filter(
        (h): h is GroupHealth =>
          ["fresh", "stale_1w", "stale_2w", "never_logged"].includes(h),
      )
    : [];

  const pacing = await getPacingDetail(schoolId, {
    gradeFilter: gradeFilter.length > 0 ? gradeFilter : undefined,
    healthFilter: healthFilter.length > 0 ? healthFilter : undefined,
  });

  const isFiltered = gradeFilter.length > 0 || healthFilter.length > 0;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
      >
        &larr; Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Pacing Dashboard
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Who have we seen, who haven&rsquo;t we seen, and how is coverage
          trending week over week?
          {pacing.schoolCoveragePct !== null && (
            <span className="ml-1 font-semibold">
              Current 7-day coverage: {formatPct(pacing.schoolCoveragePct)}
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <form method="GET" className="space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <GradeFilterChips selected={gradeFilter} hint="" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Activity
            </span>
            <div className="flex flex-wrap gap-2">
              {HEALTH_OPTIONS.map((h) => (
                <label
                  key={h.value}
                  className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <input
                    type="checkbox"
                    name="health"
                    value={h.value}
                    defaultChecked={
                      healthFilter.length === 0 ||
                      healthFilter.includes(h.value)
                    }
                  />
                  {h.label}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Filter
          </button>
        </div>
      </form>

      {/* Section 1: Coverage Timeline */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Coverage Trend (8 weeks)
        </h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-end gap-1 px-4 py-4">
            {pacing.coverageTimeline.map((week) => {
              const height = Math.max(4, Math.round(week.coveragePct));
              return (
                <div
                  key={week.weekStartDate}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-[10px] font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">
                    {Math.round(week.coveragePct)}%
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition-all",
                      week.coveragePct >= 80
                        ? "bg-green-500"
                        : week.coveragePct >= 50
                          ? "bg-amber-400"
                          : "bg-red-400",
                    )}
                    style={{ height: `${height}px` }}
                  />
                  <span className="text-[9px] text-zinc-400">
                    {week.weekStartDate.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-zinc-100 px-4 py-2 text-[10px] text-zinc-400 dark:border-zinc-800">
            Each bar = % of {pacing.totalActiveStudents} students with a lesson
            recorded that week. Green &ge;80%, amber &ge;50%, red &lt;50%.
          </div>
        </div>
      </section>

      {/* Section 2: Per-Group Breakdown */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Groups ({pacing.groups.length})
        </h2>
        {pacing.groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            No groups{isFiltered ? " matching these filters" : ""}.
          </div>
        ) : (
          <div className="space-y-2">
            {pacing.groups.map((group) => (
              <details
                key={group.groupId}
                className="group rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/groups/${group.groupId}`}
                      className="text-sm font-semibold hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {group.groupName}
                    </Link>
                    <span className="text-xs text-zinc-500">
                      {group.gradeName} &middot; {group.staffName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400">
                      {group.freshCount > 0 && (
                        <span className="text-green-600">{group.freshCount} fresh</span>
                      )}
                      {group.staleCount > 0 && (
                        <span className="ml-1 text-amber-600">
                          {group.staleCount} stale
                        </span>
                      )}
                      {group.neverCount > 0 && (
                        <span className="ml-1 text-red-600">
                          {group.neverCount} never
                        </span>
                      )}
                    </span>
                    <HealthBadge health={group.health} />
                  </div>
                </summary>
                <div className="border-t border-zinc-100 dark:border-zinc-800">
                  {group.students.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-zinc-400">
                      No students in this group.
                    </p>
                  ) : (
                    <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800">
                      <thead className="bg-zinc-50 dark:bg-zinc-900">
                        <tr>
                          <th className="px-4 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                            Student
                          </th>
                          <th className="px-4 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                            Last Seen
                          </th>
                          <th className="px-4 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                        {group.students.map((s) => (
                          <tr key={s.studentId}>
                            <td className="px-4 py-1.5 text-xs">
                              <Link
                                href={`/dashboard/students/${s.studentId}`}
                                className="font-medium hover:underline"
                              >
                                {s.studentName}
                              </Link>
                            </td>
                            <td className="px-4 py-1.5 text-right text-xs text-zinc-500">
                              {s.lastActivityDate ?? "never"}
                              {s.daysSinceLastActivity !== null && (
                                <span className="ml-1 text-zinc-400">
                                  ({s.daysSinceLastActivity}d)
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-1.5 text-right">
                              <HealthBadge health={s.health} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Student Last-Seen Log */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Student Log ({pacing.allStudents.length})
        </h2>
        {pacing.allStudents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            No students{isFiltered ? " matching these filters" : ""}.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <StudentLogTable students={pacing.allStudents} />
          </div>
        )}
      </section>
    </div>
  );
}

// ── Health Badge ─────────────────────────────────────────────────────────

const HEALTH_BADGE: Record<
  GroupHealth,
  { label: string; variant: "success" | "warning" | "danger" | "default" }
> = {
  fresh: { label: "Fresh", variant: "success" },
  stale_1w: { label: "Stale 1w", variant: "warning" },
  stale_2w: { label: "Stale 2w+", variant: "danger" },
  never_logged: { label: "Never", variant: "danger" },
};

function HealthBadge({ health }: { health: GroupHealth }) {
  const { label, variant } = HEALTH_BADGE[health];
  return <Badge variant={variant}>{label}</Badge>;
}
