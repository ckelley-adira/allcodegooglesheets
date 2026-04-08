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
  listAcademicYears,
} from "@/lib/dal/groups";
import { listGradeLevels } from "@/lib/dal/students";
import { getSchool } from "@/lib/dal/schools";
import {
  getSequenceWithLessons,
  listSequencesForGroup,
} from "@/lib/dal/sequences";
import { listLessons } from "@/lib/dal/sessions";
import { getMaxGradeDenominator } from "@/config/ufli";
import { Badge } from "@/components/ui/badge";
import { AddStudentForm } from "./add-student-form";
import { RemoveStudentButton } from "./remove-student-button";
import { EditGroupForm } from "./edit-group-form";
import { SequencePanel } from "./sequences/sequence-panel";
import { BuildSequenceForm } from "./sequences/build-sequence-form";

type GroupTab = "roster" | "sequences" | "settings";

const VALID_TABS: GroupTab[] = ["roster", "sequences", "settings"];

interface GroupDetailPageProps {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function GroupDetailPage({
  params,
  searchParams,
}: GroupDetailPageProps) {
  const { groupId: groupIdParam } = await params;
  const { tab: tabParam } = await searchParams;
  const groupId = Number(groupIdParam);
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);

  if (!groupId || isNaN(groupId)) notFound();

  const group = await getGroup(groupId, activeSchoolId);
  if (!group) notFound();

  const canEdit =
    ["coach", "school_admin", "tilt_admin"].includes(user.role) ||
    user.isTiltAdmin;

  // Active tab — default to Roster (the most common task). "settings" is
  // only valid when the user has edit permissions; anonymous link-sharing
  // with ?tab=settings falls back to Roster.
  const requestedTab =
    tabParam && VALID_TABS.includes(tabParam as GroupTab)
      ? (tabParam as GroupTab)
      : "roster";
  const activeTab: GroupTab =
    requestedTab === "settings" && !canEdit ? "roster" : requestedTab;

  const [
    members,
    available,
    staffList,
    grades,
    school,
    allSequences,
    academicYears,
    // Only tutors-who-can-edit open the Build Sequence form, and it's the
    // sole consumer of the 128-row UFLI lesson list. Skip the fetch for
    // everyone else to keep the per-render cost down.
    allLessons,
  ] = await Promise.all([
    listGroupMembers(groupId),
    listAvailableStudents(groupId, activeSchoolId),
    listActiveStaff(activeSchoolId),
    listGradeLevels(),
    getSchool(activeSchoolId),
    listSequencesForGroup(groupId),
    listAcademicYears(activeSchoolId),
    canEdit ? listLessons() : Promise.resolve([]),
  ]);

  // Derive the active sequence from allSequences (no extra round-trip
  // against instructional_sequences) and fetch only its lessons.
  const activeSequenceRow = allSequences.find((s) => s.status === "active");
  const activeSequence = activeSequenceRow
    ? await getSequenceWithLessons(activeSequenceRow.sequenceId)
    : null;

  const maxGradeRangeLesson = getMaxGradeDenominator(group.gradeNames);
  const currentYear = academicYears.find((y) => y.isCurrent);
  const nextSequenceNumber = allSequences.length + 1;
  const completedSequences = allSequences.filter(
    (s) => s.status === "completed",
  );

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

      {/* Tab strip */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        <TabLink
          groupId={groupId}
          tab="roster"
          activeTab={activeTab}
          label={`Roster (${members.length})`}
        />
        <TabLink
          groupId={groupId}
          tab="sequences"
          activeTab={activeTab}
          label={`Sequences${allSequences.length > 0 ? ` (${allSequences.length})` : ""}`}
        />
        {canEdit && (
          <TabLink
            groupId={groupId}
            tab="settings"
            activeTab={activeTab}
            label="Settings"
          />
        )}
      </div>

      {/* Settings tab: edit group form */}
      {activeTab === "settings" && canEdit && (
        <EditGroupForm
          group={group}
          grades={grades}
          staffList={staffList}
        />
      )}

      {/* Sequences tab: instructional sequence + history */}
      {activeTab === "sequences" && (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Instructional Sequence</h2>
          {canEdit && currentYear && (
            <BuildSequenceForm
              groupId={groupId}
              yearId={currentYear.yearId}
              defaultCadenceDays={
                school?.cadenceDays && school.cadenceDays.length > 0
                  ? school.cadenceDays
                  : ["TUE", "THU"]
              }
              defaultName={`Sequence ${nextSequenceNumber}`}
              maxGradeRangeLesson={
                maxGradeRangeLesson > 0 ? maxGradeRangeLesson : undefined
              }
              allLessons={allLessons}
            />
          )}
        </div>

        {activeSequence ? (
          <SequencePanel
            sequence={activeSequence}
            groupId={groupId}
            canEdit={canEdit}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No active sequence for this group yet.
              {canEdit && " Click \u201CBuild New Sequence\u201D above to start."}
            </p>
          </div>
        )}

        {completedSequences.length > 0 && (
          <details className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            <summary className="cursor-pointer text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Previous sequences ({completedSequences.length})
            </summary>
            <ul className="mt-3 space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              {completedSequences.map((s) => (
                <li key={s.sequenceId} className="flex items-center justify-between">
                  <span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {s.name}
                    </span>{" "}
                    &middot; {s.completedCount}/{s.lessonCount} lessons
                  </span>
                  {s.endDate && <span>{s.endDate}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      )}

      {/* Roster tab: student list + add form */}
      {activeTab === "roster" && (
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
                          <Link
                            href={`/dashboard/students/${m.studentId}`}
                            className="hover:underline"
                          >
                            {m.firstName} {m.lastName}
                          </Link>
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
      )}
    </div>
  );
}

function TabLink({
  groupId,
  tab,
  activeTab,
  label,
}: {
  groupId: number;
  tab: GroupTab;
  activeTab: GroupTab;
  label: string;
}) {
  const isActive = tab === activeTab;
  return (
    <Link
      href={`/dashboard/groups/${groupId}?tab=${tab}`}
      className={
        isActive
          ? "border-b-2 border-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
          : "border-b-2 border-transparent px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      }
    >
      {label}
    </Link>
  );
}
