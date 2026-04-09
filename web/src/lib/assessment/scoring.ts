/**
 * @file lib/assessment/scoring.ts — Initial assessment scoring engine
 *
 * Transforms component-level results from the assessment form into lesson-level
 * Y/N values and computes grade-band and overall mastery metrics.
 *
 * **Core Algorithm:**
 * 1. Iterate submitted sections → words → components
 * 2. For each component result (correct/incorrect/unset):
 *    - Correct: mark all lessons in that component Y (unless already N)
 *    - Incorrect: mark all lessons in that component N (overrides Y)
 *    - Unset: do nothing
 * 3. Exclude review lessons from all calculations (gateway logic handles them)
 * 4. Build diagnostic error records for words with missed components
 * 5. Calculate mastery % for foundational/KG/G1/G2/overall bands
 *
 * **Key Design Decisions:**
 * - N-override semantics ensure strict mastery — one failure = no credit
 * - Review lessons excluded preserves the gateway pedagogical model
 * - G1-G2 simplification (in sections.ts) prevents cascading N-override errors
 * - Metrics computed only over lessons actually assessed (tested > 0)
 *
 * **Preserves Exactly:**
 * The scoring rules, lesson mappings, and band boundaries from the legacy
 * Assessmentengine.gs. No algorithmic changes — only a type-safe TS port
 * that replaces Apps Script.
 */

import { REVIEW_LESSONS as CANONICAL_REVIEW_LESSONS } from "@/config/ufli";
import type { AssessmentSection, AssessmentWord } from "./sections";

/** Total UFLI lesson count. */
export const TOTAL_LESSONS = 128;

/**
 * Re-export canonical REVIEW_LESSONS from config/ufli.ts to ensure
 * assessment scoring uses the same review lesson set as all other
 * calculations (Big Four metrics, banding, coaching, etc.).
 *
 * Per D-006: The 23 canonical review lessons are the single source of truth.
 * All mastery calculations must exclude these.
 */
export const REVIEW_LESSONS = CANONICAL_REVIEW_LESSONS;

/** Three-state value for a single component button. */
export type ComponentResult = "correct" | "incorrect" | "unset";

/** A component as it appears in submitted form data. */
export interface SubmittedComponent {
  name: string;
  lessons: number[];
  result: ComponentResult;
}

/** A word as it appears in submitted form data. */
export interface SubmittedWord {
  word: string;
  number: number;
  primaryComponent: string;
  components: SubmittedComponent[];
}

/** A section as it appears in submitted form data. */
export interface SubmittedSection {
  key: string;
  name: string;
  words: SubmittedWord[];
}

/** Per-lesson result after merging all submitted components. */
export type LessonResult = "Y" | "N";

/** Diagnostic record for a word where the student missed at least one part. */
export interface ComponentErrorRecord {
  sectionKey: string;
  sectionName: string;
  word: string;
  componentsCorrect: string[];
  componentsMissed: string[];
}

/** Output of the scoring engine. */
export interface ScoredAssessment {
  /** Final lesson → Y/N map. Lessons with no data are absent from the map. */
  lessonResults: Map<number, LessonResult>;
  /** Word-level diagnostic errors (one per word with at least one missed component). */
  componentErrors: ComponentErrorRecord[];
  /** Per-grade-band mastery percentages (0-100). null if no lessons in band assessed. */
  metrics: AssessmentMetrics;
}

export interface AssessmentMetrics {
  foundationalPct: number | null;
  kgPct: number | null;
  firstGradePct: number | null;
  secondGradePct: number | null;
  overallPct: number | null;
}

/**
 * Grade-band lesson predicates. Lessons in REVIEW_LESSONS are excluded from
 * every band — the predicates already filter those out.
 *
 * Foundational: L1-L34 (basic single sounds + blends)
 * KG (kindergarten target band): L1-L68 minus a few advanced exceptions
 * 1st Grade target band: L35-L110
 * 2nd Grade target band: L38-L127
 */
export const GRADE_BAND_PREDICATES = {
  foundational: (n: number) => n >= 1 && n <= 34 && !REVIEW_LESSONS.has(n),
  kg: (n: number) => {
    const advanced = new Set([38, 60, 61]);
    return n >= 1 && n <= 68 && !advanced.has(n) && !REVIEW_LESSONS.has(n);
  },
  firstGrade: (n: number) => n >= 35 && n <= 110 && !REVIEW_LESSONS.has(n),
  secondGrade: (n: number) => n >= 38 && n <= 127 && !REVIEW_LESSONS.has(n),
} as const;

