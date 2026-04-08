/**
 * =============================================================================
 * UFLI MASTER SYSTEM — ASSESSMENT DATA
 * =============================================================================
 * File: _AssessmentData.gs
 *
 * Source of truth for all UFLI assessment sections, words, components, and
 * lesson mappings. Used by AssessmentEngine.gs to generate the assessment
 * form and map component-level results to lesson-level Y/N values.
 *
 * ARCHITECTURE NOTE — Component Data Shape:
 *   getAllSectionsData() stores components as plain strings and lessons as a
 *   separate parallel object keyed by component name. This is the raw/internal
 *   format used only within this file.
 *
 *   getAssessmentSections() is the ONLY public-facing function. It normalizes
 *   each word's components into a structured array of objects before returning:
 *     { name: string, lessons: number[] }
 *   This normalized shape is what AssessmentEngine.gs and assessmentform.html
 *   receive and depend on. Do NOT change this contract without updating both
 *   consumers.
 *
 * BUG FIX (2026-04-08):
 *   Previously, word.components was returned as a plain string array. The HTML
 *   form then tried to look up lesson numbers via word.lessons[c] at render
 *   time. This lookup failed silently (|| [] fallback) for any component where
 *   the key casing didn't exactly match — causing Sections 3–15 to submit zero
 *   lesson results. Fixed by normalizing components to { name, lessons } objects
 *   inside getAssessmentSections() before sending to the client.
 *
 * SECTIONS (15):
 *   1.  Single Consonants & Vowels (L1-L34)
 *   2.  Blends (L25, L27)
 *   3.  Digraphs (L42-L52)
 *   4.  VCE / Vowel-Consonant-E (L54-L61)
 *   5.  Reading Longer Words (L63-L68)
 *   6.  Ending Spelling Patterns (L69-L75)
 *   7.  R-Controlled Vowels (L77-L82)
 *   8.  Long Vowel Teams (L84-L87)
 *   9.  Other Vowel Teams (L89-L94)
 *  10.  Diphthongs (L95-L96)
 *  11.  Silent Letters (L98)
 *  12.  Suffixes & Prefixes (L99-L105)
 *  13.  Suffix Spelling Changes (L107-L110)
 *  14.  Low Frequency Spellings (L111-L118)
 *  15.  Additional Affixes (L119-L127)
 *
 * GRADE RANGES:
 *   KG (0):     Sections 1-2 (+ Sections 3-4 for EOY)
 *   Grade 1:    Sections 1-15
 *   Grade 2:    Sections 1-15
 *   Grades 3-8: Sections 3-15 (skip foundational alphabet/blends)
 *
 * SIMPLIFICATION RULES:
 *   Grades 1-2 on non-foundational sections: Reduce to primary component only
 *   (except compound/multi-syllable words which keep full component breakdown)
 *
 * @file _AssessmentData.gs
 * @description Assessment section definitions, lesson mappings, and grade-filtered
 *   section builder for the UFLI Initial Assessment form.
 *
 * @school All Sites
 * @workbook UFLI Master System (per-site)
 * @trigger Called by: AssessmentEngine.gs (getAssessmentSections),
 *          assessmentform.html (via google.script.run)
 * @dependencies None
 * @sideEffects None — read-only data provider
 *
 * @author Christina Kelley (CK Consulting / TILT)
 * @lastModified 2026-04-08
 *
 * @changelog
 *   2026-04-08 - BUG FIX: Normalized word.components to { name, lessons } objects
 *                in getAssessmentSections() so the HTML form never does a fragile
 *                key lookup against word.lessons at render time. Sections 3-15 were
 *                silently writing zero lesson results due to key mismatch.
 * =============================================================================
 */


/**
 * Section-to-lesson mapping for report generation.
 * Used by ReportEngine to calculate section-level mastery percentages.
 * These are the assessable lesson numbers only (review lessons excluded).
 */
const SECTION_LESSON_RANGES = {
  'Single Consonants & Vowels': [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 20, 21, 22, 23, 24, 26, 28, 29, 30, 31, 32, 33, 34],
  'Blends': [25, 27],
  'Digraphs': [42, 43, 44, 45, 46, 47, 48, 50, 51, 52],
  'VCE (Vowel-Consonant-E)': [54, 55, 56, 57, 58, 60, 61],
  'Reading Longer Words': [63, 64, 65, 66, 67, 68],
  'Ending Spelling Patterns': [69, 70, 72, 73, 74, 75],
  'R-Controlled Vowels': [77, 78, 80, 81, 82],
  'Long Vowel Teams': [84, 85, 86, 87],
  'Other Vowel Teams': [89, 90, 91, 93, 94],
  'Diphthongs': [95, 96],
  'Silent Letters': [98],
  'Suffixes & Prefixes': [99, 100, 101, 102, 103, 104, 105],
  'Suffix Spelling Changes': [107, 108, 109, 110],
  'Low Frequency Spellings': [111, 112, 113, 114, 115, 116, 117, 118],
  'Additional Affixes': [119, 120, 121, 122, 123, 124, 125, 126, 127]
};


