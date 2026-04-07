/**
 * @file snapshots/capture-form.tsx — Client form for manual snapshot capture
 *
 * Wraps the captureWeeklySnapshotsAction server action in useActionState
 * so we can surface success/error feedback inline without a full reload.
 */

"use client";

import { useActionState } from "react";
import {
  captureWeeklySnapshotsAction,
  type CaptureSnapshotsResult,
} from "./actions";

const initialState: CaptureSnapshotsResult = {
  ok: false,
  message: "",
};

export function CaptureSnapshotsForm({ defaultWeeks = 8 }: { defaultWeeks?: number }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: CaptureSnapshotsResult, formData: FormData) => {
      return await captureWeeklySnapshotsAction(formData);
    },
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
        Weeks to capture
        <input
          type="number"
          name="weeks"
          min={1}
          max={52}
          defaultValue={defaultWeeks}
          className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Capturing…" : "Recompute snapshots"}
      </button>
      {state.message && (
        <span
          className={
            state.ok
              ? "text-xs text-green-600 dark:text-green-400"
              : "text-xs text-red-600 dark:text-red-400"
          }
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
