/**
 * @file _components/cliff-survivor-card.tsx — Single cliff survivor card
 *
 * Extracted from the highlights landing page for reuse on the
 * dedicated /highlights/cliff-survivors drill-down page.
 */

import Link from "next/link";
import type { CliffSurvivorRow } from "@/lib/dal/highlights";

interface CliffSurvivorCardProps {
  survivor: CliffSurvivorRow;
}

export function CliffSurvivorCard({ survivor: s }: CliffSurvivorCardProps) {
  return (
    <div className="rounded-r-lg border border-l-4 border-l-blue-500 border-zinc-200 bg-blue-50 p-4 shadow-sm dark:border-zinc-800 dark:bg-blue-950/20">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">{"\u2B50"}</span>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          {s.cliff.label}
        </span>
        <Link
          href={`/dashboard/students/${s.studentId}`}
          className="text-sm font-semibold hover:underline"
        >
          {s.studentName}
        </Link>
        {s.gradeName && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            &middot; {s.gradeName}
          </span>
        )}
        <span className="ml-auto text-[10px] text-zinc-400">
          {s.crossedAt}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold">{s.cliff.concept}</p>
      <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        Hazard rate {s.cliff.hazardRateLabel} &middot; passed L
        {s.crossedAtLessonNumber}
      </p>
    </div>
  );
}
