/**
 * @file dal/bands.ts — Band Assignment capture + query (Phase D.1)
 *
 * DAL surface for the Banding Engine. Two primary flows:
 *
 *   captureBandAssignments(schoolId, yearId, assignedDate?)
 *     — Walks every active student in the school, runs the Banding
 *       Engine against their full-year Y lesson set + grade, compares
 *       to the previous week's assignment to classify movement, and
 *       upserts into band_assignments. Idempotent per the unique
 *       constraint (student_id, year_id, assigned_date).
 *
 *   getLatestBandAssignment(studentId, yearId)
 *   getSchoolBandSummary(schoolId, yearId)
 *     — Read paths for the /dashboard/bands page and the student
 *       detail page.
 *
 * Assignment dates are always the Friday of the week the engine ran
 * (Section 5.3 cadence). If the caller doesn't pass an assignedDate,
 * the capture function uses the most recent Friday (today if today is
 * Friday, otherwise the previous Friday).
 */

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  assignBand,
  classifyMovement,
  ARCHETYPE_META,
  type BandLevel,
  type StudentArchetype,
  type BandMovement,
  type ProfileVector,
} from "@/lib/banding/engine";
import { computeGatewayState } from "@/lib/curriculum/sections";

// ── Types ────────────────────────────────────────────────────────────────

export interface BandAssignmentRow {
  bandAssignmentId: number;
  studentId: number;
  yearId: number;
  assignedDate: string;
  band: BandLevel;
  archetype: StudentArchetype;
  movement: BandMovement;
  gradeName: string | null;
  ceilingSection: string | null;
  ceilingLessonNumber: number | null;
  swissCheeseGapCount: number;
  profileVector: ProfileVector;
  createdAt: string;
}