/**
 * Scores a submitted assessment in one pass.
 *
 * **Scoring Rules (per legacy Assessmentengine.gs):**
 * - A correct component marks all its mapped lessons Y.
 * - An incorrect component marks all its mapped lessons N.
 * - **N overrides Y:** if any component touching a lesson is wrong, the
 *   lesson's final result is N, regardless of earlier Y markings.
 * - Unassessed components (result="unset") don't change lesson values.
 * - Review lessons (from REVIEW_LESSONS config) are excluded entirely.
 *
 * The N-override semantics ensure strict mastery: one failure on a lesson
 * prevents it from being counted as mastered. This is intentional and
 * pedagogically important — a lesson must be passed in all assessment
 * components that touch it.
 *
 * G1-G2 simplification (in getAssessmentSectionsForGrade) prevents
 * cascading N-override errors by collapsing multi-component words into
 * single components with unioned lessons. This keeps assessment data
 * atomized per skill area.
 *
 * @param sections Submitted sections from the form. Components assumed valid.
 * @returns Lesson results map, component error diagnostics, and metrics.
 * @throws Error if sections array is null or undefined.
 */
/**
 * Validates that sections data has required structure.
 * @throws Error if sections are malformed or missing required fields.
 */
function validateSections(sections: SubmittedSection[]): void {
  if (!sections || !Array.isArray(sections)) {
    throw new Error("Assessment sections must be a non-empty array");
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section.key || !section.name || !Array.isArray(section.words)) {
      throw new Error(
        `Section ${i} is missing required fields (key, name, words)`
      );
    }

    for (let j = 0; j < section.words.length; j++) {
      const word = section.words[j];
      if (!word.word || typeof word.number !== "number" || !Array.isArray(word.components)) {
        throw new Error(
          `Section "${section.name}" word ${j} is missing required fields (word, number, components)`
        );
      }

      for (let k = 0; k < word.components.length; k++) {
        const component = word.components[k];
        if (
          typeof component !== "object" ||
          !component.name ||
          !Array.isArray(component.lessons) ||
          !["unset", "correct", "incorrect"].includes(component.result)
        ) {
          throw new Error(
            `Section "${section.name}" word "${word.word}" component ${k} has invalid structure. ` +
            `Expected { name, lessons: number[], result: "unset"|"correct"|"incorrect" }, ` +
            `got ${JSON.stringify(component)}`
          );
        }
      }
    }
  }
}

export function scoreAssessment(sections: SubmittedSection[]): ScoredAssessment {
  if (!sections) {
    throw new Error("Cannot score assessment: sections is null or undefined");
  }

  // Validate structure before processing
  validateSections(sections);

  const lessonResults = new Map<number, LessonResult>();
  const componentErrors: ComponentErrorRecord[] = [];

  // DEBUG: Log input structure for first word
  if (sections.length > 0 && sections[0].words.length > 0) {
    const firstWord = sections[0].words[0];
    console.log("[SCORING] Processing first word:", {
      section: sections[0].key,
      word: firstWord.word,
      components: firstWord.components.map(c => ({
        name: c.name,
        lessonCount: c.lessons.length,
        lessons: c.lessons,
        result: c.result,
      })),
    });
  }

  for (const section of sections) {
    for (const word of section.words) {
      const correctNames: string[] = [];
      const missedNames: string[] = [];

      for (const component of word.components) {
        if (component.result === "correct") {
          correctNames.push(component.name);
          for (const lesson of component.lessons) {
            // Skip review lessons — they're handled separately by gateway logic
            if (REVIEW_LESSONS.has(lesson)) continue;
            // N overrides Y: only set Y if not already N
            if (lessonResults.get(lesson) !== "N") {
              lessonResults.set(lesson, "Y");
            }
          }
        } else if (component.result === "incorrect") {
          missedNames.push(component.name);
          for (const lesson of component.lessons) {
            // Skip review lessons
            if (REVIEW_LESSONS.has(lesson)) continue;
            // Mark as N, overriding any previous Y
            lessonResults.set(lesson, "N");
          }
        }
        // result="unset": leave lessons untouched
      }

      // Record diagnostic errors (one per word with at least one missed component)
      if (missedNames.length > 0) {
        componentErrors.push({
          sectionKey: section.key,
          sectionName: section.name,
          word: word.word,
          componentsCorrect: correctNames,
          componentsMissed: missedNames,
        });
      }
    }
  }

  // DEBUG: Log results summary
  const correctCount = Array.from(lessonResults.values()).filter(v => v === "Y").length;
  const incorrectCount = Array.from(lessonResults.values()).filter(v => v === "N").length;
  console.log("[SCORING] Results summary:", {
    totalLessons: lessonResults.size,
    correct: correctCount,
    incorrect: incorrectCount,
    correctPct: correctCount > 0 ? Math.round((correctCount / (correctCount + incorrectCount)) * 100) : 0,
  });

  return {
    lessonResults,
    componentErrors,
    metrics: calculateMetrics(lessonResults),
  };
}

