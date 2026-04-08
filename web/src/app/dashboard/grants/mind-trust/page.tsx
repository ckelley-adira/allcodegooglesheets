/**
 * @file grants/mind-trust/page.tsx — Mind Trust Tutoring Grant template
 *
 * Phase D.5c. First Tier 1 grant report template. Ports the five
 * sections of Grantreportbeginning.gs to the new platform:
 *
 *   1. Attendance Rate
 *   2. Baseline vs Current Skill Data
 *   3. Growth Percentages
 *   4. Identified Skill Gaps
 *   5. Instructional Adjustments Tied to Data
 *
 * Per-student, PII-OK. Filters: grade (default all) and date-range
 * lookback window (default 14 days). Per Christina: single Attendance
 * column (WG + tutoring collapsed) rather than the .gs's two-column
 * layout — the new platform's lesson_progress stream is a single
 * source of truth for attendance.
 *
 * Role-gated to school_admin + tilt_admin. Designed to print to PDF
 * cleanly — D.5e adds the dedicated @media print CSS pass.
 */

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import {
  getGrantReportDataset,
  type GrantReportStudentRow,
} from "@/lib/dal/grant-report";
import { cn } from "@/lib/utils";
import { PrintButton } from "../print-button";

interface MindTrustPageProps {
  searchParams: Promise<{
    grade?: string | string[];
    windowDays?: string;
  }>;
}

const GRADE_OPTIONS = ["KG", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"];

function parseGradeFilter(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : raw.split(",");
  return values.map((v) => v.trim()).filter(Boolean);
}

function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n)}%`;
}

function formatDelta(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const rounded = Math.round(n * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded} pp`;
}

function benchmarkFromBand(
  band: GrantReportStudentRow["banding"],
): { label: string; cls: string } {
  if (!band) return { label: "—", cls: "bg-zinc-100 text-zinc-600" };
  switch (band.band) {
    case "not_started":
      return { label: "Not Started", cls: "bg-zinc-100 text-zinc-700" };
    case "intervention":
      return { label: "Intervention", cls: "bg-red-100 text-red-800" };
    case "on_track":
      return { label: "On Track", cls: "bg-green-100 text-green-800" };
    case "advanced":
      return { label: "Advanced", cls: "bg-purple-100 text-purple-800" };
  }
}

function priorityFromBand(
  band: GrantReportStudentRow["banding"],
): "HIGH" | "MEDIUM" | "LOW" {
  if (!band) return "LOW";
  if (band.band === "intervention") return "HIGH";
  if (band.band === "not_started") return "MEDIUM";
  if (band.band === "on_track") return "LOW";
  return "LOW";
}

