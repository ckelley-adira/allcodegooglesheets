/**
 * @file dal/teacher-detail.ts — Per-teacher dashboard view
 *
 * Powers the /dashboard/staff/[staffId] page. Gathers a teacher's
 * groups + per-group health signals: member count, last activity
 * date (catches "the teacher who hasn't logged anything in 2 weeks"),
 * current sequence position, pace state, and pass rate.
 *
 * @rls School-scoping enforced via the explicit schoolId parameter.
 */

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { classifyHealth, daysBetween, type GroupHealth } from "./group-health";

export type { GroupHealth };

// ── Types ────────────────────────────────────────────────────────────────

export interface TeacherHeader {
  staffId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: "tutor" | "coach" | "school_admin" | "tilt_admin";
  isActive: boolean;
}

export interface TeacherGroupRow {
  groupId: number;
  groupName: string;
  gradeName: string;
  isMixedGrade: boolean;
  isActive: boolean;
  memberCount: number;
  /** Date of the most recent lesson_progress row across any of the group's
   *  active members. null if no activity ever. */
  lastActivityDate: string | null;
  /** Days since last activity (computed from lastActivityDate) */
  daysSinceLastActivity: number | null;
  /** Activity health classification */
  health: GroupHealth;
  /** Total Y across all members in the last 28 days */
  recentYCount: number;
  /** Total N across all members in the last 28 days */
  recentNCount: number;
  /** Total A across all members in the last 28 days */
  recentACount: number;
  /** Pass rate over last 28 days: Y / (Y + N) */
  recentPassRate: number | null;
  /** Active sequence's current lesson, if any */
  currentLessonNumber: number | null;
  currentLessonName: string | null;
  /** Sequence progress: completed / total lessons */
  sequenceCompleted: number;
  sequenceTotal: number;
}

export interface TeacherDetail {
  header: TeacherHeader;
  groups: TeacherGroupRow[];
  /** Rollup across all of the teacher's groups */
  rollup: {
    totalGroups: number;
    activeGroups: number;
    totalStudents: number;
    aggregatePassRate: number | null;
    staleGroupCount: number;
    neverLoggedGroupCount: number;
  };
}

