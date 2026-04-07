/**
 * @file sessions/record/page.tsx — Tutor Input Form (Server Component shell)
 *
 * The daily-use surface for tutors (D-014). Mobile-first lesson data entry.
 * Flow: select group → tap pending lesson → mark Y/N/A per student → submit.
 *
 * The form auto-fetches the group's pending sequence lessons via the API
 * when a group is selected — no need to pass the full lesson catalog here.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listGroups, listAcademicYears } from "@/lib/dal/groups";
import { LessonEntryForm } from "./lesson-entry-form";

interface RecordPageProps {
  searchParams: Promise<{ groupId?: string }>;
}

export default async function RecordPage({ searchParams }: RecordPageProps) {
  const { groupId: groupIdParam } = await searchParams;
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);

  const [groups, years] = await Promise.all([
    listGroups(activeSchoolId),
    listAcademicYears(activeSchoolId),
  ]);

  const activeGroups = groups.filter((g) => g.isActive);
  const currentYear = years.find((y) => y.isCurrent);
  const preselectedGroupId = groupIdParam ? Number(groupIdParam) : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/dashboard/sessions"
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Sessions
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100">Record Lesson</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">Record Lesson</h1>

      <LessonEntryForm
        groups={activeGroups.map((g) => ({
          groupId: g.groupId,
          groupName: g.groupName,
          gradeName: g.gradeName,
        }))}
        yearId={currentYear?.yearId ?? 0}
        preselectedGroupId={preselectedGroupId}
      />
    </div>
  );
}
