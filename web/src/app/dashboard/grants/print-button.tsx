/**
 * @file grants/print-button.tsx — Print-to-PDF trigger (Phase D.5e)
 *
 * Small client component that calls window.print() so users can
 * trigger the print dialog without hitting Cmd-P. Hidden in print
 * output via the print:hidden Tailwind variant.
 */

"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 print:hidden dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      Print / Save as PDF
    </button>
  );
}
