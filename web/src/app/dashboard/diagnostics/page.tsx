/**
 * @file dashboard/diagnostics/page.tsx — Diagnostic Error Analysis rollup
 *
 * Phase C.1: surfaces the UFLI Diagnostic Error Analysis Framework as a
 * live report. Two signal sources feed the view:
 *
 *   1. lesson_progress N's in the lookback window, rolled up by skill
 *      section — answers "where are students failing right now?"
 *
 *   2. assessment_component_errors rolled up by word — answers "when we
 *      baseline-tested, which specific words + components tripped the
 *      most students?"
 *
 * For every section with errors, the page joins the matching rows from
 * the UFLI Diagnostic Error Analysis Framework so a coach gets the raw
 * "here's what's broken" view + "here's what the framework says to do
 * about it" in one glance.
 *
 * Scope: TILT Admins can flip between the active school and a network-wide
 * rollup via ?scope=network. Everyone else is pinned to their own school.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { getDiagnosticsRollup } from "@/lib/dal/diagnostics";
import {
  DEFICIT_META,
  getDiagnosticRulesForSection,
} from "@/lib/diagnostic/framework";
import { cn } from "@/lib/utils";
import { formatPct, pctColor } from "@/lib/format/percent";

interface DiagnosticsPageProps {
  searchParams: Promise<{ scope?: string }>;
}

function errorRateColor(pct: number | null): string {
  if (pct === null) return "text-zinc-400";
  if (pct >= 50) return "text-red-600 dark:text-red-400";
  if (pct >= 25) return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

export default async function DiagnosticsPage({
  searchParams,
}: DiagnosticsPageProps) {
  const { scope } = await searchParams;
  const user = await requireAuth();

  const isAdmin = user.isTiltAdmin;
  const wantsNetwork = scope === "network";

  // Scope resolution: TILT admins can request network; everyone else is
  // pinned to their active school context.
  let schoolId: number | null;
  let scopeLabel: string;

  if (isAdmin && wantsNetwork) {
    schoolId = null;
    scopeLabel = "Network (all schools)";
  } else {
    schoolId = await getActiveSchoolId(user);
    scopeLabel = "This school";
  }

  const rollup = await getDiagnosticsRollup({ schoolId, windowDays: 28 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Diagnostics</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          UFLI Diagnostic Error Analysis Framework — likely deficits and
          suggested instructional responses, joined to the sections where
          students are actually struggling.
        </p>
      </div>

      {/* Scope toggle — TILT admin only */}
      {isAdmin && (
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <Link
            href="/dashboard/diagnostics"
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              !wantsNetwork
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            This school
          </Link>
          <Link
            href="/dashboard/diagnostics?scope=network"
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              wantsNetwork
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            Network
          </Link>
        </div>
      )}

      {/* Rollup cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Scope
          </p>
          <p className="mt-1 text-lg font-semibold">{scopeLabel}</p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {rollup.totalActiveStudents} active students · last{" "}
            {rollup.windowDays} days
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Sections with errors
          </p>
          <p className="mt-1 text-3xl font-bold">{rollup.sections.length}</p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Skill sections with ≥1 non-mastery result in the window
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Top missed words
          </p>
          <p className="mt-1 text-3xl font-bold">
            {rollup.topMissedWords.length}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            From initial-assessment component errors
          </p>
        </div>
      </div>

      {/* Section rollup + diagnostic framework hints */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Errors by Skill Section
        </h2>
        {rollup.sections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            No non-mastery results in the last {rollup.windowDays} days. Either
            things are going well, or data hasn&rsquo;t been captured yet.
          </div>
        ) : (
          <div className="space-y-4">
            {rollup.sections.map((row) => {
              const rules = getDiagnosticRulesForSection(row.section);
              return (
                <div
                  key={row.section}
                  className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {/* Section header row */}
                  <div className="grid gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-3 sm:grid-cols-[1fr_auto] dark:border-zinc-800 dark:bg-zinc-900/50">
                    <div>
                      <h3 className="text-sm font-semibold">{row.section}</h3>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {row.studentCount} student
                        {row.studentCount !== 1 ? "s" : ""} affected ·{" "}
                        {row.lessonCount} distinct lesson
                        {row.lessonCount !== 1 ? "s" : ""} ·{" "}
                        {row.nCount} N of {row.attemptCount} attempt
                        {row.attemptCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 sm:justify-end">
                      <span>Error rate</span>
                      <span
                        className={cn(
                          "text-2xl font-bold tabular-nums",
                          errorRateColor(row.errorRatePct),
                        )}
                      >
                        {formatPct(row.errorRatePct)}
                      </span>
                    </div>
                  </div>

                  {/* Matching framework rules */}
                  {rules.length === 0 ? (
                    <div className="px-4 py-3 text-xs italic text-zinc-400">
                      No diagnostic framework rules mapped to this section yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {rules.map((rule) => (
                        <div key={rule.id} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold">
                              {rule.concept}
                            </h4>
                            {rule.deficits.map((d) => (
                              <span
                                key={d}
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                                  DEFICIT_META[d].colorClass,
                                )}
                              >
                                {DEFICIT_META[d].label}
                              </span>
                            ))}
                          </div>
                          <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                            <div>
                              <dt className="font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                Reading error
                              </dt>
                              <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                                {rule.readingError}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                Spelling error
                              </dt>
                              <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                                {rule.spellingError}
                              </dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                Likely deficit
                              </dt>
                              <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                                {rule.deficitDescription}
                              </dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                Suggested instructional response
                              </dt>
                              <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                                {rule.instructionalResponse}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Top missed words from assessment component errors */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Top Missed Words (Initial Assessment)
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          From the baseline assessments. Most-missed words surface the
          component-level sticking points.
        </p>
        {rollup.topMissedWords.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            No component-level errors captured yet. Run some initial
            assessments to populate this view.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Word
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Section
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Missed by
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Top missed components
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rollup.topMissedWords.map((w) => (
                  <tr
                    key={`${w.sectionKey}::${w.word}`}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-2 text-sm font-semibold">
                      {w.word}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {w.sectionName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-sm tabular-nums">
                      <span className={pctColor((w.studentCount / Math.max(rollup.totalActiveStudents, 1)) * 100)}>
                        {w.studentCount}
                      </span>
                      <span className="ml-1 text-xs text-zinc-400">
                        student{w.studentCount !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {w.missedComponents.slice(0, 5).map((c, i) => (
                        <span
                          key={c.component}
                          className="mr-1.5 whitespace-nowrap"
                        >
                          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-zinc-800">
                            {c.component}
                          </code>
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {" "}
                            ×{c.count}
                          </span>
                          {i < Math.min(w.missedComponents.length, 5) - 1 ? (
                            ","
                          ) : (
                            ""
                          )}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
