/**
 * @file pacing/student-log-table.tsx — Student last-seen log table
 *
 * Client component that renders the full student log with a "Show all"
 * toggle. Separated from the server page because the ShowMore pattern
 * requires client-side state, and placing a <button> inside a <tbody>
 * is invalid HTML. Instead, the table renders a capped number of rows
 * and the toggle button sits below the table.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import type { StudentActivityRow, GroupHealth } from "@/lib/dal/school-pacing";
import { Badge } from "@/components/ui/badge";

const INITIAL_COUNT = 25;

interface StudentLogTableProps {
  students: StudentActivityRow[];
}

export function StudentLogTable({ students }: StudentLogTableProps) {
  const [expanded, setExpanded] = useState(false);
  const total = students.length;
  const visible = expanded || total <= INITIAL_COUNT
    ? students
    : students.slice(0, INITIAL_COUNT);

  return (
    <>
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Student
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Grade
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Group
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
              Last Seen
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
              Days
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {visible.map((s) => (
            <tr
              key={s.studentId}
              className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            >
              <td className="px-4 py-2 text-sm">
                <Link
                  href={`/dashboard/students/${s.studentId}`}
                  className="font-medium hover:underline"
                >
                  {s.studentName}
                </Link>
              </td>
              <td className="px-4 py-2 text-sm text-zinc-500">
                {s.gradeName || "\u2014"}
              </td>
              <td className="px-4 py-2 text-sm text-zinc-500">
                {s.groupName ? (
                  <Link
                    href={`/dashboard/groups/${s.groupId}`}
                    className="hover:underline"
                  >
                    {s.groupName}
                  </Link>
                ) : (
                  <span className="text-zinc-400">No group</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-zinc-500">
                {s.lastActivityDate ?? "never"}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm tabular-nums text-zinc-500">
                {s.daysSinceLastActivity ?? "\u2014"}
              </td>
              <td className="px-4 py-2 text-right">
                <HealthBadge health={s.health} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > INITIAL_COUNT && (
        <div className="border-t border-zinc-100 p-2 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full rounded-lg border border-dashed border-zinc-300 py-2 text-xs font-medium text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
          >
            {expanded
              ? "Show less"
              : `Show all ${total} (${total - INITIAL_COUNT} more)`}
          </button>
        </div>
      )}
    </>
  );
}

// ── Health Badge ─────────────────────────────────────────────────────────

const HEALTH_BADGE: Record<
  GroupHealth,
  { label: string; variant: "success" | "warning" | "danger" | "default" }
> = {
  fresh: { label: "Fresh", variant: "success" },
  stale_1w: { label: "Stale 1w", variant: "warning" },
  stale_2w: { label: "Stale 2w+", variant: "danger" },
  never_logged: { label: "Never", variant: "danger" },
};

function HealthBadge({ health }: { health: GroupHealth }) {
  const { label, variant } = HEALTH_BADGE[health];
  return <Badge variant={variant}>{label}</Badge>;
}
