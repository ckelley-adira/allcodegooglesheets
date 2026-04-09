/**
 * @file dal/assessments.ts — Initial assessment data access layer
 *
 * Reads and writes initial assessment snapshots (baseline / semester_1_end /
 * semester_2_end), their per-lesson Y/N detail, and the diagnostic
 * component-error log. Submissions also seed lesson_progress with
 * source='assessment' so the Big Four high-water-mark logic picks up
 * baseline mastery automatically — once Y, always Y.
 *
 * @rls School-scoping enforced via the parent student's school_id +
 *      explicit schoolId parameter on every query.
 */

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  scoreAssessment,
  type SubmittedSection,
  type LessonResult,
} from "@/lib/assessment/scoring";
import { SNAPSHOT_LABELS, type SnapshotType } from "@/lib/assessment/snapshots";

// ── Types ────────────────────────────────────────────────────────────────

export { SNAPSHOT_LABELS };
export type { SnapshotType };

export interface AssessmentSummary {
  assessmentId: number;
  studentId: number;
  yearId: number;
  snapshotType: SnapshotType;
  assessmentDate: string;
  scorerId: number | null;
  scorerName: string | null;
  isKindergartenEoy: boolean;
  foundationalPct: number | null;
  kgPct: number | null;
  firstGradePct: number | null;
  secondGradePct: number | null;
  overallPct: number | null;
  notes: string | null;
  createdAt: string;
}

export interface AssessmentDetail extends AssessmentSummary {
  lessonResults: { lessonId: number; lessonNumber: number; status: "Y" | "N" }[];
  componentErrors: {
    sectionKey: string;
    sectionName: string;
    word: string;
    componentsCorrect: string;
    componentsMissed: string;
  }[];
}

export interface SubmitAssessmentInput {
  studentId: number;
  schoolId: number;
  yearId: number;
  snapshotType: SnapshotType;
  assessmentDate: string;
  scorerId: number | null;
  isKindergartenEoy: boolean;
  notes: string | null;
  sections: SubmittedSection[];
}

export interface SubmitAssessmentResult {
  assessmentId: number;
  lessonsRecorded: number;
  componentErrorsRecorded: number;
  lessonProgressRowsSeeded: number;
  metrics: {
    foundationalPct: number | null;
    kgPct: number | null;
    firstGradePct: number | null;
    secondGradePct: number | null;
    overallPct: number | null;
  };
}

// ── Queries ──────────────────────────────────────────────────────────────

export interface SchoolAssessmentRow extends AssessmentSummary {
  studentFirstName: string;
  studentLastName: string;
  gradeName: string;
}

/**
 * Lists every assessment for the school in a given year. Used by the
 * /dashboard/assessments index page so school admins can scan recent
 * baselines and end-of-semester snapshots at a glance.
 */
export async function listSchoolAssessments(
  schoolId: number,
  yearId: number,
): Promise<SchoolAssessmentRow[]> {
  const supabase = await createClient();
  // Paginated: 500 students × 3 snapshots = 1,500 rows at scale.
  type AssessmentWithStudent = RawAssessmentRow & {
    students: {
      first_name: string;
      last_name: string;
      school_id: number;
      grade_levels: { name: string } | null;
    };
  };
  const rows = await fetchAllRows<AssessmentWithStudent>((from, to) =>
    supabase
      .from("initial_assessments")
      .select(
        "assessment_id, student_id, year_id, snapshot_type, assessment_date, scorer_id, is_kindergarten_eoy, foundational_pct, kg_pct, first_grade_pct, second_grade_pct, overall_pct, notes, created_at, staff:scorer_id(first_name, last_name), students!inner(first_name, last_name, school_id, grade_levels(name))",
      )
      .eq("year_id", yearId)
      .eq("students.school_id", schoolId)
      .order("assessment_date", { ascending: false })
      .range(from, to),
  );

  return rows.map((r) => ({
    ...toAssessmentSummary(r),
    studentFirstName: r.students.first_name,
    studentLastName: r.students.last_name,
    gradeName: r.students.grade_levels?.name ?? "",
  }));
}

/**
 * Returns every assessment snapshot for a student in a given year, ordered
 * by snapshot type (baseline → S1 → S2).
 */
export async function getStudentAssessments(
  studentId: number,
  schoolId: number,
  yearId: number,
): Promise<AssessmentSummary[]> {
  const supabase = await createClient();

  // Confirm student belongs to the school (RLS would also block, but the
  // explicit check makes the failure mode clearer)
  const { data: student } = await supabase
    .from("students")
    .select("student_id")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!student) return [];

  const { data, error } = await supabase
    .from("initial_assessments")
    .select(
      "assessment_id, student_id, year_id, snapshot_type, assessment_date, scorer_id, is_kindergarten_eoy, foundational_pct, kg_pct, first_grade_pct, second_grade_pct, overall_pct, notes, created_at, staff:scorer_id(first_name, last_name)",
    )
    .eq("student_id", studentId)
    .eq("year_id", yearId);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as RawAssessmentRow[];
  return rows.map(toAssessmentSummary).sort(compareSnapshots);
}

