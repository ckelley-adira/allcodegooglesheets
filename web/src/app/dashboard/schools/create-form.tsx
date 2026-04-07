/**
 * @file dashboard/schools/create-form.tsx — Inline form to create a school
 *
 * Collapsible form for creating a new school. Captures the basic identity
 * fields; academic years and feature flags are configured on the detail
 * page after creation.
 */

"use client";

import { useActionState, useState, useEffect } from "react";
import { createSchoolAction, type SchoolFormState } from "./actions";

const initialState: SchoolFormState = { error: null, success: false };

export function CreateSchoolForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createSchoolAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      setIsOpen(false);
    }
  }, [state.success]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Add School
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-sm font-semibold">New School</h2>
      <form action={formAction} className="space-y-3">
        {state.error && (
          <div className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {state.error}
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
              required
              placeholder="e.g. Adelante Schools"
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
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
              required
              maxLength={10}
              placeholder="e.g. ADEL"
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="address" className="text-xs font-medium">
            Address (optional)
          </label>
          <input
            id="address"
            name="address"
            type="text"
            placeholder="123 Main St"
            className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="city" className="text-xs font-medium">
              City (optional)
            </label>
            <input
              id="city"
              name="city"
              type="text"
              placeholder="Indianapolis"
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="state" className="text-xs font-medium">
              State (optional)
            </label>
            <input
              id="state"
              name="state"
              type="text"
              maxLength={2}
              placeholder="IN"
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? "Creating..." : "Create School"}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
