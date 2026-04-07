/**
 * @file dal/groups.ts — Data access layer for instructional groups
 *
 * Uses the Supabase JS client (PostgREST over HTTPS) for serverless reliability.
 *
 * @rls School-scoping enforced by RLS policies via the user's JWT.
 */

import { createClient } from "@/lib/supabase/server";

// ── Group types ──────────────────────────────────────────────────────────

export interface GroupRow {
  groupId: number;
  groupName: string;
  /** Primary grade label (for single-grade groups, the only grade; for mixed-grade, the lowest grade) */
  gradeName: string;
  /** Primary grade ID */
  gradeId: number;
  /** All grade IDs associated with the group (includes primary) */
  gradeIds: number[];
  /** All grade names, sorted by sort_order (e.g. ["KG", "G1"]) */
  gradeNames: string[];
  yearLabel: string;
  yearId: number;
  staffName: string;
  staffId: number;
  isMixedGrade: boolean;
  isActive: boolean;
  memberCount: number;
}

export interface CreateGroupInput {
  schoolId: number;
  /** Primary grade ID (the first/lowest grade for mixed-grade groups) */
  gradeId: number;
  /** All grade IDs for the group (must include primary). For single-grade groups, length is 1. */
  gradeIds: number[];
  yearId: number;
  staffId: number;
  groupName: string;
  isMixedGrade?: boolean;
}

export interface UpdateGroupInput {
  groupId: number;
  groupName?: string;
  /** Primary grade ID */
  gradeId?: number;
  /** All grade IDs (must include primary if provided). When set, replaces all existing grades. */
  gradeIds?: number[];
  staffId?: number;
  isMixedGrade?: boolean;
  isActive?: boolean;
}

export interface MembershipRow {
  membershipId: number;
  studentId: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  gradeId: number;
  gradeName: string;
  gradeSortOrder: number;
  joinedDate: string;
  isActive: boolean;
}

interface RawGroupRow {
  group_id: number;
  group_name: string;
  grade_id: number;
  year_id: number;
  staff_id: number;
  is_mixed_grade: boolean;
  is_active: boolean;
  grade_levels: { name: string; sort_order: number } | null;
  academic_years: { label: string } | null;
  staff: { first_name: string; last_name: string } | null;
}

function mapGroupRow(
  r: RawGroupRow,
  memberCount: number,
  gradeIds: number[],
  gradeNames: string[],
): GroupRow {
  return {
    groupId: r.group_id,
    groupName: r.group_name,
    gradeName: r.grade_levels?.name ?? "",
    gradeId: r.grade_id,
    gradeIds,
    gradeNames,
    yearLabel: r.academic_years?.label ?? "",
    yearId: r.year_id,
    staffName: `${r.staff?.first_name ?? ""} ${r.staff?.last_name ?? ""}`.trim(),
    staffId: r.staff_id,
    isMixedGrade: r.is_mixed_grade,
    isActive: r.is_active,
    memberCount,
  };
}

/**
 * Fetches the full set of (group_id → gradeIds, gradeNames) for a list of
 * groups via the instructional_group_grades junction table. Grade names are
 * ordered by the grade_levels.sort_order.
 */
