// ═══════════════════════════════════════════════════════════════════════════
// UFLI MASTER SYSTEM - SYSTEM SHEETS (PHASE 2)
// Sheet Generation, Progress Tracking, Sync, and Pacing Engine
// ═══════════════════════════════════════════════════════════════════════════
// Version: 5.1 - PREK METRICS FIX
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
  DATA_START_ROW: 5,           // First row of actual data
  HEADER_ROW_COUNT: 4,         // Number of header rows
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

const COLORS = {
  Y: "#d4edda",        // Light green - Yes/Pass
  N: "#f8d7da",        // Light red - No/Fail
  A: "#fff3cd",        // Light yellow - Absent
  HEADER_BG: "#4A90E2",
  HEADER_FG: "#FFFFFF",
  TITLE_BG: "#ADD8E6",
  TITLE_FG: "#000000",
  SUB_HEADER_BG: "#f8f9fa",
  PLACEHOLDER_FG: "#999999"
};

// ═══════════════════════════════════════════════════════════════════════════
// SHARED CONSTANTS - Imported from SharedConstants.gs
// ═══════════════════════════════════════════════════════════════════════════
// The following constants are now defined in SharedConstants.gs and shared
// across all schools (Adelante, Allegiant, CCA, CHAW, GlobalPrep, Sankofa):
// - LESSON_LABELS: All 128 UFLI lesson labels
// - SKILL_SECTIONS: 16 skill sections with lesson arrays
// - REVIEW_LESSONS: 23 review lesson numbers (gateway tests)
// - REVIEW_LESSONS_SET: Set version for O(1) lookups
// - PERFORMANCE_THRESHOLDS: Score thresholds (ON_TRACK, NEEDS_SUPPORT)
// - STATUS_LABELS: Performance status text labels
// - getPerformanceStatus(): Helper function to determine status from percentage
// ═══════════════════════════════════════════════════════════════════════════

const FOUNDATIONAL_LESSONS = Array.from({length: 34}, (_, i) => i + 1);

const G1_MINIMUM_LESSONS = (() => {
  const lessons = [...FOUNDATIONAL_LESSONS];
  for (let i = 35; i <= 41; i++) lessons.push(i);
  for (let i = 42; i <= 62; i++) {
    if (![49, 53, 57, 59, 62].includes(i)) lessons.push(i);
  }
  return lessons;
})();

const G1_CURRENT_YEAR_LESSONS = (() => {
  const lessons = [];
  for (let i = 35; i <= 62; i++) {
    if (![49, 53, 57, 59, 62].includes(i)) lessons.push(i);
  }
  return lessons;
})();

const G2_MINIMUM_LESSONS = (() => {
  const lessons = [...FOUNDATIONAL_LESSONS];
  lessons.push(38);
  for (let i = 42; i <= 83; i++) {
    if (![49, 53, 57, 59, 62, 71, 76, 79, 83].includes(i)) lessons.push(i);
  }
  return lessons;
})();

const G2_CURRENT_YEAR_LESSONS = (() => {
  const lessons = [38];
  for (let i = 63; i <= 83; i++) {
    if (![71, 76, 79, 83].includes(i)) lessons.push(i);
  }
  return lessons;
})();

const ALL_NON_REVIEW_LESSONS = (() => {
  const lessons = [];
  for (let i = 1; i <= 128; i++) {
    if (!REVIEW_LESSONS.includes(i)) lessons.push(i);
  }
  return lessons;
})();

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
    minimum: { lessons: G1_MINIMUM_LESSONS, denominator: 57 },
    currentYear: { lessons: G1_CURRENT_YEAR_LESSONS, denominator: 23 }
  },
  'G2': {
    foundational: { lessons: FOUNDATIONAL_LESSONS, denominator: 34 },
    minimum: { lessons: G2_MINIMUM_LESSONS, denominator: 67 },
    currentYear: { lessons: G2_CURRENT_YEAR_LESSONS, denominator: 18 }
  },
  'G3': {
    foundational: { lessons: FOUNDATIONAL_LESSONS, denominator: 34 },
    minimum: { lessons: G2_MINIMUM_LESSONS, denominator: 67 },
    currentYear: { lessons: G2_CURRENT_YEAR_LESSONS, denominator: 18 }
  }
};

