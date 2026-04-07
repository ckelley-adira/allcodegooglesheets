/**
 * @file dal/staff.ts — Data access layer for staff operations
 *
 * Uses the Supabase JS client (PostgREST over HTTPS) for serverless reliability.
 *
 * @rls School-scoping enforced by RLS policies via the user's JWT.
 */

import { createClient } from "@/lib/supabase/server";

export interface StaffRow {
  staffId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: "tutor" | "coach" | "school_admin" | "tilt_admin";
  isActive: boolean;
  createdAt: Date;
}

export interface CreateStaffInput {
  schoolId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: "tutor" | "coach" | "school_admin" | "tilt_admin";
}

export interface UpdateStaffInput {
  staffId: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: "tutor" | "coach" | "school_admin" | "tilt_admin";
  isActive?: boolean;
}

interface RawStaffRow {
  staff_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: "tutor" | "coach" | "school_admin" | "tilt_admin";
  is_active: boolean;
  created_at: string;
}

function mapStaffRow(r: RawStaffRow): StaffRow {
  return {
    staffId: r.staff_id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    role: r.role,
    isActive: r.is_active,
    createdAt: new Date(r.created_at),
  };
}

const STAFF_COLUMNS =
  "staff_id, first_name, last_name, email, role, is_active, created_at";

/**
 * Lists all staff for the current user's school.
 *
 * @rls Filters by school_id automatically via RLS policy.
 */
export async function listStaff(schoolId: number): Promise<StaffRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select(STAFF_COLUMNS)
    .eq("school_id", schoolId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapStaffRow(r as unknown as RawStaffRow));
}

/**
 * Gets a single staff member.
 *
 * @rls School-scoped via RLS policy.
 */
export async function getStaff(
  staffId: number,
  schoolId: number,
): Promise<StaffRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select(STAFF_COLUMNS)
    .eq("staff_id", staffId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapStaffRow(data as unknown as RawStaffRow);
}

/**
 * Creates a new staff member.
 *
 * @rls School-scoped via RLS policy.
 */
export async function createStaff(
  input: CreateStaffInput,
): Promise<StaffRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .insert({
      school_id: input.schoolId,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      role: input.role,
    })
    .select(STAFF_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapStaffRow(data as unknown as RawStaffRow);
}

/**
 * Updates a staff member.
 *
 * @rls School-scoped via RLS policy.
 */
export async function updateStaff(
  input: UpdateStaffInput,
  schoolId: number,
): Promise<StaffRow | null> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = {};
  if (input.firstName !== undefined) updates.first_name = input.firstName;
  if (input.lastName !== undefined) updates.last_name = input.lastName;
  if (input.email !== undefined) updates.email = input.email;
  if (input.role !== undefined) updates.role = input.role;
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  if (Object.keys(updates).length === 0) return null;

  const { data, error } = await supabase
    .from("staff")
    .update(updates)
    .eq("staff_id", input.staffId)
    .eq("school_id", schoolId)
    .select(STAFF_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapStaffRow(data as unknown as RawStaffRow);
}
