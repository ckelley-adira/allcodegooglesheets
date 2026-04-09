/**
 * @file dal/student-detail.ts — Single-student aggregated view
 *
 * Powers the /dashboard/students/[studentId] detail page. Gathers
 * everything we know about one student: identity, current group +
 * sequence, per-student Big Four metrics, skill section breakdown,
 * recent activity, attendance, and high-water marks.
 *
 * Each helper is a thin Supabase query; getStudentDetail() composes
 * them via Promise.all so the page renders in one round-trip from
 * the DAL's perspective.
 *
 * @rls School-scoping enforced via the explicit schoolId parameter.
 */

import { createClient } from "@/lib/supabase/server";
import {
  FOUNDATIONAL_RANGE,
  MIN_GRADE_SKILLS_DENOMINATOR,
  CURRENT_YEAR_GOAL_DENOMINATOR,
  TARGET_LESSONS_PER_WEEK,
  GROWTH_SLOPE_WEEKS,
  REVIEW_LESSONS,
  SKILL_SECTIONS,
  SECTION_REVIEW_LESSONS,
} from "@/config/ufli";
import type { SkillSectionName } from "@/lib/curriculum/sections";

// ── Types ────────────────────────────────────────────────────────────────

export interface StudentDetailHeader {
  studentId: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  enrollmentStatus: "active" | "withdrawn" | "transferred" | "graduated";
  enrollmentDate: string;
  gradeName: string;
  gradeId: number;
}

/** Per-student version of the Big Four. Same denominators, single subject. */
export interface StudentBigFour {
  /** L1-L34 mastery, denominator 34 */
  foundationalPct: number | null;
  /** Grade-specific cap (KG=34, G1=57, etc.); null if no denom */
  minGradePct: number | null;
  /** This year's goal lessons (excluding reviews); null if no denom */
  currentYearGoalPct: number | null;
  /** 4-week slope label + raw ratio (or null for presence concern) */
  slope: {
    label: "On Pace" | "Behind" | "Intervention" | "Presence Concern" | "No Data";
    ratio: number | null;
    newGrowth: number;
    absences: number;
    adjustedExpected: number;
  };
}

export interface SkillSectionRow {
  name: string;
  totalLessons: number;
  passedLessons: number;
  pct: number;
}

export interface RecentActivityRow {
  lessonId: number;
  lessonNumber: number;
  lessonName: string | null;
  status: "Y" | "N" | "A";
  dateRecorded: string;
  isReview: boolean;
}

export interface AttendanceSummary {
  /** Last 28 days */
  totalEntries: number;
  presentEntries: number;
  absentEntries: number;
  attendancePct: number | null;
}

export interface CurrentGroupInfo {
  groupId: number;
  groupName: string;
  staffName: string;
  staffId: number;
  sequenceId: number | null;
  sequenceName: string | null;
  currentLessonNumber: number | null;
  currentLessonName: string | null;
  totalSequenceLessons: number;
  completedSequenceLessons: number;
}

export interface StudentDetail {
  header: StudentDetailHeader;
  bigFour: StudentBigFour;
  skillSections: SkillSectionRow[];
  recentActivity: RecentActivityRow[];
  attendance: AttendanceSummary;
  /** Set of lesson numbers (1-128) the student has ever passed */
  highWaterMarks: number[];
  currentGroup: CurrentGroupInfo | null;
}

// ── Internal raw types ───────────────────────────────────────────────────

interface RawProgressRow {
  lesson_id: number;
  status: "Y" | "N" | "A";
  date_recorded: string;
  ufli_lessons: {
    lesson_number: number;
    lesson_name: string | null;
    is_review: boolean;
  } | null;
}

// ── Main composer ────────────────────────────────────────────────────────

/**
 * Returns the full detail object for a single student.
 *
 * @rls schoolId must match the student's school_id; otherwise returns null.
 */
