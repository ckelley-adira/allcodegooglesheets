/**
 * @file dashboard/staff/edit-row.tsx — Editable staff table row
 *
 * Displays a staff member in the table, with inline edit capability.
 * Toggles between display and edit modes.
 */

"use client";

import { useActionState, useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { updateStaffAction, type StaffFormState } from "./actions";
import type { StaffRow } from "@/lib/dal/staff";

const initialState: StaffFormState = { error: null, success: false };

interface EditStaffRowProps {
  member: StaffRow;
  roleBadge: ReactNode;
  statusBadge: ReactNode;
  isTiltAdmin: boolean;
}

export function EditStaffRow({
  member,
  roleBadge,
  statusBadge,
  isTiltAdmin,
}: EditStaffRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateStaffAction,
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
          <Link
            href={`/dashboard/staff/${member.staffId}`}
            className="hover:underline"
          >
            {member.firstName} {member.lastName}
          </Link>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
          {member.email}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm">{roleBadge}</td>
        <td className="whitespace-nowrap px-4 py-3 text-sm">{statusBadge}</td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Edit
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-zinc-50 dark:bg-zinc-900/50">
      <td colSpan={5} className="px-4 py-3">
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="staffId" value={member.staffId} />

          {state.error && (
            <div className="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {state.error}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <input
              name="firstName"
              type="text"
              defaultValue={member.firstName}
              placeholder="First name"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              name="lastName"
              type="text"
              defaultValue={member.lastName}
              placeholder="Last name"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              name="email"
              type="email"
              defaultValue={member.email}
              placeholder="Email"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <select
              name="role"
              defaultValue={member.role}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="tutor">Tutor</option>
              <option value="coach">Coach</option>
              <option value="school_admin">School Admin</option>
              {isTiltAdmin && (
                <option value="tilt_admin">TILT Admin</option>
              )}
            </select>
            <select
              name="isActive"
              defaultValue={String(member.isActive)}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
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
