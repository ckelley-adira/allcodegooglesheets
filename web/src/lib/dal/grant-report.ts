/**
 * @file dal/grant-report.ts — Grant Report Dataset Composer (Phase D.5a)
 *
 * ONE composer, multiple templates. Loads everything the Tier 1 grant
 * report templates (Mind Trust tutoring grant + Aggregate Impact) need
 * from the school's data layer in a single call, so the template
 * pages render without each one re-running queries.
 *
 * Scope is LOCKED to exactly what Tier 1 needs. Do not add speculative
 * fields for future templates (Executive One-Pager, AI narrative, etc.)
 * until those templates actually ship.
 *
 * The composer does not do any narrative generation — that's the
 * template's job. This layer only produces the facts.
 *
 * Ported conceptually from Grantreportbeginning.gs but using the new
 * platform's schema. Attendance is a SINGLE column (whole-group
 * reconstructed from lesson_progress) — the .gs's WG + tutoring split
 * isn't native to the new schema.
 */

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  SKILL_SECTIONS,
  REVIEW_LESSONS,
  FOUNDATIONAL_RANGE,
  MIN_GRADE_SKILLS_DENOMINATOR,
} from "@/config/ufli";
import {
  ARCHETYPE_META,
  type BandLevel,
  type StudentArchetype,
  type BandMovement,
} from "@/lib/dal/bands";

// ── Types ────────────────────────────────────────────────────────────────

export interface GrantReportFilters {
  /** Grade names to include (e.g. ["G3"]). Empty array = all grades. */
  gradeNames: string[];
  /** Lookback window in days for attendance. Default 14. */
  windowDays: number;
  /** Reference date for the report (defaults to today). ISO yyyy-mm-dd. */
  asOf: string;
}

export interface GrantReportStudentAttendance {
  sessionsTracked: number;
  sessionsPresent: number;
  sessionsAbsent: number;
  /** null if sessionsTracked === 0 (no data in window) */
  attendancePct: number | null;
}

export interface GrantReportStudentMastery {
  foundationalPct: number;
  minGradePct: number;
  overallPct: number;
}

export interface GrantReportSectionRow {
  sectionName: string;
  pct: number;
  /** "gap" if pct < 50, "critical" if pct < 25, null otherwise */
  severity: "gap" | "critical" | null;
}

export interface GrantReportStudentRow {
  studentId: number;
  firstName: string;
  lastName: string;
  gradeName: string;
  groupName: string | null;
  attendance: GrantReportStudentAttendance;
  /**
   * Baseline from the BOY frozen initial_assessment. null when the
   * student has no baseline on file — template handles this case.
   */
  baseline:
    | (GrantReportStudentMastery & { snapshotDate: string })
    | null;
  /** Current mastery from lesson_progress high-water-marks. */
  current: GrantReportStudentMastery;
  /** Band + archetype from latest band_assignments row, or null. */
  banding: {
    band: BandLevel;
    archetype: StudentArchetype;
    archetypeLabel: string;
    movement: BandMovement;
    swissCheeseGapCount: number;
  } | null;
  /** All 16 skill sections with mastery %. */
  sectionMastery: GrantReportSectionRow[];
  /** Gap sections (pct < 50%) sorted asc by pct. */
  gapSections: GrantReportSectionRow[];
  /** Section with the highest mastery % (null if no sections with data). */
  topSkill: GrantReportSectionRow | null;
}

export interface GrantReportAggregates {
  /** Total students in scope after filters */
  studentCount: number;
  /** Student count with any baseline on file */
  studentsWithBaseline: number;
  /** Student count with any attendance data in window */
  studentsWithAttendance: number;
  bandCounts: Record<BandLevel, number>;
  archetypeCounts: Record<StudentArchetype, number>;
  movementCounts: Record<BandMovement, number>;
  /** Mean attendance % across students with attendance data */
  avgAttendancePct: number | null;
  /**
   * School-wide growth: mean of (current - baseline) across students
   * with both a baseline and current mastery. Percentage points.
   */
  schoolGrowth: {
    foundationalPp: number;
    minGradePp: number;
    overallPp: number;
    studentsIncluded: number;
  } | null;
  /** Count of sections at each severity level, summed across all students */
  sectionSeverityCounts: {
    gap: number;
    critical: number;
  };
}

