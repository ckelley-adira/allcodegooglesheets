// ═══════════════════════════════════════════════════════════════════════════
// SHARED CONSTANTS - UFLI SYSTEM (ALL SCHOOLS)
// ═══════════════════════════════════════════════════════════════════════════
// Version: 1.0
// Last Updated: February 2026
//
// PURPOSE:
// This module contains business-rule constants that are identical across all
// schools (Adelante, Allegiant, CCA, CHAW, GlobalPrep, Sankofa).
//
// CONSTANTS INCLUDED:
// - LESSON_LABELS: All 128 UFLI lesson labels (L1-L128)
// - SKILL_SECTIONS: 16 skill sections mapping to lesson number arrays
// - REVIEW_LESSONS: 23 review lesson numbers that act as "gateway tests"
// - PERFORMANCE_THRESHOLDS: Score thresholds for performance status
// - STATUS_LABELS: Performance status text labels
//
// USAGE:
// School-specific Phase2_ProgressTracking.gs files import these constants
// instead of defining them locally. This ensures consistency and makes
// updates easier.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// LESSON LABELS - All 128 UFLI Lesson Labels
// ═══════════════════════════════════════════════════════════════════════════

const LESSON_LABELS = {
  1: "UFLI L1 a/ā/", 2: "UFLI L2 m/m/", 3: "UFLI L3 s/s/", 4: "UFLI L4 t/t/",
  5: "UFLI L5 VC&CVC Words", 6: "UFLI L6 p/p/", 7: "UFLI L7 f/f/", 8: "UFLI L8 i/ī/",
  9: "UFLI L9 n/n/", 10: "UFLI L10 CVC Practice (a, i)", 11: "UFLI L11 Nasalized A (am, an)",
  12: "UFLI L12 o/ō/", 13: "UFLI L13 d/d/", 14: "UFLI L14 c/k/", 15: "UFLI L15 u/ū/",
  16: "UFLI L16 g/g/", 17: "UFLI L17 b/b/", 18: "UFLI L18 e/ē/", 19: "UFLI L19 VC & CVC practice (all)",
  20: "UFLI L20 -s/s/", 21: "UFLI L21 -s/z/", 22: "UFLI L22 k/k/", 23: "UFLI L23 h/h/",
  24: "UFLI L24 r/r / part 1", 25: "UFLI L25 r/r / part 2", 26: "UFLI L26 l/l / part 1",
  27: "UFLI L27 l/l / part 2, al", 28: "UFLI L28 w/w/", 29: "UFLI L29 j/j/", 30: "UFLI L30 y/y/",
  31: "UFLI L31 x/ks/", 32: "UFLI L32 qu/kw/", 33: "UFLI L33 v/v/", 34: "UFLI L34 z/z/",
  35: "UFLI L35 Short A Review (inclu. Nasalized A)", 36: "UFLI L36 Short I Review",
  37: "UFLI L37 Short O Review", 38: "UFLI L38 Short A, I, O Review", 39: "UFLI L39 Short U Review",
  40: "UFLI L40 Short E Review", 41: "UFLI L41 Short Vowels Review (all)",
  42: "UFLI L42 FLSZ spelling rule (ff, ll, ss, zz)", 43: "UFLI L43 -all, -oll, -ull",
  44: "UFLI L44 ck/k/", 45: "UFLI L45 sh/sh/", 46: "UFLI L46 Voiced th / th/",
  47: "UFLI L47 Unvoiced th /th", 48: "UFLI L48 ch/ch/", 49: "UFLI L49 Digraphs Review 1",
  50: "UFLI L50 wh/w/ph/f/", 51: "UFLI L51 ng/n/", 52: "UFLI L52 nk/nk/",
  53: "UFLI L53 Digraphs Review 2 (incl. CCCVC)", 54: "UFLI L54 a_e/ā/", 55: "UFLI L55 i_e/ī/",
  56: "UFLI L56 o_e/ō/", 57: "UFLI L57 VCe Review 1, e_e/ē/", 58: "UFLI L58 u_e/ū/yū/",
  59: "UFLI L59 VCe Review 2 (all)", 60: "UFLI L60 _ce/s/", 61: "UFLI L61 _ge/j/",
  62: "UFLI L62 VCe Review 3, VCe exceptions", 63: "UFLI L63 -es", 64: "UFLI L64 -ed",
  65: "UFLI L65 -ing", 66: "UFLI L66 Closed & Open Syllables", 67: "UFLI L67 Closed/Closed",
  68: "UFLI L68 Open/Closed", 69: "UFLI L69 tch/ch/", 70: "UFLI L70 dge/j/",
  71: "UFLI L71 tch/ch/dge/j/Review", 72: "UFLI L72 Long VCC (-ild, -old, -ind, -olt, -ost)",
  73: "UFLI L73 y/ī/", 74: "UFLI L74 y/ē/", 75: "UFLI L75 -le", 76: "UFLI L76 Ending Patterns Review",
  77: "UFLI L77 ar/ar/", 78: "UFLI L78 or, ore/or/", 79: "UFLI L79 ar/ar/& or, ore/or/Review",
  80: "UFLI L80 er/er", 81: "UFLI L81 ir,ur/er/", 82: "UFLI L82 Spelling /er/:er, ir, ur, w + or",
  83: "UFLI L83 R-Controlled Vowels Review", 84: "UFLI L84 ai ay /ā/", 85: "UFLI L85 ee, ea, ey /ē/",
  86: "UFLI L86 oa, ow, oe /ō/", 87: "UFLI L87 ie, igh /ī/", 88: "UFLI L88 Vowel Teams Review 1",
  89: "UFLI L89 oo, u /oo/", 90: "UFLI L90 oo /ū/", 91: "UFLI L91 ew, ui, ue /ū/",
  92: "UFLI L92 Vowel Teams Review 2", 93: "UFLI L93 au, aw, augh /aw/", 94: "UFLI L94 ea/ē/, a/ō/",
  95: "UFLI L95 oi, oy /oi/", 96: "UFLI L96 ou, ow /ow/", 97: "UFLI L97 Vowel Teams & Dipthongs Review",
  98: "UFLI L98 kn/n/, wr/r/, mb /m/", 99: "UFLI L99 -s/-es", 100: "UFLI L100 -er/-est",
  101: "UFLI L101 -ly", 102: "UFLI L102 -less, -ful", 103: "UFLI L103 un-", 104: "UFLI L104 pre-, re-",
  105: "UFLI L105 dis-", 106: "UFLI L106 Affixes Review 1", 107: "UFLI L107 Doubling Rule -ed, ing",
  108: "UFLI L108 Doubling Rule -er, -est", 109: "UFLI L109 Drop -e Rule", 110: "UFLI L110 -y to I Rule",
  111: "UFLI L111 -ar, -or /er/", 112: "UFLI L112 air, are, ear /air/", 113: "UFLI L113 ear /ear/",
  114: "UFLI L114 Alternate /ā/ (ei, ey, eigh, aigh,e a)", 115: "UFLI L115 Alternate Long U (ew, eui, ue /yū/; ou/ū/)",
  116: "UFLI L116 ough /aw/, /ō/", 117: "UFLI L117 Signal Vowels (c /s/, g /j/)",
  118: "UFLI L118 ch/sh/, /k/; gn /n/ , gh /g/; silent t", 119: "UFLI L119 -sion, -tion",
  120: "UFLI L120 -ture", 121: "UFLI L121 -er, -or, -ist", 122: "UFLI L122 -ish",
  123: "UFLI L123 -y", 124: "UFLI L124 -ness", 125: "UFLI L125 -ment", 126: "UFLI L126 -able, -ible",
  127: "UFLI L127 uni-, bi-, tri-", 128: "UFLI L128 Affixes Review 2"
};

