/**
 * @file dashboard/schools/[schoolId]/page.tsx — School detail page
 *
 * The configuration surface for a single school. Three sections:
 * 1. School identity (name, code, address, active status)
 * 2. Academic years (list, create, set current)
 * 3. Feature flags (per-school module toggles, grouped by category)
 *
 * @rls TILT Admin only.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  getSchool,
  listSchoolAcademicYears,
  getSchoolFeatureFlags,
} from "@/lib/dal/schools";
import { Badge } from "@/components/ui/badge";
import { EditSchoolForm } from "./edit-school-form";
import { AcademicYearsPanel } from "./academic-years-panel";
import { FeatureFlagsForm } from "./feature-flags-form";

interface SchoolDetailPageProps {
  params: Promise<{ schoolId: string }>;
}

export default async function SchoolDetailPage({
  params,
}: SchoolDetailPageProps) {
  await requireRole("tilt_admin");

  const { schoolId: schoolIdParam } = await params;
  const schoolId = Number(schoolIdParam);
  if (!Number.isInteger(schoolId) || schoolId <= 0) notFound();

  const school = await getSchool(schoolId);
  if (!school) notFound();

  const [years, flagValues] = await Promise.all([
    listSchoolAcademicYears(schoolId),
    getSchoolFeatureFlags(schoolId),
  ]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/dashboard/schools"
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Schools
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100">{school.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{school.name}</h1>
          <p className="mt-0.5 font-mono text-sm text-zinc-500 dark:text-zinc-400">
            {school.shortCode}
          </p>
          <div className="mt-2">
            <Badge variant={school.isActive ? "success" : "default"}>
              {school.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-4 text-right text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Students
            </p>
            <p className="text-xl font-semibold">{school.studentCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Staff
            </p>
            <p className="text-xl font-semibold">{school.staffCount}</p>
          </div>
        </div>
      </div>

      {/* Section 1: School identity */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          School Identity
        </h2>
        <EditSchoolForm school={school} />
      </section>

      {/* Section 2: Academic years */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Academic Years
        </h2>
        <AcademicYearsPanel schoolId={schoolId} years={years} />
      </section>

      {/* Section 3: Feature flags */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Feature Flags
        </h2>
        <FeatureFlagsForm schoolId={schoolId} storedValues={flagValues} />
      </section>
    </div>
  );
}