export interface GrantReportDataset {
  school: {
    schoolId: number;
    name: string;
    currentYearLabel: string | null;
  };
  filters: GrantReportFilters;
  students: GrantReportStudentRow[];
  aggregates: GrantReportAggregates;
  /** Window [start, end] as ISO dates, inclusive */
  window: { startIso: string; endIso: string };
  /** Timestamp when the composer ran */
  generatedAt: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────

function nonReviewLessonsIn(range: number[]): number[] {
  return range.filter((l) => !REVIEW_LESSONS.has(l));
}

function pctPassed(range: number[], passed: Set<number>): number {
  const nonReview = nonReviewLessonsIn(range);
  if (nonReview.length === 0) return 0;
  let count = 0;
  for (const l of nonReview) if (passed.has(l)) count++;
  return (count / nonReview.length) * 100;
}

function foundationalRangeLessons(): number[] {
  const out: number[] = [];
  for (let l = FOUNDATIONAL_RANGE.start; l <= FOUNDATIONAL_RANGE.end; l++) {
    out.push(l);
  }
  return out;
}

function minGradeRangeLessons(gradeName: string): number[] {
  const cap = MIN_GRADE_SKILLS_DENOMINATOR[gradeName] ?? 34;
  const out: number[] = [];
  for (let l = 1; l <= cap; l++) out.push(l);
  return out;
}

function allLessons(): number[] {
  const out: number[] = [];
  for (let l = 1; l <= 128; l++) out.push(l);
  return out;
}

function classifySeverity(
  pct: number,
): "gap" | "critical" | null {
  if (pct < 25) return "critical";
  if (pct < 50) return "gap";
  return null;
}

function makeEmptyBandCounts(): Record<BandLevel, number> {
  return { not_started: 0, intervention: 0, on_track: 0, advanced: 0 };
}

function makeEmptyArchetypeCounts(): Record<StudentArchetype, number> {
  return {
    pre_alphabetic: 0,
    early_alphabetic: 0,
    consolidated: 0,
    advanced_decoding: 0,
    near_proficient: 0,
  };
}

function makeEmptyMovementCounts(): Record<BandMovement, number> {
  return {
    initial: 0,
    accelerating: 0,
    advancing: 0,
    stable: 0,
    regressing: 0,
    exiting: 0,
  };
}

// ── Main composer ────────────────────────────────────────────────────────

export async function getGrantReportDataset(
  schoolId: number,
  yearId: number,
  filters: Partial<GrantReportFilters> = {},
): Promise<GrantReportDataset> {
  const supabase = await createClient();

  const asOfDate = filters.asOf ?? new Date().toISOString().split("T")[0];
  const windowDays = filters.windowDays ?? 14;
  const gradeNamesFilter = filters.gradeNames ?? [];

  // Compute window [asOfDate - windowDays, asOfDate]
  const windowEndDate = new Date(asOfDate);
  const windowStartDate = new Date(asOfDate);
  windowStartDate.setDate(windowStartDate.getDate() - windowDays);
  const windowStartIso = windowStartDate.toISOString().split("T")[0];
  const windowEndIso = windowEndDate.toISOString().split("T")[0];

  // 1. School name + year label
  const [schoolRow, yearRow] = await Promise.all([
    supabase
      .from("schools")
      .select("school_id, name")
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase
      .from("academic_years")
      .select("year_id, label")
      .eq("year_id", yearId)
      .maybeSingle(),
  ]);

  const school = {
    schoolId,
    name:
      (schoolRow.data as { school_id: number; name: string } | null)?.name ??
      `School ${schoolId}`,
    currentYearLabel:
      (yearRow.data as { year_id: number; label: string } | null)?.label ??
      null,
  };

  // 2. Active students (grade-filtered)
  let studentsQuery = supabase
    .from("students")
    .select(
      "student_id, first_name, last_name, grade_levels!grade_id(name)",
    )
    .eq("school_id", schoolId)
    .eq("enrollment_status", "active");

  const { data: studentsRaw } = await studentsQuery;

  type StudentRaw = {
    student_id: number;
    first_name: string;
    last_name: string;
    grade_levels: { name: string } | null;
  };

  let rawStudents = ((studentsRaw ?? []) as unknown as StudentRaw[]).map((s) => ({
    studentId: s.student_id,
    firstName: s.first_name,
    lastName: s.last_name,
    gradeName: s.grade_levels?.name ?? "",
  }));

  // Apply grade name filter if provided
  if (gradeNamesFilter.length > 0) {
    const allowed = new Set(gradeNamesFilter);
    rawStudents = rawStudents.filter((s) => allowed.has(s.gradeName));
  }

  if (rawStudents.length === 0) {
    return {
      school,
      filters: {
        gradeNames: gradeNamesFilter,
        windowDays,
        asOf: asOfDate,
      },
      students: [],
      aggregates: {
        studentCount: 0,
        studentsWithBaseline: 0,
        studentsWithAttendance: 0,
        bandCounts: makeEmptyBandCounts(),
        archetypeCounts: makeEmptyArchetypeCounts(),
        movementCounts: makeEmptyMovementCounts(),
        avgAttendancePct: null,
        schoolGrowth: null,
        sectionSeverityCounts: { gap: 0, critical: 0 },
      },
      window: { startIso: windowStartIso, endIso: windowEndIso },
      generatedAt: new Date().toISOString(),
    };
  }

  const studentIds = rawStudents.map((s) => s.studentId);

  // 3. Parallel data loads — using fetchAllRows for queries that can
  //    exceed the Supabase 1,000-row default limit at scale.
  type LatestBandRow = {
    student_id: number;
    assigned_date: string;
    band: BandLevel;
    archetype: StudentArchetype;
    movement: BandMovement;
    swiss_cheese_gap_count: number;
  };
  type MembershipRow = {
    student_id: number;
    instructional_groups: {
      group_id: number;
      group_name: string;
      school_id: number;
    } | null;
  };
  type AttendanceRow = {
    student_id: number;
    group_id: number;
    status: "Y" | "N" | "A";
    date_recorded: string;
  };
  type YearYRow = {
    student_id: number;
    ufli_lessons: { lesson_number: number } | null;
  };

  const [
    membershipsData,
    attendanceData,
    allYearYData,
    baselineAssessmentsResult,
    baselineLessonsResult,
    latestBandData,
  ] = await Promise.all([
    // Group memberships (for "Tutoring Group" column)
    fetchAllRows<MembershipRow>(
      (from, to) =>
        supabase
          .from("group_memberships")
          .select(
            "student_id, instructional_groups!inner(group_id, group_name, school_id)",
          )
          .in("student_id", studentIds)
          .eq("is_active", true)
          .range(from, to) as unknown as PromiseLike<{
          data: MembershipRow[] | null;
          error: { message: string } | null;
        }>,
    ),
    // Attendance window: all lesson_progress rows for these students in window
    fetchAllRows<AttendanceRow>(
      (from, to) =>
        supabase
          .from("lesson_progress")
          .select("student_id, group_id, status, date_recorded")
          .in("student_id", studentIds)
          .eq("year_id", yearId)
          .gte("date_recorded", windowStartIso)
          .lte("date_recorded", windowEndIso)
          .range(from, to),
    ),
    // All-year Y rows for high-water-mark current mastery
    fetchAllRows<YearYRow>(
      (from, to) =>
        supabase
          .from("lesson_progress")
          .select("student_id, ufli_lessons!inner(lesson_number)")
          .in("student_id", studentIds)
          .eq("year_id", yearId)
          .eq("status", "Y")
          .range(from, to) as unknown as PromiseLike<{
          data: YearYRow[] | null;
          error: { message: string } | null;
        }>,
    ),
    // Baseline initial_assessments (snapshot_type='baseline') — 1 per student, safe
    supabase
      .from("initial_assessments")
      .select(
        "assessment_id, student_id, assessment_date, foundational_pct, kg_pct, first_grade_pct, second_grade_pct, overall_pct",
      )
      .in("student_id", studentIds)
      .eq("year_id", yearId)
      .eq("snapshot_type", "baseline"),
    // Baseline lesson rows (for Min Grade % computation per grade)
    // We'll fetch them separately after we know the assessment ids
    Promise.resolve(null),
    // Latest band assignment per student — can have multiple per student over time
    fetchAllRows<LatestBandRow>(
      (from, to) =>
        supabase
          .from("band_assignments")
          .select(
            "student_id, assigned_date, band, archetype, movement, swiss_cheese_gap_count",
          )
          .in("student_id", studentIds)
          .eq("year_id", yearId)
          .order("assigned_date", { ascending: false })
          .range(from, to),
    ),
  ]);

  // 4. Build per-student lookups

  // Group name per student (pick the active membership, first one if multiple)
  const groupNameByStudent = new Map<number, string>();
  for (const r of membershipsData) {
    if (!r.instructional_groups) continue;
    if (r.instructional_groups.school_id !== schoolId) continue;
    if (!groupNameByStudent.has(r.student_id)) {
      groupNameByStudent.set(r.student_id, r.instructional_groups.group_name);
    }
  }

  // Attendance buckets: per-group session dates, per-student absence dates
  const groupSessionDates = new Map<number, Set<string>>();
  const studentAbsenceDates = new Map<number, Set<string>>();
  const studentGroupDates = new Map<number, Set<string>>();

  for (const row of attendanceData) {
    // Distinct session dates per group
    let gset = groupSessionDates.get(row.group_id);
    if (!gset) {
      gset = new Set();
      groupSessionDates.set(row.group_id, gset);
    }
    gset.add(row.date_recorded);

    // Per-student participation + absence
    let sset = studentGroupDates.get(row.student_id);
    if (!sset) {
      sset = new Set();
      studentGroupDates.set(row.student_id, sset);
    }
    sset.add(`${row.group_id}::${row.date_recorded}`);

    if (row.status === "A") {
      let aset = studentAbsenceDates.get(row.student_id);
      if (!aset) {
        aset = new Set();
        studentAbsenceDates.set(row.student_id, aset);
      }
      aset.add(row.date_recorded);
    }
  }

  // High-water-mark passed lesson set per student
  const passedByStudent = new Map<number, Set<number>>();
  for (const r of allYearYData) {
    if (!r.ufli_lessons) continue;
    let set = passedByStudent.get(r.student_id);
    if (!set) {
      set = new Set();
      passedByStudent.set(r.student_id, set);
    }
    set.add(r.ufli_lessons.lesson_number);
  }

  // Baseline header rows
  type BaselineRow = {
    assessment_id: number;
    student_id: number;
    assessment_date: string;
    foundational_pct: string | number | null;
    kg_pct: string | number | null;
    first_grade_pct: string | number | null;
    second_grade_pct: string | number | null;
    overall_pct: string | number | null;
  };
  const baselineByStudent = new Map<number, BaselineRow>();
  for (const row of (baselineAssessmentsResult.data ?? []) as BaselineRow[]) {
    baselineByStudent.set(row.student_id, row);
  }

  // Latest band per student (already ordered desc by assigned_date)
  const latestBandByStudent = new Map<number, LatestBandRow>();
  for (const row of latestBandData) {
    if (!latestBandByStudent.has(row.student_id)) {
      latestBandByStudent.set(row.student_id, row);
    }
  }

  // 5. Compose per-student rows
  const allSkillSectionLessons = Object.entries(SKILL_SECTIONS).map(
    ([name, lessons]) => ({ name, lessons: [...lessons] }),
  );

  const toNum = (v: string | number | null): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === "string" ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : null;
  };

