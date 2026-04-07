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
  gradeName: string;
  gradeId: number;
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
  gradeId: number;
  yearId: number;
  staffId: number;
  groupName: string;
  isMixedGrade?: boolean;
}

export interface UpdateGroupInput {
  groupId: number;
  groupName?: string;
  gradeId?: number;
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
  gradeName: string;
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

function mapGroupRow(r: RawGroupRow, memberCount: number): GroupRow {
  return {
    groupId: r.group_id,
    groupName: r.group_name,
    gradeName: r.grade_levels?.name ?? "",
    gradeId: r.grade_id,
    yearLabel: r.academic_years?.label ?? "",
    yearId: r.year_id,
    staffName: `${r.staff?.first_name ?? ""} ${r.staff?.last_name ?? ""}`.trim(),
    staffId: r.staff_id,
    isMixedGrade: r.is_mixed_grade,
    isActive: r.is_active,
    memberCount,
  };
}

const GROUP_COLUMNS =
  "group_id, group_name, grade_id, year_id, staff_id, is_mixed_grade, is_active, grade_levels(name, sort_order), academic_years(label), staff(first_name, last_name)";

// ── Group queries ────────────────────────────────────────────────────────

/**
 * Lists all groups for the current user's school with member counts.
 *
 * @rls Filters by school_id automatically via RLS policy.
 */
export async function listGroups(_schoolId: number): Promise<GroupRow[]> {
  const supabase = await createClient();

  const { data: groups, error: groupsError } = await supabase
    .from("instructional_groups")
    .select(GROUP_COLUMNS);

  if (groupsError) throw new Error(groupsError.message);

  // Get member counts for each group
  const { data: memberships, error: memError } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("is_active", true);

  if (memError) throw new Error(memError.message);

  const countMap = new Map<number, number>();
  (memberships ?? []).forEach((m: { group_id: number }) => {
    countMap.set(m.group_id, (countMap.get(m.group_id) ?? 0) + 1);
  });

  const rows = (groups ?? []).map((g) =>
    mapGroupRow(g as unknown as RawGroupRow, countMap.get((g as { group_id: number }).group_id) ?? 0),
  );

  // Sort by grade sort_order, then group_name
  rows.sort((a, b) => {
    const ag = (groups ?? []).find(
      (x) => (x as { group_id: number }).group_id === a.groupId,
    ) as unknown as RawGroupRow | undefined;
    const bg = (groups ?? []).find(
      (x) => (x as { group_id: number }).group_id === b.groupId,
    ) as unknown as RawGroupRow | undefined;
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
  _schoolId: number,
): Promise<GroupRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("instructional_groups")
    .select(GROUP_COLUMNS)
    .eq("group_id", groupId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { count } = await supabase
    .from("group_memberships")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("is_active", true);

  return mapGroupRow(data as unknown as RawGroupRow, count ?? 0);
}

/**
 * Creates a new instructional group.
 *
 * @rls School-scoped via RLS policy.
 */
export async function createGroup(input: CreateGroupInput): Promise<number> {
  const supabase = await createClient();
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
  return data.group_id;
}

/**
 * Updates a group.
 *
 * @rls School-scoped via RLS policy.
 */
export async function updateGroup(
  input: UpdateGroupInput,
  _schoolId: number,
): Promise<boolean> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = {};
  if (input.groupName !== undefined) updates.group_name = input.groupName;
  if (input.gradeId !== undefined) updates.grade_id = input.gradeId;
  if (input.staffId !== undefined) updates.staff_id = input.staffId;
  if (input.isMixedGrade !== undefined) updates.is_mixed_grade = input.isMixedGrade;
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  if (Object.keys(updates).length === 0) return false;

  const { error, data } = await supabase
    .from("instructional_groups")
    .update(updates)
    .eq("group_id", input.groupId)
    .select("group_id");

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
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
    grade_levels: { name: string } | null;
  } | null;
}

/**
 * Lists active members of a group with student details.
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
      "membership_id, joined_date, is_active, students(student_id, first_name, last_name, student_number, grade_levels(name))",
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
      gradeName: raw.students?.grade_levels?.name ?? "",
      joinedDate: raw.joined_date,
      isActive: raw.is_active,
    };
  });

  rows.sort((a, b) => {
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
  _schoolId: number,
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

  // Get all active students
  const { data: students, error: sError } = await supabase
    .from("students")
    .select(
      "student_id, first_name, last_name, student_number, grade_levels(name)",
    )
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
export async function listAcademicYears(_schoolId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_years")
    .select("year_id, label, is_current")
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
export async function listActiveStaff(_schoolId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("staff_id, first_name, last_name")
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
