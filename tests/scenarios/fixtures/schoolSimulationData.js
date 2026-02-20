/**
 * schoolSimulationData.js — Scenario fixture data for Tier 3 end-to-end tests.
 *
 * Generates realistic multi-month school simulation data including:
 *   - 20+ students across grades PreK through G8
 *   - Three progression snapshots: beginning-of-year, mid-year, end-of-year
 *   - Various performance levels (On Track, Needs Support, Intervention)
 *   - Mock spreadsheet objects for updateAllStats validation
 */

const { DEFAULT_LAYOUT, PREK_HEADERS, PREK_CONFIG } = require('../../fixtures/testData');

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT ROSTER — Realistic multi-grade school
// ═══════════════════════════════════════════════════════════════════════════

const STUDENTS = [
  // PreK students (tracked via Pre-K Data sheet, not UFLI MAP)
  { name: 'PreK Student A', grade: 'PreK', teacher: 'Rivera', group: 'PreK AM' },
  { name: 'PreK Student B', grade: 'PreK', teacher: 'Rivera', group: 'PreK AM' },

  // Kindergarten
  { name: 'KG Student A', grade: 'KG', teacher: 'Smith', group: 'KG Group 1' },
  { name: 'KG Student B', grade: 'KG', teacher: 'Smith', group: 'KG Group 1' },

  // Grade 1
  { name: 'G1 Student A', grade: 'G1', teacher: 'Jones', group: 'G1 Group 1' },
  { name: 'G1 Student B', grade: 'G1', teacher: 'Jones', group: 'G1 Group 1' },
  { name: 'G1 Student C', grade: 'G1', teacher: 'Jones', group: 'G1 Group 2' },

  // Grade 2
  { name: 'G2 Student A', grade: 'G2', teacher: 'Garcia', group: 'G2 Group 1' },
  { name: 'G2 Student B', grade: 'G2', teacher: 'Garcia', group: 'G2 Group 1' },

  // Grade 3
  { name: 'G3 Student A', grade: 'G3', teacher: 'Lee', group: 'G3 Group 1' },
  { name: 'G3 Student B', grade: 'G3', teacher: 'Lee', group: 'G3 Group 1' },

  // Grade 4
  { name: 'G4 Student A', grade: 'G4', teacher: 'Brown', group: 'G4 Group 1' },

  // Grade 5
  { name: 'G5 Student A', grade: 'G5', teacher: 'Davis', group: 'G5 Group 1' },

  // Grade 6
  { name: 'G6 Student A', grade: 'G6', teacher: 'Wilson', group: 'G6 Group 1' },

  // Grade 7
  { name: 'G7 Student A', grade: 'G7', teacher: 'Taylor', group: 'G7 Group 1' },

  // Grade 8
  { name: 'G8 Student A', grade: 'G8', teacher: 'Martin', group: 'G8 Group 1' },
];

// ═══════════════════════════════════════════════════════════════════════════
// LESSON PROGRESSION PROFILES
// ═══════════════════════════════════════════════════════════════════════════
// Profiles simulate different stages of the school year.
// Keys are lesson numbers; values are 'Y' (passed), 'N' (failed), or absent (blank).

/**
 * Beginning-of-year profile: minimal lessons completed (L1-L10 only)
 * Simulates initial assessment period — most students in foundational range
 */
function beginningOfYearLessons(performanceLevel) {
  const lessons = {};
  const maxLesson = performanceLevel === 'high' ? 10 : performanceLevel === 'mid' ? 6 : 3;
  for (let i = 1; i <= maxLesson; i++) {
    lessons[i] = 'Y';
  }
  return lessons;
}

/**
 * Mid-year profile: moderate progression through lessons
 * High performers may reach VCe section (L54+), low performers still in digraphs
 */