async function fetchGroupGrades(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupIds: number[],
): Promise<Map<number, { gradeIds: number[]; gradeNames: string[] }>> {
  if (groupIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("instructional_group_grades")
    .select("group_id, grade_id, grade_levels(name, sort_order)")
    .in("group_id", groupIds);

  if (error) throw new Error(error.message);

  // Build a map of group_id -> sorted grades
  const rawMap = new Map<
    number,
    { gradeId: number; name: string; sortOrder: number }[]
  >();
  for (const row of data ?? []) {
    const raw = row as unknown as {
      group_id: number;
      grade_id: number;
      grade_levels: { name: string; sort_order: number } | null;
    };
    if (!rawMap.has(raw.group_id)) rawMap.set(raw.group_id, []);
    rawMap.get(raw.group_id)!.push({
      gradeId: raw.grade_id,
      name: raw.grade_levels?.name ?? "",
      sortOrder: raw.grade_levels?.sort_order ?? 0,
    });
  }

  const result = new Map<number, { gradeIds: number[]; gradeNames: string[] }>();
  for (const [groupId, grades] of rawMap) {
    grades.sort((a, b) => a.sortOrder - b.sortOrder);
    result.set(groupId, {
      gradeIds: grades.map((g) => g.gradeId),
      gradeNames: grades.map((g) => g.name),
    });
  }
  return result;
}

// Disambiguate the grade_levels embed — there are now two FKs between
// instructional_groups and grade_levels (direct via grade_id, and
// indirect via instructional_group_grades). !grade_id tells PostgREST
// to follow the direct grade_id column on instructional_groups.
const GROUP_COLUMNS =
  "group_id, group_name, grade_id, year_id, staff_id, is_mixed_grade, is_active, grade_levels!grade_id(name, sort_order), academic_years(label), staff(first_name, last_name)";

// ── Group queries ────────────────────────────────────────────────────────

/**
 * Lists all groups for the given school with member counts.
 *
 * @rls Filters by school_id explicitly.
 */
export async function listGroups(schoolId: number): Promise<GroupRow[]> {
  const supabase = await createClient();

  const { data: groups, error: groupsError } = await supabase
    .from("instructional_groups")
    .select(GROUP_COLUMNS)
    .eq("school_id", schoolId);

  if (groupsError) throw new Error(groupsError.message);
  if (!groups || groups.length === 0) return [];

  const groupIds = (groups as unknown as RawGroupRow[]).map((g) => g.group_id);

  // Get member counts for each group
  const { data: memberships, error: memError } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("is_active", true)
    .in("group_id", groupIds);

  if (memError) throw new Error(memError.message);

  const countMap = new Map<number, number>();
  (memberships ?? []).forEach((m: { group_id: number }) => {
    countMap.set(m.group_id, (countMap.get(m.group_id) ?? 0) + 1);
  });

  // Get the full grade list for every group via the junction table
  const gradeMap = await fetchGroupGrades(supabase, groupIds);

  const rows = (groups as unknown as RawGroupRow[]).map((g) => {
    const grades = gradeMap.get(g.group_id) ?? {
      gradeIds: g.grade_id ? [g.grade_id] : [],
      gradeNames: g.grade_levels?.name ? [g.grade_levels.name] : [],
    };
    return mapGroupRow(
      g,
      countMap.get(g.group_id) ?? 0,
      grades.gradeIds,
      grades.gradeNames,
    );
  });

  // Sort by grade sort_order, then group_name
  rows.sort((a, b) => {
    const ag = (groups as unknown as RawGroupRow[]).find(
      (x) => x.group_id === a.groupId,
    );
    const bg = (groups as unknown as RawGroupRow[]).find(
      (x) => x.group_id === b.groupId,
    );
    const aOrder = ag?.grade_levels?.sort_order ?? 0;
    const bOrder = bg?.grade_levels?.sort_order ?? 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.groupName.localeCompare(b.groupName);
  });

  return rows;
}

/**
 * Gets a single group by ID with member count.
 *
 * @rls School-scoped via RLS policy.
 */
export async function getGroup(
  groupId: number,
  schoolId: number,
): Promise<GroupRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("instructional_groups")
    .select(GROUP_COLUMNS)
    .eq("group_id", groupId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { count } = await supabase
    .from("group_memberships")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("is_active", true);

  const raw = data as unknown as RawGroupRow;
  const gradeMap = await fetchGroupGrades(supabase, [raw.group_id]);
  const grades = gradeMap.get(raw.group_id) ?? {
    gradeIds: raw.grade_id ? [raw.grade_id] : [],
    gradeNames: raw.grade_levels?.name ? [raw.grade_levels.name] : [],
  };

  return mapGroupRow(raw, count ?? 0, grades.gradeIds, grades.gradeNames);
}

/**
 * Creates a new instructional group. Also writes the junction table rows
 * for every grade in gradeIds (including the primary).
 *
 * @rls School-scoped via RLS policy.
 */
export async function createGroup(input: CreateGroupInput): Promise<number> {
  const supabase = await createClient();

  // Normalize: ensure the primary grade is in gradeIds, deduplicate
  const allGradeIds = Array.from(new Set([input.gradeId, ...input.gradeIds]));

  const { data, error } = await supabase
    .from("instructional_groups")
    .insert({
      school_id: input.schoolId,
      grade_id: input.gradeId,
      year_id: input.yearId,
      staff_id: input.staffId,
      group_name: input.groupName,
      is_mixed_grade: input.isMixedGrade ?? false,
    })
    .select("group_id")
    .single();

  if (error) throw new Error(error.message);
  const groupId = data.group_id;

  // Write junction rows for every grade
  const { error: junctionError } = await supabase
    .from("instructional_group_grades")
    .insert(allGradeIds.map((gradeId) => ({ group_id: groupId, grade_id: gradeId })));

  if (junctionError) throw new Error(junctionError.message);

  return groupId;
}

/**
 * Updates a group.
 *
 * @rls School-scoped via RLS policy.
 */
export async function updateGroup(
  input: UpdateGroupInput,
  schoolId: number,
): Promise<boolean> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = {};
  if (input.groupName !== undefined) updates.group_name = input.groupName;
  if (input.gradeId !== undefined) updates.grade_id = input.gradeId;
  if (input.staffId !== undefined) updates.staff_id = input.staffId;
  if (input.isMixedGrade !== undefined) updates.is_mixed_grade = input.isMixedGrade;
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  // If nothing to update on the main row and no grade changes, bail
  if (Object.keys(updates).length === 0 && input.gradeIds === undefined) {
    return false;
  }

  // Update the main row if we have field changes
  if (Object.keys(updates).length > 0) {
    const { error, data } = await supabase
      .from("instructional_groups")
      .update(updates)
      .eq("group_id", input.groupId)
      .eq("school_id", schoolId)
      .select("group_id");

    if (error) throw new Error(error.message);
    if ((data?.length ?? 0) === 0) return false;
  }

  // Replace the junction rows if gradeIds were provided
  if (input.gradeIds !== undefined) {
    // Normalize: if the primary grade was also updated, include it; otherwise
    // include the existing primary grade in the new set
    const primaryGradeId =
      input.gradeId ??
      (
        await supabase
          .from("instructional_groups")
          .select("grade_id")
          .eq("group_id", input.groupId)
          .single()
      ).data?.grade_id;

    const allGradeIds = Array.from(
      new Set([primaryGradeId, ...input.gradeIds].filter((id): id is number => !!id)),
    );

    // Delete existing junction rows and insert the new set
    const { error: delError } = await supabase
      .from("instructional_group_grades")
      .delete()
      .eq("group_id", input.groupId);
    if (delError) throw new Error(delError.message);

    if (allGradeIds.length > 0) {
      const { error: insError } = await supabase
        .from("instructional_group_grades")
        .insert(
          allGradeIds.map((gradeId) => ({
            group_id: input.groupId,
            grade_id: gradeId,
          })),
        );
      if (insError) throw new Error(insError.message);
    }
  }

  return true;
}

