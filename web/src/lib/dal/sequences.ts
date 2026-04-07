/**
 * @file dal/sequences.ts — Data access layer for Instructional Sequences
 *
 * A group has multiple instructional sequences over a school year, one
 * active at a time. Each sequence is an ordered list of UFLI lessons with
 * optional planned dates and per-lesson status. The current lesson in the
 * active sequence is what the Tutor Input Form pre-selects.
 *
 * Philosophy (D-005): advancement is always manual. Teachers/coaches click
 * a button to mark a lesson completed and advance to the next.
 *
 * @rls School-scoping enforced by RLS policies via the parent group.
 */

import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";
import type { CadenceDayCode } from "@/config/cadence";

// ── Types ────────────────────────────────────────────────────────────────

export type SequenceStatus = "draft" | "active" | "completed";
export type SequenceLessonStatus =
  | "upcoming"
  | "current"
  | "completed"
  | "skipped";

export interface SequenceRow {
  sequenceId: number;
  groupId: number;
  yearId: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: SequenceStatus;
  sortOrder: number;
  createdAt: Date;
  lessonCount: number;
  completedCount: number;
}

export interface SequenceLessonRow {
  sequenceId: number;
  lessonId: number;
  lessonNumber: number;
  lessonName: string | null;
  skillSection: string;
  isReview: boolean;
  sortOrder: number;
  plannedDate: string | null;
  status: SequenceLessonStatus;
  completedAt: Date | null;
}

export interface SequenceDetail extends SequenceRow {
  lessons: SequenceLessonRow[];
}

export interface BuildSequenceInput {
  groupId: number;
  yearId: number;
  name: string;
  startDate: string;
  cadenceDays: CadenceDayCode[]; // e.g. ["TUE","THU"]
  lessonIds: number[]; // ordered list of UFLI lessons
}

interface RawSequenceRow {
  sequence_id: number;
  group_id: number;
  year_id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: SequenceStatus;
  sort_order: number;
  created_at: string;
}

interface RawSequenceLessonRow {
  sequence_id: number;
  lesson_id: number;
  sort_order: number;
  planned_date: string | null;
  status: SequenceLessonStatus;
  completed_at: string | null;
  ufli_lessons: {
    lesson_number: number;
    lesson_name: string | null;
    skill_section: string;
    is_review: boolean;
  } | null;
}

function mapSequenceLessonRow(r: RawSequenceLessonRow): SequenceLessonRow {
  return {
    sequenceId: r.sequence_id,
    lessonId: r.lesson_id,
    lessonNumber: r.ufli_lessons?.lesson_number ?? 0,
    lessonName: r.ufli_lessons?.lesson_name ?? null,
    skillSection: r.ufli_lessons?.skill_section ?? "",
    isReview: r.ufli_lessons?.is_review ?? false,
    sortOrder: r.sort_order,
    plannedDate: r.planned_date,
    status: r.status,
    completedAt: r.completed_at ? new Date(r.completed_at) : null,
  };
}

function mapSequenceRow(
  r: RawSequenceRow,
  lessonCount: number,
  completedCount: number,
): SequenceRow {
  return {
    sequenceId: r.sequence_id,
    groupId: r.group_id,
    yearId: r.year_id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    sortOrder: r.sort_order,
    createdAt: new Date(r.created_at),
    lessonCount,
    completedCount,
  };
}

// ── Listing / fetching ───────────────────────────────────────────────────

/**
 * Lists all sequences for a group, newest first. Includes lesson counts
 * (total and completed) so the UI can show a progress summary per sequence.
 */
export async function listSequencesForGroup(
  groupId: number,
): Promise<SequenceRow[]> {
  const supabase = await createClient();
  const { data: sequences, error } = await supabase
    .from("instructional_sequences")
    .select(
      "sequence_id, group_id, year_id, name, start_date, end_date, status, sort_order, created_at",
    )
    .eq("group_id", groupId)
    .order("sort_order", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!sequences || sequences.length === 0) return [];

  const sequenceIds = (sequences as unknown as RawSequenceRow[]).map(
    (s) => s.sequence_id,
  );

  // Fetch lesson status counts per sequence
  const { data: lessons } = await supabase
    .from("instructional_sequence_lessons")
    .select("sequence_id, status")
    .in("sequence_id", sequenceIds);

  const totalMap = new Map<number, number>();
  const completedMap = new Map<number, number>();
  for (const l of lessons ?? []) {
    const row = l as { sequence_id: number; status: SequenceLessonStatus };
    totalMap.set(row.sequence_id, (totalMap.get(row.sequence_id) ?? 0) + 1);
    if (row.status === "completed") {
      completedMap.set(
        row.sequence_id,
        (completedMap.get(row.sequence_id) ?? 0) + 1,
      );
    }
  }

  return (sequences as unknown as RawSequenceRow[]).map((s) =>
    mapSequenceRow(
      s,
      totalMap.get(s.sequence_id) ?? 0,
      completedMap.get(s.sequence_id) ?? 0,
    ),
  );
}