/**
 * Computes grade-band mastery percentages from lesson results.
 *
 * **Metric Calculation:**
 * For each band (foundational/KG/G1/G2) and overall:
 *   1. Count lessons with Y result in band = mastered
 *   2. Count lessons with Y or N result in band = tested
 *   3. Percentage = `mastered / tested * 100` (or null if tested=0)
 *
 * **Bands are exclusive** — KG excludes lessons [38, 60, 61] (advanced exceptions),
 * all bands exclude review lessons. This prevents review lessons from inflating
 * band percentages and ensures gateway logic works independently.
 *
 * **High-Water Mark Semantics:**
 * This function receives a lesson result map built from a single assessment.
 * In practice, downstream code combines this with the student's prior
 * high-water-mark history (max Y ever recorded across all assessments)
 * to compute true mastery. This function only scores the current snapshot.
 *
 * @param lessonResults Map of lesson_number → result from scoreAssessment.
 * @returns Percentages for each band (null if no lessons tested in band).
 */
export function calculateMetrics(
  lessonResults: Map<number, LessonResult>,
): AssessmentMetrics {
  const calc = (predicate: (n: number) => boolean): number | null => {
    let mastered = 0;
    let tested = 0;
    for (let n = 1; n <= TOTAL_LESSONS; n++) {
      if (!predicate(n)) continue;
      const value = lessonResults.get(n);
      if (value === "Y") {
        mastered++;
        tested++;
      } else if (value === "N") {
        tested++;
      }
    }
    return tested > 0 ? (mastered / tested) * 100 : null;
  };

  let totalMastered = 0;
  let totalTested = 0;
  for (const value of lessonResults.values()) {
    if (value === "Y") {
      totalMastered++;
      totalTested++;
    } else if (value === "N") {
      totalTested++;
    }
  }

  return {
    foundationalPct: calc(GRADE_BAND_PREDICATES.foundational),
    kgPct: calc(GRADE_BAND_PREDICATES.kg),
    firstGradePct: calc(GRADE_BAND_PREDICATES.firstGrade),
    secondGradePct: calc(GRADE_BAND_PREDICATES.secondGrade),
    overallPct: totalTested > 0 ? (totalMastered / totalTested) * 100 : null,
  };
}

/**
 * Builds the initial form state from the section catalog.
 *
 * Transforms readonly AssessmentSection[] (from getAssessmentSectionsForGrade)
 * into mutable SubmittedSection[] with every component initialized to
 * result="unset". This is called when the wizard starts to seed the form's
 * useState with the student's grade-appropriate sections.
 *
 * @param sections Sections from getAssessmentSectionsForGrade (already
 *                 simplified for G1-G2 if applicable).
 * @returns Deep-cloned sections with mutable component states.
 */
export function buildSubmissionFromSections(
  sections: AssessmentSection[],
): SubmittedSection[] {
  return sections.map((section) => ({
    key: section.key,
    name: section.name,
    words: section.words.map(toSubmittedWord),
  }));
}

/**
 * Converts a readonly AssessmentWord to a mutable SubmittedWord.
 * Clones lesson arrays and initializes each component's result to "unset".
 *
 * @internal Called by buildSubmissionFromSections.
 */
function toSubmittedWord(word: AssessmentWord): SubmittedWord {
  return {
    word: word.word,
    number: word.number,
    primaryComponent: word.primaryComponent,
    components: word.components.map((c) => ({
      name: c.name,
      lessons: [...c.lessons],  // Shallow clone to allow independent mutation
      result: "unset",
    })),
  };
}
