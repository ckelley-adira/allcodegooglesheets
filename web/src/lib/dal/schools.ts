/**
 * @file dal/schools.ts — Data access layer for school configuration
 *
 * TILT-Admin-only operations: school CRUD, academic year management,
 * and per-school feature flag persistence.
 *
 * @rls All operations enforced by RLS — only TILT Admin (is_tilt_admin
 *   claim in JWT) can read or write across schools (D-002).
 */

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { FEATURE_FLAGS, FEATURE_FLAGS_BY_KEY } from "@/config/features";

// ── Types ────────────────────────────────────────────────────────────────

export interface SchoolRow {
  schoolId: number;
  name: string;
  shortCode: string;
  address: string | null;
  city: string | null;
  state: string | null;
  cadenceDays: string[]; // e.g. ["TUE","THU"]
  isActive: boolean;
  createdAt: Date;
  studentCount: number;
  staffCount: number;
}

export interface CreateSchoolInput {
  name: string;
  shortCode: string;
  address?: string;
  city?: string;
  state?: string;
  cadenceDays?: string[];
}

export interface UpdateSchoolInput {
  schoolId: number;
  name?: string;
  shortCode?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  cadenceDays?: string[];
  isActive?: boolean;
}

import { CADENCE_DAY_CODES } from "@/config/cadence";
export { CADENCE_DAY_CODES, type CadenceDayCode } from "@/config/cadence";

/** Parses a "TUE,THU" string into an array, stripping invalid values */
export function parseCadenceDays(value: string | null | undefined): string[] {
  if (!value) return [];
  const validSet = new Set(CADENCE_DAY_CODES as readonly string[]);
  return value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => validSet.has(s));
}

/** Serializes a cadence-days array back to the "TUE,THU" storage format */
export function serializeCadenceDays(days: string[]): string {
  const validSet = new Set<string>(CADENCE_DAY_CODES);
  const order = new Map<string, number>(
    CADENCE_DAY_CODES.map((d, i) => [d as string, i]),
  );
  const filtered = days
    .map((d) => d.trim().toUpperCase())
    .filter((d) => validSet.has(d));
  filtered.sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
  return filtered.join(",");
}

export interface AcademicYearRow {
  yearId: number;
  schoolId: number;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface CreateAcademicYearInput {
  schoolId: number;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}

interface RawSchoolRow {
  school_id: number;
  name: string;
  short_code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  cadence_days: string | null;
  is_active: boolean;
  created_at: string;
}

const SCHOOL_COLUMNS =
  "school_id, name, short_code, address, city, state, cadence_days, is_active, created_at";

/** Maps a raw schools row to the SchoolRow shape (without counts) */
function rawToSchoolBase(r: RawSchoolRow): Omit<SchoolRow, "studentCount" | "staffCount"> {
  return {
    schoolId: r.school_id,
    name: r.name,
    shortCode: r.short_code,
    address: r.address,
    city: r.city,
    state: r.state,
    cadenceDays: parseCadenceDays(r.cadence_days),
    isActive: r.is_active,
    createdAt: new Date(r.created_at),
  };
}

// ── Schools ──────────────────────────────────────────────────────────────

/**
 * Lightweight list of schools for the school switcher in the top bar.
 * Returns only the fields needed to render the dropdown.
 *
 * @rls TILT Admin sees all schools; others see only their own school
 *   (RLS handles the filtering automatically).
 */
export async function listSwitchableSchools(): Promise<
  { schoolId: number; name: string; shortCode: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schools")
    .select("school_id, name, short_code")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    schoolId: r.school_id,
    name: r.name,
    shortCode: r.short_code,
  }));
}


/**
 * Lists all schools (TILT Admin view) with student and staff counts.
 *
 * @rls Requires is_tilt_admin claim. Non-admins get an empty list.
 */