['G4', 'G5', 'G6', 'G7', 'G8'].forEach(grade => {
  GRADE_METRICS[grade] = {
    foundational: { lessons: FOUNDATIONAL_LESSONS, denominator: 34 },
    minimum: { lessons: ALL_NON_REVIEW_LESSONS, denominator: 107 },
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

/**
 * Extracts the lesson number from a lesson text string.
 * Handles formats like "UFLI L7", "Lesson 42", "L128", "7", etc.
 * @param {string|number|null|undefined} lessonText - The lesson text to parse
 * @returns {number|null} The lesson number (1-128) or null if invalid
 * @example
 * extractLessonNumber("UFLI L7 reteach") // returns 7
 * extractLessonNumber("Lesson 42")       // returns 42
 * extractLessonNumber("L128")            // returns 128
 * extractLessonNumber("")                // returns null
 */
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
 * Calculates benchmark-style percentage for a skill section.
 * Uses total lessons in section as denominator (blanks = not passed yet).
 * This ensures consistency with benchmark calculations.
 * @param {Array<*>} mapRow - A row from the UFLI MAP sheet (student's lesson data)
 * @param {Array<number>} lessonIndices - Array of lesson numbers (1-128) in this section
 * @returns {number} Percentage as integer (0-100), or 0 if no lessons
 * @example
 * calculatePercentage(studentRow, [1, 2, 3, 4, 5]) // returns 80 (if 4 of 5 are 'Y')
 */
function calculatePercentage(mapRow, lessonIndices) {
  const denominator = lessonIndices.length;
  if (denominator === 0) return 0;

  let passed = 0;

  lessonIndices.forEach(lessonNum => {
    // Convert Lesson # to Array Index
    const idx = LAYOUT.LESSON_COLUMN_OFFSET + lessonNum - 1;

    if (idx < mapRow.length) {
      const status = mapRow[idx] ? mapRow[idx].toString().toUpperCase().trim() : "";
      if (status === 'Y') passed++;
      // Blanks, 'N', and 'A' are not counted as passed
    }
  });

  return Math.round((passed / denominator) * 100);
}

/**
 * Calculates benchmark percentage based on fixed denominator
 * @param {Array} mapRow - Student's row data
 * @param {Array<number>} lessonIndices - Lessons in benchmark
 * @param {number} denominator - Fixed total for benchmark
 * @returns {number} Percentage integer (defaults to 0)
 */
function calculateBenchmark(mapRow, lessonIndices, denominator) {
  if (denominator === 0) return 0;
  let passed = 0;
  
  lessonIndices.forEach(lessonNum => {
    const idx = LAYOUT.LESSON_COLUMN_OFFSET + lessonNum - 1;
    if (idx < mapRow.length) {
      const status = mapRow[idx] ? mapRow[idx].toString().toUpperCase().trim() : "";
      if (status === 'Y') passed++;
    }
  });
  
  return Math.round((passed / denominator) * 100);
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
  createMergedHeader(sheet, 1, "SMALL GROUP PROGRESS - DATA LOG", 6, {
    background: COLORS.TITLE_BG, fontColor: COLORS.TITLE_FG, fontWeight: "bold", fontSize: 14
  });
  createMergedHeader(sheet, 2, "Data from the Web App is saved here. Do not manually edit.", 6, {
    fontFamily: "Calibri", fontSize: 10, fontStyle: "italic"
  });
  setColumnHeaders(sheet, 4, ["Date", "Teacher", "Group Name", "Student Name", "Lesson Number", "Status"]);
  sheet.setColumnWidth(1, 100); sheet.setColumnWidth(2, 150); sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 200); sheet.setColumnWidth(5, 120); sheet.setColumnWidth(6, 80);
  sheet.setFrozenRows(4);
}

function createUFLIMapSheet(ss, wizardData) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES_V2.UFLI_MAP);
  const headerWidth = LAYOUT.COL_CURRENT_LESSON + LAYOUT.TOTAL_LESSONS;
  createMergedHeader(sheet, 1, "UFLI MAP - MASTER PROGRESS REPORT", headerWidth, {
    background: COLORS.TITLE_BG, fontColor: COLORS.TITLE_FG, fontWeight: "bold", fontSize: 14
  });
  const headers = ["Student Name", "Grade", "Teacher", "Group", "Current Lesson"];
  for (let i = 1; i <= LAYOUT.TOTAL_LESSONS; i++) headers.push(LESSON_LABELS[i] || `Lesson ${i}`);
  setColumnHeaders(sheet, 4, headers);
  
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
  sheet.setFrozenRows(4);
}

function createSkillsSheet(ss, wizardData) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES_V2.SKILLS);
  const skillSectionNames = Object.keys(SKILL_SECTIONS);
  const headers = ["Student Name", "Grade", "Teacher", "Group"];
  skillSectionNames.forEach(section => headers.push(section + " %"));
  setColumnHeaders(sheet, 4, headers);
  
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
  sheet.setFrozenRows(4);
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
  setColumnHeaders(sheet, 4, headers);
  
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
  sheet.setFrozenRows(4);
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
  let currentRow = 1;
  const columnCount = 1 + LAYOUT.LESSONS_PER_GROUP_SHEET;
  
  groupNames.forEach(groupName => {
    const groupStudents = allStudents.filter(s => s && s.group === groupName);
    createMergedHeader(sheet, currentRow, groupName, columnCount, {
      background: COLORS.HEADER_BG, fontColor: COLORS.HEADER_FG, fontWeight: "bold", fontSize: 12, horizontalAlignment: "center"
    });
    currentRow++;
    const columnHeaders = ["Student Name"];
    for (let i = 1; i <= LAYOUT.LESSONS_PER_GROUP_SHEET; i++) columnHeaders.push(`Lesson ${i}`);
    
    sheet.getRange(currentRow, 1, 1, columnHeaders.length).setValues([columnHeaders])
      .setBackground(COLORS.TITLE_BG).setFontColor(COLORS.TITLE_FG).setFontWeight("bold");
    currentRow++;
    sheet.getRange(currentRow, 1, 1, columnCount).setBackground(COLORS.SUB_HEADER_BG);
    currentRow++;
    
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
    currentRow++;
  });
  sheet.setColumnWidth(1, 200);
}

// ═══════════════════════════════════════════════════════════════════════════
// PACING REPORTS
// ═══════════════════════════════════════════════════════════════════════════

function createPacingReports(ss) {
  const dashboardSheet = getOrCreateSheet(ss, SHEET_NAMES_PACING.DASHBOARD);
  setColumnHeaders(dashboardSheet, 1, ["Group", "Teacher", "Students", "Assigned Lessons", "Tracked Lessons", "Pacing %", "Highest Lesson", "Last Entry", "Avg Pass %", "Avg Not Passed %", "Absent %"]);
  const logSheet = getOrCreateSheet(ss, SHEET_NAMES_PACING.LOG);
  setColumnHeaders(logSheet, 1, ["Group", "Teacher", "Lesson Slot", "UFLI Lesson", "Student Count", "Y Count", "N Count", "A Count", "Pass %", "Not Passed %", "Absent %", "Last Date"]);
}

function updatePacingReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);
  const progressSheet = ss.getSheetByName(SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
  if (!mapSheet || !progressSheet) return;

  const lookups = buildStudentLookups(mapSheet);
  const progressMap = buildProgressHistory(progressSheet);
  const { dashboardRows, logRows } = scanGradeSheetsForPacing(ss, lookups, progressMap);

  // Ensure headers are always present (prevents header loss)
  const dashboardSheet = ss.getSheetByName(SHEET_NAMES_PACING.DASHBOARD);
  const logSheet = ss.getSheetByName(SHEET_NAMES_PACING.LOG);
  if (dashboardSheet) {
    setColumnHeaders(dashboardSheet, 1, ["Group", "Teacher", "Students", "Assigned Lessons", "Tracked Lessons", "Pacing %", "Highest Lesson", "Last Entry", "Avg Pass %", "Avg Not Passed %", "Absent %"]);
  }
  if (logSheet) {
    setColumnHeaders(logSheet, 1, ["Group", "Teacher", "Lesson Slot", "UFLI Lesson", "Student Count", "Y Count", "N Count", "A Count", "Pass %", "Not Passed %", "Absent %", "Last Date"]);
  }

  writeDataToSheet(ss, SHEET_NAMES_PACING.DASHBOARD, dashboardRows, 2);
  writeDataToSheet(ss, SHEET_NAMES_PACING.LOG, logRows, 2);
  formatPacingSheet(ss, SHEET_NAMES_PACING.DASHBOARD, [6, 9, 10, 11], 0);  // All percent columns
  formatPacingSheet(ss, SHEET_NAMES_PACING.LOG, [9, 10, 11], 0);
}