/**
 * Returns the raw assessment section definitions — internal format only.
 *
 * IMPORTANT: This is an internal data store. Do NOT call this directly from
 * AssessmentEngine.gs or the HTML form. Use getAssessmentSections() instead,
 * which normalizes the component shape before returning.
 *
 * Each section contains:
 *   - name: Display name
 *   - gradeRanges: Array of grade levels (0=KG) that should see this section
 *   - words: Array of word objects, each with:
 *       - word: The display word
 *       - number: Display order within section
 *       - primaryComponent: The main skill being tested (used for simplification)
 *       - components: Array of component name strings (raw; normalized by getAssessmentSections)
 *       - lessons: Object mapping component name → lesson number array
 *                  Keys are lowercase component strings matching the components array values.
 *
 * @returns {Object} All assessment sections keyed by section ID
 */
function getAllSectionsData() {
  return {

    // ─────────────────────────────────────────────────────────────
    // SECTION 1: Single Consonants & Vowels (Lessons 1-34)
    // ─────────────────────────────────────────────────────────────
    alphabet_consonants: {
      name: 'Single Consonants & Vowels',
      gradeRanges: [0, 1, 2],
      words: [
        { word: 'SAM',  number: 1,  primaryComponent: 'S',  components: ['s', 'a', 'm'],         lessons: { 's': [3], 'a': [1], 'm': [2] } },
        { word: 'PIN',  number: 2,  primaryComponent: 'P',  components: ['p', 'i', 'n'],         lessons: { 'p': [6], 'i': [8], 'n': [9] } },
        { word: 'COD',  number: 3,  primaryComponent: 'C',  components: ['c', 'o', 'd'],         lessons: { 'c': [14], 'o': [12], 'd': [13] } },
        { word: 'FAN',  number: 4,  primaryComponent: 'F',  components: ['f', 'an'],             lessons: { 'f': [7], 'an': [11] } },
        { word: 'BUG',  number: 5,  primaryComponent: 'B',  components: ['b', 'u', 'g'],         lessons: { 'b': [17], 'u': [15], 'g': [16] } },
        { word: 'BEGS', number: 6,  primaryComponent: 'S',  components: ['b', 'e', 'g', 's'],    lessons: { 'b': [17], 'e': [18], 'g': [16], 's': [20] } },
        { word: 'KITS', number: 7,  primaryComponent: 'K',  components: ['k', 'i', 't', 's'],    lessons: { 'k': [22], 'i': [8], 't': [4], 's': [20] } },
        { word: 'HAS',  number: 8,  primaryComponent: 'H',  components: ['h', 'a', 's'],         lessons: { 'h': [23], 'a': [1], 's': [3] } },
        { word: 'QUIZ', number: 9,  primaryComponent: 'QU', components: ['qu', 'i', 'z'],        lessons: { 'qu': [32], 'i': [8], 'z': [34] } },
        { word: 'FOX',  number: 10, primaryComponent: 'X',  components: ['f', 'o', 'x'],         lessons: { 'f': [7], 'o': [12], 'x': [31] } },
        { word: 'LET',  number: 11, primaryComponent: 'L',  components: ['l', 'e', 't'],         lessons: { 'l': [26], 'e': [18], 't': [4] } },
        { word: 'YUM',  number: 12, primaryComponent: 'Y',  components: ['y', 'u', 'm'],         lessons: { 'y': [30], 'u': [15], 'm': [2] } },
        { word: 'WIG',  number: 13, primaryComponent: 'W',  components: ['w', 'i', 'g'],         lessons: { 'w': [28], 'i': [8], 'g': [16] } },
        { word: 'RUN',  number: 14, primaryComponent: 'R',  components: ['r', 'u', 'n'],         lessons: { 'r': [24], 'u': [15], 'n': [9] } },
        { word: 'VET',  number: 15, primaryComponent: 'V',  components: ['v', 'e', 't'],         lessons: { 'v': [33], 'e': [18], 't': [4] } },
        { word: 'JOG',  number: 16, primaryComponent: 'J',  components: ['j', 'o', 'g'],         lessons: { 'j': [29], 'o': [12], 'g': [16] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 2: Blends (Lessons 25, 27)
    // ─────────────────────────────────────────────────────────────
    blends: {
      name: 'Blends',
      gradeRanges: [0, 1, 2],
      words: [
        { word: 'BRICK',  number: 1,  primaryComponent: 'BR', components: ['br'], lessons: { 'br': [25] } },
        { word: 'CREEK',  number: 2,  primaryComponent: 'CR', components: ['cr'], lessons: { 'cr': [25] } },
        { word: 'DRIVE',  number: 3,  primaryComponent: 'DR', components: ['dr'], lessons: { 'dr': [25] } },
        { word: 'FROG',   number: 4,  primaryComponent: 'FR', components: ['fr'], lessons: { 'fr': [25] } },
        { word: 'GREEN',  number: 5,  primaryComponent: 'GR', components: ['gr'], lessons: { 'gr': [25] } },
        { word: 'PRETTY', number: 6,  primaryComponent: 'PR', components: ['pr'], lessons: { 'pr': [25] } },
        { word: 'TRUCK',  number: 7,  primaryComponent: 'TR', components: ['tr'], lessons: { 'tr': [25] } },
        { word: 'BLACK',  number: 8,  primaryComponent: 'BL', components: ['bl'], lessons: { 'bl': [27] } },
        { word: 'CLIP',   number: 9,  primaryComponent: 'CL', components: ['cl'], lessons: { 'cl': [27] } },
        { word: 'FLOP',   number: 10, primaryComponent: 'FL', components: ['fl'], lessons: { 'fl': [27] } },
        { word: 'GLUM',   number: 11, primaryComponent: 'GL', components: ['gl'], lessons: { 'gl': [27] } },
        { word: 'PLUG',   number: 12, primaryComponent: 'PL', components: ['pl'], lessons: { 'pl': [27] } },
        { word: 'SLOW',   number: 13, primaryComponent: 'SL', components: ['sl'], lessons: { 'sl': [27] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 3: Digraphs (Lessons 42-52)
    // ─────────────────────────────────────────────────────────────
    digraphs: {
      name: 'Digraphs',
      gradeRanges: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'JAZZ',          number: 1,  primaryComponent: 'ZZ', components: ['j', 'a', 'zz', 'z'], lessons: { 'j': [29], 'a': [1], 'z': [34], 'zz': [42] } },
        { word: 'DRESS',         number: 2,  primaryComponent: 'SS', components: ['dr', 'e', 'ss'],     lessons: { 'dr': [25], 'e': [18], 'ss': [42] } },
        { word: 'SPILL',         number: 3,  primaryComponent: 'LL', components: ['i', 'll'],            lessons: { 'i': [8], 'll': [42] } },
        { word: 'OFF',           number: 4,  primaryComponent: 'FF', components: ['o', 'ff'],            lessons: { 'o': [12], 'ff': [42] } },
        { word: 'ALL',           number: 5,  primaryComponent: 'ALL', components: ['all'],               lessons: { 'all': [43] } },
        { word: 'LUNCH',         number: 6,  primaryComponent: 'CH', components: ['l', 'u', 'ch'],       lessons: { 'l': [26], 'u': [15], 'ch': [48] } },
        { word: 'THIN',          number: 7,  primaryComponent: 'TH', components: ['th', 'n'],            lessons: { 'th': [46], 'n': [9] } },
        { word: 'THEM',          number: 8,  primaryComponent: 'TH', components: ['th'],                 lessons: { 'th': [47] } },
        { word: 'SH (in shock)', number: 9,  primaryComponent: 'SH', components: ['sh'],                 lessons: { 'sh': [45] } },
        { word: 'CK (in shock)', number: 10, primaryComponent: 'CK', components: ['ck'],                 lessons: { 'ck': [44] } },
        { word: 'WHEN',          number: 11, primaryComponent: 'WH', components: ['wh'],                 lessons: { 'wh': [50] } },
        { word: 'GRAPH',         number: 12, primaryComponent: 'PH', components: ['ph'],                 lessons: { 'ph': [50] } },
        { word: 'PING',          number: 13, primaryComponent: 'NG', components: ['p', 'ng'],            lessons: { 'p': [6], 'ng': [51] } },
        { word: 'FANG',          number: 14, primaryComponent: 'NG', components: ['f', 'ng'],            lessons: { 'f': [7], 'ng': [51] } },
        { word: 'RINK',          number: 15, primaryComponent: 'NK', components: ['r', 'nk'],            lessons: { 'r': [24], 'nk': [52] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 4: VCE / Vowel-Consonant-E (Lessons 54-61)
    // ─────────────────────────────────────────────────────────────
    vce: {
      name: 'VCE (Vowel-Consonant-E)',
      gradeRanges: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'PHONE', number: 1, primaryComponent: 'O_E', components: ['o_e'],        lessons: { 'o_e': [56] } },
        { word: 'GRAPE', number: 2, primaryComponent: 'A_E', components: ['a_e'],        lessons: { 'a_e': [54] } },
        { word: 'QUITE', number: 3, primaryComponent: 'I_E', components: ['qu', 'i_e'],  lessons: { 'qu': [32], 'i_e': [55] } },
        { word: 'THESE', number: 4, primaryComponent: 'E_E', components: ['e_e'],        lessons: { 'e_e': [57] } },
        { word: 'MUTE',  number: 5, primaryComponent: 'U_E', components: ['m', 'u_e'],   lessons: { 'm': [2], 'u_e': [58] } },
        { word: 'DUNE',  number: 6, primaryComponent: 'U_E', components: ['d', 'u_e'],   lessons: { 'd': [13], 'u_e': [58] } },
        { word: 'ICE',   number: 7, primaryComponent: 'CE',  components: ['ce'],         lessons: { 'ce': [60] } },
        { word: 'PAGE',  number: 8, primaryComponent: 'GE',  components: ['ge'],         lessons: { 'ge': [61] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 5: Reading Longer Words (Lessons 63-68)
    // ─────────────────────────────────────────────────────────────
    reading_longer_words: {
      name: 'Reading Longer Words',
      gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'BENCHES',  number: 1, primaryComponent: 'ES',       components: ['es'],           lessons: { 'es': [63] } },
        { word: 'YELLED',   number: 2, primaryComponent: 'ED',       components: ['ed'],           lessons: { 'ed': [64] } },
        { word: 'JUMPED',   number: 3, primaryComponent: 'ED',       components: ['ed'],           lessons: { 'ed': [64] } },
        { word: 'BLASTED',  number: 4, primaryComponent: 'ED',       components: ['bl', 'ed'],     lessons: { 'bl': [27], 'ed': [64] } },
        { word: 'BOXING',   number: 5, primaryComponent: 'ING',      components: ['x', 'ing'],     lessons: { 'x': [31], 'ing': [65] } },
        { word: 'SNAPSHOT', number: 6, primaryComponent: 'SNAPSHOT', components: ['snap', 'shot'], lessons: { 'snap': [66], 'shot': [66] } },
        { word: 'ABSENT',   number: 7, primaryComponent: 'ABSENT',   components: ['ab', 'sent'],   lessons: { 'ab': [67], 'sent': [67] } },
        { word: 'CUPID',    number: 8, primaryComponent: 'CUPID',    components: ['cu', 'pid'],    lessons: { 'cu': [68], 'pid': [68] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 6: Ending Spelling Patterns (Lessons 69-75)
    // ─────────────────────────────────────────────────────────────
    ending_spelling_patterns: {
      name: 'Ending Spelling Patterns',
      gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'SWITCH', number: 1,  primaryComponent: 'TCH',    components: ['w', 'tch'],         lessons: { 'w': [28], 'tch': [69] } },
        { word: 'PLEDGE', number: 2,  primaryComponent: 'DGE',    components: ['pl', 'dge'],         lessons: { 'pl': [27], 'dge': [70] } },
        { word: 'CHILD',  number: 3,  primaryComponent: 'ILD',    components: ['ild'],               lessons: { 'ild': [72] } },
        { word: 'BLIND',  number: 4,  primaryComponent: 'IND',    components: ['bl', 'ind'],         lessons: { 'bl': [27], 'ind': [72] } },
        { word: 'VOLT',   number: 5,  primaryComponent: 'OLT',    components: ['v', 'olt'],          lessons: { 'v': [33], 'olt': [72] } },
        { word: 'POST',   number: 6,  primaryComponent: 'OST',    components: ['p', 'ost'],          lessons: { 'p': [6], 'ost': [72] } },
        { word: 'GOLD',   number: 7,  primaryComponent: 'OLD',    components: ['g', 'old'],          lessons: { 'g': [16], 'old': [72] } },
        { word: 'TRY',    number: 8,  primaryComponent: 'Y_AS_I', components: ['tr', 'y'],           lessons: { 'tr': [25], 'y': [74] } },
        { word: 'TABLE',  number: 9,  primaryComponent: 'LE',     components: ['t', 'a', 'ble'],     lessons: { 't': [4], 'a': [1], 'ble': [75] } },
        { word: 'SAMPLE', number: 10, primaryComponent: 'LE',     components: ['s', 'am', 'ple'],    lessons: { 's': [3], 'am': [11], 'ple': [75] } },
        { word: 'CANDY',  number: 11, primaryComponent: 'Y_AS_E', components: ['y'],                 lessons: { 'y': [73] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 7: R-Controlled Vowels (Lessons 77-82)
    // ─────────────────────────────────────────────────────────────
    r_controlled_vowels: {
      name: 'R-Controlled Vowels',
      gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'CART',  number: 1, primaryComponent: 'AR', components: ['c', 'ar'],      lessons: { 'c': [14], 'ar': [77] } },
        { word: 'PORT',  number: 2, primaryComponent: 'OR', components: ['or'],           lessons: { 'or': [78] } },
        { word: 'CLERK', number: 3, primaryComponent: 'ER', components: ['cl', 'er'],     lessons: { 'cl': [27], 'er': [80] } },
        { word: 'BIRDS', number: 4, primaryComponent: 'IR', components: ['b', 'ir', 's'], lessons: { 'b': [17], 'ir': [81], 's': [21] } },
        { word: 'HURT',  number: 5, primaryComponent: 'UR', components: ['h', 'ur'],      lessons: { 'h': [23], 'ur': [82] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 8: Long Vowel Teams (Lessons 84-87)
    // ─────────────────────────────────────────────────────────────
    long_vowel_teams: {
      name: 'Long Vowel Teams',
      gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'PAINT',              number: 1,  primaryComponent: 'AI',  components: ['ai'],        lessons: { 'ai': [84] } },
        { word: 'SWAY',               number: 2,  primaryComponent: 'AY',  components: ['ay'],        lessons: { 'ay': [84] } },
        { word: 'AI (in railway)',     number: 3,  primaryComponent: 'AI',  components: ['ai'],        lessons: { 'ai': [84] } },
        { word: 'AY (in railway)',     number: 4,  primaryComponent: 'AY',  components: ['ay'],        lessons: { 'ay': [84] } },
        { word: 'GREET',              number: 5,  primaryComponent: 'EE',  components: ['gr', 'ee'],  lessons: { 'gr': [25], 'ee': [85] } },
        { word: 'BLEACH',             number: 6,  primaryComponent: 'EA',  components: ['ea'],        lessons: { 'ea': [85] } },
        { word: 'KIDNEY',             number: 7,  primaryComponent: 'EY',  components: ['k', 'ey'],   lessons: { 'k': [22], 'ey': [84] } },
        { word: 'THROAT',             number: 8,  primaryComponent: 'OA',  components: ['oa'],        lessons: { 'oa': [86] } },
        { word: 'GROW',               number: 9,  primaryComponent: 'OW',  components: ['ow'],        lessons: { 'ow': [86] } },
        { word: 'TOE',                number: 10, primaryComponent: 'OE',  components: ['oe'],        lessons: { 'oe': [86] } },
        { word: 'LIFEBOAT',           number: 11, primaryComponent: 'OA',  components: ['oa'],        lessons: { 'oa': [86] } },
        { word: 'LIE',                number: 12, primaryComponent: 'IE',  components: ['ie'],        lessons: { 'ie': [87] } },
        { word: 'BRIGHT',             number: 13, primaryComponent: 'IGH', components: ['br', 'igh'], lessons: { 'br': [25], 'igh': [87] } },
        { word: 'INSIGHT',            number: 14, primaryComponent: 'IGH', components: ['igh'],       lessons: { 'igh': [87] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 9: Other Vowel Teams (Lessons 89-94)
    // ─────────────────────────────────────────────────────────────
    other_vowel_teams: {
      name: 'Other Vowel Teams',
      gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'COOK',   number: 1,  primaryComponent: 'OO',   components: ['oo'],        lessons: { 'oo': [89] } },
        { word: 'PUSH',   number: 2,  primaryComponent: 'U',    components: ['u'],         lessons: { 'u': [89] } },
        { word: 'MOON',   number: 3,  primaryComponent: 'OO',   components: ['oo'],        lessons: { 'oo': [90] } },
        { word: 'CHEW',   number: 4,  primaryComponent: 'EW',   components: ['ew'],        lessons: { 'ew': [91] } },
        { word: 'FRUIT',  number: 5,  primaryComponent: 'UI',   components: ['ui'],        lessons: { 'ui': [91] } },
        { word: 'GLUE',   number: 6,  primaryComponent: 'UE',   components: ['gl', 'ue'],  lessons: { 'gl': [27], 'ue': [91] } },
        { word: 'CLAW',   number: 7,  primaryComponent: 'AW',   components: ['aw'],        lessons: { 'aw': [93] } },
        { word: 'GAUZE',  number: 8,  primaryComponent: 'AU',   components: ['au'],        lessons: { 'au': [93] } },
        { word: 'CAUGHT', number: 9,  primaryComponent: 'AUGH', components: ['augh'],      lessons: { 'augh': [93] } },
        { word: 'DREAD',  number: 10, primaryComponent: 'EA',   components: ['dr', 'ea'],  lessons: { 'dr': [25], 'ea': [94] } },
        { word: 'SWAN',   number: 11, primaryComponent: 'A',    components: ['a', 's'],    lessons: { 'a': [94], 's': [20] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 10: Diphthongs (Lessons 95-96)
    // ─────────────────────────────────────────────────────────────
    diphthongs: {
      name: 'Diphthongs',
      gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'JOIN',  number: 1, primaryComponent: 'OI', components: ['oi'], lessons: { 'oi': [95] } },
        { word: 'JOY',   number: 2, primaryComponent: 'OY', components: ['oy'], lessons: { 'oy': [95] } },
        { word: 'SHOUT', number: 3, primaryComponent: 'OU', components: ['ou'], lessons: { 'ou': [96] } },
        { word: 'PLOW',  number: 4, primaryComponent: 'OW', components: ['ow'], lessons: { 'ow': [96] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 11: Silent Letters (Lesson 98)
    // ─────────────────────────────────────────────────────────────
    silent_letters: {
      name: 'Silent Letters',
      gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'KNEE',  number: 1, primaryComponent: 'KN', components: ['kn'], lessons: { 'kn': [98] } },
        { word: 'WRITE', number: 2, primaryComponent: 'WR', components: ['wr'], lessons: { 'wr': [98] } },
        { word: 'CLIMB', number: 3, primaryComponent: 'MB', components: ['mb'], lessons: { 'mb': [98] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 12: Suffixes & Prefixes (Lessons 99-105)
    // ─────────────────────────────────────────────────────────────
    suffixes_prefixes: {
      name: 'Suffixes & Prefixes',
      gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'CATS',    number: 1,  primaryComponent: '-S',    components: ['s'],    lessons: { 's': [99] } },
        { word: 'BUNCHES', number: 2,  primaryComponent: '-ES',   components: ['es'],   lessons: { 'es': [99] } },
        { word: 'FASTER',  number: 3,  primaryComponent: '-ER',   components: ['er'],   lessons: { 'er': [100] } },
        { word: 'COLDEST', number: 4,  primaryComponent: '-EST',  components: ['est'],  lessons: { 'est': [100] } },
        { word: 'SADLY',   number: 5,  primaryComponent: '-LY',   components: ['ly'],   lessons: { 'ly': [101] } },
        { word: 'UNPACK',  number: 6,  primaryComponent: 'UN-',   components: ['un'],   lessons: { 'un': [103] } },
        { word: 'ENDLESS', number: 7,  primaryComponent: '-LESS', components: ['less'], lessons: { 'less': [102] } },
        { word: 'HELPFUL', number: 8,  primaryComponent: '-FUL',  components: ['ful'],  lessons: { 'ful': [102] } },
        { word: 'UNKIND',  number: 9,  primaryComponent: 'UN-',   components: ['un'],   lessons: { 'un': [103] } },
        { word: 'PREMADE', number: 10, primaryComponent: 'PRE-',  components: ['pre'],  lessons: { 'pre': [104] } },
        { word: 'RERUN',   number: 11, primaryComponent: 'RE-',   components: ['re'],   lessons: { 're': [104] } },
        { word: 'DISLIKE', number: 12, primaryComponent: 'DIS-',  components: ['dis'],  lessons: { 'dis': [105] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 13: Suffix Spelling Changes (Lessons 107-110)
    // ─────────────────────────────────────────────────────────────
    suffix_spelling_changes: {
      name: 'Suffix Spelling Changes',
      gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'SLAPPED',  number: 1,  primaryComponent: 'PP and ED',  components: ['pp', 'ed'],   lessons: { 'pp': [107], 'ed': [107] } },
        { word: 'DROPPING', number: 2,  primaryComponent: 'PP and ING', components: ['pp', 'ing'],  lessons: { 'pp': [107], 'ing': [107] } },
        { word: 'THINNER',  number: 3,  primaryComponent: 'NN and ER',  components: ['nn', 'er'],   lessons: { 'nn': [108], 'er': [108] } },
        { word: 'MADDEST',  number: 4,  primaryComponent: 'DD and EST', components: ['dd', 'est'],  lessons: { 'dd': [108], 'est': [108] } },
        { word: 'BRAVER',   number: 5,  primaryComponent: 'ADD -ER',    components: ['er'],         lessons: { 'er': [100] } },
        { word: 'CUTEST',   number: 6,  primaryComponent: 'ADD -EST',   components: ['est'],        lessons: { 'est': [100] } },
        { word: 'FADED',    number: 7,  primaryComponent: 'ADD -ED',    components: ['ed'],         lessons: { 'ed': [107] } },
        { word: 'HOPING',   number: 8,  primaryComponent: 'DROP E',     components: ['ing'],        lessons: { 'ing': [109] } },
        { word: 'CARRIED',  number: 9,  primaryComponent: 'Y>IED',      components: ['ied'],        lessons: { 'ied': [110] } },
        { word: 'CRIES',    number: 10, primaryComponent: 'Y>IES',      components: ['y>ies'],      lessons: { 'y>ies': [110] } },
        { word: 'BABIES',   number: 11, primaryComponent: 'Y>IES',      components: ['y>ies'],      lessons: { 'y>ies': [110] } },
        { word: 'HANDIER',  number: 12, primaryComponent: 'Y>IER',      components: ['y>ier'],      lessons: { 'y>ier': [110] } },
        { word: 'LAZIEST',  number: 13, primaryComponent: 'Y>IEST',     components: ['y>iest'],     lessons: { 'y>iest': [110] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 14: Low Frequency Spellings (Lessons 111-118)
    // ─────────────────────────────────────────────────────────────
    low_frequency_spellings: {
      name: 'Low Frequency Spellings',
      gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'BEGGAR', number: 1,  primaryComponent: 'AR',   components: ['ar'],   lessons: { 'ar': [111] } },
        { word: 'ACTOR',  number: 2,  primaryComponent: 'OR',   components: ['or'],   lessons: { 'or': [111] } },
        { word: 'HAIR',   number: 3,  primaryComponent: 'AIR',  components: ['air'],  lessons: { 'air': [112] } },
        { word: 'DARE',   number: 4,  primaryComponent: 'ARE',  components: ['are'],  lessons: { 'are': [112] } },
        { word: 'PEAR',   number: 5,  primaryComponent: 'EAR',  components: ['ear'],  lessons: { 'ear': [112] } },
        { word: 'CLEAR',  number: 6,  primaryComponent: 'EAR',  components: ['ear'],  lessons: { 'ear': [113] } },
        { word: 'VEIN',   number: 7,  primaryComponent: 'EI',   components: ['ei'],   lessons: { 'ei': [114] } },
        { word: 'OBEY',   number: 8,  primaryComponent: 'EY',   components: ['ey'],   lessons: { 'ey': [114] } },
        { word: 'EIGHT',  number: 9,  primaryComponent: 'EIGH', components: ['eigh'], lessons: { 'eigh': [114] } },
        { word: 'STEAK',  number: 10, primaryComponent: 'EA',   components: ['ea'],   lessons: { 'ea': [114] } },
        { word: 'FEW',    number: 11, primaryComponent: 'EW',   components: ['ew'],   lessons: { 'ew': [115] } },
        { word: 'FEUD',   number: 12, primaryComponent: 'EU',   components: ['eu'],   lessons: { 'eu': [115] } },
        { word: 'VALUE',  number: 13, primaryComponent: 'UE',   components: ['ue'],   lessons: { 'ue': [115] } },
        { word: 'OUGHT',  number: 14, primaryComponent: 'OUGH', components: ['ough'], lessons: { 'ough': [116] } },
        { word: 'DOUGH',  number: 15, primaryComponent: 'OUGH', components: ['ough'], lessons: { 'ough': [116] } },
        { word: 'CENTER', number: 16, primaryComponent: 'C',    components: ['c'],    lessons: { 'c': [117] } },
        { word: 'AGENT',  number: 17, primaryComponent: 'G',    components: ['g'],    lessons: { 'g': [117] } },
        { word: 'GNAT',   number: 18, primaryComponent: 'GN',   components: ['gn'],   lessons: { 'gn': [118] } },
        { word: 'GHOST',  number: 19, primaryComponent: 'GH',   components: ['gh'],   lessons: { 'gh': [118] } },
        { word: 'CHEF',   number: 20, primaryComponent: 'CH',   components: ['ch'],   lessons: { 'ch': [118] } },
        { word: 'ECHO',   number: 21, primaryComponent: 'CH',   components: ['ch'],   lessons: { 'ch': [118] } },
        { word: 'CASTLE', number: 22, primaryComponent: 'T',    components: ['t'],    lessons: { 't': [118] } }
      ]
    },

    // ─────────────────────────────────────────────────────────────
    // SECTION 15: Additional Affixes (Lessons 119-127)
    // ─────────────────────────────────────────────────────────────
    additional_affixes: {
      name: 'Additional Affixes',
      gradeRanges: [1, 2, 3, 4, 5, 6, 7, 8],
      words: [
        { word: 'INVASION',  number: 1,  primaryComponent: '-SION',  components: ['sion'], lessons: { 'sion': [119] } },
        { word: 'OPTION',    number: 2,  primaryComponent: '-TION',  components: ['tion'], lessons: { 'tion': [119] } },
        { word: 'NATURE',    number: 3,  primaryComponent: '-TURE',  components: ['ture'], lessons: { 'ture': [120] } },
        { word: 'FIGHTER',   number: 4,  primaryComponent: '-ER',    components: ['er'],   lessons: { 'er': [121] } },
        { word: 'DIRECTOR',  number: 5,  primaryComponent: '-OR',    components: ['or'],   lessons: { 'or': [121] } },
        { word: 'ARTIST',    number: 6,  primaryComponent: '-IST',   components: ['ist'],  lessons: { 'ist': [121] } },
        { word: 'DARKISH',   number: 7,  primaryComponent: '-ISH',   components: ['ish'],  lessons: { 'ish': [122] } },
        { word: 'SANDY',     number: 8,  primaryComponent: '-Y',     components: ['y'],    lessons: { 'y': [123] } },
        { word: 'REDNESS',   number: 9,  primaryComponent: '-NESS',  components: ['ness'], lessons: { 'ness': [124] } },
        { word: 'PAVEMENT',  number: 10, primaryComponent: '-MENT',  components: ['ment'], lessons: { 'ment': [125] } },
        { word: 'FIXABLE',   number: 11, primaryComponent: '-ABLE',  components: ['able'], lessons: { 'able': [126] } },
        { word: 'FLEXIBLE',  number: 12, primaryComponent: '-IBLE',  components: ['ible'], lessons: { 'ible': [126] } },
        { word: 'UNICORN',   number: 13, primaryComponent: 'UNI-',   components: ['uni'],  lessons: { 'uni': [127] } },
        { word: 'BISECT',    number: 14, primaryComponent: 'BI-',    components: ['bi'],   lessons: { 'bi': [127] } },
        { word: 'TRIGRAPH',  number: 15, primaryComponent: 'TRI-',   components: ['tri'],  lessons: { 'tri': [127] } }
      ]
    }
  };
}


/**
 * Returns grade-filtered assessment sections with components normalized to
 * { name, lessons } objects — the shape expected by AssessmentEngine.gs and
 * assessmentform.html.
 *
 * WHY NORMALIZATION HAPPENS HERE (not in getAllSectionsData):
 *   getAllSectionsData() stores components as plain strings alongside a parallel
 *   word.lessons lookup object. That's fine for human readability and data entry.
 *   But the HTML form renders buttons from word.components and must know each
 *   component's lesson numbers at render time — it cannot do a reliable key
 *   lookup against word.lessons because key casing may not always match.
 *   Normalizing here, on the server, gives the client a clean { name, lessons }
 *   object per component so no lookup is needed.
 *
 * SIMPLIFICATION RULE (Grades 1–2, non-foundational sections):
 *   Reduces each word to a single button for its primaryComponent, except for
 *   compound/multi-syllable words in DO_NOT_SIMPLIFY. This prevents overwhelming
 *   G1–2 scorers with sub-component detail on complex pattern words.
 *
 * @param {number|string} grade - Student's grade level (0 or 'KG'/'K' = Kindergarten)
 * @param {boolean} isKindergartenEndOfYear - If true, adds Digraphs & VCE for KG
 * @returns {Array<Object>} Sections with words.components as { name, lessons }[] objects
 */
function getAssessmentSections(grade, isKindergartenEndOfYear) {
  try {
    // Normalize grade to integer. Accepts "G2", "2nd", "2", "KG", "K", "0", etc.
    grade = String(grade).replace(/[^0-9KGkg]/g, '');
    if (grade.toUpperCase() === 'KG' || grade.toUpperCase() === 'K') {
      grade = 0;
    } else {
      grade = parseInt(grade) || 0;
    }

    // Deep clone to avoid mutating the master data on repeated calls
    const allSections = JSON.parse(JSON.stringify(getAllSectionsData()));
    const sectionsToShow = [];

    // These primaryComponent values represent multi-syllable/compound words that
    // should never be reduced to a single button even on the simplified G1–2 form.
    const DO_NOT_SIMPLIFY = new Set([
      'COMPOUND', 'TWO_SYLLABLE', 'OPEN_SYLLABLE',
      'SNAPSHOT', 'ABSENT', 'CUPID'
    ]);

    const shouldSimplify = (grade === 1 || grade === 2);

    for (const key in allSections) {
      const section = allSections[key];

      // Skip sections not in this grade's range
      if (!section.gradeRanges.includes(grade)) continue;

      const isFoundational = (key === 'alphabet_consonants' || key === 'blends');

      // ─── Grade 1–2 simplification ──────────────────────────────
      // Foundational sections (Alphabet, Blends) always show all components.
      // Non-foundational sections are reduced to the primaryComponent button only,
      // unless the word is in DO_NOT_SIMPLIFY (compound/multi-syllable words that
      // need their syllable breakdown preserved for diagnostic value).
      if (shouldSimplify && !isFoundational) {
        section.words.forEach(word => {
          if (!DO_NOT_SIMPLIFY.has(word.primaryComponent)) {
            // Reduce to a single component name string; normalization below
            // will resolve its lesson numbers from word.lessons.
            word.components = [word.primaryComponent.toLowerCase()];
          }
        });
      }

      // ─── BUG FIX: Normalize components to { name, lessons } objects ────
      // Previously, word.components was sent to the client as a plain string
      // array. The HTML form then did word.lessons[c] at render time to find
      // lesson numbers. This lookup failed silently (|| [] fallback) whenever
      // key casing didn't match exactly — causing Sections 3–15 to record zero
      // lesson results on submission.
      //
      // Fix: resolve lesson numbers here on the server before sending to client.
      // The client never needs to touch word.lessons — it only sees normalized
      // { name, lessons } objects.
      section.words.forEach(word => {
        word.components = word.components.map(compName => ({
          name: compName,
          // Try exact key first, then uppercase fallback for primaryComponents
          // that may have been lowercased during simplification (e.g. 'ch' vs 'CH').
          lessons: word.lessons[compName] ||
                   word.lessons[compName.toUpperCase()] ||
                   []
        }));
        // Remove the raw lessons lookup object — client doesn't need it and
        // sending it would just add payload weight.
        delete word.lessons;
      });

      // ─── Kindergarten section filtering ────────────────────────
      if (grade === 0) {
        // Standard KG: Alphabet + Blends only.
        // EOY KG: also include Digraphs and VCE.
        if (isFoundational || (isKindergartenEndOfYear && (key === 'digraphs' || key === 'vce'))) {
          sectionsToShow.push(section);
        }
      } else {
        sectionsToShow.push(section);
      }
    }

    return sectionsToShow;

  } catch (error) {
    console.error('Error getting assessment sections:', error);
    return [];
  }
}
