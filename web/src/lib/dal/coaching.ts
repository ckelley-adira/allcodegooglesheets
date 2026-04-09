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
import {
  COACHING_THRESHOLDS,
  TARGET_LESSONS_PER_WEEK,
  SECTION_REVIEW_LESSONS,
  REVIEW_LESSONS,
} from "@/config/ufli";
import {
  sectionForLesson,
  effectiveSectionLessons,
  sectionSize as sectionSizeFn,
  sectionMinThreshold,
  previousSection,
  lastLessonInSection,
  type SkillSectionName,
  computeGatewayState,
  type SectionGatewayState,
} from "@/lib/curriculum/sections";

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

// ── Helper: Gateway-first mastery percentage ────────────────────────────

/**
 * Compute section mastery with gateway-first logic:
 *   1. If gateway for this section is "passed" → 100%
 *   2. Otherwise → (non-review lessons passed / non-review total) × 100
 */
function gatewayFirstPct(
  gatewayState: SectionGatewayState | undefined,
  nonReviewLessons: number[],
  passedLessons: Set<number>,
): number {
  if (gatewayState?.status === "passed") return 100;
  const total = nonReviewLessons.length || 1;
  const passed = nonReviewLessons.filter((l) => passedLessons.has(l)).length;
  return (passed / total) * 100;
}

// ── Metric B: Group Pass Rate + Bridge Detection ────────────────────────

/**
 * Computes per-group mastery info. Needs both windowed progress rows
 * (for primary-section detection and lessons-attempted count) and the
 * full-year progress rows (for high-water-mark section mastery).
 *
 * Per-student section mastery = (passed lessons in effective section) /
 * (total effective lessons). High-water-mark semantics: any Y ever =
 * passed forever, so we pass every Y row from the full year.
 *
 * Primary section is voted: each student's most-recent non-absent
 * lesson maps to a section, and the section with the most votes wins.
 *
 * v2.1 bridge detection: lessonsAttempted (in primary section, from the
 * window) must meet sectionMinThreshold before mastery flags fire.
 *
 * Previous-section completion: if the group's recent lessons include
 * the last lesson of the previous (non-bridging) section, compute
 * mastery on that section so the caller can surface a celebration or
 * weak-section-close flag.
 */
