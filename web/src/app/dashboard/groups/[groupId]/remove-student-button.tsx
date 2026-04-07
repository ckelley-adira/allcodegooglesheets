/**
 * @file remove-student-button.tsx — Remove a student from a group
 *
 * Confirmation-gated form button that soft-deletes a group membership.
 * Sets is_active=false and records left_date, preserving history.
 */

"use client";

import { removeStudentAction } from "../actions";

interface RemoveStudentButtonProps {
  membershipId: number;
  groupId: number;
  studentName: string;
}

export function RemoveStudentButton({
  membershipId,
  groupId,
  studentName,
}: RemoveStudentButtonProps) {
  return (
    <form
      action={removeStudentAction}
      onSubmit={(e) => {
        if (
          !confirm(
            `Remove ${studentName} from this group? They can be re-added later.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="groupId" value={groupId} />
      <button
        type="submit"
        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
      >
        Remove
      </button>
    </form>
  );
}