// ── Membership queries ───────────────────────────────────────────────────

interface RawMembershipRow {
  membership_id: number;
  joined_date: string;
  is_active: boolean;
  students: {
    student_id: number;
    first_name: string;
    last_name: string;
    student_number: string;
    grade_id: number;
    grade_levels: { name: string; sort_order: number } | null;
  } | null;
}

/**
 * Lists active members of a group with student details, ordered by
 * grade sort_order then last name then first name. The page can group
 * visually using the gradeSortOrder field.
 *
 * @rls School-scoped via RLS policy.
 */
export async function listGroupMembers(
  groupId: number,
): Promise<MembershipRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_memberships")
    .select(
      "membership_id, joined_date, is_active, students(student_id, first_name, last_name, student_number, grade_id, grade_levels(name, sort_order))",
    )
    .eq("group_id", groupId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  const rows: MembershipRow[] = (data ?? []).map((r) => {
    const raw = r as unknown as RawMembershipRow;
    return {
      membershipId: raw.membership_id,
      studentId: raw.students?.student_id ?? 0,
      firstName: raw.students?.first_name ?? "",
      lastName: raw.students?.last_name ?? "",
      studentNumber: raw.students?.student_number ?? "",
      gradeId: raw.students?.grade_id ?? 0,
      gradeName: raw.students?.grade_levels?.name ?? "",
      gradeSortOrder: raw.students?.grade_levels?.sort_order ?? 0,
      joinedDate: raw.joined_date,
      isActive: raw.is_active,
    };
  });

  // Sort by grade (so rows are contiguous per grade for visual grouping),
  // then by last name, then first name
  rows.sort((a, b) => {
    if (a.gradeSortOrder !== b.gradeSortOrder) {
      return a.gradeSortOrder - b.gradeSortOrder;
    }
    const ln = a.lastName.localeCompare(b.lastName);
    if (ln !== 0) return ln;
    return a.firstName.localeCompare(b.firstName);
  });

  return rows;
}

