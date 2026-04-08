/**
 * @file curriculum/cliffs.ts — Canonical UFLI cliff transitions (Phase D.2)
 *
 * The six highest-hazard lesson transitions identified in the 1,007-
 * student survival analysis. This is the empirical cliff list, not
 * anomaly detection.
 *
 * Alert trigger: a group is "approaching" a cliff when their highest
 * lesson attempted is within 3 lessons of the cliff's trigger lesson
 * (Section 4.4). Proximity-based, NOT slope-based — the slope-based
 * "student is slowing down" signal is Metric C of the Big Four and is
 * a separate mechanism.
 *
 * Five cliffs come from the .docx Section 4.4 with verbatim alert
 * text. L58 was added to the canonical list after the image Christina
 * shared identified it as the highest-hazard lesson in the sequence
 * (35.1%) — it's not in the .docx yet but the empirical data is real.
 * Its alert text is derived from the image's "Why" column.
 *
 * Do NOT derive these hazard rates dynamically. They are fixed
 * empirical values from the survival analysis and should only change
 * when new analysis is done.
 */

export type CliffId =
  | "l48-l50-closed-syllable"
  | "l58-u_e"
  | "l69-l70-tch-dge"
  | "l90-l91-oo-ew-ui-ue"
  | "l103-l107-doubling-rule"
  | "l125-l126-able-ible";

export interface CliffDefinition {
  id: CliffId;
  /** Short label used in UI badges */
  label: string;
  /** Transition description (e.g. "L48 → L50") */
  transition: string;
  /** Pedagogical name (e.g. "Closed Syllable → wh/ph") */
  concept: string;
  /**
   * The lesson number the group must REACH to have crossed the cliff.
   * Alert fires when maxLessonInGroup is within 3 lessons BEFORE this
   * lesson (inclusive): (triggerLesson - 3) ≤ maxLessonInGroup ≤ triggerLesson.
   * After the group passes triggerLesson, the alert no longer fires.
   *
   * For L48 → L50, the triggerLesson is 48 (the last lesson before the
   * jump to L50). For L58 which is itself the cliff, triggerLesson is 58.
   */
  triggerLesson: number;
  /** Hazard rate as a percentage, or null for "Variable" */
  hazardRatePct: number | null;
  /** Display label for the hazard rate ("19.8%" or "Variable" or "35.1% (highest)") */
  hazardRateLabel: string;
  /** Mastery drop at the cliff in percentage points, or null if not applicable */
  masteryDropPp: number | null;
  /** Display label for the mastery drop ("-36 pp" or "-57 pp (largest cliff)" or "—") */
  masteryDropLabel: string;
  /** Full alert text to show coaches — verbatim from .docx Section 4.4 where available */
  alertText: string;
}

/**
 * The canonical cliff list. Order preserved from the docx + image
 * (chronological by lesson number).
 */
export const CLIFFS: readonly CliffDefinition[] = [
  {
    id: "l48-l50-closed-syllable",
    label: "L48 → L50",
    transition: "L48 → L50",
    concept: "Closed Syllable → wh/ph",
    triggerLesson: 48,
    hazardRatePct: 19.8,
    hazardRateLabel: "19.8%",
    masteryDropPp: -36,
    masteryDropLabel: "-36 pp",
    alertText:
      "Group approaching closed syllable transition. Consider a review of L38–48 (CVC patterns) as a warm-up before introducing wh/ph.",
  },
  {
    id: "l58-u_e",
    label: "L58",
    transition: "L58",
    concept: "u_e /ū/ /yū/ (highest-hazard lesson)",
    triggerLesson: 58,
    hazardRatePct: 35.1,
    hazardRateLabel: "35.1% (highest in entire sequence)",
    masteryDropPp: null,
    masteryDropLabel: "—",
    // Derived from the "Why" column of the canonical cliff image:
    // "u has the most variable pronunciation; among students who made
    // it through 57 skills without failure, over a third fail right here."
    alertText:
      "Group approaching L58 (u_e), the highest-hazard lesson in the entire UFLI sequence. 35.1% of students who successfully reached this point fail here — 'u' has the most variable pronunciation of any vowel. Provide extra contrastive exposure to /ū/ vs. /yū/ before the assessment, and expect reteach; this is not a lesson to rush.",
  },
  {
    id: "l69-l70-tch-dge",
    label: "L69 → L70",
    transition: "L69 → L70",
    concept: "tch → dge /j/",
    triggerLesson: 69,
    hazardRatePct: 25.0,
    hazardRateLabel: "25.0%",
    masteryDropPp: -46,
    masteryDropLabel: "-46 pp",
    alertText:
      "dge /j/ is the second-hardest transition in the sequence. Typical error: spelling 'sick' as 'sik', reading 'black' as 'back'. Word sorts comparing -k vs. -ck vs. -dge are high-yield.",
  },
  {
    id: "l90-l91-oo-ew-ui-ue",
    label: "L90 → L91",
    transition: "L90 → L91",
    concept: "oo → ew/ui/ue",
    triggerLesson: 90,
    hazardRatePct: null,
    hazardRateLabel: "Variable",
    masteryDropPp: -39,
    masteryDropLabel: "-39 pp",
    alertText:
      "Students who know oo /oo/ often fail alternate spellings for the same phoneme. This is not a new sound — it is a contrastive exposure gap. Contrastive drills comparing oo vs. ew vs. ui vs. ue are more effective than sequential instruction.",
  },
  {
    id: "l103-l107-doubling-rule",
    label: "L103 → L107",
    transition: "L103 → L107",
    concept: "un- prefix → Doubling Rule",
    triggerLesson: 103,
    hazardRatePct: null,
    hazardRateLabel: "Variable",
    masteryDropPp: -57,
    masteryDropLabel: "-57 pp (largest cliff in entire sequence)",
    alertText:
      "The Doubling Rule is the steepest drop in the entire UFLI sequence. A student who fails -ing has a 2.7% probability of mastering r-controlled vowels without intervention. Allow extra time here — this is not a lesson to rush.",
  },
  {
    id: "l125-l126-able-ible",
    label: "L125 → L126",
    transition: "L125 → L126",
    concept: "-ment → -able/-ible",
    triggerLesson: 125,
    hazardRatePct: null,
    hazardRateLabel: "Variable",
    masteryDropPp: -44,
    masteryDropLabel: "-44 pp",
    alertText:
      "Suffix alternation requires conditional thinking (when do you use -able vs. -ible?). Students are spelling by sound here — they need explicit morphological instruction, not phonological drilling.",
  },
] as const;

/** Number of lessons before the cliff at which alerts begin firing. */
export const CLIFF_PROXIMITY_WINDOW = 3;

/**
 * Returns the cliff definitions that a group's `maxLessonInGroup` is
 * approaching. A cliff is "approaching" when the group is within
 * CLIFF_PROXIMITY_WINDOW lessons before (or AT) the cliff's trigger
 * lesson, and hasn't yet crossed it.
 */
export function cliffsApproachingForLesson(
  maxLessonInGroup: number,
): CliffDefinition[] {
  if (!maxLessonInGroup || maxLessonInGroup <= 0) return [];
  return CLIFFS.filter((c) => {
    const distance = c.triggerLesson - maxLessonInGroup;
    return distance >= 0 && distance <= CLIFF_PROXIMITY_WINDOW;
  });
}

/** Returns the cliff matching a given id, or undefined. */
export function findCliff(id: CliffId): CliffDefinition | undefined {
  return CLIFFS.find((c) => c.id === id);
}
