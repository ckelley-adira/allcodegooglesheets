/**
 * @file ufli-map-grid.tsx — Interactive UFLI MAP grid (Client Component)
 *
 * Renders the student×lesson matrix with:
 * - Sticky left columns (student name, grade, group)
 * - Horizontal scroll for 128 lesson columns
 * - Skill section group headers spanning lesson columns
 * - Color-coded cells: Y=green, N=red, A=amber, empty=gray
 * - Group filter dropdown
 * - Summary column (pass count / total attempted)
 *
 * Matches the GAS UFLI MAP tab color scheme:
 *   Y → #d4edda (light green)
 *   N → #f8d7da (light red)
 *   A → #fff3cd (light yellow/amber)
 */

"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

interface LessonColumn {
  lessonId: number;
  lessonNumber: number;
  lessonName: string | null;
  skillSection: string;
  isReview: boolean;
}

interface StudentMapRow {
  studentId: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  gradeName: string;
  groupName: string | null;
  outcomes: Record<number, "Y" | "N" | "A">;
}

interface SkillSection {
  name: string;
  startIndex: number;
  count: number;
}

interface GroupOption {
  groupId: number;
  groupName: string;
}

interface UfliMapGridProps {
  lessons: LessonColumn[];
  students: StudentMapRow[];
  skillSections: SkillSection[];
  groups: GroupOption[];
  selectedGroupId?: number;
}

// ── Cell colors (matching GAS Phase2_ProgressTracking.gs) ────────────────

const CELL_STYLES: Record<string, string> = {
  Y: "bg-[#d4edda] text-green-800 dark:bg-green-900/40 dark:text-green-300",
  N: "bg-[#f8d7da] text-red-800 dark:bg-red-900/40 dark:text-red-300",
  A: "bg-[#fff3cd] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

// ── Skill section header colors ──────────────────────────────────────────

const SECTION_COLORS = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-300",
];

// ── Component ────────────────────────────────────────────────────────────

