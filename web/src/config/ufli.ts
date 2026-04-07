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

/** Total UFLI lessons in the curriculum */
export const TOTAL_LESSONS = 128;

/** Foundational skills range (L1-L34) */
export const FOUNDATIONAL_RANGE = { start: 1, end: 34 } as const;
