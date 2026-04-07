/**
 * @file dashboard/students/actions.ts — Server Actions for student management
 *
 * Wraps the student DAL with authentication and role checks.
 * All authenticated staff can view students; only coach+ can create/update.
 *
 * @actionType mutation
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import {
  createStudent as dalCreateStudent,
  updateStudent as dalUpdateStudent,
} from "@/lib/dal/students";

export interface StudentFormState {
  error: string | null;
  success: boolean;
}

/**
 * Creates a new student for the current user's school.
 *
 * @actionType mutation
 * @rls schoolId from JWT claims; role check: coach, school_admin, or tilt_admin.
 */
export async function createStudentAction(
  _prevState: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const user = await requireRole("coach", "school_admin", "tilt_admin");
  const activeSchoolId = await getActiveSchoolId(user);

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const studentNumber = (formData.get("studentNumber") as string)?.trim();
  const gradeId = Number(formData.get("gradeId"));
  const enrollmentDate =
    (formData.get("enrollmentDate") as string) ||
    new Date().toISOString().split("T")[0];

  if (!firstName || !lastName || !studentNumber) {
    return {
      error: "First name, last name, and student ID are required.",
      success: false,
    };
  }

  if (!gradeId || isNaN(gradeId)) {
    return { error: "Please select a grade level.", success: false };
  }

  try {
    await dalCreateStudent({
      schoolId: activeSchoolId,
      firstName,
      lastName,
      studentNumber,
      gradeId,
      enrollmentDate,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create student.";
    if (message.includes("unique") || message.includes("duplicate")) {
      return {
        error: "A student with this ID already exists.",
        success: false,
      };
    }
    return { error: message, success: false };
  }

  revalidatePath("/dashboard/students");
  return { error: null, success: true };
}

/**
 * Updates an existing student's details.
 *
 * @actionType mutation
 * @rls schoolId from JWT claims; role check: coach, school_admin, or tilt_admin.
 */
export async function updateStudentAction(
  _prevState: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const user = await requireRole("coach", "school_admin", "tilt_admin");
  const activeSchoolId = await getActiveSchoolId(user);

  const studentId = Number(formData.get("studentId"));
  if (!studentId || isNaN(studentId)) {
    return { error: "Invalid student.", success: false };
  }

  const firstName = (formData.get("firstName") as string)?.trim() || undefined;
  const lastName = (formData.get("lastName") as string)?.trim() || undefined;
  const studentNumber =
    (formData.get("studentNumber") as string)?.trim() || undefined;
  const gradeId = formData.get("gradeId")
    ? Number(formData.get("gradeId"))
    : undefined;
  const enrollmentStatus =
    (formData.get("enrollmentStatus") as string) || undefined;
  const withdrawalDate =
    (formData.get("withdrawalDate") as string) || undefined;

  try {
    const result = await dalUpdateStudent(
      {
        studentId,
        firstName,
        lastName,
        studentNumber,
        gradeId,
        enrollmentStatus: enrollmentStatus as
          | "active"
          | "withdrawn"
          | "transferred"
          | "graduated"
          | undefined,
        withdrawalDate,
      },
      activeSchoolId,
    );

    if (!result) {
      return { error: "Student not found.", success: false };
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update student.";
    if (message.includes("unique") || message.includes("duplicate")) {
      return {
        error: "A student with this ID already exists.",
        success: false,
      };
    }
    return { error: message, success: false };
  }

  revalidatePath("/dashboard/students");
  return { error: null, success: true };
}
