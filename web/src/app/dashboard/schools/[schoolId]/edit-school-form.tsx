/**
 * @file edit-school-form.tsx — Inline form for school identity editing
 *
 * Always-visible form (no collapsible) since this is the primary
 * configuration surface for the school.
 */

"use client";

import { useActionState } from "react";
import { updateSchoolAction, type SchoolFormState } from "../actions";
import type { SchoolRow } from "@/lib/dal/schools";

const initialState: SchoolFormState = { error: null, success: false };

interface EditSchoolFormProps {
  school: SchoolRow;
}

export function EditSchoolForm({ school }: EditSchoolFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateSchoolAction,
    initialState,
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="schoolId" value={school.schoolId} />

        {state.error && (
          <div className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {state.error}
          </div>
        )}
        {state.success && (
          <div className="rounded-md bg-green-50 p-2 text-sm text-green-800 dark:bg-green-950/50 dark:text-green-300">
            Saved successfully.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="name" className="text-xs font-medium">
              School Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={school.name}
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="shortCode" className="text-xs font-medium">
              Short Code
            </label>
            <input
              id="shortCode"
              name="shortCode"
              type="text"
              maxLength={10}
              defaultValue={school.shortCode}
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="address" className="text-xs font-medium">
            Address
          </label>
          <input
            id="address"
            name="address"
            type="text"
            defaultValue={school.address ?? ""}
            className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="city" className="text-xs font-medium">
              City
            </label>
            <input
              id="city"
              name="city"
              type="text"
              defaultValue={school.city ?? ""}
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="state" className="text-xs font-medium">
              State
            </label>
            <input
              id="state"
              name="state"
              type="text"
              maxLength={2}
              defaultValue={school.state ?? ""}
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="isActive" className="text-xs font-medium">
            Status
          </label>
          <select
            id="isActive"
            name="isActive"
            defaultValue={String(school.isActive)}
            className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
