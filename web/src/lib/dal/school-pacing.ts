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

export type GroupHealth = "fresh" | "stale_1w" | "stale_2w" | "never_logged";

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

function classifyHealth(daysSince: number | null): GroupHealth {
  if (daysSince === null) return "never_logged";
  if (daysSince <= 7) return "fresh";
  if (daysSince <= 14) return "stale_1w";
  return "stale_2w";
}

function daysBetween(fromIso: string): number {
  const today = new Date();
  const from = new Date(fromIso);
  const diffMs = today.getTime() - from.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
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

  // 2. Member counts per group
  const { data: memberships } = await supabase
    .from("group_memberships")
    .select("group_id, student_id")
    .eq("is_active", true)
    .in("group_id", groupIds);

  const memberCountMap = new Map<number, number>();
  const memberStudentIds = new Set<number>();
  for (const m of memberships ?? []) {
    const row = m as { group_id: number; student_id: number };
    memberCountMap.set(row.group_id, (memberCountMap.get(row.group_id) ?? 0) + 1);
    memberStudentIds.add(row.student_id);
  }

  // 3. Last activity per group + recent (7-day) student activity for coverage
  const { data: progressRows } = await supabase
    .from("lesson_progress")
    .select("group_id, student_id, date_recorded")
    .in("group_id", groupIds);

  const lastActivityMap = new Map<number, string>();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString().split("T")[0];
  const studentsWithRecent = new Set<number>();

  for (const r of progressRows ?? []) {
    const row = r as {
      group_id: number;
      student_id: number;
      date_recorded: string;
    };
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
