/**
 * @file dashboard/sessions/page.tsx — Sessions overview page
 *
 * Shows the tutor's assigned groups as entry points to the lesson recording
 * form, plus a table of recent lesson entries for the school.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { getSchoolFeatureFlagsResolved } from "@/lib/dal/schools";
import { listRecentEntries } from "@/lib/dal/sessions";
import { listGroups } from "@/lib/dal/groups";
import { FeatureDisabled } from "@/components/feature-disabled";

export default async function SessionsPage() {
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);

  // Feature flag gate
  const flags = await getSchoolFeatureFlagsResolved(activeSchoolId);
  if (!flags.ufli_progress_tracking) {
    return (
      <FeatureDisabled
        title="Sessions"
        flagLabel="UFLI Progress Tracking"
        description="Lesson session capture requires UFLI Progress Tracking to be enabled for this school."
      />
    );
  }

  const [groups, recentEntries] = await Promise.all([
    listGroups(activeSchoolId),
    listRecentEntries(activeSchoolId, 20),
  ]);

  // Show only active groups
  const activeGroups = groups.filter((g) => g.isActive);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Record lesson outcomes for your groups.
        </p>
      </div>

      {/* Quick-start: select a group to record */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Record a Lesson
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeGroups.length === 0 ? (
            <p className="col-span-full py-4 text-sm text-zinc-400">
              No active groups. Create groups first.
            </p>
          ) : (
            activeGroups.map((group) => (
              <Link
                key={group.groupId}
                href={`/dashboard/sessions/record?groupId=${group.groupId}`}
                className="group flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-zinc-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
              >
                <div>
                  <p className="font-medium group-hover:underline">
                    {group.groupName}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {group.gradeName} &middot; {group.memberCount} students
                  </p>
                </div>
                <span className="text-zinc-400 transition-transform group-hover:translate-x-1">
                  &rarr;
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Recent entries */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Recent Entries
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Lesson
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Group
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Students
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {recentEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-zinc-400"
                  >
                    No lesson entries recorded yet.
                  </td>
                </tr>
              ) : (
                recentEntries.map((entry, i) => (
                  <tr
                    key={`${entry.dateRecorded}-${entry.lessonNumber}-${entry.groupId}`}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {entry.dateRecorded}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <span className="font-mono text-zinc-500 dark:text-zinc-400">
                        L{entry.lessonNumber}
                      </span>{" "}
                      {entry.lessonName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {entry.groupName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                      {entry.outcomeCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
