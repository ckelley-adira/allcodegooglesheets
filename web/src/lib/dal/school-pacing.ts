/**
 * @file dal/school-pacing.ts — School-wide pacing & coverage view
 *
 * Powers the school pacing & coverage section on the dashboard home.
 * Computes per-group activity health (fresh / stale / never logged)
 * and a school-wide coverage rollup (% of active students with at
 * least one lesson recorded in the last 7 days).
 *
 * Shares the GroupHealth classification with teacher-detail.ts but
 * scopes the query to all groups in a school instead of one teacher's
 * groups.
 *
 * @rls School-scoping enforced via the explicit schoolId parameter.
 */

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { classifyHealth, daysBetween, type GroupHealth } from "./group-health";

export type { GroupHealth };

// ── Pacing Detail types ────────────────────────────────────────────────

export interface StudentActivityRow {
  studentId: number;
  studentName: string;
  gradeName: string;
  groupId: number | null;
  groupName: string | null;
  lastActivityDate: string | null;
  daysSinceLastActivity: number | null;
  health: GroupHealth;
}

export interface GroupActivityDetail extends SchoolGroupHealthRow {
  students: StudentActivityRow[];
  freshCount: number;
  staleCount: number;
  neverCount: number;
}

export interface CoverageWeek {
  weekStartDate: string;
  activeStudents: number;
  totalStudents: number;
  coveragePct: number;
}

export interface PacingDetail {
  coverageTimeline: CoverageWeek[];
  groups: GroupActivityDetail[];
  allStudents: StudentActivityRow[];
  schoolCoveragePct: number | null;
  totalActiveStudents: number;
}

export interface SchoolGroupHealthRow {
  groupId: number;
  groupName: string;
  gradeName: string;
  staffName: string;
  staffId: number;
  isMixedGrade: boolean;
  isActive: boolean;
  memberCount: number;
  lastActivityDate: string | null;
  daysSinceLastActivity: number | null;
  health: GroupHealth;
}

export interface SchoolPacingSummary {
  /** All active groups for the school */
  groups: SchoolGroupHealthRow[];
  /** Active students with at least one lesson_progress row in the last 7 days */
  studentsWithRecentActivity: number;
  /** Total active students in the school */
  totalActiveStudents: number;
  /** Coverage % = studentsWithRecentActivity / totalActiveStudents */
  coveragePct: number | null;
  /** Group health counts */
  freshGroupCount: number;
  staleOneWeekGroupCount: number;
  staleTwoWeekGroupCount: number;
  neverLoggedGroupCount: number;
}

