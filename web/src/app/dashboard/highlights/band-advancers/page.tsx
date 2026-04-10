/**
 * @file highlights/band-advancers/page.tsx — Band Advancers drill-down page
 *
 * Full list of students whose band moved up at the latest weekly capture,
 * grouped by movement type (Accelerating first, then Advancing), with
 * grade filtering and name search.
 */

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import { getGrowthHighlights } from "@/lib/dal/highlights";
import { parseGradeFilter } from "@/components/filters";
import { HighlightsFilterBar } from "../_components/highlights-filter-bar";
import { BandAdvancerCard } from "../_components/band-advancer-card";
import { ShowMore } from "../_components/show-more";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BandAdvancersPage({ searchParams }: Props) {
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

  const total = allHighlights.bandAdvancers.length;
  const shown = filtered.bandAdvancers.length;
  const isFiltered = gradeFilter.length > 0 || searchQuery.length > 0;

  // Group by movement type
  const accelerating = filtered.bandAdvancers.filter(
    (a) => a.movement === "accelerating",
  );
  const advancing = filtered.bandAdvancers.filter(
    (a) => a.movement === "advancing",
  );

  return (
    <div className="space-y-5">
      <BackLink />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Band Advancers</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Students whose band moved up at the latest weekly capture.
          Accelerating = 2+ band jumps in a semester. Advancing = 1 jump.
        </p>
      </div>

      <HighlightsFilterBar
        selectedGrades={gradeFilter}
        searchQuery={searchQuery}
      />

      {isFiltered && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Showing {shown} of {total} band advancers
        </p>
      )}

      {shown === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          No band advancers{isFiltered ? " matching these filters" : " at the latest capture"}.
        </div>
      ) : (
        <div className="space-y-6">
          {accelerating.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                Accelerating ({accelerating.length})
              </h2>
              <ShowMore>
                {accelerating.map((a) => (
                  <BandAdvancerCard key={a.studentId} advancer={a} />
                ))}
              </ShowMore>
            </section>
          )}

          {advancing.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
                Advancing ({advancing.length})
              </h2>
              <ShowMore>
                {advancing.map((a) => (
                  <BandAdvancerCard key={a.studentId} advancer={a} />
                ))}
              </ShowMore>
            </section>
          )}
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