export function computeGroupMastery(
  windowRows: RawProgressRow[],
  fullYearRows: RawProgressRow[],
  groupMembers: Map<number, Array<{ studentId: number }>>,
): Record<number, GroupMasteryInfo> {
  // 1. Build high-water-mark set per student from the full year
  // studentId → set of lesson numbers ever passed (Y)
  const hwm = new Map<number, Set<number>>();
  for (const r of fullYearRows) {
    if (r.status !== "Y") continue;
    if (!r.ufli_lessons) continue;
    let set = hwm.get(r.student_id);
    if (!set) {
      set = new Set();
      hwm.set(r.student_id, set);
    }
    set.add(r.ufli_lessons.lesson_number);
  }

  // 1b. Build attempted review lesson set per student (for gateway checks)
  // studentId → set of review lesson numbers with Y or N
  const attemptedByStudent = new Map<number, Set<number>>();
  for (const r of fullYearRows) {
    if (r.status === "A") continue; // skip absences
    if (!r.ufli_lessons) continue;
    if (!r.ufli_lessons.is_review) continue; // only review lessons
    let set = attemptedByStudent.get(r.student_id);
    if (!set) {
      set = new Set();
      attemptedByStudent.set(r.student_id, set);
    }
    set.add(r.ufli_lessons.lesson_number);
  }

  // 2. Most-recent non-absent lesson per student in the window
  // studentId → { date, lessonNumber }
  const lastLesson = new Map<number, { date: string; lessonNumber: number }>();
  for (const r of windowRows) {
    if (r.status === "A") continue;
    if (!r.ufli_lessons) continue;
    const existing = lastLesson.get(r.student_id);
    if (!existing || r.date_recorded > existing.date) {
      lastLesson.set(r.student_id, {
        date: r.date_recorded,
        lessonNumber: r.ufli_lessons.lesson_number,
      });
    }
  }

  // 3. Lessons attempted per group (distinct non-absent lesson numbers in window)
  const groupLessonsAttempted = new Map<number, Set<number>>();
  for (const r of windowRows) {
    if (r.status === "A") continue;
    if (!r.ufli_lessons) continue;
    let set = groupLessonsAttempted.get(r.group_id);
    if (!set) {
      set = new Set();
      groupLessonsAttempted.set(r.group_id, set);
    }
    set.add(r.ufli_lessons.lesson_number);
  }

  // 4. Compose per-group
  const result: Record<number, GroupMasteryInfo> = {};
  for (const [groupId, members] of groupMembers.entries()) {
    // Vote for primary section
    const sectionVotes = new Map<SkillSectionName, number>();
    for (const m of members) {
      const ll = lastLesson.get(m.studentId);
      if (!ll) continue;
      const section = sectionForLesson(ll.lessonNumber);
      if (!section) continue;
      sectionVotes.set(section, (sectionVotes.get(section) ?? 0) + 1);
    }
    let primarySection: SkillSectionName | null = null;
    let maxVotes = 0;
    for (const [section, votes] of sectionVotes.entries()) {
      if (votes > maxVotes) {
        maxVotes = votes;
        primarySection = section;
      }
    }

    // Mastery count on the primary section (gateway-first logic)
    let masteryCount = 0;
    let sectionPctSum = 0;
    let sectionPctN = 0;
    if (primarySection) {
      const nonReviewLessons = effectiveSectionLessons(primarySection).filter(
        (ln) => !REVIEW_LESSONS.has(ln),
      );
      for (const m of members) {
        const passed = hwm.get(m.studentId) ?? new Set<number>();
        const attempted = attemptedByStudent.get(m.studentId) ?? new Set<number>();
        const gwState = computeGatewayState(passed, attempted).get(
          primarySection,
        );
        const pct = gatewayFirstPct(gwState, nonReviewLessons, passed);
        sectionPctSum += pct;
        sectionPctN++;
        if (pct >= COACHING_THRESHOLDS.MASTERY_THRESHOLD) masteryCount++;
      }
    }

    const lessonsAttemptedSet = groupLessonsAttempted.get(groupId);
    let lessonsAttempted = 0;
    if (primarySection && lessonsAttemptedSet) {
      const effective = new Set(effectiveSectionLessons(primarySection));
      for (const ln of lessonsAttemptedSet) {
        if (effective.has(ln)) lessonsAttempted++;
      }
    }

    const size = primarySection ? sectionSizeFn(primarySection) : 0;
    const minThreshold = primarySection ? sectionMinThreshold(primarySection) : 0;
    const isBridging =
      primarySection !== null && lessonsAttempted < minThreshold;

    // Previous section completion detection (gateway-first logic)
    let completedPrevSection: SkillSectionName | null = null;
    let prevSectionMasteryPct: number | null = null;
    if (primarySection) {
      const prev = previousSection(primarySection);
      if (prev && lessonsAttemptedSet) {
        const lastLn = lastLessonInSection(prev);
        if (lastLn && lessonsAttemptedSet.has(lastLn)) {
          completedPrevSection = prev;
          // Compute mastery on prev with gateway-first logic
          const prevNonReviewLessons = effectiveSectionLessons(prev).filter(
            (ln) => !REVIEW_LESSONS.has(ln),
          );
          let prevMasteryCount = 0;
          let prevCounted = 0;
          for (const m of members) {
            const passed = hwm.get(m.studentId) ?? new Set<number>();
            const attempted =
              attemptedByStudent.get(m.studentId) ?? new Set<number>();
            const gwState = computeGatewayState(passed, attempted).get(prev);
            const pct = gatewayFirstPct(gwState, prevNonReviewLessons, passed);
            prevCounted++;
            if (pct >= COACHING_THRESHOLDS.MASTERY_THRESHOLD)
              prevMasteryCount++;
          }
          prevSectionMasteryPct =
            prevCounted > 0
              ? Math.round((prevMasteryCount / prevCounted) * 100)
              : null;
        }
      }
    }

    result[groupId] = {
      groupId,
      section: primarySection,
      totalStudents: members.length,
      masteryCount,
      masteryPct:
        members.length > 0
          ? Math.round((masteryCount / members.length) * 100)
          : 0,
      avgSectionPct:
        sectionPctN > 0 ? Math.round(sectionPctSum / sectionPctN) : 0,
      isBridging,
      sectionSize: size,
      minThreshold,
      lessonsAttempted,
      completedPrevSection,
      prevSectionMasteryPct,
    };
  }

  return result;
}

