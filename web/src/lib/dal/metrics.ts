/**
 * @file dal/metrics.ts — Big Four metrics for the dashboard home page
 *
 * Per D-006: the analytical framework carries forward unchanged. Definitions
 * are used in funder communications and must not drift. Each function here
 * computes one of the four canonical metrics:
 *
 *   1. getFoundationalSkillsPct  — L1-L34 mastery, denominator 34
 *   2. getMinGradeSkillsPct      — MTSS, grade-specific denominator
 *   3. getCurrentYearGoalProgress — this year's curriculum, excluding reviews
 *   4. getGrowthSlope4Week       — 4-week rolling pace vs expected
 *
 * Per D-012 (Equity of Visibility, non-negotiable): 'A' (absent) values
 * are excluded from slope calculations entirely. They are NOT counted as
 * zeros. Specifically: a student with N absences in the slope window has
 * their expected denominator reduced by N (not their actual numerator).
 *
 * High-water-mark semantics: a lesson counts as "passed" once a student
 * has ever earned a Y for it. A subsequent N (e.g. on a reteach where
 * they had a bad day) does not undo the high-water mark. For the
 * 4-week growth slope specifically, only NEW first-time-Y events
 * inside the window count as growth — re-passes of previously-passed
 * lessons do not.
 *
 * @rls School-scoping enforced by explicit schoolId from JWT claims.
 */

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  FOUNDATIONAL_RANGE,
  MIN_GRADE_SKILLS_DENOMINATOR,
  CURRENT_YEAR_GOAL_DENOMINATOR,
  TARGET_LESSONS_PER_WEEK,
  GROWTH_SLOPE_WEEKS,
  REVIEW_LESSONS,
} from "@/config/ufli";

// ── Types ────────────────────────────────────────────────────────────────

export interface PercentageMetric {
  /** 0-100 percentage; null if no eligible students */
  percentage: number | null;
  /** Number of active students that contributed to the average */
  studentCount: number;
}

export interface SlopeMetric {
  /** % of active students whose slope is ≥ ON_PACE threshold */
  onPacePercentage: number | null;
  /** Count of students at or above ON_PACE */
  onPaceCount: number;
  /** Total active students with sequence + non-presence-flagged */
  evaluableStudentCount: number;
  /** Students flagged as presence concern (chronic absences in window) */
  presenceConcernCount: number;
}

// ── Internal helpers ─────────────────────────────────────────────────────

interface StudentLessonRow {
  student_id: number;
  lesson_id: number;
  status: "Y" | "N" | "A";
  date_recorded: string;
  ufli_lessons: { lesson_number: number } | null;
}

interface ActiveStudentRow {
  student_id: number;
  grade_id: number;
  grade_levels: { name: string } | null;
}

/**
 * Returns active students for a school with their grade name. Used as
 * the population denominator for all four metrics.
 */
async function listActiveStudentsWithGrade(
  schoolId: number,
): Promise<{ studentId: number; gradeName: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("student_id, grade_id, grade_levels(name)")
    .eq("school_id", schoolId)
    .eq("enrollment_status", "active");

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as unknown as ActiveStudentRow;
    return {
      studentId: row.student_id,
      gradeName: row.grade_levels?.name ?? "",
    };
  });
}

/**
 * Returns all lesson_progress rows for the given students in the given
 * year, with the joined ufli_lessons.lesson_number for filtering by range.
 * One round-trip; the caller filters in JS.
 */
async function listAllProgress(
  studentIds: number[],
  yearId: number,
): Promise<StudentLessonRow[]> {
  if (studentIds.length === 0) return [];
  const supabase = await createClient();
  // Paginated: 500 students × 128 lessons = 64K+ rows at scale.
  return fetchAllRows<StudentLessonRow>((from, to) =>
    supabase
      .from("lesson_progress")
      .select("student_id, lesson_id, status, date_recorded, ufli_lessons(lesson_number)")
      .in("student_id", studentIds)
      .eq("year_id", yearId)
      .range(from, to),
  );
}

/**
 * For each (student_id, lesson_number) pair, returns 1 if the student
 * has EVER passed that lesson (any Y row), 0 otherwise. Implements the
 * high-water-mark rule.
 */