export async function getStudentDetail(
  studentId: number,
  schoolId: number,
  yearId: number,
): Promise<StudentDetail | null> {
  const supabase = await createClient();

  // 1. Header (with grade name)
  const { data: studentRow } = await supabase
    .from("students")
    .select(
      "student_id, first_name, last_name, student_number, enrollment_status, enrollment_date, grade_id, grade_levels(name)",
    )
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!studentRow) return null;

  const sRow = studentRow as unknown as {
    student_id: number;
    first_name: string;
    last_name: string;
    student_number: string;
    enrollment_status: "active" | "withdrawn" | "transferred" | "graduated";
    enrollment_date: string;
    grade_id: number;
    grade_levels: { name: string } | null;
  };

  const header: StudentDetailHeader = {
    studentId: sRow.student_id,
    firstName: sRow.first_name,
    lastName: sRow.last_name,
    studentNumber: sRow.student_number,
    enrollmentStatus: sRow.enrollment_status,
    enrollmentDate: sRow.enrollment_date,
    gradeName: sRow.grade_levels?.name ?? "",
    gradeId: sRow.grade_id,
  };

  // 2. All progress rows for this student in the year (one query, used by
  // multiple downstream computations)
  const { data: progressRaw } = await supabase
    .from("lesson_progress")
    .select(
      "lesson_id, status, date_recorded, ufli_lessons(lesson_number, lesson_name, is_review)",
    )
    .eq("student_id", studentId)
    .eq("year_id", yearId)
    .order("date_recorded", { ascending: false });

  const allProgress = (progressRaw ?? []) as unknown as RawProgressRow[];

  // 3. Compose all the views from this single dataset
  const bigFour = computeStudentBigFour(allProgress, header.gradeName);
  const skillSections = computeSkillSectionBreakdown(allProgress);
  const recentActivity = computeRecentActivity(allProgress, 20);
  const attendance = computeAttendance(allProgress, 28);
  const highWaterMarks = computeHighWaterMarks(allProgress);

  // 4. Current group + sequence (separate query because it joins different tables)
  const currentGroup = await fetchCurrentGroup(studentId);

  return {
    header,
    bigFour,
    skillSections,
    recentActivity,
    attendance,
    highWaterMarks,
    currentGroup,
  };
}

// ── Pure helpers (computation, not queries) ──────────────────────────────

/**
 * Builds the high-water-mark set: lesson numbers the student has ever
 * earned a Y for. Per Christina's spec, a Y is sticky — a later N on a
 * reteach doesn't undo it.
 */
function computeHighWaterMarks(rows: RawProgressRow[]): number[] {
  const marks = new Set<number>();
  for (const r of rows) {
    if (r.status !== "Y") continue;
    const num = r.ufli_lessons?.lesson_number;
    if (num) marks.add(num);
  }
  return Array.from(marks).sort((a, b) => a - b);
}

