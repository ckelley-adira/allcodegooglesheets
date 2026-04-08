/**
 * @file dal/cliffs.ts — Known-Cliff Alerts (Phase D.2)
 *
 * Finds groups that are approaching one of the six canonical UFLI
 * cliffs. Alert trigger is proximity-based per .docx Section 4.4:
 * a group fires when their max lesson is within 3 lessons before the
 * cliff's trigger lesson and hasn't yet crossed it.
 *
 * Scope: single school. The composer reads the same activity window
 * the Priority Matrix uses (default 14 days) so "current lesson" for
 * a group is derived from recent activity, not stale data.
 */

import { createClient } from "@/lib/supabase/server";
import { COACHING_THRESHOLDS } from "@/config/ufli";
import {
  CLIFFS,
  CLIFF_PROXIMITY_WINDOW,
  cliffsApproachingForLesson,
  type CliffDefinition,
} from "@/lib/curriculum/cliffs";

export interface GroupCliffAlert {
  groupId: number;
  groupName: string;
  /** Highest lesson this group has touched in the window */
  maxLessonInGroup: number;
  /** Number of students in the group (active memberships) */
  memberCount: number;
  /** Distance in lessons from the cliff trigger (0 = AT the cliff) */
  distance: number;
  /** The cliff being approached */
  cliff: CliffDefinition;
}

export interface CliffAlertsResult {
  /** Lookback window used to determine each group's max lesson */
  windowDays: number;
  /** All alerts across all groups, sorted by distance asc (most imminent first) */
  alerts: GroupCliffAlert[];
  /** Distinct group count with at least one alert */
  groupsAlertedCount: number;
}

export async function getCliffAlerts(
  schoolId: number,
  yearId: number,
): Promise<CliffAlertsResult> {
  const supabase = await createClient();
  const windowDays = COACHING_THRESHOLDS.ACTIVITY_WINDOW_DAYS;

  // Compute activity window
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);
  windowStart.setHours(0, 0, 0, 0);
  const windowStartIso = windowStart.toISOString().split("T")[0];

  // 1. Active groups for the school
  const { data: groupRows } = await supabase
    .from("instructional_groups")
    .select("group_id, group_name")
    .eq("school_id", schoolId)
    .eq("is_active", true);

  const groups = (groupRows ?? []) as Array<{
    group_id: number;
    group_name: string;
  }>;
  if (groups.length === 0) {
    return { windowDays, alerts: [], groupsAlertedCount: 0 };
  }
  const groupIds = groups.map((g) => g.group_id);

  // 2. Member counts per group
  const { data: memberRows } = await supabase
    .from("group_memberships")
    .select("group_id")
    .in("group_id", groupIds)
    .eq("is_active", true);

  const memberCounts = new Map<number, number>();
  for (const row of memberRows ?? []) {
    const r = row as { group_id: number };
    memberCounts.set(r.group_id, (memberCounts.get(r.group_id) ?? 0) + 1);
  }

  // 3. Max lesson per group in the window (excluding absences)
  const { data: progressRows } = await supabase
    .from("lesson_progress")
    .select(
      "group_id, status, ufli_lessons!inner(lesson_number, is_review)",
    )
    .in("group_id", groupIds)
    .eq("year_id", yearId)
    .gte("date_recorded", windowStartIso)
    .neq("status", "A");

  const maxLessonByGroup = new Map<number, number>();
  for (const row of progressRows ?? []) {
    const r = row as unknown as {
      group_id: number;
      ufli_lessons: { lesson_number: number; is_review: boolean } | null;
    };
    if (!r.ufli_lessons) continue;
    // Review lessons are still instructional attempts, so count them
    const ln = r.ufli_lessons.lesson_number;
    const existing = maxLessonByGroup.get(r.group_id) ?? 0;
    if (ln > existing) maxLessonByGroup.set(r.group_id, ln);
  }

  // 4. Build the alert list
  const groupNameById = new Map<number, string>();
  for (const g of groups) groupNameById.set(g.group_id, g.group_name);

  const alerts: GroupCliffAlert[] = [];
  const alertedGroups = new Set<number>();

  for (const [groupId, maxLesson] of maxLessonByGroup.entries()) {
    const approaching = cliffsApproachingForLesson(maxLesson);
    if (approaching.length === 0) continue;
    alertedGroups.add(groupId);
    for (const cliff of approaching) {
      alerts.push({
        groupId,
        groupName: groupNameById.get(groupId) ?? `Group ${groupId}`,
        maxLessonInGroup: maxLesson,
        memberCount: memberCounts.get(groupId) ?? 0,
        distance: cliff.triggerLesson - maxLesson,
        cliff,
      });
    }
  }

  // Sort: most imminent first (distance 0 = already at the cliff), then
  // by hazard rate desc within the same distance
  alerts.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    const ah = a.cliff.hazardRatePct ?? 0;
    const bh = b.cliff.hazardRatePct ?? 0;
    return bh - ah;
  });

  return {
    windowDays,
    alerts,
    groupsAlertedCount: alertedGroups.size,
  };
}

/** Re-export for UI consumers. */
export { CLIFFS, CLIFF_PROXIMITY_WINDOW };
export type { CliffDefinition };
