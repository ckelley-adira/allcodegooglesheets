/**
 * @file dashboard/schools/actions.ts — Server Actions for school configuration
 *
 * TILT-Admin-only operations for managing schools, academic years, and
 * feature flags. All actions enforce the tilt_admin role check via
 * requireRole("tilt_admin"). Per D-007, this is the centralized
 * (non-self-service) school management surface for the MVP.
 *
 * @actionType mutation
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  createSchool as dalCreateSchool,
  getSchool as dalGetSchool,
  updateSchool as dalUpdateSchool,
  createAcademicYear as dalCreateAcademicYear,
  setCurrentAcademicYear as dalSetCurrentYear,
  setSchoolFeatureFlags as dalSetFeatureFlags,
  getSchoolFeatureFlags as dalGetSchoolFeatureFlags,
} from "@/lib/dal/schools";
import { auditLog } from "@/lib/audit/log";

export interface SchoolFormState {
  error: string | null;
  success: boolean;
}

// ── School CRUD ──────────────────────────────────────────────────────────

/**
 * Creates a new school.
 *
 * @actionType mutation
 * @rls TILT Admin only.
 */
export async function createSchoolAction(
  _prevState: SchoolFormState,
  formData: FormData,
): Promise<SchoolFormState> {
  const user = await requireRole("tilt_admin");

  const name = (formData.get("name") as string)?.trim();
  const shortCode = (formData.get("shortCode") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() || undefined;
  const city = (formData.get("city") as string)?.trim() || undefined;
  const state = (formData.get("state") as string)?.trim() || undefined;

  if (!name) {
    return { error: "School name is required.", success: false };
  }
  if (!shortCode) {
    return { error: "Short code is required.", success: false };
  }
  if (shortCode.length > 10) {
    return { error: "Short code must be 10 characters or fewer.", success: false };
  }
  if (state && state.length !== 2) {
    return { error: "State must be a 2-letter code (e.g. IN).", success: false };
  }

  try {
    const newSchoolId = await dalCreateSchool({
      name,
      shortCode,
      address,
      city,
      state,
    });

    await auditLog({
      schoolId: newSchoolId,
      userId: user.staffId,
      action: "INSERT",
      tableName: "schools",
      recordId: newSchoolId,
      newValue: { name, shortCode, address, city, state },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create school.";
    if (message.includes("unique") || message.includes("duplicate")) {
      return {
        error: "A school with this short code already exists.",
        success: false,
      };
    }
    return { error: message, success: false };
  }

  revalidatePath("/dashboard/schools");
  return { error: null, success: true };
}

/**
 * Updates a school's identity fields.
 *
 * @actionType mutation
 * @rls TILT Admin only.
 */
export async function updateSchoolAction(
  _prevState: SchoolFormState,
  formData: FormData,
): Promise<SchoolFormState> {
  const user = await requireRole("tilt_admin");

  const schoolId = Number(formData.get("schoolId"));
  if (!schoolId || isNaN(schoolId)) {
    return { error: "Invalid school.", success: false };
  }

  const name = (formData.get("name") as string)?.trim() || undefined;
  const shortCode = (formData.get("shortCode") as string)?.trim() || undefined;
  const address = formData.has("address")
    ? ((formData.get("address") as string)?.trim() || null)
    : undefined;
  const city = formData.has("city")
    ? ((formData.get("city") as string)?.trim() || null)
    : undefined;
  const state = formData.has("state")
    ? ((formData.get("state") as string)?.trim() || null)
    : undefined;
  const isActiveRaw = formData.get("isActive");
  const isActive = isActiveRaw !== null ? isActiveRaw === "true" : undefined;

  // Cadence days come in as multiple cadenceDays checkbox values.
  // Read them only if the form actually had the field (checkboxes don't
  // post when unchecked, so presence of the key in any entry is the
  // signal to update).
  let cadenceDays: string[] | undefined;
  if (formData.has("cadenceDays") || formData.get("cadenceDaysPresent") === "1") {
    cadenceDays = formData.getAll("cadenceDays").map((v) => String(v));
  }

  if (state && state.length !== 2) {
    return { error: "State must be a 2-letter code.", success: false };
  }

  try {
    const previous = await dalGetSchool(schoolId);
    if (!previous) {
      return { error: "School not found.", success: false };
    }

    const updated = await dalUpdateSchool({
      schoolId,
      name,
      shortCode,
      address,
      city,
      state,
      cadenceDays,
      isActive,
    });
    if (!updated) {
      return { error: "School not found.", success: false };
    }

    const after = await dalGetSchool(schoolId);
    await auditLog({
      schoolId,
      userId: user.staffId,
      action: "UPDATE",
      tableName: "schools",
      recordId: schoolId,
      oldValue: previous as unknown as Record<string, unknown>,
      newValue: (after ?? {}) as unknown as Record<string, unknown>,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update school.";
    if (message.includes("unique") || message.includes("duplicate")) {
      return {
        error: "A school with this short code already exists.",
        success: false,
      };
    }
    return { error: message, success: false };
  }

  revalidatePath(`/dashboard/schools/${schoolId}`);
  revalidatePath("/dashboard/schools");
  return { error: null, success: true };
}

// ── Academic Years ───────────────────────────────────────────────────────

/**
 * Creates a new academic year for a school.
 *
 * @actionType mutation
 * @rls TILT Admin only.
 */
export async function createAcademicYearAction(
  _prevState: SchoolFormState,
  formData: FormData,
): Promise<SchoolFormState> {
  const user = await requireRole("tilt_admin");

  const schoolId = Number(formData.get("schoolId"));
  const label = (formData.get("label") as string)?.trim();
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const isCurrent = formData.get("isCurrent") === "true";

  if (!schoolId || isNaN(schoolId)) {
    return { error: "Invalid school.", success: false };
  }
  if (!label || !startDate || !endDate) {
    return {
      error: "Year label, start date, and end date are required.",
      success: false,
    };
  }

  try {
    const yearId = await dalCreateAcademicYear({
      schoolId,
      label,
      startDate,
      endDate,
      isCurrent,
    });

    await auditLog({
      schoolId,
      userId: user.staffId,
      action: "INSERT",
      tableName: "academic_years",
      recordId: yearId,
      newValue: { label, startDate, endDate, isCurrent },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create academic year.";
    if (message.includes("unique") || message.includes("duplicate")) {
      return {
        error: "An academic year with this label already exists.",
        success: false,
      };
    }
    return { error: message, success: false };
  }

  revalidatePath(`/dashboard/schools/${schoolId}`);
  return { error: null, success: true };
}

/**
 * Sets a specific academic year as the current one.
 *
 * @actionType mutation
 * @rls TILT Admin only.
 */
export async function setCurrentYearAction(formData: FormData): Promise<void> {
  const user = await requireRole("tilt_admin");

  const yearId = Number(formData.get("yearId"));
  const schoolId = Number(formData.get("schoolId"));
  if (!yearId || !schoolId) return;

  await dalSetCurrentYear(yearId, schoolId);

  await auditLog({
    schoolId,
    userId: user.staffId,
    action: "UPDATE",
    tableName: "academic_years",
    recordId: yearId,
    newValue: { isCurrent: true },
  });

  revalidatePath(`/dashboard/schools/${schoolId}`);
}

// ── Feature Flags ────────────────────────────────────────────────────────

/**
 * Saves all feature flag toggles for a school in one operation.
 * The form submits a checkbox for each flag; we read the catalog and
 * derive the boolean state from the form data.
 *
 * @actionType mutation
 * @rls TILT Admin only.
 */
export async function saveFeatureFlagsAction(
  _prevState: SchoolFormState,
  formData: FormData,
): Promise<SchoolFormState> {
  const user = await requireRole("tilt_admin");

  const schoolId = Number(formData.get("schoolId"));
  if (!schoolId || isNaN(schoolId)) {
    return { error: "Invalid school.", success: false };
  }

  // Read all feature flag values from the form
  const { FEATURE_FLAGS } = await import("@/config/features");
  const values: Record<string, boolean> = {};
  for (const flag of FEATURE_FLAGS) {
    values[flag.key] = formData.get(`flag_${flag.key}`) === "on";
  }

  try {
    const previous = await dalGetSchoolFeatureFlags(schoolId);
    await dalSetFeatureFlags(schoolId, values);

    await auditLog({
      schoolId,
      userId: user.staffId,
      action: "UPDATE",
      tableName: "feature_settings",
      recordId: null,
      oldValue: previous as Record<string, unknown>,
      newValue: values as Record<string, unknown>,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to save feature flags.";
    return { error: message, success: false };
  }

  revalidatePath(`/dashboard/schools/${schoolId}`);
  return { error: null, success: true };
}
