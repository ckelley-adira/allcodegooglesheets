/**
 * @file lib/assessment/scoring.ts — Initial assessment scoring engine
 *
 * Maps component-level results from the assessment form to lesson-level Y/N
 * values, then computes Foundational/KG/G1/G2/Overall metrics.
 *
 * Scoring rules (preserved exactly from the legacy Assessmentengine.gs):
 *   - A correct component marks all its mapped lessons Y.
 *   - An incorrect component marks all its mapped lessons N.
 *   - N overrides Y: if any component touching a lesson is wrong, the
 *     lesson's final result is N.
 *   - Unassessed components don't change the lesson value.
 *   - Review lessons are excluded entirely from scoring.
 */

import type { AssessmentSection, AssessmentWord } from "./sections";

/** Total UFLI lesson count. */
export const TOTAL_LESSONS = 128;

/**
 * Lessons that are marked is_review=true in ufli_lessons. These are NEVER
 * assessed and NEVER contribute to mastery percentages. Kept here as a
 * literal set for fast in-memory checks.
 *
 * If you change this list, update both ufli_lessons.is_review in the seed
 * AND the matching set in the legacy AssessmentEngine.gs.
 */
export const REVIEW_LESSONS: ReadonlySet<number> = new Set([
  5, 10, 19, 49, 53, 59, 62, 71, 76, 79, 83, 88, 92, 97, 106, 128,
]);

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
 * @param sections Submitted sections from the form.
 * @returns Lesson results, component errors, and aggregate metrics.
 */
export function scoreAssessment(sections: SubmittedSection[]): ScoredAssessment {
  const lessonResults = new Map<number, LessonResult>();
  const componentErrors: ComponentErrorRecord[] = [];

  for (const section of sections) {
    for (const word of section.words) {
      const correctNames: string[] = [];
      const missedNames: string[] = [];

      for (const component of word.components) {
        if (component.result === "correct") {
          correctNames.push(component.name);
          for (const lesson of component.lessons) {
            if (REVIEW_LESSONS.has(lesson)) continue;
            // N overrides Y: only set Y if not already N
            if (lessonResults.get(lesson) !== "N") {
              lessonResults.set(lesson, "Y");
            }
          }
        } else if (component.result === "incorrect") {
          missedNames.push(component.name);
          for (const lesson of component.lessons) {
            if (REVIEW_LESSONS.has(lesson)) continue;
            lessonResults.set(lesson, "N");
          }
        }
        // unset: leave lessons untouched
      }

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

  return {
    lessonResults,
    componentErrors,
    metrics: calculateMetrics(lessonResults),
  };
}

/**
 * Computes Foundational / KG / 1st / 2nd / Overall mastery percentages from a
 * lesson result map. Each percentage is `mastered / tested * 100`, where
 * `tested` counts only lessons in the band that have a Y or N result.
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
 * Builds the initial set of submission sections from the section catalog,
 * with every component starting at "unset". Used by the form to seed state.
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

function toSubmittedWord(word: AssessmentWord): SubmittedWord {
  return {
    word: word.word,
    number: word.number,
    primaryComponent: word.primaryComponent,
    components: word.components.map((c) => ({
      name: c.name,
      lessons: [...c.lessons],
      result: "unset",
    })),
  };
}
