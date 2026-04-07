/**
 * @file dashboard/user-menu.tsx — User menu with sign-out action
 *
 * Displays the current user's email and role badge, with a sign-out button.
 */

"use client";

import { signOut } from "../login/actions";
import type { AppMetadata } from "@/lib/auth";

const ROLE_LABELS: Record<AppMetadata["role"], string> = {
  tutor: "Tutor",
  coach: "Coach",
  school_admin: "School Admin",
  tilt_admin: "TILT Admin",
};

interface UserMenuProps {
  email: string;
  role: AppMetadata["role"];
}

export function UserMenu({ email, role }: UserMenuProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{email}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {ROLE_LABELS[role]}
        </p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
