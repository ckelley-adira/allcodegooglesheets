/**
 * @file dal/coaching.ts — Coaching Priority Matrix (Phase C.3)
 *
 * Ported from FridayCoachingDashboard.gs. This is the "Big Four" coaching
 * metrics engine that powers /dashboard/coaching and /dashboard/monday-digest.
 *
 * Metrics:
 *   A. Reteach Frequency ("Sticky Factor") — how many times a group has
 *      re-taught a lesson in the window. Pure date-count based: if the
 *      same (group, lesson) shows up on 3+ distinct dates, reteaches =
 *      dateCount - 2.
 *   B. Group Pass Rate — % of students at ≥80% mastery in the group's
 *      primary current section, with v2.1 bridge detection.
 *   C. Student Growth vs. Expected Slope — reads weekly_snapshots
 *      (populated by Phase C.2), applies 2-lessons/week aimline.
 *   D. Chronic Absenteeism — % of group sessions missed per student.
 *
 * All four metrics cross into a Priority Matrix with 6 flag types:
 *   🎉 celebration, 🔵 coaching, 🔴 systemic, 🟢 fasttrack,
 *   🟡 fidelity, 🚨 tier3
 *
 * This file is built in four commits for manageable review. This first
 * commit lands the shared types and Metric A (Reteach).
 */

import { createClient } from "@/lib/supabase/server";
import { COACHING_THRESHOLDS } from "@/config/ufli";
import type { SkillSectionName } from "@/lib/curriculum/sections";

// ── Shared types ─────────────────────────────────────────────────────────

export interface ReteachLessonDetail {
  /** Lesson number (1-128) */
  lessonNumber: number;
  /** Lesson name if joinable */
  lessonName: string | null;
  /** Distinct dates the group attempted this lesson in the window */
  dateCount: number;
  /** Reteach count = max(dateCount - 2, 0) */
  reteachCount: number;
  /** Distinct students who saw this lesson in the window */
  studentCount: number;
}

export interface ReteachInfo {
  groupId: number;
  /** Highest reteach count across all lessons this group touched */
  maxReteachCount: number;
  /** Lesson number with the highest reteach count */
  maxReteachLessonNumber: number | null;
  /** Lesson name for maxReteachLesson, if joinable */
  maxReteachLessonName: string | null;
  /** Distinct base lessons taught in the window */
  totalLessonsTaught: number;
  /** All lessons with reteaches, sorted desc by reteachCount */
  reteaches: ReteachLessonDetail[];
}

export interface GroupMasteryInfo {
  groupId: number;
  /** Primary current section for the group (voted across students) */
  section: SkillSectionName | null;
  /** Total active members */
  totalStudents: number;
  /** Students at ≥80% mastery on their current section */
  masteryCount: number;
  /** masteryCount / totalStudents * 100 */
  masteryPct: number;
  /** Average of student section% values */
  avgSectionPct: number;
  /** v2.1 bridge detection: not enough lessons attempted yet */
  isBridging: boolean;
  /** Effective size of the primary section */
  sectionSize: number;
  /** Min lessons attempted before mastery flags fire */
  minThreshold: number;
  /** Unique lessons attempted in the section within the window */
  lessonsAttempted: number;
  /** Previous section if group recently completed it */
  completedPrevSection: SkillSectionName | null;
  /** Mastery % on the previous section (null if not applicable) */
  prevSectionMasteryPct: number | null;
}

export interface StudentGrowthInfo {
  studentId: number;
  studentName: string;
  groupId: number;
  /** Weeks with any non-absent activity */
  weeksTracked: number;
  /** Total lessons passed across tracked weeks */
  totalPassed: number;
  /** Lessons passed per active week */
  avgPerWeek: number;
  /** Always 2 (TARGET_LESSONS_PER_WEEK) */
  aimline: number;
  /** avgPerWeek / aimline * 100 */
  ratioPct: number;
  /** Longest streak of weeks below GROWTH_CONCERN_RATIO of aimline */
  belowAimlineWeeks: number;
  /** True when belowAimlineWeeks ≥ GROWTH_CONCERN_WEEKS */
  tier3Flag: boolean;
}

export interface StudentAbsenceInfo {
  studentId: number;
  studentName: string;
  groupId: number;
  /** Distinct dates the group met in the window */
  totalSessions: number;
  /** Distinct dates the student was marked A */
  absences: number;
  /** absences / totalSessions * 100 */
  absencePct: number;
  /** "critical" | "warning" | "ok" — FCD thresholds */
  flag: "critical" | "warning" | "ok";
}

export type PriorityItemType =
  | "celebration"
  | "coaching"
  | "systemic"
  | "fasttrack"
  | "fidelity"
  | "tier3";

export interface PriorityItem {
  type: PriorityItemType;
  icon: string;
  label: string;
  groupId: number;
  groupName: string;
  /** Populated for tier3 items; null for group-level items */
  studentId: number | null;
  studentName: string | null;
  detail: string;
  action: string;
  /** Sort key (desc) */
  urgency: number;
}