function buildHighWaterMarks(
  rows: StudentLessonRow[],
): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  for (const r of rows) {
    if (r.status !== "Y") continue;
    const lessonNumber = r.ufli_lessons?.lesson_number;
    if (!lessonNumber) continue;
    if (!map.has(r.student_id)) map.set(r.student_id, new Set());
    map.get(r.student_id)!.add(lessonNumber);
  }
  return map;
}

/**
 * Counts lessons in `lessonNumbers` that the student has high-water-marked.
 */
function countMastered(
  studentId: number,
  highWaterMarks: Map<number, Set<number>>,
  lessonNumbers: readonly number[],
): number {
  const studentMarks = highWaterMarks.get(studentId);
  if (!studentMarks) return 0;
  let n = 0;
  for (const lessonNumber of lessonNumbers) {
    if (studentMarks.has(lessonNumber)) n++;
  }
  return n;
}

// ── Metric 1: Foundational Skills % (L1-L34) ─────────────────────────────

/**
 * Average % of foundational skills mastered across active students.
 * Denominator: 34 (lessons L1-L34).
 *
 * @rls schoolId scoping is explicit.
 */
export async function getFoundationalSkillsPct(
  schoolId: number,
  yearId: number,
): Promise<PercentageMetric> {
  const students = await listActiveStudentsWithGrade(schoolId);
  if (students.length === 0) {
    return { percentage: null, studentCount: 0 };
  }

  const progress = await listAllProgress(
    students.map((s) => s.studentId),
    yearId,
  );
  const highWater = buildHighWaterMarks(progress);

  const foundationalLessons: number[] = [];
  for (let n = FOUNDATIONAL_RANGE.start; n <= FOUNDATIONAL_RANGE.end; n++) {
    foundationalLessons.push(n);
  }
  const denom = foundationalLessons.length; // 34

  let sum = 0;
  for (const s of students) {
    const passed = countMastered(s.studentId, highWater, foundationalLessons);
    sum += (passed / denom) * 100;
  }

  return {
    percentage: sum / students.length,
    studentCount: students.length,
  };
}

// ── Metric 2: Min Grade Skills % (grade-specific denominator) ────────────

/**
 * Average % of minimum-grade skills mastered across active students.
 * Each student's denominator is their grade-specific cap (KG=34, G1=57,
 * G2=67, G3+=107) and their numerator is the count of L1-cap lessons
 * they've ever passed (high-water mark).
 */
export async function getMinGradeSkillsPct(
  schoolId: number,
  yearId: number,
): Promise<PercentageMetric> {
  const students = await listActiveStudentsWithGrade(schoolId);
  if (students.length === 0) {
    return { percentage: null, studentCount: 0 };
  }

  const progress = await listAllProgress(
    students.map((s) => s.studentId),
    yearId,
  );
  const highWater = buildHighWaterMarks(progress);

  let sum = 0;
  let evaluable = 0;
  for (const s of students) {
    const denom = MIN_GRADE_SKILLS_DENOMINATOR[s.gradeName];
    if (!denom || denom === 0) continue;

    const lessonsInRange: number[] = [];
    for (let n = 1; n <= denom; n++) {
      if (!REVIEW_LESSONS.has(n)) lessonsInRange.push(n);
    }

    const passed = countMastered(s.studentId, highWater, lessonsInRange);
    sum += (passed / lessonsInRange.length) * 100;
    evaluable++;
  }

  return {
    percentage: evaluable > 0 ? sum / evaluable : null,
    studentCount: evaluable,
  };
}

// ── Metric 3: Current Year Goal Progress ─────────────────────────────────

/**
 * Average % of this year's goal lessons mastered, EXCLUDING review
 * lessons. Per-grade denominator: KG=34, G1=23, G2=18, G3+=107.
 *
 * Conceptually: "of the lessons we set out to teach this grade THIS year,
 * how many has the average student mastered?"
 *
 * The lessons in scope are the FIRST `denom` non-review lessons, in
 * lesson_number order. (E.g. for G2 with denom=18, that's the first
 * 18 non-review lessons starting from L1.) Reviews are excluded
 * because the spec says so.
 */
