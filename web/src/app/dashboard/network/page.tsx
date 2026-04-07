/**
 * @file dashboard/network/page.tsx — Cross-school network rollup
 *
 * TILT-Admin-only view: every partner school side-by-side with Big
 * Four metrics, enrollment counts, coverage %, and groups needing
 * attention. Answers the TILT Admin's daily question: 'where do I
 * focus my coaching attention this week?'
 */

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getNetworkRollup, type NetworkSchoolRow } from "@/lib/dal/network-rollup";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPct, pctColor } from "@/lib/format/percent";

export default async function NetworkPage() {
  await requireRole("tilt_admin");
  const rollup = await getNetworkRollup();

  const activeSchools = rollup.schools.filter((s) => s.isActive);
  const totalAttentionGroups = activeSchools.reduce(
    (sum, s) => sum + s.attentionGroupCount,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Network</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          All partner schools at a glance. {rollup.activeSchools} active of{" "}
          {rollup.totalSchools} total.
        </p>
      </div>

      {/* Network rollup cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NetworkCard title="Students" value={String(rollup.totalStudents)} subtitle={`across ${rollup.activeSchools} active schools`} />
        <NetworkCard title="Staff" value={String(rollup.totalStaff)} subtitle="active across the network" />
        <NetworkCard title="Groups" value={String(rollup.totalGroups)} subtitle="active across the network" />
        <NetworkCard
          title="Attention Needed"
          value={String(totalAttentionGroups)}
          subtitle="stale or unlogged groups"
          colorClass={
            totalAttentionGroups > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-green-600 dark:text-green-400"
          }
        />
      </div>

      {/* Per-school table */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Schools
        </h2>
        {rollup.schools.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            No schools in the network yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    School
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Students
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Foundational
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Min Grade
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Year Goal
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    On Pace
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Coverage
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Attention
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {rollup.schools.map((school) => (
                  <SchoolRow key={school.schoolId} school={school} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Big Four metrics use the active school&rsquo;s current academic year.
        Coverage is the % of active students with at least one lesson
        recorded in the last 7 days. Attention count = active groups that
        are stale (1+ wk since last activity) or never logged.
      </p>
    </div>
  );
}

function SchoolRow({ school }: { school: NetworkSchoolRow }) {
  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
      <td className="px-4 py-3 text-sm">
        <Link
          href={`/dashboard/schools/${school.schoolId}`}
          className="font-medium hover:underline"
        >
          {school.name}
        </Link>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {school.shortCode}
          </span>
          {school.currentYearLabel && (
            <span className="text-xs text-zinc-400">
              · {school.currentYearLabel}
            </span>
          )}
          {!school.isActive && <Badge variant="default">Inactive</Badge>}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">
        {school.studentCount}
      </td>
      <td
        className={cn(
          "whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums",
          pctColor(school.metrics?.foundational.percentage),
        )}
      >
        {formatPct(school.metrics?.foundational.percentage)}
      </td>
      <td
        className={cn(
          "whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums",
          pctColor(school.metrics?.minGrade.percentage),
        )}
      >
        {formatPct(school.metrics?.minGrade.percentage)}
      </td>
      <td
        className={cn(
          "whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums",
          pctColor(school.metrics?.currentYearGoal.percentage),
        )}
      >
        {formatPct(school.metrics?.currentYearGoal.percentage)}
      </td>
      <td
        className={cn(
          "whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums",
          pctColor(school.metrics?.growthSlope.onPacePercentage),
        )}
      >
        {formatPct(school.metrics?.growthSlope.onPacePercentage)}
        {school.metrics?.growthSlope.presenceConcernCount &&
        school.metrics.growthSlope.presenceConcernCount > 0 ? (
          <div className="text-[10px] font-normal text-zinc-400">
            {school.metrics.growthSlope.presenceConcernCount} pres
          </div>
        ) : null}
      </td>
      <td
        className={cn(
          "whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums",
          pctColor(school.coveragePct),
        )}
      >
        {formatPct(school.coveragePct)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
        {school.attentionGroupCount > 0 ? (
          <Badge variant="warning">{school.attentionGroupCount}</Badge>
        ) : (
          <span className="text-zinc-300">—</span>
        )}
      </td>
    </tr>
  );
}

function NetworkCard({
  title,
  value,
  subtitle,
  colorClass,
}: {
  title: string;
  value: string;
  subtitle: string;
  colorClass?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {title}
      </p>
      <p className={cn("mt-1 text-3xl font-bold", colorClass)}>{value}</p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{subtitle}</p>
    </div>
  );
}
