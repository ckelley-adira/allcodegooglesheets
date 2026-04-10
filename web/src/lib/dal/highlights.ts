/**
 * @file dal/highlights.ts — Growth Highlighter (Phase D.3)
 *
 * The inverse of the cliff alert system. Where cliffs surface groups
 * about to fall, highlights surface students who just did something
 * exceptional. Three celebration categories:
 *
 *   1. Top Movers          — highest avg lessons/week in the last 4
 *                            weeks (above aimline)
 *   2. Band Advancers      — latest band_assignment movement is
 *                            'accelerating' or 'advancing' (D.1 data)
 *   3. Cliff Survivors     — students who crossed one of the 6
 *                            canonical cliffs in the last 4 weeks
 *
 * All three read from tables already populated by C.2 / D.1 / the
 * existing lesson_progress capture. No new schema.
 */

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { TARGET_LESSONS_PER_WEEK } from "@/config/ufli";
import {
  ARCHETYPE_META,
  type BandLevel,
  type StudentArchetype,
} from "@/lib/dal/bands";
import { CLIFFS, type CliffDefinition } from "@/lib/curriculum/cliffs";

// ── Types ────────────────────────────────────────────────────────────────

export interface TopMoverRow {
  studentId: number;
  studentName: string;
  gradeName: string | null;
  /** Avg lessons passed per week, rounded to 1 decimal */
  avgPerWeek: number;
  /** avgPerWeek / aimline * 100 */
  aimlineRatioPct: number;
  /** Weeks counted (weeks with non-zero lessons_taken) */
  weeksTracked: number;
  /** Total lessons passed across those weeks */
  totalPassed: number;
}

export interface BandAdvancerRow {
  studentId: number;
  studentName: string;
  gradeName: string | null;
  band: BandLevel;
  archetype: StudentArchetype;
  archetypeLabel: string;
  movement: "accelerating" | "advancing";
  assignedDate: string;
  ceilingSection: string | null;
}

export interface CliffSurvivorRow {
  studentId: number;
  studentName: string;
  gradeName: string | null;
  cliff: CliffDefinition;
  /** Date the student first passed a lesson beyond the cliff's trigger */
  crossedAt: string;
  /** The lesson they passed to clear the cliff */
  crossedAtLessonNumber: number;
}

export interface GrowthHighlightsResult {
  /** Lookback window for top movers + cliff survivors (weeks) */
  windowWeeks: number;
  topMovers: TopMoverRow[];
  bandAdvancers: BandAdvancerRow[];
  cliffSurvivors: CliffSurvivorRow[];
}

// ── Main composer ───────────────────────────────────────────────────────

const WINDOW_WEEKS = 4;
const TOP_MOVER_MIN_RATIO_PCT = 100; // at or above aimline

export interface HighlightsFilterOptions {
  /** Grade names to include, e.g. ["KG", "G1"]. Empty = all. */
  gradeFilter?: string[];
  /** Case-insensitive student name substring search */
  searchQuery?: string;
}