export async function getSchoolPacingSummary(
  schoolId: number,
): Promise<SchoolPacingSummary> {
  const supabase = await createClient();

  // 1. All groups for the school
  const { data: groupsRaw } = await supabase
    .from("instructional_groups")
    .select(
      "group_id, group_name, is_mixed_grade, is_active, staff_id, grade_levels!grade_id(name), staff(first_name, last_name)",
    )
    .eq("school_id", schoolId)
    .order("group_name", { ascending: true });

  if (!groupsRaw || groupsRaw.length === 0) {
    return {
      groups: [],
      studentsWithRecentActivity: 0,
      totalActiveStudents: 0,
      coveragePct: null,
      freshGroupCount: 0,
      staleOneWeekGroupCount: 0,
      staleTwoWeekGroupCount: 0,
      neverLoggedGroupCount: 0,
    };
  }

  const groupIds = (groupsRaw as unknown as { group_id: number }[]).map(
    (g) => g.group_id,
  );

  // 2. Member counts per group (paginated — 500+ students × many groups)
  const memberships = await fetchAllRows<{ group_id: number; student_id: number }>(
    (from, to) =>
      supabase
        .from("group_memberships")
        .select("group_id, student_id")
        .eq("is_active", true)
        .in("group_id", groupIds)
        .range(from, to),
  );

  const memberCountMap = new Map<number, number>();
  const memberStudentIds = new Set<number>();
  for (const row of memberships) {
    memberCountMap.set(row.group_id, (memberCountMap.get(row.group_id) ?? 0) + 1);
    memberStudentIds.add(row.student_id);
  }

  // 3. Last activity per group + recent (7-day) student activity for coverage
  //    Paginated: all lesson_progress for all groups can be 50K+ rows at scale.
  const progressRows = await fetchAllRows<{
    group_id: number;
    student_id: number;
    date_recorded: string;
  }>((from, to) =>
    supabase
      .from("lesson_progress")
      .select("group_id, student_id, date_recorded")
      .in("group_id", groupIds)
      .range(from, to),
  );

  const lastActivityMap = new Map<number, string>();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString().split("T")[0];
  const studentsWithRecent = new Set<number>();

  for (const row of progressRows) {
    const existing = lastActivityMap.get(row.group_id);
    if (!existing || row.date_recorded > existing) {
      lastActivityMap.set(row.group_id, row.date_recorded);
    }
    if (row.date_recorded >= sevenDaysAgoIso) {
      studentsWithRecent.add(row.student_id);
    }
  }


  // 4. Total active students for the school (includes students who may
  // not be in any group yet)
  const { count: totalStudentCount } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("enrollment_status", "active");
  const totalActive = totalStudentCount ?? 0;

  // 5. Compose the per-group rows
  const groups: SchoolGroupHealthRow[] = (
    groupsRaw as unknown as {
      group_id: number;
      group_name: string;
      is_mixed_grade: boolean;
      is_active: boolean;
      staff_id: number;
      grade_levels: { name: string } | null;
      staff: { first_name: string; last_name: string } | null;
    }[]
  ).map((g) => {
    const lastActivity = lastActivityMap.get(g.group_id) ?? null;
    const daysSince = lastActivity ? daysBetween(lastActivity) : null;
    return {
      groupId: g.group_id,
      groupName: g.group_name,
      gradeName: g.grade_levels?.name ?? "",
      staffName: `${g.staff?.first_name ?? ""} ${g.staff?.last_name ?? ""}`.trim(),
      staffId: g.staff_id,
      isMixedGrade: g.is_mixed_grade,
      isActive: g.is_active,
      memberCount: memberCountMap.get(g.group_id) ?? 0,
      lastActivityDate: lastActivity,
      daysSinceLastActivity: daysSince,
      health: classifyHealth(daysSince),
    };
  });

  // 6. Health counts
  let fresh = 0;
  let stale1 = 0;
  let stale2 = 0;
  let neverLogged = 0;
  for (const g of groups) {
    // Only count active groups in the health rollup
    if (!g.isActive) continue;
    switch (g.health) {
      case "fresh":
        fresh++;
        break;
      case "stale_1w":
        stale1++;
        break;
      case "stale_2w":
        stale2++;
        break;
      case "never_logged":
        neverLogged++;
        break;
    }
  }

  return {
    groups,
    studentsWithRecentActivity: studentsWithRecent.size,
    totalActiveStudents: totalActive,
    coveragePct: totalActive > 0 ? (studentsWithRecent.size / totalActive) * 100 : null,
    freshGroupCount: fresh,
    staleOneWeekGroupCount: stale1,
    staleTwoWeekGroupCount: stale2,
    neverLoggedGroupCount: neverLogged,
  };
}

// ── Pacing Detail (per-student + coverage timeline) ─────────────────────

/**
 * Returns Monday of a given week (ISO 8601: Monday-anchored).
 */
function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7; // Sunday = 7
  d.setDate(d.getDate() - day + 1);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Full pacing detail: per-student last-seen data, per-group member
 * breakdowns, and week-over-week coverage timeline. Powers the
 * /dashboard/pacing page.
 *
 * Accepts optional grade and health filters to narrow results
 * server-side (URL search param driven).
 */
