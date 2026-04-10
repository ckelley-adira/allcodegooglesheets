/**
 * @file _components/top-movers-table.tsx — Top Movers data table
 *
 * Extracted from the highlights landing page for reuse on the
 * dedicated /highlights/top-movers drill-down page.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { TopMoverRow } from "@/lib/dal/highlights";

interface TopMoversTableProps {
  movers: TopMoverRow[];
  windowWeeks: number;
}

export function TopMoversTable({ movers, windowWeeks }: TopMoversTableProps) {
  if (movers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
        No students at or above the aimline in the last {windowWeeks} weeks.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Student
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Grade
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Avg lessons/wk
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              % of aimline
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Weeks
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {movers.map((m) => (
            <tr
              key={m.studentId}
              className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            >
              <td className="px-4 py-2 text-sm">
                <Link
                  href={`/dashboard/students/${m.studentId}`}
                  className="font-medium hover:underline"
                >
                  {m.studentName}
                </Link>
              </td>
              <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                {m.gradeName ?? "\u2014"}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm font-semibold tabular-nums">
                {m.avgPerWeek}
              </td>
              <td
                className={cn(
                  "whitespace-nowrap px-4 py-2 text-right text-sm font-semibold tabular-nums",
                  m.aimlineRatioPct >= 150
                    ? "text-green-600 dark:text-green-400"
                    : "text-green-700 dark:text-green-500",
                )}
              >
                {m.aimlineRatioPct}%
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-zinc-500 dark:text-zinc-400">
                {m.weeksTracked}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
