/**
 * @file dashboard/staff/page.tsx — Staff management page
 *
 * Lists all staff for the current school with a form to add new members.
 * Requires school_admin or tilt_admin role (D-003).
 */

import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listStaff } from "@/lib/dal/staff";
import { Badge } from "@/components/ui/badge";
import { CreateStaffForm } from "./create-form";
import { EditStaffRow } from "./edit-row";

const ROLE_BADGE_VARIANT = {
  tutor: "default",
  coach: "info",
  school_admin: "warning",
  tilt_admin: "danger",
} as const;

const ROLE_LABEL = {
  tutor: "Tutor",
  coach: "Coach",
  school_admin: "School Admin",
  tilt_admin: "TILT Admin",
} as const;

export default async function StaffPage() {
  const user = await requireRole("school_admin", "tilt_admin");
  const activeSchoolId = await getActiveSchoolId(user);
  const staffList = await listStaff(activeSchoolId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage tutors, coaches, and admins for your school.
          </p>
        </div>
      </div>

      {/* Create form */}
      <CreateStaffForm isTiltAdmin={user.isTiltAdmin} />

      {/* Staff table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
            {staffList.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-zinc-400"
                >
                  No staff members yet. Add one above.
                </td>
              </tr>
            ) : (
              staffList.map((member) => (
                <EditStaffRow
                  key={member.staffId}
                  member={member}
                  roleBadge={
                    <Badge
                      variant={
                        ROLE_BADGE_VARIANT[member.role]
                      }
                    >
                      {ROLE_LABEL[member.role]}
                    </Badge>
                  }
                  statusBadge={
                    <Badge variant={member.isActive ? "success" : "default"}>
                      {member.isActive ? "Active" : "Inactive"}
                    </Badge>
                  }
                  isTiltAdmin={user.isTiltAdmin}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
