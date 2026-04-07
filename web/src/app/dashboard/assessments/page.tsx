/**
 * @file dashboard/assessments/page.tsx — Initial assessment index
 *
 * Lists every initial assessment in the active school for the current
 * academic year, ordered by date desc. Each row links to the student's
 * detail page where the snapshots are visualized in context.
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

export default async function AssessmentsIndexPage() {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Initial Assessments
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {assessments.length} assessment{assessments.length === 1 ? "" : "s"}{" "}
            recorded for {currentYear.label}
          </p>
        </div>
        <Link
          href="/dashboard/assessments/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          + New Assessment
        </Link>
      </div>

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
              {assessments.map((a) => (
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
              ))}
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
