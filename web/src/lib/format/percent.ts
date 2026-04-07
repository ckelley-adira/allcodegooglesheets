/**
 * @file format/percent.ts — Shared percentage formatting helpers
 *
 * Used across dashboard reports for consistent rendering of
 * percentages and threshold-based color coding.
 */

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
}

export function pctColor(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-zinc-400";
  if (value >= 80) return "text-green-600 dark:text-green-400";
  if (value >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}
