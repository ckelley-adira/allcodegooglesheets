/**
 * @file dashboard/page.tsx — Dashboard home page
 *
 * All-tiles drill-down design: every card is a clickable ScopeTile
 * that links to a detail page. Three tile rows:
 *
 *   1. Big Four Metrics   → /dashboard/big-four (per-grade breakdown)
 *   2. Pacing & Coverage  → /dashboard/students, /dashboard/groups,
 *                           /dashboard/attention
 *   3. Weekly Rhythm      → /dashboard/coaching, /dashboard/highlights/*,
 *      (coach+ only)        /dashboard/bands
 *
 * Per D-006: definitions are used in funder communications and must
 * not drift. The DAL functions in lib/dal/metrics.ts are the canonical
 * implementation.
 */

import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import { getBigFourMetrics } from "@/lib/dal/metrics";
import { getSchoolPacingSummary } from "@/lib/dal/school-pacing";
import { getCliffAlerts } from "@/lib/dal/cliffs";
import { getGrowthHighlights } from "@/lib/dal/highlights";
import { formatPct } from "@/lib/format/percent";
import { ScopeTiles, type ScopeTileItem } from "@/components/filters";

/** Map a percentage to a ScopeTile tone using pctColor thresholds. */
function pctTone(
  value: number | null | undefined,
): ScopeTileItem["tone"] {
  if (value === null || value === undefined) return "default";
  if (value >= 80) return "success";
  if (value >= 50) return "warning";
  return "danger";
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(activeSchoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No active academic year for this school.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Set a current academic year on the school detail page to see metrics.
          </p>
        </div>
      </div>
    );
  }

  const canSeeRhythm =
    user.role === "coach" ||
    user.role === "school_admin" ||
    user.isTiltAdmin;

  const [metrics, pacing, cliffAlerts, highlights] = await Promise.all([
    getBigFourMetrics(activeSchoolId, currentYear.yearId),
    getSchoolPacingSummary(activeSchoolId),
    canSeeRhythm
      ? getCliffAlerts(activeSchoolId, currentYear.yearId)
      : Promise.resolve(null),
    canSeeRhythm
      ? getGrowthHighlights(activeSchoolId, currentYear.yearId)
      : Promise.resolve(null),
  ]);

  const attentionCount =
    pacing.staleOneWeekGroupCount +
    pacing.staleTwoWeekGroupCount +
    pacing.neverLoggedGroupCount;

  // ── Big Four tiles ───────────────────────────────────────────────────
  const bigFourTiles: ScopeTileItem[] = [
    {
      key: "foundational",
      count: formatPct(metrics.foundational.percentage),
      label: "Foundational",
      subtitle: `L1\u2013L34 mastery \u00b7 ${metrics.foundational.studentCount} students`,
      href: "/dashboard/big-four",
      tone: pctTone(metrics.foundational.percentage),
    },
    {
      key: "min-grade",
      count: formatPct(metrics.minGrade.percentage),
      label: "Min Grade Skills",
      subtitle: `MTSS by grade \u00b7 ${metrics.minGrade.studentCount} students`,
      href: "/dashboard/big-four",
      tone: pctTone(metrics.minGrade.percentage),
    },
    {
      key: "year-progress",
      count: formatPct(metrics.currentYearGoal.percentage),
      label: "Year Progress",
      subtitle: `This year\u2019s curriculum (no reviews)`,
      href: "/dashboard/big-four",
      tone: pctTone(metrics.currentYearGoal.percentage),
    },
    {
      key: "growth-slope",
      count: formatPct(metrics.growthSlope.onPacePercentage),
      label: "Growth Slope",
      subtitle: `${metrics.growthSlope.onPaceCount} of ${metrics.growthSlope.evaluableStudentCount} on pace${
        metrics.growthSlope.presenceConcernCount > 0
          ? ` \u00b7 ${metrics.growthSlope.presenceConcernCount} PC`
          : ""
      }`,
      href: "/dashboard/big-four",
      tone: pctTone(metrics.growthSlope.onPacePercentage),
    },
  ];

  // ── Pacing tiles ─────────────────────────────────────────────────────
  const staleCount =
    pacing.staleOneWeekGroupCount + pacing.staleTwoWeekGroupCount;

  const pacingTiles: ScopeTileItem[] = [
    {
      key: "coverage",
      count: formatPct(pacing.coveragePct),
      label: "Coverage (7d)",
      subtitle: `${pacing.studentsWithRecentActivity} of ${pacing.totalActiveStudents} students seen`,
      href: "/dashboard/pacing",
      tone: pctTone(pacing.coveragePct),
    },
    {
      key: "active-groups",
      count: pacing.freshGroupCount,
      label: "Active Groups",
      subtitle: "Logged within the last 7 days",
      href: "/dashboard/groups",
      tone: pacing.freshGroupCount > 0 ? "success" : "default",
    },
    {
      key: "stale-groups",
      count: staleCount,
      label: "Stale Groups",
      subtitle: `${pacing.staleOneWeekGroupCount} 1+ wk \u00b7 ${pacing.staleTwoWeekGroupCount} 2+ wk`,
      href: "/dashboard/attention",
      tone: staleCount > 0 ? "warning" : "default",
    },
    {
      key: "never-logged",
      count: pacing.neverLoggedGroupCount,
      label: "Never Logged",
      subtitle: "Active groups with no recordings",
      href: "/dashboard/attention",
      tone: pacing.neverLoggedGroupCount > 0 ? "danger" : "default",
    },
  ];

  // ── Weekly Rhythm tiles (coach+) ─────────────────────────────────────
  const rhythmTiles: ScopeTileItem[] = canSeeRhythm
    ? [
        {
          key: "attention",
          count: attentionCount,
          label: "Needs Attention",
          subtitle: "Stale or never logged",
          href: "/dashboard/attention",
          tone: attentionCount > 0 ? "warning" : "default",
        },
        {
          key: "cliffs",
          count: cliffAlerts?.groupsAlertedCount ?? 0,
          label: "Approaching Cliffs",
          subtitle: "Within 3 lessons of a known cliff",
          href: "/dashboard/coaching",
          tone:
            (cliffAlerts?.groupsAlertedCount ?? 0) > 0 ? "warning" : "default",
        },
        {
          key: "top-movers",
          count: highlights?.topMovers.length ?? 0,
          label: "Top Movers",
          subtitle: "Students above aimline (4w)",
          href: "/dashboard/highlights/top-movers",
          tone: (highlights?.topMovers.length ?? 0) > 0 ? "success" : "default",
        },
        {
          key: "band-advancers",
          count: highlights?.bandAdvancers.length ?? 0,
          label: "Band Advancers",
          subtitle: "Moved up since last capture",
          href: "/dashboard/highlights/band-advancers",
          tone:
            (highlights?.bandAdvancers.length ?? 0) > 0 ? "success" : "default",
        },
        {
          key: "cliff-survivors",
          count: highlights?.cliffSurvivors.length ?? 0,
          label: "Cliff Survivors",
          subtitle: "Crossed a cliff (4w)",
          href: "/dashboard/highlights/cliff-survivors",
          tone:
            (highlights?.cliffSurvivors.length ?? 0) > 0 ? "info" : "default",
        },
        {
          key: "bands",
          count: "\u2192",
          label: "Banding Report",
          subtitle: "Distribution + archetypes",
          href: "/dashboard/bands",
          tone: "default",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Welcome back, {user.email} &middot; Academic year {currentYear.label}
        </p>
      </div>

      <ScopeTiles
        items={bigFourTiles}
        heading="Big Four Metrics"
        hint="Click any metric to see the per-grade breakdown."
      />

      <ScopeTiles
        items={pacingTiles}
        heading="Pacing & Coverage"
        hint="Group activity health and student lesson coverage."
      />

      {canSeeRhythm && rhythmTiles.length > 0 && (
        <ScopeTiles
          items={rhythmTiles}
          heading="Weekly Rhythm"
          hint="Quick-nav to the reports you visit most. Counts are live."
        />
      )}
    </div>
  );
}