export function UfliMapGrid({
  lessons,
  students,
  skillSections,
  groups,
  selectedGroupId,
}: UfliMapGridProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleGroupFilter(groupId: string) {
    if (groupId) {
      router.push(`${pathname}?groupId=${groupId}`);
    } else {
      router.push(pathname);
    }
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedGroupId ?? ""}
          onChange={(e) => handleGroupFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">All Students</option>
          {groups.map((g) => (
            <option key={g.groupId} value={g.groupId}>
              {g.groupName}
            </option>
          ))}
        </select>

        {/* Legend */}
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-4 rounded bg-[#d4edda]" />
            Y Passed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-4 rounded bg-[#f8d7da]" />
            N Not Passed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-4 rounded bg-[#fff3cd]" />
            A Absent
          </span>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950">
          No students found. {selectedGroupId ? "Try selecting a different group." : "Add students first."}
        </div>
      ) : (
        /* Scrollable grid container */
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="relative min-w-max">
            <table className="w-full border-collapse text-xs">
              {/* Skill section header row */}
              <thead>
                <tr>
                  {/* Sticky columns header spacer */}
                  <th
                    className="sticky left-0 z-20 border-b border-r border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
                    style={{ minWidth: 200 }}
                  />
                  <th
                    className="sticky z-10 border-b border-r border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
                    style={{ left: 200, minWidth: 48 }}
                  />
                  <th
                    className="sticky z-10 border-b border-r border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
                    style={{ left: 248, minWidth: 48 }}
                  />

                  {/* Skill section spans */}
                  {skillSections.map((section, si) => (
                    <th
                      key={section.name}
                      colSpan={section.count}
                      className={cn(
                        "border-b border-r border-zinc-200 px-1 py-1.5 text-center font-semibold dark:border-zinc-700",
                        SECTION_COLORS[si % SECTION_COLORS.length],
                      )}
                      title={section.name}
                    >
                      <span className="whitespace-nowrap">
                        {section.name.length > 20
                          ? section.name.slice(0, 18) + "…"
                          : section.name}
                      </span>
                    </th>
                  ))}

                  {/* Summary column header */}
                  <th className="border-b border-zinc-200 bg-zinc-100 px-2 py-1.5 text-center font-semibold dark:border-zinc-700 dark:bg-zinc-800">
                    Pass
                  </th>
                </tr>

                {/* Lesson number header row */}
                <tr>
                  {/* Sticky: Student name */}
                  <th
                    className="sticky left-0 z-20 border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-left font-semibold dark:border-zinc-700 dark:bg-zinc-900"
                    style={{ minWidth: 200 }}
                  >
                    Student
                  </th>
                  {/* Sticky: Grade */}
                  <th
                    className="sticky z-10 border-b border-r border-zinc-200 bg-zinc-50 px-1 py-2 text-center font-semibold dark:border-zinc-700 dark:bg-zinc-900"
                    style={{ left: 200, minWidth: 48 }}
                  >
                    Gr
                  </th>
                  {/* Sticky: Summary passed count */}
                  <th
                    className="sticky z-10 border-b border-r border-zinc-200 bg-zinc-50 px-1 py-2 text-center font-semibold dark:border-zinc-700 dark:bg-zinc-900"
                    style={{ left: 248, minWidth: 48 }}
                  >
                    %
                  </th>

                  {/* Lesson numbers */}
                  {lessons.map((l) => (
                    <th
                      key={l.lessonId}
                      className={cn(
                        "border-b border-r border-zinc-200 px-0 py-2 text-center font-mono dark:border-zinc-700",
                        l.isReview
                          ? "bg-zinc-100 font-bold dark:bg-zinc-800"
                          : "bg-zinc-50 dark:bg-zinc-900",
                      )}
                      style={{ minWidth: 28, maxWidth: 28 }}
                      title={`L${l.lessonNumber}: ${l.lessonName ?? ""} (${l.skillSection})${l.isReview ? " — REVIEW" : ""}`}
                    >
                      {l.lessonNumber}
                    </th>
                  ))}

                  {/* Summary total */}
                  <th className="border-b border-zinc-200 bg-zinc-100 px-2 py-2 text-center font-mono dark:border-zinc-700 dark:bg-zinc-800">
                    /128
                  </th>
                </tr>
              </thead>

              <tbody>
                {students.map((student) => {
                  const passCount = Object.values(student.outcomes).filter(
                    (s) => s === "Y",
                  ).length;
                  const attemptedCount = Object.values(
                    student.outcomes,
                  ).filter((s) => s === "Y" || s === "N").length;
                  const pct =
                    attemptedCount > 0
                      ? Math.round((passCount / attemptedCount) * 100)
                      : 0;

                  return (
                    <tr
                      key={student.studentId}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30"
                    >
                      {/* Sticky: Student name */}
                      <td
                        className="sticky left-0 z-10 border-b border-r border-zinc-200 bg-white px-3 py-1.5 font-medium dark:border-zinc-700 dark:bg-zinc-950"
                        style={{ minWidth: 200 }}
                      >
                        <div className="truncate">
                          {student.lastName}, {student.firstName}
                        </div>
                        <div className="truncate text-[10px] text-zinc-400">
                          {student.studentNumber}
                          {student.groupName ? ` · ${student.groupName}` : ""}
                        </div>
                      </td>

                      {/* Sticky: Grade */}
                      <td
                        className="sticky z-10 border-b border-r border-zinc-200 bg-white px-1 py-1.5 text-center dark:border-zinc-700 dark:bg-zinc-950"
                        style={{ left: 200, minWidth: 48 }}
                      >
                        {student.gradeName}
                      </td>

                      {/* Sticky: Pass % */}
                      <td
                        className={cn(
                          "sticky z-10 border-b border-r border-zinc-200 px-1 py-1.5 text-center font-mono font-semibold dark:border-zinc-700",
                          pct >= 80
                            ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                            : pct >= 50
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                              : attemptedCount > 0
                                ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                : "bg-white dark:bg-zinc-950",
                        )}
                        style={{ left: 248, minWidth: 48 }}
                      >
                        {attemptedCount > 0 ? `${pct}%` : "—"}
                      </td>

                      {/* Lesson cells */}
                      {lessons.map((l) => {
                        const status = student.outcomes[l.lessonId] ?? null;
                        return (
                          <td
                            key={l.lessonId}
                            className={cn(
                              "border-b border-r border-zinc-100 px-0 py-0 text-center dark:border-zinc-800",
                              status ? CELL_STYLES[status] : "",
                            )}
                            style={{ minWidth: 28, maxWidth: 28, height: 28 }}
                          >
                            {status ?? ""}
                          </td>
                        );
                      })}

                      {/* Summary: pass count */}
                      <td className="border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center font-mono dark:border-zinc-700 dark:bg-zinc-900">
                        {passCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
