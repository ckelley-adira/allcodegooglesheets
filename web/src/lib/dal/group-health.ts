/**
 * @file dal/group-health.ts — Shared group activity-health classification
 *
 * Used by teacher-detail, school-pacing, and network-rollup to classify
 * a group as fresh / stale / never logged based on the most recent
 * lesson_progress date.
 */

export type GroupHealth = "fresh" | "stale_1w" | "stale_2w" | "never_logged";

export function classifyHealth(daysSince: number | null): GroupHealth {
  if (daysSince === null) return "never_logged";
  if (daysSince <= 7) return "fresh";
  if (daysSince <= 14) return "stale_1w";
  return "stale_2w";
}

export function daysBetween(fromIso: string): number {
  const today = new Date();
  const from = new Date(fromIso);
  const diffMs = today.getTime() - from.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
