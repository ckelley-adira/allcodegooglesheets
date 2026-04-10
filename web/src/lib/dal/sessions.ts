/**
 * @file dal/sessions.ts — Data access layer for lesson progress recording
 *
 * Uses the Supabase JS client (PostgREST over HTTPS) for serverless reliability.
 * Per D-012: 'A' (absent) is excluded from slope calculations, never zeroed.
 *
 * @rls School-scoping enforced by RLS policies via the user's JWT.
 */

import { createClient } from "@/lib/supabase/server";

// ── Types ────────────────────────────────────────────────────────────────

export interface LessonOutcome {
  studentId: number;
  status: "Y" | "N" | "A";
}

export type DataSource = "form" | "manual" | "import" | "api" | "assessment";

export interface RecordSessionInput {
  groupId: number | null;
  lessonId: number;
  yearId: number;
  dateRecorded: string;
  recordedBy: number;
  outcomes: LessonOutcome[];
  /** Data source tag for audit trail. Default 'form'. */
  source?: DataSource;
}

export interface ExistingOutcome {
  studentId: number;
  status: "Y" | "N" | "A";
}

export interface RecentEntry {
  dateRecorded: string;
  lessonNumber: number;
  lessonName: string | null;
  groupName: string;
  groupId: number;
  outcomeCount: number;
}

// ── Queries ──────────────────────────────────────────────────────────────

/**
 * Lists all 128 UFLI lessons (reference data).
 */
export async function listLessons() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ufli_lessons")
    .select("lesson_id, lesson_number, lesson_name, skill_section, is_review")
    .order("lesson_number", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    lessonId: r.lesson_id,
    lessonNumber: r.lesson_number,
    lessonName: r.lesson_name,
    skillSection: r.skill_section,
    isReview: r.is_review,
  }));
}

/**
 * Gets active students in a group for the lesson entry form.
 *
 * @rls School-scoped via RLS policy.
 */
export async function getGroupStudentsForEntry(groupId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_memberships")
    .select(
      "students(student_id, first_name, last_name, student_number, enrollment_status, grade_levels(name))",
    )
    .eq("group_id", groupId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  const rows = (data ?? [])
    .map((r) => {
      const s = (r as unknown as {
        students: {
          student_id: number;
          first_name: string;
          last_name: string;
          student_number: string;
          enrollment_status: string;
          grade_levels: { name: string } | null;
        } | null;
      }).students;
      if (!s || s.enrollment_status !== "active") return null;
      return {
        studentId: s.student_id,
        firstName: s.first_name,
        lastName: s.last_name,
        studentNumber: s.student_number,
        gradeName: s.grade_levels?.name ?? "",
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  rows.sort((a, b) => {
    const ln = a.lastName.localeCompare(b.lastName);
    if (ln !== 0) return ln;
    return a.firstName.localeCompare(b.firstName);
  });

  return rows;
}

/**
 * Gets existing lesson outcomes for a group+lesson.
 * Used to pre-populate the form when editing an existing entry.
 */
export async function getExistingOutcomes(
  groupId: number,
  lessonId: number,
  yearId: number,
): Promise<ExistingOutcome[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("student_id, status")
    .eq("group_id", groupId)
    .eq("lesson_id", lessonId)
    .eq("year_id", yearId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    studentId: r.student_id,
    status: r.status as "Y" | "N" | "A",
  }));
}

/**
 * Records a batch of lesson outcomes via upsert.
 * Re-recording the same student+lesson+date updates instead of inserting.
 *
 * @rls School-scoped via RLS policy.
 */
export async function recordLessonOutcomes(
  input: RecordSessionInput,
): Promise<number> {
  if (input.outcomes.length === 0) return 0;

  const supabase = await createClient();
  const rows = input.outcomes.map((o) => ({
    student_id: o.studentId,
    group_id: input.groupId,
    lesson_id: input.lessonId,
    year_id: input.yearId,
    status: o.status,
    date_recorded: input.dateRecorded,
    recorded_by: input.recordedBy || null,
    source: (input.source ?? "form") as DataSource,
  }));

  const { data, error } = await supabase
    .from("lesson_progress")
    .upsert(rows, {
      onConflict: "student_id,lesson_id,year_id,date_recorded",
    })
    .select("progress_id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/**
 * Lists recent lesson entries for the school overview.
 *
 * @rls Filters by school_id via the joined instructional_groups table.
 */
export async function listRecentEntries(
  schoolId: number,
  limit: number = 20,
): Promise<RecentEntry[]> {
  const supabase = await createClient();
  // Get raw progress rows with joins, ordered by date desc, scoped to the
  // active school via the inner join on instructional_groups
  const { data, error } = await supabase
    .from("lesson_progress")
    .select(
      "date_recorded, group_id, ufli_lessons(lesson_number, lesson_name), instructional_groups!inner(group_name, school_id)",
    )
    .eq("instructional_groups.school_id", schoolId)
    .order("date_recorded", { ascending: false })
    .limit(500); // Fetch enough rows to aggregate

  if (error) throw new Error(error.message);

  // Aggregate in JS: count per (date, lesson, group)
  const groups = new Map<string, RecentEntry>();
  for (const r of data ?? []) {
    const raw = r as unknown as {
      date_recorded: string;
      group_id: number;
      ufli_lessons: { lesson_number: number; lesson_name: string | null } | null;
      instructional_groups: { group_name: string } | null;
    };
    const key = `${raw.date_recorded}|${raw.ufli_lessons?.lesson_number}|${raw.group_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        dateRecorded: raw.date_recorded,
        lessonNumber: raw.ufli_lessons?.lesson_number ?? 0,
        lessonName: raw.ufli_lessons?.lesson_name ?? null,
        groupName: raw.instructional_groups?.group_name ?? "",
        groupId: raw.group_id,
        outcomeCount: 0,
      });
    }
    groups.get(key)!.outcomeCount++;
  }

  return Array.from(groups.values()).slice(0, limit);
}
