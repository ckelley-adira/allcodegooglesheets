/**
 * @file lib/assessment/sections.ts — UFLI initial assessment structure
 *
 * Single source of truth for the 15-section initial assessment. Ported from
 * the legacy Apps Script `Assessmentdata.gs` with one bug fix: components are
 * now stored as `{ name, lessons }` objects (not parallel arrays), and the
 * G1–G2 simplification function returns a lossless single-component view by
 * UNIONING all lessons across the original components rather than dropping
 * them. The legacy implementation lost mastery data on words like TRY,
 * TABLE, and CANDY because the simplified component name didn't match a
 * key in the lessons map.
 *
 * SECTIONS (15):
 *   1. Single Consonants & Vowels (L1-L34)
 *   2. Blends (L25, L27)
 *   3. Digraphs (L42-L52)
 *   4. VCE / Vowel-Consonant-E (L54-L61)
 *   5. Reading Longer Words (L63-L68)
 *   6. Ending Spelling Patterns (L69-L75)
 *   7. R-Controlled Vowels (L77-L82)
 *   8. Long Vowel Teams (L84-L87)
 *   9. Other Vowel Teams (L89-L94)
 *  10. Diphthongs (L95-L96)
 *  11. Silent Letters (L98)
 *  12. Suffixes & Prefixes (L99-L105)
 *  13. Suffix Spelling Changes (L107-L110)
 *  14. Low Frequency Spellings (L111-L118)
 *  15. Additional Affixes (L119-L127)
 *
 * GRADE FILTERING:
 *   KG (0): foundational only (sections 1-2). Plus digraphs+VCE if EOY.
 *   G1-G2: all sections; non-foundational sections collapse non-multi-syllable
 *          words to a single primary-component button (lessons unioned).
 *   G3-G8: skip foundational sections 1-2.
 */

/** A single component (button) within a word. */
export interface AssessmentComponent {
  /** Display label for the button (lowercase). */
  name: string;
  /** Lesson numbers this component contributes to. */
  lessons: number[];
}

/** A single word (card) within a section. */
export interface AssessmentWord {
  /** Display word (uppercase). */
  word: string;
  /** Display order within the section (1-based). */
  number: number;
  /** Name of the primary component — always exists in `components`. */
  primaryComponent: string;
  /** Component buttons for this word. */
  components: AssessmentComponent[];
}

/** A single section of the assessment. */
export interface AssessmentSection {
  /** Stable identifier; matches the keys returned by `getAllSections()`. */
  key: string;
  /** Display name. */
  name: string;
  /** Grade levels (0=KG) that see this section by default. */
  gradeRanges: number[];
  /** Words to assess. */
  words: AssessmentWord[];
}

/**
 * Words whose primaryComponent represents a multi-syllable / compound
 * decoding skill — they should NEVER be collapsed to a single button on the
 * G1–G2 simplification step (the multi-button breakdown IS the assessment).
 */
const DO_NOT_SIMPLIFY = new Set(["SNAPSHOT", "ABSENT", "CUPID"]);

const FOUNDATIONAL_SECTION_KEYS = new Set(["alphabet_consonants", "blends"]);

/**
 * Returns the full assessment structure. Treat this as immutable; callers
 * that need a filtered/simplified view should call `getAssessmentSectionsForGrade()`
 * which deep-clones before mutating.
 */
export function getAllSections(): AssessmentSection[] {
  return SECTIONS;
}

/**
 * Returns sections filtered to a specific grade level, with G1–G2
 * simplification applied to non-foundational sections.
 *
 * **Grade-Level Filtering:**
 * - Grade 0 (KG): alphabet_consonants, blends, plus digraphs/VCE if EOY
 * - Grade 1–2: All 15+ sections (except alphabet_consonants/blends are unmodified)
 * - Grade 3+: Same sections as G1-G2 but without simplification
 *
 * **Simplification (G1-G2 non-foundational only):**
 * Multi-component words collapse to single primary component with unioned
 * lesson array. Example: JAZZ [j:29, a:1, zz:42, z:34] → [zz:[1,29,34,42]].
 * Exception: DO_NOT_SIMPLIFY words (SNAPSHOT, ABSENT, CUPID) retain all
 * components for multi-syllable decoding assessment.
 *
 * Simplification prevents N-override cascading when students struggle:
 * if marking Digraphs incorrect overwrites earlier SCV successes on
 * shared lesson numbers, the assessment loses fidelity. Single-component
 * words solve this by atomizing each skill area's assessment.
 *
 * @param grade Student grade (0=KG, 1-8 standard). Invalid grades default to 0.
 * @param isKindergartenEoy When true, KG students see digraphs + VCE in
 *                          addition to the foundational sections.
 * @returns Deep-cloned sections, filtered and simplified as appropriate.
 *          Mutations do not affect the SECTIONS constant.
 */
