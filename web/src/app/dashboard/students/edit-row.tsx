/**
 * @file dashboard/students/edit-row.tsx — Editable student table row
 *
 * Displays a student in the table, with inline edit capability for
 * name, student ID, grade, and enrollment status.
 */

"use client";

import { useActionState, useState, useEffect, type ReactNode } from "react";
import { updateStudentAction, type StudentFormState } from "./actions";
import type { StudentRow } from "@/lib/dal/students";

const initialState: StudentFormState = { error: null, success: false };

interface GradeOption {
  gradeId: number;
  name: string;
}

interface EditStudentRowProps {
  student: StudentRow;
  grades: GradeOption[];
  canEdit: boolean;
  statusBadge: ReactNode;
}

export function EditStudentRow({
  student,
  grades,
  canEdit,
  statusBadge,
}: EditStudentRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateStudentAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      setIsEditing(false);
    }
  }, [state.success]);

  if (!isEditing) {
    return (
      <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
          {student.firstName} {student.lastName}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-zinc-500 dark:text-zinc-400">
          {student.studentNumber}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm">
          {student.gradeName}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm">{statusBadge}</td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
          {student.enrollmentDate}
        </td>
        {canEdit && (
          <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Edit
            </button>
          </td>
        )}
      </tr>
    );
  }

  return (
    <tr className="bg-zinc-50 dark:bg-zinc-900/50">
      <td colSpan={canEdit ? 6 : 5} className="px-4 py-3">
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="studentId" value={student.studentId} />

          {state.error && (
            <div className="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {state.error}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <input
              name="firstName"
              type="text"
              defaultValue={student.firstName}
              placeholder="First name"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              name="lastName"
              type="text"
              defaultValue={student.lastName}
              placeholder="Last name"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              name="studentNumber"
              type="text"
              defaultValue={student.studentNumber}
              placeholder="Student ID"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-900"
            />
            <select
              name="gradeId"
              defaultValue={student.gradeId}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {grades.map((g) => (
                <option key={g.gradeId} value={g.gradeId}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              name="enrollmentStatus"
              defaultValue={student.enrollmentStatus}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="active">Active</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="transferred">Transferred</option>
              <option value="graduated">Graduated</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}
