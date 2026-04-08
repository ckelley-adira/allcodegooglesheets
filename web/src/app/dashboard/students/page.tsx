/**
 * @file dashboard/students/page.tsx — Student management page (Phase UX.2)
 *
 * Grade drill-down tiles on top + name search + filtered table. Replaces
 * the previous flat table that dumped 40-80 students with no scoping.
 *
 * Filter state lives in URL search params so a coach can share a link
 * to "all G3 students with 'jones' in the name" with their team lead.
 *
 *   /dashboard/students                     → all students
 *   /dashboard/students?grade=G3            → G3 only
 *   /dashboard/students?grade=KG&grade=G1   → KG + G1
 *   /dashboard/students?q=jones             → name contains "jones"
 *   /dashboard/students?grade=G3&q=ann      → intersection
 *
 * All authenticated staff can view; coach+ can create/edit.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listStudents, listGradeLevels } from "@/lib/dal/students";
import { Badge } from "@/components/ui/badge";
import {
  GradeFilterChips,
  ScopeTiles,
  parseGradeFilter,
  type ScopeTileItem,
} from "@/components/filters";
import { CreateStudentForm } from "./create-form";
import { EditStudentRow } from "./edit-row";

const STATUS_BADGE_VARIANT = {
  active: "success",
  withdrawn: "danger",
  transferred: "warning",
  graduated: "info",
} as const;

interface StudentsPageProps {
  searchParams: Promise<{
    grade?: string | string[];
    q?: string;
  }>;
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const params = await searchParams;
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);
  const [studentList, grades] = await Promise.all([
    listStudents(activeSchoolId),
    listGradeLevels(),
  ]);

  const canEdit =
    ["coach", "school_admin", "tilt_admin"].includes(user.role) ||
    user.isTiltAdmin;

  const gradeFilter = parseGradeFilter(params.grade);
  const searchQuery = (params.q ?? "").trim();

  // Per-grade active student counts for the scope tiles (computed before
  // the grade filter is applied so the tile counts stay accurate)
  const activeByGrade = new Map<string, number>();
  for (const s of studentList) {
    if (s.enrollmentStatus !== "active") continue;
    activeByGrade.set(s.gradeName, (activeByGrade.get(s.gradeName) ?? 0) + 1);
  }
  const totalActive = Array.from(activeByGrade.values()).reduce(
    (sum, n) => sum + n,
    0,
  );

  // Apply filters
  const noGradeFilter = gradeFilter.length === 0;
  const searchLower = searchQuery.toLowerCase();
  const filteredStudents = studentList.filter((s) => {
    if (!noGradeFilter && !gradeFilter.includes(s.gradeName)) return false;
    if (searchLower) {
      const haystack =
        `${s.firstName} ${s.lastName} ${s.studentNumber}`.toLowerCase();
      if (!haystack.includes(searchLower)) return false;
    }
    return true;
  });

  // Build drill-down tile list: "All active" + one tile per grade that
  // actually has active students, sorted by grade order from the lookup.
  const gradesWithStudents = grades.filter((g) =>
    activeByGrade.has(g.name),
  );
  const tileItems: ScopeTileItem[] = [
    {
      key: "all",
      count: totalActive,
      label: "All Active",
      subtitle: "Clear filters",
      href: "/dashboard/students",
      active: noGradeFilter && !searchLower,
      tone: "default",
    },
    ...gradesWithStudents.map((g) => ({
      key: g.name,
      count: activeByGrade.get(g.name) ?? 0,
      label: g.name,
      href: `/dashboard/students?grade=${encodeURIComponent(g.name)}`,
      active: gradeFilter.length === 1 && gradeFilter[0] === g.name,
      tone: "default" as const,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {totalActive} active &middot; {studentList.length} total
        </p>
      </div>

      {/* Drill-down tiles */}
      <ScopeTiles items={tileItems} />

      {/* Filter bar */}
      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        <GradeFilterChips selected={gradeFilter} />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Search by name or ID
          </label>
          <input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="e.g. jones"
            className="w-56 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Apply
        </button>
        {(gradeFilter.length > 0 || searchQuery) && (
          <Link
            href="/dashboard/students"
            className="rounded-md border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Create form — only shown to coach+ */}
      {canEdit && <CreateStudentForm grades={grades} />}

      {/* Filtered student table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Showing <strong>{filteredStudents.length}</strong> of{" "}
          {studentList.length} students
          {gradeFilter.length > 0 && (
            <> · Grades: {gradeFilter.join(", ")}</>
          )}
          {searchQuery && <> · Search: &ldquo;{searchQuery}&rdquo;</>}
        </div>
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
            {filteredStudents.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 6 : 5}
                  className="px-4 py-8 text-center text-sm text-zinc-400"
                >
                  {studentList.length === 0
                    ? "No students yet. Add one above."
                    : "No students match the current filters."}
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => (
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
