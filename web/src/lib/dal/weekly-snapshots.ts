/**
 * @file dal/weekly-snapshots.ts — Weekly growth snapshot capture & query
 *
 * Phase C.2: the growth engine. Ports the semantics of the original
 * StudentHistory.gs + the growth slope calc in FridayCoachingDashboard.gs
 * into a single composable function that writes to the weekly_snapshots
 * table (already in the schema from the MVP build).
 *
 * For each (student, week) in scope we compute:
 *   - lessons_taken  = distinct lessons with status Y or N in the week
 *   - lessons_passed = distinct lessons with status Y in the week
 *   - growth_pct     = (lessons_passed / aimline) * 100, where aimline
 *                      is TARGET_LESSONS_PER_WEEK (2). A student at
 *                      aimline shows 100%; above = over-pace; below =
 *                      behind. This is the exact metric the Priority
 *                      Matrix uses (ratio = avgPerWeek / aimline).
 *
 * Dedup rule (from the .gs):
 *   Within a single week, if a student has multiple rows for the same
 *   lesson, status priority is Y > N > A. Y always wins; N beats A; A
 *   only sets if no record yet. Absence-only lessons don't count toward
 *   taken or passed.
 *
 * The capture function walks N recent weeks (default 8) and upserts
 * every (student, year, week_number) triple. Idempotent on the unique
 * constraint — safe to run on any cadence without creating duplicates.
 */

import { createClient } from "@/lib/supabase/server";
import { TARGET_LESSONS_PER_WEEK } from "@/config/ufli";

// ── Types ────────────────────────────────────────────────────────────────

export interface WeeklySnapshotRow {
  studentId: number;
  yearId: number;
  weekNumber: number;
  weekStartDate: string;
  growthPct: number;
  lessonsTaken: number;
  lessonsPassed: number;
}

export interface WeeklySnapshotCaptureResult {
  weeksProcessed: number;
  studentsProcessed: number;
  snapshotsWritten: number;
  earliestWeek: string | null;
  latestWeek: string | null;
}

interface CaptureOptions {
  schoolId: number;
  /** Academic year to capture for. Required. */
  yearId: number;
  /** How many weeks back to capture, inclusive of the current week. Default 8. */
  weeks?: number;
}

// ── Date helpers (Monday-anchored ISO weeks) ─────────────────────────────

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7; // Sunday = 7
  d.setDate(d.getDate() - day + 1);
  return d;
}

