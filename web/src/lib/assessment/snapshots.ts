/**
 * @file lib/assessment/snapshots.ts — Snapshot type + labels (client-safe)
 *
 * Pulled out of dal/assessments.ts so client components can import the
 * type and label map without transitively pulling in the server-only
 * Supabase client.
 */

export type SnapshotType = "baseline" | "semester_1_end" | "semester_2_end";

export const SNAPSHOT_LABELS: Record<SnapshotType, string> = {
  baseline: "Baseline (BOY)",
  semester_1_end: "Semester 1 End",
  semester_2_end: "Semester 2 End",
};