  const students: GrantReportStudentRow[] = rawStudents.map((s) => {
    // Attendance
    const absences = studentAbsenceDates.get(s.studentId)?.size ?? 0;
    const participation = studentGroupDates.get(s.studentId);
    // Total sessions tracked for this student = sessions they participated
    // in (both present and absent counted)
    const sessionsTracked = participation?.size ?? 0;
    const sessionsPresent = sessionsTracked - absences;
    const attendancePct =
      sessionsTracked > 0
        ? Math.round((sessionsPresent / sessionsTracked) * 100)
        : null;

    const attendance: GrantReportStudentAttendance = {
      sessionsTracked,
      sessionsPresent,
      sessionsAbsent: absences,
      attendancePct,
    };

    // Current mastery (high-water-mark)
    const passed = passedByStudent.get(s.studentId) ?? new Set<number>();
    const foundationalPct =
      Math.round(pctPassed(foundationalRangeLessons(), passed) * 10) / 10;
    const minGradePct =
      Math.round(pctPassed(minGradeRangeLessons(s.gradeName), passed) * 10) /
      10;
    const overallPct =
      Math.round(pctPassed(allLessons(), passed) * 10) / 10;
    const current: GrantReportStudentMastery = {
      foundationalPct,
      minGradePct,
      overallPct,
    };

    // Baseline
    const baselineRow = baselineByStudent.get(s.studentId);
    const baseline = baselineRow
      ? (() => {
          const foundPct = toNum(baselineRow.foundational_pct);
          const overallPct = toNum(baselineRow.overall_pct);
          // Min grade for baseline: pick the appropriate grade column
          // or fall back to overall if the specific column is null
          const gradeSpecific = (() => {
            if (s.gradeName === "KG") return toNum(baselineRow.kg_pct);
            if (s.gradeName === "G1")
              return toNum(baselineRow.first_grade_pct);
            if (s.gradeName === "G2")
              return toNum(baselineRow.second_grade_pct);
            // G3+ uses overall as the min-grade proxy since the baseline
            // assessment doesn't store a grade-3+ specific column
            return toNum(baselineRow.overall_pct);
          })();
          return {
            foundationalPct: foundPct ?? 0,
            minGradePct: gradeSpecific ?? 0,
            overallPct: overallPct ?? 0,
            snapshotDate: baselineRow.assessment_date,
          };
        })()
      : null;

    // Section mastery (all 16 sections)
    const sectionMastery: GrantReportSectionRow[] = allSkillSectionLessons.map(
      (sec) => {
        const pct = Math.round(pctPassed(sec.lessons, passed) * 10) / 10;
        return {
          sectionName: sec.name,
          pct,
          severity: classifySeverity(pct),
        };
      },
    );

    const gapSections = sectionMastery
      .filter((s) => s.severity !== null)
      .sort((a, b) => a.pct - b.pct);

    const topSkill =
      sectionMastery.length > 0
        ? sectionMastery.reduce((best, s) =>
            s.pct > best.pct ? s : best,
          )
        : null;

    // Banding
    const band = latestBandByStudent.get(s.studentId);
    const banding = band
      ? {
          band: band.band,
          archetype: band.archetype,
          archetypeLabel: ARCHETYPE_META[band.archetype].label,
          movement: band.movement,
          swissCheeseGapCount: band.swiss_cheese_gap_count,
        }
      : null;

    return {
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      gradeName: s.gradeName,
      groupName: groupNameByStudent.get(s.studentId) ?? null,
      attendance,
      baseline,
      current,
      banding,
      sectionMastery,
      gapSections,
      topSkill,
    };
  });

