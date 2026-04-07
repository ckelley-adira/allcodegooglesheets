/**
 * @file edit-group-form.tsx — Collapsible edit form for group settings
 *
 * Allows changing group name, grade, assigned staff, mixed-grade flag,
 * and active/inactive status.
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
  const [state, formAction, isPending] = useActionState(
    updateGroupAction,
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
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        Edit Group Settings
      </button>
    );
  }

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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            name="groupName"
            type="text"
            defaultValue={group.groupName}
            placeholder="Group name"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
          />

          <select
            name="gradeId"
            defaultValue={group.gradeId}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {grades.map((g) => (
              <option key={g.gradeId} value={g.gradeId}>
                {g.name}
              </option>
            ))}
          </select>

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
              defaultChecked={group.isMixedGrade}
              className="rounded border-zinc-300 dark:border-zinc-700"
            />
            Mixed grade
          </label>
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