export interface BandCaptureResult {
  assignedDate: string;
  studentsProcessed: number;
  assignmentsWritten: number;
  bandCounts: Record<BandLevel, number>;
  archetypeCounts: Record<StudentArchetype, number>;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Returns today's date if today is a Friday, otherwise the most recent
 * past Friday. Section 5.3 specifies Friday cadence.
 */
export function mostRecentFriday(today: Date = new Date()): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun, 5 = Fri
  const delta = (day - 5 + 7) % 7;
  d.setDate(d.getDate() - delta);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ── Capture composer ────────────────────────────────────────────────────

/**
 * Runs the Banding Engine for every active student in the school and
 * upserts one row per student into band_assignments for the given Friday.
 *
 * Dataset loaded in parallel:
 *   - active students with their grade (joined via grade_levels)
 *   - all full-year Y lesson_progress rows for those students
 *   - the prior week's band_assignments (for movement classification)
 */
export async function captureBandAssignments(
  schoolId: number,
  yearId: number,
  assignedDateOverride?: string,
): Promise<BandCaptureResult> {
  const supabase = await createClient();

  const assignedDate =
    assignedDateOverride ?? isoDate(mostRecentFriday());

  // Compute the "previous week" Friday as assignedDate - 7 days
  const prevFriday = (() => {
    const d = new Date(assignedDate);
    d.setDate(d.getDate() - 7);
    return isoDate(d);
  })();

  // 1. Active students + grade
  const { data: studentRows } = await supabase
    .from("students")
    .select("student_id, grade_levels!grade_id(name)")
    .eq("school_id", schoolId)
    .eq("enrollment_status", "active");

  type StudentRow = {
    student_id: number;
    grade_levels: { name: string } | null;
  };
  const students = ((studentRows ?? []) as unknown as StudentRow[]).map((r) => ({
    studentId: r.student_id,
    gradeName: r.grade_levels?.name ?? null,
  }));

  if (students.length === 0) {
    return {
      assignedDate,
      studentsProcessed: 0,
      assignmentsWritten: 0,
      bandCounts: makeEmptyBandCounts(),
      archetypeCounts: makeEmptyArchetypeCounts(),
    };
  }

  const studentIds = students.map((s) => s.studentId);

  // 2. Passed (Y) lesson numbers across the full year for each student
  // (high-water-mark set — any Y ever = passed forever)
  // 3. Previous week's band assignments (for movement classification)
  // 4. Attempted review lessons (Y or N status, is_review=true) for gateway checks
  //
  // Queries 2 and 4 are paginated (500 students × 128 lessons = 64K+ rows).
  type LessonProgressRow = { student_id: number; ufli_lessons: { lesson_number: number } | null };
  const [progressRowsAll, prevAssignmentsRaw, attemptedReviewRowsAll] = await Promise.all([
    fetchAllRows<LessonProgressRow>((from, to) =>
      supabase
        .from("lesson_progress")
        .select("student_id, ufli_lessons!inner(lesson_number)")
        .in("student_id", studentIds)
        .eq("year_id", yearId)
        .eq("status", "Y")
        .range(from, to),
    ),
    supabase
      .from("band_assignments")
      .select("student_id, band")
      .in("student_id", studentIds)
      .eq("year_id", yearId)
      .eq("assigned_date", prevFriday),
    fetchAllRows<LessonProgressRow>((from, to) =>
      supabase
        .from("lesson_progress")
        .select("student_id, ufli_lessons!inner(lesson_number)")
        .in("student_id", studentIds)
        .eq("year_id", yearId)
        .in("status", ["Y", "N"])
        .eq("ufli_lessons.is_review", true)
        .range(from, to),
    ),
  ]);

  const passedByStudent = new Map<number, Set<number>>();
  for (const r of progressRowsAll) {
    if (!r.ufli_lessons) continue;
    let set = passedByStudent.get(r.student_id);
    if (!set) {
      set = new Set<number>();
      passedByStudent.set(r.student_id, set);
    }
    set.add(r.ufli_lessons.lesson_number);
  }

  const prevBandByStudent = new Map<number, BandLevel>();
  for (const row of prevAssignmentsRaw.data ?? []) {
    const r = row as { student_id: number; band: BandLevel };
    prevBandByStudent.set(r.student_id, r.band);
  }

  // Build map of reviewed (Y or N) lesson numbers per student (for gateway checks)
  const attemptedByStudent = new Map<number, Set<number>>();
  for (const r of attemptedReviewRowsAll) {
    if (!r.ufli_lessons) continue;
    let set = attemptedByStudent.get(r.student_id);
    if (!set) {
      set = new Set<number>();
      attemptedByStudent.set(r.student_id, set);
    }
    set.add(r.ufli_lessons.lesson_number);
  }

  // 4. Run the engine per student and build upsert rows
  const rows: Array<{
    student_id: number;
    year_id: number;
    assigned_date: string;
    band: BandLevel;
    archetype: StudentArchetype;
    movement: BandMovement;
    grade_name: string | null;
    ceiling_section: string | null;
    ceiling_lesson_number: number | null;
    swiss_cheese_gap_count: number;
    profile_vector: ProfileVector;
  }> = [];

  const bandCounts = makeEmptyBandCounts();
  const archetypeCounts = makeEmptyArchetypeCounts();

  for (const student of students) {
    const passed = passedByStudent.get(student.studentId) ?? new Set<number>();
    const attempted = attemptedByStudent.get(student.studentId) ?? new Set<number>();
    const gatewayState = computeGatewayState(passed, attempted);
    const result = assignBand(passed, student.gradeName, gatewayState);

    const prev = prevBandByStudent.get(student.studentId) ?? null;
    const movement = classifyMovement(result.band, prev, false);

    rows.push({
      student_id: student.studentId,
      year_id: yearId,
      assigned_date: assignedDate,
      band: result.band,
      archetype: result.archetype,
      movement,
      grade_name: student.gradeName,
      ceiling_section: result.ceilingSection,
      ceiling_lesson_number: result.ceilingLessonNumber,
      swiss_cheese_gap_count: result.swissCheeseGapCount,
      profile_vector: result.profileVector,
    });

    bandCounts[result.band]++;
    archetypeCounts[result.archetype]++;
  }

  // 5. Upsert in one batch
  if (rows.length > 0) {
    const { error } = await supabase
      .from("band_assignments")
      .upsert(rows, { onConflict: "student_id,year_id,assigned_date" });
    if (error) {
      throw new Error(`Failed to upsert band_assignments: ${error.message}`);
    }
  }

  return {
    assignedDate,
    studentsProcessed: students.length,
    assignmentsWritten: rows.length,
    bandCounts,
    archetypeCounts,
  };
}

// ── Query paths ──────────────────────────────────────────────────────────

/**
 * Returns the most recent band assignment for a student, or null if
 * none exists. Used by the student detail page.
 */
export async function getLatestBandAssignment(
  studentId: number,
  yearId: number,
): Promise<BandAssignmentRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("band_assignments")
    .select(
      "band_assignment_id, student_id, year_id, assigned_date, band, archetype, movement, grade_name, ceiling_section, ceiling_lesson_number, swiss_cheese_gap_count, profile_vector, created_at",
    )
    .eq("student_id", studentId)
    .eq("year_id", yearId)
    .order("assigned_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const row = data as {
    band_assignment_id: number;
    student_id: number;
    year_id: number;
    assigned_date: string;
    band: BandLevel;
    archetype: StudentArchetype;
    movement: BandMovement;
    grade_name: string | null;
    ceiling_section: string | null;
    ceiling_lesson_number: number | null;
    swiss_cheese_gap_count: number;
    profile_vector: ProfileVector;
    created_at: string;
  };

