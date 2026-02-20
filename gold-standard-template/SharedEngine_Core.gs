// ═══════════════════════════════════════════════════════════════════════════
// SHARED ENGINE CORE - PURE BUSINESS LOGIC (ALL SCHOOLS)
// ═══════════════════════════════════════════════════════════════════════════
// Version: 3.0 (Modularity Refactor — Business Logic Separation)
// Last Updated: February 2026
//
// PURPOSE:
// This module contains ALL pure business logic functions from the shared
// engine. Every function in this file is deterministic and testable without
// Google Apps Script APIs (SpreadsheetApp, Logger, HtmlService, etc.).
//
// DESIGN PRINCIPLES:
// 1. PURE FUNCTIONS: No side effects — same inputs always produce same outputs
// 2. DEPENDENCY INJECTION: Config objects (LAYOUT, PREK_CONFIG) are passed as
//    parameters, never read from global state
// 3. NO GAS APIS: Zero references to SpreadsheetApp, Logger, Session, etc.
// 4. TESTABLE: Every function can be unit-tested in Node.js via Jest
//
// FUNCTIONS INCLUDED:
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ CATEGORY              │ FUNCTIONS                                      │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Lesson Arrays         │ FOUNDATIONAL_LESSONS, G1_MINIMUM_LESSONS,      │
// │                       │ G1_CURRENT_YEAR_LESSONS, G2_MINIMUM_LESSONS,   │
// │                       │ G2_CURRENT_YEAR_LESSONS, G4_MINIMUM_LESSONS,   │
// │                       │ ALL_NON_REVIEW_LESSONS                         │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Grade Metrics         │ SHARED_GRADE_METRICS                           │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Core Helpers          │ getLessonColumnIndex, getLessonStatus,          │
// │                       │ isReviewLesson, partitionLessonsByReview,      │
// │                       │ checkGateway                                   │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Core Calculations     │ calculateBenchmark, calculateSectionPercentage,│
// │                       │ calculatePreKScores, countYsInColumns          │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Utilities             │ getColumnLetter, extractLessonNumber,          │
// │                       │ normalizeStudent, getLastLessonColumn          │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Data Merging          │ createMergedRow                                │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Statistics Pipeline   │ computeStudentStats (pure stats computation)   │
// └─────────────────────────────────────────────────────────────────────────┘
//
// DEPENDENCIES:
// - SharedConstants.gs: SKILL_SECTIONS, REVIEW_LESSONS_SET,
//   PERFORMANCE_THRESHOLDS, STATUS_LABELS, getPerformanceStatus()
//
// COMPANION MODULE:
// - SharedEngine_IO.gs: Sheet I/O functions (getOrCreateSheet, log,
//   updateAllStats) that depend on SpreadsheetApp and Logger
//
// USAGE:
// School-specific Phase2_ProgressTracking.gs files use these functions
// and provide school-specific configuration (LAYOUT, SHEET_NAMES, GRADE_METRICS).
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// LESSON ARRAYS FOR GRADE METRICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generates foundational lessons array (lessons 1-34)
 */
const FOUNDATIONAL_LESSONS = Array.from({length: 34}, (_, i) => i + 1);

/**
 * G1 Minimum: Lessons 1-34 + Digraphs (42-53), excluding reviews
 */
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

/**
 * G1 Current Year: Lessons 35-62, excluding reviews
 */
const G1_CURRENT_YEAR_LESSONS = (() => {
  const lessons = [];
  for (let i = 35; i <= 62; i++) {
    if (![49, 53, 57, 59, 62].includes(i)) lessons.push(i);
  }
  return lessons;
})();

/**
 * G2/G3 Minimum: Lessons 1-34 + Digraphs + VCE + RLW, excluding reviews
 */
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

/**
 * G2 Current Year: Lesson 38 + Lessons 63-83, excluding reviews
 */
const G2_CURRENT_YEAR_LESSONS = (() => {
  const lessons = [38];
  for (let i = 63; i <= 83; i++) {
    if (![71, 76, 79, 83].includes(i)) lessons.push(i);
  }
  return lessons;
})();

/**
 * G4-G8 Minimum: Lessons 1-34 + 42-110, excluding only Alphabet Review section
 */