export async function getPacingDetail(
  schoolId: number,
  filters?: { gradeFilter?: string[]; healthFilter?: GroupHealth[] },
): Promise<PacingDetail> {
  const supabase = await createClient();

  // 1. Active students with grade + group membership
  const { data: studentRows } = await supabase
    .from("students")
    .select(
      "student_id, first_name, last_name, grade_levels!grade_id(name)",
    )
    .eq("school_id", schoolId)
    .eq("enrollment_status", "active");

  type StudentRow = {
    student_id: number;
    first_name: string;
    last_name: string;
    grade_levels: { name: string } | null;
  };
  const students = ((studentRows ?? []) as unknown as StudentRow[]).map(
    (r) => ({
      studentId: r.student_id,
      studentName: `${r.first_name} ${r.last_name}`.trim(),
      gradeName: r.grade_levels?.name ?? "",
    }),
  );
  const totalActiveStudents = students.length;

  if (students.length === 0) {
    return {
      coverageTimeline: [],
      groups: [],
      allStudents: [],
      schoolCoveragePct: null,
      totalActiveStudents: 0,
    };
  }

  const studentIds = students.map((s) => s.studentId);
  const studentLookup = new Map(
    students.map((s) => [s.studentId, s]),
  );

  // 2. Group memberships + group metadata
  const { data: groupsRaw } = await supabase
    .from("instructional_groups")
    .select(
      "group_id, group_name, is_mixed_grade, is_active, staff_id, grade_levels!grade_id(name), staff(first_name, last_name)",
    )
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("group_name", { ascending: true });

  const groupIds = ((groupsRaw ?? []) as unknown as { group_id: number }[]).map(
    (g) => g.group_id,
  );

  const memberships = groupIds.length > 0
    ? await fetchAllRows<{ group_id: number; student_id: number }>(
        (from, to) =>
          supabase
            .from("group_memberships")
            .select("group_id, student_id")
            .eq("is_active", true)
            .in("group_id", groupIds)
            .range(from, to),
      )
    : [];

  // Map: studentId → { groupId, groupName }
  const studentGroupMap = new Map<
    number,
    { groupId: number; groupName: string }
  >();
  // Map: groupId → studentId[]
  const groupMemberMap = new Map<number, number[]>();

  for (const g of (groupsRaw ?? []) as unknown as {
    group_id: number;
    group_name: string;
  }[]) {
    groupMemberMap.set(g.group_id, []);
  }
  for (const m of memberships) {
    const gRaw = (groupsRaw ?? []).find(
      (g) => (g as unknown as { group_id: number }).group_id === m.group_id,
    ) as unknown as { group_id: number; group_name: string } | undefined;
    if (gRaw) {
      studentGroupMap.set(m.student_id, {
        groupId: gRaw.group_id,
        groupName: gRaw.group_name,
      });
      groupMemberMap.get(m.group_id)?.push(m.student_id);
    }
  }

  // 3. Lesson_progress rows for per-student last-seen + timeline
  //    We need 8 weeks for the timeline + enough history to find each
  //    student's most recent record. 90 days covers the timeline and
  //    any "stale 2w+" students while avoiding fetching the full year.
  //    Students with NO records in this window will correctly show as
  //    "never_logged" (their last-seen stays null).
  const today = new Date();
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgoIso = isoDate(ninetyDaysAgo);

  const progressRows = await fetchAllRows<{
    student_id: number;
    date_recorded: string;
  }>((from, to) =>
    supabase
      .from("lesson_progress")
      .select("student_id, date_recorded")
      .in("student_id", studentIds)
      .gte("date_recorded", ninetyDaysAgoIso)
      .range(from, to),
  );

  // Per-student MAX(date_recorded)
  const lastSeenMap = new Map<number, string>();
  for (const r of progressRows) {
    const existing = lastSeenMap.get(r.student_id);
    if (!existing || r.date_recorded > existing) {
      lastSeenMap.set(r.student_id, r.date_recorded);
    }
  }

  // 4. Coverage timeline: last 8 weeks
  const thisMonday = startOfWeekMonday(today);
  const coverageTimeline: CoverageWeek[] = [];

  for (let i = 7; i >= 0; i--) {
    const weekMon = new Date(thisMonday);
    weekMon.setDate(weekMon.getDate() - i * 7);
    const weekSun = new Date(weekMon);
    weekSun.setDate(weekSun.getDate() + 6);
    const monIso = isoDate(weekMon);
    const sunIso = isoDate(weekSun);

    const activeSet = new Set<number>();
    for (const r of progressRows) {
      if (r.date_recorded >= monIso && r.date_recorded <= sunIso) {
        activeSet.add(r.student_id);
      }
    }

    coverageTimeline.push({
      weekStartDate: monIso,
      activeStudents: activeSet.size,
      totalStudents: totalActiveStudents,
      coveragePct:
        totalActiveStudents > 0
          ? (activeSet.size / totalActiveStudents) * 100
          : 0,
    });
  }

  // 5. Build per-student activity rows
  let allStudents: StudentActivityRow[] = students.map((s) => {
    const lastDate = lastSeenMap.get(s.studentId) ?? null;
    const daysSince = lastDate ? daysBetween(lastDate) : null;
    const group = studentGroupMap.get(s.studentId);
    return {
      studentId: s.studentId,
      studentName: s.studentName,
      gradeName: s.gradeName,
      groupId: group?.groupId ?? null,
      groupName: group?.groupName ?? null,
      lastActivityDate: lastDate,
      daysSinceLastActivity: daysSince,
      health: classifyHealth(daysSince),
    };
  });

  // Apply filters
  if (filters?.gradeFilter && filters.gradeFilter.length > 0) {
    const grades = new Set(filters.gradeFilter);
    allStudents = allStudents.filter((s) => grades.has(s.gradeName));
  }
  if (filters?.healthFilter && filters.healthFilter.length > 0) {
    const healths = new Set(filters.healthFilter);
    allStudents = allStudents.filter((s) => healths.has(s.health));
  }

  // Sort: most stale first (never → stale_2w → stale_1w → fresh), then name
  const healthOrder: Record<GroupHealth, number> = {
    never_logged: 0,
    stale_2w: 1,
    stale_1w: 2,
    fresh: 3,
  };
  allStudents.sort((a, b) => {
    if (healthOrder[a.health] !== healthOrder[b.health]) {
      return healthOrder[a.health] - healthOrder[b.health];
    }
    return a.studentName.localeCompare(b.studentName);
  });

  // 6. Build per-group detail
  const filteredStudentIds = new Set(allStudents.map((s) => s.studentId));

  const groups: GroupActivityDetail[] = (
    (groupsRaw ?? []) as unknown as {
      group_id: number;
      group_name: string;
      is_mixed_grade: boolean;
      is_active: boolean;
      staff_id: number;
      grade_levels: { name: string } | null;
      staff: { first_name: string; last_name: string } | null;
    }[]
  ).map((g) => {
    const memberIds = groupMemberMap.get(g.group_id) ?? [];
    const groupStudents = memberIds
      .map((id) => allStudents.find((s) => s.studentId === id))
      .filter((s): s is StudentActivityRow => !!s);

    // Group-level last activity
    const lastActivity =
      memberIds.reduce<string | null>((max, id) => {
        const d = lastSeenMap.get(id);
        if (!d) return max;
        return !max || d > max ? d : max;
      }, null);
    const daysSince = lastActivity ? daysBetween(lastActivity) : null;

    return {
      groupId: g.group_id,
      groupName: g.group_name,
      gradeName: g.grade_levels?.name ?? "",
      staffName: `${g.staff?.first_name ?? ""} ${g.staff?.last_name ?? ""}`.trim(),
      staffId: g.staff_id,
      isMixedGrade: g.is_mixed_grade,
      isActive: g.is_active,
      memberCount: memberIds.length,
      lastActivityDate: lastActivity,
      daysSinceLastActivity: daysSince,
      health: classifyHealth(daysSince),
      students: groupStudents,
      freshCount: groupStudents.filter((s) => s.health === "fresh").length,
      staleCount: groupStudents.filter(
        (s) => s.health === "stale_1w" || s.health === "stale_2w",
      ).length,
      neverCount: groupStudents.filter((s) => s.health === "never_logged").length,
    };
  });

  // Filter groups: only include groups that have at least one visible student
  // (after grade/health filters). Skip if no filters applied.
  const filteredGroups =
    filters?.gradeFilter?.length || filters?.healthFilter?.length
      ? groups.filter((g) => g.students.length > 0)
      : groups;

  // 7. School-wide coverage (7-day)
  const sevenDaysAgoIso = isoDate(
    new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
  );
  const recentStudents = new Set<number>();
  for (const r of progressRows) {
    if (r.date_recorded >= sevenDaysAgoIso) recentStudents.add(r.student_id);
  }

  return {
    coverageTimeline,
    groups: filteredGroups,
    allStudents,
    schoolCoveragePct:
      totalActiveStudents > 0
        ? (recentStudents.size / totalActiveStudents) * 100
        : null,
    totalActiveStudents,
  };
}
