/**
 * @file ufli.ts — UFLI curriculum constants (TypeScript port)
 *
 * Ported from gold-standard-template/SharedConstants.gs.
 * These constants define the 128-lesson UFLI sequence, 16 skill sections,
 * 23 review (gateway) lessons, and performance thresholds.
 *
 * Per D-006: the analytical framework carries forward unchanged.
 * The container changes; the content does not.
 *
 * @see gold-standard-template/SharedConstants.gs
 * @see data-model.md — "Key analytical structures"
 */

/** The 23 review lessons that act as gateway tests (SharedConstants.REVIEW_LESSONS) */
export const REVIEW_LESSONS = new Set([
  35, 36, 37, 39, 40, 41, 49, 53, 57, 59, 62, 71, 76, 79, 83, 88, 92, 97,
  102, 104, 105, 106, 128,
]);

/**
 * 16 skill sections mapping to lesson number arrays.
 * Source: SharedConstants.SKILL_SECTIONS
 */
export const SKILL_SECTIONS: Record<string, readonly number[]> = {
  "Single Consonants & Vowels": [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 26, 28, 29, 30, 31, 32, 33, 34,
  ],
  Blends: [25, 27],
  "Alphabet Review & Longer Words": [35, 36, 37, 38, 39, 40, 41],
  Digraphs: [42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53],
  VCE: [54, 55, 56, 57, 58, 59, 60, 61, 62],
  "Reading Longer Words": [63, 64, 65, 66, 67, 68],
  "Ending Spelling Patterns": [69, 70, 71, 72, 73, 74, 75, 76],
  "R-Controlled Vowels": [77, 78, 79, 80, 81, 82, 83],
  "Long Vowel Teams": [84, 85, 86, 87, 88],
  "Other Vowel Teams": [89, 90, 91, 92, 93, 94],
  Diphthongs: [95, 96, 97],
  "Silent Letters": [98],
  "Suffixes & Prefixes": [99, 100, 101, 102, 103, 104, 105, 106],
  "Suffix Spelling Changes": [107, 108, 109, 110],
  "Low Frequency Spellings": [111, 112, 113, 114, 115, 116, 117, 118],
  "Additional Affixes": [119, 120, 121, 122, 123, 124, 125, 126, 127, 128],
} as const;

/**
 * Performance thresholds (SharedConstants.PERFORMANCE_THRESHOLDS).
 * >= 80% = On Track, >= 50% = Needs Support, < 50% = Intervention
 */
export const PERFORMANCE_THRESHOLDS = {
  ON_TRACK: 80,
  NEEDS_SUPPORT: 50,
} as const;

export type PerformanceStatus = "On Track" | "Needs Support" | "Intervention";

/** Returns the performance status label based on percentage */
export function getPerformanceStatus(percentage: number): PerformanceStatus {
  if (percentage >= PERFORMANCE_THRESHOLDS.ON_TRACK) return "On Track";
  if (percentage >= PERFORMANCE_THRESHOLDS.NEEDS_SUPPORT) return "Needs Support";
  return "Intervention";
}

/**
 * Minimum Grade Skills denominators by grade (Big Four metric #2).
 * Source: SharedEngine.gs calculateBenchmark logic.
 */
export const MIN_GRADE_SKILLS_DENOMINATOR: Record<string, number> = {
  KG: 34,
  G1: 57,
  G2: 67,
  G3: 107,
  G4: 107,
  G5: 107,
  G6: 107,
  G7: 107,
  G8: 107,
} as const;

/**
 * Returns the largest grade-range lesson cap across the given grade names.
 * Used for the Instructional Sequence lesson picker — a KG/G1 mixed group
 * should see lessons up to L57 highlighted as "within grade range".
 */
export function getMaxGradeDenominator(gradeNames: string[]): number {
  let max = 0;
  for (const name of gradeNames) {
    const cap = MIN_GRADE_SKILLS_DENOMINATOR[name] ?? 0;
    if (cap > max) max = cap;
  }
  return max;
}

/** Total UFLI lessons in the curriculum */
export const TOTAL_LESSONS = 128;

/** Foundational skills range (L1-L34) */
export const FOUNDATIONAL_RANGE = { start: 1, end: 34 } as const;

/**
 * Current Year Goal denominators (Big Four metric #3) per grade.
 * The number of lessons each grade is expected to teach during this
 * school year, EXCLUDING review lessons. Per Christina + the original spec.
 */
export const CURRENT_YEAR_GOAL_DENOMINATOR: Record<string, number> = {
  KG: 34,
  G1: 23,
  G2: 18,
  G3: 107,
  G4: 107,
  G5: 107,
  G6: 107,
  G7: 107,
  G8: 107,
} as const;

/**
 * Target instructional cadence: 2 lessons per week ("catch them before
 * they fall"). Used by the Big Four growth slope metric (Metric C) as
 * the expected pace.
 */
export const TARGET_LESSONS_PER_WEEK = 2;

/** Number of weeks in the rolling growth slope window (Big Four metric #4) */
export const GROWTH_SLOPE_WEEKS = 4;

/**
 * Pace classification thresholds for the growth slope metric.
 * `slope = actual_lessons / max(expected - absences, 1)`.
 */
export const GROWTH_SLOPE_THRESHOLDS = {
  /** ≥ this value = on pace */
  ON_PACE: 0.85,
  /** ≥ this value but < ON_PACE = behind, monitor */
  BEHIND: 0.5,
  /** < BEHIND = significantly behind, intervention */
} as const;

/**
 * Coaching Priority Matrix thresholds (Phase C.3).
 *
 * Ported verbatim from FCD_CONFIG in FridayCoachingDashboard.gs. Per
 * Christina: preserved exactly — these values encode years of
 * pedagogical insight.
 */
export const COACHING_THRESHOLDS = {
  /** Group avg absence rate above this = warning flag (30%) */
  ABSENCE_WARNING: 30,
  /** Group avg absence rate above this = critical flag (40%) */
  ABSENCE_CRITICAL: 40,
  /** Max reteaches on any single lesson at or above this = elevated */
  RETEACH_WARNING: 1,
  /** Max reteaches on any single lesson at or above this = critical */
  RETEACH_CRITICAL: 2,
  /** Student section mastery at or above this % = "at mastery" */
  MASTERY_THRESHOLD: 80,
  /** Consecutive weeks below aimline ratio to trigger Tier 3 flag */
  GROWTH_CONCERN_WEEKS: 2,
  /** Below this fraction of aimline = week counts toward concern streak */
  GROWTH_CONCERN_RATIO: 0.5,
  /** "Fast-track" rule: group mastery % at or above this ... */
  FAST_TRACK_PASS_RATE: 80,
  /** ... combined with max lesson number at or below this = under-challenged */
  FAST_TRACK_MAX_LESSON: 40,
  /** Group mastery % below this with low reteach = fidelity concern */
  FIDELITY_LOW_PASS_RATE: 50,
  /** Group avg growth ratio (%) below this combined with high absence = systemic */
  SYSTEMIC_LOW_GROWTH_PCT: 75,
  /** Rolling window for growth slope calculation (weeks) */
  GROWTH_ROLLING_WEEKS: 4,
  /** Absence & reteach lookback window in days (2 weeks) */
  ACTIVITY_WINDOW_DAYS: 14,
} as const;
