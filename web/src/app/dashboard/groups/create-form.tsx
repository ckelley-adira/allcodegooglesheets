/**
 * @file dashboard/groups/create-form.tsx — Inline form to create a group
 *
 * Collapsible form for creating a new instructional group. When the
 * "Mixed grade" checkbox is off, shows a single grade dropdown. When on,
 * replaces it with a multi-select grid of checkboxes for each grade.
 */

"use client";

import { useActionState, useState, useEffect } from "react";
import { createGroupAction, type GroupFormState } from "./actions";

const initialState: GroupFormState = { error: null, success: false };

interface GradeOption {
  gradeId: number;
  name: string;
}

interface YearOption {
  yearId: number;
  label: string;
  isCurrent: boolean;
}

interface StaffOption {
  staffId: number;
  firstName: string;
  lastName: string;
}

interface CreateGroupFormProps {
  grades: GradeOption[];
  years: YearOption[];
  staffList: StaffOption[];
}

export function CreateGroupForm({
  grades,
  years,
  staffList,
}: CreateGroupFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMixedGrade, setIsMixedGrade] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createGroupAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      setIsOpen(false);
      setIsMixedGrade(false);
    }
  }, [state.success]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Create Group
      </button>
    );
  }

  const currentYear = years.find((y) => y.isCurrent);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-sm font-semibold">New Group</h2>
      <form action={formAction} className="space-y-3">
        {state.error && (
          <div className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {state.error}
          </div>
        )}

        {/* Basic fields */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            name="groupName"
            type="text"
            required
            placeholder="Group name"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
          />

          <select
            name="yearId"
            required
            defaultValue={currentYear?.yearId ?? ""}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              Academic year
            </option>
            {years.map((y) => (
              <option key={y.yearId} value={y.yearId}>
                {y.label}
                {y.isCurrent ? " (current)" : ""}
              </option>
            ))}
          </select>

          <select
            name="staffId"
            required
            defaultValue=""
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              Assigned staff
            </option>
            {staffList.map((s) => (
              <option key={s.staffId} value={s.staffId}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              name="isMixedGrade"
              type="checkbox"
              value="true"
              checked={isMixedGrade}
              onChange={(e) => setIsMixedGrade(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-700"
            />
            Mixed grade
          </label>
        </div>

        {/* Grade selector — single dropdown or multi-checkbox depending on mixed grade */}
        <div className="space-y-1">
          {!isMixedGrade ? (
            <>
              <label htmlFor="gradeId" className="text-xs font-medium">
                Grade
              </label>
              <select
                id="gradeId"
                name="gradeId"
                required
                defaultValue=""
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 sm:w-64"
              >
                <option value="" disabled>
                  Select grade
                </option>
                {grades.map((g) => (
                  <option key={g.gradeId} value={g.gradeId}>
                    {g.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <p className="text-xs font-medium">
                Grades{" "}
                <span className="text-zinc-400">
                  (select at least 2)
                </span>
              </p>
              <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
                {grades.map((g) => (
                  <label
                    key={g.gradeId}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-50 has-[:checked]:bg-zinc-900 has-[:checked]:text-white has-[:checked]:ring-zinc-900 dark:bg-zinc-950 dark:ring-zinc-700 dark:hover:bg-zinc-900 dark:has-[:checked]:bg-zinc-100 dark:has-[:checked]:text-zinc-900 dark:has-[:checked]:ring-zinc-100"
                  >
                    <input
                      type="checkbox"
                      name="gradeIds"
                      value={g.gradeId}
                      className="sr-only"
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsMixedGrade(false);
            }}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