export function getAssessmentSectionsForGrade(
  grade: number,
  isKindergartenEoy = false,
): AssessmentSection[] {
  const shouldSimplify = grade === 1 || grade === 2;
  const result: AssessmentSection[] = [];

  for (const section of SECTIONS) {
    if (!section.gradeRanges.includes(grade)) continue;

    // Kindergarten: foundational only, plus digraphs + VCE for EOY
    if (grade === 0) {
      const isFoundational = FOUNDATIONAL_SECTION_KEYS.has(section.key);
      const isKgEoyExtra =
        isKindergartenEoy &&
        (section.key === "digraphs" || section.key === "vce");
      if (!isFoundational && !isKgEoyExtra) continue;
    }

    const isFoundational = FOUNDATIONAL_SECTION_KEYS.has(section.key);
    const cloned = cloneSection(section);

    if (shouldSimplify && !isFoundational) {
      cloned.words = cloned.words.map((w) =>
        DO_NOT_SIMPLIFY.has(w.word) ? w : simplifyWord(w),
      );
    }

    result.push(cloned);
  }

  return result;
}

function cloneSection(section: AssessmentSection): AssessmentSection {
  return {
    key: section.key,
    name: section.name,
    gradeRanges: [...section.gradeRanges],
    words: section.words.map((w) => ({
      word: w.word,
      number: w.number,
      primaryComponent: w.primaryComponent,
      components: w.components.map((c) => ({
        name: c.name,
        lessons: [...c.lessons],
      })),
    })),
  };
}

/**
 * Collapses a multi-component word to a single primary-component button.
 *
 * For G1-G2 students on non-foundational sections, this transformation
 * prevents N-override semantics from cascading errors across skill areas.
 * Example: JAZZ has [j:29, a:1, zz:42, z:34]. Simplifying to [zz] with
 * lessons [1,29,34,42] means one click marks all underlying lessons,
 * preserving the pedagogical intent without multi-button complexity.
 *
 * The lesson union ensures no assessment data is lost — every lesson that
 * appears in ANY component remains in the simplified component's array.
 *
 * @param word The word to simplify. Components are assumed non-empty.
 * @returns A new word object with a single component containing all unioned lessons.
 * @throws Error if word has no components or no primaryComponent.
 */
function simplifyWord(word: AssessmentWord): AssessmentWord {
  if (!word.components || word.components.length === 0) {
    throw new Error(
      `Cannot simplify word "${word.word}": no components defined`
    );
  }
  if (!word.primaryComponent) {
    throw new Error(
      `Cannot simplify word "${word.word}": no primaryComponent defined`
    );
  }

  const unionedLessons = new Set<number>();
  for (const c of word.components) {
    for (const lessonNumber of c.lessons) {
      if (!Number.isInteger(lessonNumber) || lessonNumber <= 0) {
        console.warn(
          `Skipping invalid lesson number ${lessonNumber} in word "${word.word}" component "${c.name}"`
        );
        continue;
      }
      unionedLessons.add(lessonNumber);
    }
  }

  if (unionedLessons.size === 0) {
    console.warn(
      `Word "${word.word}" has no valid lessons after simplification`
    );
  }

  return {
    word: word.word,
    number: word.number,
    primaryComponent: word.primaryComponent,
    components: [
      {
        name: word.primaryComponent.toLowerCase(),
        lessons: [...unionedLessons].sort((a, b) => a - b),
      },
    ],
  };
}

