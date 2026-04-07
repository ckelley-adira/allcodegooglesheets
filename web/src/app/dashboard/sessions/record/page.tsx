/**
 * @file sessions/record/page.tsx — Tutor Input Form (Server Component shell)
 *
 * The daily-use surface for tutors (D-014). Mobile-first lesson data entry.
 * Flow: select group → select lesson → mark Y/N/A per student → submit.
 *
 * This Server Component loads all data (groups, lessons, students, existing
 * outcomes), then hands it to the LessonEntryForm client component.
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { listGroups, listAcademicYears } from "@/lib/dal/groups";
import { listLessons } from "@/lib/dal/sessions";
import { LessonEntryForm } from "./lesson-entry-form";

interface RecordPageProps {
  searchParams: Promise<{ groupId?: string }>;
}

export default async function RecordPage({ searchParams }: RecordPageProps) {
  const { groupId: groupIdParam } = await searchParams;
  const user = await requireAuth();

  const [groups, lessons, years] = await Promise.all([
    listGroups(user.schoolId),
    listLessons(),
    listAcademicYears(user.schoolId),
  ]);

  const activeGroups = groups.filter((g) => g.isActive);
  const currentYear = years.find((y) => y.isCurrent);
  const preselectedGroupId = groupIdParam ? Number(groupIdParam) : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Breadcrumb */}
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
        lessons={lessons}
        yearId={currentYear?.yearId ?? 0}
        preselectedGroupId={preselectedGroupId}
      />
    </div>
  );
}