  return {
    bandAssignmentId: row.band_assignment_id,
    studentId: row.student_id,
    yearId: row.year_id,
    assignedDate: row.assigned_date,
    band: row.band,
    archetype: row.archetype,
    movement: row.movement,
    gradeName: row.grade_name,
    ceilingSection: row.ceiling_section,
    ceilingLessonNumber: row.ceiling_lesson_number,
    swissCheeseGapCount: row.swiss_cheese_gap_count,
    profileVector: row.profile_vector,
    createdAt: row.created_at,
  };
}

export interface SchoolBandSummary {
  /** Most recent assigned_date on file for the school */
  latestAssignedDate: string | null;
  /** Total active students */
  totalStudents: number;
  /** Students with an assignment for latestAssignedDate */
  studentsAssigned: number;
  /** Band counts at the latest assignment */
  bandCounts: Record<BandLevel, number>;
  /** Archetype counts at the latest assignment */
  archetypeCounts: Record<StudentArchetype, number>;
  /** Movement counts since the prior week */
  movementCounts: Record<BandMovement, number>;
  /** Students flagged for gap-fill: high gap count + advanced archetype */
  gapFillFlagCount: number;
  /** Top students by gap count (for drill-down) */
  topGapStudents: Array<{
    studentId: number;
    studentName: string;
    band: BandLevel;
    archetype: StudentArchetype;
    gapCount: number;
  }>;
}

/**
 * Returns the school-wide rollup for /dashboard/bands: distribution of
 * bands and archetypes at the latest assigned_date, plus movement
 * counts and a top-N gap students list.
 */
