/**
 * @file dashboard/attention/page.tsx — Drill-down for Groups Needing Attention
 *
 * Full list of active groups whose last lesson_progress is stale (1+ wk),
 * very stale (2+ wk), or never logged. Linked from the Attention tile on
 * the dashboard home.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import {
  getSchoolPacingSummary,
  type GroupHealth,
} from "@/lib/dal/school-pacing";
import { Badge } from "@/components/ui/badge";

const HEALTH_LABEL: Record<GroupHealth, string> = {
  fresh: "Active",
  stale_1w: "Stale (1+ wk)",
  stale_2w: "Stale (2+ wk)",
  never_logged: "Never Logged",
};

const HEALTH_VARIANT: Record<
  GroupHealth,
  "success" | "warning" | "danger" | "default"
> = {
  fresh: "success",
  stale_1w: "warning",
  stale_2w: "danger",
  never_logged: "default",
};

export default async function GroupsNeedingAttentionPage() {
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);
  const pacing = await getSchoolPacingSummary(activeSchoolId);

  const attentionGroups = pacing.groups
    .filter(
      (g) =>
        g.isActive &&
        (g.health === "stale_1w" ||
          g.health === "stale_2w" ||
          g.health === "never_logged"),
    )
    .sort((a, b) => {
      const aDays = a.daysSinceLastActivity ?? Number.MAX_SAFE_INTEGER;
      const bDays = b.daysSinceLastActivity ?? Number.MAX_SAFE_INTEGER;
      if (aDays !== bDays) return bDays - aDays;
      return a.groupName.localeCompare(b.groupName);
    });

  return (
    <div className="space-y-4">
      <div>
        <nav className="text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <span className="mx-1.5">/</span>
          <span>Groups Needing Attention</span>
        </nav>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Groups Needing Attention
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Active groups with no lesson_progress in the last 7+ days.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Stale 1+ Week
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-600 dark:text-amber-400">
            {pacing.staleOneWeekGroupCount}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Stale 2+ Weeks
          </p>
          <p className="mt-1 text-3xl font-bold text-red-600 dark:text-red-400">
            {pacing.staleTwoWeekGroupCount}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Never Logged
          </p>
          <p className="mt-1 text-3xl font-bold text-zinc-700 dark:text-zinc-300">
            {pacing.neverLoggedGroupCount}
          </p>
        </div>
      </div>

      {attentionGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          All active groups are fresh. Nothing needs attention.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Group
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Teacher
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Students
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Last Activity
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {attentionGroups.map((g) => (
                <tr
                  key={g.groupId}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-2 text-sm">
                    <Link
                      href={`/dashboard/groups/${g.groupId}`}
                      className="font-medium hover:underline"
                    >
                      {g.groupName}
                    </Link>
                    <span className="ml-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {g.gradeName}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <Link
                      href={`/dashboard/staff/${g.staffId}`}
                      className="hover:underline"
                    >
                      {g.staffName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-sm">{g.memberCount}</td>
                  <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {g.lastActivityDate ? (
                      <>
                        {g.lastActivityDate}
                        <span className="ml-1 text-xs text-zinc-400">
                          ({g.daysSinceLastActivity}d ago)
                        </span>
                      </>
                    ) : (
                      <span className="italic text-zinc-400">never</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <Badge variant={HEALTH_VARIANT[g.health]}>
                      {HEALTH_LABEL[g.health]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