function generateRecommendation(
  student: GrantReportStudentRow,
): string {
  if (student.gapSections.length === 0) {
    return "No gap sections detected. Continue current sequence.";
  }
  const lowest = student.gapSections[0];
  const severity =
    lowest.severity === "critical" ? "critical gap" : "emerging gap";
  const benchmark = student.banding?.band ?? "unknown";
  const extraGaps =
    student.gapSections.length > 1
      ? ` Also monitor: ${student.gapSections.slice(1, 3).map((g) => g.sectionName).join(", ")}.`
      : "";

  switch (lowest.sectionName) {
    case "Single Consonants & Vowels":
      return `Focus on basic letter-sound correspondence (UFLI L1-34). Explicit phoneme isolation and CVC blending drills.${extraGaps}`;
    case "Blends":
      return `Intensive blends instruction (UFLI L25, L27). Initial and final consonant blend discrimination.${extraGaps}`;
    case "Digraphs":
      return `Digraph work (UFLI L42-53). Articulatory cues for sh/ch/th/wh/ph, word sorts vs. single consonants.${extraGaps}`;
    case "VCE":
      return `VCe pattern instruction (UFLI L54-62). Silent-e anchor charts and CVC-vs-VCe word sorts.${extraGaps}`;
    case "Reading Longer Words":
      return `Syllable division practice (UFLI L63-68). Open vs. closed syllables, chunking strategies.${extraGaps}`;
    case "Ending Spelling Patterns":
      return `Ending pattern work (UFLI L69-76). Floss rule, -tch/-dge distinctions, -ild/-ind/-old family drills.${extraGaps}`;
    case "R-Controlled Vowels":
      return `R-controlled instruction (UFLI L77-83). One vowel at a time, word sorts comparing ar/or/er/ir/ur.${extraGaps}`;
    case "Long Vowel Teams":
      return `Long vowel teams (UFLI L84-88). Positional best-fit rules (ay at end, ai in middle).${extraGaps}`;
    case "Other Vowel Teams":
      return `Other vowel teams (UFLI L89-94). Contrastive drills comparing oo/ew/ui/ue for the /oo/ sound.${extraGaps}`;
    case "Diphthongs":
      return `Diphthong work (UFLI L95-97). Oi/oy and ou/ow mouth-shape drills.${extraGaps}`;
    case "Silent Letters":
      return `Silent letter patterns (UFLI L98). Kn, wr, mb word families.${extraGaps}`;
    case "Suffixes & Prefixes":
      return `Morphology instruction (UFLI L99-106). Explicit teaching of -ed sounds and affix peeling.${extraGaps}`;
    case "Suffix Spelling Changes":
      return `Suffix spelling rules (UFLI L107-110). Doubling and drop-e rule explicit instruction.${extraGaps}`;
    case "Low Frequency Spellings":
      return `Low-frequency pattern drills (UFLI L111-118). Word sorts for rare orthographic patterns.${extraGaps}`;
    case "Additional Affixes":
      return `Advanced morphology (UFLI L119-127). Conditional rules for -able vs. -ible, Greek/Latin roots.${extraGaps}`;
    default:
      return `Targeted ${severity} instruction in ${lowest.sectionName}. Benchmark: ${benchmark}.${extraGaps}`;
  }
}

