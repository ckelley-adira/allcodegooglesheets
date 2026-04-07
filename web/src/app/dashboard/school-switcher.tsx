/**
 * @file dashboard/school-switcher.tsx — Top-bar school selector
 *
 * Lets TILT Admins switch which school they're operating on. The selection
 * persists in a cookie and affects all CRUD operations going forward.
 * For non-TILT-Admin users, this just shows the current school name (no
 * dropdown).
 */

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveSchoolAction } from "./school-context-actions";

interface SchoolOption {
  schoolId: number;
  name: string;
  shortCode: string;
}

interface SchoolSwitcherProps {
  schools: SchoolOption[];
  activeSchoolId: number;
  canSwitch: boolean;
}

export function SchoolSwitcher({
  schools,
  activeSchoolId,
  canSwitch,
}: SchoolSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const activeSchool = schools.find((s) => s.schoolId === activeSchoolId);

  if (!canSwitch || schools.length <= 1) {
    // Display-only mode for non-TILT users or when there's only one school
    return (
      <div className="hidden text-sm sm:block">
        <span className="text-zinc-500 dark:text-zinc-400">School:</span>{" "}
        <span className="font-medium">
          {activeSchool ? activeSchool.name : "No school"}
        </span>
      </div>
    );
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const schoolId = Number(e.target.value);
    if (!schoolId || schoolId === activeSchoolId) return;

    const formData = new FormData();
    formData.append("schoolId", String(schoolId));
    startTransition(async () => {
      await setActiveSchoolAction(formData);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="school-switcher"
        className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:block"
      >
        School
      </label>
      <select
        id="school-switcher"
        value={activeSchoolId}
        onChange={handleChange}
        disabled={isPending}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-medium text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {schools.map((s) => (
          <option key={s.schoolId} value={s.schoolId}>
            {s.name} ({s.shortCode})
          </option>
        ))}
      </select>
    </div>
  );
}
