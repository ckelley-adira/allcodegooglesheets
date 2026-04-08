/**
 * @file banding/engine.ts — Banding Engine (Phase D.1)
 *
 * Ports Section 5 of Adira_Reads_Future_State_Data_Model_v1.docx. Two
 * dimensions, NOT collapsed:
 *
 *   Band       — grade-level expectation status
 *                (not_started | intervention | on_track | advanced)
 *   Archetype  — shape of phonics knowledge, independent of band
 *                (pre_alphabetic | early_alphabetic | consolidated
 *                 | advanced_decoding | near_proficient)
 *
 * A student CAN be Intervention + Advanced Decoding. Both pieces matter.
 *
 * Band assignment is based on the HIGHEST SKILL SECTION with ≥80%
 * mastery, not the first failed lesson. This is critical because of
 * the Swiss Cheese finding (85.6% of students have gaps where earlier
 * failed skills coexist with later passed skills — Section 5.2).
 *
 * Archetype assignment uses nearest-centroid on a seven-bucket profile
 * vector, where the five canonical centroids come from the 1,007-
 * student K-means clustering in Section 5.1.
 *
 * swiss_cheese_gap_count is computed alongside the assignment: count
 * of non-review lessons below the ceiling lesson that the student has
 * NOT passed.
 */

import {
  SKILL_SECTIONS,
  REVIEW_LESSONS,
  type PerformanceStatus as _PerformanceStatus,
} from "@/config/ufli";
import {
  SECTION_ORDER,
  sectionForLesson,
  type SkillSectionName,
} from "@/lib/curriculum/sections";

// ── Types ────────────────────────────────────────────────────────────────

export type BandLevel =
  | "not_started"
  | "intervention"
  | "on_track"
  | "advanced";

export type StudentArchetype =
  | "pre_alphabetic"
  | "early_alphabetic"
  | "consolidated"
  | "advanced_decoding"
  | "near_proficient";

export type BandMovement =
  | "initial"
  | "accelerating"
  | "advancing"
  | "stable"
  | "regressing"
  | "exiting";

/** The seven buckets used for archetype profile matching. */
export interface ProfileVector {
  letters: number;
  cvc: number;
  blends: number;
  closedSyllable: number;
  vce: number;
  vowelTeams: number;
  advanced: number;
}

export interface BandAssignmentResult {
  band: BandLevel;
  archetype: StudentArchetype;
  ceilingSection: SkillSectionName | null;
  ceilingLessonNumber: number | null;
  swissCheeseGapCount: number;
  profileVector: ProfileVector;
}

// ── Profile bucket → lesson set mapping ─────────────────────────────────
// The seven buckets are a conceptual grouping that cuts across the 16
// skill sections. Review lessons are excluded from mastery computation.

const LETTERS_LESSONS = new Set<number>([
  // Single letter-sound lessons from SCV (excluding CVC blending reviews 5,10,19)
  1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 20, 21, 22, 23, 24, 26,
  28, 29, 30, 31, 32, 33, 34,
]);

const CVC_LESSONS = new Set<number>([
  // CVC blending reviews inside SCV
  5, 10, 19,
  // Alphabet Review & Longer Words section (35-41)
  35, 36, 37, 38, 39, 40, 41,
]);

const BLENDS_LESSONS = new Set<number>(SKILL_SECTIONS["Blends"] ?? []);

const CLOSED_SYLLABLE_LESSONS = new Set<number>([
  ...(SKILL_SECTIONS["Digraphs"] ?? []),
  ...(SKILL_SECTIONS["Reading Longer Words"] ?? []),
  ...(SKILL_SECTIONS["Ending Spelling Patterns"] ?? []),
]);

const VCE_LESSONS = new Set<number>(SKILL_SECTIONS["VCE"] ?? []);