export async function getSchoolBandSummary(
  schoolId: number,
  yearId: number,
): Promise<SchoolBandSummary> {
  const supabase = await createClient();

  // Total active students
  const { count: totalStudents } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("enrollment_status", "active");

  // Get the in-scope student ids so we can filter band_assignments
  const { data: studentRows } = await supabase
    .from("students")
    .select("student_id, first_name, last_name")
    .eq("school_id", schoolId)
    .eq("enrollment_status", "active");

  type StudentLookup = {
    student_id: number;
    first_name: string;
    last_name: string;
  };
  const studentLookup = new Map<number, string>();
  const studentIds: number[] = [];
  for (const row of (studentRows ?? []) as StudentLookup[]) {
    studentIds.push(row.student_id);
    studentLookup.set(
      row.student_id,
      `${row.first_name} ${row.last_name}`.trim(),
    );
  }

  if (studentIds.length === 0) {
    return {
      latestAssignedDate: null,
      totalStudents: totalStudents ?? 0,
      studentsAssigned: 0,
      bandCounts: makeEmptyBandCounts(),
      archetypeCounts: makeEmptyArchetypeCounts(),
      movementCounts: makeEmptyMovementCounts(),
      gapFillFlagCount: 0,
      topGapStudents: [],
    };
  }

  // Find the latest assigned_date
  const { data: latestRow } = await supabase
    .from("band_assignments")
    .select("assigned_date")
    .in("student_id", studentIds)
    .eq("year_id", yearId)
    .order("assigned_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestDate = (latestRow as { assigned_date: string } | null)
    ?.assigned_date ?? null;

  if (!latestDate) {
    return {
      latestAssignedDate: null,
      totalStudents: totalStudents ?? 0,
      studentsAssigned: 0,
      bandCounts: makeEmptyBandCounts(),
      archetypeCounts: makeEmptyArchetypeCounts(),
      movementCounts: makeEmptyMovementCounts(),
      gapFillFlagCount: 0,
      topGapStudents: [],
    };
  }

  // Pull all assignments at the latest date
  const { data: assignmentRows } = await supabase
    .from("band_assignments")
    .select(
      "student_id, band, archetype, movement, swiss_cheese_gap_count",
    )
    .in("student_id", studentIds)
    .eq("year_id", yearId)
    .eq("assigned_date", latestDate);

  const bandCounts = makeEmptyBandCounts();
  const archetypeCounts = makeEmptyArchetypeCounts();
  const movementCounts = makeEmptyMovementCounts();
  let gapFillFlagCount = 0;
  const topGapRows: Array<{
    studentId: number;
    studentName: string;
    band: BandLevel;
    archetype: StudentArchetype;
    gapCount: number;
  }> = [];

  const assignments = (assignmentRows ?? []) as Array<{
    student_id: number;
    band: BandLevel;
    archetype: StudentArchetype;
    movement: BandMovement;
    swiss_cheese_gap_count: number;
  }>;

  for (const a of assignments) {
    bandCounts[a.band]++;
    archetypeCounts[a.archetype]++;
    movementCounts[a.movement]++;
    // Gap-fill flag: advanced archetype + high gap count (>=20 gaps)
    if (
      (a.archetype === "advanced_decoding" || a.archetype === "near_proficient") &&
      a.swiss_cheese_gap_count >= 20
    ) {
      gapFillFlagCount++;
    }
    topGapRows.push({
      studentId: a.student_id,
      studentName: studentLookup.get(a.student_id) ?? `Student ${a.student_id}`,
      band: a.band,
      archetype: a.archetype,
      gapCount: a.swiss_cheese_gap_count,
    });
  }

  topGapRows.sort((a, b) => b.gapCount - a.gapCount);

  return {
    latestAssignedDate: latestDate,
    totalStudents: totalStudents ?? 0,
    studentsAssigned: assignments.length,
    bandCounts,
    archetypeCounts,
    movementCounts,
    gapFillFlagCount,
    topGapStudents: topGapRows.slice(0, 10),
  };
}

// ── Re-exports for UI consumers ──────────────────────────────────────────

export { ARCHETYPE_META };
export type { BandLevel, StudentArchetype, BandMovement, ProfileVector };

// ── Counter factories ────────────────────────────────────────────────────

function makeEmptyBandCounts(): Record<BandLevel, number> {
  return {
    not_started: 0,
    intervention: 0,
    on_track: 0,
    advanced: 0,
  };
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
