/**
 * @file dashboard/highlights/page.tsx — Growth Highlights landing page
 *
 * Summary dashboard with three drill-down tiles, one per celebration
 * category. Clicking a tile navigates to a dedicated sub-page with
 * filtering, search, and grouping — designed for schools with 600+
 * students where a single long list is unmanageable.
 *
 * Three categories:
 *   Top Movers      — highest avg lessons/week over 4 weeks (above aimline)
 *   Band Advancers  — band movement is accelerating or advancing
 *   Cliff Survivors — crossed one of the 6 canonical cliffs in 4 weeks
 *
 * Role-gated to coach / school_admin / tilt_admin.
 */

import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import { getGrowthHighlights } from "@/lib/dal/highlights";
import { ScopeTiles, type ScopeTileItem } from "@/components/filters";

export default async function HighlightsPage() {
  const user = await requireRole("coach", "school_admin", "tilt_admin");
  const schoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(schoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Growth Highlights</h1>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No active academic year for this school.
          </p>
        </div>
      </div>
    );
  }

  const highlights = await getGrowthHighlights(schoolId, currentYear.yearId);

  const tiles: ScopeTileItem[] = [
    {
      key: "top-movers",
      count: highlights.topMovers.length,
      label: "Top Movers",
      subtitle: "At or above the 2-lesson/week aimline",
      href: "/dashboard/highlights/top-movers",
      tone: "success",
    },
    {
      key: "band-advancers",
      count: highlights.bandAdvancers.length,
      label: "Band Advancers",
      subtitle: "Accelerating or advancing at latest capture",
      href: "/dashboard/highlights/band-advancers",
      tone: "info",
    },
    {
      key: "cliff-survivors",
      count: highlights.cliffSurvivors.length,
      label: "Cliff Survivors",
      subtitle: `Crossings of the 6 canonical cliffs (${highlights.windowWeeks}wk)`,
      href: "/dashboard/highlights/cliff-survivors",
      tone: "info",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Growth Highlights
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          The inverse of cliff alerts. Last {highlights.windowWeeks} weeks
          &mdash; who&rsquo;s doing exceptional work, so a coach can call them
          out on Monday.
        </p>
      </div>

      <ScopeTiles
        items={tiles}
        hint="Click a category to see the full list with filters."
      />
    </div>
  );
}
