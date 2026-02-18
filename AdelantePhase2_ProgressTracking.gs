// ═══════════════════════════════════════════════════════════════════════════
// UFLI MASTER SYSTEM - SYSTEM SHEETS (PHASE 2)
// Sheet Generation, Progress Tracking, Sync, and Pacing Engine
// ═══════════════════════════════════════════════════════════════════════════
// Version: 5.2 - WEIGHTED REVIEW LESSONS
// Last Updated: January 2026
//
// ARCHITECTURE:
// - SetupWizard_v3.gs owns: Config constants, menu, wizard, manage UI, reports, web app
// - This file owns: System constants, sheet generation, sync, pacing, repair
//
// MAJOR CHANGES v5.0:
// - Removed volatile spreadsheet formulas (INDIRECT, COUNTIF, MAXIFS)
// - Implemented "Big Gulp" pattern: Batch Read -> In-Memory Calc -> Batch Write
// - "Current Lesson" is now calculated in script and written as static text
// - Skills & Grade Summary percentages are calculated in script
// - Sync speed improved by ~90%
//
// CHANGES v5.1:
// - Fixed PreK duplicate entries (skip PreK in UFLI loop)
// - Fixed PreK metric mapping (Form→Foundational, Name+Sound→MinGrade, All→FullGrade)
// - Fixed PreK denominators to use fixed benchmark-style (26/52/78)
//
// CHANGES v5.2:
// - Added weighted review lesson logic for skill section calculations
// - Review lessons act as "gateway tests" - passing ALL grants 100% section credit
// - Logic: If ANY review populated → check if ALL passed → 100%, else non-review calc
// - If student fails any review, falls back to non-review lesson calculation
// - Initial Assessment excludes review lessons (they aren't assessed initially)
// - New function: calculateSectionPercentage(mapRow, sectionLessons, isInitialAssessment)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - SYSTEM SHEETS
// ═══════════════════════════════════════════════════════════════════════════

const SHEET_NAMES_V2 = {
  SMALL_GROUP_PROGRESS: "Small Group Progress",
  UFLI_MAP: "UFLI MAP",
  SKILLS: "Skills Tracker",
  GRADE_SUMMARY: "Grade Summary",
  INITIAL_ASSESSMENT: "Initial Assessment",
  SCHOOL_SUMMARY: "School Summary"
};

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - PRE-K (HANDWRITING WITHOUT TEARS)
// ═══════════════════════════════════════════════════════════════════════════

const SHEET_NAMES_PREK = {
  DATA: "Pre-K Data"
};

const PREK_CONFIG = {
  TOTAL_LETTERS: 26,
  HEADER_ROW: 5,
  DATA_START_ROW: 6,
  // Fixed denominators for benchmark-style calculations:
  FORM_DENOMINATOR: 26,        // 26 letters for Form (motor integration)
  NAME_SOUND_DENOMINATOR: 52,  // 26 Name + 26 Sound (literacy knowledge)
  FULL_DENOMINATOR: 78         // 26 Name + 26 Sound + 26 Form (K-readiness)
};

const SHEET_NAMES_PACING = {
  DASHBOARD: "Pacing Dashboard",
  LOG: "Pacing Log"
};

const LAYOUT = {
  DATA_START_ROW: 6,           // First row of actual data
  HEADER_ROW_COUNT: 5,         // Number of header rows
  LESSON_COLUMN_OFFSET: 5,     // Lessons start at column F (6), so offset is 5 (Index 5 in 0-based array)
  TOTAL_LESSONS: 128,          // Total number of UFLI lessons
  LESSONS_PER_GROUP_SHEET: 12, // Lesson columns per group sheet
  
  // Column indices (1-based for Sheet API, 0-based for Arrays)
  COL_STUDENT_NAME: 1,
  COL_GRADE: 2,
  COL_TEACHER: 3,
  COL_GROUP: 4,
  COL_CURRENT_LESSON: 5,
  COL_FIRST_LESSON: 6
};

// ═══════════════════════════════════════════════════════════════════════════
// SCHOOL BRANDING - Loaded from Site Configuration sheet
// ═══════════════════════════════════════════════════════════════════════════

// Cache for branding settings (loaded once per execution)
let _brandingCache = null;

/**
 * Clears the branding cache to force reload from config sheet
 * Call this after saving branding settings in the wizard
 */
function clearBrandingCache() {
  _brandingCache = null;
}

/**
 * Loads school branding from Site Configuration sheet
 * Falls back to defaults if not configured
 * @returns {Object} Branding settings
 */
function loadSchoolBranding() {
  if (_brandingCache) return _brandingCache;

  // Default values
  const defaults = {
    PRIMARY_COLOR: "#00838F",
    SECONDARY_COLOR: "#FFB300",
    LOGO_FILE_ID: ""
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName("Site Configuration");

    if (configSheet) {
      // Row 24: Primary Color, Row 25: Secondary Color, Row 26: Logo File ID
      const primaryColor = configSheet.getRange(24, 2).getValue();
      const secondaryColor = configSheet.getRange(25, 2).getValue();
      const logoFileId = configSheet.getRange(26, 2).getValue();

      _brandingCache = {
        PRIMARY_COLOR: primaryColor || defaults.PRIMARY_COLOR,
        SECONDARY_COLOR: secondaryColor || defaults.SECONDARY_COLOR,
        LOGO_FILE_ID: logoFileId || ""
      };
    } else {
      _brandingCache = defaults;
    }
  } catch (e) {
    Logger.log("Could not load branding: " + e.message);
    _brandingCache = defaults;
  }

  return _brandingCache;
}

/**
 * Helper to lighten a hex color
 * @param {string} hex - Hex color code (e.g., "#00838F")
 * @param {number} factor - Lightening factor (0-1)
 * @returns {string} Lightened hex color
 */
function lightenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

// SCHOOL_BRANDING object with lazy-loaded values from Site Configuration
const SCHOOL_BRANDING = {
  // Font settings (static)
  FONT_FAMILY: "Calibri",
  HEADER_FONT_SIZE: 14,
  SUBHEADER_FONT_SIZE: 10,
  LOGO_WIDTH: 100,
  LOGO_HEIGHT: 50,

  // Dynamic getters that load from config sheet
  get PRIMARY_COLOR() { return loadSchoolBranding().PRIMARY_COLOR; },
  get SECONDARY_COLOR() { return loadSchoolBranding().SECONDARY_COLOR; },
  get LOGO_FILE_ID() { return loadSchoolBranding().LOGO_FILE_ID; },

  // Derived colors
  get HEADER_BG() { return this.PRIMARY_COLOR; },
  get HEADER_FG() { return "#FFFFFF"; },
  get TITLE_BG() { return lightenColor(this.PRIMARY_COLOR, 0.7); },
  get TITLE_FG() { return "#000000"; },
  get ACCENT_BG() { return this.SECONDARY_COLOR; }
};

const COLORS = {
  Y: "#d4edda",        // Light green - Yes/Pass
  N: "#f8d7da",        // Light red - No/Fail
  A: "#fff3cd",        // Light yellow - Absent
  // Use getters to ensure branding colors are loaded dynamically
  get HEADER_BG() { return SCHOOL_BRANDING.HEADER_BG; },
  get HEADER_FG() { return SCHOOL_BRANDING.HEADER_FG; },
  get TITLE_BG() { return SCHOOL_BRANDING.TITLE_BG; },
  get TITLE_FG() { return SCHOOL_BRANDING.TITLE_FG; },
  SUB_HEADER_BG: "#f8f9fa",
  PLACEHOLDER_FG: "#999999"
};

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

const REVIEW_LESSONS = [35,36,37,39,40,41,49,53,57,59,62,71,76,79,83,88,92,97,102,104,105,106,128];

// Set version for O(1) lookups (used by helpers below)
const REVIEW_LESSONS_SET = new Set(REVIEW_LESSONS);

// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE THRESHOLDS & STATUS LABELS (Centralized for easy replication)
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

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATION HELPER UTILITIES (Reduce code duplication)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets the column index for a lesson number
 * @param {number} lessonNum - Lesson number (1-128)
 * @returns {number} Array index (0-based)
 */
function getLessonColumnIndex(lessonNum) {
  return LAYOUT.LESSON_COLUMN_OFFSET + lessonNum - 1;
}

/**
 * Gets normalized lesson status from a data row
 * @param {Array} row - Student row data
 * @param {number} lessonNum - Lesson number (1-128)
 * @returns {string} Uppercase status ('Y', 'N', 'A', or '')
 */
function getLessonStatus(row, lessonNum) {
  const idx = getLessonColumnIndex(lessonNum);
  if (idx >= row.length) return '';
  return (row[idx] ? row[idx].toString() : '').toUpperCase().trim();
}

/**
 * Checks if a lesson is a review lesson (O(1) lookup)
 * @param {number} lessonNum - Lesson number
 * @returns {boolean}
 */
function isReviewLesson(lessonNum) {
  return REVIEW_LESSONS_SET.has(lessonNum);
}

/**
 * Partitions lessons into review and non-review arrays (single pass)
 * @param {Array<number>} lessons - Array of lesson numbers
 * @returns {{reviews: Array<number>, nonReviews: Array<number>}}
 */
function partitionLessonsByReview(lessons) {
  const reviews = [];
  const nonReviews = [];
  for (const lesson of lessons) {
    if (REVIEW_LESSONS_SET.has(lesson)) {
      reviews.push(lesson);
    } else {
      nonReviews.push(lesson);
    }
  }
  return { reviews, nonReviews };
}

/**
 * Checks gateway status for a set of review lessons
 * Gateway passes if: at least one review is assigned (Y or N) AND all assigned reviews passed (Y)
 *
 * @param {Array} row - Student row data
 * @param {Array<number>} reviewLessons - Review lesson numbers to check
 * @returns {{assigned: boolean, allPassed: boolean, gatewayPassed: boolean}}
 */
function checkGateway(row, reviewLessons) {
  let assigned = false;
  let allPassed = true;

  for (const lessonNum of reviewLessons) {
    const status = getLessonStatus(row, lessonNum);
    if (status === 'Y') {
      assigned = true;
    } else if (status === 'N') {
      assigned = true;
      allPassed = false;
    }
    // Blank = not assigned, ignore for gateway check
  }

  return {
    assigned,
    allPassed,
    gatewayPassed: assigned && allPassed
  };
}

const FOUNDATIONAL_LESSONS = Array.from({length: 34}, (_, i) => i + 1);

// ═══════════════════════════════════════════════════════════════════════════
// MINIMUM GRADE LESSON ARRAYS (Updated January 2026)
// ═══════════════════════════════════════════════════════════════════════════

// G1 Minimum: Lessons 1-34 + Digraphs (42-53), excluding reviews
const G1_MINIMUM_LESSONS = (() => {
  const lessons = [];
  // Foundational: 1-34
  for (let i = 1; i <= 34; i++) lessons.push(i);
  // Digraphs: 42-53, excluding reviews 49, 53
  for (let i = 42; i <= 53; i++) {
    if (![49, 53].includes(i)) lessons.push(i);
  }
  return lessons;  // 34 + 10 = 44 lessons
})();

const G1_CURRENT_YEAR_LESSONS = (() => {
  const lessons = [];
  for (let i = 35; i <= 62; i++) {
    if (![49, 53, 57, 59, 62].includes(i)) lessons.push(i);
  }
  return lessons;
})();

// G2/G3 Minimum: Lessons 1-34 + Digraphs + VCE + RLW, excluding reviews
const G2_MINIMUM_LESSONS = (() => {
  const lessons = [];
  // Foundational: 1-34
  for (let i = 1; i <= 34; i++) lessons.push(i);
  // Digraphs: 42-53, excluding reviews 49, 53
  for (let i = 42; i <= 53; i++) {
    if (![49, 53].includes(i)) lessons.push(i);
  }
  // VCE: 54-62, excluding reviews 57, 59, 62
  for (let i = 54; i <= 62; i++) {
    if (![57, 59, 62].includes(i)) lessons.push(i);
  }
  // Reading Longer Words: 63-68 (no reviews)
  for (let i = 63; i <= 68; i++) lessons.push(i);
  return lessons;  // 34 + 10 + 6 + 6 = 56 lessons
})();

const G2_CURRENT_YEAR_LESSONS = (() => {
  const lessons = [38];
  for (let i = 63; i <= 83; i++) {
    if (![71, 76, 79, 83].includes(i)) lessons.push(i);
  }
  return lessons;
})();

// G4-G8 Minimum: Lessons 1-34 + 42-110, excluding only Alphabet Review section
const G4_MINIMUM_LESSONS = (() => {
  const lessons = [];
  // Foundational: 1-34
  for (let i = 1; i <= 34; i++) lessons.push(i);
  // Everything from 42-110 (includes review lessons)
  for (let i = 42; i <= 110; i++) lessons.push(i);
  return lessons;  // 34 + 69 = 103 lessons
})();

const ALL_NON_REVIEW_LESSONS = (() => {
  const lessons = [];
  for (let i = 1; i <= 128; i++) {
    if (!REVIEW_LESSONS.includes(i)) lessons.push(i);
  }
  return lessons;
})();

// ═══════════════════════════════════════════════════════════════════════════
// GRADE METRICS (Updated January 2026)
// ═══════════════════════════════════════════════════════════════════════════

const GRADE_METRICS = {
  'PreK': {
    foundational: { lessons: FOUNDATIONAL_LESSONS, denominator: 26 },
    minimum: { lessons: FOUNDATIONAL_LESSONS, denominator: 26 },
    currentYear: { lessons: FOUNDATIONAL_LESSONS, denominator: 26 }
  },
  'KG': {
    foundational: { lessons: FOUNDATIONAL_LESSONS, denominator: 34 },
    minimum: { lessons: FOUNDATIONAL_LESSONS, denominator: 34 },
    currentYear: { lessons: FOUNDATIONAL_LESSONS, denominator: 34 }
  },
  'G1': {
    foundational: { lessons: FOUNDATIONAL_LESSONS, denominator: 34 },
    minimum: { lessons: G1_MINIMUM_LESSONS, denominator: 44 },
    currentYear: { lessons: G1_CURRENT_YEAR_LESSONS, denominator: 23 }
  },
  'G2': {
    foundational: { lessons: FOUNDATIONAL_LESSONS, denominator: 34 },
    minimum: { lessons: G2_MINIMUM_LESSONS, denominator: 56 },
    currentYear: { lessons: G2_CURRENT_YEAR_LESSONS, denominator: 18 }
  },
  'G3': {
    foundational: { lessons: FOUNDATIONAL_LESSONS, denominator: 34 },
    minimum: { lessons: G2_MINIMUM_LESSONS, denominator: 56 },
    currentYear: { lessons: ALL_NON_REVIEW_LESSONS, denominator: 107 }
  }
};

// G4-G8 share the same configuration
['G4', 'G5', 'G6', 'G7', 'G8'].forEach(grade => {
  GRADE_METRICS[grade] = {
    foundational: { lessons: FOUNDATIONAL_LESSONS, denominator: 34 },
    minimum: { lessons: G4_MINIMUM_LESSONS, denominator: 103 },
    currentYear: { lessons: ALL_NON_REVIEW_LESSONS, denominator: 107 }
  };
});
// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getColumnLetter(columnNumber) {
  if (columnNumber < 1) return 'A';
  let letter = '';
  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }
  return letter;
}

function extractLessonNumber(lessonText) {
  if (lessonText === null || lessonText === undefined) return null;
  const str = lessonText.toString().toUpperCase().trim();
  if (str === '') return null;
  const match = str.match(/(?:LESSON\s*|L\s*)?(\d{1,3})/);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    return (num >= 1 && num <= LAYOUT.TOTAL_LESSONS) ? num : null;
  }
  return null;
}

