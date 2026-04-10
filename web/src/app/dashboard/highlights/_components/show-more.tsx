/**
 * @file _components/show-more.tsx — Progressive disclosure toggle
 *
 * Lightweight client component that shows a capped number of children
 * with a "Show all N" / "Show less" toggle. Used by the highlights
 * drill-down pages to keep long lists scannable.
 */

"use client";

import { useState, type ReactNode } from "react";

interface ShowMoreProps {
  /** All items to render */
  children: ReactNode[];
  /** Number of items to show before collapsing. Default 5. */
  initialCount?: number;
}

export function ShowMore({ children, initialCount = 5 }: ShowMoreProps) {
  const [expanded, setExpanded] = useState(false);
  const total = children.length;

  if (total <= initialCount) {
    return <>{children}</>;
  }

  const visible = expanded ? children : children.slice(0, initialCount);

  return (
    <>
      {visible}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 w-full rounded-lg border border-dashed border-zinc-300 py-2 text-xs font-medium text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
      >
        {expanded
          ? "Show less"
          : `Show all ${total} (${total - initialCount} more)`}
      </button>
    </>
  );
}
