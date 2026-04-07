/**
 * @file utils.ts — Shared utility functions
 *
 * cn() merges Tailwind classes with clsx + tailwind-merge,
 * the standard pattern for shadcn/ui components.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind CSS classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns today's date as a YYYY-MM-DD string (UTC-based). */
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