function computeStudentBigFour(
  rows: RawProgressRow[],
  gradeName: string,
): StudentBigFour {
  const marks = new Set(computeHighWaterMarks(rows));

  // Foundational %
  let foundationalPassed = 0;
  for (let n = FOUNDATIONAL_RANGE.start; n <= FOUNDATIONAL_RANGE.end; n++) {
    if (marks.has(n)) foundationalPassed++;
  }
  const foundationalPct =
    (foundationalPassed / (FOUNDATIONAL_RANGE.end - FOUNDATIONAL_RANGE.start + 1)) *
    100;

  // Min Grade %
  const minGradeDenom = MIN_GRADE_SKILLS_DENOMINATOR[gradeName] ?? 0;
  let minGradePct: number | null = null;
  if (minGradeDenom > 0) {
    let passed = 0;
    for (let n = 1; n <= minGradeDenom; n++) {
      if (marks.has(n)) passed++;
    }
    minGradePct = (passed / minGradeDenom) * 100;
  }

  // Current Year Goal %
  const yearGoalCount = CURRENT_YEAR_GOAL_DENOMINATOR[gradeName] ?? 0;
  let currentYearGoalPct: number | null = null;
  if (yearGoalCount > 0) {
    const yearGoalLessons: number[] = [];
    let n = 1;
    while (yearGoalLessons.length < yearGoalCount && n <= 128) {
      if (!REVIEW_LESSONS.has(n)) yearGoalLessons.push(n);
      n++;
    }
    let passed = 0;
    for (const ln of yearGoalLessons) if (marks.has(ln)) passed++;
    currentYearGoalPct = (passed / yearGoalLessons.length) * 100;
  }

  // 4-week growth slope (high-water-mark + adjusted-expected absence handling)
  const windowDays = GROWTH_SLOPE_WEEKS * 7;
  const today = new Date();
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowStartIso = windowStart.toISOString().split("T")[0];

  // Lessons passed BEFORE the window — used to filter out re-passes
  const passedBeforeWindow = new Set<number>();
  for (const r of rows) {
    if (r.status !== "Y") continue;
    if (r.date_recorded >= windowStartIso) continue;
    const ln = r.ufli_lessons?.lesson_number;
    if (ln) passedBeforeWindow.add(ln);
  }

  // New growth = lessons whose first Y falls inside the window
  const newGrowth = new Set<number>();
  let absences = 0;
  for (const r of rows) {
    if (r.date_recorded < windowStartIso) continue;
    if (r.status === "A") {
      absences++;
      continue;
    }
    if (r.status === "Y") {
      const ln = r.ufli_lessons?.lesson_number;
      if (ln && !passedBeforeWindow.has(ln)) newGrowth.add(ln);
    }
  }

  const expected = TARGET_LESSONS_PER_WEEK * GROWTH_SLOPE_WEEKS;
  const adjustedExpected = expected - absences;

  let slope: StudentBigFour["slope"];
  if (adjustedExpected <= 0) {
    slope = {
      label: "Presence Concern",
      ratio: null,
      newGrowth: newGrowth.size,
      absences,
      adjustedExpected: 0,
    };
  } else if (rows.length === 0) {
    slope = {
      label: "No Data",
      ratio: null,
      newGrowth: 0,
      absences: 0,
      adjustedExpected,
    };
  } else {
    const ratio = newGrowth.size / adjustedExpected;
    let label: StudentBigFour["slope"]["label"];
    if (ratio >= 0.85) label = "On Pace";
    else if (ratio >= 0.5) label = "Behind";
    else label = "Intervention";
    slope = {
      label,
      ratio,
      newGrowth: newGrowth.size,
      absences,
      adjustedExpected,
    };
  }

  return {
    foundationalPct,
    minGradePct,
    currentYearGoalPct,
    slope,
  };
}

function computeSkillSectionBreakdown(
  rows: RawProgressRow[],
): SkillSectionRow[] {
  const marks = new Set(computeHighWaterMarks(rows));
  // Build attempted set for gateway check (Y or N, not A)
  const attempted = new Set<number>();
  for (const r of rows) {
    if (r.status === "Y" || r.status === "N") {
      const ln = r.ufli_lessons?.lesson_number;
      if (ln) attempted.add(ln);
    }
  }

  const result: SkillSectionRow[] = [];
  for (const [name, lessonNumbers] of Object.entries(SKILL_SECTIONS)) {
    const nonReview = lessonNumbers.filter(
      (ln) => !REVIEW_LESSONS.has(ln)
    );
    const reviews = SECTION_REVIEW_LESSONS[name as SkillSectionName] ?? [];

    // Gateway check: all reviews assigned AND all passed → 100%
    if (reviews.length > 0) {
      const allAssigned = reviews.every((ln) => attempted.has(ln));
      const allPassed = reviews.every((ln) => marks.has(ln));
      if (allAssigned && allPassed) {
        result.push({
          name,
          totalLessons: nonReview.length,
          passedLessons: nonReview.length,
          pct: 100,
        });
        continue;
      }
    }

    // Fallback: non-review mastery only
    const passed = nonReview.filter((ln) => marks.has(ln)).length;
    const total = nonReview.length || 1;
    result.push({
      name,
      totalLessons: total,
      passedLessons: passed,
      pct: (passed / total) * 100,
    });
  }
  return result;
}