// Helpers for Pacing (kept for compatibility)
function buildStudentLookups(mapSheet) {
  const studentCountByGroup = new Map();
  const teacherByGroup = new Map();
  const lastRow = mapSheet.getLastRow();
  if (lastRow < LAYOUT.DATA_START_ROW) return { studentCountByGroup, teacherByGroup };
  const data = mapSheet.getRange(LAYOUT.DATA_START_ROW, 1, lastRow - LAYOUT.DATA_START_ROW + 1, 4).getValues();
  data.forEach(row => {
    if (!row[0] || !row[3]) return;
    const groupKey = row[3].toString().trim();
    studentCountByGroup.set(groupKey, (studentCountByGroup.get(groupKey) || 0) + 1);
    if (row[2]) teacherByGroup.set(groupKey, row[2]);
  });
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
      if (cellA.includes("Group") && sheetData[i+1] && sheetData[i+1][0] === "Student Name") {
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

function buildDashboardRow(group, teacher, count, dash) {
  // Use total responses (Y+N+A) as denominator for all rates
  // This ensures Pass% + Not Passed% + Absent% = 100%
  const totalResponses = dash.pass + dash.fail + dash.absent;
  const passRate = totalResponses > 0 ? dash.pass / totalResponses : 0;
  const notPassedRate = totalResponses > 0 ? dash.fail / totalResponses : 0;
  const absentRate = totalResponses > 0 ? dash.absent / totalResponses : 0;
  return [group, teacher, count, dash.assigned, dash.tracked, dash.assigned>0?dash.tracked/dash.assigned:0, dash.highestLessonName, dash.lastEntry, passRate, notPassedRate, absentRate];
}

function writeDataToSheet(ss, sheetName, data, startRow) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow >= startRow) sheet.getRange(startRow, 1, lastRow - startRow + 1, sheet.getLastColumn()).clearContent();
  if (data && data.length > 0) sheet.getRange(startRow, 1, data.length, data[0].length).setValues(data);
}

function formatPacingSheet(ss, sheetName, percentCols, absCol) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return;
  const numRows = sheet.getLastRow() - 1;
  percentCols.forEach(col => sheet.getRange(2, col, numRows).setNumberFormat("0%"));
  if (absCol > 0) sheet.getRange(2, absCol, numRows).setNumberFormat("0");
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC & UPDATE FUNCTIONS (OPTIMIZED)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Optimized Sync: Reads all data, updates in memory, calculates current lesson, writes all back.
 * Includes error handling and lock protection for concurrent access.
 * @returns {Object} Result with success status and message
 */
