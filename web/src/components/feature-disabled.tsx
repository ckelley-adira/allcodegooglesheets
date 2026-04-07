/**
 * @file feature-disabled.tsx — Empty state for disabled features
 *
 * Renders a friendly empty state when a page is gated by a feature flag
 * that is currently turned off for the active school. Includes guidance
 * for TILT Admins on how to enable it.
 */

import Link from "next/link";

interface FeatureDisabledProps {
  /** Page title (e.g. "UFLI Map") */
  title: string;
  /** Human-readable label of the flag (e.g. "UFLI Progress Tracking") */
  flagLabel: string;
  /** Short explanation of what the feature does */
  description: string;
}

export function FeatureDisabled({
  title,
  flagLabel,
  description,
}: FeatureDisabledProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="rounded-full bg-zinc-100 p-4 dark:bg-zinc-900">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-zinc-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      <p className="text-xs text-zinc-400">
        Required feature flag:{" "}
        <span className="font-medium text-zinc-600 dark:text-zinc-300">
          {flagLabel}
        </span>
      </p>
      <Link
        href="/dashboard/schools"
        className="mt-2 text-sm text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
      >
        Manage feature flags &rarr;
      </Link>
    </div>
  );
}