/** Helper for compact component definitions in the data block below. */
function comp(name: string, lessons: number[]): AssessmentComponent {
  return { name, lessons };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DATA — exact port from Assessmentdata.gs (with the component-shape
// normalization that fixes the simplification bug). Lesson numbers are
// authoritative; do not change without consulting the UFLI lesson reference.
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS: AssessmentSection[] = [
  {
    key: "alphabet_consonants",
    name: "Single Consonants & Vowels",
    gradeRanges: [0, 1, 2],
    words: [
      { word: "SAM", number: 1, primaryComponent: "s", components: [comp("s", [3]), comp("a", [1]), comp("m", [2])] },
      { word: "PIN", number: 2, primaryComponent: "p", components: [comp("p", [6]), comp("i", [8]), comp("n", [9])] },
      { word: "COD", number: 3, primaryComponent: "c", components: [comp("c", [14]), comp("o", [12]), comp("d", [13])] },
      { word: "FAN", number: 4, primaryComponent: "f", components: [comp("f", [7]), comp("an", [11])] },
      { word: "BUG", number: 5, primaryComponent: "b", components: [comp("b", [17]), comp("u", [15]), comp("g", [16])] },
      { word: "BEGS", number: 6, primaryComponent: "s", components: [comp("b", [17]), comp("e", [18]), comp("g", [16]), comp("s", [20])] },
      { word: "KITS", number: 7, primaryComponent: "k", components: [comp("k", [22]), comp("i", [8]), comp("t", [4]), comp("s", [20])] },
      { word: "HAS", number: 8, primaryComponent: "h", components: [comp("h", [23]), comp("a", [1]), comp("s", [3])] },
      { word: "QUIZ", number: 9, primaryComponent: "qu", components: [comp("qu", [32]), comp("i", [8]), comp("z", [34])] },
      { word: "FOX", number: 10, primaryComponent: "x", components: [comp("f", [7]), comp("o", [12]), comp("x", [31])] },
      { word: "LET", number: 11, primaryComponent: "l", components: [comp("l", [26]), comp("e", [18]), comp("t", [4])] },
      { word: "YUM", number: 12, primaryComponent: "y", components: [comp("y", [30]), comp("u", [15]), comp("m", [2])] },
      { word: "WIG", number: 13, primaryComponent: "w", components: [comp("w", [28]), comp("i", [8]), comp("g", [16])] },
      { word: "RUN", number: 14, primaryComponent: "r", components: [comp("r", [24]), comp("u", [15]), comp("n", [9])] },
      { word: "VET", number: 15, primaryComponent: "v", components: [comp("v", [33]), comp("e", [18]), comp("t", [4])] },
      { word: "JOG", number: 16, primaryComponent: "j", components: [comp("j", [29]), comp("o", [12]), comp("g", [16])] },
    ],
  },
  {
    key: "blends",
    name: "Blends",
    gradeRanges: [0, 1, 2],
    words: [
      { word: "BRICK", number: 1, primaryComponent: "br", components: [comp("br", [25])] },
      { word: "CREEK", number: 2, primaryComponent: "cr", components: [comp("cr", [25])] },
      { word: "DRIVE", number: 3, primaryComponent: "dr", components: [comp("dr", [25])] },
      { word: "FROG", number: 4, primaryComponent: "fr", components: [comp("fr", [25])] },
      { word: "GREEN", number: 5, primaryComponent: "gr", components: [comp("gr", [25])] },
      { word: "PRETTY", number: 6, primaryComponent: "pr", components: [comp("pr", [25])] },
      { word: "TRUCK", number: 7, primaryComponent: "tr", components: [comp("tr", [25])] },
      { word: "BLACK", number: 8, primaryComponent: "bl", components: [comp("bl", [27])] },
      { word: "CLIP", number: 9, primaryComponent: "cl", components: [comp("cl", [27])] },
      { word: "FLOP", number: 10, primaryComponent: "fl", components: [comp("fl", [27])] },
      { word: "GLUM", number: 11, primaryComponent: "gl", components: [comp("gl", [27])] },
      { word: "PLUG", number: 12, primaryComponent: "pl", components: [comp("pl", [27])] },
      { word: "SLOW", number: 13, primaryComponent: "sl", components: [comp("sl", [27])] },
    ],
  },
  {
    key: "digraphs",
    name: "Digraphs",
    gradeRanges: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "JAZZ", number: 1, primaryComponent: "zz", components: [comp("j", [29]), comp("a", [1]), comp("zz", [42]), comp("z", [34])] },
      { word: "DRESS", number: 2, primaryComponent: "ss", components: [comp("dr", [25]), comp("e", [18]), comp("ss", [42])] },
      { word: "SPILL", number: 3, primaryComponent: "ll", components: [comp("i", [8]), comp("ll", [42])] },
      { word: "OFF", number: 4, primaryComponent: "ff", components: [comp("o", [12]), comp("ff", [42])] },
      { word: "ALL", number: 5, primaryComponent: "all", components: [comp("all", [43])] },
      { word: "LUNCH", number: 6, primaryComponent: "ch", components: [comp("l", [26]), comp("u", [15]), comp("ch", [48])] },
      { word: "THIN", number: 7, primaryComponent: "th", components: [comp("th", [46]), comp("n", [9])] },
      { word: "THEM", number: 8, primaryComponent: "th", components: [comp("th", [47])] },
      { word: "SH (in shock)", number: 9, primaryComponent: "sh", components: [comp("sh", [45])] },
      { word: "CK (in shock)", number: 10, primaryComponent: "ck", components: [comp("ck", [44])] },
      { word: "WHEN", number: 11, primaryComponent: "wh", components: [comp("wh", [50])] },
      { word: "GRAPH", number: 12, primaryComponent: "ph", components: [comp("ph", [50])] },
      { word: "PING", number: 13, primaryComponent: "ng", components: [comp("p", [6]), comp("ng", [51])] },
      { word: "FANG", number: 14, primaryComponent: "ng", components: [comp("f", [7]), comp("ng", [51])] },
      { word: "RINK", number: 15, primaryComponent: "nk", components: [comp("r", [24]), comp("nk", [52])] },
    ],
  },
  {
    key: "vce",
    name: "VCE (Vowel-Consonant-E)",
    gradeRanges: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "PHONE", number: 1, primaryComponent: "o_e", components: [comp("o_e", [56])] },
      { word: "GRAPE", number: 2, primaryComponent: "a_e", components: [comp("a_e", [54])] },
      { word: "QUITE", number: 3, primaryComponent: "i_e", components: [comp("qu", [32]), comp("i_e", [55])] },
      { word: "THESE", number: 4, primaryComponent: "e_e", components: [comp("e_e", [57])] },
      { word: "MUTE", number: 5, primaryComponent: "u_e", components: [comp("m", [2]), comp("u_e", [58])] },
      { word: "DUNE", number: 6, primaryComponent: "u_e", components: [comp("d", [13]), comp("u_e", [58])] },
      { word: "ICE", number: 7, primaryComponent: "ce", components: [comp("ce", [60])] },
      { word: "PAGE", number: 8, primaryComponent: "ge", components: [comp("ge", [61])] },
    ],
  },
  {
    key: "reading_longer_words",
    name: "Reading Longer Words",
    gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "BENCHES", number: 1, primaryComponent: "es", components: [comp("es", [63])] },
      { word: "YELLED", number: 2, primaryComponent: "ed", components: [comp("ed", [64])] },
      { word: "JUMPED", number: 3, primaryComponent: "ed", components: [comp("ed", [64])] },
      { word: "BLASTED", number: 4, primaryComponent: "ed", components: [comp("bl", [27]), comp("ed", [64])] },
      { word: "BOXING", number: 5, primaryComponent: "ing", components: [comp("x", [31]), comp("ing", [65])] },
      { word: "SNAPSHOT", number: 6, primaryComponent: "snapshot", components: [comp("snap", [66]), comp("shot", [66])] },
      { word: "ABSENT", number: 7, primaryComponent: "absent", components: [comp("ab", [67]), comp("sent", [67])] },
      { word: "CUPID", number: 8, primaryComponent: "cupid", components: [comp("cu", [68]), comp("pid", [68])] },
    ],
  },
  {
    key: "ending_spelling_patterns",
    name: "Ending Spelling Patterns",
    gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "SWITCH", number: 1, primaryComponent: "tch", components: [comp("w", [28]), comp("tch", [69])] },
      { word: "PLEDGE", number: 2, primaryComponent: "dge", components: [comp("pl", [27]), comp("dge", [70])] },
      { word: "CHILD", number: 3, primaryComponent: "ild", components: [comp("ild", [72])] },
      { word: "BLIND", number: 4, primaryComponent: "ind", components: [comp("bl", [27]), comp("ind", [72])] },
      { word: "VOLT", number: 5, primaryComponent: "olt", components: [comp("v", [33]), comp("olt", [72])] },
      { word: "POST", number: 6, primaryComponent: "ost", components: [comp("p", [6]), comp("ost", [72])] },
      { word: "GOLD", number: 7, primaryComponent: "old", components: [comp("g", [16]), comp("old", [72])] },
      { word: "TRY", number: 8, primaryComponent: "y_as_i", components: [comp("tr", [25]), comp("y_as_i", [74])] },
      { word: "TABLE", number: 9, primaryComponent: "le", components: [comp("t", [4]), comp("a", [1]), comp("le", [75])] },
      { word: "SAMPLE", number: 10, primaryComponent: "le", components: [comp("s", [3]), comp("am", [11]), comp("le", [75])] },
      { word: "CANDY", number: 11, primaryComponent: "y_as_e", components: [comp("y_as_e", [73])] },
    ],
  },
  {
    key: "r_controlled_vowels",
    name: "R-Controlled Vowels",
    gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "CART", number: 1, primaryComponent: "ar", components: [comp("c", [14]), comp("ar", [77])] },
      { word: "PORT", number: 2, primaryComponent: "or", components: [comp("or", [78])] },
      { word: "CLERK", number: 3, primaryComponent: "er", components: [comp("cl", [27]), comp("er", [80])] },
      { word: "BIRDS", number: 4, primaryComponent: "ir", components: [comp("b", [17]), comp("ir", [81]), comp("s", [21])] },
      { word: "HURT", number: 5, primaryComponent: "ur", components: [comp("h", [23]), comp("ur", [82])] },
    ],
  },
  {
    key: "long_vowel_teams",
    name: "Long Vowel Teams",
    gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "PAINT", number: 1, primaryComponent: "ai", components: [comp("ai", [84])] },
      { word: "SWAY", number: 2, primaryComponent: "ay", components: [comp("ay", [84])] },
      { word: "AI (in railway)", number: 3, primaryComponent: "ai", components: [comp("ai", [84])] },
      { word: "AY (in railway)", number: 4, primaryComponent: "ay", components: [comp("ay", [84])] },
      { word: "GREET", number: 5, primaryComponent: "ee", components: [comp("gr", [25]), comp("ee", [85])] },
      { word: "BLEACH", number: 6, primaryComponent: "ea", components: [comp("ea", [85])] },
      { word: "KIDNEY", number: 7, primaryComponent: "ey", components: [comp("k", [22]), comp("ey", [84])] },
      { word: "THROAT", number: 8, primaryComponent: "oa", components: [comp("oa", [86])] },
      { word: "GROW", number: 9, primaryComponent: "ow", components: [comp("ow", [86])] },
      { word: "TOE", number: 10, primaryComponent: "oe", components: [comp("oe", [86])] },
      { word: "LIFEBOAT", number: 11, primaryComponent: "oa", components: [comp("oa", [86])] },
      { word: "LIE", number: 12, primaryComponent: "ie", components: [comp("ie", [87])] },
      { word: "BRIGHT", number: 13, primaryComponent: "igh", components: [comp("br", [25]), comp("igh", [87])] },
      { word: "INSIGHT", number: 14, primaryComponent: "igh", components: [comp("igh", [87])] },
    ],
  },
  {
    key: "other_vowel_teams",
    name: "Other Vowel Teams",
    gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "COOK", number: 1, primaryComponent: "oo", components: [comp("oo", [89])] },
      { word: "PUSH", number: 2, primaryComponent: "u", components: [comp("u", [89])] },
      { word: "MOON", number: 3, primaryComponent: "oo", components: [comp("oo", [90])] },
      { word: "CHEW", number: 4, primaryComponent: "ew", components: [comp("ew", [91])] },
      { word: "FRUIT", number: 5, primaryComponent: "ui", components: [comp("ui", [91])] },
      { word: "GLUE", number: 6, primaryComponent: "ue", components: [comp("gl", [27]), comp("ue", [91])] },
      { word: "CLAW", number: 7, primaryComponent: "aw", components: [comp("aw", [93])] },
      { word: "GAUZE", number: 8, primaryComponent: "au", components: [comp("au", [93])] },
      { word: "CAUGHT", number: 9, primaryComponent: "augh", components: [comp("augh", [93])] },
      { word: "DREAD", number: 10, primaryComponent: "ea", components: [comp("dr", [25]), comp("ea", [94])] },
      { word: "SWAN", number: 11, primaryComponent: "a", components: [comp("a", [94]), comp("s", [20])] },
    ],
  },
  {
    key: "diphthongs",
    name: "Diphthongs",
    gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "JOIN", number: 1, primaryComponent: "oi", components: [comp("oi", [95])] },
      { word: "JOY", number: 2, primaryComponent: "oy", components: [comp("oy", [95])] },
      { word: "SHOUT", number: 3, primaryComponent: "ou", components: [comp("ou", [96])] },
      { word: "PLOW", number: 4, primaryComponent: "ow", components: [comp("ow", [96])] },
    ],
  },
  {
    key: "silent_letters",
    name: "Silent Letters",
    gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "KNEE", number: 1, primaryComponent: "kn", components: [comp("kn", [98])] },
      { word: "WRITE", number: 2, primaryComponent: "wr", components: [comp("wr", [98])] },
      { word: "CLIMB", number: 3, primaryComponent: "mb", components: [comp("mb", [98])] },
    ],
  },
  {
    key: "suffixes_prefixes",
    name: "Suffixes & Prefixes",
    gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "CATS", number: 1, primaryComponent: "s", components: [comp("s", [99])] },
      { word: "BUNCHES", number: 2, primaryComponent: "es", components: [comp("es", [99])] },
      { word: "FASTER", number: 3, primaryComponent: "er", components: [comp("er", [100])] },
      { word: "COLDEST", number: 4, primaryComponent: "est", components: [comp("est", [100])] },
      { word: "SADLY", number: 5, primaryComponent: "ly", components: [comp("ly", [101])] },
      { word: "UNPACK", number: 6, primaryComponent: "un", components: [comp("un", [103])] },
      { word: "ENDLESS", number: 7, primaryComponent: "less", components: [comp("less", [102])] },
      { word: "HELPFUL", number: 8, primaryComponent: "ful", components: [comp("ful", [102])] },
      { word: "UNKIND", number: 9, primaryComponent: "un", components: [comp("un", [103])] },
      { word: "PREMADE", number: 10, primaryComponent: "pre", components: [comp("pre", [104])] },
      { word: "RERUN", number: 11, primaryComponent: "re", components: [comp("re", [104])] },
      { word: "DISLIKE", number: 12, primaryComponent: "dis", components: [comp("dis", [105])] },
    ],
  },
  {
    key: "suffix_spelling_changes",
    name: "Suffix Spelling Changes",
    gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "SLAPPED", number: 1, primaryComponent: "pp", components: [comp("pp", [107]), comp("ed", [107])] },
      { word: "DROPPING", number: 2, primaryComponent: "pp", components: [comp("pp", [107]), comp("ing", [107])] },
      { word: "THINNER", number: 3, primaryComponent: "nn", components: [comp("nn", [108]), comp("er", [108])] },
      { word: "MADDEST", number: 4, primaryComponent: "dd", components: [comp("dd", [108]), comp("est", [108])] },
      { word: "BRAVER", number: 5, primaryComponent: "er", components: [comp("er", [100])] },
      { word: "CUTEST", number: 6, primaryComponent: "est", components: [comp("est", [100])] },
      { word: "FADED", number: 7, primaryComponent: "ed", components: [comp("ed", [107])] },
      { word: "HOPING", number: 8, primaryComponent: "ing", components: [comp("ing", [109])] },
      { word: "CARRIED", number: 9, primaryComponent: "ied", components: [comp("ied", [110])] },
      { word: "CRIES", number: 10, primaryComponent: "y_to_ies", components: [comp("y_to_ies", [110])] },
      { word: "BABIES", number: 11, primaryComponent: "y_to_ies", components: [comp("y_to_ies", [110])] },
      { word: "HANDIER", number: 12, primaryComponent: "y_to_ier", components: [comp("y_to_ier", [110])] },
      { word: "LAZIEST", number: 13, primaryComponent: "y_to_iest", components: [comp("y_to_iest", [110])] },
    ],
  },
  {
    key: "low_frequency_spellings",
    name: "Low Frequency Spellings",
    gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "BEGGAR", number: 1, primaryComponent: "ar", components: [comp("ar", [111])] },
      { word: "ACTOR", number: 2, primaryComponent: "or", components: [comp("or", [111])] },
      { word: "HAIR", number: 3, primaryComponent: "air", components: [comp("air", [112])] },
      { word: "DARE", number: 4, primaryComponent: "are", components: [comp("are", [112])] },
      { word: "PEAR", number: 5, primaryComponent: "ear", components: [comp("ear", [112])] },
      { word: "CLEAR", number: 6, primaryComponent: "ear", components: [comp("ear", [113])] },
      { word: "VEIN", number: 7, primaryComponent: "ei", components: [comp("ei", [114])] },
      { word: "OBEY", number: 8, primaryComponent: "ey", components: [comp("ey", [114])] },
      { word: "EIGHT", number: 9, primaryComponent: "eigh", components: [comp("eigh", [114])] },
      { word: "STEAK", number: 10, primaryComponent: "ea", components: [comp("ea", [114])] },
      { word: "FEW", number: 11, primaryComponent: "ew", components: [comp("ew", [115])] },
      { word: "FEUD", number: 12, primaryComponent: "eu", components: [comp("eu", [115])] },
      { word: "VALUE", number: 13, primaryComponent: "ue", components: [comp("ue", [115])] },
      { word: "OUGHT", number: 14, primaryComponent: "ough", components: [comp("ough", [116])] },
      { word: "DOUGH", number: 15, primaryComponent: "ough", components: [comp("ough", [116])] },
      { word: "CENTER", number: 16, primaryComponent: "c", components: [comp("c", [117])] },
      { word: "AGENT", number: 17, primaryComponent: "g", components: [comp("g", [117])] },
      { word: "GNAT", number: 18, primaryComponent: "gn", components: [comp("gn", [118])] },
      { word: "GHOST", number: 19, primaryComponent: "gh", components: [comp("gh", [118])] },
      { word: "CHEF", number: 20, primaryComponent: "ch", components: [comp("ch", [118])] },
      { word: "ECHO", number: 21, primaryComponent: "ch", components: [comp("ch", [118])] },
      { word: "CASTLE", number: 22, primaryComponent: "t", components: [comp("t", [118])] },
    ],
  },
  {
    key: "additional_affixes",
    name: "Additional Affixes",
    gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
    words: [
      { word: "INVASION", number: 1, primaryComponent: "sion", components: [comp("sion", [119])] },
      { word: "OPTION", number: 2, primaryComponent: "tion", components: [comp("tion", [119])] },
      { word: "NATURE", number: 3, primaryComponent: "ture", components: [comp("ture", [120])] },
      { word: "FIGHTER", number: 4, primaryComponent: "er", components: [comp("er", [121])] },
      { word: "DIRECTOR", number: 5, primaryComponent: "or", components: [comp("or", [121])] },
      { word: "ARTIST", number: 6, primaryComponent: "ist", components: [comp("ist", [121])] },
      { word: "DARKISH", number: 7, primaryComponent: "ish", components: [comp("ish", [122])] },
      { word: "SANDY", number: 8, primaryComponent: "y", components: [comp("y", [123])] },
      { word: "REDNESS", number: 9, primaryComponent: "ness", components: [comp("ness", [124])] },
      { word: "PAVEMENT", number: 10, primaryComponent: "ment", components: [comp("ment", [125])] },
      { word: "FIXABLE", number: 11, primaryComponent: "able", components: [comp("able", [126])] },
      { word: "FLEXIBLE", number: 12, primaryComponent: "ible", components: [comp("ible", [126])] },
      { word: "UNICORN", number: 13, primaryComponent: "uni", components: [comp("uni", [127])] },
      { word: "BISECT", number: 14, primaryComponent: "bi", components: [comp("bi", [127])] },
      { word: "TRIGRAPH", number: 15, primaryComponent: "tri", components: [comp("tri", [127])] },
    ],
  },
];
