/**
 * @file dashboard/groups/page.tsx — Groups list page
 *
 * Lists all instructional groups for the current school. Shows member
 * count, assigned staff, grade, and academic year. Links to group detail
 * pages for roster management.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { listGroups, listAcademicYears, listActiveStaff } from "@/lib/dal/groups";
import { listGradeLevels } from "@/lib/dal/students";
import { Badge } from "@/components/ui/badge";
import { CreateGroupForm } from "./create-form";

export default async function GroupsPage() {
  const user = await requireAuth();
  const [groups, grades, years, staffList] = await Promise.all([
    listGroups(user.schoolId),
    listGradeLevels(),
    listAcademicYears(user.schoolId),
    listActiveStaff(user.schoolId),
  ]);

  const canEdit =
    ["coach", "school_admin", "tilt_admin"].includes(user.role) ||
    user.isTiltAdmin;

  const activeGroups = groups.filter((g) => g.isActive);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {activeGroups.length} active group{activeGroups.length !== 1 ? "s" : ""}
        </p>
      </div>

      {canEdit && (
        <CreateGroupForm
          grades={grades}
          years={years}
          staffList={staffList}
        />
      )}

      {/* Groups grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.length === 0 ? (
          <p className="col-span-full py-8 text-center text-sm text-zinc-400">
            No groups yet. Create one above.
          </p>
        ) : (
          groups.map((group) => (
            <Link
              key={group.groupId}
              href={`/dashboard/groups/${group.groupId}`}
              className="group rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold group-hover:underline">
                    {group.groupName}
                  </h3>
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {group.gradeName} &middot; {group.yearLabel}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {group.isMixedGrade && (
                    <Badge variant="info">Mixed</Badge>
                  )}
                  {!group.isActive && (
                    <Badge variant="default">Inactive</Badge>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">
                  {group.staffName}
                </span>
                <span className="font-medium">
                  {group.memberCount} student{group.memberCount !== 1 ? "s" : ""}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
