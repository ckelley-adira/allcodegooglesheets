/**
 * @file dashboard/ufli-map/page.tsx — UFLI MAP view (Server Component shell)
 *
 * The 128-lesson student×lesson progress grid. Students as rows, UFLI
 * lessons as columns, each cell colored Y (green) / N (red) / A (amber).
 * Columns grouped by the 16 skill sections.
 *
 * Filterable by group. Mirrors the "UFLI Map" tab from the GAS system.
 */

import { requireAuth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { getSchoolFeatureFlagsResolved } from "@/lib/dal/schools";
import { getUfliMapData } from "@/lib/dal/ufli-map";
import { listGroups, listAcademicYears } from "@/lib/dal/groups";
import { UfliMapGrid } from "./ufli-map-grid";
import { FeatureDisabled } from "@/components/feature-disabled";

interface UfliMapPageProps {
  searchParams: Promise<{ groupId?: string }>;
}

export default async function UfliMapPage({ searchParams }: UfliMapPageProps) {
  const { groupId: groupIdParam } = await searchParams;
  const user = await requireAuth();
  const activeSchoolId = await getActiveSchoolId(user);

  // Feature flag gate: UFLI Map requires the ufli_progress_tracking flag
  const flags = await getSchoolFeatureFlagsResolved(activeSchoolId);
  if (!flags.ufli_progress_tracking) {
    return (
      <FeatureDisabled
        title="UFLI Map"
        flagLabel="UFLI Progress Tracking"
        description="The UFLI Map requires UFLI Progress Tracking to be enabled for this school."
      />
    );
  }

  const [groups, years] = await Promise.all([
    listGroups(activeSchoolId),
    listAcademicYears(activeSchoolId),
  ]);

  const currentYear = years.find((y) => y.isCurrent);
  const yearId = currentYear?.yearId ?? 0;
  const groupId = groupIdParam ? Number(groupIdParam) : undefined;

  const mapData = await getUfliMapData(activeSchoolId, yearId, groupId);

  const activeGroups = groups.filter((g) => g.isActive);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">UFLI Map</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {mapData.students.length} student{mapData.students.length !== 1 ? "s" : ""}
          {" "}&middot; 128 lessons &middot; {currentYear?.label ?? "No year"}
        </p>
      </div>

      <UfliMapGrid
        lessons={mapData.lessons}
        students={mapData.students}
        skillSections={mapData.skillSections}
        groups={activeGroups.map((g) => ({
          groupId: g.groupId,
          groupName: g.groupName,
        }))}
        selectedGroupId={groupId}
        canEdit={user.role === "school_admin" || user.isTiltAdmin}
        yearId={yearId}
      />
    </div>
  );
}