export async function listSchools(): Promise<SchoolRow[]> {
  const supabase = await createClient();
  const { data: schools, error } = await supabase
    .from("schools")
    .select(SCHOOL_COLUMNS)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  if (!schools || schools.length === 0) return [];

  // Get student counts per school (paginated — 50+ schools × 500 students = 25K+)
  const studentCounts = await fetchAllRows<{ school_id: number }>(
    (from, to) =>
      supabase
        .from("students")
        .select("school_id")
        .eq("enrollment_status", "active")
        .range(from, to),
  );

  const studentCountMap = new Map<number, number>();
  studentCounts.forEach((s) => {
    studentCountMap.set(s.school_id, (studentCountMap.get(s.school_id) ?? 0) + 1);
  });

  // Get staff counts per school (paginated for consistency)
  const staffCounts = await fetchAllRows<{ school_id: number }>(
    (from, to) =>
      supabase
        .from("staff")
        .select("school_id")
        .eq("is_active", true)
        .range(from, to),
  );

  const staffCountMap = new Map<number, number>();
  staffCounts.forEach((s) => {
    staffCountMap.set(s.school_id, (staffCountMap.get(s.school_id) ?? 0) + 1);
  });

  return schools.map((s) => {
    const r = s as unknown as RawSchoolRow;
    return {
      ...rawToSchoolBase(r),
      studentCount: studentCountMap.get(r.school_id) ?? 0,
      staffCount: staffCountMap.get(r.school_id) ?? 0,
    };
  });
}

/**
 * Gets a single school by ID.
 *
 * @rls TILT Admin only (or the school's own members can view their school).
 */
export async function getSchool(schoolId: number): Promise<SchoolRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schools")
    .select(SCHOOL_COLUMNS)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { count: studentCount } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("enrollment_status", "active");

  const { count: staffCount } = await supabase
    .from("staff")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("is_active", true);

  return {
    ...rawToSchoolBase(data as unknown as RawSchoolRow),
    studentCount: studentCount ?? 0,
    staffCount: staffCount ?? 0,
  };
}

/**
 * Creates a new school.
 *
 * @rls TILT Admin only.
 */
export async function createSchool(
  input: CreateSchoolInput,
): Promise<number> {
  const supabase = await createClient();
  const insert: Record<string, unknown> = {
    name: input.name,
    short_code: input.shortCode.toUpperCase(),
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ? input.state.toUpperCase() : null,
  };
  if (input.cadenceDays !== undefined) {
    insert.cadence_days = serializeCadenceDays(input.cadenceDays);
  }

  const { data, error } = await supabase
    .from("schools")
    .insert(insert)
    .select("school_id")
    .single();

  if (error) throw new Error(error.message);
  return data.school_id;
}

/**
 * Updates a school's identity fields.
 *
 * @rls TILT Admin only.
 */
export async function updateSchool(
  input: UpdateSchoolInput,
): Promise<boolean> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.shortCode !== undefined) updates.short_code = input.shortCode.toUpperCase();
  if (input.address !== undefined) updates.address = input.address;
  if (input.city !== undefined) updates.city = input.city;
  if (input.state !== undefined) updates.state = input.state ? input.state.toUpperCase() : null;
  if (input.cadenceDays !== undefined)
    updates.cadence_days = serializeCadenceDays(input.cadenceDays);
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  if (Object.keys(updates).length === 0) return false;

  const { data, error } = await supabase
    .from("schools")
    .update(updates)
    .eq("school_id", input.schoolId)
    .select("school_id");

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

// ── Academic Years ───────────────────────────────────────────────────────

/**
 * Lists academic years for a school, ordered by start date descending.
 */
export async function listSchoolAcademicYears(
  schoolId: number,
): Promise<AcademicYearRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_years")
    .select("year_id, school_id, label, start_date, end_date, is_current")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    yearId: r.year_id,
    schoolId: r.school_id,
    label: r.label,
    startDate: r.start_date,
    endDate: r.end_date,
    isCurrent: r.is_current,
  }));
}

/**
 * Creates a new academic year for a school. If isCurrent is true,
 * unsets is_current on all other years for the school first.
 */