function endOfWeekSunday(mondayStart: Date): Date {
  const d = new Date(mondayStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * ISO week number (1–53). Thursday-of-week anchored — standard ISO 8601
 * definition. Combined with year_id, this uniquely identifies a week.
 */
function isoWeekNumber(monday: Date): number {
  const d = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ── Capture composer ─────────────────────────────────────────────────────

/**
 * Computes weekly snapshots for every active student in the school for
 * the last N weeks and upserts them into weekly_snapshots. Idempotent.
 *
 * Returns a summary suitable for displaying in a "last capture" UI.
 */
export async function captureWeeklySnapshots(
  options: CaptureOptions,
): Promise<WeeklySnapshotCaptureResult> {
  const supabase = await createClient();
  const weeksBack = options.weeks ?? 8;

  // ── 1. Build week boundaries: [weeksBack .. 0] Mondays going backward ──
  const today = new Date();
  const thisMonday = startOfWeekMonday(today);

  interface WeekWindow {
    weekNumber: number;
    start: Date;
    end: Date;
    startIso: string;
    endIso: string;
  }

  const weeks: WeekWindow[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const mon = new Date(thisMonday);
    mon.setDate(mon.getDate() - i * 7);
    const sun = endOfWeekSunday(mon);
    weeks.push({
      weekNumber: isoWeekNumber(mon),
      start: mon,
      end: sun,
      startIso: isoDate(mon),
      endIso: isoDate(sun),
    });
  }

  const earliestIso = weeks[0].startIso;
  const latestIso = weeks[weeks.length - 1].startIso;

  // ── 2. Fetch active students for the school ──────────────────────────
  const { data: studentRows } = await supabase
    .from("students")
    .select("student_id")
    .eq("school_id", options.schoolId)
    .eq("enrollment_status", "active");

  const studentIds = (studentRows ?? []).map(
    (r) => (r as { student_id: number }).student_id,
  );

  if (studentIds.length === 0) {
    return {
      weeksProcessed: weeks.length,
      studentsProcessed: 0,
      snapshotsWritten: 0,
      earliestWeek: earliestIso,
      latestWeek: latestIso,
    };
  }

  // ── 3. Fetch lesson_progress for these students in the window ────────
  const { data: progressRows, error: progressErr } = await supabase
    .from("lesson_progress")
    .select("student_id, lesson_id, status, date_recorded")
    .in("student_id", studentIds)
    .eq("year_id", options.yearId)
    .gte("date_recorded", earliestIso)
    .lte("date_recorded", latestIso);

  if (progressErr) {
    throw new Error(`Failed to load lesson_progress: ${progressErr.message}`);
  }

  // ── 4. Bucket by (student, week_index) and apply Y>N>A dedup ──────────
  // Structure: studentId → weekIndex → lessonId → bestStatus
  const buckets = new Map<number, Map<number, Map<number, "Y" | "N" | "A">>>();

  for (const row of progressRows ?? []) {
    const r = row as {
      student_id: number;
      lesson_id: number;
      status: "Y" | "N" | "A";
      date_recorded: string;
    };

    // Locate the week index for this date. Dates are ISO-sortable so we
    // linearly probe; only 8 weeks, so O(n*8) is fine.
    let weekIdx = -1;
    for (let i = 0; i < weeks.length; i++) {
      if (r.date_recorded >= weeks[i].startIso && r.date_recorded <= weeks[i].endIso) {
        weekIdx = i;
        break;
      }
    }
    if (weekIdx === -1) continue;

    let studentBucket = buckets.get(r.student_id);
    if (!studentBucket) {
      studentBucket = new Map();
      buckets.set(r.student_id, studentBucket);
    }
    let weekBucket = studentBucket.get(weekIdx);
    if (!weekBucket) {
      weekBucket = new Map();
      studentBucket.set(weekIdx, weekBucket);
    }

    const existing = weekBucket.get(r.lesson_id);
    if (!existing) {
      weekBucket.set(r.lesson_id, r.status);
    } else if (r.status === "Y" && existing !== "Y") {
      weekBucket.set(r.lesson_id, "Y");
    } else if (r.status === "N" && existing === "A") {
      weekBucket.set(r.lesson_id, "N");
    }
    // Y > N > A; no other transitions
  }

  // ── 5. Build the upsert rows ─────────────────────────────────────────
  // One row per (student, week) for every student in scope — even if the
  // student had no activity that week (lessons_taken = 0, growth_pct = 0).
  // This matches the StudentHistory.gs pattern of writing a paired cell
  // per week per student, so downstream consumers can tell "no activity"
  // apart from "not yet captured".
  const rows: Array<{
    student_id: number;
    year_id: number;
    week_number: number;
    week_start_date: string;
    growth_pct: number;
    lessons_taken: number;
    lessons_passed: number;
  }> = [];

  for (const studentId of studentIds) {
    const studentBucket = buckets.get(studentId);
    for (let wi = 0; wi < weeks.length; wi++) {
      const week = weeks[wi];
      const weekBucket = studentBucket?.get(wi);

      let taken = 0;
      let passed = 0;
      if (weekBucket) {
        for (const status of weekBucket.values()) {
          if (status === "Y") {
            taken++;
            passed++;
          } else if (status === "N") {
            taken++;
          }
          // A-only lessons don't count toward taken or passed
        }
      }

      const growthPct =
        Math.round((passed / TARGET_LESSONS_PER_WEEK) * 100 * 100) / 100;

      rows.push({
        student_id: studentId,
        year_id: options.yearId,
        week_number: week.weekNumber,
        week_start_date: week.startIso,
        growth_pct: growthPct,
        lessons_taken: taken,
        lessons_passed: passed,
      });
    }
  }

  // ── 6. Upsert in a single batch ──────────────────────────────────────
  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from("weekly_snapshots")
      .upsert(rows, { onConflict: "student_id,year_id,week_number" });

    if (upsertErr) {
      throw new Error(`Failed to upsert weekly_snapshots: ${upsertErr.message}`);
    }
  }

  return {
    weeksProcessed: weeks.length,
    studentsProcessed: studentIds.length,
    snapshotsWritten: rows.length,
    earliestWeek: earliestIso,
    latestWeek: latestIso,
  };
}

// ── Query helpers ────────────────────────────────────────────────────────

/**
 * Returns the last N weekly snapshots for a student, most recent first.
 * Used by the student detail sparkline.
 */
export async function getStudentWeeklySnapshots(
  studentId: number,
  yearId: number,
  limit: number = 8,
): Promise<WeeklySnapshotRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_snapshots")
    .select(
      "student_id, year_id, week_number, week_start_date, growth_pct, lessons_taken, lessons_passed",
    )
    .eq("student_id", studentId)
    .eq("year_id", yearId)
    .order("week_start_date", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Array<{
    student_id: number;
    year_id: number;
    week_number: number;
    week_start_date: string;
    growth_pct: string | number;
    lessons_taken: number;
    lessons_passed: number;
  }>).map((r) => ({
    studentId: r.student_id,
    yearId: r.year_id,
    weekNumber: r.week_number,
    weekStartDate: r.week_start_date,
    growthPct: typeof r.growth_pct === "string" ? parseFloat(r.growth_pct) : r.growth_pct,
    lessonsTaken: r.lessons_taken,
    lessonsPassed: r.lessons_passed,
  }));
}

export interface SchoolSnapshotSummary {
  /** Most recent week_start_date in the school's weekly_snapshots */
  lastCapturedWeek: string | null;
  /** Total snapshot rows for the school in the current year */
  totalRows: number;
  /** Distinct weeks covered */
  weeksCovered: number;
  /** Distinct students with at least one snapshot */
  studentsCovered: number;
  /** The most recent week's per-student roll-up */
  currentWeek: {
    weekStartDate: string | null;
    totalStudents: number;
    atOrAboveAimline: number;
    belowAimline: number;
    avgGrowthPct: number | null;
  };
}

/**
 * School-wide summary for the /dashboard/snapshots landing page.
 * Designed for the single most-recent week plus aggregate counts.
 */
export async function getSchoolSnapshotSummary(
  schoolId: number,
  yearId: number,
): Promise<SchoolSnapshotSummary> {
  const supabase = await createClient();

  // Active students for the school — we'll filter snapshots by this set
  const { data: studentRows } = await supabase
    .from("students")
    .select("student_id")
    .eq("school_id", schoolId)
    .eq("enrollment_status", "active");

  const studentIds = (studentRows ?? []).map(
    (r) => (r as { student_id: number }).student_id,
  );

  if (studentIds.length === 0) {
    return {
      lastCapturedWeek: null,
      totalRows: 0,
      weeksCovered: 0,
      studentsCovered: 0,
      currentWeek: {
        weekStartDate: null,
        totalStudents: 0,
        atOrAboveAimline: 0,
        belowAimline: 0,
        avgGrowthPct: null,
      },
    };
  }

  const { data: allSnapshots } = await supabase
    .from("weekly_snapshots")
    .select(
      "student_id, week_number, week_start_date, growth_pct, lessons_taken, lessons_passed",
    )
    .in("student_id", studentIds)
    .eq("year_id", yearId);

  const rows = (allSnapshots ?? []) as Array<{
    student_id: number;
    week_number: number;
    week_start_date: string;
    growth_pct: string | number;
    lessons_taken: number;
    lessons_passed: number;
  }>;

  if (rows.length === 0) {
    return {
      lastCapturedWeek: null,
      totalRows: 0,
      weeksCovered: 0,
      studentsCovered: 0,
      currentWeek: {
        weekStartDate: null,
        totalStudents: 0,
        atOrAboveAimline: 0,
        belowAimline: 0,
        avgGrowthPct: null,
      },
    };
  }

  const weeks = new Set<string>();
  const students = new Set<number>();
  let latestWeek = "";
  for (const r of rows) {
    weeks.add(r.week_start_date);
    students.add(r.student_id);
    if (r.week_start_date > latestWeek) latestWeek = r.week_start_date;
  }

  // Current-week rollup: filter to the latest week
  const currentWeekRows = rows.filter((r) => r.week_start_date === latestWeek);
  let atOrAbove = 0;
  let below = 0;
  let growthSum = 0;
  let growthCount = 0;
  for (const r of currentWeekRows) {
    const growth =
      typeof r.growth_pct === "string" ? parseFloat(r.growth_pct) : r.growth_pct;
    if (growth >= 100) atOrAbove++;
    else below++;
    if (r.lessons_taken > 0) {
      growthSum += growth;
      growthCount++;
    }
  }

  return {
    lastCapturedWeek: latestWeek,
    totalRows: rows.length,
    weeksCovered: weeks.size,
    studentsCovered: students.size,
    currentWeek: {
      weekStartDate: latestWeek,
      totalStudents: currentWeekRows.length,
      atOrAboveAimline: atOrAbove,
      belowAimline: below,
      avgGrowthPct: growthCount > 0 ? growthSum / growthCount : null,
    },
  };
}