/**
 * Gets a single sequence with its ordered lessons (with UFLI metadata).
 */
export async function getSequenceWithLessons(
  sequenceId: number,
): Promise<SequenceDetail | null> {
  const supabase = await createClient();
  const { data: seq, error } = await supabase
    .from("instructional_sequences")
    .select(
      "sequence_id, group_id, year_id, name, start_date, end_date, status, sort_order, created_at",
    )
    .eq("sequence_id", sequenceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!seq) return null;

  const { data: lessonsRaw, error: lessonsError } = await supabase
    .from("instructional_sequence_lessons")
    .select(
      "sequence_id, lesson_id, sort_order, planned_date, status, completed_at, ufli_lessons(lesson_number, lesson_name, skill_section, is_review)",
    )
    .eq("sequence_id", sequenceId)
    .order("sort_order", { ascending: true });

  if (lessonsError) throw new Error(lessonsError.message);

  const lessons = (lessonsRaw ?? []).map((l) =>
    mapSequenceLessonRow(l as unknown as RawSequenceLessonRow),
  );
  const completedCount = lessons.filter((l) => l.status === "completed").length;

  return {
    ...mapSequenceRow(seq as unknown as RawSequenceRow, lessons.length, completedCount),
    lessons,
  };
}

/**
 * Gets the active sequence for a group (at most one) with its lessons,
 * or null if the group has no active sequence.
 *
 * This is the primary lookup used by the Tutor Input Form to find the
 * current lesson to pre-select.
 */
export async function getActiveSequenceForGroup(
  groupId: number,
): Promise<SequenceDetail | null> {
  const supabase = await createClient();
  const { data: seq, error } = await supabase
    .from("instructional_sequences")
    .select("sequence_id")
    .eq("group_id", groupId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!seq) return null;

  return getSequenceWithLessons(
    (seq as unknown as { sequence_id: number }).sequence_id,
  );
}

/**
 * Returns the lesson_id of the "current" lesson in a group's active sequence,
 * or null if there is none. Used by the Tutor Input Form to pre-select the
 * lesson dropdown. Single round-trip via an inner-join.
 */
export async function getCurrentLessonIdForGroup(
  groupId: number,
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("instructional_sequence_lessons")
    .select(
      "lesson_id, instructional_sequences!inner(group_id, status)",
    )
    .eq("status", "current")
    .eq("instructional_sequences.group_id", groupId)
    .eq("instructional_sequences.status", "active")
    .maybeSingle();

  return data ? (data as unknown as { lesson_id: number }).lesson_id : null;
}

// ── Building / updating ──────────────────────────────────────────────────

/**
 * Generates planned dates for a sequence. Given a start date, a cadence
 * (days of the week), and a lesson count, returns a date per lesson.
 *
 * Example: startDate=2025-10-14 (Tue), cadenceDays=['TUE','THU'], 4 lessons
 *   → ['2025-10-14', '2025-10-16', '2025-10-21', '2025-10-23']
 */
// JavaScript Date.getDay() returns 0=Sun..6=Sat; this array maps the
// CadenceDayCode strings ("MON","TUE",...) to those indices.
const GETDAY_INDEX = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function generatePlannedDates(
  startDate: string,
  cadenceDays: readonly string[],
  lessonCount: number,
): string[] {
  if (lessonCount <= 0 || cadenceDays.length === 0) return [];

  const codeIndexSet = new Set(
    cadenceDays
      .map((c) => GETDAY_INDEX.indexOf(c.toUpperCase()))
      .filter((i) => i >= 0),
  );
  if (codeIndexSet.size === 0) return [];

  const results: string[] = [];
  // Parse the start date as a local date to avoid timezone weirdness
  const [y, m, d] = startDate.split("-").map(Number);
  const cursor = new Date(y, m - 1, d);

  // Walk forward day by day until we've collected enough matches.
  // Include the start date itself if it falls on a cadence day.
  let safety = 0;
  while (results.length < lessonCount && safety < 365 * 2) {
    if (codeIndexSet.has(cursor.getDay())) {
      const yyyy = cursor.getFullYear();
      const mm = String(cursor.getMonth() + 1).padStart(2, "0");
      const dd = String(cursor.getDate()).padStart(2, "0");
      results.push(`${yyyy}-${mm}-${dd}`);
    }
    cursor.setDate(cursor.getDate() + 1);
    safety++;
  }

  return results;
}

/**
 * Creates a new sequence for a group with the given lessons and cadence.
 * First lesson becomes 'current'; any existing active sequence is demoted
 * to 'completed' so the "one active sequence per group" invariant holds.
 *
 * Not transactional (4 separate statements). A failure mid-way can leave
 * a demoted-but-not-replaced state. Acceptable for now given single-user
 * MVP traffic; migrate to a Postgres RPC if this becomes load-bearing.
 */
