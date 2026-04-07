/**
 * @file staff/[staffId]/page.tsx — Per-teacher dashboard
 *
 * Layer 2 report: shows all groups assigned to one teacher with
 * health signals (last activity, pace, pass rate). Catches "the
 * teacher who hasn't logged anything in 2 weeks" before it becomes
 * a 6-week problem.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { getTeacherDetail, type GroupHealth } from "@/lib/dal/teacher-detail";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPct, pctColor } from "@/lib/format/percent";

interface TeacherDetailPageProps {
  params: Promise<{ staffId: string }>;
}

const ROLE_LABELS = {
  tutor: "Tutor",
  coach: "Coach",
  school_admin: "School Admin",
  tilt_admin: "TILT Admin",
} as const;

const HEALTH_LABEL: Record<GroupHealth, string> = {
  fresh: "Active",
  stale_1w: "Stale (1+ wk)",
  stale_2w: "Stale (2+ wk)",
  never_logged: "Never Logged",
};

const HEALTH_VARIANT: Record<
  GroupHealth,
  "success" | "warning" | "danger" | "default"
> = {
  fresh: "success",
  stale_1w: "warning",
  stale_2w: "danger",
  never_logged: "default",
};

export default async function TeacherDetailPage({
  params,
}: TeacherDetailPageProps) {
  const { staffId: staffIdParam } = await params;
  const staffId = Number(staffIdParam);
  if (!staffId || Number.isNaN(staffId)) notFound();

  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);

  const detail = await getTeacherDetail(staffId, activeSchoolId);
  if (!detail) notFound();

  const { header, groups, rollup } = detail;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/dashboard/staff"
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Staff
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100">
          {header.firstName} {header.lastName}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {header.firstName} {header.lastName}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {header.email}
          </p>
          <div className="mt-2 flex gap-1.5">
            <Badge variant="info">{ROLE_LABELS[header.role]}</Badge>
            <Badge variant={header.isActive ? "success" : "default"}>
              {header.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Rollup cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RollupCard title="Active Groups" value={String(rollup.activeGroups)} subtitle={`of ${rollup.totalGroups} total`} />
        <RollupCard title="Students" value={String(rollup.totalStudents)} subtitle="across active groups" />
        <RollupCard
          title="Pass Rate (28d)"
          value={formatPct(rollup.aggregatePassRate)}
          subtitle="Y / (Y + N) across groups"
          colorClass={pctColor(rollup.aggregatePassRate)}
        />
        <RollupCard
          title="Activity Concerns"
          value={String(rollup.staleGroupCount + rollup.neverLoggedGroupCount)}
          subtitle={`${rollup.staleGroupCount} stale · ${rollup.neverLoggedGroupCount} never logged`}
          colorClass={
            rollup.staleGroupCount + rollup.neverLoggedGroupCount > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-green-600 dark:text-green-400"
          }
        />
      </div>

      {/* Groups list */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Groups
        </h2>
        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            No groups assigned to this staff member.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Group
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Students
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Currently Teaching
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Pass Rate (28d)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Last Activity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {groups.map((group) => (
                  <tr
                    key={group.groupId}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/dashboard/groups/${group.groupId}`}
                        className="font-medium hover:underline"
                      >
                        {group.groupName}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {group.gradeName}
                        </span>
                        {group.isMixedGrade && (
                          <Badge variant="info">Mixed</Badge>
                        )}
                        {!group.isActive && (
                          <Badge variant="default">Inactive</Badge>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {group.memberCount}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {group.currentLessonNumber !== null ? (
                        <div>
                          <span className="font-mono text-xs text-amber-600 dark:text-amber-400">
                            L{group.currentLessonNumber}
                          </span>{" "}
                          <span className="font-medium">
                            {group.currentLessonName}
                          </span>
                          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {group.sequenceCompleted}/{group.sequenceTotal}{" "}
                            sequence lessons
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">No active sequence</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-4 py-3 text-sm font-semibold tabular-nums",
                        pctColor(group.recentPassRate),
                      )}
                    >
                      {formatPct(group.recentPassRate)}
                      <div className="text-[10px] font-normal text-zinc-400">
                        {group.recentYCount}Y · {group.recentNCount}N ·{" "}
                        {group.recentACount}A
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <Badge variant={HEALTH_VARIANT[group.health]}>
                        {HEALTH_LABEL[group.health]}
                      </Badge>
                      {group.lastActivityDate && (
                        <div className="mt-0.5 text-xs text-zinc-400">
                          {group.lastActivityDate}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function RollupCard({
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
