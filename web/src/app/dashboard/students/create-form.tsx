/**
 * @file dashboard/students/create-form.tsx — Inline form to add a student
 *
 * Collapsible form that appears above the student table.
 * Per D-009: requires student_number (external ID) as the canonical join key.
 */

"use client";

import { useActionState, useState, useEffect } from "react";
import { createStudentAction, type StudentFormState } from "./actions";

const initialState: StudentFormState = { error: null, success: false };

interface GradeOption {
  gradeId: number;
  name: string;
}

interface CreateStudentFormProps {
  grades: GradeOption[];
}

export function CreateStudentForm({ grades }: CreateStudentFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createStudentAction,
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
        Add Student
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-sm font-semibold">New Student</h2>
      <form action={formAction} className="space-y-3">
        {state.error && (
          <div className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {state.error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            name="firstName"
            type="text"
            required
            placeholder="First name"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
          />
          <input
            name="lastName"
            type="text"
            required
            placeholder="Last name"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
          />
          <input
            name="studentNumber"
            type="text"
            required
            placeholder="Student ID (e.g. K095)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
          />
          <select
            name="gradeId"
            required
            defaultValue=""
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
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
          <input
            name="enrollmentDate"
            type="date"
            defaultValue={new Date().toISOString().split("T")[0]}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? "Adding..." : "Add"}
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
