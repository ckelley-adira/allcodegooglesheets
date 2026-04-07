/**
 * @file dashboard/students/page.tsx — Student management page
 *
 * Lists all students for the current school with a form to add new ones.
 * All authenticated staff can view; coach+ can create/edit.
 */

import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listStudents, listGradeLevels } from "@/lib/dal/students";
import { Badge } from "@/components/ui/badge";
import { CreateStudentForm } from "./create-form";
import { EditStudentRow } from "./edit-row";

const STATUS_BADGE_VARIANT = {
  active: "success",
  withdrawn: "danger",
  transferred: "warning",
  graduated: "info",
} as const;

export default async function StudentsPage() {
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);
  const [studentList, grades] = await Promise.all([
    listStudents(activeSchoolId),
    listGradeLevels(),
  ]);

  const canEdit = ["coach", "school_admin", "tilt_admin"].includes(user.role) || user.isTiltAdmin;

  const activeCount = studentList.filter(
    (s) => s.enrollmentStatus === "active",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {activeCount} active student{activeCount !== 1 ? "s" : ""} &middot;{" "}
            {studentList.length} total
          </p>
        </div>
      </div>

      {/* Create form — only shown to coach+ */}
      {canEdit && <CreateStudentForm grades={grades} />}

      {/* Student table */}
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
                Grade
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Enrolled
              </th>
              {canEdit && (
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
            {studentList.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 6 : 5}
                  className="px-4 py-8 text-center text-sm text-zinc-400"
                >
                  No students yet. Add one above.
                </td>
              </tr>
            ) : (
              studentList.map((student) => (
                <EditStudentRow
                  key={student.studentId}
                  student={student}
                  grades={grades}
                  canEdit={canEdit}
                  statusBadge={
                    <Badge variant={STATUS_BADGE_VARIANT[student.enrollmentStatus]}>
                      {student.enrollmentStatus}
                    </Badge>
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