function log(functionName, message, level = 'INFO') {
  Logger.log(`[${level}] [${functionName}] ${message}`);
}

function normalizeStudent(student) {
  return {
    name: (student && student.name) ? student.name.toString().trim() : "",
    grade: (student && student.grade) ? student.grade.toString().trim() : "",
    teacher: (student && student.teacher) ? student.teacher.toString().trim() : "",
    group: (student && student.group) ? student.group.toString().trim() : ""
  };
}

function getLastLessonColumn() {
  return getColumnLetter(LAYOUT.COL_FIRST_LESSON + LAYOUT.TOTAL_LESSONS - 1);
}

function getOrCreateSheet(ss, sheetName, clearIfExists = true) {
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    if (clearIfExists) {
      sheet.clear();
      sheet.clearConditionalFormatRules();
    }
  } else {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * Creates a non-merged header row with consistent branding
 * @param {Sheet} sheet - The sheet to add header to
 * @param {number} row - Row number for the header
 * @param {string} text - Header text
 * @param {number} width - Number of columns to span (background only, no merge)
 * @param {Object} options - Formatting options
 */
function createHeader(sheet, row, text, width, options = {}) {
  // Set background across the full width (no merge)
  const fullRange = sheet.getRange(row, 1, 1, width);
  if (options.background) fullRange.setBackground(options.background);

  // Set text in first column only (or column 2 if logo present and row 1)
  const textCol = (row === 1 && SCHOOL_BRANDING.LOGO_FILE_ID) ? 2 : 1;
  const textRange = sheet.getRange(row, textCol);
  textRange.setValue(text);

  // Apply font styling to the text cell
  textRange.setFontFamily(options.fontFamily || SCHOOL_BRANDING.FONT_FAMILY);
  if (options.fontColor) textRange.setFontColor(options.fontColor);
  if (options.fontWeight) textRange.setFontWeight(options.fontWeight);
  if (options.fontSize) textRange.setFontSize(options.fontSize);
  if (options.fontStyle) textRange.setFontStyle(options.fontStyle);
  if (options.horizontalAlignment) textRange.setHorizontalAlignment(options.horizontalAlignment);
}

/**
 * DEPRECATED: Use createHeader() instead - this function merges cells
 * Kept for backward compatibility during transition
 */
function createMergedHeader(sheet, row, text, width, options = {}) {
  const values = [text];
  for (let i = 1; i < width; i++) values.push("");
  const range = sheet.getRange(row, 1, 1, width);
  range.setValues([values]).merge();
  if (options.background) range.setBackground(options.background);
  if (options.fontColor) range.setFontColor(options.fontColor);
  if (options.fontWeight) range.setFontWeight(options.fontWeight);
  if (options.fontSize) range.setFontSize(options.fontSize);
  if (options.fontFamily) range.setFontFamily(options.fontFamily);
  if (options.fontStyle) range.setFontStyle(options.fontStyle);
  if (options.horizontalAlignment) range.setHorizontalAlignment(options.horizontalAlignment);
}

/**
 * Inserts the school logo into a sheet (row 1, column A)
 * Supports both Google Drive file IDs and external URLs
 * @param {Sheet} sheet - The sheet to add logo to
 * @returns {boolean} True if logo was inserted, false if skipped
 */
function insertSheetLogo(sheet) {
  const logoSource = SCHOOL_BRANDING.LOGO_FILE_ID;
  if (!logoSource) return false;

  try {
    let logoBlob;

    // Check if it's a URL or a Drive file ID
    if (logoSource.startsWith('http://') || logoSource.startsWith('https://')) {
      // Fetch image from URL
      const response = UrlFetchApp.fetch(logoSource, {
        muteHttpExceptions: true,
        followRedirects: true
      });

      if (response.getResponseCode() !== 200) {
        Logger.log("Could not fetch logo from URL: HTTP " + response.getResponseCode());
        return false;
      }

      logoBlob = response.getBlob();
    } else {
      // Treat as Google Drive file ID
      logoBlob = DriveApp.getFileById(logoSource).getBlob();
    }

    const image = sheet.insertImage(logoBlob, 1, 1);

    // Resize logo to configured dimensions
    image.setWidth(SCHOOL_BRANDING.LOGO_WIDTH);
    image.setHeight(SCHOOL_BRANDING.LOGO_HEIGHT);

    // Set row height to accommodate logo
    sheet.setRowHeight(1, SCHOOL_BRANDING.LOGO_HEIGHT + 10);

    return true;
  } catch (e) {
    Logger.log("Could not insert logo: " + e.message);
    return false;
  }
}

/**
 * Sets up standard sheet formatting with logo and headers
 * Call this when creating new sheets for consistent branding
 * @param {Sheet} sheet - The sheet to format
 * @param {string} title - Main title text
 * @param {string} subtitle - Subtitle/description text
 * @param {number} width - Number of columns
 */
function applySheetBranding(sheet, title, subtitle, width) {
  // Insert logo (if configured)
  insertSheetLogo(sheet);

  // Row 1: Title header
  createHeader(sheet, 1, title, width, {
    background: COLORS.TITLE_BG,
    fontColor: COLORS.TITLE_FG,
    fontWeight: "bold",
    fontSize: SCHOOL_BRANDING.HEADER_FONT_SIZE
  });

  // Row 2: Subtitle
  createHeader(sheet, 2, subtitle, width, {
    fontFamily: SCHOOL_BRANDING.FONT_FAMILY,
    fontSize: SCHOOL_BRANDING.SUBHEADER_FONT_SIZE,
    fontStyle: "italic"
  });

  // Apply Calibri font to entire sheet (affects new data)
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
    .setFontFamily(SCHOOL_BRANDING.FONT_FAMILY);
}

function applyStatusConditionalFormatting(sheet, startRow, startCol, numRows, numCols) {
  if (numRows <= 0 || numCols <= 0) return;
  const range = sheet.getRange(startRow, startCol, numRows, numCols);
  const existingRules = sheet.getConditionalFormatRules();
  const rangeA1 = range.getA1Notation();
  const filteredRules = existingRules.filter(rule => {
    const ruleRanges = rule.getRanges();
    return !ruleRanges.some(r => r.getA1Notation() === rangeA1);
  });
  const newRules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Y').setBackground(COLORS.Y).setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('N').setBackground(COLORS.N).setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('A').setBackground(COLORS.A).setRanges([range]).build()
  ];
  sheet.setConditionalFormatRules(filteredRules.concat(newRules));
}

function setColumnHeaders(sheet, row, headers) {
  const range = sheet.getRange(row, 1, 1, headers.length);
  range.setValues([headers])
    .setBackground(COLORS.HEADER_BG)
    .setFontColor(COLORS.HEADER_FG)
    .setFontWeight("bold")
    .setFontFamily("Calibri");
}

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATION HELPERS (PURE JS - NO FORMULAS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculates percentage of lessons passed ('Y') out of attempted ('Y' or 'N')
 * FIXED: Removed 'A' (Absent) from the denominator so absence doesn't lower the score.
 *
 * @param {Array} mapRow - Student's row data
 * @param {Array<number>} lessonIndices - Lesson numbers to check
 * @returns {number|string} Percentage integer or "" if nothing attempted
 */
function calculatePercentage(mapRow, lessonIndices) {
  let passed = 0;
  let attempted = 0;

  for (const lessonNum of lessonIndices) {
    const status = getLessonStatus(mapRow, lessonNum);
    if (status === 'Y') {
      passed++;
      attempted++;
    } else if (status === 'N') {
      attempted++;
    }
    // Ignored: 'A' (Absent) or "" (Blank)
  }

  return attempted > 0 ? Math.round((passed / attempted) * 100) : "";
}

/**
 * Calculates benchmark percentage with SECTION-BASED gateway logic
 *
 * For each skill section that overlaps with the benchmark range:
 * 1. If section's review(s) are ASSIGNED (Y or N) AND all passed → full section credit
 * 2. Otherwise → count actual Y's in non-review lessons
 *
 * Blanks are NEVER counted as N (not assigned = ignored for gateway)
 * Denominator: Total non-review lessons in benchmark (consistent for growth calc)
 *
 * @param {Array} mapRow - Student's row data from UFLI Map
 * @param {Array<number>} lessonIndices - Lessons in benchmark
 * @param {number} denominator - Original fixed denominator (kept for compatibility)
 * @returns {number} Percentage integer (0-100)
 */
function calculateBenchmark(mapRow, lessonIndices, denominator) {
  if (!lessonIndices || lessonIndices.length === 0) return 0;

  // Get non-review lessons in benchmark (this is our denominator)
  const { nonReviews: nonReviewsInBenchmark } = partitionLessonsByReview(lessonIndices);
  if (nonReviewsInBenchmark.length === 0) return 0;

  // Pre-compute benchmark set for O(1) lookups
  const benchmarkSet = new Set(lessonIndices);
  let totalPassed = 0;

  // Process each skill section
  for (const [sectionName, sectionLessons] of Object.entries(SKILL_SECTIONS)) {
    // Get section lessons that are in the benchmark range (single pass)
    const sectionInBenchmark = [];
    const sectionReviews = [];
    const sectionNonReviews = [];

    for (const lesson of sectionLessons) {
      if (benchmarkSet.has(lesson)) {
        sectionInBenchmark.push(lesson);
        if (isReviewLesson(lesson)) {
          sectionReviews.push(lesson);
        } else {
          sectionNonReviews.push(lesson);
        }
      }
    }

    if (sectionInBenchmark.length === 0) continue;

    // Check gateway using helper
    const gateway = sectionReviews.length > 0
      ? checkGateway(mapRow, sectionReviews)
      : { gatewayPassed: false };

    if (gateway.gatewayPassed) {
      // Gateway passed: Count ALL non-reviews in this section as passed
      totalPassed += sectionNonReviews.length;
    } else {
      // No gateway: Count actual Y's in non-review lessons
      for (const lessonNum of sectionNonReviews) {
        if (getLessonStatus(mapRow, lessonNum) === 'Y') {
          totalPassed++;
        }
      }
    }
  }

  return Math.round((totalPassed / nonReviewsInBenchmark.length) * 100);
}

/**
 * Calculates section percentage with gateway logic
 *
 * Initial Assessment: Y_count / total_non_review (reviews not assessed)
 * Ongoing Progress:
 *   - Gateway: If section's review(s) ASSIGNED (Y or N) AND all Y → 100%
 *   - Otherwise: Y_count / total_non_review
 *
 * Blanks are NEVER counted as N (not assigned = ignored)
 *
 * @param {Array} mapRow - Student's row data
 * @param {Array<number>} sectionLessons - All lessons in this section
 * @param {boolean} isInitialAssessment - If true, no gateway (baseline calc)
 * @returns {number|string} Percentage integer or "" if nothing attempted
 */
function calculateSectionPercentage(mapRow, sectionLessons, isInitialAssessment = false) {
  const { reviews, nonReviews } = partitionLessonsByReview(sectionLessons);

  if (nonReviews.length === 0) return "";

  // Count passed non-review lessons (used in both paths)
  const countPassed = () => {
    let passed = 0;
    for (const lessonNum of nonReviews) {
      if (getLessonStatus(mapRow, lessonNum) === 'Y') passed++;
    }
    return passed;
  };

  // For Initial Assessment: Only count non-review Y's (no gateway)
  if (isInitialAssessment) {
    return Math.round((countPassed() / nonReviews.length) * 100);
  }

  // === ONGOING PROGRESS LOGIC ===

  // Check gateway using helper
  if (reviews.length > 0) {
    const gateway = checkGateway(mapRow, reviews);
    if (gateway.gatewayPassed) {
      return 100; // Gateway passed: 100% section credit
    }
  }

  // No gateway - count Y's in non-review lessons
  return Math.round((countPassed() / nonReviews.length) * 100);
}

/**
 * Calculates HWT Pre-K scores using FIXED DENOMINATORS (Benchmark-style)
 *
 * Metrics (based on Handwriting Without Tears pedagogy):
 * - Foundational Skills % = Form Y count / 26 (Motor Integration - fine motor production)
 * - Min Grade Skills % = (Name Y + Sound Y) / 52 (Literacy Knowledge - cognitive/receptive)
 * - Full Grade Skills % = (Name Y + Sound Y + Form Y) / 78 (K-Readiness - visual-motor integration)
 *
 * @param {Array} row - Student's row data from Pre-K Data sheet
 * @param {Array} headers - Header row from Pre-K Data sheet
 * @returns {Object} { foundational, minGrade, fullGrade } percentages
 */
function calculatePreKScores(row, headers) {
  let nameY = 0;
  let soundY = 0;
  let formY = 0;

  // Loop through columns starting at index 2 (Column C)
  for (let i = 2; i < row.length; i++) {
    const header = headers[i];
    const value = row[i] ? row[i].toString().toUpperCase() : "";
    
    if (!header) continue;

    if (header.includes("- Name") && value === "Y") nameY++;
    else if (header.includes("- Sound") && value === "Y") soundY++;
    else if (header.includes("- Form") && value === "Y") formY++;
  }

  // Fixed Denominators (Benchmark-style)
  return {
    foundational: Math.round((formY / PREK_CONFIG.FORM_DENOMINATOR) * 100),
    minGrade: Math.round(((nameY + soundY) / PREK_CONFIG.NAME_SOUND_DENOMINATOR) * 100),
    fullGrade: Math.round(((nameY + soundY + formY) / PREK_CONFIG.FULL_DENOMINATOR) * 100)
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM SHEET GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generateSystemSheets(ss, wizardData) {
  const functionName = 'generateSystemSheets';
  try {
    if (!wizardData || !Array.isArray(wizardData.students)) {
      return { success: false, error: 'Invalid wizard data' };
    }
    
    createSmallGroupProgressSheet(ss);
    createUFLIMapSheet(ss, wizardData);
    createSkillsSheet(ss, wizardData);
    createGradeSummarySheet(ss, wizardData);
    createGradeGroupSheets(ss, wizardData);
    
    // Perform initial sync to populate stats if data exists
    syncSmallGroupProgress();
    
    return { success: true };
  } catch (error) {
    log(functionName, `Error: ${error.toString()}`, 'ERROR');
    return { success: false, error: error.toString() };
  }
}

function createSmallGroupProgressSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
  applySheetBranding(sheet,
    "SMALL GROUP PROGRESS - DATA LOG",
    "Data from the Web App is saved here. Do not manually edit.",
    6
  );
  setColumnHeaders(sheet, 5, ["Date", "Teacher", "Group Name", "Student Name", "Lesson Number", "Status"]);
  sheet.setColumnWidth(1, 100); sheet.setColumnWidth(2, 150); sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 200); sheet.setColumnWidth(5, 120); sheet.setColumnWidth(6, 80);
  sheet.setFrozenRows(5);
}

function createUFLIMapSheet(ss, wizardData) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES_V2.UFLI_MAP);
  const headerWidth = LAYOUT.COL_CURRENT_LESSON + LAYOUT.TOTAL_LESSONS;
  applySheetBranding(sheet,
    "UFLI MAP - MASTER PROGRESS REPORT",
    "Master tracking grid for all UFLI lessons by student",
    headerWidth
  );
  // Rows 3-4 are spacers
  const headers = ["Student Name", "Grade", "Teacher", "Group", "Current Lesson"];
  for (let i = 1; i <= LAYOUT.TOTAL_LESSONS; i++) headers.push(LESSON_LABELS[i] || `Lesson ${i}`);
  setColumnHeaders(sheet, 5, headers);
  
  const students = wizardData.students || [];
  if (students.length > 0) {
    const studentData = students.map(student => {
      const s = normalizeStudent(student);
      const row = [s.name, s.grade, s.teacher, s.group, ""]; // Current Lesson is blank initially
      for (let i = 0; i < LAYOUT.TOTAL_LESSONS; i++) row.push("");
      return row;
    });
    sheet.getRange(LAYOUT.DATA_START_ROW, 1, studentData.length, headers.length).setValues(studentData);
    applyStatusConditionalFormatting(sheet, LAYOUT.DATA_START_ROW, LAYOUT.COL_FIRST_LESSON, studentData.length, LAYOUT.TOTAL_LESSONS);
  }
  sheet.setFrozenRows(5);
}