export async function getCurrentYearGoalProgress(
  schoolId: number,
  yearId: number,
): Promise<PercentageMetric> {
  const students = await listActiveStudentsWithGrade(schoolId);
  if (students.length === 0) {
    return { percentage: null, studentCount: 0 };
  }

  const progress = await listAllProgress(
    students.map((s) => s.studentId),
    yearId,
  );
  const highWater = buildHighWaterMarks(progress);

  // Per-grade lesson set: first N non-review lessons by number
  const lessonSetByGrade = new Map<string, number[]>();
  for (const grade of Object.keys(CURRENT_YEAR_GOAL_DENOMINATOR)) {
    const target = CURRENT_YEAR_GOAL_DENOMINATOR[grade];
    const set: number[] = [];
    let n = 1;
    while (set.length < target && n <= 128) {
      if (!REVIEW_LESSONS.has(n)) set.push(n);
      n++;
    }
    lessonSetByGrade.set(grade, set);
  }

  let sum = 0;
  let evaluable = 0;
  for (const s of students) {
    const lessons = lessonSetByGrade.get(s.gradeName);
    if (!lessons || lessons.length === 0) continue;

    const passed = countMastered(s.studentId, highWater, lessons);
    sum += (passed / lessons.length) * 100;
    evaluable++;
  }

  return {
    percentage: evaluable > 0 ? sum / evaluable : null,
    studentCount: evaluable,
  };
}

// ── Metric 4: Student Growth vs. Expected Slope (4-Week Rolling) ─────────

/**
 * 4-week rolling growth slope per student, then aggregated as the
 * percentage of students at or above the on-pace threshold.
 *
 * For each active student:
 *   1. Look at lesson_progress rows in the last 28 days
 *   2. NEW growth = count of lessons whose FIRST Y date falls in the window
 *      (a Y on a lesson that was already passed before the window doesn't
 *      count — that's a reteach high-water-mark preservation, not growth)
 *   3. Absences = count of A rows in the window (any lesson)
 *   4. Expected = TARGET_LESSONS_PER_WEEK × GROWTH_SLOPE_WEEKS = 8
 *   5. Adjusted expected = max(expected − absences, 1)
 *   6. slope = new_growth / adjusted_expected
 *   7. If absences ≥ expected → presence concern (slope is null/excluded)
 *
 * Output: % of evaluable students with slope ≥ ON_PACE threshold.
 *
 * @rls schoolId scoping is explicit.
 */
export async function getGrowthSlope4Week(
  schoolId: number,
  yearId: number,
): Promise<SlopeMetric> {
  const students = await listActiveStudentsWithGrade(schoolId);
  if (students.length === 0) {
    return {
      onPacePercentage: null,
      onPaceCount: 0,
      evaluableStudentCount: 0,
      presenceConcernCount: 0,
    };
  }

  // Window boundaries
  const windowDays = GROWTH_SLOPE_WEEKS * 7;
  const today = new Date();
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowStartIso = windowStart.toISOString().split("T")[0];

  // Pull all progress rows for the year — we need both in-window data
  // (for new-growth + absence count) and pre-window data (to know which
  // lessons were already high-water-marked before the window started).
  const studentIds = students.map((s) => s.studentId);
  const allProgress = await listAllProgress(studentIds, yearId);

  // Per student: build (a) the set of lessons passed BEFORE the window
  // and (b) the count of NEW first-Y events inside the window and (c)
  // the absence count inside the window.
  interface PerStudent {
    passedBeforeWindow: Set<number>;
    newGrowth: Set<number>;
    absences: number;
  }
  const perStudent = new Map<number, PerStudent>();
  for (const s of students) {
    perStudent.set(s.studentId, {
      passedBeforeWindow: new Set(),
      newGrowth: new Set(),
      absences: 0,
    });
  }

  // First pass: anything BEFORE the window goes into passedBeforeWindow.
  for (const r of allProgress) {
    if (r.status !== "Y") continue;
    if (r.date_recorded >= windowStartIso) continue;
    const lessonNumber = r.ufli_lessons?.lesson_number;
    if (!lessonNumber) continue;
    perStudent.get(r.student_id)?.passedBeforeWindow.add(lessonNumber);
  }

  // Second pass: count Ys inside the window where the lesson wasn't
  // already passed before the window. Also count As in the window.
  for (const r of allProgress) {
    if (r.date_recorded < windowStartIso) continue;
    const ps = perStudent.get(r.student_id);
    if (!ps) continue;
    const lessonNumber = r.ufli_lessons?.lesson_number;

    if (r.status === "A") {
      ps.absences++;
      continue;
    }
    if (r.status === "Y" && lessonNumber) {
      if (!ps.passedBeforeWindow.has(lessonNumber)) {
        ps.newGrowth.add(lessonNumber);
      }
    }
  }

  const expected = TARGET_LESSONS_PER_WEEK * GROWTH_SLOPE_WEEKS; // 8

  let onPaceCount = 0;
  let evaluable = 0;
  let presenceConcernCount = 0;

  for (const s of students) {
    const ps = perStudent.get(s.studentId);
    if (!ps) continue;

    const adjustedExpected = expected - ps.absences;
    if (adjustedExpected <= 0) {
      // Student was effectively absent the entire window; flag presence
      // concern and exclude from the slope average.
      presenceConcernCount++;
      continue;
    }

    const slope = ps.newGrowth.size / adjustedExpected;
    evaluable++;
    if (slope >= 0.85) onPaceCount++;
  }

  return {
    onPacePercentage:
      evaluable > 0 ? (onPaceCount / evaluable) * 100 : null,
    onPaceCount,
    evaluableStudentCount: evaluable,
    presenceConcernCount,
  };
}

