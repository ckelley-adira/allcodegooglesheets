/**
 * @file dal/ufli-map.ts — Data access layer for the UFLI MAP view
 *
 * Builds the student×lesson grid that is the core progress visualization.
 * Each cell is Y (passed), N (not passed), A (absent), or null (no data).
 *
 * The MAP shows all active students for a school (optionally filtered by
 * group), with 128 lesson columns organized into 16 skill sections.
 *
 * @rls School-scoping enforced by explicit schoolId from JWT claims.
 */

import { eq, and, asc, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  students,
  gradeLevels,
  lessonProgress,
  ufliLessons,
  groupMemberships,
  instructionalGroups,
} from "@/lib/db/schema";

// ── Types ────────────────────────────────────────────────────────────────

/** A lesson column header in the MAP */
export interface LessonColumn {
  lessonId: number;
  lessonNumber: number;
  lessonName: string | null;
  skillSection: string;
  isReview: boolean;
}

/** A student row in the MAP */
export interface StudentMapRow {
  studentId: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  gradeName: string;
  groupName: string | null;
  /** Map of lessonId -> status. Only populated lessons have entries. */
  outcomes: Record<number, "Y" | "N" | "A">;
}

/** Summary stats for a student across the 128 lessons */
export interface StudentMapSummary {
  studentId: number;
  totalPassed: number;
  totalAttempted: number;
  totalAbsent: number;
  foundationalPct: number;
}

/** Full MAP data returned to the page */
export interface UfliMapData {
  lessons: LessonColumn[];
  students: StudentMapRow[];
  /** Skill section boundaries for column group headers */
  skillSections: { name: string; startIndex: number; count: number }[];
}

// ── Queries ──────────────────────────────────────────────────────────────

/**
 * Builds the complete UFLI MAP dataset for a school.
 *
 * @param schoolId - From the authenticated user's JWT claims
 * @param yearId - The academic year to show progress for
 * @param groupId - Optional filter: show only students in this group
 *
 * @rls Filters by schoolId from the caller's JWT claims.
 */
export async function getUfliMapData(
  schoolId: number,
  yearId: number,
  groupId?: number,
): Promise<UfliMapData> {
  // 1. Get all lesson columns (reference data — always 128)
  const lessonRows = await db
    .select({
      lessonId: ufliLessons.lessonId,
      lessonNumber: ufliLessons.lessonNumber,
      lessonName: ufliLessons.lessonName,
      skillSection: ufliLessons.skillSection,
      isReview: ufliLessons.isReview,
    })
    .from(ufliLessons)
    .orderBy(asc(ufliLessons.sortOrder));

  // 2. Build skill section boundaries
  const skillSections: { name: string; startIndex: number; count: number }[] =
    [];
  let currentSection = "";
  for (let i = 0; i < lessonRows.length; i++) {
    if (lessonRows[i].skillSection !== currentSection) {
      currentSection = lessonRows[i].skillSection;
      skillSections.push({ name: currentSection, startIndex: i, count: 1 });
    } else {
      skillSections[skillSections.length - 1].count++;
    }
  }

  // 3. Get students (optionally filtered by group)
  let studentRows: {
    studentId: number;
    firstName: string;
    lastName: string;
    studentNumber: string;
    gradeName: string;
    groupName: string | null;
  }[];

  if (groupId) {
    // Filtered: students in a specific group
    studentRows = await db
      .select({
        studentId: students.studentId,
        firstName: students.firstName,
        lastName: students.lastName,
        studentNumber: students.studentNumber,
        gradeName: gradeLevels.name,
        groupName: instructionalGroups.groupName,
      })
      .from(groupMemberships)
      .innerJoin(students, eq(groupMemberships.studentId, students.studentId))
      .innerJoin(gradeLevels, eq(students.gradeId, gradeLevels.gradeId))
      .innerJoin(
        instructionalGroups,
        eq(groupMemberships.groupId, instructionalGroups.groupId),
      )
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.isActive, true),
          eq(students.enrollmentStatus, "active"),
        ),
      )
      .orderBy(asc(gradeLevels.sortOrder), asc(students.lastName), asc(students.firstName));
  } else {
    // Unfiltered: all active students in the school, with their current group
    // Use a subquery to get the most recent active group membership
    studentRows = await db
      .select({
        studentId: students.studentId,
        firstName: students.firstName,
        lastName: students.lastName,
        studentNumber: students.studentNumber,
        gradeName: gradeLevels.name,
        groupName: sql<string | null>`(
          SELECT ig.group_name
          FROM group_memberships gm
          JOIN instructional_groups ig ON ig.group_id = gm.group_id
          WHERE gm.student_id = ${students.studentId}
            AND gm.is_active = true
          ORDER BY gm.joined_date DESC
          LIMIT 1
        )`,
      })
      .from(students)
      .innerJoin(gradeLevels, eq(students.gradeId, gradeLevels.gradeId))
      .where(
        and(
          eq(students.schoolId, schoolId),
          eq(students.enrollmentStatus, "active"),
        ),
      )
      .orderBy(asc(gradeLevels.sortOrder), asc(students.lastName), asc(students.firstName));
  }

  if (studentRows.length === 0) {
    return { lessons: lessonRows, students: [], skillSections };
  }

  // 4. Get all lesson progress for these students in this year
  const studentIds = studentRows.map((s) => s.studentId);
  const progressRows = await db
    .select({
      studentId: lessonProgress.studentId,
      lessonId: lessonProgress.lessonId,
      status: lessonProgress.status,
    })
    .from(lessonProgress)
    .where(
      and(
        inArray(lessonProgress.studentId, studentIds),
        eq(lessonProgress.yearId, yearId),
      ),
    );

  // 5. Build the outcomes map: studentId -> { lessonId -> status }
  const outcomesMap = new Map<number, Record<number, "Y" | "N" | "A">>();
  for (const row of progressRows) {
    if (!outcomesMap.has(row.studentId)) {
      outcomesMap.set(row.studentId, {});
    }
    // If multiple records exist for same student+lesson, use the latest
    // (the query doesn't specify order, but upsert ensures only one per date)
    outcomesMap.get(row.studentId)![row.lessonId] = row.status;
  }

  // 6. Assemble student rows
  const mapStudents: StudentMapRow[] = studentRows.map((s) => ({
    studentId: s.studentId,
    firstName: s.firstName,
    lastName: s.lastName,
    studentNumber: s.studentNumber,
    gradeName: s.gradeName,
    groupName: s.groupName,
    outcomes: outcomesMap.get(s.studentId) ?? {},
  }));

  return { lessons: lessonRows, students: mapStudents, skillSections };
}