// ── Metric C: Student Growth vs. Expected Slope ─────────────────────────

interface WeeklySnapshotLite {
  student_id: number;
  week_start_date: string;
  lessons_taken: number;
  lessons_passed: number;
}

/**
 * Computes per-student growth info from weekly_snapshots rows
 * (populated by Phase C.2). Applies the rolling window + aimline and
 * flags Tier 3 candidates.
 *
 * Dedup rule was already applied at snapshot-capture time, so this
 * function just reads (lessons_taken, lessons_passed) per week and
 * walks the week sequence to count consecutive below-aimline streaks.
 * Weeks with zero taken are treated as "no activity" (not counted
 * toward weeksTracked, not counted toward the streak — matches
 * fcdCalcGrowthSlope_'s all-absent-week skip behavior).
 */
export function computeGrowth(
  snapshots: WeeklySnapshotLite[],
  studentMeta: Map<number, { studentName: string; groupId: number }>,
): Record<number, StudentGrowthInfo> {
  // Only use the most-recent N weeks per student
  const rollingWeeks = COACHING_THRESHOLDS.GROWTH_ROLLING_WEEKS;
  const aimline = TARGET_LESSONS_PER_WEEK;
  const concernThreshold = aimline * COACHING_THRESHOLDS.GROWTH_CONCERN_RATIO;

  // Bucket per-student, sorted ascending by week_start_date
  const byStudent = new Map<number, WeeklySnapshotLite[]>();
  for (const s of snapshots) {
    let arr = byStudent.get(s.student_id);
    if (!arr) {
      arr = [];
      byStudent.set(s.student_id, arr);
    }
    arr.push(s);
  }
  for (const arr of byStudent.values()) {
    arr.sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
  }

  const result: Record<number, StudentGrowthInfo> = {};

  for (const [studentId, meta] of studentMeta.entries()) {
    const arr = byStudent.get(studentId) ?? [];
    // Take the last `rollingWeeks` entries
    const recent = arr.slice(-rollingWeeks);

    let weeksTracked = 0;
    let totalPassed = 0;
    let consecutiveBelow = 0;
    let maxConsecutiveBelow = 0;

    for (const week of recent) {
      // Skip weeks with zero activity (no taken at all = all-absent)
      if (week.lessons_taken === 0) continue;
      weeksTracked++;
      totalPassed += week.lessons_passed;

      if (week.lessons_passed < concernThreshold) {
        consecutiveBelow++;
        if (consecutiveBelow > maxConsecutiveBelow) {
          maxConsecutiveBelow = consecutiveBelow;
        }
      } else {
        consecutiveBelow = 0;
      }
    }

    const avgPerWeek = weeksTracked > 0 ? totalPassed / weeksTracked : 0;
    const ratioPct = Math.round((avgPerWeek / aimline) * 100);
    const tier3Flag =
      maxConsecutiveBelow >= COACHING_THRESHOLDS.GROWTH_CONCERN_WEEKS;

    result[studentId] = {
      studentId,
      studentName: meta.studentName,
      groupId: meta.groupId,
      weeksTracked,
      totalPassed,
      avgPerWeek: Math.round(avgPerWeek * 10) / 10,
      aimline,
      ratioPct,
      belowAimlineWeeks: maxConsecutiveBelow,
      tier3Flag,
    };
  }

  return result;
}

// ── Metric D: Chronic Absenteeism ────────────────────────────────────────

/**
 * Computes per-student absence info from lesson_progress in the window.
 *
 * Ported from fcdCalcAbsenteeism_. For each group, count the distinct
 * dates it met (any activity). For each student in that group, count
 * distinct dates marked 'A'. absencePct = absences / group session count.
 *
 * Flag thresholds: 30% = warning, 40% = critical.
 */