function syncSmallGroupProgress() {
  const functionName = 'syncSmallGroupProgress';
  const lock = LockService.getScriptLock();

  try {
    // Acquire lock with 30 second timeout to prevent concurrent modifications
    if (!lock.tryLock(30000)) {
      log(functionName, 'Could not acquire lock - another sync may be in progress', 'WARN');
      return { success: false, message: 'Sync already in progress. Please try again in a moment.' };
    }

    log(functionName, 'Starting Optimized Sync (No Formulas)...');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const progressSheet = ss.getSheetByName(SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
    const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);

    if (!progressSheet || !mapSheet) {
      log(functionName, 'Required sheets not found', 'ERROR');
      return { success: false, message: 'Required sheets not found. Please run setup wizard.' };
    }

    // 1. BIG GULP: Read everything
    const lastProgressRow = progressSheet.getLastRow();
    const progressData = lastProgressRow >= LAYOUT.DATA_START_ROW ?
      progressSheet.getRange(LAYOUT.DATA_START_ROW, 1, lastProgressRow - LAYOUT.DATA_START_ROW + 1, 6).getValues() : [];

    const lastMapRow = Math.max(mapSheet.getLastRow(), LAYOUT.DATA_START_ROW);
    const mapData = mapSheet.getRange(1, 1, lastMapRow, LAYOUT.COL_FIRST_LESSON + LAYOUT.TOTAL_LESSONS - 1).getValues();

    // Group Sheets
    const groupSheetsData = {};
    const gradeSheetRegex = /^(PreK|KG|G[1-8]) Groups$/;
    ss.getSheets().forEach(sheet => {
      if (gradeSheetRegex.test(sheet.getName())) {
        groupSheetsData[sheet.getName()] = {
          sheet: sheet,
          values: sheet.getDataRange().getValues(),
          dirty: false
        };
      }
    });

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
      const [date, teacher, groupName, studentName, lessonNumber, status] = row;
      if (!studentName || !lessonNumber || !status) return;

      const lessonNum = extractLessonNumber(lessonNumber);
      if (!lessonNum) return;

      const cleanName = studentName.toString().trim().toUpperCase();

      // A. Update UFLI MAP Array
      const mapRowIdx = studentMapRowLookup[cleanName];
      if (mapRowIdx !== undefined) {
        const lessonColIdx = LAYOUT.LESSON_COLUMN_OFFSET + lessonNum - 1;
        mapData[mapRowIdx][lessonColIdx] = status;
      }

      // B. Update Group Sheet Array
      if (groupName) updateGroupArrayInMemory(groupSheetsData, groupName, studentName, lessonNum, status);

      // C. Track Current Lesson (Logic: Latest Date, then Highest Lesson)
      const rowDate = new Date(date);
      if (!isNaN(rowDate)) {
        if (!studentCurrentLesson[cleanName]) {
          studentCurrentLesson[cleanName] = { maxDate: rowDate, maxLesson: lessonNum };
        } else {
          const curr = studentCurrentLesson[cleanName];
          if (rowDate > curr.maxDate) {
            curr.maxDate = rowDate;
            curr.maxLesson = lessonNum;
          } else if (rowDate.getTime() === curr.maxDate.getTime()) {
            if (lessonNum > curr.maxLesson) curr.maxLesson = lessonNum;
          }
        }
      }
    });

    // 4. APPLY CURRENT LESSON TO MAP ARRAY
    Object.keys(studentCurrentLesson).forEach(name => {
      const mapRowIdx = studentMapRowLookup[name];
      if (mapRowIdx !== undefined) {
        const lessonNum = studentCurrentLesson[name].maxLesson;
        // Column E (Index 4) is Current Lesson
        mapData[mapRowIdx][4] = `UFLI L${lessonNum}`;
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
    return { success: true, message: 'Sync completed successfully.' };

  } catch (error) {
    log(functionName, `Error during sync: ${error.toString()}`, 'ERROR');
    return { success: false, message: 'Sync failed: ' + error.toString() };
  } finally {
    // Always release the lock, even if an error occurred
    try {
      lock.releaseLock();
    } catch (e) {
      // Lock may have already been released or expired
      log(functionName, 'Lock release warning: ' + e.toString(), 'WARN');
    }
  }
}

function updateGroupArrayInMemory(groupSheetsData, groupName, studentName, lessonNum, status) {
  const gradeMatch = groupName.match(/^([A-Za-z0-9]+)/);
  if (!gradeMatch) return;
  const sheetName = `${gradeMatch[1]} Groups`;
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

/**
 * Calculates and Writes stats for BOTH UFLI (K-8) and HWT (Pre-K)
 * Merges data into Skills Tracker and Grade Summary
 *
 * v5.1 FIXES:
 * - Skip PreK students in UFLI loop (prevents duplicates)
 * - Correct PreK metric mapping (Form→Foundational, Name+Sound→MinGrade, All→FullGrade)
 * - Use fixed denominators for PreK (26/52/78)
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Array} mapData - Optional pre-loaded UFLI MAP data
 * @returns {Object} Result with success status and message
 */
function updateAllStats(ss, mapData) {
  const functionName = 'updateAllStats';

  try {
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

  // Read Initial Assessment Data (UFLI only)
  const initialSheet = ss.getSheetByName(SHEET_NAMES_V2.INITIAL_ASSESSMENT);
  const initialData = initialSheet ? initialSheet.getDataRange().getValues() : [];
  const initialMap = {};
  for (let i = LAYOUT.DATA_START_ROW - 1; i < initialData.length; i++) {
    if (initialData[i][0]) initialMap[initialData[i][0].toString().trim().toUpperCase()] = initialData[i];
  }
  
  // Output Arrays
  const skillsOutput = []; 
  const summaryOutput = []; 
  const skillEntries = Object.entries(SKILL_SECTIONS);
  
  // --- PROCESS UFLI STUDENTS (K-8) ---
  for (let i = LAYOUT.DATA_START_ROW - 1; i < mapData.length; i++) {
    const row = mapData[i];
    if (!row[0]) continue; // Skip blank names
    
    // FIX #1: Skip PreK students - they are handled separately from Pre-K Data sheet
    if (row[1] && row[1].toString().trim() === "PreK") continue;

    const metadata = [row[0], row[1], row[2], row[3]]; // Name, Grade, Teacher, Group
    const cleanName = row[0].toString().trim().toUpperCase();
    const initialRow = initialMap[cleanName];
    const grade = row[1];

    // Skills Tracker Row
    const skillsRow = [...metadata];
    skillEntries.forEach(([_, lessons]) => {
      skillsRow.push(calculatePercentage(row, lessons));
    });
    skillsOutput.push(skillsRow);

    // Grade Summary Row
    const summaryRow = [...metadata];
    const metrics = GRADE_METRICS[grade];

    if (metrics) {
      const foundPct = calculateBenchmark(row, metrics.foundational.lessons, metrics.foundational.denominator);
      summaryRow.push(foundPct);
      summaryRow.push(calculateBenchmark(row, metrics.minimum.lessons, metrics.minimum.denominator));
      summaryRow.push(calculateBenchmark(row, metrics.currentYear.lessons, metrics.currentYear.denominator));
      
      let status = "Intervention";
      if (foundPct >= 80) status = "On Track";
      else if (foundPct >= 50) status = "Needs Support";
      summaryRow.push(status);
    } else {
      summaryRow.push("", "", "", "");
    }

    // Add Detailed Skill Sections (Initial/AG/Total)
    skillEntries.forEach(([_, lessons]) => {
      const totalPct = calculatePercentage(row, lessons);
      const initialPct = initialRow ? calculatePercentage(initialRow, lessons) : "";
      let agPct = (totalPct !== "" && initialPct !== "") ? totalPct - initialPct : "";
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
      
      // FIX #2 & #3: Use corrected calculatePreKScores with fixed denominators
      const scores = calculatePreKScores(row, preKHeaders);

      // Skills Tracker Row (PreK doesn't use UFLI Skills, fill with blanks)
      const skillsRow = [...metadata];
      skillEntries.forEach(() => skillsRow.push(""));
      skillsOutput.push(skillsRow);

      // Grade Summary Row
      const summaryRow = [...metadata];
      
      // CORRECT MAPPING (v5.1):
      // Foundational Skills % = Form / 26 (Motor Integration)
      // Min Grade Skills %    = (Name + Sound) / 52 (Literacy Knowledge)
      // Full Grade Skills %   = (Name + Sound + Form) / 78 (K-Readiness)
      summaryRow.push(scores.foundational);  // Form / 26
      summaryRow.push(scores.minGrade);      // (Name + Sound) / 52
      summaryRow.push(scores.fullGrade);     // (Name + Sound + Form) / 78
      
      // Status Logic for PreK (based on Full Grade Skills - K-Readiness)
      let status = "Intervention";
      if (scores.fullGrade >= 80) status = "On Track";
      else if (scores.fullGrade >= 50) status = "Needs Support";
      summaryRow.push(status);

      // Fill remaining detailed columns with blanks (PreK doesn't use UFLI skill sections)
      skillEntries.forEach(() => summaryRow.push("", "", ""));
      
      summaryOutput.push(summaryRow);
    }
  }

  // --- WRITE DATA ---

  // Build header arrays (same logic as createSkillsSheet/createGradeSummarySheet)
  const skillSectionNames = Object.keys(SKILL_SECTIONS);

  // 1. Skills Tracker
  const skillsSheet = getOrCreateSheet(ss, SHEET_NAMES_V2.SKILLS, false);
  // Ensure headers are present (row 4)
  const skillsHeaders = ["Student Name", "Grade", "Teacher", "Group"];
  skillSectionNames.forEach(section => skillsHeaders.push(section + " %"));
  setColumnHeaders(skillsSheet, 4, skillsHeaders);

  if (skillsOutput.length > 0) {
    // Sort combined list by Grade, then Name
    skillsOutput.sort((a, b) => (a[1] || "").localeCompare(b[1] || "") || (a[0] || "").localeCompare(b[0] || ""));

    skillsSheet.getRange(LAYOUT.DATA_START_ROW, 1, skillsOutput.length, skillsOutput[0].length).setValues(skillsOutput);
    skillsSheet.getRange(LAYOUT.DATA_START_ROW, 5, skillsOutput.length, skillsOutput[0].length - 4).setNumberFormat('0"%"');
  }

  // 2. Grade Summary
  const summarySheet = getOrCreateSheet(ss, SHEET_NAMES_V2.GRADE_SUMMARY, false);
  // Ensure headers are present (row 4)
  const summaryHeaders = [
    "Student Name", "Grade", "Teacher", "Group",
    "Foundational Skills %", "Min Grade Skills %", "Full Grade Skills %", "Benchmark Status"
  ];
  skillSectionNames.forEach(section => {
    summaryHeaders.push(`${section} (Initial %)`);
    summaryHeaders.push(`${section} (AG%)`);
    summaryHeaders.push(`${section} (Total %)`);
  });
  setColumnHeaders(summarySheet, 4, summaryHeaders);

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

    log(functionName, 'Stats update complete.');
    return { success: true, message: 'Statistics updated successfully.' };

  } catch (error) {
    log(functionName, `Error updating stats: ${error.toString()}`, 'ERROR');
    return { success: false, message: 'Stats update failed: ' + error.toString() };
  }
}

function updateStatsForNewStudents() {
  const functionName = 'updateStatsForNewStudents';
  log(functionName, 'Updating stats for new students...');
  syncSmallGroupProgress(); // Sync will handle everything
  log(functionName, 'Update complete.');
}

/**
 * MASTER REFRESH FUNCTION - Updates all progress data and dashboards
 * This is the single entry point for refreshing all data in the system.
 * Called from menu: "📊 Update Progress Data"
 *
 * Execution order:
 * 1. syncSmallGroupProgress() - Syncs lesson data from group sheets to UFLI MAP
 *    → Internally calls updateAllStats() which populates Grade Summary & Skills Tracker
 * 2. updatePacingReports() - Updates Pacing Dashboard and Log
 * 3. updateSchoolSummary() - Rebuilds the School Summary Dashboard
 */
function updateAllProgress() {
  const functionName = 'updateAllProgress';
  log(functionName, 'Starting full data refresh...');

  // 1. Sync small group progress (includes updateAllStats)
  syncSmallGroupProgress();

  // 2. Update pacing reports
  updatePacingReports();

  // 3. Update school summary dashboard (previously orphaned!)
  updateSchoolSummary();

  log(functionName, 'Full data refresh complete.');
  SpreadsheetApp.getUi().alert('Update Complete', 'All progress data, pacing reports, and school summary have been refreshed.', SpreadsheetApp.getUi().ButtonSet.OK);
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
  const pacingData = pacingSheet ? pacingSheet.getDataRange().getValues().slice(1) : []; 
  
  const configSheetName = (typeof SHEET_NAMES !== 'undefined' && SHEET_NAMES.CONFIG) 
    ? SHEET_NAMES.CONFIG : "SetupWizard_Config";
  const configSheet = ss.getSheetByName(configSheetName);
  const schoolName = configSheet && configSheet.getLastRow() > 1 
    ? configSheet.getRange(2, 2).getValue() : "UFLI Site";
  
  // 2. INITIAL SETUP
  summarySheet.clear();
  summarySheet.clearConditionalFormatRules();
  
  // Set column widths for clean layout
  summarySheet.setColumnWidth(1, 200);  // Labels
  summarySheet.setColumnWidth(2, 120);  // Metric 1
  summarySheet.setColumnWidth(3, 120);  // Metric 2
  summarySheet.setColumnWidth(4, 120);  // Metric 3
  summarySheet.setColumnWidth(5, 140);  // Status
  
  // Set default font
  summarySheet.getRange(1, 1, 500, 5).setFontFamily("Calibri");
  
  // 3. RENDER HEADER
  let currentRow = renderDashboardHeader(summarySheet, schoolName);
  
  const grades = getExistingGrades(configSheet);

  // 4. GRADE-LEVEL PROCESSING LOOP
  grades.forEach(grade => {
    const gradeStudents = Array.from(studentData.values()).filter(s => s[1] && s[1].toString() === grade);
    const gradeGroups = pacingData.filter(row => row[0] && row[0].toString().startsWith(grade));
    
    if (gradeStudents.length === 0) return;

    currentRow = renderGradeCard(summarySheet, currentRow, grade, gradeStudents, gradeGroups);
  });

  // 5. FINAL TOUCHES
  // Freeze header rows
  summarySheet.setFrozenRows(4);
  
  log(functionName, 'School Summary Update Complete.');
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADER RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function renderDashboardHeader(sheet, schoolName) {
  // Row 1: Main title bar
  sheet.getRange(1, 1, 1, 5).merge()
    .setValue(`📊  SCHOOL SUMMARY DASHBOARD`)
    .setBackground(DASHBOARD_COLORS.HEADER_BG)
    .setFontColor(DASHBOARD_COLORS.HEADER_TEXT)
    .setFontSize(18)
    .setFontWeight("bold")
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("center");
  sheet.setRowHeight(1, 50);
  
  // Row 2: School name and date
  sheet.getRange(2, 1, 1, 3).merge()
    .setValue(schoolName)
    .setFontSize(12)
    .setFontWeight("bold")
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL)
    .setVerticalAlignment("middle");
  
  sheet.getRange(2, 4, 1, 2).merge()
    .setValue(`Updated: ${new Date().toLocaleDateString()}`)
    .setFontSize(10)
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL)
    .setHorizontalAlignment("right")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(2, 30);
  
  // Row 3: Subtle divider line
  sheet.getRange(3, 1, 1, 5)
    .setBorder(null, null, true, null, null, null, DASHBOARD_COLORS.CARD_BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(3, 8);
  
  // Row 4: Spacer
  sheet.setRowHeight(4, 15);
  
  return 5; // Next available row
}

// ═══════════════════════════════════════════════════════════════════════════
// GRADE CARD RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function renderGradeCard(sheet, startRow, grade, students, groups) {
  let row = startRow;
  
  // --- GRADE HEADER ---
  sheet.getRange(row, 1, 1, 5).merge()
    .setValue(`${grade}  •  ${students.length} students  •  ${groups.length} groups`)
    .setBackground(DASHBOARD_COLORS.GRADE_HEADER_BG)
    .setFontColor(DASHBOARD_COLORS.GRADE_HEADER_TEXT)
    .setFontSize(13)
    .setFontWeight("bold")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(row, 36);
  row++;
  
  // Small spacer
  sheet.setRowHeight(row, 10);
  row++;

  // Calculate metrics
  const bands = calculateDistributionBands(students);
  const pace = calculateGradePacing(groups);
  const skills = calculateSkillAverages(students);

  // For PreK: Show separate Growth & Pacing section, then HWT Skill Averages
  // For K-8: Show combined Growth & Pacing table with all skill metrics
  if (grade === "PreK") {
    const growth = calculateGrowthMetrics(students);
    row = renderMetricsRow(sheet, row, growth, bands, pace, students.length);
  }

  // --- SKILL METRICS SECTION ---
  row = renderSkillAveragesRow(sheet, row, skills, grade, pace);

  // --- DISTRIBUTION BARS ---
  row = renderDistributionSection(sheet, row, bands, students.length);
  
  // --- GROUP PERFORMANCE TABLE ---
  if (groups.length > 0) {
    row = renderGroupTable(sheet, row, groups);
  }
  
  // --- CARD BOTTOM BORDER ---
  sheet.getRange(row, 1, 1, 5)
    .setBorder(null, null, true, null, null, null, DASHBOARD_COLORS.CARD_BORDER, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  row++;
  
  // Spacer between cards
  sheet.setRowHeight(row, 20);
  row++;
  
  return row;
}

// ═══════════════════════════════════════════════════════════════════════════
// METRICS ROW (Growth + Pacing Summary)
// ═══════════════════════════════════════════════════════════════════════════

function renderMetricsRow(sheet, row, growth, bands, pace, totalStudents) {
  // Section label
  sheet.getRange(row, 1).setValue("📈 Growth & Pacing")
    .setFontWeight("bold")
    .setFontSize(11)
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
  row++;
  
  // Headers
  const headers = ["Initial Avg", "Current Avg", "Growth", "Pacing", "Status"];
  sheet.getRange(row, 1, 1, 5).setValues([headers])
    .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center");
  sheet.setRowHeight(row, 28);
  row++;
  
  // Values
  const growthTrend = growth.growth > 5 ? "📈 Growing" : (growth.growth >= 0 ? "➡️ Stable" : "📉 Declining");
  const values = [
    growth.initialAvg / 100,
    growth.currentAvg / 100,
    (growth.growth >= 0 ? "+" : "") + growth.growth + "%",
    pace.pacing / 100,
    growthTrend
  ];
  
  sheet.getRange(row, 1, 1, 5).setValues([values])
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setFontSize(11);
  
  // Format percentages
  sheet.getRange(row, 1, 1, 2).setNumberFormat("0%");
  sheet.getRange(row, 4).setNumberFormat("0%");
  
  // Color-code growth
  const growthCell = sheet.getRange(row, 3);
  if (growth.growth > 5) {
    growthCell.setFontColor(DASHBOARD_COLORS.ON_TRACK).setFontWeight("bold");
  } else if (growth.growth < 0) {
    growthCell.setFontColor(DASHBOARD_COLORS.AT_RISK).setFontWeight("bold");
  }
  
  sheet.setRowHeight(row, 30);
  row++;

  // Spacer
  sheet.setRowHeight(row, 12);
  row++;

  return row;
}

/**
 * Render the skill averages section
 * PreK: Shows HWT metrics in single row format
 * K-8: Shows Metric/Initial/Current/Growth/Pacing table format
 */
function renderSkillAveragesRow(sheet, row, skills, grade, pace) {
  const isPreK = grade === "PreK";

  if (isPreK) {
    // --- PreK Format: Single row with current values ---
    sheet.getRange(row, 1).setValue("📝 HWT Skill Averages")
      .setFontWeight("bold")
      .setFontSize(11)
      .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
    row++;

    const headers = ["Motor (Form)", "Literacy (Name+Sound)", "K-Readiness (All)", "", ""];
    sheet.getRange(row, 1, 1, 5).setValues([headers])
      .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
      .setFontWeight("bold")
      .setFontSize(10)
      .setHorizontalAlignment("center");
    sheet.setRowHeight(row, 28);
    row++;

    const values = [
      skills.foundationalAvg / 100,
      skills.minGradeAvg / 100,
      skills.fullGradeAvg / 100,
      "", ""
    ];
    sheet.getRange(row, 1, 1, 5).setValues([values])
      .setHorizontalAlignment("center")
      .setFontSize(11);
    sheet.getRange(row, 1, 1, 3).setNumberFormat("0%");

    // Color-code
    [skills.foundationalAvg, skills.minGradeAvg, skills.fullGradeAvg].forEach((val, i) => {
      const cell = sheet.getRange(row, i + 1);
      if (val >= 80) cell.setFontColor(DASHBOARD_COLORS.ON_TRACK).setFontWeight("bold");
      else if (val < 50) cell.setFontColor(DASHBOARD_COLORS.AT_RISK).setFontWeight("bold");
    });

    sheet.setRowHeight(row, 30);
    row++;

  } else {
    // --- K-8 Format: Table with Metric/Initial/Current/Growth/Pacing ---
    sheet.getRange(row, 1).setValue("📈 Growth & Pacing")
      .setFontWeight("bold")
      .setFontSize(11)
      .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
    row++;

    // Headers
    const headers = ["Metric", "Initial", "Current", "Growth", "Seq. Pacing"];
    sheet.getRange(row, 1, 1, 5).setValues([headers])
      .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
      .setFontWeight("bold")
      .setFontSize(10)
      .setHorizontalAlignment("center");
    sheet.setRowHeight(row, 28);
    row++;

    // Data rows - Pacing only on first row, will merge cells below
    const pacing = pace ? pace.pacing / 100 : 0;
    const tableData = [
      ["Foundational Skills", skills.foundational.initial / 100, skills.foundational.current / 100,
       (skills.foundational.growth >= 0 ? "+" : "") + skills.foundational.growth + "%", ""],
      ["Min Grade Skills", skills.minGrade.initial / 100, skills.minGrade.current / 100,
       (skills.minGrade.growth >= 0 ? "+" : "") + skills.minGrade.growth + "%", ""],
      ["Full Grade Skills", skills.fullGrade.initial / 100, skills.fullGrade.current / 100,
       (skills.fullGrade.growth >= 0 ? "+" : "") + skills.fullGrade.growth + "%", ""]
    ];

    sheet.getRange(row, 1, 3, 5).setValues(tableData)
      .setFontSize(10)
      .setVerticalAlignment("middle");

    // Format columns
    sheet.getRange(row, 2, 3, 2).setNumberFormat("0%");  // Initial & Current as %
    sheet.getRange(row, 2, 3, 4).setHorizontalAlignment("center");

    // Merge Pacing column cells and add labeled pacing value
    const pacingRange = sheet.getRange(row, 5, 3, 1);
    pacingRange.merge()
      .setValue(pacing)
      .setNumberFormat("0%")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle")
      .setFontSize(14)
      .setFontWeight("bold");

    // Color-code growth values
    for (let i = 0; i < 3; i++) {
      const growthCell = sheet.getRange(row + i, 4);
      const growth = [skills.foundational.growth, skills.minGrade.growth, skills.fullGrade.growth][i];
      if (growth > 5) {
        growthCell.setFontColor(DASHBOARD_COLORS.ON_TRACK).setFontWeight("bold");
      } else if (growth < 0) {
        growthCell.setFontColor(DASHBOARD_COLORS.AT_RISK).setFontWeight("bold");
      }
    }

    // Alternating row colors
    sheet.getRange(row + 1, 1, 1, 5).setBackground(DASHBOARD_COLORS.TABLE_ALT_ROW);

    for (let i = 0; i < 3; i++) {
      sheet.setRowHeight(row + i, 26);
    }
    row += 3;
  }

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
  
  // Render each band (labels match Grade Summary status column)
  row = renderProgressBar(sheet, row, "On Track (80%+)", bands.onTrack, totalStudents,
    DASHBOARD_COLORS.ON_TRACK, DASHBOARD_COLORS.ON_TRACK_BG);
  row = renderProgressBar(sheet, row, "Needs Support (50-79%)", bands.progressing, totalStudents,
    DASHBOARD_COLORS.PROGRESSING, DASHBOARD_COLORS.PROGRESSING_BG);
  row = renderProgressBar(sheet, row, "Intervention (<50%)", bands.atRisk, totalStudents,
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
// GROUP PERFORMANCE TABLE
// ═══════════════════════════════════════════════════════════════════════════

function renderGroupTable(sheet, row, groups) {
  // Section label
  sheet.getRange(row, 1).setValue("✅ Group Performance")
    .setFontWeight("bold")
    .setFontSize(11)
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
  row++;
  
  // Headers
  const headers = ["Group", "Students", "Pass Rate", "Absent Rate", "Status"];
  sheet.getRange(row, 1, 1, 5).setValues([headers])
    .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center");
  sheet.setRowHeight(row, 26);
  row++;
  
  // Process groups
  let flaggedGroups = [];
  
  const tableData = groups.map((g, index) => {
    const passRate = parseFloat(g[8]) || 0;
    const absentRate = parseFloat(g[10]) || 0;  // Already a rate from Pacing Dashboard
    const studentCount = parseFloat(g[2]) || 1;
    
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
    
    // Truncate group name if too long
    const groupName = g[0].toString().length > 20 
      ? g[0].toString().substring(0, 18) + "..." 
      : g[0];
    
    return [groupName, studentCount, passRate, absentRate, status];
  });
  
  // Write table data
  if (tableData.length > 0) {
    sheet.getRange(row, 1, tableData.length, 5).setValues(tableData)
      .setFontSize(10)
      .setVerticalAlignment("middle");

    // Format Students column as plain number (prevent percentage inheritance)
    sheet.getRange(row, 2, tableData.length, 1).setNumberFormat("0");

    // Format Pass Rate and Absent Rate as percentages
    sheet.getRange(row, 3, tableData.length, 2).setNumberFormat("0%");

    // Center align numeric columns
    sheet.getRange(row, 2, tableData.length, 4).setHorizontalAlignment("center");
    
    // Alternating row colors
    for (let i = 0; i < tableData.length; i++) {
      if (i % 2 === 1) {
        sheet.getRange(row + i, 1, 1, 5).setBackground(DASHBOARD_COLORS.TABLE_ALT_ROW);
      }
      sheet.setRowHeight(row + i, 24);
    }
    
    row += tableData.length;
  }
  
  // Flags summary if any
  if (flaggedGroups.length > 0) {
    sheet.getRange(row, 1, 1, 5).merge()
      .setValue(`⚠️ ${flaggedGroups.length} group(s) need attention: ${flaggedGroups.join(", ")}`)
      .setFontColor(DASHBOARD_COLORS.AT_RISK)
      .setFontSize(10)
      .setFontStyle("italic");
    sheet.setRowHeight(row, 24);
    row++;
  }
  
  // Spacer
  sheet.setRowHeight(row, 8);
  row++;
  
  return row;
}

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATION HELPERS (Dashboard)
// ═══════════════════════════════════════════════════════════════════════════

function calculateGrowthMetrics(students) {
  let initialSum = 0, currentSum = 0, count = 0;
  students.forEach(s => {
    const grade = s[1] ? s[1].toString().trim() : "";
    const current = parseFloat(s[4]);  // Foundational Skills %

    // PreK students don't have Initial Assessment (s[8] is blank)
    // Use Full Grade Skills (s[6]) as current for PreK, with initial=0
    if (grade === "PreK") {
      const prekCurrent = parseFloat(s[6]) || parseFloat(s[4]) || 0;  // Full Grade or Foundational
      currentSum += prekCurrent;
      initialSum += 0;  // PreK has no initial assessment
      count++;
    } else {
      const initial = parseFloat(s[8]);  // First skill section Initial %
      if (!isNaN(current) && !isNaN(initial)) {
        initialSum += initial;
        currentSum += current;
        count++;
      }
    }
  });

  const initialAvg = count > 0 ? Math.round(initialSum / count) : 0;
  const currentAvg = count > 0 ? Math.round(currentSum / count) : 0;
  return { initialAvg, currentAvg, growth: currentAvg - initialAvg };
}

function calculateDistributionBands(students) {
  const bands = { onTrack: 0, progressing: 0, atRisk: 0 };
  students.forEach(s => {
    const grade = s[1] ? s[1].toString().trim() : "";
    // PreK uses Full Grade Skills (s[6] - K-Readiness) for status
    // K-8 uses Foundational Skills (s[4])
    const score = grade === "PreK"
      ? (parseFloat(s[6]) || parseFloat(s[4]) || 0)
      : (parseFloat(s[4]) || 0);

    if (score >= 80) bands.onTrack++;
    else if (score >= 50) bands.progressing++;
    else bands.atRisk++;
  });
  return bands;
}

function calculateGradePacing(groups) {
  let assigned = 0, completed = 0;
  groups.forEach(g => {
    assigned += (parseInt(g[3]) || 0);
    completed += (parseInt(g[4]) || 0);
  });
  return { assigned, completed, pacing: assigned > 0 ? Math.round((completed / assigned) * 100) : 0 };
}

/**
 * Calculate detailed skill metrics with Initial, Current, and Growth for K-8 grades
 * Uses Grade Summary columns: s[4-6] for Current, s[8,11,14...] for Initial data
 * @param {Array} students - Array of student rows from Grade Summary
 * @returns {Object} { foundational, minGrade, fullGrade } each with { initial, current, growth }
 */
function calculateSkillAverages(students) {
  // Sums for Current values (from main metric columns)
  let foundCurrSum = 0, minCurrSum = 0, fullCurrSum = 0;
  // Sums for Initial values (from detailed skill section columns)
  let foundInitSum = 0, minInitSum = 0, fullInitSum = 0;
  let count = 0;

  students.forEach(s => {
    const foundCurrent = parseFloat(s[4]) || 0;
    const minCurrent = parseFloat(s[5]) || 0;
    const fullCurrent = parseFloat(s[6]) || 0;

    // Initial values from detailed skill section columns
    // Columns 8, 11, 14, 17... are Initial % for each skill section
    // Foundational: First 4 skill sections (8, 11, 14, 17) - Basic phonics
    // Min Grade: First 8 sections (8, 11, 14, 17, 20, 23, 26, 29)
    // Full Grade: All skill sections
    let foundInitials = [], minInitials = [], fullInitials = [];

    // Extract Initial values from columns 8, 11, 14, 17, 20, 23... (every 3rd starting at 8)
    for (let col = 8; col < s.length; col += 3) {
      const initVal = parseFloat(s[col]);
      if (!isNaN(initVal)) {
        fullInitials.push(initVal);
        if (fullInitials.length <= 8) minInitials.push(initVal);
        if (fullInitials.length <= 4) foundInitials.push(initVal);
      }
    }

    // Calculate averages of Initial values
    const foundInit = foundInitials.length > 0 ? foundInitials.reduce((a, b) => a + b, 0) / foundInitials.length : 0;
    const minInit = minInitials.length > 0 ? minInitials.reduce((a, b) => a + b, 0) / minInitials.length : 0;
    const fullInit = fullInitials.length > 0 ? fullInitials.reduce((a, b) => a + b, 0) / fullInitials.length : 0;

    foundCurrSum += foundCurrent;
    minCurrSum += minCurrent;
    fullCurrSum += fullCurrent;
    foundInitSum += foundInit;
    minInitSum += minInit;
    fullInitSum += fullInit;
    count++;
  });

  let foundCurr = count > 0 ? Math.round(foundCurrSum / count) : 0;
  let minCurr = count > 0 ? Math.round(minCurrSum / count) : 0;
  let fullCurr = count > 0 ? Math.round(fullCurrSum / count) : 0;
  let foundInit = count > 0 ? Math.round(foundInitSum / count) : 0;
  let minInit = count > 0 ? Math.round(minInitSum / count) : 0;
  let fullInit = count > 0 ? Math.round(fullInitSum / count) : 0;

  // For grades where all three metrics use the same lessons (KG, PreK),
  // the Current values will be identical. Use consistent Initial values too.
  if (foundCurr === minCurr && minCurr === fullCurr) {
    // Use foundational Initial for all three to ensure consistency
    minInit = foundInit;
    fullInit = foundInit;
  }

  return {
    foundational: { initial: foundInit, current: foundCurr, growth: foundCurr - foundInit },
    minGrade: { initial: minInit, current: minCurr, growth: minCurr - minInit },
    fullGrade: { initial: fullInit, current: fullCurr, growth: fullCurr - fullInit },
    // Keep legacy format for backward compatibility
    foundationalAvg: foundCurr,
    minGradeAvg: minCurr,
    fullGradeAvg: fullCurr
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets all data from a sheet as a Map keyed by student name (column A).
 * This is the CANONICAL version - used by both Phase2 and Setupwizard.
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {string} sheetName - Sheet name
 * @returns {Map} Map of studentName -> rowArray
 */
function getSheetDataAsMap(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < LAYOUT.DATA_START_ROW) {
    return new Map();
  }

  const data = sheet.getDataRange().getValues();
  // Skip header rows (first 4)
  const dataRows = data.slice(LAYOUT.DATA_START_ROW - 1);

  return new Map(dataRows.filter(row => row[0]).map(row => [row[0].toString(), row]));
}

function getExistingGrades(configSheet) {
  return ['PreK', 'KG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];
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

function repairAllGroupSheetFormatting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const regex = /^(PreK|KG|G[1-8]) Groups$/;
  ss.getSheets().forEach(sheet => {
    if (regex.test(sheet.getName())) {
      sheet.clearConditionalFormatRules();
      const data = sheet.getDataRange().getValues();
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] === "Student Name") {
          applyStatusConditionalFormatting(sheet, i + 3, 2, 20, LAYOUT.LESSONS_PER_GROUP_SHEET);
        }
      }
    }
  });
  SpreadsheetApp.getUi().alert('Group Sheets formatted.');
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE ROW HELPERS (FOR ADDING STUDENTS VIA WIZARD)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Placeholder for adding skill formulas to a new student row.
 * NOTE: Intentionally empty - the "Big Gulp" sync pattern fills all data
 * on the next syncSmallGroupProgress() call. No formulas are used;
 * static values are calculated and written in batch for performance.
 * @param {Sheet} sheet - Skills Tracker sheet
 * @param {number} row - Row number for the new student
 */
function addSkillFormulasForRow(sheet, row) {
  // No-op: Data is populated by updateAllStats() during next sync
}

/**
 * Placeholder for adding grade summary formulas to a new student row.
 * NOTE: Intentionally empty - the "Big Gulp" sync pattern fills all data
 * on the next syncSmallGroupProgress() call. No formulas are used;
 * static values are calculated and written in batch for performance.
 * @param {Sheet} sheet - Grade Summary sheet
 * @param {number} row - Row number for the new student
 * @param {Object} studentObj - Student object with grade property
 */
function addGradeSummaryFormulasForRow(sheet, row, studentObj) {
  // No-op: Data is populated by updateAllStats() during next sync
}

// NOTE: addStudentToSheet() is defined in Setupwizard.gs (Student Management section)
// The canonical version there includes formula setup for UFLI_MAP, Skills, and Grade Summary sheets

// NOTE: updateStudentInSheet() is defined in Setupwizard.gs (Student Management section)
// This file uses the canonical version from there to avoid duplicate definitions
