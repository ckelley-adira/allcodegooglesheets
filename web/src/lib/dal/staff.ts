/**
 * @file dal/staff.ts — Data access layer for staff operations
 *
 * All database queries and mutations for staff records. Every function
 * is called from Server Actions or Server Components only.
 *
 * @rls All queries go through Drizzle with the service role connection.
 *   School-scoping is enforced by passing schoolId explicitly from the
 *   authenticated user's JWT claims. This is the application-layer check
 *   (D-002 layer 3); RLS provides the defense-in-depth layer beneath it.
 */

import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { staff } from "@/lib/db/schema";

/** Shape returned to the UI — only the fields the UI needs */
export interface StaffRow {
  staffId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: "tutor" | "coach" | "school_admin" | "tilt_admin";
  isActive: boolean;
  createdAt: Date;
}

/** Input for creating a new staff member */
export interface CreateStaffInput {
  schoolId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: "tutor" | "coach" | "school_admin" | "tilt_admin";
}

/** Input for updating a staff member */
export interface UpdateStaffInput {
  staffId: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: "tutor" | "coach" | "school_admin" | "tilt_admin";
  isActive?: boolean;
}

/**
 * Lists all staff for a school, ordered by last name.
 *
 * @rls Filters by schoolId from the caller's JWT claims.
 */
export async function listStaff(schoolId: number): Promise<StaffRow[]> {
  const rows = await db
    .select({
      staffId: staff.staffId,
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      role: staff.role,
      isActive: staff.isActive,
      createdAt: staff.createdAt,
    })
    .from(staff)
    .where(eq(staff.schoolId, schoolId))
    .orderBy(asc(staff.lastName), asc(staff.firstName));

  return rows;
}

/**
 * Gets a single staff member by ID, scoped to school.
 *
 * @rls Verifies schoolId matches the caller's JWT claims.
 */
export async function getStaff(
  staffId: number,
  schoolId: number,
): Promise<StaffRow | null> {
  const [row] = await db
    .select({
      staffId: staff.staffId,
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      role: staff.role,
      isActive: staff.isActive,
      createdAt: staff.createdAt,
    })
    .from(staff)
    .where(and(eq(staff.staffId, staffId), eq(staff.schoolId, schoolId)))
    .limit(1);

  return row ?? null;
}

/**
 * Creates a new staff member for a school.
 * Does NOT create a Supabase Auth account — that's a separate step
 * (the staff member signs up themselves, then admin links them).
 *
 * @rls schoolId comes from the caller's JWT claims.
 */
export async function createStaff(
  input: CreateStaffInput,
): Promise<StaffRow> {
  const [row] = await db
    .insert(staff)
    .values({
      schoolId: input.schoolId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      role: input.role,
    })
    .returning({
      staffId: staff.staffId,
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      role: staff.role,
      isActive: staff.isActive,
      createdAt: staff.createdAt,
    });

  return row;
}

/**
 * Updates a staff member's details. Only the provided fields are updated.
 *
 * @rls schoolId check is performed by the caller (Server Action).
 */
export async function updateStaff(
  input: UpdateStaffInput,
  schoolId: number,
): Promise<StaffRow | null> {
  const updates: Record<string, unknown> = {};
  if (input.firstName !== undefined) updates.firstName = input.firstName;
  if (input.lastName !== undefined) updates.lastName = input.lastName;
  if (input.email !== undefined) updates.email = input.email;
  if (input.role !== undefined) updates.role = input.role;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  if (Object.keys(updates).length === 0) return null;

  const [row] = await db
    .update(staff)
    .set(updates)
    .where(and(eq(staff.staffId, input.staffId), eq(staff.schoolId, schoolId)))
    .returning({
      staffId: staff.staffId,
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      role: staff.role,
      isActive: staff.isActive,
      createdAt: staff.createdAt,
    });

  return row ?? null;
}
