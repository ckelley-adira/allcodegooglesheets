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
 * Converts a grade name like "KG", "K", "1", "2", "G3" to the numeric grade
 * level (0=KG, 1-8).
 *
 * Returns 0 for unrecognized values so KG-only sections still render rather
 * than crashing.
 *
 * BUG FIX (2026-04): the previous implementation did
 *   parseInt(gradeName.toUpperCase().replace(/[^0-9KG]/g, ""), 10)
 * which returned NaN for "G1".."G8" because parseInt("G3") bails on the
 * non-digit first character. Every G1-G8 student was silently downgraded
 * to grade 0 and rendered as a KG student, so the assessment wizard only
 * showed KG-eligible sections (alphabet + blends, plus digraphs + VCE if
 * KG-EOY). That's the "only Alphabet and Digraphs" symptom. Fix: strip
 * the leading G prefix before parseInt.
 */
function parseGradeNumber(gradeName: string): number {
  const upper = gradeName.toUpperCase().trim();
  if (upper === "K" || upper === "KG") return 0;
  // Strip optional leading "G" prefix, then any remaining non-digits
  const digitsOnly = upper.replace(/^G/, "").replace(/[^0-9]/g, "");
  const n = parseInt(digitsOnly, 10);
  return isNaN(n) ? 0 : n;
}