export interface CoachingSnapshot {
  windowDays: number;
  /** Set of group ids in scope */
  groupCount: number;
  /** Groups that had any reteaches in the window */
  groupsWithReteach: number;
  /** Count of priority items of type "tier3" */
  tier3Count: number;
  /** Total absence rows across all students in the window */
  totalAbsences: number;
  /** Per-group reteach info */
  reteach: Record<number, ReteachInfo>;
  /** Per-group mastery info */
  mastery: Record<number, GroupMasteryInfo>;
  /** Per-student growth info */
  growth: Record<number, StudentGrowthInfo>;
  /** Per-student absence info */
  absence: Record<number, StudentAbsenceInfo>;
  /** Priority matrix items sorted by urgency desc */
  priorities: PriorityItem[];
  /** Group name lookup so UI can avoid re-joining */
  groupNames: Record<number, string>;
}

// ── Internal types (raw rows) ────────────────────────────────────────────

interface RawProgressRow {
  student_id: number;
  group_id: number;
  status: "Y" | "N" | "A";
  date_recorded: string;
  ufli_lessons: {
    lesson_number: number;
    lesson_name: string | null;
    is_review: boolean;
  } | null;
}

// ── Metric A: Reteach (Sticky Factor) ────────────────────────────────────

/**
 * Computes per-group reteach info from lesson_progress rows in the window.
 *
 * Pure date-count based: if (group, lesson) shows up on 3+ distinct dates,
 * reteaches = dateCount - 2. Skips absences and review lessons.
 */
export function computeReteach(
  rows: RawProgressRow[],
  windowStartIso: string,
  windowEndIso: string,
): Record<number, ReteachInfo> {
  // (groupId, lessonNumber) → { dates, students, lessonName }
  type LessonAgg = {
    lessonNumber: number;
    lessonName: string | null;
    dates: Set<string>;
    students: Set<number>;
  };
  const groups = new Map<number, Map<number, LessonAgg>>();

  for (const r of rows) {
    if (!r.ufli_lessons) continue;
    if (r.ufli_lessons.is_review) continue;
    if (r.status === "A") continue;
    if (r.date_recorded < windowStartIso || r.date_recorded > windowEndIso) {
      continue;
    }

    let lessonMap = groups.get(r.group_id);
    if (!lessonMap) {
      lessonMap = new Map();
      groups.set(r.group_id, lessonMap);
    }
    let agg = lessonMap.get(r.ufli_lessons.lesson_number);
    if (!agg) {
      agg = {
        lessonNumber: r.ufli_lessons.lesson_number,
        lessonName: r.ufli_lessons.lesson_name,
        dates: new Set(),
        students: new Set(),
      };
      lessonMap.set(r.ufli_lessons.lesson_number, agg);
    }
    agg.dates.add(r.date_recorded);
    agg.students.add(r.student_id);
  }

  const result: Record<number, ReteachInfo> = {};
  for (const [groupId, lessonMap] of groups.entries()) {
    const reteaches: ReteachLessonDetail[] = [];
    let maxReteachCount = 0;
    let maxReteachLessonNumber: number | null = null;
    let maxReteachLessonName: string | null = null;

    for (const agg of lessonMap.values()) {
      const dateCount = agg.dates.size;
      const reteachCount = Math.max(0, dateCount - 2);
      if (reteachCount >= 1) {
        reteaches.push({
          lessonNumber: agg.lessonNumber,
          lessonName: agg.lessonName,
          dateCount,
          reteachCount,
          studentCount: agg.students.size,
        });
      }
      if (reteachCount > maxReteachCount) {
        maxReteachCount = reteachCount;
        maxReteachLessonNumber = agg.lessonNumber;
        maxReteachLessonName = agg.lessonName;
      }
    }

    reteaches.sort((a, b) => b.reteachCount - a.reteachCount);

    result[groupId] = {
      groupId,
      maxReteachCount,
      maxReteachLessonNumber,
      maxReteachLessonName,
      totalLessonsTaught: lessonMap.size,
      reteaches,
    };
  }

  return result;
}

// ── Window helpers (exported so subsequent commits reuse them) ──────────

export function activityWindow(today: Date = new Date()): {
  startIso: string;
  endIso: string;
  startDate: Date;
  endDate: Date;
} {
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setDate(start.getDate() - COACHING_THRESHOLDS.ACTIVITY_WINDOW_DAYS);
  start.setHours(0, 0, 0, 0);
  return {
    startIso: start.toISOString().split("T")[0],
    endIso: end.toISOString().split("T")[0],
    startDate: start,
    endDate: end,
  };
}

/**
 * Loads all lesson_progress rows for a school within the window, with
 * ufli_lessons joined for lesson_number / is_review. Exported for reuse
 * by subsequent metric functions.
 */
export async function loadCoachingProgress(
  schoolId: number,
  yearId: number,
  windowStartIso: string,
  windowEndIso: string,
): Promise<RawProgressRow[]> {
  const supabase = await createClient();

  // Active students in this school — scope the progress query via IN
  const { data: studentRows } = await supabase
    .from("students")
    .select("student_id")
    .eq("school_id", schoolId)
    .eq("enrollment_status", "active");

  const studentIds = (studentRows ?? []).map(
    (r) => (r as { student_id: number }).student_id,
  );
  if (studentIds.length === 0) return [];

  const { data: progressRows } = await supabase
    .from("lesson_progress")
    .select(
      "student_id, group_id, status, date_recorded, ufli_lessons!inner(lesson_number, lesson_name, is_review)",
    )
    .in("student_id", studentIds)
    .eq("year_id", yearId)
    .gte("date_recorded", windowStartIso)
    .lte("date_recorded", windowEndIso);

  return (progressRows ?? []) as unknown as RawProgressRow[];
}
