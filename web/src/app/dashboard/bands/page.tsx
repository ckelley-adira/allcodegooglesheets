/**
 * @file dashboard/bands/page.tsx — Banding Report (Phase D.1)
 *
 * School-wide distribution of bands + archetypes at the latest weekly
 * capture, plus movement counts since the prior week and the top
 * students by Swiss Cheese gap count.
 *
 * Section 5 of the Future State Data Model: bands reflect grade-level
 * expectation status (not_started / intervention / on_track / advanced),
 * archetypes reflect phonics-knowledge shape (pre_alphabetic through
 * near_proficient). Two dimensions, not collapsed.
 *
 * Role-gated to coach / school_admin / tilt_admin. Tutors see the
 * student-level view instead.
 */

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import {
  getSchoolBandSummary,
  ARCHETYPE_META,
  type BandLevel,
  type StudentArchetype,
  type BandMovement,
} from "@/lib/dal/bands";
import { cn } from "@/lib/utils";

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

const BAND_TEXT_COLORS: Record<BandLevel, string> = {
  not_started: "text-zinc-600 dark:text-zinc-400",
  intervention: "text-red-600 dark:text-red-400",
  on_track: "text-green-600 dark:text-green-400",
  advanced: "text-purple-600 dark:text-purple-400",
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
  "initial",
];

const MOVEMENT_LABELS: Record<BandMovement, string> = {
  accelerating: "Accelerating ↑↑",
  advancing: "Advancing ↑",
  stable: "Stable",
  regressing: "Regressing ↓",
  exiting: "Exiting",
  initial: "Initial",
};

const MOVEMENT_TEXT: Record<BandMovement, string> = {
  accelerating: "text-purple-600 dark:text-purple-400",
  advancing: "text-green-600 dark:text-green-400",
  stable: "text-zinc-500 dark:text-zinc-400",
  regressing: "text-red-600 dark:text-red-400",
  exiting: "text-blue-600 dark:text-blue-400",
  initial: "text-zinc-400",
};

function percentOf(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

export default async function BandsPage() {
  const user = await requireRole("coach", "school_admin", "tilt_admin");
  const schoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(schoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Banding Report</h1>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No active academic year for this school.
          </p>
        </div>
      </div>
    );
  }

  const summary = await getSchoolBandSummary(schoolId, currentYear.yearId);
  const totalAssigned = summary.studentsAssigned;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Banding Report</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Two dimensions from the Future State Data Model Section 5: bands
          reflect grade-level expectation status; archetypes reflect the
          shape of phonics knowledge. Both matter.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Last captured
          </p>
          <p className="mt-1 text-lg font-semibold">
            {summary.latestAssignedDate ?? "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {summary.latestAssignedDate
              ? "Most recent Friday capture"
              : "No assignments captured yet"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Students assigned
          </p>
          <p className="mt-1 text-3xl font-bold">
            {summary.studentsAssigned}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            of {summary.totalStudents} active students
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            On Track or Advanced
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              summary.bandCounts.on_track + summary.bandCounts.advanced >
                totalAssigned / 2
                ? "text-green-600 dark:text-green-400"
                : "text-zinc-700 dark:text-zinc-300",
            )}
          >
            {percentOf(
              summary.bandCounts.on_track + summary.bandCounts.advanced,
              totalAssigned,
            )}
            %
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {summary.bandCounts.on_track + summary.bandCounts.advanced} of{" "}
            {totalAssigned}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Gap-Fill flagged
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              summary.gapFillFlagCount > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-zinc-400",
            )}
          >
            {summary.gapFillFlagCount}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Advanced archetype + ≥20 Swiss cheese gaps
          </p>
        </div>
      </div>

      {summary.latestAssignedDate === null ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          No band assignments captured yet. Go to{" "}
          <Link
            href="/dashboard/snapshots"
            className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Snapshots
          </Link>{" "}
          and click &ldquo;Recompute snapshots&rdquo; to run the first capture.
        </div>
      ) : (
        <>
          {/* Band distribution */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Band Distribution
            </h2>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="space-y-3">
                {BAND_ORDER.map((band) => {
                  const count = summary.bandCounts[band];
                  const pct = percentOf(count, totalAssigned);
                  return (
                    <div key={band} className="flex items-center gap-3">
                      <div className="w-32 text-sm font-semibold">
                        {BAND_LABELS[band]}
                      </div>
                      <div className="h-6 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className={cn("h-full", BAND_COLORS[band])}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div
                        className={cn(
                          "w-24 text-right text-sm font-semibold tabular-nums",
                          BAND_TEXT_COLORS[band],
                        )}
                      >
                        {count} · {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Archetype distribution */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Archetype Distribution
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Shape of phonics knowledge. An Advanced Decoding student in
              the Intervention band still gets advanced-decoding instruction
              — band and archetype are orthogonal.
            </p>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="space-y-3">
                {ARCHETYPE_ORDER.map((arch) => {
                  const count = summary.archetypeCounts[arch];
                  const pct = percentOf(count, totalAssigned);
                  return (
                    <div key={arch}>
                      <div className="flex items-center gap-3">
                        <div className="w-40 text-sm font-semibold">
                          {ARCHETYPE_META[arch].label}
                        </div>
                        <div className="h-6 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className={cn("h-full", ARCHETYPE_COLORS[arch])}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="w-24 text-right text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                          {count} · {pct}%
                        </div>
                      </div>
                      <p className="ml-40 mt-0.5 pl-3 text-[11px] italic text-zinc-500 dark:text-zinc-400">
                        {ARCHETYPE_META[arch].implication}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Movement counts */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Movement Since Prior Week
            </h2>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {MOVEMENT_ORDER.map((m) => (
                <div
                  key={m}
                  className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {MOVEMENT_LABELS[m]}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-2xl font-bold tabular-nums",
                      MOVEMENT_TEXT[m],
                    )}
                  >
                    {summary.movementCounts[m]}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Top gap students */}
          {summary.topGapStudents.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Top Swiss Cheese Gap Counts
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Students with the most unpassed non-review lessons below
                their ceiling lesson. High gap count + advanced archetype
                = candidate for targeted gap-fill instruction.
              </p>
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                  <thead className="bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Student
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Band
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Archetype
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Gap count
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {summary.topGapStudents.map((s) => (
                      <tr
                        key={s.studentId}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                      >
                        <td className="px-4 py-2 text-sm">
                          <Link
                            href={`/dashboard/students/${s.studentId}`}
                            className="font-medium hover:underline"
                          >
                            {s.studentName}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span className={cn("font-medium", BAND_TEXT_COLORS[s.band])}>
                            {BAND_LABELS[s.band]}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {ARCHETYPE_META[s.archetype].label}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-sm font-semibold tabular-nums">
                          {s.gapCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Bands and archetypes are computed weekly on Friday after the
        Dashboard snapshot is captured. Band assignment uses the highest
        skill section with ≥80% mastery (Swiss Cheese finding — 85.6% of
        students have earlier-skill gaps that coexist with later passed
        skills, making first-failure-based placement wrong). Archetype is
        nearest Euclidean centroid against the 1,007-student K-means
        profiles from the Future State Data Model Section 5.
      </p>
    </div>
  );
}