export async function buildSequence(input: BuildSequenceInput): Promise<number> {
  const supabase = await createClient();

  if (input.lessonIds.length === 0) {
    throw new Error("At least one lesson is required.");
  }

  await supabase
    .from("instructional_sequences")
    .update({ status: "completed", end_date: todayISO() })
    .eq("group_id", input.groupId)
    .eq("status", "active");

  const { data: existing } = await supabase
    .from("instructional_sequences")
    .select("sort_order")
    .eq("group_id", input.groupId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSortOrder =
    ((existing?.[0] as { sort_order?: number } | undefined)?.sort_order ?? 0) +
    1;

  const plannedDates = generatePlannedDates(
    input.startDate,
    input.cadenceDays,
    input.lessonIds.length,
  );
  const endDate = plannedDates.at(-1) ?? input.startDate;

  const { data: seq, error: seqError } = await supabase
    .from("instructional_sequences")
    .insert({
      group_id: input.groupId,
      year_id: input.yearId,
      name: input.name,
      start_date: input.startDate,
      end_date: endDate,
      status: "active" as SequenceStatus,
      sort_order: nextSortOrder,
    })
    .select("sequence_id")
    .single();

  if (seqError) throw new Error(seqError.message);
  const sequenceId = seq.sequence_id;

  // First lesson is 'current', rest are 'upcoming' (explicit union type
  // rather than string literal so typos get caught at build time).
  const lessonRows = input.lessonIds.map((lessonId, i) => ({
    sequence_id: sequenceId,
    lesson_id: lessonId,
    sort_order: i,
    planned_date: plannedDates[i] ?? null,
    status: (i === 0 ? "current" : "upcoming") as SequenceLessonStatus,
  }));

  const { error: lessonsError } = await supabase
    .from("instructional_sequence_lessons")
    .insert(lessonRows);

  if (lessonsError) throw new Error(lessonsError.message);

  return sequenceId;
}

/**
 * Advances an active sequence: marks the current lesson as completed
 * and promotes the next upcoming lesson (by sort_order) to current.
 * If there is no next upcoming lesson, the sequence itself is marked
 * completed.
 *
 * Not transactional. A concurrent double-click could theoretically
 * promote two lessons; not a practical concern for current usage.
 * Migrate to a Postgres RPC if it becomes an issue.
 */
export async function advanceSequence(sequenceId: number): Promise<{
  advanced: boolean;
  nextLessonId: number | null;
  sequenceCompleted: boolean;
}> {
  const supabase = await createClient();

  const { data: currentRow } = await supabase
    .from("instructional_sequence_lessons")
    .select("lesson_id, sort_order")
    .eq("sequence_id", sequenceId)
    .eq("status", "current")
    .maybeSingle();

  if (!currentRow) {
    return { advanced: false, nextLessonId: null, sequenceCompleted: false };
  }
  const current = currentRow as unknown as {
    lesson_id: number;
    sort_order: number;
  };

  const { data: nextRow } = await supabase
    .from("instructional_sequence_lessons")
    .select("lesson_id")
    .eq("sequence_id", sequenceId)
    .eq("status", "upcoming")
    .gt("sort_order", current.sort_order)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error: completeError } = await supabase
    .from("instructional_sequence_lessons")
    .update({
      status: "completed" as SequenceLessonStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("sequence_id", sequenceId)
    .eq("lesson_id", current.lesson_id);

  if (completeError) throw new Error(completeError.message);

  if (nextRow) {
    const next = nextRow as unknown as { lesson_id: number };
    const { error: promoteError } = await supabase
      .from("instructional_sequence_lessons")
      .update({ status: "current" as SequenceLessonStatus })
      .eq("sequence_id", sequenceId)
      .eq("lesson_id", next.lesson_id);
    if (promoteError) throw new Error(promoteError.message);

    return {
      advanced: true,
      nextLessonId: next.lesson_id,
      sequenceCompleted: false,
    };
  }

  const { error: seqCompleteError } = await supabase
    .from("instructional_sequences")
    .update({
      status: "completed" as SequenceStatus,
      end_date: todayISO(),
    })
    .eq("sequence_id", sequenceId);

  if (seqCompleteError) throw new Error(seqCompleteError.message);

  return { advanced: true, nextLessonId: null, sequenceCompleted: true };
}

/**
 * Deletes a sequence (and its lessons via ON DELETE CASCADE). Used for
 * drafts or when a coach wants to start over. Completed sequences should
 * generally be preserved; the UI can hide the delete button for those.
 */
export async function deleteSequence(sequenceId: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("instructional_sequences")
    .delete()
    .eq("sequence_id", sequenceId);
  if (error) throw new Error(error.message);
}
