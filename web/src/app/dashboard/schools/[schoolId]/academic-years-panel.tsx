/**
 * @file academic-years-panel.tsx — Academic year list + create form
 *
 * Shows the school's academic years with the ability to create a new one
 * or set an existing one as the current year. Only one year can be marked
 * is_current at a time per school.
 */

"use client";

import { useActionState, useState, useEffect } from "react";
import {
  createAcademicYearAction,
  setCurrentYearAction,
  type SchoolFormState,
} from "../actions";
import type { AcademicYearRow } from "@/lib/dal/schools";
import { Badge } from "@/components/ui/badge";

const initialState: SchoolFormState = { error: null, success: false };

interface AcademicYearsPanelProps {
  schoolId: number;
  years: AcademicYearRow[];
}

export function AcademicYearsPanel({
  schoolId,
  years,
}: AcademicYearsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createAcademicYearAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      setIsOpen(false);
    }
  }, [state.success]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {/* Year list */}
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {years.length === 0 ? (
          <p className="p-4 text-sm text-zinc-400">
            No academic years yet. Add one below.
          </p>
        ) : (
          years.map((y) => (
            <div
              key={y.yearId}
              className="flex items-center justify-between p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{y.label}</span>
                  {y.isCurrent && <Badge variant="success">Current</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {y.startDate} → {y.endDate}
                </p>
              </div>
              {!y.isCurrent && (
                <form action={setCurrentYearAction}>
                  <input type="hidden" name="yearId" value={y.yearId} />
                  <input type="hidden" name="schoolId" value={schoolId} />
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Set Current
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create form */}
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        {!isOpen ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Add Academic Year
          </button>
        ) : (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="schoolId" value={schoolId} />

            {state.error && (
              <div className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {state.error}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="label" className="text-xs font-medium">
                  Label
                </label>
                <input
                  id="label"
                  name="label"
                  type="text"
                  required
                  maxLength={10}
                  placeholder="FY26"
                  className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="startDate" className="text-xs font-medium">
                  Start Date
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="endDate" className="text-xs font-medium">
                  End Date
                </label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required
                  className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                name="isCurrent"
                type="checkbox"
                value="true"
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              Set as current year
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isPending ? "Adding..." : "Add Year"}
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
        )}
      </div>
    </div>
  );
}
