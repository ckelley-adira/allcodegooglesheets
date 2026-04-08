/**
 * @file dashboard/groups/page.tsx — Groups list page (Phase UX.4)
 *
 * Grade + teacher filters on top of the existing tile grid. For schools
 * that have 20+ active groups across many grades + teachers, the
 * unfiltered grid gets unwieldy. Filter state lives in URL params:
 *
 *   /dashboard/groups                           → all groups
 *   /dashboard/groups?grade=G3                  → G3 only
 *   /dashboard/groups?staffId=12                → one teacher's groups
 *   /dashboard/groups?grade=G1&grade=G2         → KG+G1 (multi-grade)
 *   /dashboard/groups?includeInactive=1         → show inactive groups too
 *
 * Default hides inactive groups (previously they were shown inline
 * with a "Inactive" badge which added noise to the grid).
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listGroups, listAcademicYears, listActiveStaff } from "@/lib/dal/groups";
import { listGradeLevels } from "@/lib/dal/students";
import { Badge } from "@/components/ui/badge";
import {
  GradeFilterChips,
  parseGradeFilter,
} from "@/components/filters";
import { CreateGroupForm } from "./create-form";

interface GroupsPageProps {
  searchParams: Promise<{
    grade?: string | string[];
    staffId?: string;
    includeInactive?: string;
  }>;
}

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = await searchParams;
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);
  const [groups, grades, years, staffList] = await Promise.all([
    listGroups(activeSchoolId),
    listGradeLevels(),
    listAcademicYears(activeSchoolId),
    listActiveStaff(activeSchoolId),
  ]);

  const canEdit =
    ["coach", "school_admin", "tilt_admin"].includes(user.role) ||
    user.isTiltAdmin;

  const gradeFilter = parseGradeFilter(params.grade);
  const staffIdFilter = params.staffId ? Number(params.staffId) : null;
  const includeInactive = params.includeInactive === "1";

  const activeGroups = groups.filter((g) => g.isActive);

  // Apply filters
  const noGradeFilter = gradeFilter.length === 0;
  const filtered = groups.filter((g) => {
    if (!includeInactive && !g.isActive) return false;
    if (staffIdFilter !== null && g.staffId !== staffIdFilter) return false;
    if (noGradeFilter) return true;
    // For mixed-grade groups, match if ANY assigned grade is in the filter
    const groupGrades =
      g.isMixedGrade && g.gradeNames.length > 0 ? g.gradeNames : [g.gradeName];
    return groupGrades.some((gn) => gradeFilter.includes(gn));
  });

  // Build a quick staff lookup for the filter dropdown + display
  const selectedStaff = staffIdFilter
    ? staffList.find((s) => s.staffId === staffIdFilter) ?? null
    : null;

  const hasFilters =
    gradeFilter.length > 0 || staffIdFilter !== null || includeInactive;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {activeGroups.length} active &middot; {groups.length} total
        </p>
      </div>

      {canEdit && (
        <CreateGroupForm grades={grades} years={years} staffList={staffList} />
      )}

      {/* Filter bar */}
      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        <GradeFilterChips selected={gradeFilter} />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Teacher
          </label>
          <select
            name="staffId"
            defaultValue={staffIdFilter ?? ""}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All teachers</option>
            {staffList.map((s) => (
              <option key={s.staffId} value={s.staffId}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            name="includeInactive"
            value="1"
            defaultChecked={includeInactive}
          />
          Include inactive
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Apply
        </button>
        {hasFilters && (
          <Link
            href="/dashboard/groups"
            className="rounded-md border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Filter summary + groups grid */}
      {hasFilters && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Showing <strong>{filtered.length}</strong> of {groups.length} groups
          {gradeFilter.length > 0 && <> · Grades: {gradeFilter.join(", ")}</>}
          {selectedStaff && (
            <> · Teacher: {selectedStaff.firstName} {selectedStaff.lastName}</>
          )}
          {includeInactive && <> · Including inactive</>}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="col-span-full py-8 text-center text-sm text-zinc-400">
            {groups.length === 0
              ? "No groups yet. Create one above."
              : "No groups match the current filters."}
          </p>
        ) : (
          filtered.map((group) => (
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
                    {group.isMixedGrade && group.gradeNames.length > 1
                      ? group.gradeNames.join(" / ")
                      : group.gradeName}{" "}
                    &middot; {group.yearLabel}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {group.isMixedGrade && <Badge variant="info">Mixed</Badge>}
                  {!group.isActive && <Badge variant="default">Inactive</Badge>}
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
