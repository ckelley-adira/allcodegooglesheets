/**
 * @file dashboard/assessments/actions.ts — Server Actions for initial assessments
 *
 * Handles the multi-page assessment wizard submit. The wizard collects every
 * component result client-side, JSON-encodes the section payload, and sends
 * it here. We delegate scoring + persistence to the assessments DAL.
 *
 * @actionType mutation
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { submitAssessment, type SnapshotType } from "@/lib/dal/assessments";
import type { SubmittedSection } from "@/lib/assessment/scoring";
import { auditLog } from "@/lib/audit/log";

export interface AssessmentFormState {
  error: string | null;
  success: boolean;
  assessmentId?: number;
}

const VALID_SNAPSHOTS: SnapshotType[] = [
  "baseline",
  "semester_1_end",
  "semester_2_end",
];

/**
 * Submits a complete initial assessment wizard payload.
 *
 * Form fields:
 *   - studentId
 *   - yearId
 *   - snapshotType (baseline | semester_1_end | semester_2_end)
 *   - assessmentDate (YYYY-MM-DD)
 *   - isKindergartenEoy ('on' or absent)
 *   - notes
 *   - sections (JSON-encoded SubmittedSection[])
 *
 * @actionType mutation
 * @rls Validates the student belongs to the active school before submitting.
 */
export async function submitAssessmentAction(
  _prevState: AssessmentFormState,
  formData: FormData,
): Promise<AssessmentFormState> {
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);

  const studentId = Number(formData.get("studentId"));
  const yearId = Number(formData.get("yearId"));
  const snapshotType = String(formData.get("snapshotType") ?? "") as SnapshotType;
  const assessmentDate =
    (formData.get("assessmentDate") as string) ||
    new Date().toISOString().split("T")[0];
  const isKindergartenEoy = formData.get("isKindergartenEoy") === "on";
  const notes = (formData.get("notes") as string) || null;
  const sectionsJson = formData.get("sections") as string;

  if (!studentId || isNaN(studentId)) {
    return { error: "Please select a student.", success: false };
  }
  if (!yearId || isNaN(yearId)) {
    return { error: "Academic year is required.", success: false };
  }
  if (!VALID_SNAPSHOTS.includes(snapshotType)) {
    return { error: "Please select a snapshot type.", success: false };
  }
  if (!sectionsJson) {
    return { error: "No assessment data provided.", success: false };
  }

  let sections: SubmittedSection[];
  try {
    sections = JSON.parse(sectionsJson) as SubmittedSection[];
  } catch {
    return { error: "Invalid assessment payload.", success: false };
  }

  try {
    const result = await submitAssessment({
      studentId,
      schoolId: activeSchoolId,
      yearId,
      snapshotType,
      assessmentDate,
      scorerId: user.staffId,
      isKindergartenEoy,
      notes,
      sections,
    });

    await auditLog({
      schoolId: activeSchoolId,
      userId: user.staffId,
      action: "SUBMIT_INITIAL_ASSESSMENT",
      tableName: "initial_assessments",
      recordId: result.assessmentId,
      newValue: {
        studentId,
        yearId,
        snapshotType,
        assessmentDate,
        lessonsRecorded: result.lessonsRecorded,
        componentErrorsRecorded: result.componentErrorsRecorded,
        lessonProgressRowsSeeded: result.lessonProgressRowsSeeded,
        metrics: result.metrics,
      },
    });

    revalidatePath("/dashboard/assessments");
    revalidatePath(`/dashboard/students/${studentId}`);
    revalidatePath("/dashboard");
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to submit assessment.";
    return { error: message, success: false };
  }

  redirect(`/dashboard/students/${studentId}`);
}
