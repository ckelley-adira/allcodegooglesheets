/**
 * @file components/filters/index.tsx — Shared filter UI primitives (Phase UX.1)
 *
 * Three reusable building blocks for page-level filter bars + drill-down
 * tile rows. Designed to work with Next.js Server Components + URL search
 * params: the consumer page reads the filter state from `searchParams`
 * and passes it in as props; the components render form inputs that
 * submit via `<form method="GET">` back to the same page.
 *
 * No client-side state, no useEffect, no hydration cost. Matches the
 * pattern already used by /dashboard/grants/mind-trust and
 * /dashboard/grants/impact.
 *
 *   <GradeFilterChips name="grade" selected={selectedGrades} />
 *     Checkbox row of KG, G1..G8. Empty selection = all grades.
 *
 *   <LookbackFilter name="windowDays" value={windowDays} />
 *     Dropdown of preset ranges (7/14/30/90 days) + "custom" input.
 *
 *   <ScopeTiles items={tileList} />
 *     Clickable tile row for drill-down navigation. Each tile shows a
 *     count, a label, and links to a filtered view of the same page.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

// ── GradeFilterChips ────────────────────────────────────────────────────

export const DEFAULT_GRADES = [
  "KG",
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
] as const;

interface GradeFilterChipsProps {
  /** Form field name, default "grade" */
  name?: string;
  /** Currently selected grades from searchParams */
  selected: string[];
  /** Available grades to show, default KG-G8 */
  grades?: readonly string[];
  /** Visual label, default "Grades" */
  label?: string;
  /** Optional hint text under the chips */
  hint?: string;
}

/**
 * Renders a checkbox row of grade chips. Empty selection = all grades.
 * Intended to be nested inside a parent `<form method="GET">`.
 */
export function GradeFilterChips({
  name = "grade",
  selected,
  grades = DEFAULT_GRADES,
  label = "Grades",
  hint = "No grades checked = all grades.",
}: GradeFilterChipsProps) {
  const noneSelected = selected.length === 0;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {grades.map((g) => {
          const checked = noneSelected || selected.includes(g);
          return (
            <label
              key={g}
              className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <input
                type="checkbox"
                name={name}
                value={g}
                defaultChecked={checked}
              />
              {g}
            </label>
          );
        })}
      </div>
      {hint && <p className="text-[10px] text-zinc-500">{hint}</p>}
    </div>
  );
}

/**
 * Parses the raw grade search param (which may be a string, array, or
 * undefined) into a canonical string[] the components + DAL functions
 * can both consume.
 */
export function parseGradeFilter(
  raw: string | string[] | undefined,
): string[] {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : raw.split(",");
  return values.map((v) => v.trim()).filter(Boolean);
}

// ── LookbackFilter ──────────────────────────────────────────────────────

export interface LookbackPreset {
  label: string;
  days: number;
}

export const DEFAULT_LOOKBACK_PRESETS: LookbackPreset[] = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

interface LookbackFilterProps {
  name?: string;
  value: number;
  presets?: LookbackPreset[];
  label?: string;
}

/**
 * Numeric day-count input backed by a native HTML `<datalist>` of
 * preset suggestions. Fully server-rendered — no JS, no client
 * component, no hydration cost. When the user clicks the input the
 * browser shows a dropdown of presets; they can also type a custom
 * value directly.
 */
export function LookbackFilter({
  name = "windowDays",
  value,
  presets = DEFAULT_LOOKBACK_PRESETS,
  label = "Lookback",
}: LookbackFilterProps) {
  const listId = `${name}-presets`;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          name={name}
          min={1}
          max={365}
          defaultValue={value}
          list={listId}
          className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          aria-label="Lookback days"
        />
        <datalist id={listId}>
          {presets.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </datalist>
        <span className="text-xs text-zinc-500">days</span>
      </div>
      <p className="text-[10px] text-zinc-500">
        Click the field to pick a preset, or type any value 1-365.
      </p>
    </div>
  );
}

/**
 * Parses the windowDays search param, clamping to [1, 365] and falling
 * back to the default when missing or invalid.
 */
export function parseLookback(
  raw: string | string[] | undefined,
  defaultDays: number,
): number {
  if (!raw) return defaultDays;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultDays;
  return Math.max(1, Math.min(365, Math.round(n)));
}

// ── ScopeTiles ──────────────────────────────────────────────────────────

export interface ScopeTileItem {
  /** Unique key for React list rendering */
  key: string;
  /** Large number shown on the tile */
  count: number | string;
  /** Short label under the count */
  label: string;
  /** Optional sub-label below the main label */
  subtitle?: string;
  /** Link target when the tile is clicked */
  href: string;
  /** Render with an active/highlighted state */
  active?: boolean;
  /** Optional color intent for the count color */
  tone?: "default" | "success" | "warning" | "danger" | "info";
}

interface ScopeTilesProps {
  items: ScopeTileItem[];
  /** Optional heading rendered above the tile row */
  heading?: string;
  /** Optional helper text rendered under the heading */
  hint?: string;
}

const TONE_COLORS: Record<NonNullable<ScopeTileItem["tone"]>, string> = {
  default: "text-zinc-900 dark:text-zinc-100",
  success: "text-green-600 dark:text-green-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  info: "text-blue-600 dark:text-blue-400",
};

/**
 * A horizontally-scrolling row of drill-down tiles. Each tile is a
 * large clickable card with a count + label + optional subtitle,
 * navigating to a filtered/scoped view of the current page.
 *
 * Designed to replace long flat tables with a "pick a slice first,
 * then see the rows" navigation model.
 */
export function ScopeTiles({ items, heading, hint }: ScopeTilesProps) {
  return (
    <section className="space-y-2">
      {heading && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {heading}
          </h2>
          {hint && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item) => {
          const tone = item.tone ?? "default";
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "group rounded-lg border bg-white p-4 shadow-sm transition hover:border-zinc-400 hover:shadow-md dark:bg-zinc-950",
                item.active
                  ? "border-zinc-900 ring-2 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
                  : "border-zinc-200 dark:border-zinc-800",
              )}
            >
              <p className={cn("text-3xl font-bold tabular-nums", TONE_COLORS[tone])}>
                {item.count}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {item.label}
              </p>
              {item.subtitle && (
                <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                  {item.subtitle}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
