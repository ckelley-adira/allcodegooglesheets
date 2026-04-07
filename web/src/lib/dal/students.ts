/**
 * @file dal/students.ts — Data access layer for student operations
 *
 * All database queries and mutations for student records. Every function
 * is called from Server Actions or Server Components only.
 *
 * Per D-009: student_number (external ID) is the canonical join key.
 * Per D-012: enrollment_status tracks lifecycle (active/withdrawn/transferred/graduated).
 *
 * @rls School-scoping enforced by explicit schoolId parameter from JWT claims,
 *   backed by RLS policies at the database layer (D-002).
 */

import { eq, and, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { students, gradeLevels } from "@/lib/db/schema";

/** Shape returned to the UI — includes grade name from the join */
export interface StudentRow {
  studentId: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  enrollmentStatus: "active" | "withdrawn" | "transferred" | "graduated";
  enrollmentDate: string;
  withdrawalDate: string | null;
  gradeId: number;
  gradeName: string;
  createdAt: Date;
}

/** Input for creating a new student */
export interface CreateStudentInput {
  schoolId: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  gradeId: number;
  enrollmentDate: string;
}

/** Input for updating a student */
export interface UpdateStudentInput {
  studentId: number;
  firstName?: string;
  lastName?: string;
  studentNumber?: string;
  gradeId?: number;
  enrollmentStatus?: "active" | "withdrawn" | "transferred" | "graduated";
  withdrawalDate?: string | null;
}

/**
 * Lists all students for a school, ordered by last name.
 * Joins grade_levels for the display name.
 *
 * @rls Filters by schoolId from the caller's JWT claims.
 */
export async function listStudents(schoolId: number): Promise<StudentRow[]> {
  const rows = await db
    .select({
      studentId: students.studentId,
      firstName: students.firstName,
      lastName: students.lastName,
      studentNumber: students.studentNumber,
      enrollmentStatus: students.enrollmentStatus,
      enrollmentDate: students.enrollmentDate,
      withdrawalDate: students.withdrawalDate,
      gradeId: students.gradeId,
      gradeName: gradeLevels.name,
      createdAt: students.createdAt,
    })
    .from(students)
    .innerJoin(gradeLevels, eq(students.gradeId, gradeLevels.gradeId))
    .where(eq(students.schoolId, schoolId))
    .orderBy(asc(students.lastName), asc(students.firstName));

  return rows;
}

/**
 * Gets a single student by ID, scoped to school.
 *
 * @rls Verifies schoolId matches the caller's JWT claims.
 */
export async function getStudent(
  studentId: number,
  schoolId: number,
): Promise<StudentRow | null> {
  const [row] = await db
    .select({
      studentId: students.studentId,
      firstName: students.firstName,
      lastName: students.lastName,
      studentNumber: students.studentNumber,
      enrollmentStatus: students.enrollmentStatus,
      enrollmentDate: students.enrollmentDate,
      withdrawalDate: students.withdrawalDate,
      gradeId: students.gradeId,
      gradeName: gradeLevels.name,
      createdAt: students.createdAt,
    })
    .from(students)
    .innerJoin(gradeLevels, eq(students.gradeId, gradeLevels.gradeId))
    .where(
      and(eq(students.studentId, studentId), eq(students.schoolId, schoolId)),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Creates a new student for a school.
 *
 * @rls schoolId comes from the caller's JWT claims.
 */
export async function createStudent(
  input: CreateStudentInput,
): Promise<StudentRow> {
  const [inserted] = await db
    .insert(students)
    .values({
      schoolId: input.schoolId,
      firstName: input.firstName,
      lastName: input.lastName,
      studentNumber: input.studentNumber,
      gradeId: input.gradeId,
      enrollmentDate: input.enrollmentDate,
    })
    .returning();

  // Re-query to get the grade name join
  const row = await getStudent(inserted.studentId, input.schoolId);
  return row!;
}

/**
 * Updates a student's details. Only the provided fields are updated.
 *
 * @rls schoolId check is performed by the caller (Server Action).
 */
export async function updateStudent(
  input: UpdateStudentInput,
  schoolId: number,
): Promise<StudentRow | null> {
  const updates: Record<string, unknown> = {};
  if (input.firstName !== undefined) updates.firstName = input.firstName;
  if (input.lastName !== undefined) updates.lastName = input.lastName;
  if (input.studentNumber !== undefined)
    updates.studentNumber = input.studentNumber;
  if (input.gradeId !== undefined) updates.gradeId = input.gradeId;
  if (input.enrollmentStatus !== undefined)
    updates.enrollmentStatus = input.enrollmentStatus;
  if (input.withdrawalDate !== undefined)
    updates.withdrawalDate = input.withdrawalDate;

  if (Object.keys(updates).length === 0) return null;

  // If withdrawing, set withdrawal date to today if not provided
  if (
    updates.enrollmentStatus &&
    updates.enrollmentStatus !== "active" &&
    !updates.withdrawalDate
  ) {
    updates.withdrawalDate = sql`CURRENT_DATE`;
  }

  await db
    .update(students)
    .set(updates)
    .where(
      and(
        eq(students.studentId, input.studentId),
        eq(students.schoolId, schoolId),
      ),
    );

  return getStudent(input.studentId, schoolId);
}

/**
 * Lists all grade levels (reference data).
 * Not school-scoped — grade levels are global.
 */
export async function listGradeLevels() {
  return db
    .select({
      gradeId: gradeLevels.gradeId,
      name: gradeLevels.name,
      sortOrder: gradeLevels.sortOrder,
      gradeBand: gradeLevels.gradeBand,
    })
    .from(gradeLevels)
    .orderBy(asc(gradeLevels.sortOrder));
}
