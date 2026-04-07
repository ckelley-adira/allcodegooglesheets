/**
 * @file dashboard/groups/[groupId]/page.tsx — Group detail page
 *
 * Shows the group's student roster with ability to add/remove students.
 * Also displays group metadata and an edit form for group settings.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import {
  getGroup,
  listGroupMembers,
  listAvailableStudents,
  listActiveStaff,
} from "@/lib/dal/groups";
import { listGradeLevels } from "@/lib/dal/students";
import { Badge } from "@/components/ui/badge";
import { AddStudentForm } from "./add-student-form";
import { RemoveStudentButton } from "./remove-student-button";
import { EditGroupForm } from "./edit-group-form";

interface GroupDetailPageProps {
  params: Promise<{ groupId: string }>;
}

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { groupId: groupIdParam } = await params;
  const groupId = Number(groupIdParam);
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);

  if (!groupId || isNaN(groupId)) notFound();

  const group = await getGroup(groupId, activeSchoolId);
  if (!group) notFound();

  const [members, available, staffList, grades] = await Promise.all([
    listGroupMembers(groupId),
    listAvailableStudents(groupId, activeSchoolId),
    listActiveStaff(activeSchoolId),
    listGradeLevels(),
  ]);

  const canEdit =
    ["coach", "school_admin", "tilt_admin"].includes(user.role) ||
    user.isTiltAdmin;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/dashboard/groups" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Groups
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100">{group.groupName}</span>
      </div>

      {/* Group header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{group.groupName}</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {group.isMixedGrade && group.gradeNames.length > 1
              ? group.gradeNames.join(" / ")
              : group.gradeName}{" "}
            &middot; {group.yearLabel} &middot; {group.staffName}
          </p>
          <div className="mt-2 flex gap-1.5">
            {group.isMixedGrade && <Badge variant="info">Mixed Grade</Badge>}
            <Badge variant={group.isActive ? "success" : "default"}>
              {group.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Edit group settings */}
      {canEdit && (
        <EditGroupForm
          group={group}
          grades={grades}
          staffList={staffList}
        />
      )}

      {/* Student roster */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Students ({members.length})
          </h2>
        </div>

        {/* Add student form */}
        {canEdit && available.length > 0 && (
          <AddStudentForm groupId={groupId} availableStudents={available} />
        )}

        {/* Members table — grouped visually by grade */}
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Student ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Joined
                </th>
                {canEdit && (
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {members.length === 0 ? (
                <tr>
                  <td
                    colSpan={canEdit ? 4 : 3}
                    className="px-4 py-8 text-center text-sm text-zinc-400"
                  >
                    No students in this group yet.
                  </td>
                </tr>
              ) : (
                (() => {
                  // Render rows with a grade subheader each time the grade changes
                  const rows: React.ReactNode[] = [];
                  let lastGradeId: number | null = null;
                  for (const m of members) {
                    if (m.gradeId !== lastGradeId) {
                      const count = members.filter(
                        (x) => x.gradeId === m.gradeId,
                      ).length;
                      rows.push(
                        <tr
                          key={`grade-${m.gradeId}`}
                          className="bg-zinc-100/60 dark:bg-zinc-900/60"
                        >
                          <td
                            colSpan={canEdit ? 4 : 3}
                            className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                          >
                            {m.gradeName}{" "}
                            <span className="font-normal text-zinc-400">
                              &middot; {count}
                            </span>
                          </td>
                        </tr>,
                      );
                      lastGradeId = m.gradeId;
                    }
                    rows.push(
                      <tr
                        key={m.membershipId}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                          {m.firstName} {m.lastName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-zinc-500 dark:text-zinc-400">
                          {m.studentNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                          {m.joinedDate}
                        </td>
                        {canEdit && (
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                            <RemoveStudentButton
                              membershipId={m.membershipId}
                              groupId={groupId}
                              studentName={`${m.firstName} ${m.lastName}`}
                            />
                          </td>
                        )}
                      </tr>,
                    );
                  }
                  return rows;
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