const VOWEL_TEAMS_LESSONS = new Set<number>([
  ...(SKILL_SECTIONS["R-Controlled Vowels"] ?? []),
  ...(SKILL_SECTIONS["Long Vowel Teams"] ?? []),
  ...(SKILL_SECTIONS["Other Vowel Teams"] ?? []),
  ...(SKILL_SECTIONS["Diphthongs"] ?? []),
]);

const ADVANCED_LESSONS = new Set<number>([
  ...(SKILL_SECTIONS["Silent Letters"] ?? []),
  ...(SKILL_SECTIONS["Suffixes & Prefixes"] ?? []),
  ...(SKILL_SECTIONS["Suffix Spelling Changes"] ?? []),
  ...(SKILL_SECTIONS["Low Frequency Spellings"] ?? []),
  ...(SKILL_SECTIONS["Additional Affixes"] ?? []),
]);

/** Filter out review lessons from a bucket. */
function nonReviewLessons(bucket: Set<number>): number[] {
  const out: number[] = [];
  for (const l of bucket) if (!REVIEW_LESSONS.has(l)) out.push(l);
  return out;
}

const BUCKETS = {
  letters: nonReviewLessons(LETTERS_LESSONS),
  cvc: nonReviewLessons(CVC_LESSONS),
  blends: nonReviewLessons(BLENDS_LESSONS),
  closedSyllable: nonReviewLessons(CLOSED_SYLLABLE_LESSONS),
  vce: nonReviewLessons(VCE_LESSONS),
  vowelTeams: nonReviewLessons(VOWEL_TEAMS_LESSONS),
  advanced: nonReviewLessons(ADVANCED_LESSONS),
} satisfies Record<keyof ProfileVector, number[]>;

// ── Archetype centroids ──────────────────────────────────────────────────
// From Section 5.1 of the Future State Data Model. Values are mastery
// percentages (0-100) for each bucket. Missing values in the docx are
// filled with the lowest-category baseline (3%) for Pre-Alphabetic and
// 98% for Near-Proficient "98%+ through vowel teams" narrative.

export const ARCHETYPE_CENTROIDS: Record<StudentArchetype, ProfileVector> = {
  pre_alphabetic: {
    letters: 13,
    cvc: 9,
    blends: 8,
    closedSyllable: 6,
    vce: 3,
    vowelTeams: 3,
    advanced: 3,
  },
  early_alphabetic: {
    letters: 86,
    cvc: 75,
    blends: 55,
    closedSyllable: 12,
    vce: 4,
    vowelTeams: 4,
    advanced: 4,
  },
  consolidated: {
    letters: 88,
    cvc: 87,
    blends: 74,
    closedSyllable: 60,
    vce: 32,
    vowelTeams: 16,
    advanced: 16,
  },
  advanced_decoding: {
    letters: 95,
    cvc: 95,
    blends: 90,
    closedSyllable: 86,
    vce: 67,
    vowelTeams: 46,
    advanced: 16,
  },
  near_proficient: {
    letters: 98,
    cvc: 98,
    blends: 98,
    closedSyllable: 98,
    vce: 83,
    vowelTeams: 80,
    advanced: 58,
  },
};

/** Display label + brief instructional implication for each archetype. */
export const ARCHETYPE_META: Record<
  StudentArchetype,
  { label: string; implication: string }
> = {
  pre_alphabetic: {
    label: "Pre-Alphabetic",
    implication:
      "Intensive foundational work. Pre-phonemic awareness activities may be needed before UFLI sequence begins.",
  },
  early_alphabetic: {
    label: "Early Alphabetic",
    implication:
      "CVC-to-closed-syllable bridge is the critical intervention point. These students know letters but break at syllable type.",
  },
  consolidated: {
    label: "Consolidated",
    implication:
      "Ready for VCe and r-controlled work. Moving through Sections 6–9.",
  },
  advanced_decoding: {
    label: "Advanced Decoding",
    implication:
      "Can move quickly through Sections 9–15. Prioritize advanced patterns and morphology.",
  },
  near_proficient: {
    label: "Near-Proficient",
    implication:
      "Sections 14–16. Focus on advanced morphology (-able/-ible, doubling rule, drop-e rule). Exit criteria approaching.",
  },
};

