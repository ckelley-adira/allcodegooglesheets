/**
 * @file _components/highlights-filter-bar.tsx — Shared filter bar
 *
 * Renders grade chips + text search in a <form method="GET"> for
 * all three highlights drill-down pages. Server-rendered, zero
 * client JS. Follows the existing URL search param pattern from
 * the students page.
 */

import { GradeFilterChips } from "@/components/filters";

interface HighlightsFilterBarProps {
  selectedGrades: string[];
  searchQuery: string;
  /** Available grades to show (scoped to what the school has) */
  availableGrades?: readonly string[];
}

export function HighlightsFilterBar({
  selectedGrades,
  searchQuery,
  availableGrades,
}: HighlightsFilterBarProps) {
  return (
    <form method="GET" className="space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <GradeFilterChips
          selected={selectedGrades}
          grades={availableGrades}
          hint=""
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Search
          </span>
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder="Student name..."
            className="w-48 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            aria-label="Search by student name"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Filter
        </button>
      </div>
    </form>
  );
}
