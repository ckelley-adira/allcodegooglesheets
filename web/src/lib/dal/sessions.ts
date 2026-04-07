/**
 * @file dal/sessions.ts — Data access layer for lesson progress recording
 *
 * Handles reading and writing lesson_progress rows — the core daily data
 * entry surface for tutors. Each row records a student×lesson outcome
 * (Y = passed, N = not passed, A = absent).
 *
 * Per D-012 (Equity of Visibility): 'A' values are excluded from slope
 * calculations, never counted as zeros.
 * Per D-006: the analytical framework carries forward unchanged.
 *
 * @rls School-scoping enforced by the caller's schoolId from JWT claims.
 */

import { eq, and, asc, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  lessonProgress,
  ufliLessons,
  students,
  groupMemberships,
  gradeLevels,
  instructionalGroups,
} from "@/lib/db/schema";

// ── Types ────────────────────────────────────────────────────────────────

/** A single student's outcome for a lesson */
export interface LessonOutcome {
  studentId: number;
  status: "Y" | "N" | "A";
}

/** Input for recording a batch of lesson outcomes */
export interface RecordSessionInput {
  groupId: number;
  lessonId: number;
  yearId: number;
  dateRecorded: string;
  recordedBy: number;
  outcomes: LessonOutcome[];
}

/** A lesson with its existing status for a student (for pre-populating the form) */
export interface ExistingOutcome {
  studentId: number;
  status: "Y" | "N" | "A";
}

/** Recent session entry for the sessions list */
export interface RecentEntry {
  dateRecorded: string;
  lessonNumber: number;
  lessonName: string | null;
  groupName: string;
  groupId: number;
  outcomeCount: number;
}

// ── Queries ──────────────────────────────────────────────────────────────

/**
 * Lists all UFLI lessons (reference data for the lesson selector).
 * Ordered by lesson number.
 */
export async function listLessons() {
  return db
    .select({
      lessonId: ufliLessons.lessonId,
      lessonNumber: ufliLessons.lessonNumber,
      lessonName: ufliLessons.lessonName,
      skillSection: ufliLessons.skillSection,
      isReview: ufliLessons.isReview,
    })
    .from(ufliLessons)
    .orderBy(asc(ufliLessons.lessonNumber));
}

/**
 * Gets active students in a group for the lesson entry form.
 * Returns student details needed for the Y/N/A grid.
 */
export async function getGroupStudentsForEntry(groupId: number) {
  return db
    .select({
      studentId: students.studentId,
      firstName: students.firstName,
      lastName: students.lastName,
      studentNumber: students.studentNumber,
      gradeName: gradeLevels.name,
    })
    .from(groupMemberships)
    .innerJoin(students, eq(groupMemberships.studentId, students.studentId))
    .innerJoin(gradeLevels, eq(students.gradeId, gradeLevels.gradeId))
    .where(
      and(
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.isActive, true),
        eq(students.enrollmentStatus, "active"),
      ),
    )
    .orderBy(asc(students.lastName), asc(students.firstName));
}

/**
 * Gets existing lesson outcomes for a group+lesson combination.
 * Used to pre-populate the form when editing an existing entry.
 */
export async function getExistingOutcomes(
  groupId: number,
  lessonId: number,
  yearId: number,
): Promise<ExistingOutcome[]> {
  return db
    .select({
      studentId: lessonProgress.studentId,
      status: lessonProgress.status,
    })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.groupId, groupId),
        eq(lessonProgress.lessonId, lessonId),
        eq(lessonProgress.yearId, yearId),
      ),
    );
}

/**
 * Records a batch of lesson outcomes (the core write operation).
 * Uses upsert: if a record already exists for student+lesson+year+date,
 * it updates the status rather than creating a duplicate.
 *
 * @rls The caller must verify groupId belongs to the user's school.
 */
export async function recordLessonOutcomes(
  input: RecordSessionInput,
): Promise<number> {
  if (input.outcomes.length === 0) return 0;

  const values = input.outcomes.map((o) => ({
    studentId: o.studentId,
    groupId: input.groupId,
    lessonId: input.lessonId,
    yearId: input.yearId,
    status: o.status as "Y" | "N" | "A",
    dateRecorded: input.dateRecorded,
    recordedBy: input.recordedBy,
    source: "form" as const,
  }));

  const result = await db
    .insert(lessonProgress)
    .values(values)
    .onConflictDoUpdate({
      target: [
        lessonProgress.studentId,
        lessonProgress.lessonId,
        lessonProgress.yearId,
        lessonProgress.dateRecorded,
      ],
      set: {
        status: sql`excluded.status`,
        groupId: sql`excluded.group_id`,
        recordedBy: sql`excluded.recorded_by`,
      },
    })
    .returning({ progressId: lessonProgress.progressId });

  return result.length;
}

/**
 * Lists recent lesson entries for a school, for the sessions overview page.
 */
export async function listRecentEntries(
  schoolId: number,
  limit: number = 20,
): Promise<RecentEntry[]> {
  const rows = await db
    .select({
      dateRecorded: lessonProgress.dateRecorded,
      lessonNumber: ufliLessons.lessonNumber,
      lessonName: ufliLessons.lessonName,
      groupName: instructionalGroups.groupName,
      groupId: lessonProgress.groupId,
      outcomeCount: sql<number>`count(*)::int`,
    })
    .from(lessonProgress)
    .innerJoin(
      ufliLessons,
      eq(lessonProgress.lessonId, ufliLessons.lessonId),
    )
    .innerJoin(
      instructionalGroups,
      eq(lessonProgress.groupId, instructionalGroups.groupId),
    )
    .where(eq(instructionalGroups.schoolId, schoolId))
    .groupBy(
      lessonProgress.dateRecorded,
      ufliLessons.lessonNumber,
      ufliLessons.lessonName,
      instructionalGroups.groupName,
      lessonProgress.groupId,
    )
    .orderBy(sql`${lessonProgress.dateRecorded} DESC`)
    .limit(limit);

  return rows;
}

/**
 * Gets groups assigned to a specific staff member (for the tutor's view).
 */
export async function getStaffGroups(staffId: number) {
  return db
    .select({
      groupId: instructionalGroups.groupId,
      groupName: instructionalGroups.groupName,
      gradeName: gradeLevels.name,
      isMixedGrade: instructionalGroups.isMixedGrade,
    })
    .from(instructionalGroups)
    .innerJoin(
      gradeLevels,
      eq(instructionalGroups.gradeId, gradeLevels.gradeId),
    )
    .where(
      and(
        eq(instructionalGroups.staffId, staffId),
        eq(instructionalGroups.isActive, true),
      ),
    )
    .orderBy(asc(gradeLevels.sortOrder), asc(instructionalGroups.groupName));
}