// ── Band: grade-to-expected-section mapping ──────────────────────────────
// Derived from MIN_GRADE_SKILLS_DENOMINATOR / CURRENT_YEAR_GOAL_DENOMINATOR
// in config/ufli.ts. The "expected section" is the section where a
// student at grade level should have ≥80% mastery by EOY.

const GRADE_EXPECTED_SECTION: Record<string, SkillSectionName> = {
  KG: "Single Consonants & Vowels",
  G1: "VCE",
  G2: "Reading Longer Words",
  G3: "Suffixes & Prefixes",
  G4: "Suffixes & Prefixes",
  G5: "Suffixes & Prefixes",
  G6: "Suffixes & Prefixes",
  G7: "Suffixes & Prefixes",
  G8: "Suffixes & Prefixes",
};

function expectedSectionIndex(gradeName: string | null | undefined): number {
  if (!gradeName) return 0;
  const section = GRADE_EXPECTED_SECTION[gradeName];
  if (!section) return 0;
  return SECTION_ORDER.indexOf(section);
}

// ── Profile vector computation ──────────────────────────────────────────

/**
 * Given the set of lesson numbers a student has ever passed (Y), compute
 * the seven-bucket profile vector as mastery percentages (0-100).
 */
export function computeProfileVector(
  passedLessons: Set<number>,
): ProfileVector {
  const pct = (bucket: number[]) => {
    if (bucket.length === 0) return 0;
    let passed = 0;
    for (const l of bucket) if (passedLessons.has(l)) passed++;
    return Math.round((passed / bucket.length) * 100);
  };
  return {
    letters: pct(BUCKETS.letters),
    cvc: pct(BUCKETS.cvc),
    blends: pct(BUCKETS.blends),
    closedSyllable: pct(BUCKETS.closedSyllable),
    vce: pct(BUCKETS.vce),
    vowelTeams: pct(BUCKETS.vowelTeams),
    advanced: pct(BUCKETS.advanced),
  };
}

// ── Archetype classifier (nearest centroid, Euclidean) ─────────────────

function distance(a: ProfileVector, b: ProfileVector): number {
  const da = a.letters - b.letters;
  const db = a.cvc - b.cvc;
  const dc = a.blends - b.blends;
  const dd = a.closedSyllable - b.closedSyllable;
  const de = a.vce - b.vce;
  const df = a.vowelTeams - b.vowelTeams;
  const dg = a.advanced - b.advanced;
  return Math.sqrt(
    da * da + db * db + dc * dc + dd * dd + de * de + df * df + dg * dg,
  );
}