// ═══════════════════════════════════════════════════════════════════════════
// SKILL SECTIONS - 16 Skill Sections Mapping to Lesson Arrays
// ═══════════════════════════════════════════════════════════════════════════

const SKILL_SECTIONS = {
  'Single Consonants & Vowels': [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,26,28,29,30,31,32,33,34],
  'Blends': [25,27],
  'Alphabet Review & Longer Words': [35,36,37,38,39,40,41],
  'Digraphs': [42,43,44,45,46,47,48,49,50,51,52,53],
  'VCE': [54,55,56,57,58,59,60,61,62],
  'Reading Longer Words': [63,64,65,66,67,68],
  'Ending Spelling Patterns': [69,70,71,72,73,74,75,76],
  'R-Controlled Vowels': [77,78,79,80,81,82,83],
  'Long Vowel Teams': [84,85,86,87,88],
  'Other Vowel Teams': [89,90,91,92,93,94],
  'Diphthongs': [95,96,97],
  'Silent Letters': [98],
  'Suffixes & Prefixes': [99,100,101,102,103,104,105,106],
  'Suffix Spelling Changes': [107,108,109,110],
  'Low Frequency Spellings': [111,112,113,114,115,116,117,118],
  'Additional Affixes': [119,120,121,122,123,124,125,126,127,128]
};

// ═══════════════════════════════════════════════════════════════════════════
// REVIEW LESSONS - Gateway Tests (23 lessons)
// ═══════════════════════════════════════════════════════════════════════════
// Review lessons act as "gateway tests" - passing ALL review lessons in a
// section grants 100% credit for that section. If ANY review is populated
// but student fails any review, calculation falls back to non-review lessons.
// ═══════════════════════════════════════════════════════════════════════════

const REVIEW_LESSONS = [35,36,37,39,40,41,49,53,57,59,62,71,76,79,83,88,92,97,102,104,105,106,128];

// Set version for O(1) lookups (used by helper functions)
const REVIEW_LESSONS_SET = new Set(REVIEW_LESSONS);

// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE THRESHOLDS & STATUS LABELS
// ═══════════════════════════════════════════════════════════════════════════
// Centralized thresholds and labels for performance status across all schools.
// Used by Skills Tracker, Grade Summary, and School Summary sheets.
// ═══════════════════════════════════════════════════════════════════════════

const PERFORMANCE_THRESHOLDS = {
  ON_TRACK: 80,       // >= 80% = On Track
  NEEDS_SUPPORT: 50   // >= 50% = Needs Support, < 50% = Intervention
};

const STATUS_LABELS = {
  ON_TRACK: "On Track",
  NEEDS_SUPPORT: "Needs Support",
  INTERVENTION: "Intervention"
};

/**
 * Returns the performance status label based on percentage
 * @param {number} percentage - The score percentage (0-100)
 * @returns {string} Status label
 */
function getPerformanceStatus(percentage) {
  if (percentage >= PERFORMANCE_THRESHOLDS.ON_TRACK) return STATUS_LABELS.ON_TRACK;
  if (percentage >= PERFORMANCE_THRESHOLDS.NEEDS_SUPPORT) return STATUS_LABELS.NEEDS_SUPPORT;
  return STATUS_LABELS.INTERVENTION;
}
