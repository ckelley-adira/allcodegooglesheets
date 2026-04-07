/**
 * @file students/[studentId]/page.tsx — Per-student detail page
 *
 * Layer 2 report: pulls together everything we know about one student
 * into a single scrolling view. Powered by getStudentDetail() which
 * gathers identity, current group + sequence position, per-student Big
 * Four, skill section breakdown, recent activity, attendance, and
 * high-water marks in one composer call.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { getStudentDetail } from "@/lib/dal/student-detail";
import { listAcademicYears } from "@/lib/dal/groups";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StudentDetailPageProps {
  params: Promise<{ studentId: string }>;
}

function pctColor(value: number | null): string {
  if (value === null) return "text-zinc-400";
  if (value >= 80) return "text-green-600 dark:text-green-400";
  if (value >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function pctBarColor(value: number): string {
  if (value >= 80) return "bg-green-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function formatPct(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value)}%`;
}

const STATUS_BADGE_VARIANT = {
  active: "success",
  withdrawn: "danger",
  transferred: "warning",
  graduated: "info",
} as const;

const SLOPE_BADGE_VARIANT = {
  "On Pace": "success",
  Behind: "warning",
  Intervention: "danger",
  "Presence Concern": "info",
  "No Data": "default",
} as const;

const CELL_STYLES: Record<"Y" | "N" | "A", string> = {
  Y: "bg-[#d4edda] text-green-800 dark:bg-green-900/40 dark:text-green-300",
  N: "bg-[#f8d7da] text-red-800 dark:bg-red-900/40 dark:text-red-300",
  A: "bg-[#fff3cd] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export default async function StudentDetailPage({
  params,
}: StudentDetailPageProps) {
  const { studentId: studentIdParam } = await params;
  const studentId = Number(studentIdParam);
  if (!studentId || Number.isNaN(studentId)) notFound();

  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);

  const years = await listAcademicYears(activeSchoolId);
  const currentYear = years.find((y) => y.isCurrent);
  if (!currentYear) {
    notFound();
  }

  const detail = await getStudentDetail(
    studentId,
    activeSchoolId,
    currentYear.yearId,
  );
  if (!detail) notFound();

  const { header, bigFour, skillSections, recentActivity, attendance, highWaterMarks, currentGroup } = detail;
  const highWaterSet = new Set(highWaterMarks);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/dashboard/students"
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Students
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
            {header.gradeName} &middot;{" "}
            <span className="font-mono">{header.studentNumber}</span> &middot;
            Enrolled {header.enrollmentDate}
          </p>
          <div className="mt-2">
            <Badge variant={STATUS_BADGE_VARIANT[header.enrollmentStatus]}>
              {header.enrollmentStatus}
            </Badge>
          </div>
        </div>
      </div>

      {/* Big Four metric cards (per-student) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Foundational"
          value={formatPct(bigFour.foundationalPct)}
          subtitle="L1–L34 mastery"
          colorClass={pctColor(bigFour.foundationalPct)}
        />
        <MetricCard
          title="Min Grade"
          value={formatPct(bigFour.minGradePct)}
          subtitle={`MTSS metric for ${header.gradeName}`}
          colorClass={pctColor(bigFour.minGradePct)}
        />
        <MetricCard
          title="Year Goal"
          value={formatPct(bigFour.currentYearGoalPct)}
          subtitle="This year's curriculum"
          colorClass={pctColor(bigFour.currentYearGoalPct)}
        />
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Growth (4-week)
          </p>
          <div className="mt-1">
            <Badge variant={SLOPE_BADGE_VARIANT[bigFour.slope.label]}>
              {bigFour.slope.label}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            {bigFour.slope.label === "Presence Concern"
              ? `${bigFour.slope.absences} absent days in window`
              : bigFour.slope.label === "No Data"
                ? "No lessons recorded yet"
                : `${bigFour.slope.newGrowth} of ${bigFour.slope.adjustedExpected} expected`}
          </p>
        </div>
      </div>

      {/* Current group + sequence */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Current Group
        </h2>
        {currentGroup ? (
          <Link
            href={`/dashboard/groups/${currentGroup.groupId}`}
            className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{currentGroup.groupName}</p>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  Taught by {currentGroup.staffName}
                </p>
              </div>
              {currentGroup.sequenceId && (
                <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                  <p>{currentGroup.sequenceName}</p>
                  <p className="font-medium">
                    {currentGroup.completedSequenceLessons}/
                    {currentGroup.totalSequenceLessons} lessons
                  </p>
                </div>
              )}
            </div>
            {currentGroup.currentLessonNumber !== null && (
              <div className="mt-3 rounded-md bg-amber-50 p-2 text-sm dark:bg-amber-950/30">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Currently teaching
                </span>{" "}
                <span className="font-mono text-xs text-amber-700 dark:text-amber-400">
                  L{currentGroup.currentLessonNumber}
                </span>{" "}
                <span className="font-medium">{currentGroup.currentLessonName}</span>
              </div>
            )}
          </Link>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            Not currently in any group.
          </div>
        )}
      </section>

      {/* Skill section breakdown */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Skill Section Mastery
        </h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {skillSections.map((section) => (
              <li
                key={section.name}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1 truncate font-medium">
                  {section.name}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {section.passedLessons}/{section.totalLessons}
                </div>
                <div className="hidden w-32 sm:block">
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={cn("h-full", pctBarColor(section.pct))}
                      style={{ width: `${Math.round(section.pct)}%` }}
                    />
                  </div>
                </div>
                <div
                  className={cn(
                    "w-12 text-right text-sm font-semibold tabular-nums",
                    pctColor(section.pct),
                  )}
                >
                  {Math.round(section.pct)}%
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* High-water mark map */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Lessons Mastered ({highWaterMarks.length} of 128)
        </h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5 text-[9px] sm:grid-cols-[repeat(32,minmax(0,1fr))]">
            {Array.from({ length: 128 }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                title={`L${n}`}
                className={cn(
                  "flex h-6 items-center justify-center rounded font-mono",
                  highWaterSet.has(n)
                    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-zinc-50 text-zinc-300 dark:bg-zinc-900 dark:text-zinc-700",
                )}
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Attendance */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Attendance (last 4 weeks)
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Attendance rate
            </p>
            <p
              className={cn(
                "mt-1 text-2xl font-bold",
                pctColor(attendance.attendancePct),
              )}
            >
              {formatPct(attendance.attendancePct)}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Sessions attended
            </p>
            <p className="mt-1 text-2xl font-bold">
              {attendance.presentEntries}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Sessions absent
            </p>
            <p className="mt-1 text-2xl font-bold">
              {attendance.absentEntries}
            </p>
          </div>
        </div>
      </section>

      {/* Recent activity */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Recent Activity
        </h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {recentActivity.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-400">
              No activity recorded yet.
            </p>
          ) : (
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Lesson
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recentActivity.map((row, i) => (
                  <tr key={`${row.lessonId}-${row.dateRecorded}-${i}`}>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">
                      {row.dateRecorded}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className="font-mono text-xs text-zinc-400">
                        L{row.lessonNumber}
                      </span>{" "}
                      {row.lessonName}
                      {row.isReview && (
                        <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          Review
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold",
                          CELL_STYLES[row.status],
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  colorClass,
}: {
  title: string;
  value: string;
  subtitle: string;
  colorClass: string;
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
