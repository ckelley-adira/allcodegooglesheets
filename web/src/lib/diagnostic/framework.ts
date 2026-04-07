/**
 * @file diagnostic/framework.ts — UFLI Diagnostic Error Analysis Framework
 *
 * Ported from docs/Diagnostic Error Analysis Framework for UFLI Instruction.xlsx
 *
 * A practical tool for analyzing student work and planning targeted
 * instruction. Each rule maps a UFLI skill section to:
 *   - Common reading error example
 *   - Common spelling error example
 *   - Likely underlying deficit (phonological / orthographic / morphological)
 *   - Suggested instructional response
 *
 * By understanding the type of error a student is making, a tutor can
 * trace it back to a specific concept in the UFLI sequence and provide
 * a precise, effective instructional response.
 *
 * Per Christina: match by **section**, not individual lesson. A student
 * struggling anywhere in the "VCE" section gets the VCE rule; a group
 * with low mastery on "Digraphs" gets every Digraphs rule surfaced.
 *
 * Note on source data: two rules in the original xlsx had lesson ranges
 * that didn't line up with the canonical FCD section map (e.g. "69-75
 * (R-Controlled Vowels)" when R-Controlled is actually 77-83). The
 * pedagogical content is the source of truth; the section assignment
 * here follows the FCD section map names.
 */

import type { SkillSectionName } from "@/lib/curriculum/sections";

/**
 * Underlying deficit category. A rule can belong to multiple categories
 * when the error pattern crosses boundaries (e.g., phonological and
 * orthographic both contribute to digraph confusion).
 */
export type DeficitCategory = "phonological" | "orthographic" | "morphological";

export interface DiagnosticRule {
  /** Stable id for UI keys. */
  id: string;
  /** One or more skill sections this rule applies to. */
  sections: SkillSectionName[];
  /** Human-readable concept label (e.g. "FLSZ Rule", "VCe Pattern"). */
  concept: string;
  /** Example of how the error surfaces when reading aloud. */
  readingError: string;
  /** Example of how the error surfaces in spelling. */
  spellingError: string;
  /** Categories this rule belongs to. */
  deficits: DeficitCategory[];
  /** Narrative description of the underlying deficit. */
  deficitDescription: string;
  /** Concrete instructional response a tutor can try. */
  instructionalResponse: string;
}

/**
 * The 17 rules from the xlsx, organized by instructional phase:
 *   Phase 1: Alphabet & CVC Words
 *   Phase 2: Consonant Digraphs & Basic Spelling Rules
 *   Phase 3 & 4: VCe, Vowel Teams, R-Controlled
 *   Phase 5: Advanced Phonics & Morphology
 */
