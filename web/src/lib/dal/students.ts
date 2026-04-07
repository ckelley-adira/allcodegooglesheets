/**
 * @file dal/students.ts — Data access layer for student operations
 *
 * Uses the Supabase JS client (PostgREST over HTTPS) instead of direct
 * Postgres connections. This is required for reliable serverless operation —
 * persistent DB connections cause hangs in Vercel functions.
 *
 * Per D-009: student_number (external ID) is the canonical join key.
 * Per D-012: enrollment_status tracks lifecycle.
 *
 * @rls School-scoping is enforced automatically by RLS policies (D-002)
 *   based on the user's JWT claims, since we use the authenticated client.
 */

import { createClient } from "@/lib/supabase/server";

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

export interface CreateStudentInput {
  schoolId: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  gradeId: number;
  enrollmentDate: string;
}

export interface UpdateStudentInput {
  studentId: number;
  firstName?: string;
  lastName?: string;
  studentNumber?: string;
  gradeId?: number;
  enrollmentStatus?: "active" | "withdrawn" | "transferred" | "graduated";
  withdrawalDate?: string | null;
}

interface RawStudentRow {
  student_id: number;
  first_name: string;
  last_name: string;
  student_number: string;
  enrollment_status: "active" | "withdrawn" | "transferred" | "graduated";
  enrollment_date: string;
  withdrawal_date: string | null;
  grade_id: number;
  created_at: string;
  grade_levels: { name: string } | null;
}

function mapStudentRow(r: RawStudentRow): StudentRow {
  return {
    studentId: r.student_id,
    firstName: r.first_name,
    lastName: r.last_name,
    studentNumber: r.student_number,
    enrollmentStatus: r.enrollment_status,
    enrollmentDate: r.enrollment_date,
    withdrawalDate: r.withdrawal_date,
    gradeId: r.grade_id,
    gradeName: r.grade_levels?.name ?? "",
    createdAt: new Date(r.created_at),
  };
}

/**
 * Lists all students for the current user's school, ordered by last name.
 *
 * @rls Filters by school_id automatically via RLS policy.
 */
export async function listStudents(_schoolId: number): Promise<StudentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      "student_id, first_name, last_name, student_number, enrollment_status, enrollment_date, withdrawal_date, grade_id, created_at, grade_levels(name)",
    )
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapStudentRow(r as unknown as RawStudentRow));
}

/**
 * Gets a single student by ID.
 *
 * @rls School-scoped via RLS policy.
 */
export async function getStudent(
  studentId: number,
  _schoolId: number,
): Promise<StudentRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      "student_id, first_name, last_name, student_number, enrollment_status, enrollment_date, withdrawal_date, grade_id, created_at, grade_levels(name)",
    )
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapStudentRow(data as unknown as RawStudentRow);
}

/**
 * Creates a new student.
 *
 * @rls School-scoped via RLS policy. school_id must match JWT claim.
 */
export async function createStudent(
  input: CreateStudentInput,
): Promise<StudentRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .insert({
      school_id: input.schoolId,
      grade_id: input.gradeId,
      first_name: input.firstName,
      last_name: input.lastName,
      student_number: input.studentNumber,
      enrollment_date: input.enrollmentDate,
    })
    .select(
      "student_id, first_name, last_name, student_number, enrollment_status, enrollment_date, withdrawal_date, grade_id, created_at, grade_levels(name)",
    )
    .single();

  if (error) throw new Error(error.message);
  return mapStudentRow(data as unknown as RawStudentRow);
}

/**
 * Updates a student. Only provided fields are changed.
 *
 * @rls School-scoped via RLS policy.
 */
export async function updateStudent(
  input: UpdateStudentInput,
  _schoolId: number,
): Promise<StudentRow | null> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = {};
  if (input.firstName !== undefined) updates.first_name = input.firstName;
  if (input.lastName !== undefined) updates.last_name = input.lastName;
  if (input.studentNumber !== undefined)
    updates.student_number = input.studentNumber;
  if (input.gradeId !== undefined) updates.grade_id = input.gradeId;
  if (input.enrollmentStatus !== undefined)
    updates.enrollment_status = input.enrollmentStatus;
  if (input.withdrawalDate !== undefined)
    updates.withdrawal_date = input.withdrawalDate;

  // Auto-set withdrawal date when status changes to inactive
  if (
    input.enrollmentStatus &&
    input.enrollmentStatus !== "active" &&
    !input.withdrawalDate
  ) {
    updates.withdrawal_date = new Date().toISOString().split("T")[0];
  }

  if (Object.keys(updates).length === 0) return null;

  const { data, error } = await supabase
    .from("students")
    .update(updates)
    .eq("student_id", input.studentId)
    .select(
      "student_id, first_name, last_name, student_number, enrollment_status, enrollment_date, withdrawal_date, grade_id, created_at, grade_levels(name)",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapStudentRow(data as unknown as RawStudentRow);
}

/**
 * Lists all grade levels (reference data, RLS allows all authenticated reads).
 */
export async function listGradeLevels() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grade_levels")
    .select("grade_id, name, sort_order, grade_band")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    gradeId: r.grade_id,
    name: r.name,
    sortOrder: r.sort_order,
    gradeBand: r.grade_band,
  }));
}