export async function getGrowthHighlights(
  schoolId: number,
  yearId: number,
  filters?: HighlightsFilterOptions,
): Promise<GrowthHighlightsResult> {
  const supabase = await createClient();

  // ── 1. Active students in the school + grade + name ──────────────────
  const { data: studentRows } = await supabase
    .from("students")
    .select("student_id, first_name, last_name, grade_levels!grade_id(name)")
    .eq("school_id", schoolId)
    .eq("enrollment_status", "active");

  type StudentRow = {
    student_id: number;
    first_name: string;
    last_name: string;
    grade_levels: { name: string } | null;
  };
  let students = ((studentRows ?? []) as unknown as StudentRow[]).map(
    (r) => ({
      studentId: r.student_id,
      studentName: `${r.first_name} ${r.last_name}`.trim(),
      gradeName: r.grade_levels?.name ?? null,
    }),
  );

  // Apply filters early so downstream queries scope to fewer students
  if (filters?.gradeFilter && filters.gradeFilter.length > 0) {
    const grades = new Set(filters.gradeFilter);
    students = students.filter((s) => s.gradeName && grades.has(s.gradeName));
  }
  if (filters?.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    students = students.filter((s) => s.studentName.toLowerCase().includes(q));
  }

  if (students.length === 0) {
    return {
      windowWeeks: WINDOW_WEEKS,
      topMovers: [],
      bandAdvancers: [],
      cliffSurvivors: [],
    };
  }

  const studentIds = students.map((s) => s.studentId);
  const studentLookup = new Map<
    number,
    { name: string; grade: string | null }
  >();
  for (const s of students) {
    studentLookup.set(s.studentId, { name: s.studentName, grade: s.gradeName });
  }

  // ── 2. Parallel loads: snapshots, latest bands, lesson_progress ──────
  // Window for cliff crossing + top movers = last 4 weeks
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_WEEKS * 7);
  const windowStartIso = windowStart.toISOString().split("T")[0];

  // Step 2a: find the most recent band assignment date in scope.
  // We'll then pull all rows at that date.
  const { data: latestDateRow } = await supabase
    .from("band_assignments")
    .select("assigned_date")
    .in("student_id", studentIds)
    .eq("year_id", yearId)
    .order("assigned_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestBandDate =
    (latestDateRow as { assigned_date: string } | null)?.assigned_date ?? null;

  // Paginated: lesson_progress Y rows can exceed 1K at scale (500 students × 128 lessons).
  // Snapshots and band rows are within limits (4 weeks of weekly data).
  const [snapshotRowsResult, bandRowsResult, progressRows] =
    await Promise.all([
      supabase
        .from("weekly_snapshots")
        .select(
          "student_id, week_start_date, lessons_taken, lessons_passed",
        )
        .in("student_id", studentIds)
        .eq("year_id", yearId)
        .gte("week_start_date", windowStartIso),
      latestBandDate
        ? supabase
            .from("band_assignments")
            .select(
              "student_id, band, archetype, movement, assigned_date, ceiling_section",
            )
            .in("student_id", studentIds)
            .eq("year_id", yearId)
            .eq("assigned_date", latestBandDate)
            .in("movement", ["accelerating", "advancing"])
        : Promise.resolve({ data: [] }),
      fetchAllRows<{
        student_id: number;
        date_recorded: string;
        ufli_lessons: { lesson_number: number } | null;
      }>((from, to) =>
        supabase
          .from("lesson_progress")
          .select(
            "student_id, date_recorded, ufli_lessons!inner(lesson_number)",
          )
          .in("student_id", studentIds)
          .eq("year_id", yearId)
          .eq("status", "Y")
          .gte("date_recorded", windowStartIso)
          .range(from, to),
      ),
    ]);

  // ── 3. Top Movers (from weekly snapshots) ────────────────────────────
  const topMovers = computeTopMovers(
    (snapshotRowsResult.data ?? []) as Array<{
      student_id: number;
      week_start_date: string;
      lessons_taken: number;
      lessons_passed: number;
    }>,
    studentLookup,
  );

  // ── 4. Band Advancers (from band_assignments latest date) ────────────
  const bandAdvancers = computeBandAdvancers(
    (bandRowsResult.data ?? []) as Array<{
      student_id: number;
      band: BandLevel;
      archetype: StudentArchetype;
      movement: "accelerating" | "advancing";
      assigned_date: string;
      ceiling_section: string | null;
    }>,
    studentLookup,
  );

  // ── 5. Cliff Survivors (from lesson_progress Y rows in window) ───────
  const cliffSurvivors = computeCliffSurvivors(
    progressRows,
    studentLookup,
  );

  return {
    windowWeeks: WINDOW_WEEKS,
    topMovers,
    bandAdvancers,
    cliffSurvivors,
  };
}

// ── Top Movers ───────────────────────────────────────────────────────────