const G4_MINIMUM_LESSONS = (() => {
  const lessons = [];
  // Foundational: 1-34
  for (let i = 1; i <= 34; i++) lessons.push(i);
  // Everything from 42-110 (includes review lessons)
  for (let i = 42; i <= 110; i++) lessons.push(i);
  return lessons;  // 34 + 69 = 103 lessons
})();

/**
 * All non-review lessons (1-128, excluding 23 review lessons)
 */
const ALL_NON_REVIEW_LESSONS = (() => {
  const lessons = [];
  for (let i = 1; i <= 128; i++) {
    if (!REVIEW_LESSONS_SET.has(i)) lessons.push(i);
  }
  return lessons;
})();

// ═══════════════════════════════════════════════════════════════════════════
// SHARED GRADE METRICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Standard grade metrics used across all schools
 * Each grade has three benchmarks: foundational, minimum, and currentYear
 * 
 * NOTE: Schools can override this in their Phase2_ProgressTracking.gs if needed
 */
const SHARED_GRADE_METRICS = {
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
  SHARED_GRADE_METRICS[grade] = {
    foundational: { lessons: FOUNDATIONAL_LESSONS, denominator: 34 },
    minimum: { lessons: G4_MINIMUM_LESSONS, denominator: 103 },
    currentYear: { lessons: ALL_NON_REVIEW_LESSONS, denominator: 107 }
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// CORE HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets the column index (0-based array index) for a lesson number
 * @param {number} lessonNum - Lesson number (1-128)
 * @param {Object} LAYOUT - Layout configuration object with LESSON_COLUMN_OFFSET
 * @returns {number} Column index in the array
 */
function getLessonColumnIndex(lessonNum, LAYOUT) {
  return LAYOUT.LESSON_COLUMN_OFFSET + lessonNum - 1;
}

/**
 * Gets the lesson status (Y, N, or blank) from a row
 * @param {Array} row - Student row data
 * @param {number} lessonNum - Lesson number (1-128)
 * @param {Object} LAYOUT - Layout configuration object with LESSON_COLUMN_OFFSET
 * @returns {string} Status: 'Y', 'N', or '' (blank)
 */
function getLessonStatus(row, lessonNum, LAYOUT) {
  const idx = getLessonColumnIndex(lessonNum, LAYOUT);
  if (idx < row.length) {
    const val = row[idx];
    return val ? val.toString().toUpperCase().trim() : "";
  }
  return "";
}

/**
 * Checks if a lesson number is a review lesson
 * @param {number} lessonNum - Lesson number (1-128)
 * @returns {boolean} True if lesson is a review lesson
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
 * @param {Object} LAYOUT - Layout configuration object with LESSON_COLUMN_OFFSET
 * @returns {{assigned: boolean, allPassed: boolean, gatewayPassed: boolean}}
 */
function checkGateway(row, reviewLessons, LAYOUT) {
  let assigned = false;
  let allPassed = true;

  for (const lessonNum of reviewLessons) {
    const status = getLessonStatus(row, lessonNum, LAYOUT);
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

// ═══════════════════════════════════════════════════════════════════════════
// CORE CALCULATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculates benchmark percentage with gateway logic
 * 
 * Gateway Logic:
 * - If ALL review lessons in a section are passed (Y), count ALL non-reviews as passed
 * - Otherwise, count actual Y's in non-review lessons
 * 
 * @param {Array} mapRow - Student's row data
 * @param {Array<number>} lessonIndices - Lesson numbers in the benchmark
 * @param {number} denominator - Expected denominator (for validation)
 * @param {Object} LAYOUT - Layout configuration object
 * @returns {number} Percentage (0-100)
 */
function calculateBenchmark(mapRow, lessonIndices, denominator, LAYOUT) {
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
      ? checkGateway(mapRow, sectionReviews, LAYOUT)
      : { gatewayPassed: false };

    if (gateway.gatewayPassed) {
      // Gateway passed: Count ALL non-reviews in this section as passed
      totalPassed += sectionNonReviews.length;
    } else {
      // No gateway: Count actual Y's in non-review lessons
      for (const lessonNum of sectionNonReviews) {
        if (getLessonStatus(mapRow, lessonNum, LAYOUT) === 'Y') {
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
 * @param {Object} LAYOUT - Layout configuration object
 * @returns {number|string} Percentage integer or "" if nothing attempted
 */
function calculateSectionPercentage(mapRow, sectionLessons, isInitialAssessment, LAYOUT) {
  const { reviews, nonReviews } = partitionLessonsByReview(sectionLessons);

  if (nonReviews.length === 0) return "";

  // Count passed non-review lessons (used in both paths)
  const countPassed = () => {
    let passed = 0;
    for (const lessonNum of nonReviews) {
      if (getLessonStatus(mapRow, lessonNum, LAYOUT) === 'Y') passed++;
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
    const gateway = checkGateway(mapRow, reviews, LAYOUT);
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
 * @param {Object} PREK_CONFIG - Pre-K configuration with denominators
 * @returns {Object} { foundational, minGrade, fullGrade } percentages
 */
function calculatePreKScores(row, headers, PREK_CONFIG) {
  const nameYCount = countYsInColumns(row, headers, 'Name');
  const soundYCount = countYsInColumns(row, headers, 'Sound');
  const formYCount = countYsInColumns(row, headers, 'Form');

  return {
    foundational: Math.round((formYCount / PREK_CONFIG.FORM_DENOMINATOR) * 100),
    minGrade: Math.round(((nameYCount + soundYCount) / PREK_CONFIG.NAME_SOUND_DENOMINATOR) * 100),
    fullGrade: Math.round(((nameYCount + soundYCount + formYCount) / PREK_CONFIG.FULL_DENOMINATOR) * 100)
  };
}

/**
 * Helper function for Pre-K: counts Y's in columns matching a pattern
 * @param {Array} row - Data row
 * @param {Array} headers - Header row
 * @param {string} pattern - Pattern to match in header (e.g., 'Name', 'Sound', 'Form')
 * @returns {number} Count of Y's
 */
function countYsInColumns(row, headers, pattern) {
  let count = 0;
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i] ? headers[i].toString() : "";
    if (header.includes(pattern) && row[i] && row[i].toString().toUpperCase().trim() === 'Y') {
      count++;
    }
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Converts column number to letter (A, B, C, ..., Z, AA, AB, ...)
 * @param {number} columnNumber - 1-based column number
 * @returns {string} Column letter(s)
 */
function getColumnLetter(columnNumber) {
  let temp, letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
}

/**
 * Extracts lesson number from lesson text (e.g., "UFLI L42 ff, ll, ss, zz" → 42)
 * @param {string} lessonText - Lesson label text
 * @returns {number|null} Lesson number or null if not found
 */
function extractLessonNumber(lessonText) {
  if (!lessonText) return null;
  const match = lessonText.toString().match(/L(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Normalizes student name (trims whitespace)
 * @param {Object} student - Student object with name property
 * @returns {Object} Student object with normalized name
 */
function normalizeStudent(student) {
  return {
    ...student,
    name: student.name ? student.name.toString().trim() : ""
  };
}

/**
 * Gets the last lesson column letter (e.g., "EH" for lesson 128)
 * @param {Object} LAYOUT - Layout configuration with COL_FIRST_LESSON and TOTAL_LESSONS
 * @returns {string} Column letter of last lesson
 */
function getLastLessonColumn(LAYOUT) {
  return getColumnLetter(LAYOUT.COL_FIRST_LESSON + LAYOUT.TOTAL_LESSONS - 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA MERGING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a merged row that preserves 'Y' values from either current or initial data
 * This prevents negative growth when students master skills between assessments
 * 
 * @param {Array} currentRow - Current progress data
 * @param {Array} initialRow - Initial assessment data (or null)
 * @returns {Array} Merged row with preserved Y values
 */
function createMergedRow(currentRow, initialRow) {
  if (!initialRow) return currentRow;
  
  const merged = [...currentRow];
  for (let i = 0; i < merged.length; i++) {
    const current = merged[i] ? merged[i].toString().toUpperCase().trim() : "";
    const initial = initialRow[i] ? initialRow[i].toString().toUpperCase().trim() : "";
    // Preserve Y from either source
    if (initial === 'Y' && current !== 'Y') {
      merged[i] = 'Y';
    }
  }
  return merged;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICS COMPUTATION (PURE LOGIC)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Computes student statistics from pre-loaded data arrays (pure logic, no I/O).
 *
 * This is the pure-logic core of updateAllStats(). It receives all data as
 * parameters and returns computed output arrays, without reading or writing
 * any sheets. The companion updateAllStats() in SharedEngine_IO.gs handles
 * sheet reads/writes and delegates to this function.
 *
 * @param {Object} params - All data and config needed for computation
 * @param {Array<Array>} params.mapData - UFLI MAP sheet data (rows of student data)
 * @param {Array<Array>} params.preKData - Pre-K Data sheet data (rows)
 * @param {Array} params.preKHeaders - Pre-K header row
 * @param {Array<Array>} params.initialData - Initial Assessment sheet data (rows)
 * @param {Object} params.config - Configuration object
 * @param {Object} params.config.LAYOUT - Layout constants (DATA_START_ROW, LESSON_COLUMN_OFFSET, etc.)
 * @param {Object} params.config.PREK_CONFIG - Pre-K config (HEADER_ROW, DATA_START_ROW, denominators)
 * @param {Object} [params.config.GRADE_METRICS] - Grade metrics (defaults to SHARED_GRADE_METRICS)
 * @returns {{ skillsOutput: Array<Array>, summaryOutput: Array<Array> }}
 */
function computeStudentStats(params) {
  const { mapData, preKData, preKHeaders, initialData, config } = params;
  const LAYOUT = config.LAYOUT;
  const PREK_CONFIG = config.PREK_CONFIG;
  const GRADE_METRICS = config.GRADE_METRICS || SHARED_GRADE_METRICS;

  // Build initial assessment lookup map
  const initialMap = {};
  if (initialData) {
    for (let i = LAYOUT.DATA_START_ROW - 1; i < initialData.length; i++) {
      if (initialData[i][0]) {
        initialMap[initialData[i][0].toString().trim().toUpperCase()] = initialData[i];
      }
    }
  }

  // Output Arrays
  const skillsOutput = [];
  const summaryOutput = [];
  const skillEntries = Object.entries(SKILL_SECTIONS);

  // --- PROCESS UFLI STUDENTS (K-8) ---
  if (mapData) {
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
      const skillsRow = [...metadata];
      skillEntries.forEach(([_, lessons]) => {
        skillsRow.push(calculateSectionPercentage(mergedRow, lessons, false, LAYOUT));
      });
      skillsOutput.push(skillsRow);

      // Grade Summary Row
      const summaryRow = [...metadata];
      const metrics = GRADE_METRICS[grade];

      if (metrics) {
        const foundPct = calculateBenchmark(mergedRow, metrics.foundational.lessons, metrics.foundational.denominator, LAYOUT);
        const minPct = calculateBenchmark(mergedRow, metrics.minimum.lessons, metrics.minimum.denominator, LAYOUT);
        const fullPct = calculateBenchmark(mergedRow, metrics.currentYear.lessons, metrics.currentYear.denominator, LAYOUT);

        summaryRow.push(foundPct);
        summaryRow.push(minPct);
        summaryRow.push(fullPct);

        // Benchmark Status based on Min Grade Skills % (v5.2 fix)
        const status = getPerformanceStatus(minPct);
        summaryRow.push(status);
      } else {
        summaryRow.push("", "", "", "");
      }

      summaryOutput.push(summaryRow);
    }
  }

  // --- PROCESS PRE-K STUDENTS (HWT) ---
  if (preKData && preKData.length > PREK_CONFIG.DATA_START_ROW - 1) {
    for (let i = PREK_CONFIG.DATA_START_ROW - 1; i < preKData.length; i++) {
      const row = preKData[i];
      if (!row[0]) continue;

      const metadata = [row[0], "PreK", row[2] || "", row[3] || ""];
      const scores = calculatePreKScores(row, preKHeaders, PREK_CONFIG);

      // Skills Tracker: Show all as blank (Pre-K doesn't use 16 skill sections)
      const skillsRow = [...metadata];
      skillEntries.forEach(() => skillsRow.push(""));
      skillsOutput.push(skillsRow);

      // Grade Summary: Use Pre-K metrics
      const summaryRow = [...metadata];
      summaryRow.push(scores.foundational);
      summaryRow.push(scores.minGrade);
      summaryRow.push(scores.fullGrade);

      const status = getPerformanceStatus(scores.fullGrade);
      summaryRow.push(status);
      summaryOutput.push(summaryRow);
    }
  }

  return { skillsOutput, summaryOutput };
}