function computeRecentActivity(
  rows: RawProgressRow[],
  limit: number,
): RecentActivityRow[] {
  return rows.slice(0, limit).map((r) => ({
    lessonId: r.lesson_id,
    lessonNumber: r.ufli_lessons?.lesson_number ?? 0,
    lessonName: r.ufli_lessons?.lesson_name ?? null,
    status: r.status,
    dateRecorded: r.date_recorded,
    isReview: r.ufli_lessons?.is_review ?? false,
  }));
}

function computeAttendance(
  rows: RawProgressRow[],
  windowDays: number,
): AttendanceSummary {
  const today = new Date();
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowStartIso = windowStart.toISOString().split("T")[0];

  let total = 0;
  let absent = 0;
  for (const r of rows) {
    if (r.date_recorded < windowStartIso) continue;
    total++;
    if (r.status === "A") absent++;
  }

  return {
    totalEntries: total,
    presentEntries: total - absent,
    absentEntries: absent,
    attendancePct: total > 0 ? ((total - absent) / total) * 100 : null,
  };
}

// ── Current group + sequence (separate query) ────────────────────────────

async function fetchCurrentGroup(
  studentId: number,
): Promise<CurrentGroupInfo | null> {
  const supabase = await createClient();

  // Find the active membership
  const { data: memberships } = await supabase
    .from("group_memberships")
    .select(
      "group_id, instructional_groups(group_id, group_name, staff_id, staff(first_name, last_name))",
    )
    .eq("student_id", studentId)
    .eq("is_active", true)
    .limit(1);

  if (!memberships || memberships.length === 0) return null;

  const m = memberships[0] as unknown as {
    group_id: number;
    instructional_groups: {
      group_id: number;
      group_name: string;
      staff_id: number;
      staff: { first_name: string; last_name: string } | null;
    } | null;
  };
  if (!m.instructional_groups) return null;

  // Find the active sequence + current lesson for this group
  const { data: seq } = await supabase
    .from("instructional_sequences")
    .select("sequence_id, name")
    .eq("group_id", m.group_id)
    .eq("status", "active")
    .maybeSingle();

  let currentLessonNumber: number | null = null;
  let currentLessonName: string | null = null;
  let totalSequenceLessons = 0;
  let completedSequenceLessons = 0;

  if (seq) {
    const seqRow = seq as { sequence_id: number; name: string };
    const { data: lessons } = await supabase
      .from("instructional_sequence_lessons")
      .select("status, ufli_lessons(lesson_number, lesson_name)")
      .eq("sequence_id", seqRow.sequence_id);

    for (const l of lessons ?? []) {
      const row = l as unknown as {
        status: "upcoming" | "current" | "completed" | "skipped";
        ufli_lessons: { lesson_number: number; lesson_name: string | null } | null;
      };
      totalSequenceLessons++;
      if (row.status === "completed") completedSequenceLessons++;
      if (row.status === "current") {
        currentLessonNumber = row.ufli_lessons?.lesson_number ?? null;
        currentLessonName = row.ufli_lessons?.lesson_name ?? null;
      }
    }

    return {
      groupId: m.instructional_groups.group_id,
      groupName: m.instructional_groups.group_name,
      staffName: `${m.instructional_groups.staff?.first_name ?? ""} ${
        m.instructional_groups.staff?.last_name ?? ""
      }`.trim(),
      staffId: m.instructional_groups.staff_id,
      sequenceId: seqRow.sequence_id,
      sequenceName: seqRow.name,
      currentLessonNumber,
      currentLessonName,
      totalSequenceLessons,
      completedSequenceLessons,
    };
  }

  return {
    groupId: m.instructional_groups.group_id,
    groupName: m.instructional_groups.group_name,
    staffName: `${m.instructional_groups.staff?.first_name ?? ""} ${
      m.instructional_groups.staff?.last_name ?? ""
    }`.trim(),
    staffId: m.instructional_groups.staff_id,
    sequenceId: null,
    sequenceName: null,
    currentLessonNumber: null,
    currentLessonName: null,
    totalSequenceLessons: 0,
    completedSequenceLessons: 0,
  };
}
