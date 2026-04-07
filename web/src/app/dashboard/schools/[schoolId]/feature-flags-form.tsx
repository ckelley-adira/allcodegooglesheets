/**
 * @file feature-flags-form.tsx — Per-school feature flag toggles
 *
 * Renders all flags from the FEATURE_FLAGS catalog grouped by category.
 * Each toggle is a checkbox; flag values are persisted to feature_settings
 * via saveFeatureFlagsAction.
 *
 * Per the user's note: feature flags drive a lot of how the system behaves
 * downstream — UI sections, menu items, modules, and workflows are gated
 * by these flags.
 */

"use client";

import { useActionState } from "react";
import { saveFeatureFlagsAction, type SchoolFormState } from "../actions";
import {
  FEATURE_FLAGS,
  FEATURE_CATEGORIES,
  isFeatureEnabled,
} from "@/config/features";

const initialState: SchoolFormState = { error: null, success: false };

interface FeatureFlagsFormProps {
  schoolId: number;
  storedValues: Record<string, boolean>;
}

export function FeatureFlagsForm({
  schoolId,
  storedValues,
}: FeatureFlagsFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveFeatureFlagsAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <input type="hidden" name="schoolId" value={schoolId} />

      {state.error && (
        <div className="m-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="m-4 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/50 dark:text-green-300">
          Feature flags saved.
        </div>
      )}

      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {FEATURE_CATEGORIES.map((category) => {
          const flagsInCategory = FEATURE_FLAGS.filter(
            (f) => f.category === category.key,
          );
          if (flagsInCategory.length === 0) return null;

          return (
            <div key={category.key} className="p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {category.label}
              </h3>
              <div className="space-y-3">
                {flagsInCategory.map((flag) => {
                  const enabled = isFeatureEnabled(flag.key, storedValues);
                  return (
                    <label
                      key={flag.key}
                      className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <input
                        type="checkbox"
                        name={`flag_${flag.key}`}
                        defaultChecked={enabled}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{flag.label}</div>
                        <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {flag.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Saving..." : "Save Feature Flags"}
        </button>
      </div>
    </form>
  );
}
