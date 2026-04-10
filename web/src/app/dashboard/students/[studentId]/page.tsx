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
import {
  getStudentAssessments,
  SNAPSHOT_LABELS,
  type SnapshotType,
} from "@/lib/dal/assessments";
import { getStudentWeeklySnapshots } from "@/lib/dal/weekly-snapshots";
import { getLatestBandAssignment, ARCHETYPE_META } from "@/lib/dal/bands";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPct, pctColor } from "@/lib/format/percent";
import { sectionForLesson, type SkillSectionName } from "@/lib/curriculum/sections";
import {
  DEFICIT_META,
  getDiagnosticRulesForSections,
} from "@/lib/diagnostic/framework";
import { listLessons } from "@/lib/dal/sessions";
import { ManualLessonEntry } from "./manual-lesson-entry";

const BAND_LABELS = {
  not_started: "Not Started",
  intervention: "Intervention",
  on_track: "On Track",
  advanced: "Advanced",
} as const;

const BAND_BADGE_CLASS = {
  not_started: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  intervention: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  on_track: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
  advanced: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
} as const;

const MOVEMENT_LABELS = {
  initial: "Initial",
  accelerating: "Accelerating ↑↑",
  advancing: "Advancing ↑",
  stable: "Stable",
  regressing: "Regressing ↓",
  exiting: "Exiting",
} as const;

interface StudentDetailPageProps {
  params: Promise<{ studentId: string }>;
}

