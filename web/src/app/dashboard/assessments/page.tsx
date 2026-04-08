/**
 * @file dashboard/assessments/page.tsx — Initial assessment index (Phase UX.3)
 *
 * Snapshot-type drill-down tiles + grade chips + lookback window.
 * Replaces the previous flat table that dumped 500+ rows for a full
 * year of assessment data. Filter state lives in URL search params.
 *
 *   /dashboard/assessments                                    → all
 *   /dashboard/assessments?snapshot=baseline                  → BOY only
 *   /dashboard/assessments?snapshot=baseline&grade=G3         → BOY + G3
 *   /dashboard/assessments?windowDays=30                      → last 30 days
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import {
  listSchoolAssessments,
  SNAPSHOT_LABELS,
  type SnapshotType,
} from "@/lib/dal/assessments";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPct, pctColor } from "@/lib/format/percent";
import {
  GradeFilterChips,
  LookbackFilter,
  ScopeTiles,
  parseGradeFilter,
  parseLookback,
  type ScopeTileItem,
} from "@/components/filters";

export const metadata = {
  title: "Initial Assessments · Adira Reads",
};

const SNAPSHOT_VARIANT: Record<
  SnapshotType,
  "default" | "success" | "warning"
> = {
  baseline: "default",
  semester_1_end: "warning",
  semester_2_end: "success",
};

const SNAPSHOT_ORDER: SnapshotType[] = [
  "baseline",
  "semester_1_end",
  "semester_2_end",
];

interface AssessmentsPageProps {
  searchParams: Promise<{
    snapshot?: string;
    grade?: string | string[];
    windowDays?: string;
  }>;
}

function isSnapshotType(v: string): v is SnapshotType {
  return (
    v === "baseline" || v === "semester_1_end" || v === "semester_2_end"
  );
}

export default async function AssessmentsIndexPage({
  searchParams,
}: AssessmentsPageProps) {
  const params = await searchParams;
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(activeSchoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Initial Assessments</h1>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No active academic year for this school.
          </p>
        </div>
      </div>
    );
  }

  const assessments = await listSchoolAssessments(
    activeSchoolId,
    currentYear.yearId,
  );

  const gradeFilter = parseGradeFilter(params.grade);
  const snapshotFilter: SnapshotType | null =
    params.snapshot && isSnapshotType(params.snapshot) ? params.snapshot : null;
  const windowDaysRaw = params.windowDays;
  // 0 / empty / missing = "all time"; otherwise a positive integer
  const windowDays = windowDaysRaw ? parseLookback(windowDaysRaw, 0) : 0;

  // Snapshot counts computed BEFORE filters so tile counts reflect the full
  // year, not just the current view.
  const snapshotCounts: Record<SnapshotType, number> = {
    baseline: 0,
    semester_1_end: 0,
    semester_2_end: 0,
  };
  for (const a of assessments) snapshotCounts[a.snapshotType]++;

  // Compute the lookback cutoff ISO date (if set)
  const cutoffIso = (() => {
    if (windowDays <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() - windowDays);
    return d.toISOString().split("T")[0];
  })();

  // Apply filters
  const noGradeFilter = gradeFilter.length === 0;
  const filtered = assessments.filter((a) => {
    if (snapshotFilter && a.snapshotType !== snapshotFilter) return false;
    if (!noGradeFilter && !gradeFilter.includes(a.gradeName)) return false;
    if (cutoffIso && a.assessmentDate < cutoffIso) return false;
    return true;
  });

  // Drill-down tiles: "All" + one tile per snapshot type
  const buildHref = (overrides: Record<string, string | null>) => {
    const current = new URLSearchParams();
    if (!overrides.snapshot && snapshotFilter) {
      current.set("snapshot", snapshotFilter);
    } else if (overrides.snapshot) {
      current.set("snapshot", overrides.snapshot);
    }
    for (const g of gradeFilter) current.append("grade", g);
    if (windowDays > 0) current.set("windowDays", String(windowDays));
    const qs = current.toString();
    return qs ? `/dashboard/assessments?${qs}` : "/dashboard/assessments";
  };

  const clearedBase = (() => {
    const qs = new URLSearchParams();
    for (const g of gradeFilter) qs.append("grade", g);
    if (windowDays > 0) qs.set("windowDays", String(windowDays));
    const s = qs.toString();
    return s ? `/dashboard/assessments?${s}` : "/dashboard/assessments";
  })();

  const tileItems: ScopeTileItem[] = [
    {
      key: "all",
      count: assessments.length,
      label: "All Snapshots",
      subtitle: snapshotFilter ? "Clear snapshot filter" : "Everything",
      href: clearedBase,
      active: snapshotFilter === null,
      tone: "default",
    },
    ...SNAPSHOT_ORDER.map<ScopeTileItem>((st) => ({
      key: st,
      count: snapshotCounts[st],
      label: SNAPSHOT_LABELS[st],
      href: buildHref({ snapshot: st }),
      active: snapshotFilter === st,
      tone: snapshotCounts[st] > 0 ? "default" : "default",
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Initial Assessments
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {assessments.length} recorded for {currentYear.label}
          </p>
        </div>
        <Link
          href="/dashboard/assessments/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          + New Assessment
        </Link>
      </div>

      {/* Drill-down tiles */}
      <ScopeTiles items={tileItems} />

      {/* Filter bar */}
      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        {snapshotFilter && (
          <input type="hidden" name="snapshot" value={snapshotFilter} />
        )}
        <GradeFilterChips selected={gradeFilter} />
        <LookbackFilter
          value={windowDays > 0 ? windowDays : 14}
          label="Lookback"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Apply
        </button>
        {(gradeFilter.length > 0 || snapshotFilter || windowDays > 0) && (
          <Link
            href="/dashboard/assessments"
            className="rounded-md border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Clear all
          </Link>
        )}
      </form>

      {assessments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No initial assessments recorded yet for this year.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Start by capturing a baseline for each student.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Showing <strong>{filtered.length}</strong> of {assessments.length}{" "}
            assessments
            {snapshotFilter && (
              <> · Snapshot: {SNAPSHOT_LABELS[snapshotFilter]}</>
            )}
            {gradeFilter.length > 0 && <> · Grades: {gradeFilter.join(", ")}</>}
            {windowDays > 0 && <> · Last {windowDays} days</>}
          </div>
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <Th>Student</Th>
                <Th>Snapshot</Th>
                <Th>Date</Th>
                <Th align="right">Foundational</Th>
                <Th align="right">KG</Th>
                <Th align="right">G1</Th>
                <Th align="right">G2</Th>
                <Th align="right">Overall</Th>
                <Th>Scorer</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-sm text-zinc-400"
                  >
                    No assessments match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr
                    key={a.assessmentId}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-2 text-sm">
                      <Link
                        href={`/dashboard/students/${a.studentId}`}
                        className="font-medium hover:underline"
                      >
                        {a.studentLastName}, {a.studentFirstName}
                      </Link>
                      <span className="ml-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {a.gradeName}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <Badge variant={SNAPSHOT_VARIANT[a.snapshotType]}>
                        {SNAPSHOT_LABELS[a.snapshotType]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {a.assessmentDate}
                    </td>
                    <Pct value={a.foundationalPct} />
                    <Pct value={a.kgPct} />
                    <Pct value={a.firstGradePct} />
                    <Pct value={a.secondGradePct} />
                    <Pct value={a.overallPct} bold />
                    <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {a.scorerName ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Pct({ value, bold }: { value: number | null; bold?: boolean }) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-4 py-2 text-right text-sm tabular-nums",
        bold && "font-semibold",
        pctColor(value),
      )}
    >
      {formatPct(value)}
    </td>
  );
}