/**
 * Returns one assessment with full lesson results + component error detail.
 */
export async function getAssessmentDetail(
  assessmentId: number,
  schoolId: number,
): Promise<AssessmentDetail | null> {
  const supabase = await createClient();

  const { data: header } = await supabase
    .from("initial_assessments")
    .select(
      "assessment_id, student_id, year_id, snapshot_type, assessment_date, scorer_id, is_kindergarten_eoy, foundational_pct, kg_pct, first_grade_pct, second_grade_pct, overall_pct, notes, created_at, staff:scorer_id(first_name, last_name), students!inner(school_id)",
    )
    .eq("assessment_id", assessmentId)
    .maybeSingle();

  if (!header) return null;
  const headerRow = header as unknown as RawAssessmentRow & {
    students: { school_id: number };
  };
  if (headerRow.students.school_id !== schoolId) return null;

  const summary = toAssessmentSummary(headerRow);

  const { data: lessonRows } = await supabase
    .from("initial_assessment_lessons")
    .select("lesson_id, status, ufli_lessons(lesson_number)")
    .eq("assessment_id", assessmentId)
    .order("lesson_id", { ascending: true });

  const lessonResults = ((lessonRows ?? []) as unknown as {
    lesson_id: number;
    status: "Y" | "N";
    ufli_lessons: { lesson_number: number } | null;
  }[]).map((r) => ({
    lessonId: r.lesson_id,
    lessonNumber: r.ufli_lessons?.lesson_number ?? 0,
    status: r.status,
  }));

  const { data: errorRows } = await supabase
    .from("assessment_component_errors")
    .select("section_key, section_name, word, components_correct, components_missed")
    .eq("assessment_id", assessmentId);

  const componentErrors = ((errorRows ?? []) as unknown as {
    section_key: string;
    section_name: string;
    word: string;
    components_correct: string;
    components_missed: string;
  }[]).map((r) => ({
    sectionKey: r.section_key,
    sectionName: r.section_name,
    word: r.word,
    componentsCorrect: r.components_correct,
    componentsMissed: r.components_missed,
  }));

  return { ...summary, lessonResults, componentErrors };
}

/**
 * Returns the latest assessment of a particular snapshot type for a student.
 * Used by the wizard to detect re-submissions.
 */
export async function getAssessmentByStudentAndSnapshot(
  studentId: number,
  yearId: number,
  snapshotType: SnapshotType,
): Promise<{ assessmentId: number; assessmentDate: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("initial_assessments")
    .select("assessment_id, assessment_date")
    .eq("student_id", studentId)
    .eq("year_id", yearId)
    .eq("snapshot_type", snapshotType)
    .maybeSingle();

  if (!data) return null;
  return {
    assessmentId: data.assessment_id,
    assessmentDate: data.assessment_date,
  };
}

// ── Mutations ────────────────────────────────────────────────────────────

/**
 * Submits a complete initial assessment. Idempotent per (student, year,
 * snapshot_type): re-submitting the same snapshot upserts the header,
 * replaces the lesson + error rows, and re-syncs the lesson_progress seed.
 *
 * Side effects:
 *   1. INSERT/UPDATE initial_assessments header
 *   2. DELETE existing initial_assessment_lessons + assessment_component_errors
 *      for this assessment, then INSERT the new sets
 *   3. UPSERT lesson_progress rows with source='assessment' so the high-water-
 *      mark Big Four picks up the baseline. Existing tutor session rows are
 *      preserved; HWM semantics still apply (a later N never undoes a Y).
 *
 * @rls Caller must validate the student belongs to schoolId before calling.
 */