function createSkillsSheet(ss, wizardData) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES_V2.SKILLS);
  const headerWidth = 4 + Object.keys(SKILL_SECTIONS).length;
  applySheetBranding(sheet,
    "SKILLS TRACKER",
    "Skill section mastery percentages by student",
    headerWidth
  );
  // Rows 3-4 are spacers
  const skillSectionNames = Object.keys(SKILL_SECTIONS);
  const headers = ["Student Name", "Grade", "Teacher", "Group"];
  skillSectionNames.forEach(section => headers.push(section + " %"));
  setColumnHeaders(sheet, 5, headers);
  
  const students = wizardData.students || [];
  if (students.length > 0) {
    const studentData = students.map(student => {
      const s = normalizeStudent(student);
      const row = [s.name, s.grade, s.teacher, s.group];
      for (let i = 0; i < skillSectionNames.length; i++) row.push("");
      return row;
    });
    sheet.getRange(LAYOUT.DATA_START_ROW, 1, studentData.length, headers.length).setValues(studentData);
  }
  sheet.setFrozenRows(5);
}

function createGradeSummarySheet(ss, wizardData) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES_V2.GRADE_SUMMARY);
  const skillSectionNames = Object.keys(SKILL_SECTIONS);
  const headers = [
    "Student Name", "Grade", "Teacher", "Group",
    "Foundational Skills %", "Min Grade Skills %", "Full Grade Skills %", "Benchmark Status"
  ];
  skillSectionNames.forEach(section => {
    headers.push(`${section} (Initial %)`);
    headers.push(`${section} (AG%)`);
    headers.push(`${section} (Total %)`);
  });
  const headerWidth = headers.length;
  applySheetBranding(sheet,
    "GRADE SUMMARY - BENCHMARK TRACKING",
    "Student progress metrics and benchmark status",
    headerWidth
  );
  // Rows 3-4 are spacers
  setColumnHeaders(sheet, 5, headers);
  
  const students = wizardData.students || [];
  if (students.length > 0) {
    const studentData = students.map(student => {
      const s = normalizeStudent(student);
      const row = [s.name, s.grade, s.teacher, s.group, "", "", "", ""];
      for (let i = 0; i < skillSectionNames.length * 3; i++) row.push("");
      return row;
    });
    sheet.getRange(LAYOUT.DATA_START_ROW, 1, studentData.length, headers.length).setValues(studentData);
  }
  sheet.setFrozenRows(5);
}

// ═══════════════════════════════════════════════════════════════════════════
// GRADE GROUP SHEETS
// ═══════════════════════════════════════════════════════════════════════════

function createGradeGroupSheets(ss, wizardData) {
  const groupsByGrade = {};
  (wizardData.groups || []).forEach(groupConfig => {
    if (!groupConfig || !groupConfig.grade) return;
    if (!groupsByGrade[groupConfig.grade]) groupsByGrade[groupConfig.grade] = [];
    const count = groupConfig.count || 1;
    for (let i = 1; i <= count; i++) {
      groupsByGrade[groupConfig.grade].push(count === 1 ? `${groupConfig.grade} Group` : `${groupConfig.grade} Group ${i}`);
    }
  });
  Object.keys(groupsByGrade).forEach(grade => {
    createSingleGradeSheet(ss, `${grade} Groups`, groupsByGrade[grade], wizardData.students || []);
  });
}

function createSingleGradeSheet(ss, sheetName, groupNames, allStudents) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const columnCount = 1 + LAYOUT.LESSONS_PER_GROUP_SHEET;
  
  // Row 1-2: Empty spacer rows
  // Row 3: Instructional Sequence row (manually populated with dates)
  const sequenceRow = ["Instructional Sequence"];
  for (let i = 1; i <= LAYOUT.LESSONS_PER_GROUP_SHEET; i++) sequenceRow.push("");
  sheet.getRange(3, 1, 1, columnCount).setValues([sequenceRow])
    .setBackground("#e8f0fe")  // Light blue background
    .setFontStyle("italic")
    .setFontFamily("Calibri");
  
  // Groups start at Row 4
  let currentRow = 4;
  
  groupNames.forEach(groupName => {
    const groupStudents = allStudents.filter(s => s && s.group === groupName);

    // Group Name Header (no merge - just background across row)
    createHeader(sheet, currentRow, groupName, columnCount, {
      background: COLORS.HEADER_BG, fontColor: COLORS.HEADER_FG, fontWeight: "bold", fontSize: 12, horizontalAlignment: "left"
    });
    currentRow++;
    
    // Column Headers Row ("Student Name", "Lesson 1", "Lesson 2", ...)
    const columnHeaders = ["Student Name"];
    for (let i = 1; i <= LAYOUT.LESSONS_PER_GROUP_SHEET; i++) columnHeaders.push(`Lesson ${i}`);
    
    sheet.getRange(currentRow, 1, 1, columnHeaders.length).setValues([columnHeaders])
      .setBackground(COLORS.TITLE_BG).setFontColor(COLORS.TITLE_FG).setFontWeight("bold");
    currentRow++;
    
    // Sub-header Row (for UFLI lesson names - manually populated)
    sheet.getRange(currentRow, 1, 1, columnCount).setBackground(COLORS.SUB_HEADER_BG);
    currentRow++;
    
    // Student Data Rows
    if (groupStudents.length > 0) {
      const studentData = groupStudents.map(student => {
        const row = [normalizeStudent(student).name];
        for (let i = 0; i < LAYOUT.LESSONS_PER_GROUP_SHEET; i++) row.push("");
        return row;
      });
      sheet.getRange(currentRow, 1, studentData.length, columnCount).setValues(studentData);
      applyStatusConditionalFormatting(sheet, currentRow, 2, studentData.length, LAYOUT.LESSONS_PER_GROUP_SHEET);
      currentRow += studentData.length;
    } else {
      sheet.getRange(currentRow, 1).setValue("(No students assigned)").setFontStyle("italic").setFontColor(COLORS.PLACEHOLDER_FG);
      currentRow++;
    }
    
    // Spacer row between groups
    currentRow++;
  });
  
  sheet.setColumnWidth(1, 200);
  sheet.setFrozenRows(3);  // Freeze the Instructional Sequence row
}

// ═══════════════════════════════════════════════════════════════════════════
// PACING REPORTS
// ═══════════════════════════════════════════════════════════════════════════

function createPacingReports(ss) {
  // Dashboard Sheet
  const dashboardSheet = getOrCreateSheet(ss, SHEET_NAMES_PACING.DASHBOARD);
  applySheetBranding(dashboardSheet,
    "PACING DASHBOARD",
    "Group pacing progress and performance metrics",
    13
  );
  // Rows 3-4 are spacers
  setColumnHeaders(dashboardSheet, 5, [
    "Group", "Teacher", "Students", "Assigned Lessons", "Tracked Lessons",
    "Pacing %", "Highest Lesson", "Last Entry",
    "Expected Time (min)", "Actual Time (min)",
    "Avg Pass %", "Avg Not Passed %", "Absent %"
  ]);
  dashboardSheet.setFrozenRows(5);

  // Log Sheet
  const logSheet = getOrCreateSheet(ss, SHEET_NAMES_PACING.LOG);
  applySheetBranding(logSheet,
    "PACING LOG",
    "Detailed lesson-by-lesson pacing data",
    12
  );
  // Rows 3-4 are spacers
  setColumnHeaders(logSheet, 5, ["Group", "Teacher", "Lesson Slot", "UFLI Lesson", "Student Count", "Y Count", "N Count", "A Count", "Pass %", "Not Passed %", "Absent %", "Last Date"]);
  logSheet.setFrozenRows(5);
}

function updatePacingReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);
  const progressSheet = ss.getSheetByName(SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
  if (!mapSheet || !progressSheet) return;
  
  const lookups = buildStudentLookups();
  const progressMap = buildProgressHistory(progressSheet);

  // Use mixed-grade scanner if enabled, otherwise use standard scanner
  let dashboardRows, logRows;
  if (typeof ENABLE_MIXED_GRADES !== 'undefined' && ENABLE_MIXED_GRADES && typeof scanGradeSheetsForPacing_MixedGrade === 'function') {
    Logger.log('updatePacingReports: Using mixed-grade scanner');
    ({ dashboardRows, logRows } = scanGradeSheetsForPacing_MixedGrade(ss, lookups, progressMap));
  } else {
    ({ dashboardRows, logRows } = scanGradeSheetsForPacing(ss, lookups, progressMap));
  }
  
  writeDataToSheet(ss, SHEET_NAMES_PACING.DASHBOARD, dashboardRows, 6);
  writeDataToSheet(ss, SHEET_NAMES_PACING.LOG, logRows, 6);
  
  // Format Pacing Dashboard
  const dashboardSheet = ss.getSheetByName(SHEET_NAMES_PACING.DASHBOARD);
  if (dashboardSheet && dashboardSheet.getLastRow() >= 6) {
    const numRows = dashboardSheet.getLastRow() - 6 + 1;
    
    // Percentage columns: 6 (Pacing %), 11 (Pass %), 12 (Not Passed %), 13 (Absent Rate)
    [6, 11, 12, 13].forEach(col => {
      dashboardSheet.getRange(6, col, numRows).setNumberFormat("0%");
    });
    
    // Plain number columns: 9 (Expected Time), 10 (Actual Time)
    [9, 10].forEach(col => {
      dashboardSheet.getRange(6, col, numRows).setNumberFormat("0");
    });
  }
  
  // Format Pacing Log (unchanged)
  formatPacingSheet(ss, SHEET_NAMES_PACING.LOG, [9, 10, 11], 0, 6);
}

// Helpers for Pacing (kept for compatibility)
/**
 * Builds student count and teacher lookups from Group Configuration sheet
 * Group Configuration is the single source of truth for group sizes
 * @returns {Object} { studentCountByGroup: Map, teacherByGroup: Map }
 */
function buildStudentLookups() {
  const studentCountByGroup = new Map();
  const teacherByGroup = new Map();
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // === READ STUDENT COUNTS FROM GROUP CONFIGURATION ===
  const groupConfigSheet = ss.getSheetByName(SHEET_NAMES.GROUP_CONFIG);
  
  if (groupConfigSheet) {
    const lastRow = groupConfigSheet.getLastRow();
    // Group data starts at row 8 (after headers on row 5, totals on row 6, spacer on row 7)
    const GROUP_DATA_START = 8;
    
    if (lastRow >= GROUP_DATA_START) {
      // Columns: A=Group Name, B=Grade, C=# of Groups, D=Students
      const configData = groupConfigSheet.getRange(GROUP_DATA_START, 1, lastRow - GROUP_DATA_START + 1, 4).getValues();
      
      configData.forEach(row => {
        const groupName = row[0] ? row[0].toString().trim() : "";
        const studentCount = parseInt(row[3]) || 0;
        
        if (groupName && groupName !== "Total Groups") {
          studentCountByGroup.set(groupName, studentCount);
        }
      });
      
      Logger.log(`buildStudentLookups: Loaded ${studentCountByGroup.size} groups from Group Configuration`);
    }
  } else {
    Logger.log("buildStudentLookups: Group Configuration sheet not found");
  }
  
  // === READ TEACHERS FROM GRADE SUMMARY ===
  const summarySheet = ss.getSheetByName(SHEET_NAMES_V2.GRADE_SUMMARY);
  
  if (summarySheet) {
    const lastRow = summarySheet.getLastRow();
    if (lastRow >= LAYOUT.DATA_START_ROW) {
      // Columns: A=Name, B=Grade, C=Teacher, D=Group
      const summaryData = summarySheet.getRange(LAYOUT.DATA_START_ROW, 1, lastRow - LAYOUT.DATA_START_ROW + 1, 4).getValues();
      
      summaryData.forEach(row => {
        const teacher = row[2] ? row[2].toString().trim() : "";
        const groupName = row[3] ? row[3].toString().trim() : "";
        
        // Store teacher for group (uses last teacher found for each group)
        if (groupName && teacher) {
          teacherByGroup.set(groupName, teacher);
        }
      });
    }
  }
  
  return { studentCountByGroup, teacherByGroup };
}

function buildProgressHistory(progressSheet) {
  const progressMap = new Map();
  const lastRow = progressSheet.getLastRow();
  if (lastRow < LAYOUT.DATA_START_ROW) return progressMap;
  const data = progressSheet.getRange(LAYOUT.DATA_START_ROW, 1, lastRow - LAYOUT.DATA_START_ROW + 1, 6).getValues();
  data.forEach(row => {
    if (!row[2] || !row[4] || !row[5]) return;
    const lessonNum = extractLessonNumber(row[4]);
    if (!lessonNum) return;
    const key = `${row[2].toString().trim()}|${lessonNum}`;
    if (!progressMap.has(key)) progressMap.set(key, { Y: 0, N: 0, A: 0, lastDate: new Date(0), recentTeacher: "" });
    const entry = progressMap.get(key);
    const statusKey = row[5].toString().toUpperCase();
    if (entry[statusKey] !== undefined) entry[statusKey]++;
    const rowDate = new Date(row[0]);
    if (!isNaN(rowDate) && rowDate > entry.lastDate) {
      entry.lastDate = rowDate;
      if (row[1]) entry.recentTeacher = row[1];
    }
  });
  return progressMap;
}

function scanGradeSheetsForPacing(ss, lookups, progressMap) {
  const { studentCountByGroup, teacherByGroup } = lookups;
  const dashboardRows = [];
  const logRows = [];
  const gradeSheetRegex = /^(PreK|KG|G[1-8]) Groups$/;
  const gradeSheets = ss.getSheets().filter(sheet => gradeSheetRegex.test(sheet.getName()));
  
  gradeSheets.forEach(sheet => {
    const sheetData = sheet.getDataRange().getValues();
    let currentGroupName = "", currentTeacher = "", studentCount = 0;
    let dash = { assigned: 0, tracked: 0, pass: 0, fail: 0, absent: 0, lastEntry: null, highestLessonName: "" };
    let dashHighestNum = 0;
    
    for (let i = 0; i < sheetData.length; i++) {
      const cellA = sheetData[i][0] ? sheetData[i][0].toString() : "";
        if (cellA.includes("Group") && sheetData[i+1] && sheetData[i+1][0] && sheetData[i+1][0].toString().trim() === "Student Name") {
        if (currentGroupName) dashboardRows.push(buildDashboardRow(currentGroupName, currentTeacher, studentCount, dash));
        currentGroupName = cellA.trim();
        studentCount = studentCountByGroup.get(currentGroupName) || 0;
        currentTeacher = teacherByGroup.get(currentGroupName) || "Unknown Teacher";
        dash = { assigned: 0, tracked: 0, pass: 0, fail: 0, absent: 0, lastEntry: null, highestLessonName: "" };
        dashHighestNum = 0;
        
        if (i + 2 < sheetData.length) {
          const lessonRow = sheetData[i + 2];
          for (let col = 1; col <= LAYOUT.LESSONS_PER_GROUP_SHEET; col++) {
            if (col >= lessonRow.length) break;
            const lessonName = lessonRow[col] ? lessonRow[col].toString().trim() : "";
            const lessonNum = extractLessonNumber(lessonName);
            if (!lessonName || !lessonNum) continue;
            
            dash.assigned++;
            const stats = progressMap.get(`${currentGroupName}|${lessonNum}`);
            let log_Y = 0, log_N = 0, log_A = 0, log_Date = null;
            let log_Teacher = currentTeacher;
            
            if (stats) {
              dash.tracked++;
              log_Y = stats.Y; log_N = stats.N; log_A = stats.A;
              dash.pass += log_Y; dash.fail += log_N; dash.absent += log_A;
              if (stats.lastDate > 0) {
                log_Date = stats.lastDate;
                if (!dash.lastEntry || log_Date > dash.lastEntry) dash.lastEntry = log_Date;
              }
              if (lessonNum > dashHighestNum) { dashHighestNum = lessonNum; dash.highestLessonName = lessonName; }
              if (stats.recentTeacher) log_Teacher = stats.recentTeacher;
            }
            
             // Use total responses (Y+N+A) as denominator for all rates (Pass% + Not Passed% + Absent% = 100%)
             const totalResp = log_Y + log_N + log_A;
             logRows.push([currentGroupName, log_Teacher, `Lesson ${col}`, lessonName, studentCount, log_Y, log_N, log_A, totalResp>0?log_Y/totalResp:0, totalResp>0?log_N/totalResp:0, totalResp>0?log_A/totalResp:0, log_Date]);

          }
        }
      }
    }
    if (currentGroupName) dashboardRows.push(buildDashboardRow(currentGroupName, currentTeacher, studentCount, dash));
  });
  return { dashboardRows, logRows };
}