export const DIAGNOSTIC_RULES: readonly DiagnosticRule[] = [
  // ── Phase 1: Alphabet & CVC Words ──────────────────────────────────────
  {
    id: "single-consonants",
    sections: ["Single Consonants & Vowels"],
    concept: "Single Consonants",
    readingError:
      "Confuses visually similar letters (e.g., reads 'big' for 'dig'). Substitutes auditorily similar sounds (e.g., reads 'fan' for 'van').",
    spellingError: "Spells 'pat' as bat; 'mop' as nop.",
    deficits: ["phonological"],
    deficitDescription:
      "Poor letter-sound correspondence; weakness in discriminating between similar sounds or visual forms.",
    instructionalResponse:
      "Use mirrors and explicit instruction on articulatory gestures (mouth formation) to highlight the differences between sounds. Use multisensory letter formation practice (e.g., sand trays) and sorting activities for visually confusing letters.",
  },
  {
    id: "short-vowels",
    sections: ["Single Consonants & Vowels"],
    concept: "Short Vowels",
    readingError: "Reads 'pet' for 'pit'; 'cat' for 'cut'.",
    spellingError: "Spells 'bed' as bad; 'run' as ran.",
    deficits: ["phonological"],
    deficitDescription:
      "Poor auditory discrimination between phonetically similar short vowels (e.g., /ĕ/ and /ĭ/).",
    instructionalResponse:
      "Conduct targeted auditory discrimination drills with minimal pairs (e.g., pin/pen, map/mop). Use vowel-intensive drills and anchor charts with keyword pictures for each vowel sound.",
  },
  {
    id: "cvc-blending-segmenting",
    sections: ["Single Consonants & Vowels", "Alphabet Review & Longer Words"],
    concept: "CVC Blending & Segmenting",
    readingError:
      "Reads sounds individually but cannot blend them (e.g., says /c/ /a/ /t/ but then says 'cap'). Guesses after the initial sound (e.g., reads 'can' as 'cat').",
    spellingError:
      "Omits medial vowel or final consonant (e.g., spells 'fan' as fn; 'lump' as lup). Reverses sounds (e.g., spells 'best' as bets).",
    deficits: ["phonological"],
    deficitDescription:
      "Weak phonemic awareness, specifically in blending, segmenting, or sequencing sounds.",
    instructionalResponse:
      "Focus on oral blending and segmenting warm-ups (UFLI Step 1). Use manipulatives like sound boxes (Elkonin boxes) or tapping strategies to make segmenting concrete. Practice successive blending (/c/ → /ca/ → /cat/).",
  },
  {
    id: "s-plurals",
    sections: ["Single Consonants & Vowels"],
    concept: "-s /s/ & /z/ Plurals",
    readingError: "Reads 'dogs' as 'dog'. Omits the plural ending.",
    spellingError: "Spells 'bugs' as bugz; spells 'cats' as catz.",
    deficits: ["morphological", "phonological"],
    deficitDescription:
      "Lack of awareness of the plural morpheme '-s' and its two sounds (/s/ and /z/).",
    instructionalResponse:
      "Explicitly teach the two sounds of the plural suffix. Use word sorts to have students categorize plural nouns by their final sound (/s/ in cats, /z/ in dogs).",
  },

  // ── Phase 2: Consonant Digraphs & Basic Spelling Rules ─────────────────
  {
    id: "flsz-rule",
    sections: ["Digraphs"],
    concept: "FLSZ (Floss) Rule",
    readingError: "Hesitates or misreads words like fluff, pass, hill.",
    spellingError: "Spells 'miss' as mis; 'cuff' as cuf.",
    deficits: ["orthographic"],
    deficitDescription:
      "Lack of procedural knowledge for the FLSZ ('Floss') spelling generalization.",
    instructionalResponse:
      "Explicitly reteach the rule with a clear anchor chart. Conduct word sorts with words that follow the rule versus those that don't (e.g., fill vs. mile) and provide targeted dictation practice.",
  },
  {
    id: "ck-digraph",
    sections: ["Digraphs"],
    concept: "ck /k/ Digraph",
    readingError: "Reads 'black' as 'back' or sounds out /c/ /k/ separately.",
    spellingError: "Spells 'sick' as sik; 'duck' as duk.",
    deficits: ["orthographic"],
    deficitDescription:
      "Lack of knowledge of the 'ck' digraph rule for spelling /k/ after a short vowel.",
    instructionalResponse:
      "Word building with letter tiles to show that 'c' and 'k' come together to make one sound. Sort words by their ending: -k vs. -ck (e.g., milk vs. sick).",
  },
  {
    id: "consonant-digraphs",
    sections: ["Digraphs"],
    concept: "sh, th, ch, wh, ph",
    readingError:
      "Substitutes a similar sound (e.g., reads 'ship' as 'sip'). Reads the letters individually (e.g., /s/ /h/ for 'sh').",
    spellingError: "Spells 'ship' as chip; 'shop' as sop.",
    deficits: ["phonological", "orthographic"],
    deficitDescription:
      "Difficulty discriminating the unique sound of the digraph or lack of knowledge of the grapheme that represents it.",
    instructionalResponse:
      "Use articulatory cues to differentiate digraph sounds (e.g., /ch/ is a 'sneeze' sound, /sh/ is the 'quiet' sound). Use word sorts to compare words with digraphs to words with single consonants (e.g., shop vs. sop).",
  },
  {
    id: "ng-nk",
    sections: ["Digraphs"],
    concept: "ng, nk",
    readingError: "Reads 'sing' as 'sin'.",
    spellingError: "Spells 'bank' as bak; 'song' as sog.",
    deficits: ["phonological", "orthographic"],
    deficitDescription:
      "Difficulty producing or perceiving the nasal sounds /ŋ/ and /ŋk/. Lack of knowledge of the 'ng' and 'nk' graphemes.",
    instructionalResponse:
      "Practice words with nasal sounds in minimal pairs (e.g., win vs. wing). Provide explicit instruction on how the tongue position changes for these sounds.",
  },

  // ── Phase 3 & 4: VCe, Vowel Teams, R-Controlled ────────────────────────
  {
    id: "vce-pattern",
    sections: ["VCE"],
    concept: "VCe Pattern",
    readingError: "Reads 'hope' as 'hop'; 'made' as 'mad'.",
    spellingError: "Spells 'bike' as bik; 'tape' as tap.",
    deficits: ["orthographic"],
    deficitDescription:
      "Failure to recognize the function of the final silent 'e' in marking the preceding vowel as long.",
    instructionalResponse:
      "Explicitly reteach the VCe pattern as a unit. Use word building with manipulatives to show the change (e.g., add 'e' to 'can' to make 'cane'). Sort words into CVC vs. VCe columns.",
  },
  {
    id: "r-controlled-vowels",
    sections: ["R-Controlled Vowels"],
    concept: "R-Controlled Vowels",
    readingError: "Confuses r-controlled vowels (e.g., reads 'bird' as 'bard').",
    spellingError: "Spells 'shirt' as shert; 'form' as from.",
    deficits: ["orthographic"],
    deficitDescription:
      "Lack of knowledge of the specific graphemes for r-controlled vowels (ar, or, er, ir, ur).",
    instructionalResponse:
      "Provide intensive practice with one r-controlled vowel at a time. Use word sorts to compare different r-controlled patterns (e.g., car vs. corn vs. her).",
  },
  {
    id: "vowel-teams-diphthongs",
    sections: ["Long Vowel Teams", "Other Vowel Teams", "Diphthongs"],
    concept: "Vowel Teams & Diphthongs",
    readingError:
      "Confuses vowel sounds (e.g., reads 'boat' as 'boot'). Over-relies on 'first one does the talking' rule (e.g., misreads 'bread').",
    spellingError: "Spells 'rain' as rane; 'boat' as bote; 'dream' as dreme.",
    deficits: ["orthographic"],
    deficitDescription:
      "Lack of graphemic knowledge for specific vowel teams; over-reliance on a more familiar but incorrect pattern (e.g., using VCe).",
    instructionalResponse:
      "Intensive practice with one vowel team at a time using word sorts, decodable text, and explicit instruction on positional best-fit rules (e.g., 'ay' is used at the end of a word, 'ai' is not).",
  },

  // ── Phase 5: Advanced Phonics & Morphology ─────────────────────────────
  {
    id: "affixes-ed-ing",
    sections: ["Suffixes & Prefixes"],
    concept: "Affixes (-ed, -ing, un-, re-)",
    readingError: "Reads 'jumped' as 'jump-ed' (two syllables).",
    spellingError: "Spells 'wished' as wisht; 'helped' as helpt.",
    deficits: ["morphological"],
    deficitDescription:
      "Spelling phonetically rather than by morpheme (the '-ed' suffix).",
    instructionalResponse:
      "Explicitly teach the three sounds of the -ed suffix (/t/, /d/, /əd/). Sort past-tense verbs by the sound of the suffix. Practice 'peeling off' affixes to read the base word first.",
  },
  {
    id: "suffix-addition-rules",
    sections: ["Suffix Spelling Changes"],
    concept: "Suffix Addition Rules",
    readingError: "Hesitates on words like hopping or sliding.",
    spellingError: "Spells 'hopping' as hoping; 'sliding' as slideing.",
    deficits: ["morphological", "orthographic"],
    deficitDescription:
      "Lack of knowledge of suffix-addition rules (doubling rule, drop-e rule).",
    instructionalResponse:
      "Provide explicit instruction on one rule at a time. Use word sorts and word building to practice applying the rule (e.g., hop + ing → hopping; hope + ing → hoping).",
  },
  {
    id: "multisyllabic-words",
    sections: ["Reading Longer Words"],
    concept: "Multisyllabic Words",
    readingError:
      "Attempts to sound out a long word letter-by-letter instead of chunking into syllables.",
    spellingError:
      "Omits syllables or vowels in unstressed syllables (e.g., spells 'elephant' as elfant).",
    deficits: ["phonological", "orthographic"],
    deficitDescription:
      "Lack of strategies for syllable division; difficulty hearing unstressed syllables.",
    instructionalResponse:
      "Explicitly teach syllable types (open, closed, VCe, etc.) and syllable division patterns. Practice breaking words into syllables before reading or spelling.",
  },
] as const;

/** Returns every rule that applies to a given section. */
export function getDiagnosticRulesForSection(
  section: SkillSectionName,
): DiagnosticRule[] {
  return DIAGNOSTIC_RULES.filter((r) => r.sections.includes(section));
}

/**
 * Returns every rule that applies to any of the given sections, deduped
 * by rule id. Order preserved from DIAGNOSTIC_RULES (instructional phase).
 */
export function getDiagnosticRulesForSections(
  sections: SkillSectionName[],
): DiagnosticRule[] {
  const wanted = new Set(sections);
  return DIAGNOSTIC_RULES.filter((r) =>
    r.sections.some((s) => wanted.has(s)),
  );
}

/** Human-readable labels + color classes for each deficit category. */
export const DEFICIT_META: Record<
  DeficitCategory,
  { label: string; colorClass: string }
> = {
  phonological: {
    label: "Phonological",
    colorClass:
      "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  },
  orthographic: {
    label: "Orthographic",
    colorClass:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  },
  morphological: {
    label: "Morphological",
    colorClass:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
};