export async function submitAssessment(
  input: SubmitAssessmentInput,
): Promise<SubmitAssessmentResult> {
  const supabase = await createClient();

  // 1. Score the submission in memory
  const scored = scoreAssessment(input.sections);

  // 2. Verify the student belongs to the active school
  const { data: studentRow } = await supabase
    .from("students")
    .select("student_id")
    .eq("student_id", input.studentId)
    .eq("school_id", input.schoolId)
    .maybeSingle();
  if (!studentRow) {
    throw new Error("Student not found in active school");
  }

  // 3. Upsert the header row (one per student/year/snapshot)
  const { data: upserted, error: upsertError } = await supabase
    .from("initial_assessments")
    .upsert(
      {
        student_id: input.studentId,
        year_id: input.yearId,
        snapshot_type: input.snapshotType,
        assessment_date: input.assessmentDate,
        scorer_id: input.scorerId,
        is_kindergarten_eoy: input.isKindergartenEoy,
        foundational_pct: scored.metrics.foundationalPct,
        kg_pct: scored.metrics.kgPct,
        first_grade_pct: scored.metrics.firstGradePct,
        second_grade_pct: scored.metrics.secondGradePct,
        overall_pct: scored.metrics.overallPct,
        notes: input.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,year_id,snapshot_type" },
    )
    .select("assessment_id")
    .maybeSingle();

  if (upsertError || !upserted) {
    throw new Error(upsertError?.message ?? "Failed to upsert assessment header");
  }
  const assessmentId = upserted.assessment_id as number;

  // 4. Replace the per-lesson detail (delete then insert keeps logic simple)
  await supabase
    .from("initial_assessment_lessons")
    .delete()
    .eq("assessment_id", assessmentId);

  // We need lesson_id (not lesson_number) for the FK. Pull the lookup once.
  const lessonNumbers = [...scored.lessonResults.keys()];
  const lessonNumberToId = new Map<number, number>();
  if (lessonNumbers.length > 0) {
    const { data: lessonRows, error: lookupError } = await supabase
      .from("ufli_lessons")
      .select("lesson_id, lesson_number")
      .in("lesson_number", lessonNumbers);
    if (lookupError) throw new Error(lookupError.message);
    for (const r of lessonRows ?? []) {
      lessonNumberToId.set(r.lesson_number, r.lesson_id);
    }
  }

  const lessonInsertRows: {
    assessment_id: number;
    lesson_id: number;
    status: LessonResult;
  }[] = [];
  for (const [lessonNumber, status] of scored.lessonResults.entries()) {
    const lessonId = lessonNumberToId.get(lessonNumber);
    if (!lessonId) continue;
    lessonInsertRows.push({
      assessment_id: assessmentId,
      lesson_id: lessonId,
      status,
    });
  }
  if (lessonInsertRows.length > 0) {
    const { error: insertError } = await supabase
      .from("initial_assessment_lessons")
      .insert(lessonInsertRows);
    if (insertError) throw new Error(insertError.message);
  }

  // 5. Replace the diagnostic error rows
  await supabase
    .from("assessment_component_errors")
    .delete()
    .eq("assessment_id", assessmentId);

  if (scored.componentErrors.length > 0) {
    const errorRows = scored.componentErrors.map((e) => ({
      assessment_id: assessmentId,
      section_key: e.sectionKey,
      section_name: e.sectionName,
      word: e.word,
      components_correct: e.componentsCorrect.join(", "),
      components_missed: e.componentsMissed.join(", "),
    }));
    const { error: errInsertError } = await supabase
      .from("assessment_component_errors")
      .insert(errorRows);
    if (errInsertError) throw new Error(errInsertError.message);
  }

  // 6. Seed lesson_progress with source='assessment' so HWM picks it up.
  // Look up the student's current active group (if any) to set group_id.
  const { data: membership } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("student_id", input.studentId)
    .eq("is_active", true)
    .maybeSingle();
  const groupId = membership?.group_id ?? null;

  let lessonProgressRowsSeeded = 0;
  if (lessonInsertRows.length > 0) {
    const progressRows = lessonInsertRows.map((r) => ({
      student_id: input.studentId,
      group_id: groupId,
      lesson_id: r.lesson_id,
      year_id: input.yearId,
      status: r.status,
      date_recorded: input.assessmentDate,
      recorded_by: input.scorerId,
      source: "assessment" as const,
    }));

    const { data: seeded, error: seedError } = await supabase
      .from("lesson_progress")
      .upsert(progressRows, {
        onConflict: "student_id,lesson_id,year_id,date_recorded",
      })
      .select("progress_id");
    if (seedError) throw new Error(seedError.message);
    lessonProgressRowsSeeded = seeded?.length ?? 0;
  }

  return {
    assessmentId,
    lessonsRecorded: lessonInsertRows.length,
    componentErrorsRecorded: scored.componentErrors.length,
    lessonProgressRowsSeeded,
    metrics: scored.metrics,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────

interface RawAssessmentRow {
  assessment_id: number;
  student_id: number;
  year_id: number;
  snapshot_type: SnapshotType;
  assessment_date: string;
  scorer_id: number | null;
  is_kindergarten_eoy: boolean;
  foundational_pct: string | null;
  kg_pct: string | null;
  first_grade_pct: string | null;
  second_grade_pct: string | null;
  overall_pct: string | null;
  notes: string | null;
  created_at: string;
  staff: { first_name: string; last_name: string } | null;
}

function toAssessmentSummary(r: RawAssessmentRow): AssessmentSummary {
  const num = (v: string | null) => (v === null ? null : Number(v));
  return {
    assessmentId: r.assessment_id,
    studentId: r.student_id,
    yearId: r.year_id,
    snapshotType: r.snapshot_type,
    assessmentDate: r.assessment_date,
    scorerId: r.scorer_id,
    scorerName: r.staff
      ? `${r.staff.first_name} ${r.staff.last_name}`.trim()
      : null,
    isKindergartenEoy: r.is_kindergarten_eoy,
    foundationalPct: num(r.foundational_pct),
    kgPct: num(r.kg_pct),
    firstGradePct: num(r.first_grade_pct),
    secondGradePct: num(r.second_grade_pct),
    overallPct: num(r.overall_pct),
    notes: r.notes,
    createdAt: r.created_at,
  };
}

const SNAPSHOT_ORDER: Record<SnapshotType, number> = {
  baseline: 0,
  semester_1_end: 1,
  semester_2_end: 2,
};

function compareSnapshots(a: AssessmentSummary, b: AssessmentSummary): number {
  return SNAPSHOT_ORDER[a.snapshotType] - SNAPSHOT_ORDER[b.snapshotType];
}
