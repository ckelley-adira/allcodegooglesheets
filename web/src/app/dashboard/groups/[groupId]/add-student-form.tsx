/**
 * @file add-student-form.tsx — Add a student to a group
 *
 * Inline form with a dropdown of available students (those not already
 * in the group) and an add button.
 */

"use client";

import { useActionState } from "react";
import { addStudentAction, type GroupFormState } from "../actions";

const initialState: GroupFormState = { error: null, success: false };

interface AvailableStudent {
  studentId: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  gradeName: string;
}

interface AddStudentFormProps {
  groupId: number;
  availableStudents: AvailableStudent[];
}

export function AddStudentForm({
  groupId,
  availableStudents,
}: AddStudentFormProps) {
  const [state, formAction, isPending] = useActionState(
    addStudentAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="groupId" value={groupId} />

      {state.error && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      )}

      <select
        name="studentId"
        required
        defaultValue=""
        className="min-w-[200px] rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="" disabled>
          Select student to add...
        </option>
        {availableStudents.map((s) => (
          <option key={s.studentId} value={s.studentId}>
            {s.lastName}, {s.firstName} ({s.studentNumber}) — {s.gradeName}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Adding..." : "Add Student"}
      </button>
    </form>
  );
}