// ═══════════════════════════════════════════════════════════════════════════
// FIX: Absent Rate Calculation - Pacing Dashboard & School Summary
//
// ISSUE: Absent Rate showing 100x too high (e.g., 1500% instead of 15%)
//
// ROOT CAUSE: The Pacing Dashboard stores "Total Absent" as a raw count,
// but the School Summary then divides by denominator AND applies "0%" format
// which multiplies by 100 again.
//
// This file contains TWO fixes - apply both to GPProgressEngine.gs
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// FIX #1: Update buildDashboardRow() to store Absent Rate as DECIMAL
// Replace the existing buildDashboardRow() function
// ═══════════════════════════════════════════════════════════════════════════

function buildDashboardRow(group, teacher, count, dash) {
  const MINUTES_PER_LESSON = 60;  // ADD THIS CONSTANT
  
  // Calculate instructional time
  const expectedTime = dash.assigned * MINUTES_PER_LESSON;
  const actualTime = dash.tracked * MINUTES_PER_LESSON;

  // Use total responses (Y+N+A) as denominator for all rates
  const totalResponses = dash.pass + dash.fail + dash.absent;
  const passRate = totalResponses > 0 ? dash.pass / totalResponses : 0;
  const notPassedRate = totalResponses > 0 ? dash.fail / totalResponses : 0;
  const absentRate = totalResponses > 0 ? dash.absent / totalResponses : 0;
  
  return [
    group,                                                  // Col 1: Group
    teacher,                                                // Col 2: Teacher
    count,                                                  // Col 3: Students
    dash.assigned,                                          // Col 4: Assigned Lessons
    dash.tracked,                                           // Col 5: Tracked Lessons
    dash.assigned > 0 ? dash.tracked / dash.assigned : 0,   // Col 6: Pacing % (decimal)
    dash.highestLessonName,                                 // Col 7: Highest Lesson
    dash.lastEntry,                                         // Col 8: Last Entry
    expectedTime,                                           // Col 9: Expected Time (min) - NEW
    actualTime,                                             // Col 10: Actual Time (min) - NEW
    passRate,                                               // Col 11: Avg Pass % (decimal)
    notPassedRate,                                          // Col 12: Avg Not Passed % (decimal)
    absentRate                                              // Col 13: Absent % (decimal)
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// FIX #2: Update formatPacingSheet() call to format Absent Rate as %
// Find the call to formatPacingSheet() and update it
// ═══════════════════════════════════════════════════════════════════════════

// BEFORE (in updatePacingReports):
//   formatPacingSheet(ss, SHEET_NAMES_PACING.DASHBOARD, [6, 9, 10], 11);
//
// AFTER:
//   formatPacingSheet(ss, SHEET_NAMES_PACING.DASHBOARD, [6, 9, 10, 11], 0);
//
// This adds column 11 (Absent Rate) to the percentage columns


// ═══════════════════════════════════════════════════════════════════════════
// FIX #3: Update renderGroupTable() in School Summary to read correctly
// Replace the existing renderGroupTable() function
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// FIXED: renderGroupTable() - Correct Column Indices & Simplified Layout
// 
// Pacing Dashboard Column Indices (0-based):
//   0: Group, 1: Teacher, 2: Students, 3: Assigned Lessons, 4: Tracked Lessons
//   5: Pacing %, 6: Highest Lesson, 7: Last Entry, 8: Expected Time, 9: Actual Time
//   10: Avg Pass %, 11: Avg Not Passed %, 12: Absent Rate
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// FIXED: renderGroupTable() - Correct Column Indices & Simplified Layout
// 
// Pacing Dashboard Column Indices (0-based, with hidden Teacher column):
//   0: Group, 1: Teacher (hidden), 2: Students, 3: Assigned Lessons, 
//   4: Tracked Lessons, 5: Pacing %, 6: Highest Lesson, 7: Last Entry, 
//   8: Expected Time, 9: Actual Time, 10: Avg Pass %, 11: Avg Not Passed %, 
//   12: Absent Rate
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// renderGroupTable() - CORRECTED VERSION
// Simplified to 7 columns: Group, Grade, Students, Pacing, Pass Rate, Absent Rate, Status
//
// Pacing Dashboard Array Indices (with Teacher column):
//   [0]=Group, [1]=Teacher, [2]=Students, [3]=Assigned, [4]=Tracked,
//   [5]=Pacing%, [6]=HighestLesson, [7]=LastEntry, [8]=ExpectedTime,
//   [9]=ActualTime, [10]=AvgPass%, [11]=AvgNotPassed%, [12]=AbsentRate
// ═══════════════════════════════════════════════════════════════════════════

function renderGroupTable(sheet, row, groups) {
// DEBUG
  Logger.log("=== INSIDE renderGroupTable ===");
  Logger.log("Number of groups: " + groups.length);
  if (groups.length > 0) {
    Logger.log("First group g[8]: " + groups[0][8]);
    Logger.log("First group g[9]: " + groups[0][9]);
    Logger.log("First group g[10]: " + groups[0][10]);
    Logger.log("First group g[12]: " + groups[0][12]);
  }
  // Section label
  sheet.getRange(row, 1).setValue("✅ Group Performance")
    .setFontWeight("bold")
    .setFontSize(11)
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
  row++;
  
  // Headers - 7 columns only
  const headers = ["Group", "Grade", "Students", "Pacing", "Pass Rate", "Absent Rate", "Status"];
  sheet.getRange(row, 1, 1, 7).setValues([headers])
    .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center");
  sheet.setRowHeight(row, 26);
  row++;
  
  // Process groups
  let flaggedGroups = [];
  
  const tableData = groups.map((g) => {
    // READ VALUES FROM CORRECT INDICES
    const studentCount = parseInt(g[2]) || 0;    // Index 2 = Students
    const pacingPct = parseFloat(g[5]) || 0;     // Index 5 = Pacing %
    const passRate = parseFloat(g[10]) || 0;     // Index 10 = Avg Pass %
    const absentRate = parseFloat(g[12]) || 0;   // Index 12 = Absent Rate
    
    // Extract grade from group name
    const gradeMatch = g[0].toString().match(/^(PreK|KG|G[1-8])/);
    const grade = gradeMatch ? gradeMatch[1] : "";
    
    // Determine status
    let status = "✅ Good";
    if (passRate < 0.50 || absentRate > 0.15) {
      status = "🔴 Alert";
      flaggedGroups.push(g[0]);
    } else if (passRate < 0.70 || absentRate > 0.10) {
      status = "🟡 Watch";
    } else if (passRate >= 0.85) {
      status = "🟢 Strong";
    }
    
    // Return 7 values - NO actualTime
    return [g[0].toString(), grade, studentCount, pacingPct, passRate, absentRate, status];
  });
  
  // Write table data
  if (tableData.length > 0) {
    sheet.getRange(row, 1, tableData.length, 7).setValues(tableData)
      .setFontSize(10)
      .setVerticalAlignment("middle");
    
    // Format columns
    sheet.getRange(row, 3, tableData.length, 1).setNumberFormat("0");    // Students
    sheet.getRange(row, 4, tableData.length, 3).setNumberFormat("0%");   // Pacing, Pass Rate, Absent Rate
    
    // Center align numeric columns
    sheet.getRange(row, 2, tableData.length, 5).setHorizontalAlignment("center");
    
    // Alternating row colors
    for (let i = 0; i < tableData.length; i++) {
      if (i % 2 === 1) {
        sheet.getRange(row + i, 1, 1, 7).setBackground(DASHBOARD_COLORS.TABLE_ALT_ROW);
      }
      sheet.setRowHeight(row + i, 24);
    }
    
    row += tableData.length;
  }
  
// Flags summary (MERGED)
if (flaggedGroups.length > 0) {
  const flagRange = sheet.getRange(row, 1, 1, 7);
  flagRange.merge();  // ✅ MERGE cells A:G for this row
  flagRange.setValue(`⚠️ ${flaggedGroups.length} group(s) need attention: ${flaggedGroups.join(", ")}`)
    .setBackground("#fff8e1")
    .setFontColor(DASHBOARD_COLORS.AT_RISK)
    .setFontSize(10)
    .setFontStyle("italic")
    .setFontFamily("Calibri")
    .setVerticalAlignment("middle")
    .setWrap(true);
  sheet.setRowHeight(row, 36);
  row++;
}
  
  // Spacer
  sheet.setRowHeight(row, 8);
  row++;
  
  return row;
}

// ═══════════════════════════════════════════════════════════════════════════
// FIX #4: Update the Pacing Dashboard headers to reflect the change
// Replace the headers in createPacingReports() or updatePacingReports()
// ═══════════════════════════════════════════════════════════════════════════

// Change header from "Total Absent" to "Absent Rate" since it's now a percentage:
//
// BEFORE:
//   setColumnHeaders(dashboardSheet, 1, ["Group", "Teacher", "Students", "Assigned Lessons", 
//     "Tracked Lessons", "Pacing %", "Highest Lesson", "Last Entry", "Avg Pass %", 
//     "Avg Not Passed %", "Total Absent"]);
//
// AFTER:
//   setColumnHeaders(dashboardSheet, 1, ["Group", "Teacher", "Students", "Assigned Lessons", 
//     "Tracked Lessons", "Pacing %", "Highest Lesson", "Last Entry", "Avg Pass %", 
//     "Avg Not Passed %", "Absent Rate"]);


// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY OF CHANGES TO MAKE IN GPProgressEngine.gs:
// ═══════════════════════════════════════════════════════════════════════════
//
// 1. Replace buildDashboardRow() with the version above
//
// 2. In updatePacingReports(), change:
//      formatPacingSheet(ss, SHEET_NAMES_PACING.DASHBOARD, [6, 9, 10], 11);
//    To:
//      formatPacingSheet(ss, SHEET_NAMES_PACING.DASHBOARD, [6, 9, 10, 11], 0);
//
// 3. Replace renderGroupTable() with the version above
//
// 4. In createPacingReports(), change "Total Absent" to "Absent Rate" in headers
//
// 5. After making changes, run "Update Progress Data" from the menu to refresh
// ═══════════════════════════════════════════════════════════════════════════

function writeDataToSheet(ss, sheetName, data, startRow) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow >= startRow) sheet.getRange(startRow, 1, lastRow - startRow + 1, sheet.getLastColumn()).clearContent();
  if (data && data.length > 0) sheet.getRange(startRow, 1, data.length, data[0].length).setValues(data);
}

function formatPacingSheet(ss, sheetName, percentCols, absCol, dataStartRow = 6) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < dataStartRow) return;
  const numRows = sheet.getLastRow() - dataStartRow + 1;
  percentCols.forEach(col => sheet.getRange(dataStartRow, col, numRows).setNumberFormat("0%"));
  if (absCol > 0) sheet.getRange(dataStartRow, absCol, numRows).setNumberFormat("0");
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC & UPDATE FUNCTIONS (OPTIMIZED)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// FIXED: syncSmallGroupProgress() - Handles Comprehension & Non-UFLI Lessons
// 
// Replace syncSmallGroupProgress() in GPProgressEngine.gs with this version
//
// CHANGES:
// - Group Sheets now update by EXACT lesson name match (not just lesson number)
// - "Comprehension", "Fluency", etc. will now show Y/N/A colors on Group Sheets
// - UFLI MAP still only updates for valid UFLI lesson numbers (1-128)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Optimized Sync: Reads all data, updates in memory, calculates current lesson, writes all back.
 * UPDATED: Now handles non-UFLI lessons (Comprehension, etc.) for Group Sheet updates
 * FIXED: Variable declaration order for groupSheetsData
 */
