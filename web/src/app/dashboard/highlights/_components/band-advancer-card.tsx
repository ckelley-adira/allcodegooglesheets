/**
 * @file _components/band-advancer-card.tsx — Single band advancer card
 *
 * Extracted from the highlights landing page for reuse on the
 * dedicated /highlights/band-advancers drill-down page.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BandAdvancerRow } from "@/lib/dal/highlights";

interface BandAdvancerCardProps {
  advancer: BandAdvancerRow;
}

export function BandAdvancerCard({ advancer: a }: BandAdvancerCardProps) {
  return (
    <div
      className={cn(
        "rounded-r-lg border border-l-4 border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        a.movement === "accelerating"
          ? "border-l-purple-600"
          : "border-l-green-500",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">
          {a.movement === "accelerating" ? "\uD83D\uDE80\uD83D\uDE80" : "\uD83D\uDE80"}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            a.movement === "accelerating"
              ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
              : "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
          )}
        >
          {a.movement === "accelerating" ? "Accelerating \u2191\u2191" : "Advancing \u2191"}
        </span>
        <Link
          href={`/dashboard/students/${a.studentId}`}
          className="text-sm font-semibold hover:underline"
        >
          {a.studentName}
        </Link>
        {a.gradeName && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            &middot; {a.gradeName}
          </span>
        )}
        <span className="ml-auto text-[10px] text-zinc-400">
          as of {a.assignedDate}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
        Now <span className="font-semibold">{formatBand(a.band)}</span> &middot;{" "}
        <span className="font-semibold">{a.archetypeLabel}</span>
        {a.ceilingSection && (
          <> &middot; Ceiling: {a.ceilingSection}</>
        )}
      </p>
    </div>
  );
}

function formatBand(band: string): string {
  switch (band) {
    case "not_started":
      return "Not Started";
    case "intervention":
      return "Intervention";
    case "on_track":
      return "On Track";
    case "advanced":
      return "Advanced";
    default:
      return band;
  }
}