// ── Per-Grade Breakdown ─────────────────────────────────────────────────

export interface GradeMetricRow {
  gradeName: string;
  studentCount: number;
  foundationalPct: number | null;
  minGradePct: number | null;
  currentYearGoalPct: number | null;
  onPacePct: number | null;
  onPaceCount: number;
  evaluableCount: number;
  presenceConcernCount: number;
}

/**
 * Computes all four Big Four metrics broken down by grade. Single pass
 * over the data: fetches students + progress once, then groups by grade
 * and computes all metrics per-grade in memory.
 *
 * Used by the /dashboard/big-four detail page.
 */
export async function getBigFourByGrade(
  schoolId: number,
  yearId: number,
): Promise<GradeMetricRow[]> {
  const students = await listActiveStudentsWithGrade(schoolId);
  if (students.length === 0) return [];

  const allProgress = await listAllProgress(
    students.map((s) => s.studentId),
    yearId,
  );
  const highWater = buildHighWaterMarks(allProgress);

  // Pre-compute foundational lesson range
  const foundationalLessons: number[] = [];
  for (let n = FOUNDATIONAL_RANGE.start; n <= FOUNDATIONAL_RANGE.end; n++) {
    foundationalLessons.push(n);
  }

  // Pre-compute per-grade lesson sets for current year goal
  const yearGoalByGrade = new Map<string, number[]>();
  for (const grade of Object.keys(CURRENT_YEAR_GOAL_DENOMINATOR)) {
    const target = CURRENT_YEAR_GOAL_DENOMINATOR[grade];
    const set: number[] = [];
    let n = 1;
    while (set.length < target && n <= 128) {
      if (!REVIEW_LESSONS.has(n)) set.push(n);
      n++;
    }
    yearGoalByGrade.set(grade, set);
  }

  // Growth slope: window boundaries
  const windowDays = GROWTH_SLOPE_WEEKS * 7;
  const today = new Date();
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowStartIso = windowStart.toISOString().split("T")[0];

  // Build per-student slope data
  interface SlopeData {
    passedBeforeWindow: Set<number>;
    newGrowth: Set<number>;
    absences: number;
  }
  const slopeData = new Map<number, SlopeData>();
  for (const s of students) {
    slopeData.set(s.studentId, {
      passedBeforeWindow: new Set(),
      newGrowth: new Set(),
      absences: 0,
    });
  }
  for (const r of allProgress) {
    if (r.status === "Y" && r.date_recorded < windowStartIso) {
      const ln = r.ufli_lessons?.lesson_number;
      if (ln) slopeData.get(r.student_id)?.passedBeforeWindow.add(ln);
    }
  }
  for (const r of allProgress) {
    if (r.date_recorded < windowStartIso) continue;
    const ps = slopeData.get(r.student_id);
    if (!ps) continue;
    if (r.status === "A") {
      ps.absences++;
    } else if (r.status === "Y") {
      const ln = r.ufli_lessons?.lesson_number;
      if (ln && !ps.passedBeforeWindow.has(ln)) ps.newGrowth.add(ln);
    }
  }

  const expected = TARGET_LESSONS_PER_WEEK * GROWTH_SLOPE_WEEKS;

  // Group students by grade
  const byGrade = new Map<
    string,
    { studentId: number; gradeName: string }[]
  >();
  for (const s of students) {
    const arr = byGrade.get(s.gradeName) ?? [];
    arr.push(s);
    byGrade.set(s.gradeName, arr);
  }

  // Compute per-grade
  const rows: GradeMetricRow[] = [];
  for (const [gradeName, gradeStudents] of byGrade.entries()) {
    // Foundational
    let foundSum = 0;
    for (const s of gradeStudents) {
      const passed = countMastered(s.studentId, highWater, foundationalLessons);
      foundSum += (passed / foundationalLessons.length) * 100;
    }
    const foundationalPct = gradeStudents.length > 0
      ? foundSum / gradeStudents.length
      : null;

    // Min Grade
    const minDenom = MIN_GRADE_SKILLS_DENOMINATOR[gradeName];
    let minGradePct: number | null = null;
    if (minDenom && minDenom > 0) {
      const lessonsInRange: number[] = [];
      for (let n = 1; n <= minDenom; n++) {
        if (!REVIEW_LESSONS.has(n)) lessonsInRange.push(n);
      }
      let minSum = 0;
      for (const s of gradeStudents) {
        const passed = countMastered(s.studentId, highWater, lessonsInRange);
        minSum += (passed / lessonsInRange.length) * 100;
      }
      minGradePct = gradeStudents.length > 0 ? minSum / gradeStudents.length : null;
    }

    // Current Year Goal
    const yearLessons = yearGoalByGrade.get(gradeName);
    let currentYearGoalPct: number | null = null;
    if (yearLessons && yearLessons.length > 0) {
      let yearSum = 0;
      for (const s of gradeStudents) {
        const passed = countMastered(s.studentId, highWater, yearLessons);
        yearSum += (passed / yearLessons.length) * 100;
      }
      currentYearGoalPct = gradeStudents.length > 0
        ? yearSum / gradeStudents.length
        : null;
    }

    // Growth Slope
    let onPaceCount = 0;
    let evaluableCount = 0;
    let presenceConcernCount = 0;
    for (const s of gradeStudents) {
      const ps = slopeData.get(s.studentId);
      if (!ps) continue;
      const adjustedExpected = expected - ps.absences;
      if (adjustedExpected <= 0) {
        presenceConcernCount++;
        continue;
      }
      evaluableCount++;
      if (ps.newGrowth.size / adjustedExpected >= 0.85) onPaceCount++;
    }

    rows.push({
      gradeName,
      studentCount: gradeStudents.length,
      foundationalPct,
      minGradePct,
      currentYearGoalPct,
      onPacePct: evaluableCount > 0 ? (onPaceCount / evaluableCount) * 100 : null,
      onPaceCount,
      evaluableCount,
      presenceConcernCount,
    });
  }

  // Sort by grade name (KG first, then G1, G2, ...)
  rows.sort((a, b) => {
    if (a.gradeName === "KG") return -1;
    if (b.gradeName === "KG") return 1;
    return a.gradeName.localeCompare(b.gradeName);
  });

  return rows;
}

// ── Aggregator ───────────────────────────────────────────────────────────

export interface BigFourMetrics {
  foundational: PercentageMetric;
  minGrade: PercentageMetric;
  currentYearGoal: PercentageMetric;
  growthSlope: SlopeMetric;
}

/**
 * Computes all four metrics for a school + year. Internally each metric
 * runs its own query; this function parallelizes them via Promise.all.
 */
export async function getBigFourMetrics(
  schoolId: number,
  yearId: number,
): Promise<BigFourMetrics> {
  const [foundational, minGrade, currentYearGoal, growthSlope] =
    await Promise.all([
      getFoundationalSkillsPct(schoolId, yearId),
      getMinGradeSkillsPct(schoolId, yearId),
      getCurrentYearGoalProgress(schoolId, yearId),
      getGrowthSlope4Week(schoolId, yearId),
    ]);

  return { foundational, minGrade, currentYearGoal, growthSlope };
}