export async function getTeacherDetail(
  staffId: number,
  schoolId: number,
): Promise<TeacherDetail | null> {
  const supabase = await createClient();

  // 1. Header
  const { data: staffRow } = await supabase
    .from("staff")
    .select("staff_id, first_name, last_name, email, role, is_active")
    .eq("staff_id", staffId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!staffRow) return null;
  const sRow = staffRow as unknown as {
    staff_id: number;
    first_name: string;
    last_name: string;
    email: string;
    role: TeacherHeader["role"];
    is_active: boolean;
  };
  const header: TeacherHeader = {
    staffId: sRow.staff_id,
    firstName: sRow.first_name,
    lastName: sRow.last_name,
    email: sRow.email,
    role: sRow.role,
    isActive: sRow.is_active,
  };

  // 2. All groups assigned to this teacher
  const { data: groupsRaw } = await supabase
    .from("instructional_groups")
    .select(
      "group_id, group_name, is_mixed_grade, is_active, grade_levels!grade_id(name)",
    )
    .eq("staff_id", staffId)
    .eq("school_id", schoolId)
    .order("group_name", { ascending: true });

  if (!groupsRaw || groupsRaw.length === 0) {
    return {
      header,
      groups: [],
      rollup: {
        totalGroups: 0,
        activeGroups: 0,
        totalStudents: 0,
        aggregatePassRate: null,
        staleGroupCount: 0,
        neverLoggedGroupCount: 0,
      },
    };
  }

  const groupIds = (groupsRaw as unknown as { group_id: number }[]).map(
    (g) => g.group_id,
  );

  // 3. Member counts (active memberships) per group
  const { data: memberships } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("is_active", true)
    .in("group_id", groupIds);
  const memberCountMap = new Map<number, number>();
  for (const m of memberships ?? []) {
    const row = m as { group_id: number };
    memberCountMap.set(row.group_id, (memberCountMap.get(row.group_id) ?? 0) + 1);
  }

  // 4. Last-activity date per group: max(date_recorded) across the group's
  // lesson_progress rows. Paginated — teacher's groups can have 10K+ rows.
  const activityRows = await fetchAllRows<{
    group_id: number;
    date_recorded: string;
    status: "Y" | "N" | "A";
  }>((from, to) =>
    supabase
      .from("lesson_progress")
      .select("group_id, date_recorded, status")
      .in("group_id", groupIds)
      .range(from, to),
  );

  const lastActivityMap = new Map<number, string>();
  // Recent (28-day) Y/N/A counts per group
  const recentCountsMap = new Map<
    number,
    { y: number; n: number; a: number }
  >();
  const today = new Date();
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - 28);
  const windowStartIso = windowStart.toISOString().split("T")[0];

  for (const row of activityRows) {
    const existing = lastActivityMap.get(row.group_id);
    if (!existing || row.date_recorded > existing) {
      lastActivityMap.set(row.group_id, row.date_recorded);
    }
    if (row.date_recorded >= windowStartIso) {
      const counts = recentCountsMap.get(row.group_id) ?? {
        y: 0,
        n: 0,
        a: 0,
      };
      if (row.status === "Y") counts.y++;
      else if (row.status === "N") counts.n++;
      else counts.a++;
      recentCountsMap.set(row.group_id, counts);
    }
  }

  // 5. Active sequence current lesson per group (one query)
  const { data: sequencesRaw } = await supabase
    .from("instructional_sequences")
    .select("sequence_id, group_id")
    .in("group_id", groupIds)
    .eq("status", "active");

  const groupToSequenceId = new Map<number, number>();
  const sequenceIds: number[] = [];
  for (const s of sequencesRaw ?? []) {
    const row = s as { sequence_id: number; group_id: number };
    groupToSequenceId.set(row.group_id, row.sequence_id);
    sequenceIds.push(row.sequence_id);
  }

  // Per-sequence: count lessons, find current lesson, count completed
  const sequenceStatsMap = new Map<
    number,
    {
      total: number;
      completed: number;
      currentLessonNumber: number | null;
      currentLessonName: string | null;
    }
  >();
  if (sequenceIds.length > 0) {
    const { data: seqLessons } = await supabase
      .from("instructional_sequence_lessons")
      .select("sequence_id, status, ufli_lessons(lesson_number, lesson_name)")
      .in("sequence_id", sequenceIds);

    for (const l of seqLessons ?? []) {
      const row = l as unknown as {
        sequence_id: number;
        status: "upcoming" | "current" | "completed" | "skipped";
        ufli_lessons: { lesson_number: number; lesson_name: string | null } | null;
      };
      const stats = sequenceStatsMap.get(row.sequence_id) ?? {
        total: 0,
        completed: 0,
        currentLessonNumber: null,
        currentLessonName: null,
      };
      stats.total++;
      if (row.status === "completed") stats.completed++;
      if (row.status === "current") {
        stats.currentLessonNumber = row.ufli_lessons?.lesson_number ?? null;
        stats.currentLessonName = row.ufli_lessons?.lesson_name ?? null;
      }
      sequenceStatsMap.set(row.sequence_id, stats);
    }
  }

  // 6. Compose the per-group rows
  const groups: TeacherGroupRow[] = (
    groupsRaw as unknown as {
      group_id: number;
      group_name: string;
      is_mixed_grade: boolean;
      is_active: boolean;
      grade_levels: { name: string } | null;
    }[]
  ).map((g) => {
    const lastActivity = lastActivityMap.get(g.group_id) ?? null;
    const daysSince = lastActivity ? daysBetween(lastActivity) : null;
    const counts = recentCountsMap.get(g.group_id) ?? { y: 0, n: 0, a: 0 };
    const sequenceId = groupToSequenceId.get(g.group_id);
    const seqStats = sequenceId ? sequenceStatsMap.get(sequenceId) : undefined;
    const denominator = counts.y + counts.n;
    return {
      groupId: g.group_id,
      groupName: g.group_name,
      gradeName: g.grade_levels?.name ?? "",
      isMixedGrade: g.is_mixed_grade,
      isActive: g.is_active,
      memberCount: memberCountMap.get(g.group_id) ?? 0,
      lastActivityDate: lastActivity,
      daysSinceLastActivity: daysSince,
      health: classifyHealth(daysSince),
      recentYCount: counts.y,
      recentNCount: counts.n,
      recentACount: counts.a,
      recentPassRate: denominator > 0 ? (counts.y / denominator) * 100 : null,
      currentLessonNumber: seqStats?.currentLessonNumber ?? null,
      currentLessonName: seqStats?.currentLessonName ?? null,
      sequenceCompleted: seqStats?.completed ?? 0,
      sequenceTotal: seqStats?.total ?? 0,
    };
  });

  // 7. Rollup across all groups
  let totalStudents = 0;
  let totalY = 0;
  let totalN = 0;
  let staleCount = 0;
  let neverLoggedCount = 0;
  for (const g of groups) {
    if (g.isActive) totalStudents += g.memberCount;
    totalY += g.recentYCount;
    totalN += g.recentNCount;
    if (g.health === "stale_1w" || g.health === "stale_2w") staleCount++;
    if (g.health === "never_logged") neverLoggedCount++;
  }
  const aggregateDenom = totalY + totalN;

  return {
    header,
    groups,
    rollup: {
      totalGroups: groups.length,
      activeGroups: groups.filter((g) => g.isActive).length,
      totalStudents,
      aggregatePassRate:
        aggregateDenom > 0 ? (totalY / aggregateDenom) * 100 : null,
      staleGroupCount: staleCount,
      neverLoggedGroupCount: neverLoggedCount,
    },
  };
}