export function computeAbsence(
  windowRows: RawProgressRow[],
  studentMeta: Map<number, { studentName: string; groupId: number }>,
): Record<number, StudentAbsenceInfo> {
  // groupId → set of distinct dates with any activity
  const groupDates = new Map<number, Set<string>>();
  for (const r of windowRows) {
    let set = groupDates.get(r.group_id);
    if (!set) {
      set = new Set();
      groupDates.set(r.group_id, set);
    }
    set.add(r.date_recorded);
  }

  // studentId → set of distinct absence dates
  const studentAbsenceDates = new Map<number, Set<string>>();
  for (const r of windowRows) {
    if (r.status !== "A") continue;
    let set = studentAbsenceDates.get(r.student_id);
    if (!set) {
      set = new Set();
      studentAbsenceDates.set(r.student_id, set);
    }
    set.add(r.date_recorded);
  }

  const result: Record<number, StudentAbsenceInfo> = {};

  for (const [studentId, meta] of studentMeta.entries()) {
    const groupSessionCount = groupDates.get(meta.groupId)?.size ?? 0;
    const absences = studentAbsenceDates.get(studentId)?.size ?? 0;
    const absencePct =
      groupSessionCount > 0
        ? Math.round((absences / groupSessionCount) * 100)
        : 0;

    const flag: StudentAbsenceInfo["flag"] =
      absencePct >= COACHING_THRESHOLDS.ABSENCE_CRITICAL
        ? "critical"
        : absencePct >= COACHING_THRESHOLDS.ABSENCE_WARNING
          ? "warning"
          : "ok";

    result[studentId] = {
      studentId,
      studentName: meta.studentName,
      groupId: meta.groupId,
      totalSessions: groupSessionCount,
      absences,
      absencePct,
      flag,
    };
  }

  return result;
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

// ── Priority Matrix ──────────────────────────────────────────────────────

/**
 * Builds the Coaching Priority Matrix from the four metrics. Ported
 * from fcdBuildPriorityMatrix_ — every rule preserved with the exact
 * thresholds Christina specified.
 *
 * Rules:
 *   1. Celebration      — completedPrevSection && prevMastery >= 80
 *   2. Weak Section Close — completedPrevSection && prevMastery < 80
 *   3. Coaching Focus   — highReteach && lowAbsence
 *   4. Systemic         — lowGrowth && highAbsence
 *   5. Fast-Track       — highPassRate && lowLessonNum && !bridging
 *   6. Fidelity Check   — lowPassRate && lowReteach && !bridging
 *   7. MTSS Tier 3      — per-student: tier3Flag && absencePct < 30
 *
 * Sort: descending by urgency.
 */
export function buildPriorityMatrix(
  reteach: Record<number, ReteachInfo>,
  mastery: Record<number, GroupMasteryInfo>,
  growth: Record<number, StudentGrowthInfo>,
  absence: Record<number, StudentAbsenceInfo>,
  groupNames: Record<number, string>,
  windowRows: RawProgressRow[],
): PriorityItem[] {
  const priorities: PriorityItem[] = [];

  // Collect union of group ids from reteach + mastery
  const allGroupIds = new Set<number>();
  for (const id of Object.keys(reteach)) allGroupIds.add(Number(id));
  for (const id of Object.keys(mastery)) allGroupIds.add(Number(id));

  // Max lesson per group, within window
  const maxLessonByGroup = new Map<number, number>();
  for (const r of windowRows) {
    if (!r.ufli_lessons) continue;
    const existing = maxLessonByGroup.get(r.group_id) ?? 0;
    if (r.ufli_lessons.lesson_number > existing) {
      maxLessonByGroup.set(r.group_id, r.ufli_lessons.lesson_number);
    }
  }

  for (const groupId of allGroupIds) {
    const rt = reteach[groupId] ?? {
      groupId,
      maxReteachCount: 0,
      maxReteachLessonNumber: null,
      maxReteachLessonName: null,
      totalLessonsTaught: 0,
      reteaches: [],
    };
    const ms = mastery[groupId] ?? null;
    const groupName = groupNames[groupId] ?? `Group ${groupId}`;

    // Group-level absence average
    let grpAbsSum = 0;
    let grpAbsN = 0;
    for (const a of Object.values(absence)) {
      if (a.groupId === groupId) {
        grpAbsSum += a.absencePct;
        grpAbsN++;
      }
    }
    const grpAbsAvg = grpAbsN > 0 ? grpAbsSum / grpAbsN : 0;

    // Group-level growth average
    let grpGrowthSum = 0;
    let grpGrowthN = 0;
    for (const g of Object.values(growth)) {
      if (g.groupId === groupId) {
        grpGrowthSum += g.ratioPct;
        grpGrowthN++;
      }
    }
    const grpGrowthAvg = grpGrowthN > 0 ? grpGrowthSum / grpGrowthN : 0;

    const maxLessonInGroup = maxLessonByGroup.get(groupId) ?? 0;

    const highReteach =
      rt.maxReteachCount >= COACHING_THRESHOLDS.RETEACH_WARNING;
    const lowReteach = rt.maxReteachCount === 0;
    const lowAbsence = grpAbsAvg < COACHING_THRESHOLDS.ABSENCE_WARNING;
    const highAbsence = grpAbsAvg >= COACHING_THRESHOLDS.ABSENCE_WARNING;
    const highPassRate =
      ms !== null && ms.masteryPct >= COACHING_THRESHOLDS.FAST_TRACK_PASS_RATE;
    const lowPassRate =
      ms !== null && ms.masteryPct < COACHING_THRESHOLDS.FIDELITY_LOW_PASS_RATE;
    const lowLessonNum =
      maxLessonInGroup > 0 &&
      maxLessonInGroup <= COACHING_THRESHOLDS.FAST_TRACK_MAX_LESSON;
    const lowGrowth = grpGrowthAvg < COACHING_THRESHOLDS.SYSTEMIC_LOW_GROWTH_PCT;
    const isBridging = ms?.isBridging ?? false;

    // Rule: Section completion celebration / weak section close / assign gateway reviews
    if (ms?.completedPrevSection && ms.prevSectionMasteryPct !== null) {
      if (ms.prevSectionMasteryPct >= 80) {
        priorities.push({
          type: "celebration",
          icon: "🎉",
          label: "Section Complete!",
          groupId,
          groupName,
          studentId: null,
          studentName: null,
          detail: `Completed ${ms.completedPrevSection} with ${ms.prevSectionMasteryPct}% at mastery — now entering ${ms.section ?? "next section"}`,
          action: `Celebrate this group! Strong section finish. Monitor first few lessons in ${ms.section ?? "the new section"} for transition support.`,
          urgency: 1,
        });
      } else {
        // Weak section close: suggest gateway reviews if available
        const reviewLessons =
          SECTION_REVIEW_LESSONS[ms.completedPrevSection] ?? [];
        if (reviewLessons.length > 0) {
          priorities.push({
            type: "coaching",
            icon: "🔵",
            label: "Assign Gateway Reviews",
            groupId,
            groupName,
            studentId: null,
            studentName: null,
            detail: `${ms.completedPrevSection} completed at ${ms.prevSectionMasteryPct}% — ${reviewLessons.length} gateway reviews available for additional mastery pathway`,
            action: `Assign ${ms.completedPrevSection} gateway review lessons to this group's sequence. May help students reach mastery via alternative pathway.`,
            urgency: 4.5,
          });
        }
        priorities.push({
          type: "fidelity",
          icon: "🟡",
          label: "Weak Section Close",
          groupId,
          groupName,
          studentId: null,
          studentName: null,
          detail: `Moved past ${ms.completedPrevSection} with only ${ms.prevSectionMasteryPct}% at mastery — gaps may carry forward into ${ms.section ?? "the next section"}`,
          action: `Review whether ${ms.completedPrevSection} skills are solid enough to support ${ms.section ?? "the next section"}. Consider targeted reteach.`,
          urgency: 4,
        });
      }
    }

    // Rule 1: Coaching Focus — high reteach + low absence
    if (highReteach && lowAbsence) {
      const lessonLabel = rt.maxReteachLessonNumber
        ? `L${rt.maxReteachLessonNumber}${rt.maxReteachLessonName ? " " + rt.maxReteachLessonName : ""}`
        : "A lesson";
      priorities.push({
        type: "coaching",
        icon: "🔵",
        label: "Coaching Focus",
        groupId,
        groupName,
        studentId: null,
        studentName: null,
        detail: `${lessonLabel} retaught ${rt.maxReteachCount}× — ${ms?.totalStudents ?? 0} students present`,
        action:
          "Visit this group. Check UFLI Step 5 (Word Work) scaffolding and corrective feedback timing.",
        urgency: 3 + rt.maxReteachCount,
      });
    }

    // Rule 2: Systemic Attendance — low growth + high absence
    if (lowGrowth && highAbsence) {
      priorities.push({
        type: "systemic",
        icon: "🔴",
        label: "Systemic: Attendance",
        groupId,
        groupName,
        studentId: null,
        studentName: null,
        detail: `Avg growth at ${Math.round(grpGrowthAvg)}% of aimline with ${Math.round(grpAbsAvg)}% avg absence rate`,
        action:
          "Contact families/MTSS attendance lead. This is a presence problem, not a reading problem.",
        urgency: 5 + Math.round(grpAbsAvg / 10),
      });
    }

    // Rule 3: Fast-Track — high pass rate + low lesson number + not bridging
    if (highPassRate && lowLessonNum && !isBridging) {
      priorities.push({
        type: "fasttrack",
        icon: "🟢",
        label: "Section Complete",
        groupId,
        groupName,
        studentId: null,
        studentName: null,
        detail: `${ms?.masteryPct ?? 0}% at mastery on ${ms?.section ?? "current section"} (Lesson ${maxLessonInGroup}) — group is under-challenged`,
        action:
          "Skip ahead. This group is ready to accelerate past current sequence.",
        urgency: 2,
      });
    }

    // Rule 4: Fidelity Check — low pass rate + low reteach + not bridging
    if (
      lowPassRate &&
      lowReteach &&
      ms !== null &&
      ms.totalStudents > 0 &&
      !isBridging
    ) {
      priorities.push({
        type: "fidelity",
        icon: "🟡",
        label: "Fidelity Check",
        groupId,
        groupName,
        studentId: null,
        studentName: null,
        detail: `Only ${ms.masteryPct}% at mastery but max ${rt.maxReteachCount} reteaches — curriculum is being covered, not taught`,
        action:
          "Observe lesson delivery. Is teacher teaching to mastery or just moving through the scope?",
        urgency: 4,
      });
    }
  }

  // Per-student MTSS Tier 3 flags
  for (const g of Object.values(growth)) {
    if (!g.tier3Flag) continue;
    const a = absence[g.studentId];
    const absencePct = a?.absencePct ?? 0;
    if (absencePct >= COACHING_THRESHOLDS.ABSENCE_WARNING) continue;
    const groupName = groupNames[g.groupId] ?? `Group ${g.groupId}`;
    priorities.push({
      type: "tier3",
      icon: "🚨",
      label: "MTSS Escalation",
      groupId: g.groupId,
      groupName,
      studentId: g.studentId,
      studentName: g.studentName,
      detail: `${g.studentName} — ${g.belowAimlineWeeks} consecutive weeks below aimline, ${g.avgPerWeek} lessons/wk (aimline: ${g.aimline})`,
      action:
        "Schedule Tier 3 data review. Consider Phonemic Awareness assessment (UFLI Step 3) before continuing Grapheme work.",
      urgency: 8,
    });
  }

  priorities.sort((a, b) => b.urgency - a.urgency);
  return priorities;
}

// ── Main composer ────────────────────────────────────────────────────────

/**
 * The single entry point for the Coaching Priority Matrix. Fetches
 * everything it needs in parallel, runs the four metrics, builds the
 * priority matrix, and returns a composed snapshot ready to render.
 */
export async function getCoachingSnapshot(
  schoolId: number,
  yearId: number,
): Promise<CoachingSnapshot> {
  const supabase = await createClient();
  const { startIso, endIso } = activityWindow();

  // 1. Groups in the school
  const { data: groupsRaw } = await supabase
    .from("instructional_groups")
    .select("group_id, group_name, is_active")
    .eq("school_id", schoolId)
    .eq("is_active", true);

  const groupRows = (groupsRaw ?? []) as Array<{
    group_id: number;
    group_name: string;
    is_active: boolean;
  }>;
  const groupIds = groupRows.map((g) => g.group_id);
  const groupNames: Record<number, string> = {};
  for (const g of groupRows) groupNames[g.group_id] = g.group_name;

  if (groupIds.length === 0) {
    return {
      windowDays: COACHING_THRESHOLDS.ACTIVITY_WINDOW_DAYS,
      groupCount: 0,
      groupsWithReteach: 0,
      tier3Count: 0,
      totalAbsences: 0,
      reteach: {},
      mastery: {},
      growth: {},
      absence: {},
      priorities: [],
      groupNames: {},
    };
  }

  // 2. Active memberships for these groups (+ student names)
  const { data: memberRows } = await supabase
    .from("group_memberships")
    .select(
      "group_id, student_id, students!inner(first_name, last_name, school_id, enrollment_status)",
    )
    .in("group_id", groupIds)
    .eq("is_active", true);

  const groupMembers = new Map<number, Array<{ studentId: number }>>();
  const studentMeta = new Map<
    number,
    { studentName: string; groupId: number }
  >();
  for (const row of memberRows ?? []) {
    const r = row as unknown as {
      group_id: number;
      student_id: number;
      students: {
        first_name: string;
        last_name: string;
        school_id: number;
        enrollment_status: string;
      } | null;
    };
    if (!r.students || r.students.school_id !== schoolId) continue;
    if (r.students.enrollment_status !== "active") continue;

    let arr = groupMembers.get(r.group_id);
    if (!arr) {
      arr = [];
      groupMembers.set(r.group_id, arr);
    }
    arr.push({ studentId: r.student_id });
    studentMeta.set(r.student_id, {
      studentName: `${r.students.first_name} ${r.students.last_name}`.trim(),
      groupId: r.group_id,
    });
  }

  // 3. Parallel data loads
  const studentIds = Array.from(studentMeta.keys());

  const [windowRows, fullYearRowsRaw, snapshotRowsRaw] = await Promise.all([
    loadCoachingProgress(schoolId, yearId, startIso, endIso),
    studentIds.length > 0
      ? supabase
          .from("lesson_progress")
          .select(
            "student_id, group_id, status, date_recorded, ufli_lessons!inner(lesson_number, lesson_name, is_review)",
          )
          .in("student_id", studentIds)
          .eq("year_id", yearId)
          .in("status", ["Y", "N"])
      : Promise.resolve({ data: [] }),
    studentIds.length > 0
      ? supabase
          .from("weekly_snapshots")
          .select("student_id, week_start_date, lessons_taken, lessons_passed")
          .in("student_id", studentIds)
          .eq("year_id", yearId)
      : Promise.resolve({ data: [] }),
  ]);

  const fullYearRows = ((fullYearRowsRaw.data ?? []) as unknown) as RawProgressRow[];
  const snapshots = (snapshotRowsRaw.data ?? []) as unknown as WeeklySnapshotLite[];

  // 4. Run the four metrics
  const reteach = computeReteach(windowRows, startIso, endIso);
  const mastery = computeGroupMastery(windowRows, fullYearRows, groupMembers);
  const growth = computeGrowth(snapshots, studentMeta);
  const absence = computeAbsence(windowRows, studentMeta);

  // 5. Build the priority matrix
  const priorities = buildPriorityMatrix(
    reteach,
    mastery,
    growth,
    absence,
    groupNames,
    windowRows,
  );

  // 6. Summary counts
  let groupsWithReteach = 0;
  for (const r of Object.values(reteach)) {
    if (r.maxReteachCount >= COACHING_THRESHOLDS.RETEACH_WARNING) {
      groupsWithReteach++;
    }
  }
  const tier3Count = priorities.filter((p) => p.type === "tier3").length;
  let totalAbsences = 0;
  for (const a of Object.values(absence)) totalAbsences += a.absences;

  return {
    windowDays: COACHING_THRESHOLDS.ACTIVITY_WINDOW_DAYS,
    groupCount: groupIds.length,
    groupsWithReteach,
    tier3Count,
    totalAbsences,
    reteach,
    mastery,
    growth,
    absence,
    priorities,
    groupNames,
  };
}