function computeTopMovers(
  snapshots: Array<{
    student_id: number;
    week_start_date: string;
    lessons_taken: number;
    lessons_passed: number;
  }>,
  studentLookup: Map<number, { name: string; grade: string | null }>,
): TopMoverRow[] {
  // Aggregate per student, skipping weeks with zero activity
  const byStudent = new Map<
    number,
    { totalPassed: number; weeksTracked: number }
  >();

  for (const s of snapshots) {
    if (s.lessons_taken === 0) continue;
    const agg = byStudent.get(s.student_id) ?? {
      totalPassed: 0,
      weeksTracked: 0,
    };
    agg.totalPassed += s.lessons_passed;
    agg.weeksTracked += 1;
    byStudent.set(s.student_id, agg);
  }

  const rows: TopMoverRow[] = [];
  for (const [studentId, agg] of byStudent.entries()) {
    if (agg.weeksTracked === 0) continue;
    const meta = studentLookup.get(studentId);
    if (!meta) continue;
    const avgPerWeek = agg.totalPassed / agg.weeksTracked;
    const aimlineRatioPct = Math.round(
      (avgPerWeek / TARGET_LESSONS_PER_WEEK) * 100,
    );
    if (aimlineRatioPct < TOP_MOVER_MIN_RATIO_PCT) continue;
    rows.push({
      studentId,
      studentName: meta.name,
      gradeName: meta.grade,
      avgPerWeek: Math.round(avgPerWeek * 10) / 10,
      aimlineRatioPct,
      weeksTracked: agg.weeksTracked,
      totalPassed: agg.totalPassed,
    });
  }

  rows.sort((a, b) => {
    if (b.aimlineRatioPct !== a.aimlineRatioPct) {
      return b.aimlineRatioPct - a.aimlineRatioPct;
    }
    return b.totalPassed - a.totalPassed;
  });
  return rows;
}

// ── Band Advancers ───────────────────────────────────────────────────────

function computeBandAdvancers(
  rows: Array<{
    student_id: number;
    band: BandLevel;
    archetype: StudentArchetype;
    movement: "accelerating" | "advancing";
    assigned_date: string;
    ceiling_section: string | null;
  }>,
  studentLookup: Map<number, { name: string; grade: string | null }>,
): BandAdvancerRow[] {
  const out: BandAdvancerRow[] = [];
  for (const r of rows) {
    const meta = studentLookup.get(r.student_id);
    if (!meta) continue;
    out.push({
      studentId: r.student_id,
      studentName: meta.name,
      gradeName: meta.grade,
      band: r.band,
      archetype: r.archetype,
      archetypeLabel: ARCHETYPE_META[r.archetype].label,
      movement: r.movement,
      assignedDate: r.assigned_date,
      ceilingSection: r.ceiling_section,
    });
  }
  // Accelerating first, then advancing
  out.sort((a, b) => {
    if (a.movement !== b.movement) {
      return a.movement === "accelerating" ? -1 : 1;
    }
    return a.studentName.localeCompare(b.studentName);
  });
  return out;
}

// ── Cliff Survivors ──────────────────────────────────────────────────────

/**
 * A student "crossed" a cliff when they passed any lesson strictly
 * greater than the cliff's trigger lesson AT LEAST ONCE in the window.
 * We report the earliest such date as crossedAt, and the specific
 * lesson number they crossed with.
 *
 * If a student cleared multiple cliffs in the window, they appear once
 * per cliff. Sorted chronologically (most recent first) so this reads
 * like a celebration feed.
 */
function computeCliffSurvivors(
  progressRows: Array<{
    student_id: number;
    date_recorded: string;
    ufli_lessons: { lesson_number: number } | null;
  }>,
  studentLookup: Map<number, { name: string; grade: string | null }>,
): CliffSurvivorRow[] {
  // First reduce: per student, list of (date, lessonNumber) Y pairs
  const byStudent = new Map<
    number,
    Array<{ date: string; lessonNumber: number }>
  >();
  for (const r of progressRows) {
    if (!r.ufli_lessons) continue;
    let arr = byStudent.get(r.student_id);
    if (!arr) {
      arr = [];
      byStudent.set(r.student_id, arr);
    }
    arr.push({ date: r.date_recorded, lessonNumber: r.ufli_lessons.lesson_number });
  }

  const out: CliffSurvivorRow[] = [];

  for (const [studentId, entries] of byStudent.entries()) {
    const meta = studentLookup.get(studentId);
    if (!meta) continue;
    // Sort ascending by date
    entries.sort((a, b) => a.date.localeCompare(b.date));

    for (const cliff of CLIFFS) {
      const threshold = cliff.triggerLesson;
      // Earliest entry where lessonNumber > threshold
      const crossingEntry = entries.find((e) => e.lessonNumber > threshold);
      if (!crossingEntry) continue;
      out.push({
        studentId,
        studentName: meta.name,
        gradeName: meta.grade,
        cliff,
        crossedAt: crossingEntry.date,
        crossedAtLessonNumber: crossingEntry.lessonNumber,
      });
    }
  }

  // Most recent first
  out.sort((a, b) => b.crossedAt.localeCompare(a.crossedAt));
  return out;
}