export async function createAcademicYear(
  input: CreateAcademicYearInput,
): Promise<number> {
  const supabase = await createClient();

  if (input.isCurrent) {
    // Unset is_current on all other years for this school
    const { error: unsetError } = await supabase
      .from("academic_years")
      .update({ is_current: false })
      .eq("school_id", input.schoolId);
    if (unsetError) throw new Error(unsetError.message);
  }

  const { data, error } = await supabase
    .from("academic_years")
    .insert({
      school_id: input.schoolId,
      label: input.label,
      start_date: input.startDate,
      end_date: input.endDate,
      is_current: input.isCurrent ?? false,
    })
    .select("year_id")
    .single();

  if (error) throw new Error(error.message);
  return data.year_id;
}

/**
 * Sets a specific academic year as the current one (unsets all others
 * for the same school in the same operation).
 *
 * Per D-002: Validates that yearId belongs to schoolId before updating
 * to prevent cross-school data corruption.
 */
export async function setCurrentAcademicYear(
  yearId: number,
  schoolId: number,
): Promise<void> {
  const supabase = await createClient();

  // Verify that the year belongs to the school
  const { data: yearCheck, error: checkError } = await supabase
    .from("academic_years")
    .select("year_id")
    .eq("year_id", yearId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (checkError) throw new Error(checkError.message);
  if (!yearCheck) {
    throw new Error("Academic year does not belong to this school");
  }

  const { error: unsetError } = await supabase
    .from("academic_years")
    .update({ is_current: false })
    .eq("school_id", schoolId);
  if (unsetError) throw new Error(unsetError.message);

  const { error: setError } = await supabase
    .from("academic_years")
    .update({ is_current: true })
    .eq("year_id", yearId)
    .eq("school_id", schoolId);
  if (setError) throw new Error(setError.message);
}

// ── Feature Flags ────────────────────────────────────────────────────────

/**
 * Returns the stored feature flag values for a school as a key→boolean map.
 * Flags not in the map should fall back to the catalog default
 * (use isFeatureEnabled() from config/features.ts).
 */
export async function getSchoolFeatureFlags(
  schoolId: number,
): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_settings")
    .select("feature_key, feature_value")
    .eq("school_id", schoolId);

  if (error) throw new Error(error.message);

  const result: Record<string, boolean> = {};
  for (const row of data ?? []) {
    // Only include keys that exist in the catalog
    if (row.feature_key in FEATURE_FLAGS_BY_KEY) {
      result[row.feature_key] = row.feature_value === "true";
    }
  }
  return result;
}

/**
 * Returns the resolved (defaults applied) feature flag values for a school.
 * Use this when reading flags to drive runtime behavior.
 */
export async function getSchoolFeatureFlagsResolved(
  schoolId: number,
): Promise<Record<string, boolean>> {
  const stored = await getSchoolFeatureFlags(schoolId);
  const resolved: Record<string, boolean> = {};
  for (const flag of FEATURE_FLAGS) {
    resolved[flag.key] =
      flag.key in stored ? stored[flag.key] : flag.defaultValue;
  }
  return resolved;
}

/**
 * Sets a single feature flag value for a school. Upserts by (school_id, feature_key).
 */
export async function setSchoolFeatureFlag(
  schoolId: number,
  key: string,
  value: boolean,
): Promise<void> {
  if (!(key in FEATURE_FLAGS_BY_KEY)) {
    throw new Error(`Unknown feature flag: ${key}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("feature_settings").upsert(
    {
      school_id: schoolId,
      feature_key: key,
      feature_value: value ? "true" : "false",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "school_id,feature_key" },
  );

  if (error) throw new Error(error.message);
}

/**
 * Bulk-sets multiple feature flags for a school in one operation.
 */
export async function setSchoolFeatureFlags(
  schoolId: number,
  values: Record<string, boolean>,
): Promise<void> {
  const rows = Object.entries(values)
    .filter(([key]) => key in FEATURE_FLAGS_BY_KEY)
    .map(([key, value]) => ({
      school_id: schoolId,
      feature_key: key,
      feature_value: value ? "true" : "false",
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("feature_settings")
    .upsert(rows, { onConflict: "school_id,feature_key" });

  if (error) throw new Error(error.message);
}