function syncSmallGroupProgress() {
  const functionName = 'syncSmallGroupProgress';
  log(functionName, 'Starting Optimized Sync (with Comprehension support)...');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const progressSheet = ss.getSheetByName(SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
  const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);
  
  if (!progressSheet || !mapSheet) {
    log(functionName, 'Required sheets not found', 'ERROR');
    return;
  }

  // 1. BIG GULP: Read everything
  const lastProgressRow = progressSheet.getLastRow();
  const progressData = lastProgressRow >= LAYOUT.DATA_START_ROW ? 
    progressSheet.getRange(LAYOUT.DATA_START_ROW, 1, lastProgressRow - LAYOUT.DATA_START_ROW + 1, 6).getValues() : [];
    
  const lastMapRow = Math.max(mapSheet.getLastRow(), LAYOUT.DATA_START_ROW);
  const mapData = mapSheet.getRange(1, 1, lastMapRow, LAYOUT.COL_FIRST_LESSON + LAYOUT.TOTAL_LESSONS - 1).getValues();
  
  // ═══════════════════════════════════════════════════════════════
  // Group Sheets - LAZY LOAD: Only load sheets that have progress data
  // ═══════════════════════════════════════════════════════════════
  const groupSheetsData = {};

  // First, scan progress data to find which grades/sheets are actually needed
  const neededSheets = new Set();

  // For mixed-grade sites, add all configured mixed-grade sheets
  if (typeof ENABLE_MIXED_GRADES !== 'undefined' && ENABLE_MIXED_GRADES && typeof MIXED_GRADE_CONFIG !== 'undefined') {
    for (const sheetName of Object.keys(MIXED_GRADE_CONFIG)) {
      neededSheets.add(sheetName);
    }
    // Also add SC Classroom if it exists (self-contained classroom with flat structure)
    if (ss.getSheetByName("SC Classroom")) {
      neededSheets.add("SC Classroom");
    }
    Logger.log('syncSmallGroupProgress: Mixed grades enabled, added sheets: ' + Array.from(neededSheets).join(', '));
  }

progressData.forEach(row => {
  const groupName = row[2];
  if (groupName) {
    const groupStr = groupName.toString().trim();

    // SC Classroom groups → load "SC Classroom" sheet
    if (groupStr.startsWith("SC Classroom")) {
      neededSheets.add("SC Classroom");
      return; // continue to next row
    }

    // Standard grade-based groups → load grade sheet
    const gradeMatch = groupStr.match(/^(PreK|KG|G[1-8])/);
    if (gradeMatch) {
      neededSheets.add(gradeMatch[1] + ' Groups');
    }
  }
});

  // Only load the sheets we actually need
  neededSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      groupSheetsData[sheetName] = {
        sheet: sheet,
        values: sheet.getDataRange().getValues(),
        dirty: false
      };
    }
  });

  Logger.log('syncSmallGroupProgress: Loaded ' + neededSheets.size + ' group sheets (lazy load)');

  
  // 2. BUILD LOOKUPS
  const studentMapRowLookup = {}; // Name -> Index in mapData
  const studentCurrentLesson = {}; // Name -> { maxDate: Date, maxLesson: int }
  
  for (let i = LAYOUT.DATA_START_ROW - 1; i < mapData.length; i++) {
    if (mapData[i][0]) {
      studentMapRowLookup[mapData[i][0].toString().trim().toUpperCase()] = i;
    }
  }
  
  // 3. PROCESS LOGS
  progressData.forEach(row => {
    const [date, teacher, groupName, studentName, lessonName, status] = row;
    if (!studentName || !lessonName || !status) return;
    
    const lessonNum = extractLessonNumber(lessonName);
    const cleanName = studentName.toString().trim().toUpperCase();
    const lessonNameStr = lessonName.toString().trim();
    
    // A. Update UFLI MAP Array (only for valid UFLI lesson numbers)
    if (lessonNum) {
      const mapRowIdx = studentMapRowLookup[cleanName];
      if (mapRowIdx !== undefined) {
        const lessonColIdx = LAYOUT.LESSON_COLUMN_OFFSET + lessonNum - 1;
        mapData[mapRowIdx][lessonColIdx] = status;
      }
    }
    
    // B. Update Group Sheet Array (by EXACT lesson name match - handles Comprehension!)
    if (groupName) {
      // Use mixed-grade version if available, otherwise fall back to standard
      if (typeof updateGroupArrayByLessonName_MixedGrade === 'function') {
        updateGroupArrayByLessonName_MixedGrade(groupSheetsData, groupName, studentName, lessonNameStr, status);
      } else {
        updateGroupArrayByLessonName(groupSheetsData, groupName, studentName, lessonNameStr, status);
      }
    }
    
   // C. Track Current Lesson (only for UFLI lessons)
// FIX: Use highest lesson NUMBER (not most recent timestamp)
// FIX: Preserve full lesson label including "reteach" suffix
if (lessonNum) {
  const rowDate = new Date(date);
  if (!isNaN(rowDate)) {
    if (!studentCurrentLesson[cleanName]) {
      studentCurrentLesson[cleanName] = {
        maxDate: rowDate,
        maxLesson: lessonNum,
        lessonLabel: lessonNameStr  // preserve "UFLI L15 reteach"
      };
    } else {
      const curr = studentCurrentLesson[cleanName];
      // Current Lesson = highest lesson number reached (regardless of submission order)
      if (lessonNum > curr.maxLesson) {
        curr.maxLesson = lessonNum;
        curr.lessonLabel = lessonNameStr;
      } else if (lessonNum === curr.maxLesson) {
        // Same lesson submitted again — prefer the reteach label if present
        if (lessonNameStr.toLowerCase().includes('reteach')) {
          curr.lessonLabel = lessonNameStr;
        }
      }
      // Always track most recent activity date (for Pacing Dashboard "Last Entry")
      if (rowDate > curr.maxDate) {
        curr.maxDate = rowDate;
      }
    }
  }
}
  });
  
  // 4. APPLY CURRENT LESSON TO MAP ARRAY
 Object.keys(studentCurrentLesson).forEach(name => {
  const mapRowIdx = studentMapRowLookup[name];
  if (mapRowIdx !== undefined) {
    const entry = studentCurrentLesson[name];
    // FIX: Use preserved label (includes "reteach") instead of rebuilding from number
    mapData[mapRowIdx][4] = entry.lessonLabel || `UFLI L${entry.maxLesson}`;
  }
});
  
  // 5. BIG DUMP: Write everything back
  mapSheet.getRange(1, 1, mapData.length, mapData[0].length).setValues(mapData);
  
  Object.values(groupSheetsData).forEach(cache => {
    if (cache.dirty) {
      cache.sheet.getRange(1, 1, cache.values.length, cache.values[0].length).setValues(cache.values);
    }
  });
  
  // 6. CHAIN REACTION: Update Stats (Skills & Summary) using the updated Map Data
  updateAllStats(ss, mapData);
  
  log(functionName, 'Sync Complete.');
}

/**
 * Updates Group Sheet by matching EXACT lesson name (not just lesson number)
 * This handles "Comprehension", "Fluency", and any other non-UFLI lessons
 * 
 * @param {Object} groupSheetsData - Cache of all group sheet data
 * @param {string} groupName - Name of the group (e.g., "G3 Group 1 Tutoring Galdamez")
 * @param {string} studentName - Student name
 * @param {string} lessonName - Full lesson name (e.g., "Comprehension", "UFLI L101")
 * @param {string} status - Y, N, or A
 */
/**
 * Updates Group Sheet by matching EXACT lesson name (not just lesson number)
 * This handles "Comprehension", "Fluency", and any other non-UFLI lessons
 * 
 * Expected Group Sheet Structure (as of Row 6 migration):
 *   Row 1-2: Empty spacers
 *   Row 3: Instructional Sequence + Dates (manually populated)
 *   Row 4+: Group blocks, each with structure:
 *     - Group Header (e.g., "G3 Group 1 Galdamez")
 *     - Column Headers ("Student Name", "Lesson 1", "Lesson 2", ...)
 *     - Lesson Names sub-header (e.g., "", "UFLI L101", "UFLI L102", ...)
 *     - Student data rows
 *     - Empty spacer row before next group
 * 
 * @param {Object} groupSheetsData - Cache of all group sheet data
 * @param {string} groupName - Name of the group (e.g., "G3 Group 1 Tutoring Galdamez")
 * @param {string} studentName - Student name
 * @param {string} lessonName - Full lesson name (e.g., "Comprehension", "UFLI L101")
 * @param {string} status - Y, N, or A
 */
