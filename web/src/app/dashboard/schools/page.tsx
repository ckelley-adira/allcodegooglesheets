/**
 * @file dashboard/schools/page.tsx — Schools list page (TILT Admin only)
 *
 * Lists all schools in the platform with student/staff counts and a
 * "Create School" form. This is the centralized school management
 * surface for the MVP (per D-007, self-service onboarding comes later).
 */

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listSchools } from "@/lib/dal/schools";
import { Badge } from "@/components/ui/badge";
import { CreateSchoolForm } from "./create-form";

export default async function SchoolsPage() {
  await requireRole("tilt_admin");
  const schools = await listSchools();

  const activeCount = schools.filter((s) => s.isActive).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Schools</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {activeCount} active school{activeCount !== 1 ? "s" : ""} &middot;{" "}
          {schools.length} total
        </p>
      </div>

      <CreateSchoolForm />

      {/* Schools grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {schools.length === 0 ? (
          <p className="col-span-full py-8 text-center text-sm text-zinc-400">
            No schools yet. Create one above.
          </p>
        ) : (
          schools.map((school) => (
            <Link
              key={school.schoolId}
              href={`/dashboard/schools/${school.schoolId}`}
              className="group rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold group-hover:underline">
                    {school.name}
                  </h3>
                  <p className="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {school.shortCode}
                  </p>
                </div>
                {!school.isActive && <Badge variant="default">Inactive</Badge>}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Students
                  </p>
                  <p className="font-semibold">{school.studentCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Staff
                  </p>
                  <p className="font-semibold">{school.staffCount}</p>
                </div>
              </div>

              {(school.city || school.state) && (
                <p className="mt-3 text-xs text-zinc-400">
                  {school.city}
                  {school.city && school.state ? ", " : ""}
                  {school.state}
                </p>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
