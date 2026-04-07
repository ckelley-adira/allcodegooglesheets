/**
 * @file dal/groups.ts — Data access layer for instructional groups
 *
 * Handles group CRUD and group membership (student assignment/removal).
 * Groups are scoped to a school + academic year. Per D-008, groups use
 * structured fields (grade, identifier) not free-text names.
 *
 * @rls School-scoping enforced by explicit schoolId from JWT claims,
 *   backed by RLS policies at the database layer (D-002).
 */

import { eq, and, asc, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  instructionalGroups,
  groupMemberships,
  students,
  staff,
  gradeLevels,
  academicYears,
} from "@/lib/db/schema";

// ── Group types ──────────────────────────────────────────────────────────

export interface GroupRow {
  groupId: number;
  groupName: string;
  gradeName: string;
  gradeId: number;
  yearLabel: string;
  yearId: number;
  staffName: string;
  staffId: number;
  isMixedGrade: boolean;
  isActive: boolean;
  memberCount: number;
}

export interface CreateGroupInput {
  schoolId: number;
  gradeId: number;
  yearId: number;
  staffId: number;
  groupName: string;
  isMixedGrade?: boolean;
}

export interface UpdateGroupInput {
  groupId: number;
  groupName?: string;
  gradeId?: number;
  staffId?: number;
  isMixedGrade?: boolean;
  isActive?: boolean;
}

// ── Membership types ─────────────────────────────────────────────────────

export interface MembershipRow {
  membershipId: number;
  studentId: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  gradeName: string;
  joinedDate: string;
  isActive: boolean;
}

// ── Group queries ────────────────────────────────────────────────────────

/**
 * Lists all groups for a school, with member count, staff name, and grade.
 *
 * @rls Filters by schoolId from the caller's JWT claims.
 */
export async function listGroups(schoolId: number): Promise<GroupRow[]> {
  const rows = await db
    .select({
      groupId: instructionalGroups.groupId,
      groupName: instructionalGroups.groupName,
      gradeName: gradeLevels.name,
      gradeId: instructionalGroups.gradeId,
      yearLabel: academicYears.label,
      yearId: instructionalGroups.yearId,
      staffFirstName: staff.firstName,
      staffLastName: staff.lastName,
      staffId: instructionalGroups.staffId,
      isMixedGrade: instructionalGroups.isMixedGrade,
      isActive: instructionalGroups.isActive,
    })
    .from(instructionalGroups)
    .innerJoin(gradeLevels, eq(instructionalGroups.gradeId, gradeLevels.gradeId))
    .innerJoin(academicYears, eq(instructionalGroups.yearId, academicYears.yearId))
    .innerJoin(staff, eq(instructionalGroups.staffId, staff.staffId))
    .where(eq(instructionalGroups.schoolId, schoolId))
    .orderBy(asc(gradeLevels.sortOrder), asc(instructionalGroups.groupName));

  // Get member counts in a separate query to avoid complex aggregation
  const counts = await db
    .select({
      groupId: groupMemberships.groupId,
      count: sql<number>`count(*)::int`,
    })
    .from(groupMemberships)
    .where(eq(groupMemberships.isActive, true))
    .groupBy(groupMemberships.groupId);

  const countMap = new Map(counts.map((c) => [c.groupId, c.count]));

  return rows.map((r) => ({
    groupId: r.groupId,
    groupName: r.groupName,
    gradeName: r.gradeName,
    gradeId: r.gradeId,
    yearLabel: r.yearLabel,
    yearId: r.yearId,
    staffName: `${r.staffFirstName} ${r.staffLastName}`,
    staffId: r.staffId,
    isMixedGrade: r.isMixedGrade,
    isActive: r.isActive,
    memberCount: countMap.get(r.groupId) ?? 0,
  }));
}

/**
 * Gets a single group by ID, scoped to school.
 *
 * @rls Verifies schoolId matches the caller's JWT claims.
 */
export async function getGroup(
  groupId: number,
  schoolId: number,
): Promise<GroupRow | null> {
  const [row] = await db
    .select({
      groupId: instructionalGroups.groupId,
      groupName: instructionalGroups.groupName,
      gradeName: gradeLevels.name,
      gradeId: instructionalGroups.gradeId,
      yearLabel: academicYears.label,
      yearId: instructionalGroups.yearId,
      staffFirstName: staff.firstName,
      staffLastName: staff.lastName,
      staffId: instructionalGroups.staffId,
      isMixedGrade: instructionalGroups.isMixedGrade,
      isActive: instructionalGroups.isActive,
    })
    .from(instructionalGroups)
    .innerJoin(gradeLevels, eq(instructionalGroups.gradeId, gradeLevels.gradeId))
    .innerJoin(academicYears, eq(instructionalGroups.yearId, academicYears.yearId))
    .innerJoin(staff, eq(instructionalGroups.staffId, staff.staffId))
    .where(
      and(
        eq(instructionalGroups.groupId, groupId),
        eq(instructionalGroups.schoolId, schoolId),
      ),
    )
    .limit(1);

  if (!row) return null;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMemberships)
    .where(
      and(
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.isActive, true),
      ),
    );

  return {
    groupId: row.groupId,
    groupName: row.groupName,
    gradeName: row.gradeName,
    gradeId: row.gradeId,
    yearLabel: row.yearLabel,
    yearId: row.yearId,
    staffName: `${row.staffFirstName} ${row.staffLastName}`,
    staffId: row.staffId,
    isMixedGrade: row.isMixedGrade,
    isActive: row.isActive,
    memberCount: countRow?.count ?? 0,
  };
}