function updateGroupArrayByLessonName(groupSheetsData, groupName, studentName, lessonName, status) {
  // Extract grade from group name to find the right sheet
let sheetName = null;

if (groupName.startsWith("SC Classroom")) {
  sheetName = "SC Classroom";
} else {
  const gradeMatch = groupName.match(/^([A-Za-z0-9]+)/);
  if (!gradeMatch) return;
  sheetName = gradeMatch[1] + " Groups";
}
  const cache = groupSheetsData[sheetName];
  if (!cache) return;
  
  const data = cache.values;
  const cleanStudentName = studentName.toString().trim().toUpperCase();
  const cleanGroupName = groupName.toString().trim().toUpperCase();
  const cleanLessonName = lessonName.toString().trim().toUpperCase();
  
  // Find the group header row (searches by content, not absolute position)
  let groupStartRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim().toUpperCase() === cleanGroupName) {
      groupStartRow = i;
      break;
    }
  }
  if (groupStartRow === -1) return;
  
  // The sub-header row with lesson names is 2 rows after the group header
  // Structure: Group Header → "Student Name" header → Lesson Names sub-header → Student rows
  const subHeaderRowIdx = groupStartRow + 2;
  if (subHeaderRowIdx >= data.length) return;
  
  const subHeaderRow = data[subHeaderRowIdx];
  
  // Find the column that matches this lesson name EXACTLY
  let lessonColIdx = -1;
  for (let j = 1; j < subHeaderRow.length; j++) {
    const headerLesson = subHeaderRow[j] ? subHeaderRow[j].toString().trim().toUpperCase() : "";
    
    if (headerLesson === cleanLessonName) {
      // Exact match found
      lessonColIdx = j;
      break;
    }
    
    // Also try matching by lesson number for UFLI lessons
    // This handles cases where form sends "UFLI L101" but sheet has "UFLI L101 -ly"
    const headerLessonNum = extractLessonNumber(headerLesson);
    const inputLessonNum = extractLessonNumber(cleanLessonName);
    if (headerLessonNum && inputLessonNum && headerLessonNum === inputLessonNum) {
      lessonColIdx = j;
      break;
    }
  }
  
  if (lessonColIdx === -1) {
    // No matching column found - this lesson isn't on this group's sheet
    return;
  }
  
  // Find the student row within this group and update
  // Students start 3 rows after group header
  for (let k = groupStartRow + 3; k < data.length; k++) {
    const cellA = data[k][0] ? data[k][0].toString().trim().toUpperCase() : "";
    
    // Stop if we hit an empty row or another group header
    if (!cellA || (cellA.includes("GROUP") && cellA !== cleanGroupName)) break;
    
    if (cellA === cleanStudentName) {
      data[k][lessonColIdx] = status;
      cache.dirty = true;
      break;
    }
  }
}
function updateGroupArrayInMemory(groupSheetsData, groupName, studentName, lessonNum, status) {
let sheetName = null;

if (groupName.startsWith("SC Classroom")) {
  sheetName = "SC Classroom";
} else {
  const gradeMatch = groupName.match(/^([A-Za-z0-9]+)/);
  if (!gradeMatch) return;
  sheetName = gradeMatch[1] + " Groups";
}
  const cache = groupSheetsData[sheetName];
  if (!cache) return;
  
  const data = cache.values;
  const cleanStudentName = studentName.toString().trim().toUpperCase();
  const cleanGroupName = groupName.toString().trim().toUpperCase();
  
  let groupStartRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim().toUpperCase() === cleanGroupName) {
      groupStartRow = i;
      break;
    }
  }
  if (groupStartRow === -1) return;
  
  const subHeaderRowIdx = groupStartRow + 2;
  if (subHeaderRowIdx >= data.length) return;
  
  const subHeaderRow = data[subHeaderRowIdx];
  let lessonColIdx = -1;
  for (let j = 1; j < subHeaderRow.length; j++) {
    if (extractLessonNumber(subHeaderRow[j]) === lessonNum) {
      lessonColIdx = j;
      break;
    }
  }
  if (lessonColIdx === -1) return;
  
  for (let k = groupStartRow + 3; k < data.length; k++) {
    const cellA = data[k][0] ? data[k][0].toString().trim().toUpperCase() : "";
    if (!cellA || (cellA.includes("GROUP") && cellA !== cleanGroupName)) break;
    if (cellA === cleanStudentName) {
      data[k][lessonColIdx] = status;
      cache.dirty = true;
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Merge Initial + Current (Suppress Negative Growth)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a merged row where 'Y' takes precedence from either source
 * If a student passed a lesson in EITHER initial assessment OR current progress, count as 'Y'
 * This ensures students don't lose credit for previously mastered skills
 * 
 * @param {Array} currentRow - Student's current row from UFLI MAP
 * @param {Array} initialRow - Student's row from Initial Assessment (may be undefined)
 * @returns {Array} Merged row with 'Y' preserved from either source
 */
function createMergedRow(currentRow, initialRow) {
  if (!initialRow) return currentRow;
  
  const merged = [...currentRow];
  
  // Merge lesson columns (starting at LESSON_COLUMN_OFFSET)
  for (let i = LAYOUT.LESSON_COLUMN_OFFSET; i < merged.length; i++) {
    const currentStatus = merged[i] ? merged[i].toString().toUpperCase().trim() : "";
    const initialStatus = (i < initialRow.length && initialRow[i]) 
      ? initialRow[i].toString().toUpperCase().trim() : "";
    
    // If initial was 'Y', preserve it (don't let current 'N' or blank override)
    if (initialStatus === 'Y' && currentStatus !== 'Y') {
      merged[i] = 'Y';
    }
  }
  
  return merged;
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE ALL STATS (v5.3 - Suppress Negative Growth)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculates and Writes stats for BOTH UFLI (K-8) and HWT (Pre-K)
 * Merges data into Skills Tracker and Grade Summary
 * 
 * v5.1 FIXES:
 * - Skip PreK students in UFLI loop (prevents duplicates)
 * - Correct PreK metric mapping (Form→Foundational, Name+Sound→MinGrade, All→FullGrade)
 * - Use fixed denominators for PreK (26/52/78)
 * 
 * v5.2 FIX:
 * - Benchmark Status now based on Min Grade Skills % (not Foundational) for K-8
 * 
 * v5.3 FIX:
 * - Suppress negative growth: If student passed in Initial Assessment, preserve 'Y'
 * - Uses merged row (best of Initial + Current) for benchmark calculations
 */
function updateAllStats(ss, mapData) {
  const functionName = 'updateAllStats';
  
  // 1. GET UFLI DATA
  if (!mapData) {
    const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);
    mapData = mapSheet ? mapSheet.getDataRange().getValues() : [];
  }

  // 2. GET PRE-K DATA
  const preKSheet = ss.getSheetByName(SHEET_NAMES_PREK.DATA);
  let preKData = [];
  let preKHeaders = [];
  if (preKSheet) {
    preKData = preKSheet.getDataRange().getValues();
    if (preKData.length >= PREK_CONFIG.HEADER_ROW) {
      preKHeaders = preKData[PREK_CONFIG.HEADER_ROW - 1];
    }
  }

  // 3. READ INITIAL ASSESSMENT DATA (for growth suppression)
  const initialSheet = ss.getSheetByName(SHEET_NAMES_V2.INITIAL_ASSESSMENT);
  const initialData = initialSheet ? initialSheet.getDataRange().getValues() : [];
  const initialMap = {};
  for (let i = LAYOUT.DATA_START_ROW - 1; i < initialData.length; i++) {
    if (initialData[i][0]) {
      initialMap[initialData[i][0].toString().trim().toUpperCase()] = initialData[i];
    }
  }
  
  // Output Arrays
  const skillsOutput = []; 
  const summaryOutput = []; 
  const skillEntries = Object.entries(SKILL_SECTIONS);
  
  // --- PROCESS UFLI STUDENTS (K-8) ---
  for (let i = LAYOUT.DATA_START_ROW - 1; i < mapData.length; i++) {
    const row = mapData[i];
    if (!row[0]) continue; // Skip blank names
    
    // Skip PreK students - they are handled separately from Pre-K Data sheet
    if (row[1] && row[1].toString().trim() === "PreK") continue;

    const metadata = [row[0], row[1], row[2], row[3]]; // Name, Grade, Teacher, Group
    const cleanName = row[0].toString().trim().toUpperCase();
    const initialRow = initialMap[cleanName];
    const grade = row[1];

    // Create merged row for calculations (preserves 'Y' from either source)
    const mergedRow = createMergedRow(row, initialRow);

    // Skills Tracker Row (uses merged data to prevent negative growth)
    // Uses weighted review logic: reviews act as gateway tests for section credit
    const skillsRow = [...metadata];
    skillEntries.forEach(([_, lessons]) => {
      skillsRow.push(calculateSectionPercentage(mergedRow, lessons, false));
    });
    skillsOutput.push(skillsRow);

    // Grade Summary Row
    const summaryRow = [...metadata];
    const metrics = GRADE_METRICS[grade];

    if (metrics) {
      // Use merged row for benchmark calculations (suppresses negative growth)
      const foundPct = calculateBenchmark(mergedRow, metrics.foundational.lessons, metrics.foundational.denominator);
      const minPct = calculateBenchmark(mergedRow, metrics.minimum.lessons, metrics.minimum.denominator);
      const fullPct = calculateBenchmark(mergedRow, metrics.currentYear.lessons, metrics.currentYear.denominator);
      
      summaryRow.push(foundPct);
      summaryRow.push(minPct);
      summaryRow.push(fullPct);
      
      // Benchmark Status based on Min Grade Skills % (v5.2 fix)
      const status = getPerformanceStatus(minPct);
      summaryRow.push(status);
    } else {
      summaryRow.push("", "", "", "");
    }

    // Add Detailed Skill Sections (Initial/AG/Total)
    // Note: AG (Additive Growth) uses merged row for Total, so growth is always >= 0
    // Initial uses isInitialAssessment=true to exclude review lessons from baseline
    // Total uses isInitialAssessment=false to include weighted review logic
    skillEntries.forEach(([_, lessons]) => {
      const totalPct = calculateSectionPercentage(mergedRow, lessons, false);
      const initialPct = initialRow ? calculateSectionPercentage(initialRow, lessons, true) : "";

      // Growth is always non-negative since mergedRow includes all initial 'Y' values
      let agPct = "";
      if (totalPct !== "" && initialPct !== "") {
        agPct = Math.max(0, totalPct - initialPct); // Extra safety: floor at 0
      }

      summaryRow.push(initialPct, agPct, totalPct);
    });
    summaryOutput.push(summaryRow);
  }

  // --- PROCESS PRE-K STUDENTS (HWT) ---
  if (preKData.length > 0) {
    for (let i = PREK_CONFIG.DATA_START_ROW - 1; i < preKData.length; i++) {
      const row = preKData[i];
      if (!row[0]) continue;

      // HWT Sheet Structure: [Name, Group, Program, ...] 
      // We map this to: [Name, "PreK", "", Group]
      const metadata = [row[0], "PreK", "", row[1]]; 
      
      // Use corrected calculatePreKScores with fixed denominators
      const scores = calculatePreKScores(row, preKHeaders);

      // Skills Tracker Row (PreK doesn't use UFLI Skills, fill with blanks)
      const skillsRow = [...metadata];
      skillEntries.forEach(() => skillsRow.push(""));
      skillsOutput.push(skillsRow);

      // Grade Summary Row
      const summaryRow = [...metadata];
      
      // PreK Mapping:
      // Foundational Skills % = Form / 26 (Motor Integration)
      // Min Grade Skills %    = (Name + Sound) / 52 (Literacy Knowledge)
      // Full Grade Skills %   = (Name + Sound + Form) / 78 (K-Readiness)
      summaryRow.push(scores.foundational);  // Form / 26
      summaryRow.push(scores.minGrade);      // (Name + Sound) / 52
      summaryRow.push(scores.fullGrade);     // (Name + Sound + Form) / 78
      
      // Status Logic for PreK (based on Full Grade Skills - K-Readiness)
      const status = getPerformanceStatus(scores.fullGrade);
      summaryRow.push(status);

      // Fill remaining detailed columns with blanks (PreK doesn't use UFLI skill sections)
      skillEntries.forEach(() => summaryRow.push("", "", ""));
      
      summaryOutput.push(summaryRow);
    }
  }

  // --- WRITE DATA ---
  
  // 1. Skills Tracker
  const skillsSheet = getOrCreateSheet(ss, SHEET_NAMES_V2.SKILLS, false);
  if (skillsOutput.length > 0) {
    // Sort combined list by Grade, then Name
    skillsOutput.sort((a, b) => (a[1] || "").localeCompare(b[1] || "") || (a[0] || "").localeCompare(b[0] || ""));
    
    skillsSheet.getRange(LAYOUT.DATA_START_ROW, 1, skillsOutput.length, skillsOutput[0].length).setValues(skillsOutput);
    skillsSheet.getRange(LAYOUT.DATA_START_ROW, 5, skillsOutput.length, skillsOutput[0].length - 4).setNumberFormat('0"%"');
  }
  
  // 2. Grade Summary
  const summarySheet = getOrCreateSheet(ss, SHEET_NAMES_V2.GRADE_SUMMARY, false);
  if (summaryOutput.length > 0) {
    // Sort combined list by Grade, then Name
    summaryOutput.sort((a, b) => (a[1] || "").localeCompare(b[1] || "") || (a[0] || "").localeCompare(b[0] || ""));

    summarySheet.getRange(LAYOUT.DATA_START_ROW, 1, summaryOutput.length, summaryOutput[0].length).setValues(summaryOutput);
    
    // Formatting
    summarySheet.getRange(LAYOUT.DATA_START_ROW, 5, summaryOutput.length, 3).setNumberFormat('0"%"'); // Main metrics
    const remainingCols = summaryOutput[0].length - 8;
    if (remainingCols > 0) {
      summarySheet.getRange(LAYOUT.DATA_START_ROW, 9, summaryOutput.length, remainingCols).setNumberFormat('0"%"');
    }
  }
}

function updateStatsForNewStudents() {
  const functionName = 'updateStatsForNewStudents';
  log(functionName, 'Updating stats for new students...');
  syncSmallGroupProgress(); // Sync will handle everything
  log(functionName, 'Update complete.');
}

function updateAllProgress() {
  syncSmallGroupProgress();
  updatePacingReports();
  SpreadsheetApp.getUi().alert('Update Complete', 'All progress data synced and statistics recalculated.', SpreadsheetApp.getUi().ButtonSet.OK);
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHOOL SUMMARY DASHBOARD ENGINE (v2 - Polished UI)
// ═══════════════════════════════════════════════════════════════════════════

// Dashboard Color Palette
const DASHBOARD_COLORS = {
  HEADER_BG: "#1a73e8",        // Google Blue - main header
  HEADER_TEXT: "#ffffff",
  GRADE_HEADER_BG: "#4285f4",  // Lighter blue for grade headers
  GRADE_HEADER_TEXT: "#ffffff",
  SECTION_LABEL: "#5f6368",    // Gray for section labels
  TABLE_HEADER_BG: "#e8eaed",  // Light gray for table headers
  TABLE_ALT_ROW: "#f8f9fa",    // Subtle alternating rows
  CARD_BORDER: "#dadce0",      // Card border color
  
  // Status colors
  ON_TRACK: "#34a853",         // Green
  ON_TRACK_BG: "#e6f4ea",
  PROGRESSING: "#fbbc04",      // Yellow/Amber
  PROGRESSING_BG: "#fef7e0",
  AT_RISK: "#ea4335",          // Red
  AT_RISK_BG: "#fce8e6",
  
  // Progress bar
  BAR_FILL: "#1a73e8",
  BAR_EMPTY: "#e8eaed"
};

function updateSchoolSummary() {
  const functionName = 'updateSchoolSummary';
  log(functionName, 'Generating Full School Summary Dashboard...');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = getOrCreateSheet(ss, SHEET_NAMES_V2.SCHOOL_SUMMARY, false); 
  
  // 1. GATHER DATA SOURCES
  const studentData = getSheetDataAsMap(ss, SHEET_NAMES_V2.GRADE_SUMMARY);
  const pacingSheet = ss.getSheetByName(SHEET_NAMES_PACING.DASHBOARD);
  const pacingData = pacingSheet ? pacingSheet.getDataRange().getValues().slice(5) : [];
  const initialData = getSheetDataAsMap(ss, SHEET_NAMES_V2.INITIAL_ASSESSMENT);
  
  // --- NEW: GET COUNTS FROM CONFIGURATION ---
  const configCounts = (typeof getGradeCountsFromConfig === 'function') 
    ? getGradeCountsFromConfig(ss) 
    : {};
  
  const configSheetName = (typeof SHEET_NAMES !== 'undefined' && SHEET_NAMES.CONFIG) 
    ? SHEET_NAMES.CONFIG : "Site Configuration";
  const configSheet = ss.getSheetByName(configSheetName);
  const schoolName = configSheet && configSheet.getLastRow() > 1 
    ? configSheet.getRange(2, 2).getValue() : "UFLI Site";
  
  // 2. INITIAL SETUP
  summarySheet.clear();
  summarySheet.clearConditionalFormatRules();
  
  summarySheet.setColumnWidth(1, 200); 
  summarySheet.setColumnWidth(2, 90);   
  summarySheet.setColumnWidth(3, 90);   
  summarySheet.setColumnWidth(4, 90);   
  summarySheet.setColumnWidth(5, 90);   
  summarySheet.setColumnWidth(6, 90);   
  summarySheet.setColumnWidth(7, 90);   
  summarySheet.getRange(1, 1, 500, 7).setFontFamily("Calibri");
  
  // 3. RENDER HEADER
  let currentRow = renderDashboardHeader(summarySheet, schoolName);
  
  // 4. DEFINE GRADES
  let grades = [];
  try {
    grades = getExistingGrades(configSheet);
  } catch (e) {
    grades = ['PreK', 'KG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];
    log(functionName, "Warning: Could not fetch existing grades, using defaults.", "WARN");
  }

  // 5. GRADE-LEVEL PROCESSING LOOP
  if (grades && grades.length > 0) {
    grades.forEach(grade => {
      const gradeStudents = Array.from(studentData.values()).filter(s => s[1] && s[1].toString() === grade);
      const gradeGroups = pacingData.filter(row => row[0] && row[0].toString().startsWith(grade));
      
      const totalStudentCount = configCounts[grade] || gradeStudents.length;

      if (gradeStudents.length === 0 && !configCounts[grade]) return;

      currentRow = renderGradeCard(
        summarySheet,       // sheet
        currentRow,         // startRow
        grade,              // grade
        gradeStudents,      // students
        gradeGroups,        // groups
        initialData,        // initialData
        totalStudentCount   // overrideCount
      );
    });
  }

  // 6. MIXED GRADE TABLE
  if (typeof ENABLE_MIXED_GRADES !== 'undefined' && ENABLE_MIXED_GRADES) {
    log(functionName, 'Mixed grades enabled, checking for renderMixedGradeGroupTable...');
    if (typeof renderMixedGradeGroupTable === 'function') {
      log(functionName, `Calling renderMixedGradeGroupTable with ${pacingData.length} pacing rows`);
      currentRow = renderMixedGradeGroupTable(summarySheet, currentRow, pacingData);
    } else {
      log(functionName, 'WARNING: renderMixedGradeGroupTable function not found!', 'WARN');
    }
  } else {
    log(functionName, 'Mixed grades not enabled, skipping Group Performance table');
  }
  
  summarySheet.setFrozenRows(4);
  log(functionName, 'School Summary Update Complete.');
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADER RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function renderDashboardHeader(sheet, schoolName) {
  // Row 1: Main title bar (no merge)
  sheet.getRange(1, 1).setValue(`SCHOOL SUMMARY DASHBOARD`);
  sheet.getRange(1, 1, 1, 5).setBackground(DASHBOARD_COLORS.HEADER_BG);
  sheet.getRange(1, 1).setFontColor(DASHBOARD_COLORS.HEADER_TEXT)
    .setFontSize(18)
    .setFontWeight("bold")
    .setFontFamily("Calibri")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 50);

  // Row 2: School name (no merge)
  sheet.getRange(2, 1).setValue(schoolName);
  sheet.getRange(2, 1).setFontSize(12)
    .setFontWeight("bold")
    .setFontFamily("Calibri")
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL)
    .setVerticalAlignment("middle");

  sheet.getRange(2, 5).setValue(`Updated: ${new Date().toLocaleDateString()}`);
  sheet.getRange(2, 5).setFontSize(10)
    .setFontFamily("Calibri")
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL)
    .setHorizontalAlignment("right")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(2, 30);

// Row 3: Dashboard description (MERGED)
const description = "Growth & Pacing Metrics: Initial average, current average, growth percentage, and instructional pacing rate  •  " +
  "Student Distribution: Visual breakdown of students On Track (80%+), Progressing (50-79%), and Needs Support (<50%)  •  " +
  "Group Performance Table: Pass rate and Absenteeism rate for each instructional group with status indicators";

const descRange = sheet.getRange(3, 1, 1, 5);
descRange.merge();  // ✅ MERGE cells A3:E3
descRange.setValue(description)
  .setBackground("#f8f9fa")
  .setFontSize(9)
  .setFontColor(DASHBOARD_COLORS.SECTION_LABEL)
  .setFontStyle("italic")
  .setFontFamily("Calibri")
  .setVerticalAlignment("middle")
  .setHorizontalAlignment("left")
  .setWrap(true);
sheet.setRowHeight(3, 45);

  // Row 4: Subtle divider line
  sheet.getRange(4, 1, 1, 5)
    .setBorder(null, null, true, null, null, null, DASHBOARD_COLORS.CARD_BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(4, 8);

  // Row 5: Spacer
  sheet.setRowHeight(5, 15);

  return 6; // Next available row (shifted down by 1)
}

// ═══════════════════════════════════════════════════════════════════════════
// GRADE CARD RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function renderGradeCard(sheet, startRow, grade, students, groups, initialData, overrideCount) {
  let row = startRow;
  
  // Use overrideCount if provided, otherwise use students.length
  const displayCount = overrideCount !== undefined ? overrideCount : students.length;

  const headerText = (typeof ENABLE_MIXED_GRADES !== 'undefined' && ENABLE_MIXED_GRADES) 
    ? `${grade}  •  ${displayCount} students`
    : `${grade}  •  ${displayCount} students  •  ${groups.length} groups`;

  // Grade header (no merge)
  sheet.getRange(row, 1).setValue(headerText);
  sheet.getRange(row, 1, 1, 5).setBackground(DASHBOARD_COLORS.GRADE_HEADER_BG);
  sheet.getRange(row, 1).setFontColor(DASHBOARD_COLORS.GRADE_HEADER_TEXT)
    .setFontSize(13)
    .setFontWeight("bold")
    .setFontFamily("Calibri")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(row, 36);
  row++;
  
  // Small spacer
  sheet.setRowHeight(row, 10);
  row++;

  // --- METRICS ROW ---
  const growth = calculateGrowthMetrics(students, initialData, grade);
  const bands = calculateDistributionBands(students);
  
  let pace;
  if (groups.length === 0 && typeof ENABLE_MIXED_GRADES !== 'undefined' && ENABLE_MIXED_GRADES) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pacingSheet = ss.getSheetByName(SHEET_NAMES_PACING.DASHBOARD);
    const allPacingData = pacingSheet ? pacingSheet.getDataRange().getValues().slice(5) : [];
    pace = calculateGradePacing(allPacingData);
  } else {
    pace = calculateGradePacing(groups);
  }
  
  row = renderMetricsRow(sheet, row, growth, bands, pace, students.length);
  row = renderDistributionSection(sheet, row, bands, students.length);
  
  if (groups.length > 0 && !(typeof ENABLE_MIXED_GRADES !== 'undefined' && ENABLE_MIXED_GRADES)) {
    row = renderGroupTable(sheet, row, groups);
  }
  
  sheet.getRange(row, 1, 1, 5)
    .setBorder(null, null, true, null, null, null, DASHBOARD_COLORS.CARD_BORDER, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  row++;
  
  sheet.setRowHeight(row, 20);
  row++;
  
  return row;
}
// ═══════════════════════════════════════════════════════════════════════════
// METRICS ROW (Growth + Pacing Summary)
// ═══════════════════════════════════════════════════════════════════════════

function renderMetricsRow(sheet, row, growth, bands, pace, totalStudents) {
  // Section label
  sheet.getRange(row, 1).setValue("📈 Growth Metrics")
    .setFontWeight("bold")
    .setFontSize(11)
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
  row++;
  
  // === HEADER ROW (4 columns now, no Pacing) ===
  sheet.getRange(row, 1, 1, 4).setValues([["Metric", "Initial", "Current", "Growth"]])
    .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center");
  sheet.setRowHeight(row, 26);
  row++;
  
  // === FOUNDATIONAL SKILLS ROW ===
  const foundValues = [
    "Foundational Skills",
    growth.foundInitialAvg / 100,
    growth.foundCurrentAvg / 100,
    (growth.foundGrowth >= 0 ? "+" : "") + growth.foundGrowth + "%"
  ];
  
  sheet.getRange(row, 1, 1, 4).setValues([foundValues])
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setFontSize(10);
  
  sheet.getRange(row, 1).setHorizontalAlignment("left").setFontWeight("bold");
  sheet.getRange(row, 2, 1, 2).setNumberFormat("0%");
  
  // Color-code foundational growth
  const foundGrowthCell = sheet.getRange(row, 4);
  if (growth.foundGrowth > 5) {
    foundGrowthCell.setFontColor(DASHBOARD_COLORS.ON_TRACK).setFontWeight("bold");
  } else if (growth.foundGrowth < 0) {
    foundGrowthCell.setFontColor(DASHBOARD_COLORS.AT_RISK).setFontWeight("bold");
  }
  
  sheet.setRowHeight(row, 28);
  row++;
  
  // === MIN GRADE SKILLS ROW ===
  const minValues = [
    "Min Grade Skills",
    growth.minInitialAvg / 100,
    growth.minCurrentAvg / 100,
    (growth.minGrowth >= 0 ? "+" : "") + growth.minGrowth + "%"
  ];
  
  sheet.getRange(row, 1, 1, 4).setValues([minValues])
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setFontSize(10)
    .setBackground(DASHBOARD_COLORS.TABLE_ALT_ROW);
  
  sheet.getRange(row, 1).setHorizontalAlignment("left").setFontWeight("bold");
  sheet.getRange(row, 2, 1, 2).setNumberFormat("0%");
  
  // Color-code min grade growth
  const minGrowthCell = sheet.getRange(row, 4);
  if (growth.minGrowth > 5) {
    minGrowthCell.setFontColor(DASHBOARD_COLORS.ON_TRACK).setFontWeight("bold");
  } else if (growth.minGrowth < 0) {
    minGrowthCell.setFontColor(DASHBOARD_COLORS.AT_RISK).setFontWeight("bold");
  }
  
  sheet.setRowHeight(row, 28);
  row++;
  
  // === FULL GRADE SKILLS ROW ===
  const fullValues = [
    "Full Grade Skills",
    growth.fullInitialAvg / 100,
    growth.fullCurrentAvg / 100,
    (growth.fullGrowth >= 0 ? "+" : "") + growth.fullGrowth + "%"
  ];
  
  sheet.getRange(row, 1, 1, 4).setValues([fullValues])
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setFontSize(10);
  
  sheet.getRange(row, 1).setHorizontalAlignment("left").setFontWeight("bold");
  sheet.getRange(row, 2, 1, 2).setNumberFormat("0%");
  
  // Color-code full grade growth
  const fullGrowthCell = sheet.getRange(row, 4);
  if (growth.fullGrowth > 5) {
    fullGrowthCell.setFontColor(DASHBOARD_COLORS.ON_TRACK).setFontWeight("bold");
  } else if (growth.fullGrowth < 0) {
    fullGrowthCell.setFontColor(DASHBOARD_COLORS.AT_RISK).setFontWeight("bold");
  }
  
  sheet.setRowHeight(row, 28);
  row++;
  
  // Spacer
  sheet.setRowHeight(row, 12);
  row++;
  
  return row;
}


// ═══════════════════════════════════════════════════════════════════════════
// DISTRIBUTION BARS (Visual Progress Indicators)
// ═══════════════════════════════════════════════════════════════════════════

function renderDistributionSection(sheet, row, bands, totalStudents) {
  // Section label
  sheet.getRange(row, 1).setValue("📊 Student Distribution")
    .setFontWeight("bold")
    .setFontSize(11)
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
  row++;
  
  // Render each band
  row = renderProgressBar(sheet, row, "On Track (80%+)", bands.onTrack, totalStudents, 
    DASHBOARD_COLORS.ON_TRACK, DASHBOARD_COLORS.ON_TRACK_BG);
  row = renderProgressBar(sheet, row, "Progressing (50-79%)", bands.progressing, totalStudents, 
    DASHBOARD_COLORS.PROGRESSING, DASHBOARD_COLORS.PROGRESSING_BG);
  row = renderProgressBar(sheet, row, "Needs Support (<50%)", bands.atRisk, totalStudents, 
    DASHBOARD_COLORS.AT_RISK, DASHBOARD_COLORS.AT_RISK_BG);
  
  // Spacer
  sheet.setRowHeight(row, 12);
  row++;
  
  return row;
}

function renderProgressBar(sheet, row, label, count, total, accentColor, bgColor) {
  const percentage = total > 0 ? count / total : 0;
  const pctDisplay = Math.round(percentage * 100) + "%";
  
  // Column 1: Label
  sheet.getRange(row, 1)
    .setValue(label)
    .setFontSize(10)
    .setVerticalAlignment("middle");
  
  // Columns 2-4: Progress bar (merged cells with background trick)
  const barRange = sheet.getRange(row, 2, 1, 3).merge();
  barRange.setBackground(DASHBOARD_COLORS.BAR_EMPTY);
  
  // Create visual bar using the value + background approach
  barRange.setValue(`${count} students (${pctDisplay})`)
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle")
    .setFontSize(10)
    .setFontWeight("bold")
    .setFontColor(accentColor);
  
  // Apply partial background fill using conditional formatting
  if (percentage > 0) {
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("student")
      .setBackground(bgColor)
      .setRanges([barRange])
      .build();
    const rules = sheet.getConditionalFormatRules();
    rules.push(rule);
    sheet.setConditionalFormatRules(rules);
  }
  
  // Column 5: Visual indicator dot
  sheet.getRange(row, 5)
    .setValue(percentage >= 0.5 ? "●" : (percentage >= 0.2 ? "◐" : "○"))
    .setFontColor(accentColor)
    .setHorizontalAlignment("center")
    .setFontSize(14);
  
  sheet.setRowHeight(row, 26);
  
  return row + 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATION HELPERS (Dashboard)
// ═══════════════════════════════════════════════════════════════════════════

function calculateGrowthMetrics(students, initialData, grade) {
  let foundInitialSum = 0, foundCurrentSum = 0, foundCount = 0;
  let minInitialSum = 0, minCurrentSum = 0, minCount = 0;
  let fullInitialSum = 0, fullCurrentSum = 0, fullCount = 0;
  
  // Get the correct metric configuration for this grade
  const metrics = GRADE_METRICS[grade];
  
  students.forEach(s => {
    const studentName = s[0];
    
    // Current values from Grade Summary
    // Column indices: 4 = Foundational, 5 = Min Grade, 6 = Full Grade
    const currentFoundational = parseFloat(s[4]) || 0;
    const currentMinGrade = parseFloat(s[5]) || 0;
    const currentFullGrade = parseFloat(s[6]) || 0;
    
    // Get initial values - calculate from Initial Assessment data
    let initialFoundational = 0;
    let initialMinGrade = 0;
    let initialFullGrade = 0;
    
    if (initialData && initialData.has(studentName)) {
      const initialRow = initialData.get(studentName);
      
      // Calculate initial metrics using the same logic as updateAllStats
      if (metrics) {
        initialFoundational = calculateBenchmarkFromRow(initialRow, metrics.foundational.lessons, metrics.foundational.denominator);
        initialMinGrade = calculateBenchmarkFromRow(initialRow, metrics.minimum.lessons, metrics.minimum.denominator);
        initialFullGrade = calculateBenchmarkFromRow(initialRow, metrics.currentYear.lessons, metrics.currentYear.denominator);
      }
    }
    
    // Foundational stats
    if (currentFoundational > 0 || initialFoundational > 0) {
      foundInitialSum += initialFoundational;
      foundCurrentSum += currentFoundational;
      foundCount++;
    }
    
    // Min Grade stats
    if (currentMinGrade > 0 || initialMinGrade > 0) {
      minInitialSum += initialMinGrade;
      minCurrentSum += currentMinGrade;
      minCount++;
    }
    
    // Full Grade stats
    if (currentFullGrade > 0 || initialFullGrade > 0) {
      fullInitialSum += initialFullGrade;
      fullCurrentSum += currentFullGrade;
      fullCount++;
    }
  });
  
  const foundInitialAvg = foundCount > 0 ? Math.round(foundInitialSum / foundCount) : 0;
  const foundCurrentAvg = foundCount > 0 ? Math.round(foundCurrentSum / foundCount) : 0;
  
  const minInitialAvg = minCount > 0 ? Math.round(minInitialSum / minCount) : 0;
  const minCurrentAvg = minCount > 0 ? Math.round(minCurrentSum / minCount) : 0;
  
  const fullInitialAvg = fullCount > 0 ? Math.round(fullInitialSum / fullCount) : 0;
  const fullCurrentAvg = fullCount > 0 ? Math.round(fullCurrentSum / fullCount) : 0;
  
  return { 
    // Foundational metrics
    foundInitialAvg, 
    foundCurrentAvg, 
    foundGrowth: foundCurrentAvg - foundInitialAvg,
    
    // Min Grade metrics
    minInitialAvg,
    minCurrentAvg,
    minGrowth: minCurrentAvg - minInitialAvg,
    
    // Full Grade metrics
    fullInitialAvg,
    fullCurrentAvg,
    fullGrowth: fullCurrentAvg - fullInitialAvg,
    
    // Legacy compatibility
    initialAvg: foundInitialAvg,
    currentAvg: foundCurrentAvg,
    growth: foundCurrentAvg - foundInitialAvg
  };
}
/**
 * Simplified benchmark calculation (no gateway logic)
 * Used for Initial Assessment and quick estimates where gateway logic isn't needed.
 * Simply counts Y's in non-review lessons.
 *
 * @param {Array} row - Student's row data
 * @param {Array<number>} lessonIndices - Lesson numbers to check
 * @param {number} denominator - (unused, kept for API compatibility)
 * @returns {number} Percentage integer (0-100)
 */
function calculateBenchmarkFromRow(row, lessonIndices, denominator) {
  if (!row || !lessonIndices || lessonIndices.length === 0) return 0;

  const { nonReviews } = partitionLessonsByReview(lessonIndices);
  if (nonReviews.length === 0) return 0;

  let passed = 0;
  for (const lessonNum of nonReviews) {
    if (getLessonStatus(row, lessonNum) === 'Y') passed++;
  }

  return Math.round((passed / nonReviews.length) * 100);
}
function calculateDistributionBands(students) {
  const bands = { onTrack: 0, progressing: 0, atRisk: 0 };
  students.forEach(s => {
    const score = parseFloat(s[5]) || 0;  // s[5] = Min Grade Skills % (v5.2 fix)
    if (score >= PERFORMANCE_THRESHOLDS.ON_TRACK) bands.onTrack++;
    else if (score >= PERFORMANCE_THRESHOLDS.NEEDS_SUPPORT) bands.progressing++;
    else bands.atRisk++;
  });
  return bands;
}

function calculateGradePacing(groups) {
  if (groups.length === 0) return { assigned: 0, completed: 0, pacing: 0 };
  
  let totalPacing = 0;
  let groupCount = 0;
  
  groups.forEach(g => {
    // Column F (index 6) = Pacing % (stored as decimal, e.g., 0.44)
    const groupPacing = parseFloat(g[5]) || 0;
    if (groupPacing > 0) {
      totalPacing += groupPacing;
      groupCount++;
    }
  });
  
  // Average pacing across all groups
  const avgPacing = groupCount > 0 ? totalPacing / groupCount : 0;
  
  return { 
    assigned: 0, 
    completed: 0, 
    pacing: Math.round(avgPacing * 100)
  };
}
// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getSheetDataAsMap(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  const map = new Map();
  if (!sheet) return map;
  
  const data = sheet.getDataRange().getValues();
  const startIndex = Math.max(0, LAYOUT.DATA_START_ROW - 1);

  for (let i = startIndex; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {
      map.set(row[0].toString(), row);
    }
  }
  return map;
}

function getExistingGrades(configSheet) {
  // Dynamically get grades from Grade Summary instead of hardcoded list
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName(SHEET_NAMES_V2.GRADE_SUMMARY);
  
  if (!summarySheet || summarySheet.getLastRow() < LAYOUT.DATA_START_ROW) {
    // Fallback to hardcoded list if no data
    return ['PreK', 'KG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];
  }
  
  // Read all grades from column B (index 1)
  const gradeData = summarySheet.getRange(LAYOUT.DATA_START_ROW, 2, 
    summarySheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 1).getValues();
  
  // Get unique grades
  const uniqueGrades = [...new Set(gradeData.map(r => r[0]).filter(g => g))];
  
  // Sort grades in logical order
  const gradeOrder = ['PreK', 'KG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];
  uniqueGrades.sort((a, b) => {
    const aStr = a.toString();
    const bStr = b.toString();
    const aIdx = gradeOrder.indexOf(aStr);
    const bIdx = gradeOrder.indexOf(bStr);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return aStr.localeCompare(bStr);
  });
  
  return uniqueGrades;
}


// ═══════════════════════════════════════════════════════════════════════════
// REPAIR & MAINTENANCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function regenerateSystemSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Regenerate System Sheets?', 'This will recreate all tracking sheets. Data in Small Group Progress will be preserved.', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;
  
  try {
    const wizardData = getWizardData();
    if (!wizardData) throw new Error('Could not retrieve wizard data');
    
    createUFLIMapSheet(ss, wizardData);
    createSkillsSheet(ss, wizardData);
    createGradeSummarySheet(ss, wizardData);
    createGradeGroupSheets(ss, wizardData);
    createPacingReports(ss);
    
    syncSmallGroupProgress();
    
    ui.alert('Success', 'System sheets regenerated successfully!', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('Error', error.toString(), ui.ButtonSet.OK);
  }
}

function fixMissingTeachers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const progressSheet = ss.getSheetByName(SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
  const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);
  if (!progressSheet || !mapSheet) return;
  
  const mapData = mapSheet.getDataRange().getValues();
  const teacherByGroup = {};
  for (let i = LAYOUT.DATA_START_ROW - 1; i < mapData.length; i++) {
    if (mapData[i][2] && mapData[i][3]) teacherByGroup[mapData[i][3].toString().trim()] = mapData[i][2];
  }
  
  const progressData = progressSheet.getRange(LAYOUT.DATA_START_ROW, 1, progressSheet.getLastRow(), 6).getValues();
  let updatesCount = 0;
  for (let i = 0; i < progressData.length; i++) {
    if ((!progressData[i][1] || progressData[i][1] === "Unknown Teacher") && progressData[i][2]) {
      const correct = teacherByGroup[progressData[i][2].toString().trim()];
      if (correct) {
        progressData[i][1] = correct;
        updatesCount++;
      }
    }
  }
  if (updatesCount > 0) {
    progressSheet.getRange(LAYOUT.DATA_START_ROW, 1, progressData.length, 6).setValues(progressData);
    SpreadsheetApp.getUi().alert(`Fixed ${updatesCount} rows.`);
  } else {
    SpreadsheetApp.getUi().alert('No updates needed.');
  }
}

function repairSkillsTrackerFormulas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  updateAllStats(ss);
  SpreadsheetApp.getUi().alert('Skills Tracker values recalculated.');
}

function repairGradeSummaryFormulas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  updateAllStats(ss);
  SpreadsheetApp.getUi().alert('Grade Summary values recalculated.');
}

function repairAllFormulas() {
  syncSmallGroupProgress();
  SpreadsheetApp.getUi().alert('All sheets synced and values recalculated.');
}

function repairCurrentLessonFormulas() {
  syncSmallGroupProgress();
  SpreadsheetApp.getUi().alert('Current Lesson values recalculated.');
}

function repairUFLIMapFormatting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);
  if (sheet) {
    sheet.clearConditionalFormatRules();
    applyStatusConditionalFormatting(sheet, LAYOUT.DATA_START_ROW, LAYOUT.COL_FIRST_LESSON, sheet.getLastRow(), LAYOUT.TOTAL_LESSONS);
    SpreadsheetApp.getUi().alert('Formatting repaired.');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FIXED: Group Sheet Conditional Formatting Repair
// Replace repairAllGroupSheetFormatting() in GPProgressEngine.gs with this version
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Repairs conditional formatting for all Grade Group sheets
 * Scans for actual group structure and applies Y/N/A coloring
 */
function repairAllGroupSheetFormatting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const regex = /^(PreK|KG|G[1-8]) Groups$/;
  let totalGroupsFormatted = 0;
  
  ss.getSheets().forEach(sheet => {
    if (regex.test(sheet.getName())) {
      Logger.log("Processing sheet: " + sheet.getName());
      
      // Clear ALL existing conditional formatting
      sheet.clearConditionalFormatRules();
      
      const data = sheet.getDataRange().getValues();
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      // Find all group sections and apply formatting to each
      for (let i = 0; i < data.length; i++) {
        const cellA = data[i][0] ? data[i][0].toString().trim() : "";
        
        // Look for group header pattern (contains "Group" but not "Student")
        if (cellA.includes("Group") && !cellA.includes("Student")) {
          
          // Verify next row has "Student Name"
          if (i + 1 < data.length) {
            const nextRowA = data[i + 1][0] ? data[i + 1][0].toString().trim() : "";
            
            if (nextRowA === "Student Name") {
              // Found a valid group section
              // Structure:
              //   Row i:   Group Header (e.g., "G3 Group 1 Galdamez")
              //   Row i+1: Column Headers ("Student Name", "Lesson 1", ...)
              //   Row i+2: Lesson Names Sub-header (e.g., "", "UFLI L101", ...)
              //   Row i+3+: Student data rows
              
              const studentStartRow = i + 3; // 0-indexed, so +4 for 1-indexed sheet row
              const sheetStartRow = studentStartRow + 1; // Convert to 1-indexed
              
              // Find where this group's students end
              // (either next group header, empty row, or end of data)
              let studentEndRow = studentStartRow;
              for (let j = studentStartRow; j < data.length; j++) {
                const checkCell = data[j][0] ? data[j][0].toString().trim() : "";
                
                // Stop if we hit another group header or empty row
                if (checkCell === "" || (checkCell.includes("Group") && !checkCell.includes("Student"))) {
                  break;
                }
                
                // Skip placeholder text
                if (checkCell === "(No students assigned)") {
                  break;
                }
                
                studentEndRow = j;
              }
              
              const numStudentRows = studentEndRow - studentStartRow + 1;
              
              if (numStudentRows > 0) {
                // Determine number of lesson columns (columns B onwards)
                const numLessonCols = Math.max(lastCol - 1, LAYOUT.LESSONS_PER_GROUP_SHEET);
                
                Logger.log(`  Group: ${cellA}`);
                Logger.log(`    Student rows: ${sheetStartRow} to ${sheetStartRow + numStudentRows - 1}`);
                Logger.log(`    Lesson columns: 2 to ${numLessonCols + 1}`);
                
                // Apply formatting
                applyStatusConditionalFormatting(
                  sheet, 
                  sheetStartRow,      // First student row (1-indexed)
                  2,                   // Column B (lesson data starts here)
                  numStudentRows,      // Number of student rows
                  numLessonCols        // Number of lesson columns
                );
                
                totalGroupsFormatted++;
              }
            }
          }
        }
      }
      
      Logger.log(`Finished sheet: ${sheet.getName()}`);
    }
  });
  
  SpreadsheetApp.getUi().alert(
    'Formatting Complete', 
    `Applied Y/N/A conditional formatting to ${totalGroupsFormatted} groups.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Quick test function - run this to check a specific sheet
 */
function testGroupSheetStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("G3 Groups");
  
  if (!sheet) {
    Logger.log("G3 Groups sheet not found");
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  
  Logger.log("=== G3 Groups Sheet Structure ===");
  for (let i = 0; i < Math.min(data.length, 30); i++) {
    Logger.log(`Row ${i + 1}: "${data[i][0]}" | "${data[i][1]}" | "${data[i][2]}"`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE ROW HELPERS (FOR ADDING STUDENTS VIA WIZARD)
// ═══════════════════════════════════════════════════════════════════════════

function addSkillFormulasForRow(sheet, row) {
  // Placeholder - data filled on next sync
}

function addGradeSummaryFormulasForRow(sheet, row, studentObj) {
  // Placeholder - data filled on next sync
}

function addStudentToSheet(ss, sheetName, studentData) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  const newRow = Array(lastCol).fill("");
  newRow.splice(0, 4, studentData[0], studentData[1], studentData[2], studentData[3]);
  sheet.appendRow(newRow);
}

function updateStudentInSheet(ss, sheetName, studentName, studentData) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < LAYOUT.DATA_START_ROW) return;
  const data = sheet.getRange(LAYOUT.DATA_START_ROW, 1, sheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 1).getValues();
  const rowIndex = data.findIndex(row => row[0] === studentName);
  if (rowIndex !== -1) {
    sheet.getRange(rowIndex + LAYOUT.DATA_START_ROW, 1, 1, 4).setValues([studentData]);
  }
}
/**
 * Navigates to the School Summary sheet
 */
function goToSchoolSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES_V2.SCHOOL_SUMMARY);
  
  if (!sheet) {
    // Create it if it doesn't exist
    updateSchoolSummary();
    sheet = ss.getSheetByName(SHEET_NAMES_V2.SCHOOL_SUMMARY);
  }
  
  if (sheet) {
    ss.setActiveSheet(sheet);
  }
}
function debugSchoolSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Check if Grade Summary sheet exists
  const summarySheet = ss.getSheetByName(SHEET_NAMES_V2.GRADE_SUMMARY);
  Logger.log("Grade Summary sheet exists: " + (summarySheet !== null));
  
  if (summarySheet) {
    Logger.log("Last row: " + summarySheet.getLastRow());
    
    // Read data starting from row 6
    if (summarySheet.getLastRow() >= 6) {
      const testData = summarySheet.getRange(6, 1, 3, 4).getValues();
      Logger.log("First 3 data rows:");
      testData.forEach((row, i) => {
        Logger.log(`  Row ${i+6}: Name="${row[0]}", Grade="${row[1]}", Teacher="${row[2]}", Group="${row[3]}"`);
      });
    }
  }
  
  // Test the map
  const studentData = getSheetDataAsMap(ss, SHEET_NAMES_V2.GRADE_SUMMARY);
  Logger.log("Students in map: " + studentData.size);
  
  // Count by grade
  const grades = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];
  grades.forEach(grade => {
    const count = Array.from(studentData.values()).filter(s => s[1] && s[1].toString() === grade).length;
    if (count > 0) Logger.log(`  ${grade}: ${count} students`);
  });
}
function debugPacingData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pacingSheet = ss.getSheetByName("Pacing Dashboard");
  
  if (!pacingSheet) {
    Logger.log("Pacing Dashboard not found!");
    return;
  }
  
  const allData = pacingSheet.getDataRange().getValues();
  
  // Log headers (row 5, index 4)
  Logger.log("=== ROW 5 (Headers) ===");
  allData[4].forEach((val, idx) => {
    Logger.log(`  Index ${idx}: "${val}"`);
  });
  
  // Log first data row (row 6, index 5)
  Logger.log("=== ROW 6 (First Data Row) ===");
  allData[5].forEach((val, idx) => {
    Logger.log(`  Index ${idx}: "${val}"`);
  });
  
  // After slice(5), what does the code see?
  const pacingData = allData.slice(5);
  Logger.log("=== AFTER slice(5) - First Row ===");
  pacingData[0].forEach((val, idx) => {
    Logger.log(`  g[${idx}]: "${val}" (type: ${typeof val})`);
  });
}
/**
 * Reads Group Configuration to get total student counts per grade
 */
function getGradeCountsFromConfig(ss) {
  const counts = {};
  const configSheet = ss.getSheetByName("Group Configuration"); 
  
  if (configSheet) {
    const lastRow = configSheet.getLastRow();
    if (lastRow >= 8) { // Data starts at row 8
      // Get Col B (Grade) and Col D (Count)
      const data = configSheet.getRange(8, 2, lastRow - 7, 3).getValues(); 
      
      data.forEach(row => {
        const grade = row[0] ? row[0].toString().trim() : ""; // Col B
        const count = parseInt(row[2]) || 0; // Col D (Index 2 in this slice)
        
        if (grade) {
          if (!counts[grade]) counts[grade] = 0;
          counts[grade] += count;
        }
      });
    }
  }
  return counts;
}
// ═══════════════════════════════════════════════════════════════════════════
// DEBUG: Troubleshoot getExistingLessonData()
// Run this from Apps Script editor to see exactly what's happening
// ═══════════════════════════════════════════════════════════════════════════

/**
 * TEST FUNCTION - Run this manually with your actual values
 * Change these test values to match a real lesson check you're trying to load
 */
function testGetExistingLessonData() {
  // ══════════════════════════════════════════════════════════════════════════
  // CHANGE THESE VALUES TO MATCH YOUR ACTUAL FORM SELECTIONS:
  // ══════════════════════════════════════════════════════════════════════════
  const testGradeSheet = "KG and G1 Groups";  // <-- What you selected in Step 1
  const testGroupName = "KG Group 1 - T. Smith";  // <-- What you selected in Step 2  
  const testLessonName = "UFLI L5 VC&CVC Words";  // <-- What you selected in Step 3
  // ══════════════════════════════════════════════════════════════════════════
  
  Logger.log("═══════════════════════════════════════════════════════════════════");
  Logger.log("TESTING getExistingLessonData with:");
  Logger.log("  gradeSheet: '" + testGradeSheet + "'");
  Logger.log("  groupName:  '" + testGroupName + "'");
  Logger.log("  lessonName: '" + testLessonName + "'");
  Logger.log("═══════════════════════════════════════════════════════════════════");
  
  const result = debugGetExistingLessonData(testGradeSheet, testGroupName, testLessonName);
  
  Logger.log("");
  Logger.log("═══════════════════════════════════════════════════════════════════");
  Logger.log("FINAL RESULT:");
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log("═══════════════════════════════════════════════════════════════════");
}

/**
 * DEBUG VERSION of getExistingLessonData with verbose logging
 */
function debugGetExistingLessonData(gradeSheet, groupName, lessonName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(gradeSheet);

  if (!sheet) {
    Logger.log("❌ PROBLEM: Sheet not found: '" + gradeSheet + "'");
    Logger.log("");
    Logger.log("Available sheets in this spreadsheet:");
    ss.getSheets().forEach(s => Logger.log("  - '" + s.getName() + "'"));
    return {};
  }
  
  Logger.log("✓ Sheet found: " + gradeSheet);

  const data = sheet.getDataRange().getValues();
  Logger.log("✓ Sheet has " + data.length + " rows and " + (data[0] ? data[0].length : 0) + " columns");
  
  const existingData = {};
  let inTargetGroup = false;
  let lessonColIndex = -1;
  let foundLessonRow = false;
  let groupsFoundInSheet = [];

  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";

    // Detect group headers
    if (cellA.includes("Group") && !cellA.includes("Student")) {
      groupsFoundInSheet.push({ row: i + 1, name: cellA });
      
      // Check for exact match
      if (cellA === groupName) {
        Logger.log("");
        Logger.log("✓ EXACT MATCH found for group at row " + (i + 1) + ": '" + cellA + "'");
        inTargetGroup = true;
        foundLessonRow = false;
        lessonColIndex = -1;
      } 
      // Check for case-insensitive match
      else if (cellA.toUpperCase() === groupName.toUpperCase()) {
        Logger.log("");
        Logger.log("⚠️ CASE MISMATCH: Sheet has '" + cellA + "' but form sent '" + groupName + "'");
        Logger.log("   This might be the issue! The comparison is case-sensitive.");
        inTargetGroup = true;
        foundLessonRow = false;
        lessonColIndex = -1;
      }
      // Check for partial match (group name might have extra info like teacher name)
      else if (cellA.includes(groupName) || groupName.includes(cellA)) {
        Logger.log("");
        Logger.log("⚠️ PARTIAL MATCH at row " + (i + 1) + ":");
        Logger.log("   Sheet has: '" + cellA + "'");
        Logger.log("   Form sent: '" + groupName + "'");
        Logger.log("   These don't match exactly - this could be the problem!");
      }
      else if (inTargetGroup) {
        // Hit next group, stop searching
        Logger.log("  Reached next group at row " + (i + 1) + ", stopping search");
        break;
      }
      continue;
    }

    // Skip "Student Name" header
    if (cellA === "Student Name") {
      if (inTargetGroup) {
        Logger.log("  Row " + (i + 1) + ": Found 'Student Name' header");
      }
      continue;
    }

    // Find lesson column in sub-header row
    if (inTargetGroup && !foundLessonRow) {
      if (data[i][1]) {  // Has data in column B (first lesson column)
        Logger.log("  Row " + (i + 1) + ": Scanning for lesson columns...");
        
        let lessonsInRow = [];
        for (let col = 1; col < data[i].length; col++) {
          const colLessonName = data[i][col] ? data[i][col].toString().trim() : "";
          if (colLessonName) {
            lessonsInRow.push({ col: col, name: colLessonName });
          }
          
          // Check for exact match
          if (colLessonName === lessonName) {
            lessonColIndex = col;
            Logger.log("  ✓ EXACT MATCH for lesson at column " + (col + 1) + ": '" + colLessonName + "'");
            break;
          }
          // Check for case-insensitive match
          else if (colLessonName.toUpperCase() === lessonName.toUpperCase()) {
            Logger.log("  ⚠️ CASE MISMATCH: Sheet has '" + colLessonName + "' but form sent '" + lessonName + "'");
            lessonColIndex = col;
            break;
          }
        }
        
        if (lessonColIndex === -1) {
          Logger.log("  ❌ Lesson NOT FOUND in this row. Available lessons:");
          lessonsInRow.forEach(l => Logger.log("      Col " + (l.col + 1) + ": '" + l.name + "'"));
        }
        
        foundLessonRow = true;
        continue;
      }
    }

    // Extract student data
    if (inTargetGroup && foundLessonRow && lessonColIndex >= 0 && cellA && cellA !== "(No students assigned)") {
      const studentName = cellA;
      const value = data[i][lessonColIndex] ? data[i][lessonColIndex].toString().trim().toUpperCase() : "";
      
      if (value === "Y" || value === "N" || value === "A" || value === "U") {
        existingData[studentName] = value;
        Logger.log("  Row " + (i + 1) + ": " + studentName + " = " + value);
      } else if (value) {
        Logger.log("  Row " + (i + 1) + ": " + studentName + " has unexpected value: '" + value + "'");
      }
    }
  }
  
  // Summary
  Logger.log("");
  Logger.log("═══════════════════════════════════════════════════════════════════");
  Logger.log("DIAGNOSTIC SUMMARY:");
  Logger.log("═══════════════════════════════════════════════════════════════════");
  Logger.log("");
  Logger.log("Groups found in sheet '" + gradeSheet + "':");
  groupsFoundInSheet.forEach(g => {
    const match = g.name === groupName ? " ✓ MATCH" : "";
    Logger.log("  Row " + g.row + ": '" + g.name + "'" + match);
  });
  Logger.log("");
  Logger.log("Target group found: " + inTargetGroup);
  Logger.log("Lesson column found: " + (lessonColIndex >= 0 ? "Yes (column " + (lessonColIndex + 1) + ")" : "No"));
  Logger.log("Students with existing data: " + Object.keys(existingData).length);

  return existingData;
}

/**
 * Quick check - list all sheets and their first few group headers
 */
function listAllSheetsAndGroups() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Logger.log("═══════════════════════════════════════════════════════════════════");
  Logger.log("ALL SHEETS AND THEIR GROUP HEADERS");
  Logger.log("═══════════════════════════════════════════════════════════════════");
  
  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();
    if (name.includes("Groups") || name.includes("Classroom")) {
      Logger.log("");
      Logger.log("SHEET: '" + name + "'");
      
      const data = sheet.getDataRange().getValues();
      let groupCount = 0;
      
      for (let i = 0; i < data.length && groupCount < 10; i++) {
        const cellA = data[i][0] ? data[i][0].toString().trim() : "";
        if (cellA.includes("Group") && !cellA.includes("Student")) {
          Logger.log("  Row " + (i + 1) + ": '" + cellA + "'");
          groupCount++;
        }
      }
    }
  });
}