function midYearLessons(performanceLevel) {
  const lessons = {};
  let maxLesson;
  if (performanceLevel === 'high') {
    maxLesson = 62;
  } else if (performanceLevel === 'mid') {
    maxLesson = 45;
  } else {
    maxLesson = 25;
  }

  for (let i = 1; i <= maxLesson; i++) {
    // Most lessons passed; simulate some N's for mid/low performers
    if (performanceLevel === 'low' && i > 15 && i % 4 === 0) {
      lessons[i] = 'N';
    } else {
      lessons[i] = 'Y';
    }
  }

  // Add review lesson results for sections covered
  if (maxLesson >= 41) {
    // Alphabet Review section reviews
    [35, 36, 37, 39, 40, 41].forEach(r => {
      lessons[r] = performanceLevel === 'high' ? 'Y' : (performanceLevel === 'mid' ? 'Y' : 'N');
    });
  }
  if (maxLesson >= 53) {
    [49, 53].forEach(r => { lessons[r] = 'Y'; });
  }
  if (maxLesson >= 62) {
    [57, 59, 62].forEach(r => { lessons[r] = performanceLevel === 'high' ? 'Y' : 'N'; });
  }

  return lessons;
}

/**
 * End-of-year profile: high completion across the curriculum
 */
function endOfYearLessons(performanceLevel) {
  const lessons = {};
  let maxLesson;
  if (performanceLevel === 'high') {
    maxLesson = 128;
  } else if (performanceLevel === 'mid') {
    maxLesson = 97;
  } else {
    maxLesson = 62;
  }

  for (let i = 1; i <= maxLesson; i++) {
    if (performanceLevel === 'low' && i > 40 && i % 3 === 0) {
      lessons[i] = 'N';
    } else {
      lessons[i] = 'Y';
    }
  }

  // Review lessons — high performers pass all, mid/low vary
  const allReviews = [35,36,37,39,40,41,49,53,57,59,62,71,76,79,83,88,92,97,102,104,105,106,128];
  allReviews.forEach(r => {
    if (r <= maxLesson) {
      if (performanceLevel === 'high') {
        lessons[r] = 'Y';
      } else if (performanceLevel === 'mid') {
        lessons[r] = r <= 88 ? 'Y' : 'N';
      } else {
        lessons[r] = r <= 53 ? 'Y' : 'N';
      }
    }
  });

  return lessons;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROW BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Builds a UFLI MAP row array from a student and lesson map.
 * Row layout: [Name, Grade, Teacher, Group, reserved, L1, L2, ..., L128]
 */
function buildMapRow(student, lessons) {
  const row = new Array(DEFAULT_LAYOUT.LESSON_COLUMN_OFFSET + 128).fill('');
  row[0] = student.name;
  row[1] = student.grade;
  row[2] = student.teacher;
  row[3] = student.group;
  for (const [num, status] of Object.entries(lessons)) {
    const idx = DEFAULT_LAYOUT.LESSON_COLUMN_OFFSET + parseInt(num, 10) - 1;
    row[idx] = status;
  }
  return row;
}

/**
 * Builds Pre-K Data rows with Name/Sound/Form columns.
 * @param {Object} student - Student metadata
 * @param {Object} counts - { nameY, soundY, formY } — how many Y's in each category
 */
function buildPreKDataRow(student, counts) {
  const row = new Array(PREK_HEADERS.length).fill('');
  row[0] = student.name;
  row[1] = student.grade || 'PreK';
  row[2] = student.teacher || '';
  row[3] = student.group || '';
  // Columns 4-6: Name (A, B, C)
  // Columns 7-9: Sound (A, B, C)
  // Columns 10-12: Form (A, B, C)
  for (let i = 0; i < 3; i++) {
    if (i < (counts.nameY || 0)) row[4 + i] = 'Y';
    if (i < (counts.soundY || 0)) row[7 + i] = 'Y';
    if (i < (counts.formY || 0)) row[10 + i] = 'Y';
  }
  return row;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHOOL SIMULATION DATA GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Performance level assignments for each student by simulation phase.
 * Keys = student index in STUDENTS array (excluding PreK students)
 */
const PERFORMANCE_PROFILES = {
  // KG — 2 students
  2: 'high', 3: 'mid',
  // G1 — 3 students
  4: 'high', 5: 'mid', 6: 'low',
  // G2 — 2 students
  7: 'high', 8: 'low',
  // G3 — 2 students
  9: 'mid', 10: 'low',
  // G4 — 1 student
  11: 'high',
  // G5 — 1 student
  12: 'mid',
  // G6 — 1 student
  13: 'high',
  // G7 — 1 student
  14: 'mid',
  // G8 — 1 student
  15: 'low',
};

/**
 * Generates UFLI MAP data for a given phase of the school year.
 * Returns header rows + data rows (header rows are filler for rows 1-5).
 *
 * @param {'boy'|'moy'|'eoy'} phase - Beginning, middle, or end of year
 * @returns {Array<Array>} Full sheet data (rows 1-5 = headers, rows 6+ = student data)
 */
function generateMapData(phase) {
  const lessonGenerator = {
    boy: beginningOfYearLessons,
    moy: midYearLessons,
    eoy: endOfYearLessons,
  }[phase];

  // Header rows (rows 1-5, indices 0-4) — placeholder
  const headerRows = [];
  for (let i = 0; i < DEFAULT_LAYOUT.HEADER_ROW_COUNT; i++) {
    headerRows.push(new Array(DEFAULT_LAYOUT.LESSON_COLUMN_OFFSET + 128).fill(''));
  }

  // Data rows — only K-8 students (PreK handled separately)
  const dataRows = STUDENTS
    .filter(s => s.grade !== 'PreK')
    .map((student, idx) => {
      const originalIdx = STUDENTS.indexOf(student);
      const level = PERFORMANCE_PROFILES[originalIdx] || 'mid';
      return buildMapRow(student, lessonGenerator(level));
    });

  return [...headerRows, ...dataRows];
}

/**
 * Generates Pre-K Data for a given phase.
 * @param {'boy'|'moy'|'eoy'} phase
 * @returns {Array<Array>} Pre-K data rows (row 1 = header, row 2+ = data)
 */
function generatePreKData(phase) {
  const preKStudents = STUDENTS.filter(s => s.grade === 'PreK');
  const profiles = {
    boy: [
      { nameY: 1, soundY: 0, formY: 1 },  // Student A
      { nameY: 0, soundY: 0, formY: 0 },  // Student B
    ],
    moy: [
      { nameY: 2, soundY: 2, formY: 2 },
      { nameY: 1, soundY: 1, formY: 1 },
    ],
    eoy: [
      { nameY: 3, soundY: 3, formY: 3 },
      { nameY: 2, soundY: 2, formY: 2 },
    ],
  };
  const phaseProfiles = profiles[phase] || profiles.boy;

  return [
    PREK_HEADERS,
    ...preKStudents.map((s, i) => buildPreKDataRow(s, phaseProfiles[i] || { nameY: 0, soundY: 0, formY: 0 }))
  ];
}

/**
 * Generates Initial Assessment data (snapshot of beginning-of-year).
 * Used for growth suppression in updateAllStats.
 */
function generateInitialAssessmentData() {
  return generateMapData('boy');
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SPREADSHEET BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a mock SpreadsheetApp spreadsheet object that:
 * - Returns named sheet mocks with fixture data
 * - Captures writes to output sheets for validation
 *
 * @param {Object} sheetData - Map of sheet name → 2D array data
 * @returns {{ ss: Object, captured: Object }} Mock spreadsheet + captured output
 */
function createMockSpreadsheet(sheetData) {
  const captured = {};

  function createMockSheet(name, data) {
    return {
      getDataRange: () => ({
        getValues: () => data || [],
      }),
      getRange: (row, col, numRows, numCols) => ({
        setValues: (values) => {
          if (!captured[name]) captured[name] = [];
          captured[name].push({ row, col, numRows, numCols, values });
        },
      }),
      clear: () => {},
      getName: () => name,
    };
  }

  const sheets = {};
  for (const [name, data] of Object.entries(sheetData)) {
    sheets[name] = createMockSheet(name, data);
  }

  const ss = {
    getSheetByName: (name) => sheets[name] || null,
    insertSheet: (name) => {
      sheets[name] = createMockSheet(name, []);
      return sheets[name];
    },
  };

  return { ss, captured };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHOOL CONFIGURATION PRESETS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns a full config object matching what getUnifiedConfig() produces.
 */
function buildSchoolConfig(overrides = {}) {
  return {
    LAYOUT: overrides.LAYOUT || {
      DATA_START_ROW: 6,
      HEADER_ROW_COUNT: 5,
      LESSON_COLUMN_OFFSET: 5,
      TOTAL_LESSONS: 128,
      LESSONS_PER_GROUP_SHEET: 12,
      GROUP_FORMAT: 'standard',
      INCLUDE_SC_CLASSROOM: false,
      COL_STUDENT_NAME: 1,
      COL_GRADE: 2,
      COL_TEACHER: 3,
      COL_GROUP: 4,
      COL_CURRENT_LESSON: 5,
      COL_FIRST_LESSON: 6,
    },
    SHEET_NAMES_V2: overrides.SHEET_NAMES_V2 || {
      SMALL_GROUP_PROGRESS: 'Small Group Progress',
      UFLI_MAP: 'UFLI MAP',
      SKILLS: 'Skills Tracker',
      GRADE_SUMMARY: 'Grade Summary',
      INITIAL_ASSESSMENT: 'Initial Assessment',
      SCHOOL_SUMMARY: 'School Summary',
    },
    SHEET_NAMES_PREK: overrides.SHEET_NAMES_PREK || {
      DATA: 'Pre-K Data',
    },
    PREK_CONFIG: overrides.PREK_CONFIG || {
      TOTAL_LETTERS: 26,
      HEADER_ROW: 5,
      DATA_START_ROW: 6,
      FORM_DENOMINATOR: 26,
      NAME_SOUND_DENOMINATOR: 52,
      FULL_DENOMINATOR: 78,
    },
    GRADE_METRICS: overrides.GRADE_METRICS || null, // null → falls back to SHARED_GRADE_METRICS
    features: overrides.features || {},
    schoolName: overrides.schoolName || 'Test School',
    gradeRangeModel: overrides.gradeRangeModel || 'k8',
    gradesServed: overrides.gradesServed || ['KG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'],
  };
}

/**
 * Partner site configuration presets (from QA_CHECKLIST.md).
 */
const PARTNER_CONFIGS = {
  siteA: {
    name: 'Partner Site A — Mixed + Growth + Import + Unenrollment',
    features: {
      mixedGradeSupport: true,
      growthHighlighter: true,
      adminImport: true,
      unenrollmentAutomation: true,
      syncQueueProcessing: true,
      nightlySyncAutomation: true,
    },
  },
  siteB: {
    name: 'Partner Site B — Tutoring + Grants',
    features: {
      tutoringSystem: true,
      grantReporting: true,
      nightlySyncAutomation: true,
    },
  },
  siteC: {
    name: 'Partner Site C — Mixed + Coaching',
    features: {
      mixedGradeSupport: true,
      coachingDashboard: true,
      syncStatusMonitoring: true,
    },
  },
  coreOnly: {
    name: 'Core Only — All Features Disabled',
    features: {},
  },
  fullFeatures: {
    name: 'Full Features — All Enabled',
    features: {
      preKSystem: 'hwt',
      mixedGradeSupport: true,
      coachingDashboard: true,
      tutoringSystem: true,
      grantReporting: true,
      growthHighlighter: true,
      adminImport: true,
      unenrollmentAutomation: true,
      syncQueueProcessing: true,
      nightlySyncAutomation: true,
      syncStatusMonitoring: true,
    },
  },
};

module.exports = {
  STUDENTS,
  PERFORMANCE_PROFILES,
  DEFAULT_LAYOUT,
  PREK_HEADERS,
  PREK_CONFIG,
  beginningOfYearLessons,
  midYearLessons,
  endOfYearLessons,
  buildMapRow,
  buildPreKDataRow,
  generateMapData,
  generatePreKData,
  generateInitialAssessmentData,
  createMockSpreadsheet,
  buildSchoolConfig,
  PARTNER_CONFIGS,
};