/**
 * Creates a new instructional group.
 *
 * @rls schoolId comes from the caller's JWT claims.
 */
export async function createGroup(input: CreateGroupInput): Promise<number> {
  const [row] = await db
    .insert(instructionalGroups)
    .values({
      schoolId: input.schoolId,
      gradeId: input.gradeId,
      yearId: input.yearId,
      staffId: input.staffId,
      groupName: input.groupName,
      isMixedGrade: input.isMixedGrade ?? false,
    })
    .returning({ groupId: instructionalGroups.groupId });

  return row.groupId;
}

/**
 * Updates a group's details. Only provided fields are updated.
 *
 * @rls schoolId check performed by the caller.
 */
export async function updateGroup(
  input: UpdateGroupInput,
  schoolId: number,
): Promise<boolean> {
  const updates: Record<string, unknown> = {};
  if (input.groupName !== undefined) updates.groupName = input.groupName;
  if (input.gradeId !== undefined) updates.gradeId = input.gradeId;
  if (input.staffId !== undefined) updates.staffId = input.staffId;
  if (input.isMixedGrade !== undefined) updates.isMixedGrade = input.isMixedGrade;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  if (Object.keys(updates).length === 0) return false;

  const result = await db
    .update(instructionalGroups)
    .set(updates)
    .where(
      and(
        eq(instructionalGroups.groupId, input.groupId),
        eq(instructionalGroups.schoolId, schoolId),
      ),
    )
    .returning({ groupId: instructionalGroups.groupId });

  return result.length > 0;
}

// ── Membership queries ───────────────────────────────────────────────────

/**
 * Lists active members of a group with student details.
 */
export async function listGroupMembers(
  groupId: number,
): Promise<MembershipRow[]> {
  return db
    .select({
      membershipId: groupMemberships.membershipId,
      studentId: students.studentId,
      firstName: students.firstName,
      lastName: students.lastName,
      studentNumber: students.studentNumber,
      gradeName: gradeLevels.name,
      joinedDate: groupMemberships.joinedDate,
      isActive: groupMemberships.isActive,
    })
    .from(groupMemberships)
    .innerJoin(students, eq(groupMemberships.studentId, students.studentId))
    .innerJoin(gradeLevels, eq(students.gradeId, gradeLevels.gradeId))
    .where(
      and(
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.isActive, true),
      ),
    )
    .orderBy(asc(students.lastName), asc(students.firstName));
}

/**
 * Lists students in a school who are NOT active members of the given group.
 * Used to populate the "Add student" dropdown.
 */
export async function listAvailableStudents(
  groupId: number,
  schoolId: number,
) {
  // Get IDs of students already in this group
  const existing = await db
    .select({ studentId: groupMemberships.studentId })
    .from(groupMemberships)
    .where(
      and(
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.isActive, true),
      ),
    );

  const existingIds = new Set(existing.map((e) => e.studentId));

  // Get all active students for this school
  const allStudents = await db
    .select({
      studentId: students.studentId,
      firstName: students.firstName,
      lastName: students.lastName,
      studentNumber: students.studentNumber,
      gradeName: gradeLevels.name,
    })
    .from(students)
    .innerJoin(gradeLevels, eq(students.gradeId, gradeLevels.gradeId))
    .where(
      and(
        eq(students.schoolId, schoolId),
        eq(students.enrollmentStatus, "active"),
      ),
    )
    .orderBy(asc(students.lastName), asc(students.firstName));

  return allStudents.filter((s) => !existingIds.has(s.studentId));
}

/**
 * Adds a student to a group. Creates a new active membership record.
 */
export async function addStudentToGroup(
  groupId: number,
  studentId: number,
): Promise<void> {
  await db.insert(groupMemberships).values({
    groupId,
    studentId,
    joinedDate: sql`CURRENT_DATE`,
    isActive: true,
  });
}

/**
 * Removes a student from a group by setting is_active = false
 * and recording the left_date. Preserves history per the data model.
 */
export async function removeStudentFromGroup(
  membershipId: number,
): Promise<void> {
  await db
    .update(groupMemberships)
    .set({
      isActive: false,
      leftDate: sql`CURRENT_DATE`,
    })
    .where(eq(groupMemberships.membershipId, membershipId));
}

/**
 * Lists academic years for a school (for the group create form).
 */
export async function listAcademicYears(schoolId: number) {
  return db
    .select({
      yearId: academicYears.yearId,
      label: academicYears.label,
      isCurrent: academicYears.isCurrent,
    })
    .from(academicYears)
    .where(eq(academicYears.schoolId, schoolId))
    .orderBy(asc(academicYears.label));
}

/**
 * Lists active staff for a school (for the group create/edit form).
 */
export async function listActiveStaff(schoolId: number) {
  return db
    .select({
      staffId: staff.staffId,
      firstName: staff.firstName,
      lastName: staff.lastName,
    })
    .from(staff)
    .where(and(eq(staff.schoolId, schoolId), eq(staff.isActive, true)))
    .orderBy(asc(staff.lastName), asc(staff.firstName));
}