function pctBarColor(value: number): string {
  if (value >= 80) return "bg-green-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-red-500";
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

  const [detail, assessments, weeklySnapshots, bandAssignment] = await Promise.all([
    getStudentDetail(studentId, activeSchoolId, currentYear.yearId),
    getStudentAssessments(studentId, activeSchoolId, currentYear.yearId),
    getStudentWeeklySnapshots(studentId, currentYear.yearId, 8),
    getLatestBandAssignment(studentId, currentYear.yearId),
  ]);
  if (!detail) notFound();

  const canManualEntry =
    user.role === "school_admin" || user.isTiltAdmin;
  const allLessons = canManualEntry ? await listLessons() : [];

  // Sparkline data: chronological (oldest first), capped at 8 weeks.
  const sparklineWeeks = [...weeklySnapshots].reverse();

  const baseline = assessments.find((a) => a.snapshotType === "baseline");
  const latestNonBaseline = [...assessments]
    .reverse()
    .find((a) => a.snapshotType !== "baseline");
  const growthOverall =
    baseline?.overallPct != null && latestNonBaseline?.overallPct != null
      ? latestNonBaseline.overallPct - baseline.overallPct
      : null;

  const { header, bigFour, skillSections, recentActivity, attendance, highWaterMarks, currentGroup } = detail;
  const highWaterSet = new Set(highWaterMarks);

  // Diagnostic hints: any section <80% mastery OR with a recent N.
  // Surfaces the matching rows from the UFLI Diagnostic Error Analysis
  // Framework so tutors see "likely deficit + suggested response" without
  // having to flip between a spreadsheet and the dashboard.
  const strugglingSectionNames = new Set<SkillSectionName>();
  for (const s of skillSections) {
    if (s.pct < 80) strugglingSectionNames.add(s.name as SkillSectionName);
  }
  for (const a of recentActivity) {
    if (a.status !== "N") continue;
    const section = sectionForLesson(a.lessonNumber);
    if (section) strugglingSectionNames.add(section);
  }
  const diagnosticRules = getDiagnosticRulesForSections(
    Array.from(strugglingSectionNames),
  );

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

      {/* Band + Archetype (D.1) */}
      {bandAssignment && (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Band &amp; Archetype
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className={BAND_BADGE_CLASS[bandAssignment.band]}>
                  {BAND_LABELS[bandAssignment.band]}
                </Badge>
                <span className="text-sm font-semibold">
                  {ARCHETYPE_META[bandAssignment.archetype].label}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {MOVEMENT_LABELS[bandAssignment.movement]}
                </span>
                {bandAssignment.swissCheeseGapCount >= 20 &&
                  (bandAssignment.archetype === "advanced_decoding" ||
                    bandAssignment.archetype === "near_proficient") && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                      Gap-Fill Flag
                    </span>
                  )}
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {ARCHETYPE_META[bandAssignment.archetype].implication}
              </p>
              {bandAssignment.ceilingSection && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Highest section at 80%+ mastery:{" "}
                  <span className="font-semibold">
                    {bandAssignment.ceilingSection}
                  </span>
                  {bandAssignment.ceilingLessonNumber !== null && (
                    <>
                      {" "}· Ceiling lesson L{bandAssignment.ceilingLessonNumber}
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Swiss Cheese gaps
              </p>
              <p
                className={cn(
                  "mt-1 text-3xl font-bold tabular-nums",
                  bandAssignment.swissCheeseGapCount >= 20
                    ? "text-amber-600 dark:text-amber-400"
                    : bandAssignment.swissCheeseGapCount > 0
                      ? "text-zinc-700 dark:text-zinc-300"
                      : "text-green-600 dark:text-green-400",
                )}
              >
                {bandAssignment.swissCheeseGapCount}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-400">
                unpassed lessons below ceiling
              </p>
              <p className="mt-2 text-[10px] text-zinc-400">
                as of {bandAssignment.assignedDate}
              </p>
            </div>
          </div>
        </section>
      )}

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

      {/* Weekly growth sparkline */}
      {sparklineWeeks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Weekly Growth (last {sparklineWeeks.length} weeks)
          </h2>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Lessons passed per week vs. the 2-lessons/week aimline (dashed
              line at 100%). A bar above 100% = over-pace; below = behind.
            </p>
            <div className="flex items-end gap-2">
              {sparklineWeeks.map((week) => {
                const pct = week.growthPct;
                // Cap the visual bar at 200% so one outlier week doesn't
                // flatten everything else. Text still shows the real value.
                const capped = Math.min(pct, 200);
                const barColor =
                  pct >= 100
                    ? "bg-green-500"
                    : pct >= 50
                      ? "bg-amber-500"
                      : pct > 0
                        ? "bg-red-500"
                        : "bg-zinc-200 dark:bg-zinc-800";
                return (
                  <div
                    key={week.weekStartDate}
                    className="flex min-w-0 flex-1 flex-col items-center gap-1"
                  >
                    <div className="relative flex h-28 w-full items-end justify-center">
                      <div
                        className="absolute inset-x-0 border-t border-dashed border-zinc-300 dark:border-zinc-700"
                        style={{ bottom: `${(100 / 200) * 100}%` }}
                      />
                      <div
                        className={cn("w-full max-w-[32px] rounded-t", barColor)}
                        style={{ height: `${(capped / 200) * 100}%` }}
                        title={`${week.weekStartDate} · ${week.lessonsPassed} of ${week.lessonsTaken} passed · ${Math.round(pct)}%`}
                      />
                    </div>
                    <div className="text-[10px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                      {Math.round(pct)}%
                    </div>
                    <div className="text-[9px] text-zinc-400 dark:text-zinc-500">
                      {week.weekStartDate.slice(5)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

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

      {/* Diagnostic hints */}
      {diagnosticRules.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Diagnostic Hints
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              From the UFLI Diagnostic Error Analysis Framework — likely
              deficits and suggested instructional responses for the sections
              where this student is struggling.
            </p>
          </div>
          <div className="space-y-3">
            {diagnosticRules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">{rule.concept}</h3>
                  {rule.sections.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {s}
                    </span>
                  ))}
                  {rule.deficits.map((d) => (
                    <span
                      key={d}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                        DEFICIT_META[d].colorClass,
                      )}
                    >
                      {DEFICIT_META[d].label}
                    </span>
                  ))}
                </div>
                <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Reading error
                    </dt>
                    <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                      {rule.readingError}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Spelling error
                    </dt>
                    <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                      {rule.spellingError}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Likely underlying deficit
                    </dt>
                    <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                      {rule.deficitDescription}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Suggested instructional response
                    </dt>
                    <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                      {rule.instructionalResponse}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

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

      {/* Initial assessment snapshots */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Initial Assessments
            </h2>
            <p className="text-xs text-zinc-400">
              Baseline (BOY), Semester 1 end, Semester 2 end snapshots for {currentYear.label}
            </p>
          </div>
          <Link
            href="/dashboard/assessments/new"
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            + New assessment
          </Link>
        </div>
        {assessments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            No initial assessments captured yet for this year.
          </div>
        ) : (
          <div className="space-y-2">
            {growthOverall !== null && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/40">
                <span className="font-semibold">Growth from baseline:</span>{" "}
                <span
                  className={cn(
                    "font-bold",
                    growthOverall > 0
                      ? "text-green-600 dark:text-green-400"
                      : growthOverall < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-500",
                  )}
                >
                  {growthOverall > 0 ? "+" : ""}
                  {growthOverall.toFixed(1)}%
                </span>{" "}
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  ({formatPct(baseline?.overallPct ?? null)} →{" "}
                  {formatPct(latestNonBaseline?.overallPct ?? null)}, latest:{" "}
                  {latestNonBaseline
                    ? SNAPSHOT_LABELS[latestNonBaseline.snapshotType as SnapshotType]
                    : ""}
                  )
                </span>
              </div>
            )}
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Snapshot
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Date
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Foundational
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      G1 Skills
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      G2 Skills
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Overall
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Scorer
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {assessments.map((a) => (
                    <tr key={a.assessmentId}>
                      <td className="px-4 py-2 text-sm">
                        <Badge
                          variant={
                            a.snapshotType === "baseline"
                              ? "default"
                              : a.snapshotType === "semester_1_end"
                                ? "warning"
                                : "success"
                          }
                        >
                          {SNAPSHOT_LABELS[a.snapshotType]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {a.assessmentDate}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-4 py-2 text-right text-sm tabular-nums",
                          pctColor(a.foundationalPct),
                        )}
                      >
                        {formatPct(a.foundationalPct)}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-4 py-2 text-right text-sm tabular-nums",
                          pctColor(a.firstGradePct),
                        )}
                      >
                        {formatPct(a.firstGradePct)}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-4 py-2 text-right text-sm tabular-nums",
                          pctColor(a.secondGradePct),
                        )}
                      >
                        {formatPct(a.secondGradePct)}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-4 py-2 text-right text-sm font-semibold tabular-nums",
                          pctColor(a.overallPct),
                        )}
                      >
                        {formatPct(a.overallPct)}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {a.scorerName ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

      {/* Admin: Manual Lesson Entry */}
      {canManualEntry && (
        <ManualLessonEntry
          studentId={studentId}
          yearId={currentYear.yearId}
          lessons={allLessons}
        />
      )}
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
