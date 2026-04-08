/**
 * @file grants/impact/page.tsx — Aggregate Impact Report template
 *
 * Phase D.5d. Second Tier 1 grant report template. The de-identified
 * aggregate format from Section 5.4 of the Future State Data Model —
 * designed for Lilly Endowment, NSVF, Mind Trust, and similar impact
 * funders who need proof of program effect without PII exposure.
 *
 * Contains: counts and percentages only. NO student names, NO
 * individual student identifiers. Filtered by school (inherited from
 * the active school context) and grade range. Exportable via
 * Cmd-P → Save as PDF or via CSV download link (Tier 2).
 *
 * Role-gated to school_admin + tilt_admin.
 */

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import { getGrantReportDataset } from "@/lib/dal/grant-report";
import {
  ARCHETYPE_META,
  type BandLevel,
  type StudentArchetype,
  type BandMovement,
} from "@/lib/dal/bands";
import { cn } from "@/lib/utils";

interface ImpactPageProps {
  searchParams: Promise<{
    grade?: string | string[];
    windowDays?: string;
  }>;
}

const GRADE_OPTIONS = ["KG", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"];

const BAND_ORDER: BandLevel[] = [
  "not_started",
  "intervention",
  "on_track",
  "advanced",
];

const BAND_LABELS: Record<BandLevel, string> = {
  not_started: "Not Started",
  intervention: "Intervention",
  on_track: "On Track",
  advanced: "Advanced",
};

const BAND_COLORS: Record<BandLevel, string> = {
  not_started: "bg-zinc-400",
  intervention: "bg-red-500",
  on_track: "bg-green-500",
  advanced: "bg-purple-500",
};

const ARCHETYPE_ORDER: StudentArchetype[] = [
  "pre_alphabetic",
  "early_alphabetic",
  "consolidated",
  "advanced_decoding",
  "near_proficient",
];

const ARCHETYPE_COLORS: Record<StudentArchetype, string> = {
  pre_alphabetic: "bg-rose-400",
  early_alphabetic: "bg-orange-400",
  consolidated: "bg-amber-400",
  advanced_decoding: "bg-teal-500",
  near_proficient: "bg-blue-600",
};

const MOVEMENT_ORDER: BandMovement[] = [
  "accelerating",
  "advancing",
  "stable",
  "regressing",
  "exiting",
];

const MOVEMENT_LABELS: Record<BandMovement, string> = {
  initial: "Initial (first assessment)",
  accelerating: "Accelerating (2+ bands)",
  advancing: "Advancing (1 band)",
  stable: "Stable",
  regressing: "Regressing",
  exiting: "Exited with criteria met",
};

function parseGradeFilter(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : raw.split(",");
  return values.map((v) => v.trim()).filter(Boolean);
}

function pctOf(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function formatPp(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const rounded = Math.round(n * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded} pp`;
}

export default async function ImpactReportPage({
  searchParams,
}: ImpactPageProps) {
  const params = await searchParams;
  const user = await requireRole("school_admin", "tilt_admin");
  const schoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(schoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Aggregate Impact</h1>
        <p className="text-sm text-zinc-500">
          No active academic year for this school.
        </p>
      </div>
    );
  }

  const gradeFilter = parseGradeFilter(params.grade);
  const windowDays = params.windowDays
    ? Math.max(1, Math.min(90, Number(params.windowDays)))
    : 14;

  const dataset = await getGrantReportDataset(schoolId, currentYear.yearId, {
    gradeNames: gradeFilter,
    windowDays,
  });

  const generatedDate = new Date(dataset.generatedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const { aggregates } = dataset;
  const total = aggregates.studentCount;

  return (
    <div className="space-y-6">
      {/* Breadcrumb — hidden in print */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 print:hidden">
        <Link
          href="/dashboard/grants"
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Grants
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100">Aggregate Impact</span>
      </div>

      {/* Filter bar — hidden in print */}
      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 print:hidden dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Grades
          </label>
          <div className="flex flex-wrap gap-2">
            {GRADE_OPTIONS.map((g) => {
              const checked =
                gradeFilter.length === 0 || gradeFilter.includes(g);
              return (
                <label
                  key={g}
                  className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <input
                    type="checkbox"
                    name="grade"
                    value={g}
                    defaultChecked={checked}
                  />
                  {g}
                </label>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-500">
            No grades checked = all grades.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Lookback (days)
          </label>
          <input
            type="number"
            name="windowDays"
            min={1}
            max={90}
            defaultValue={windowDays}
            className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Update
        </button>
      </form>

      {/* Report header — printable */}
      <header className="border-b-2 border-[#1a3c5e] pb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Aggregate Impact Report · De-Identified
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#1a3c5e]">
          {dataset.school.name}
        </h1>
        <p className="mt-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Academic Year {dataset.school.currentYearLabel ?? "—"}
          {gradeFilter.length > 0 && <> · {gradeFilter.join(", ")}</>}
          {" "}· The Indy Learning Team / Adira Reads
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Generated {generatedDate} · n = {total} students enrolled
        </p>
        <p className="mt-2 text-xs italic text-zinc-500">
          This report contains no individual student identifiers. All values
          are counts or percentages of the enrolled population. Safe to share
          with external funders.
        </p>
      </header>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          No students match the selected filters.
        </div>
      ) : (
        <>
          {/* Hero summary bar */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HeroCard
              label="Students Enrolled"
              value={String(total)}
              subtitle={`${aggregates.studentsWithBaseline} assessed at baseline`}
            />
            <HeroCard
              label="Avg Attendance"
              value={
                aggregates.avgAttendancePct !== null
                  ? `${aggregates.avgAttendancePct}%`
                  : "—"
              }
              subtitle={`${aggregates.studentsWithAttendance} with activity in window`}
            />
            <HeroCard
              label="On Track or Advanced"
              value={`${pctOf(
                aggregates.bandCounts.on_track + aggregates.bandCounts.advanced,
                total,
              )}%`}
              subtitle={`${aggregates.bandCounts.on_track + aggregates.bandCounts.advanced} of ${total}`}
            />
            <HeroCard
              label="Sections Below Mastery"
              value={String(
                aggregates.sectionSeverityCounts.gap +
                  aggregates.sectionSeverityCounts.critical,
              )}
              subtitle={`${aggregates.sectionSeverityCounts.critical} critical`}
            />
          </section>

          {/* School-wide growth callout */}
          {aggregates.schoolGrowth && (
            <section className="rounded-lg border-l-4 border-green-500 bg-[#e8f5e9] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-800">
                School-Wide Growth since Baseline
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <GrowthStat
                  label="Foundational Skills"
                  value={formatPp(aggregates.schoolGrowth.foundationalPp)}
                />
                <GrowthStat
                  label="Minimum Grade Skills"
                  value={formatPp(aggregates.schoolGrowth.minGradePp)}
                />
                <GrowthStat
                  label="Overall Mastery"
                  value={formatPp(aggregates.schoolGrowth.overallPp)}
                />
              </div>
              <p className="mt-2 text-[11px] italic text-green-900">
                n = {aggregates.schoolGrowth.studentsIncluded} students with
                both baseline and current data. Values are mean percentage-point
                change.
              </p>
            </section>
          )}

          {/* Band distribution */}
          <Section title="Band Distribution" subtitle="Counts of students by grade-level expectation status">
            <div className="space-y-2 p-4">
              {BAND_ORDER.map((band) => {
                const count = aggregates.bandCounts[band];
                const pct = pctOf(count, total);
                return (
                  <div key={band} className="flex items-center gap-3">
                    <div className="w-32 text-sm font-semibold">
                      {BAND_LABELS[band]}
                    </div>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className={cn("h-full", BAND_COLORS[band])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-24 text-right text-sm font-semibold tabular-nums">
                      {count} · {pct}%
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Archetype distribution */}
          <Section
            title="Archetype Distribution"
            subtitle="Shape of phonics knowledge, independent of band (Section 5.1 of the Future State Data Model)"
          >
            <div className="space-y-3 p-4">
              {ARCHETYPE_ORDER.map((arch) => {
                const count = aggregates.archetypeCounts[arch];
                const pct = pctOf(count, total);
                return (
                  <div key={arch}>
                    <div className="flex items-center gap-3">
                      <div className="w-40 text-sm font-semibold">
                        {ARCHETYPE_META[arch].label}
                      </div>
                      <div className="h-5 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className={cn("h-full", ARCHETYPE_COLORS[arch])}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-24 text-right text-sm font-semibold tabular-nums">
                        {count} · {pct}%
                      </div>
                    </div>
                    <p className="ml-40 pl-3 text-[10px] italic text-zinc-500">
                      {ARCHETYPE_META[arch].implication}
                    </p>
                  </div>
                );
              })}
              <p className="mt-3 text-[11px] italic text-zinc-500">
                Methodology: Archetype centroids derived from a 1,007-student
                K-means clustering analysis (K=5, silhouette=0.37). Each
                student&rsquo;s mastery profile is classified by nearest
                Euclidean centroid.
              </p>
            </div>
          </Section>

          {/* Movement breakdown */}
          <Section
            title="Band Movement Since Prior Week"
            subtitle="Per Section 5.3 — longitudinal student movement engine"
          >
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-[#1a3c5e] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">
                    Movement
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">Count</th>
                  <th className="px-3 py-2 text-right font-semibold">
                    % of Assessed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {MOVEMENT_ORDER.map((m) => {
                  const count = aggregates.movementCounts[m];
                  return (
                    <tr key={m}>
                      <td className="px-3 py-2">{MOVEMENT_LABELS[m]}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {count}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {pctOf(count, total)}%
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-zinc-100 font-semibold">
                  <td className="px-3 py-2">
                    Initial (first assessment this year)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {aggregates.movementCounts.initial}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pctOf(aggregates.movementCounts.initial, total)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Section severity */}
          <Section
            title="Instructional Gap Prevalence"
            subtitle="Count of student-section pairs below mastery thresholds across the program"
          >
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <div className="rounded-md bg-[#fce4ec] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-800">
                  Gap (under 50%)
                </p>
                <p className="mt-1 text-3xl font-bold text-red-800">
                  {aggregates.sectionSeverityCounts.gap}
                </p>
                <p className="mt-1 text-[11px] text-red-900">
                  Section-student pairs needing targeted reteach
                </p>
              </div>
              <div className="rounded-md bg-[#ef9a9a] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-900">
                  Critical (under 25%)
                </p>
                <p className="mt-1 text-3xl font-bold text-red-900">
                  {aggregates.sectionSeverityCounts.critical}
                </p>
                <p className="mt-1 text-[11px] text-red-900">
                  Section-student pairs needing intensive intervention
                </p>
              </div>
            </div>
          </Section>

          {/* Methodology note for funders */}
          <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">
              Methodology &amp; Data Integrity
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Band assignment uses the highest skill section with ≥80%
                mastery, not the first failed lesson. This accounts for the
                Swiss Cheese finding — 85.6% of students have earlier-skill
                gaps that coexist with later passed skills.
              </li>
              <li>
                Growth is computed as the mean percentage-point delta between
                each student&rsquo;s beginning-of-year baseline assessment
                and their current high-water-mark mastery. Only students with
                both data points are included (n={aggregates.schoolGrowth?.studentsIncluded ?? 0}).
              </li>
              <li>
                Attendance is the mean across students with any session
                activity in the {windowDays}-day window. Students with zero
                recorded sessions are excluded from the attendance denominator.
              </li>
              <li>
                Archetype classifications are validated against a 1,007-student
                K-means clustering analysis with an R² of 93.4% against the
                full 105-skill assessment.
              </li>
              <li>
                All data is captured in real time by instructional staff and
                stored in a HIPAA/FERPA-aligned multi-tenant platform. School
                data is isolated at the database layer via PostgreSQL row-level
                security; no cross-school contamination is possible.
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function HeroCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{subtitle}</p>
    </div>
  );
}

function GrowthStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-green-800">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-bold text-green-900">{value}</p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-l-4 border-[#1a3c5e] bg-[#d0e2f3] px-4 py-2">
        <h2 className="text-base font-bold tracking-tight text-[#1a3c5e]">
          {title}
        </h2>
        <p className="text-xs text-zinc-600">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}