  // 6. Aggregates
  const bandCounts = makeEmptyBandCounts();
  const archetypeCounts = makeEmptyArchetypeCounts();
  const movementCounts = makeEmptyMovementCounts();

  let studentsWithBaseline = 0;
  let studentsWithAttendance = 0;
  let attendanceSum = 0;
  let attendanceCount = 0;

  let foundationalPpSum = 0;
  let minGradePpSum = 0;
  let overallPpSum = 0;
  let growthStudentCount = 0;

  let gapCount = 0;
  let criticalCount = 0;

  for (const s of students) {
    if (s.baseline !== null) studentsWithBaseline++;
    if (s.attendance.attendancePct !== null) {
      studentsWithAttendance++;
      attendanceSum += s.attendance.attendancePct;
      attendanceCount++;
    }
    if (s.banding) {
      bandCounts[s.banding.band]++;
      archetypeCounts[s.banding.archetype]++;
      movementCounts[s.banding.movement]++;
    }
    if (s.baseline) {
      foundationalPpSum += s.current.foundationalPct - s.baseline.foundationalPct;
      minGradePpSum += s.current.minGradePct - s.baseline.minGradePct;
      overallPpSum += s.current.overallPct - s.baseline.overallPct;
      growthStudentCount++;
    }
    for (const sec of s.sectionMastery) {
      if (sec.severity === "critical") criticalCount++;
      else if (sec.severity === "gap") gapCount++;
    }
  }

  const avgAttendancePct =
    attendanceCount > 0
      ? Math.round((attendanceSum / attendanceCount) * 10) / 10
      : null;

  const schoolGrowth =
    growthStudentCount > 0
      ? {
          foundationalPp:
            Math.round((foundationalPpSum / growthStudentCount) * 10) / 10,
          minGradePp:
            Math.round((minGradePpSum / growthStudentCount) * 10) / 10,
          overallPp:
            Math.round((overallPpSum / growthStudentCount) * 10) / 10,
          studentsIncluded: growthStudentCount,
        }
      : null;

  const aggregates: GrantReportAggregates = {
    studentCount: students.length,
    studentsWithBaseline,
    studentsWithAttendance,
    bandCounts,
    archetypeCounts,
    movementCounts,
    avgAttendancePct,
    schoolGrowth,
    sectionSeverityCounts: { gap: gapCount, critical: criticalCount },
  };

  return {
    school,
    filters: {
      gradeNames: gradeNamesFilter,
      windowDays,
      asOf: asOfDate,
    },
    students,
    aggregates,
    window: { startIso: windowStartIso, endIso: windowEndIso },
    generatedAt: new Date().toISOString(),
  };
}