export default async function MindTrustReportPage({
  searchParams,
}: MindTrustPageProps) {
  const params = await searchParams;
  const user = await requireRole("school_admin", "tilt_admin");
  const schoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(schoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Mind Trust Report</h1>
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

  return (
    <div className="grant-report space-y-6">
      {/* Breadcrumb + print button — hidden in print */}
      <div className="flex items-center justify-between gap-2 text-sm text-zinc-500 dark:text-zinc-400 print:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/grants"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Grants
          </Link>
          <span>/</span>
          <span className="text-zinc-900 dark:text-zinc-100">Mind Trust</span>
        </div>
        <PrintButton />
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
              const checked = gradeFilter.length === 0 || gradeFilter.includes(g);
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
      <header className="border-b-2 border-[#1a73e8] pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-[#1a73e8]">
          Mind Trust Tutoring Grant Report
        </h1>
        <p className="mt-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {dataset.school.name}
          {gradeFilter.length > 0 && (
            <>
              {" "}· {gradeFilter.join(", ")}
            </>
          )}
          {" "}· Academic Year {dataset.school.currentYearLabel ?? "—"}
          {" "}· The Indy Learning Team / Adira Reads
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Report generated {generatedDate} · {dataset.students.length} tutoring
          students · Window: {dataset.window.startIso} – {dataset.window.endIso}
        </p>
      </header>

      {dataset.students.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          No students match the selected filters.
        </div>
      ) : (
        <>
          {/* ─── SECTION 1: ATTENDANCE ─── */}
          <Section
            number={1}
            title="Attendance Rate"
            subtitle={`Source: lesson_progress · Window: ${dataset.window.startIso} – ${dataset.window.endIso}`}
          >
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-[#1a73e8] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Student</th>
                  <th className="px-3 py-2 text-left font-semibold">Group</th>
                  <th className="px-3 py-2 text-right font-semibold">Sessions Tracked</th>
                  <th className="px-3 py-2 text-right font-semibold">Present</th>
                  <th className="px-3 py-2 text-right font-semibold">Absent</th>
                  <th className="px-3 py-2 text-right font-semibold">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dataset.students.map((s, i) => (
                  <tr
                    key={s.studentId}
                    className={i % 2 === 1 ? "bg-[#f0f7ff]" : ""}
                  >
                    <td className="px-3 py-2 font-medium">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {s.groupName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.attendance.sessionsTracked || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.attendance.sessionsPresent || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.attendance.sessionsAbsent || "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums font-semibold",
                        s.attendance.attendancePct === null
                          ? "text-zinc-400"
                          : s.attendance.attendancePct >= 90
                            ? "bg-[#e8f5e9] text-green-800"
                            : s.attendance.attendancePct < 75
                              ? "bg-[#fce4ec] text-red-800"
                              : "text-zinc-700",
                      )}
                    >
                      {formatPct(s.attendance.attendancePct)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#e3f2fd] font-bold">
                  <td className="px-3 py-2">AVERAGES / TOTALS</td>
                  <td></td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {dataset.students.reduce(
                      (sum, s) => sum + s.attendance.sessionsTracked,
                      0,
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {dataset.students.reduce(
                      (sum, s) => sum + s.attendance.sessionsPresent,
                      0,
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {dataset.students.reduce(
                      (sum, s) => sum + s.attendance.sessionsAbsent,
                      0,
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPct(dataset.aggregates.avgAttendancePct)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* ─── SECTION 2: BASELINE vs CURRENT ─── */}
          <Section
            number={2}
            title="Baseline vs Current Skill Data"
            subtitle="Source: initial_assessments (BOY baseline) vs. current high-water-mark mastery"
          >
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-[#1a73e8] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Student</th>
                  <th className="px-3 py-2 text-left font-semibold">Grade</th>
                  <th className="px-3 py-2 text-right font-semibold">Baseline Foundational</th>
                  <th className="px-3 py-2 text-right font-semibold">Current Foundational</th>
                  <th className="px-3 py-2 text-right font-semibold">Baseline Overall</th>
                  <th className="px-3 py-2 text-right font-semibold">Current Overall</th>
                  <th className="px-3 py-2 text-left font-semibold">Benchmark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dataset.students.map((s, i) => {
                  const b = benchmarkFromBand(s.banding);
                  return (
                    <tr
                      key={s.studentId}
                      className={i % 2 === 1 ? "bg-[#f0f7ff]" : ""}
                    >
                      <td className="px-3 py-2 font-medium">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="px-3 py-2">{s.gradeName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.baseline
                          ? formatPct(s.baseline.foundationalPct)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {formatPct(s.current.foundationalPct)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.baseline ? formatPct(s.baseline.overallPct) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {formatPct(s.current.overallPct)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                            b.cls,
                          )}
                        >
                          {b.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          {/* ─── SECTION 3: GROWTH ─── */}
          <Section
            number={3}
            title="Growth Percentages"
            subtitle="Source: current mastery delta from baseline, aggregated school-wide"
          >
            {dataset.aggregates.schoolGrowth && (
              <div className="mb-3 rounded-md bg-[#e8f5e9] px-4 py-3 text-sm font-semibold text-[#2e7d32]">
                School-Wide Growth (n={dataset.aggregates.schoolGrowth.studentsIncluded})
                {"  |  "}
                Foundational {formatDelta(dataset.aggregates.schoolGrowth.foundationalPp)}
                {"  |  "}
                Min Grade {formatDelta(dataset.aggregates.schoolGrowth.minGradePp)}
                {"  |  "}
                Overall {formatDelta(dataset.aggregates.schoolGrowth.overallPp)}
              </div>
            )}
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-[#1a73e8] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Student</th>
                  <th className="px-3 py-2 text-right font-semibold">Foundational Δ</th>
                  <th className="px-3 py-2 text-right font-semibold">Min Grade Δ</th>
                  <th className="px-3 py-2 text-right font-semibold">Overall Δ</th>
                  <th className="px-3 py-2 text-left font-semibold">Top Skill Area</th>
                  <th className="px-3 py-2 text-right font-semibold">Top %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dataset.students.map((s, i) => {
                  const foundationalDelta =
                    s.baseline === null
                      ? null
                      : s.current.foundationalPct - s.baseline.foundationalPct;
                  const minDelta =
                    s.baseline === null
                      ? null
                      : s.current.minGradePct - s.baseline.minGradePct;
                  const overallDelta =
                    s.baseline === null
                      ? null
                      : s.current.overallPct - s.baseline.overallPct;
                  return (
                    <tr
                      key={s.studentId}
                      className={i % 2 === 1 ? "bg-[#f0f7ff]" : ""}
                    >
                      <td className="px-3 py-2 font-medium">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatDelta(foundationalDelta)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatDelta(minDelta)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatDelta(overallDelta)}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">
                        {s.topSkill?.sectionName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.topSkill ? formatPct(s.topSkill.pct) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          {/* ─── SECTION 4: SKILL GAPS ─── */}
          <Section
            number={4}
            title="Identified Skill Gaps"
            subtitle="Source: per-section high-water-mark mastery. Gap < 50% · Critical < 25%"
          >
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-[#1a73e8] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Student</th>
                  <th className="px-3 py-2 text-right font-semibold">Gap Count</th>
                  <th className="px-3 py-2 text-right font-semibold">Critical</th>
                  <th className="px-3 py-2 text-left font-semibold">Lowest Section</th>
                  <th className="px-3 py-2 text-right font-semibold">Lowest %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dataset.students.map((s, i) => {
                  const lowest = s.gapSections[0] ?? null;
                  const criticalCount = s.gapSections.filter(
                    (g) => g.severity === "critical",
                  ).length;
                  return (
                    <tr
                      key={s.studentId}
                      className={i % 2 === 1 ? "bg-[#f0f7ff]" : ""}
                    >
                      <td className="px-3 py-2 font-medium">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.gapSections.length}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          criticalCount > 0 ? "font-semibold text-red-700" : "",
                        )}
                      >
                        {criticalCount}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">
                        {lowest?.sectionName ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          lowest?.severity === "critical"
                            ? "bg-[#ef9a9a] font-bold text-red-900"
                            : lowest?.severity === "gap"
                              ? "bg-[#fce4ec] text-red-800"
                              : "",
                        )}
                      >
                        {lowest ? formatPct(lowest.pct) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          {/* ─── SECTION 5: INSTRUCTIONAL ADJUSTMENTS ─── */}
          <Section
            number={5}
            title="Instructional Adjustments Tied to Data"
            subtitle="Source: gap-pattern analysis + benchmark status. Recommendations mapped to UFLI lesson ranges."
          >
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-[#1a73e8] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Student</th>
                  <th className="px-3 py-2 text-left font-semibold">Benchmark</th>
                  <th className="px-3 py-2 text-left font-semibold">Primary Gap</th>
                  <th className="px-3 py-2 text-left font-semibold">Recommended Focus</th>
                  <th className="px-3 py-2 text-left font-semibold">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dataset.students.map((s, i) => {
                  if (s.gapSections.length === 0) return null;
                  const b = benchmarkFromBand(s.banding);
                  const priority = priorityFromBand(s.banding);
                  const recommendation = generateRecommendation(s);
                  const lowest = s.gapSections[0];
                  return (
                    <tr
                      key={s.studentId}
                      className={i % 2 === 1 ? "bg-[#f0f7ff]" : ""}
                    >
                      <td className="px-3 py-2 font-medium">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                            b.cls,
                          )}
                        >
                          {b.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-700">
                        {lowest.sectionName} ({formatPct(lowest.pct)})
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-700">
                        {recommendation}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-xs font-bold",
                          priority === "HIGH"
                            ? "bg-[#ef9a9a] text-red-900"
                            : priority === "MEDIUM"
                              ? "bg-[#fff9c4] text-amber-900"
                              : "bg-[#e8f5e9] text-green-900",
                        )}
                      >
                        {priority}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-zinc-500">
              Priority Key: HIGH = Intervention status, needs intensive support ·
              MEDIUM = Not Started, needs activation · LOW = On Track or Advanced,
              monitor only.
            </p>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="border-l-4 border-[#1a73e8] bg-[#d0e2f3] px-4 py-2">
        <h2 className="text-base font-bold tracking-tight text-[#1a73e8]">
          {number}. {title.toUpperCase()}
        </h2>
        <p className="text-xs text-zinc-600">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}
