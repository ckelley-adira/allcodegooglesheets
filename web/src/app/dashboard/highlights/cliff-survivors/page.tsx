/**
 * @file highlights/cliff-survivors/page.tsx — Cliff Survivors drill-down page
 *
 * Full list of cliff crossings, grouped by the 6 canonical cliffs.
 * Each cliff group is collapsible via native <details>/<summary> for
 * zero-JS progressive enhancement. Grade filtering and name search
 * narrow results across all cliff groups simultaneously.
 */

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import { getGrowthHighlights, type CliffSurvivorRow } from "@/lib/dal/highlights";
import { CLIFFS } from "@/lib/curriculum/cliffs";
import { parseGradeFilter } from "@/components/filters";
import { HighlightsFilterBar } from "../_components/highlights-filter-bar";
import { CliffSurvivorCard } from "../_components/cliff-survivor-card";
import { ShowMore } from "../_components/show-more";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CliffSurvivorsPage({ searchParams }: Props) {
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

  const [allHighlights, filtered] = await Promise.all([
    getGrowthHighlights(schoolId, currentYear.yearId),
    getGrowthHighlights(schoolId, currentYear.yearId, {
      gradeFilter: gradeFilter.length > 0 ? gradeFilter : undefined,
      searchQuery: searchQuery || undefined,
    }),
  ]);

  const total = allHighlights.cliffSurvivors.length;
  const shown = filtered.cliffSurvivors.length;
  const isFiltered = gradeFilter.length > 0 || searchQuery.length > 0;

  // Group survivors by cliff ID
  const byCliff = new Map<string, CliffSurvivorRow[]>();
  for (const s of filtered.cliffSurvivors) {
    const arr = byCliff.get(s.cliff.id) ?? [];
    arr.push(s);
    byCliff.set(s.cliff.id, arr);
  }

  // Walk CLIFFS in canonical order (not Map insertion order)
  const cliffGroups = CLIFFS
    .map((cliff) => ({
      cliff,
      survivors: byCliff.get(cliff.id) ?? [],
    }))
    .filter((g) => g.survivors.length > 0);

  return (
    <div className="space-y-5">
      <BackLink />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cliff Survivors</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Students who crossed one of the 6 canonical UFLI cliffs in the
          last {filtered.windowWeeks} weeks. These lessons have empirical
          hazard rates up to 35.1% &mdash; clearing them is worth celebrating.
        </p>
      </div>

      <HighlightsFilterBar
        selectedGrades={gradeFilter}
        searchQuery={searchQuery}
      />

      {isFiltered && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Showing {shown} of {total} cliff crossings
        </p>
      )}

      {cliffGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          No cliff crossings{isFiltered ? " matching these filters" : " in the window"}.
        </div>
      ) : (
        <div className="space-y-4">
          {cliffGroups.map((group, idx) => (
            <details
              key={group.cliff.id}
              open={idx === 0}
              className="group rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {group.cliff.transition}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {group.cliff.concept}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400">
                    Hazard {group.cliff.hazardRateLabel}
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                    {group.survivors.length}
                  </span>
                </div>
              </summary>
              <div className="space-y-2 border-t border-zinc-100 p-4 dark:border-zinc-800">
                <ShowMore>
                  {group.survivors.map((s, i) => (
                    <CliffSurvivorCard
                      key={`${s.studentId}-${s.cliff.id}-${i}`}
                      survivor={s}
                    />
                  ))}
                </ShowMore>
              </div>
            </details>
          ))}
        </div>
      )}
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