/**
 * Lists active students in a school who are NOT in the given group.
 *
 * @rls School-scoped via RLS policy.
 */
export async function listAvailableStudents(
  groupId: number,
  schoolId: number,
) {
  const supabase = await createClient();

  // Get active memberships for this group
  const { data: existing, error: exError } = await supabase
    .from("group_memberships")
    .select("student_id")
    .eq("group_id", groupId)
    .eq("is_active", true);

  if (exError) throw new Error(exError.message);
  const existingIds = new Set((existing ?? []).map((e) => e.student_id));

  // Get all active students for this school
  const { data: students, error: sError } = await supabase
    .from("students")
    .select(
      "student_id, first_name, last_name, student_number, grade_levels(name)",
    )
    .eq("school_id", schoolId)
    .eq("enrollment_status", "active")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (sError) throw new Error(sError.message);

  return (students ?? [])
    .filter((s) => !existingIds.has((s as { student_id: number }).student_id))
    .map((s) => {
      const r = s as unknown as {
        student_id: number;
        first_name: string;
        last_name: string;
        student_number: string;
        grade_levels: { name: string } | null;
      };
      return {
        studentId: r.student_id,
        firstName: r.first_name,
        lastName: r.last_name,
        studentNumber: r.student_number,
        gradeName: r.grade_levels?.name ?? "",
      };
    });
}

/**
 * Adds a student to a group.
 */
export async function addStudentToGroup(
  groupId: number,
  studentId: number,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("group_memberships").insert({
    group_id: groupId,
    student_id: studentId,
    joined_date: new Date().toISOString().split("T")[0],
    is_active: true,
  });
  if (error) throw new Error(error.message);
}

/**
 * Removes a student from a group (soft-delete).
 */
export async function removeStudentFromGroup(
  membershipId: number,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_memberships")
    .update({
      is_active: false,
      left_date: new Date().toISOString().split("T")[0],
    })
    .eq("membership_id", membershipId);
  if (error) throw new Error(error.message);
}

/**
 * Lists academic years for a school.
 */
export async function listAcademicYears(schoolId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_years")
    .select("year_id, label, is_current")
    .eq("school_id", schoolId)
    .order("label", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    yearId: r.year_id,
    label: r.label,
    isCurrent: r.is_current,
  }));
}

/**
 * Lists active staff for a school.
 */
export async function listActiveStaff(schoolId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("staff_id, first_name, last_name")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    staffId: r.staff_id,
    firstName: r.first_name,
    lastName: r.last_name,
  }));
}