export function classifyArchetype(vec: ProfileVector): StudentArchetype {
  let best: StudentArchetype = "pre_alphabetic";
  let bestDist = Infinity;
  for (const [name, centroid] of Object.entries(ARCHETYPE_CENTROIDS) as Array<
    [StudentArchetype, ProfileVector]
  >) {
    const d = distance(vec, centroid);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

// ── Ceiling-based band classifier ────────────────────────────────────────

/**
 * Finds the highest skill section (by SECTION_ORDER index) where the
 * student has ≥80% mastery on non-review lessons, using bridge-resolved
 * sectioning so Blends collapses into Single Consonants & Vowels.
 */
export function findCeilingSection(
  passedLessons: Set<number>,
): SkillSectionName | null {
  // Compute per-section mastery (bridge-aware)
  // For each section, sum non-review lessons in that section's resolved
  // bucket + count how many are passed.
  const counts = new Map<
    SkillSectionName,
    { total: number; passed: number }
  >();

  for (const [rawSectionName, lessonNumbers] of Object.entries(SKILL_SECTIONS)) {
    for (const ln of lessonNumbers) {
      if (REVIEW_LESSONS.has(ln)) continue;
      // Resolve through bridging (sectionForLesson handles Blends → SCV)
      const resolved = sectionForLesson(ln);
      const section: SkillSectionName =
        resolved ?? (rawSectionName as SkillSectionName);
      const agg = counts.get(section) ?? { total: 0, passed: 0 };
      agg.total++;
      if (passedLessons.has(ln)) agg.passed++;
      counts.set(section, agg);
    }
  }

  // Walk SECTION_ORDER backward, return first section with >=80%
  for (let i = SECTION_ORDER.length - 1; i >= 0; i--) {
    const section = SECTION_ORDER[i];
    const agg = counts.get(section);
    if (!agg || agg.total === 0) continue;
    const pct = (agg.passed / agg.total) * 100;
    if (pct >= 80) return section;
  }
  return null;
}

export function classifyBand(
  ceilingSection: SkillSectionName | null,
  gradeName: string | null | undefined,
  hasAnyData: boolean,
): BandLevel {
  if (!hasAnyData) return "not_started";
  if (ceilingSection === null) return "intervention";

  const ceilingIdx = SECTION_ORDER.indexOf(ceilingSection);
  const expectedIdx = expectedSectionIndex(gradeName);

  if (ceilingIdx > expectedIdx) return "advanced";
  if (ceilingIdx >= expectedIdx - 1) return "on_track";
  return "intervention";
}

// ── Swiss Cheese gap count ───────────────────────────────────────────────

/**
 * Count of non-review lessons BELOW the student's ceiling lesson that
 * the student has NOT passed. A high gap count alongside an
 * Advanced Decoding archetype means the student should be flagged for
 * targeted gap-fill, not just sequential progression.
 */
export function computeSwissCheeseGapCount(
  passedLessons: Set<number>,
): { ceilingLesson: number | null; gapCount: number } {
  let ceiling = 0;
  for (const l of passedLessons) if (l > ceiling) ceiling = l;
  if (ceiling === 0) return { ceilingLesson: null, gapCount: 0 };

  let gaps = 0;
  for (let l = 1; l < ceiling; l++) {
    if (REVIEW_LESSONS.has(l)) continue;
    if (!passedLessons.has(l)) gaps++;
  }
  return { ceilingLesson: ceiling, gapCount: gaps };
}

// ── Main entry point ────────────────────────────────────────────────────

/**
 * Given a set of passed lesson numbers and a student's grade, run the
 * full banding engine and return band + archetype + swiss cheese + the
 * profile vector that led to the archetype choice.
 */
export function assignBand(
  passedLessons: Set<number>,
  gradeName: string | null | undefined,
): BandAssignmentResult {
  const hasAnyData = passedLessons.size > 0;
  const profileVector = computeProfileVector(passedLessons);
  const archetype = classifyArchetype(profileVector);
  const ceilingSection = findCeilingSection(passedLessons);
  const band = classifyBand(ceilingSection, gradeName, hasAnyData);
  const { ceilingLesson, gapCount } = computeSwissCheeseGapCount(passedLessons);

  return {
    band,
    archetype,
    ceilingSection,
    ceilingLessonNumber: ceilingLesson,
    swissCheeseGapCount: gapCount,
    profileVector,
  };
}

// ── Band movement computation ───────────────────────────────────────────

const BAND_ORDER: BandLevel[] = [
  "not_started",
  "intervention",
  "on_track",
  "advanced",
];

/**
 * Compares two band assignments N weeks apart and classifies the
 * movement per Section 5.3. "Exiting" is triggered by a separate flag
 * the caller passes in (the student met exit criteria and is being
 * discharged).
 */
export function classifyMovement(
  current: BandLevel,
  previous: BandLevel | null,
  wasExiting: boolean = false,
): BandMovement {
  if (wasExiting) return "exiting";
  if (previous === null) return "initial";

  const currentIdx = BAND_ORDER.indexOf(current);
  const prevIdx = BAND_ORDER.indexOf(previous);
  const delta = currentIdx - prevIdx;

  if (delta >= 2) return "accelerating";
  if (delta === 1) return "advancing";
  if (delta === 0) return "stable";
  return "regressing";
}
