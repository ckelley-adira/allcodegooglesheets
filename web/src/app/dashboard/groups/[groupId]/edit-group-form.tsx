/**
 * @file edit-group-form.tsx — Collapsible edit form for group settings
 *
 * Allows changing group name, grade(s), assigned staff, mixed-grade flag,
 * and active/inactive status. When "Mixed grade" is on the form shows a
 * multi-select of grade checkboxes; when off it shows a single dropdown.
 */

"use client";

import { useActionState, useState, useEffect } from "react";
import { updateGroupAction, type GroupFormState } from "../actions";
import type { GroupRow } from "@/lib/dal/groups";

const initialState: GroupFormState = { error: null, success: false };

interface GradeOption {
  gradeId: number;
  name: string;
}

interface StaffOption {
  staffId: number;
  firstName: string;
  lastName: string;
}

interface EditGroupFormProps {
  group: GroupRow;
  grades: GradeOption[];
  staffList: StaffOption[];
}

export function EditGroupForm({
  group,
  grades,
  staffList,
}: EditGroupFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMixedGrade, setIsMixedGrade] = useState(group.isMixedGrade);
  const [state, formAction, isPending] = useActionState(
    updateGroupAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      setIsOpen(false);
    }
  }, [state.success]);

  // Reset mixed-grade state when reopening the form
  useEffect(() => {
    if (isOpen) {
      setIsMixedGrade(group.isMixedGrade);
    }
  }, [isOpen, group.isMixedGrade]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        Edit Group Settings
      </button>
    );
  }

  // Set of current grade IDs on the group for default-checking the checkboxes
  const currentGradeIdSet = new Set(group.gradeIds);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-sm font-semibold">Edit Group</h2>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="groupId" value={group.groupId} />

        {state.error && (
          <div className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {state.error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            name="groupName"
            type="text"
            defaultValue={group.groupName}
            placeholder="Group name"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
          />

          <select
            name="staffId"
            defaultValue={group.staffId}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {staffList.map((s) => (
              <option key={s.staffId} value={s.staffId}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </select>

          <select
            name="isActive"
            defaultValue={String(group.isActive)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
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
                defaultValue={group.gradeId}
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 sm:w-64"
              >
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
                <span className="text-zinc-400">(select at least 2)</span>
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
                      defaultChecked={currentGradeIdSet.has(g.gradeId)}
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
            {isPending ? "Saving..." : "Save Changes"}
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
