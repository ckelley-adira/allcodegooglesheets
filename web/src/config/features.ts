/**
 * @file features.ts — Feature flag catalog for Adira Reads
 *
 * Single source of truth for the per-school feature toggles. These flags
 * drive how the system behaves downstream — which menu items appear,
 * which modules load, which workflows are enabled.
 *
 * Per the GAS system's SiteConfig_TEMPLATE.gs, the historical flags fall
 * into a few groups. This catalog defines them at the application layer
 * so the UI can render checkboxes and the runtime can read them.
 *
 * Storage: per-school rows in the `feature_settings` table
 *   (school_id, feature_key, feature_value).
 *
 * @see gold-standard-template/SiteConfig_TEMPLATE.gs (legacy reference)
 */

/** A single feature flag definition */
export interface FeatureFlag {
  /** Stable key used in the database (snake_case) */
  key: string;
  /** Display label for the UI */
  label: string;
  /** Short description shown beneath the toggle */
  description: string;
  /** Logical grouping for the settings page */
  category: "core" | "instruction" | "reporting" | "integrations";
  /** Default value when no row exists in feature_settings */
  defaultValue: boolean;
}

/**
 * Master catalog of all feature flags. Add new flags here and they
 * automatically appear in the school settings UI.
 *
 * Categories:
 * - core: Foundational features (always enabled, but listed for visibility)
 * - instruction: Instructional modules (UFLI, sounds, Fry words, etc.)
 * - reporting: Reporting and analytics modules
 * - integrations: External integrations (Monday.com, etc.)
 */
export const FEATURE_FLAGS: readonly FeatureFlag[] = [
  // ── Core ──────────────────────────────────────────────────────────────
  {
    key: "ufli_progress_tracking",
    label: "UFLI Progress Tracking",
    description:
      "The 128-lesson UFLI sequence with Y/N/A scoring per student. Required for the Tutor Input Form and UFLI Map.",
    category: "core",
    defaultValue: true,
  },
  {
    key: "mixed_grade_groups",
    label: "Mixed-Grade Groups",
    description:
      "Allow instructional groups that span multiple grade levels (e.g., K-1, G2-3). Required for schools that mix grades within a tutoring group.",
    category: "core",
    defaultValue: false,
  },

  // ── Instruction ───────────────────────────────────────────────────────
  {
    key: "sound_inventory",
    label: "Sound Inventory (K-1)",
    description:
      "Per-student phoneme mastery tracking. Originally CHAW K-1 specific. Adds the Sound Inventory module.",
    category: "instruction",
    defaultValue: false,
  },
  {
    key: "fry_word_tracker",
    label: "Fry Word Tracker",
    description:
      "Group-level Fry sight word tracking. Adds the Fry Word module.",
    category: "instruction",
    defaultValue: false,
  },
  {
    key: "tutoring_system",
    label: "Tutoring System",
    description:
      "Dual-track tutoring session logging — separate from UFLI lesson capture. Adds session logging and summary reports.",
    category: "instruction",
    defaultValue: false,
  },
  {
    key: "prek_subsystem",
    label: "Pre-K Subsystem",
    description:
      "Standalone Pre-K progress tracking with its own UI suite. Independent of the K-8 UFLI engine.",
    category: "instruction",
    defaultValue: false,
  },

  // ── Reporting ─────────────────────────────────────────────────────────
  {
    key: "coaching_dashboard",
    label: "Coaching Dashboard",
    description:
      "Weekly coaching metrics and Friday Dashboard for instructional coaches. Surfaces reteach frequency, pass rates, growth slopes.",
    category: "reporting",
    defaultValue: false,
  },
  {
    key: "grant_reporting",
    label: "Grant Reporting",
    description:
      "Grant-compliance reports (Mind Trust style, 14-day lookbacks). Required for sites with grant funding obligations.",
    category: "reporting",
    defaultValue: false,
  },
  {
    key: "growth_highlighter",
    label: "Growth Highlighter",
    description:
      "Sidebar visualization showing student growth between assessment windows. Surfaces trajectory shifts.",
    category: "reporting",
    defaultValue: false,
  },
  {
    key: "parent_reports",
    label: "Parent Reports",
    description:
      "Generate per-student progress reports formatted for sharing with families.",
    category: "reporting",
    defaultValue: false,
  },

  // ── Integrations ──────────────────────────────────────────────────────
  {
    key: "unenrollment_automation",
    label: "Unenrollment Automation",
    description:
      "Auto-archival workflow when students are withdrawn. Originally integrated with Monday.com.",
    category: "integrations",
    defaultValue: false,
  },
] as const;

/** Lookup map for fast access by key */
export const FEATURE_FLAGS_BY_KEY: Record<string, FeatureFlag> =
  Object.fromEntries(FEATURE_FLAGS.map((f) => [f.key, f]));

/** Display labels for each category, in render order */
export const FEATURE_CATEGORIES: { key: FeatureFlag["category"]; label: string }[] = [
  { key: "core", label: "Core" },
  { key: "instruction", label: "Instruction" },
  { key: "reporting", label: "Reporting" },
  { key: "integrations", label: "Integrations" },
];

/**
 * Resolves a feature flag's value for a school. Returns the stored value
 * if present, otherwise falls back to the catalog default.
 */
export function isFeatureEnabled(
  key: string,
  storedValues: Record<string, boolean>,
): boolean {
  if (key in storedValues) return storedValues[key];
  const flag = FEATURE_FLAGS_BY_KEY[key];
  return flag?.defaultValue ?? false;
}
