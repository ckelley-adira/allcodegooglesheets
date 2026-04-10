/**
 * @file highlights/top-movers/page.tsx — Top Movers drill-down page
 *
 * Full list of students at or above the 2-lesson/week aimline,
 * with grade filtering and name search.
 */

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import { getGrowthHighlights } from "@/lib/dal/highlights";
import { parseGradeFilter } from "@/components/filters";
import { HighlightsFilterBar } from "../_components/highlights-filter-bar";
import { TopMoversTable } from "../_components/top-movers-table";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TopMoversPage({ searchParams }: Props) {
  const user = await requireRole("coach", "school_admin", "tilt_admin");
  const schoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(schoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-zinc-500">No active academic year.</p>
      </div>
    );
  }

  const params = await searchParams;
  const gradeFilter = parseGradeFilter(params.grade);
  const searchQuery = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";

  // Fetch all highlights (unfiltered) for the total count, then filtered
  const [allHighlights, filtered] = await Promise.all([
    getGrowthHighlights(schoolId, currentYear.yearId),
    getGrowthHighlights(schoolId, currentYear.yearId, {
      gradeFilter: gradeFilter.length > 0 ? gradeFilter : undefined,
      searchQuery: searchQuery || undefined,
    }),
  ]);

  const total = allHighlights.topMovers.length;
  const shown = filtered.topMovers.length;
  const isFiltered = gradeFilter.length > 0 || searchQuery.length > 0;

  return (
    <div className="space-y-5">
      <BackLink />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Top Movers</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Students at or above the 2-lesson/week aimline over the last{" "}
          {filtered.windowWeeks} weeks. Sorted by % of aimline.
        </p>
      </div>

      <HighlightsFilterBar
        selectedGrades={gradeFilter}
        searchQuery={searchQuery}
      />

      {isFiltered && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Showing {shown} of {total} top movers
        </p>
      )}

      <TopMoversTable
        movers={filtered.topMovers}
        windowWeeks={filtered.windowWeeks}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard/highlights"
      className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
    >
      &larr; Growth Highlights
    </Link>
  );
}
