/**
 * @file dashboard/assessments/new/page.tsx — Initial assessment wizard entry
 *
 * Server Component that loads the active school's students + current
 * academic year, then hands off to the client-side AssessmentWizard for
 * the multi-page form. Section data is imported directly into the client
 * because it lives as a TS constant — no DB roundtrip needed.
 */

import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listStudents } from "@/lib/dal/students";
import { listAcademicYears } from "@/lib/dal/groups";
import { AssessmentWizard, type WizardStudent } from "./wizard";

export const metadata = {
  title: "New Initial Assessment · Adira Reads",
};

export default async function NewAssessmentPage() {
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);

  const [students, years] = await Promise.all([
    listStudents(activeSchoolId),
    listAcademicYears(activeSchoolId),
  ]);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">New Assessment</h1>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No active academic year for this school.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Set a current academic year on the school detail page first.
          </p>
        </div>
      </div>
    );
  }

  const wizardStudents: WizardStudent[] = students
    .filter((s) => s.enrollmentStatus === "active")
    .map((s) => ({
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      gradeName: s.gradeName,
      grade: parseGradeNumber(s.gradeName),
    }));

  return (
    <AssessmentWizard
      students={wizardStudents}
      yearId={currentYear.yearId}
      yearLabel={currentYear.label}
    />
  );
}

/**
 * Parses a grade name like "KG", "K", "1", "2", "G3" to numeric grade level.
 *
 * **Returns:** 0 (KG), 1-8 (G1-G8 standard grades), or 0 (fallback for invalid).
 *
 * **Critical Bug Fixed (2026-04):** The previous implementation did
 *   parseInt(gradeName.toUpperCase().replace(/[^0-9KG]/g, ""), 10)
 * which returned NaN for "G1".."G8" because parseInt("G3") fails when the
 * first character isn't a digit. Every G1-G8 student was silently downgraded
 * to grade 0 (KG), so the assessment wizard only showed KG-eligible sections:
 * alphabet_consonants, blends, and optionally digraphs/VCE if KG-EOY.
 *
 * This silently broke G1-G2 simplification entirely — students never saw
 * simplified sections because the wizard thought they were KG.
 *
 * **Fix:** Strip the leading "G" prefix before parsing digits. Now:
 *   "K" or "KG" → 0
 *   "G1" → 1, "G2" → 2, ..., "G8" → 8
 *   "1", "2" → same (students in databases may use either format)
 *   "X" or blank → 0 (fallback; KG-only sections still render)
 *
 * @param gradeName Student's grade from database (e.g., "G2", "KG", "2")
 * @returns Numeric grade: 0 (KG) or 1-8 (standard grades)
 */
function parseGradeNumber(gradeName: string): number {
  const upper = gradeName.toUpperCase().trim();
  if (upper === "K" || upper === "KG") return 0;
  // Strip optional leading "G" prefix, then any remaining non-digits
  const digitsOnly = upper.replace(/^G/, "").replace(/[^0-9]/g, "");
  const n = parseInt(digitsOnly, 10);
  return isNaN(n) ? 0 : n;
}
