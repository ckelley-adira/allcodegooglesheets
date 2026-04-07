/**
 * @file dal/network-rollup.ts — Cross-school network rollup
 *
 * TILT Admin view: gathers Big Four metrics + activity health for
 * every school in the network so the user can see all partner sites
 * side-by-side. Identifies schools that are at risk on each metric
 * and schools that have gone dark (no recent activity).
 *
 * @rls TILT Admin only — RLS lets the JWT bypass school filters.
 */

import { createClient } from "@/lib/supabase/server";
import { getBigFourMetrics, type BigFourMetrics } from "./metrics";
import { getSchoolPacingSummary } from "./school-pacing";

export interface NetworkSchoolRow {
  schoolId: number;
  name: string;
  shortCode: string;
  isActive: boolean;
  /** Total active students */
  studentCount: number;
  /** Total active staff */
  staffCount: number;
  /** Total active groups */
  groupCount: number;
  /** Coverage % from school-pacing (last 7 days) */
  coveragePct: number | null;
  /** Number of stale or never-logged groups */
  attentionGroupCount: number;
  /** Big Four metrics (null if no current academic year) */
  metrics: BigFourMetrics | null;
  /** Current academic year label, if any */
  currentYearLabel: string | null;
}

export interface NetworkRollup {
  schools: NetworkSchoolRow[];
  /** Network-wide totals */
  totalStudents: number;
  totalStaff: number;
  totalGroups: number;
  totalSchools: number;
  activeSchools: number;
}

export async function getNetworkRollup(): Promise<NetworkRollup> {
  const supabase = await createClient();

  // 1. All schools
  const { data: schoolsRaw } = await supabase
    .from("schools")
    .select("school_id, name, short_code, is_active")
    .order("name", { ascending: true });

  if (!schoolsRaw || schoolsRaw.length === 0) {
    return {
      schools: [],
      totalStudents: 0,
      totalStaff: 0,
      totalGroups: 0,
      totalSchools: 0,
      activeSchools: 0,
    };
  }

  const schoolIds = (schoolsRaw as { school_id: number }[]).map(
    (s) => s.school_id,
  );

  // 2. Per-school counts in one query each (cheap, RLS-bypassed for TILT)
  const [studentCounts, staffCounts, groupCounts, currentYears] =
    await Promise.all([
      supabase
        .from("students")
        .select("school_id")
        .eq("enrollment_status", "active")
        .in("school_id", schoolIds),
      supabase
        .from("staff")
        .select("school_id")
        .eq("is_active", true)
        .in("school_id", schoolIds),
      supabase
        .from("instructional_groups")
        .select("school_id")
        .eq("is_active", true)
        .in("school_id", schoolIds),
      supabase
        .from("academic_years")
        .select("school_id, year_id, label")
        .eq("is_current", true)
        .in("school_id", schoolIds),
    ]);

  const studentCountMap = countBySchool(studentCounts.data ?? []);
  const staffCountMap = countBySchool(staffCounts.data ?? []);
  const groupCountMap = countBySchool(groupCounts.data ?? []);
  const yearMap = new Map<number, { yearId: number; label: string }>();
  for (const y of currentYears.data ?? []) {
    const row = y as { school_id: number; year_id: number; label: string };
    yearMap.set(row.school_id, { yearId: row.year_id, label: row.label });
  }

  // 3. Per-school Big Four + pacing (parallel across schools)
  const perSchoolPromises = (
    schoolsRaw as {
      school_id: number;
      name: string;
      short_code: string;
      is_active: boolean;
    }[]
  ).map(async (school) => {
    const year = yearMap.get(school.school_id);
    const metricsPromise = year
      ? getBigFourMetrics(school.school_id, year.yearId)
      : Promise.resolve<BigFourMetrics | null>(null);
    const pacingPromise = getSchoolPacingSummary(school.school_id);

    const [metrics, pacing] = await Promise.all([metricsPromise, pacingPromise]);

    const attentionCount = pacing.groups.filter(
      (g) =>
        g.isActive &&
        (g.health === "stale_1w" ||
          g.health === "stale_2w" ||
          g.health === "never_logged"),
    ).length;

    return {
      schoolId: school.school_id,
      name: school.name,
      shortCode: school.short_code,
      isActive: school.is_active,
      studentCount: studentCountMap.get(school.school_id) ?? 0,
      staffCount: staffCountMap.get(school.school_id) ?? 0,
      groupCount: groupCountMap.get(school.school_id) ?? 0,
      coveragePct: pacing.coveragePct,
      attentionGroupCount: attentionCount,
      metrics,
      currentYearLabel: year?.label ?? null,
    } satisfies NetworkSchoolRow;
  });

  const schools = await Promise.all(perSchoolPromises);

  // 4. Network totals
  let totalStudents = 0;
  let totalStaff = 0;
  let totalGroups = 0;
  let activeSchools = 0;
  for (const s of schools) {
    totalStudents += s.studentCount;
    totalStaff += s.staffCount;
    totalGroups += s.groupCount;
    if (s.isActive) activeSchools++;
  }

  return {
    schools,
    totalStudents,
    totalStaff,
    totalGroups,
    totalSchools: schools.length,
    activeSchools,
  };
}

function countBySchool(rows: { school_id: number }[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(r.school_id, (map.get(r.school_id) ?? 0) + 1);
  }
  return map;
}
