/**
 * ⚠️ DEPRECATED - Phase 7d
 * This file has been consolidated into Phase2_ProgressTracking_Unified.gs
 * School-specific extensions are in: (none for GlobalPrep)
 * See: PHASE7_AUDIT_REPORT.md § 1.1 and § 3.1
 * This file is retained for reference only and should not be modified.
 * Migration date: 2026-02-19
 */

// ═══════════════════════════════════════════════════════════════════════════
// UFLI MASTER SYSTEM - SYSTEM SHEETS (PHASE 2)
// Sheet Generation, Progress Tracking, Sync, and Pacing Engine
// ═══════════════════════════════════════════════════════════════════════════
// Core calculation functions are imported from SharedEngine.gs
// Version: 5.5 - BULLETPROOF FORMATTING FIX
// Last Updated: January 2026
//
// ARCHITECTURE:
// - SetupWizard_v3.gs owns: Config constants, menu, wizard, manage UI, reports, web app
// - This file owns: System constants, sheet generation, sync, pacing, repair
// - SharedEngine.gs provides: Core calculation functions, lesson arrays, grade metrics
//
// MAJOR CHANGES v5.5:
// - Implemented Granular Formatting: Formats columns one by one instead of in blocks.
// - Added individual try/catch blocks to every formatting call to skip "Typed" columns.
// - Fixed "Sync Complete" followed by error issue.
// - Refactored to use SharedEngine.gs for core calculation functions
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
  FORM_DENOMINATOR: 26,         // 26 letters for Form (motor integration)
  NAME_SOUND_DENOMINATOR: 52,   // 26 Name + 26 Sound (literacy knowledge)
  FULL_DENOMINATOR: 78          // 26 Name + 26 Sound + 26 Form (K-readiness)
};

const SHEET_NAMES_PACING = {
  DASHBOARD: "Pacing Dashboard",
  LOG: "Pacing Log"
};

const LAYOUT = {
  DATA_START_ROW: 6,            // First row of actual data
  HEADER_ROW_COUNT: 5,          // Number of header rows
  LESSON_COLUMN_OFFSET: 5,      // Lessons start at column F (6), so offset is 5 (Index 5 in 0-based array)
  TOTAL_LESSONS: 128,           // Total number of UFLI lessons
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
  Y: "#d4edda",         // Light green - Yes/Pass
  N: "#f8d7da",         // Light red - No/Fail
  A: "#fff3cd",         // Light yellow - Absent
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

// ═══════════════════════════════════════════════════════════════════════════
// SHARED ENGINE - Core calculation functions are imported from SharedEngine.gs
// ═══════════════════════════════════════════════════════════════════════════
// The following functions are now defined in SharedEngine.gs:
// - calculateBenchmark(): Benchmark calculation with gateway logic
// - calculateSectionPercentage(): Section percentage with gateway logic
// - updateAllStats(): Core statistics update engine
// - calculatePreKScores(): HWT Pre-K score calculations
// - countYsInColumns(): Helper for Pre-K calculations
// - partitionLessonsByReview(): Partition lessons into review/non-review
// - checkGateway(): Gateway status checking
// - getLessonStatus(): Get lesson status from row
// - getLessonColumnIndex(): Get column index for lesson
// - isReviewLesson(): Check if lesson is a review
// - getColumnLetter(): Convert column number to letter
// - extractLessonNumber(): Extract lesson number from text
// - normalizeStudent(): Normalize student name
// - getLastLessonColumn(): Get last lesson column letter
// - getOrCreateSheet(): Get or create sheet
// - log(): Logging function
// - createMergedRow(): Create merged row preserving Y values
//
// The following lesson arrays are imported from SharedEngine.gs:
// - FOUNDATIONAL_LESSONS: Lessons 1-34
// - G1_MINIMUM_LESSONS: G1 minimum lessons
// - G1_CURRENT_YEAR_LESSONS: G1 current year lessons
// - G2_MINIMUM_LESSONS: G2 minimum lessons
// - G2_CURRENT_YEAR_LESSONS: G2 current year lessons
// - G4_MINIMUM_LESSONS: G4-G8 minimum lessons
// - ALL_NON_REVIEW_LESSONS: All non-review lessons
// - SHARED_GRADE_METRICS: Standard grade metrics (can be overridden locally)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// GRADE METRICS (Updated January 2026)
// ═══════════════════════════════════════════════════════════════════════════
// NOTE: GlobalPrep uses custom GRADE_METRICS that differs from SHARED_GRADE_METRICS
// Specifically, G3 currentYear denominator is 120 instead of 107 (all non-review lessons)
// This is an intentional school-specific configuration.
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
    currentYear: { lessons: ALL_NON_REVIEW_LESSONS, denominator: 120 }
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
// CONFIG HELPER
// ═══════════════════════════════════════════════════════════════════════════

function getGlobalPrepConfig() {
  return {
    SHEET_NAMES_V2: SHEET_NAMES_V2,
    SHEET_NAMES_PREK: SHEET_NAMES_PREK,
    LAYOUT: LAYOUT,
    PREK_CONFIG: PREK_CONFIG,
    GRADE_METRICS: GRADE_METRICS
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

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
 * Calculates percentage of lessons passed ('Y') out of attempted ('Y' or 'N')
 * FIXED: Removed 'A' (Absent) from the denominator so absence doesn't lower the score.
 */
function calculatePercentage(mapRow, lessonIndices) {
  let passed = 0;
  let attempted = 0;
  
  lessonIndices.forEach(lessonNum => {
    // Convert Lesson # to Array Index
    const idx = LAYOUT.LESSON_COLUMN_OFFSET + lessonNum - 1;
    
    if (idx < mapRow.length) {
      const status = mapRow[idx] ? mapRow[idx].toString().toUpperCase().trim() : "";
      
      if (status === 'Y') {
        passed++;
        attempted++;
      } else if (status === 'N') {
        attempted++; // Only count attempts if they were present to take it
      }
      // Ignored: 'A' (Absent) or "" (Blank)
    }
  });
  
  return attempted > 0 ? Math.round((passed / attempted) * 100) : "";
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
  setColumnHeaders(sheet, 5, ["Date", "Teacher", "Group Name", "Student Name", "Lesson Number", "Status"]);
  sheet.setColumnWidth(1, 100); sheet.setColumnWidth(2, 150); sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 200); sheet.setColumnWidth(5, 120); sheet.setColumnWidth(6, 80);
  sheet.setFrozenRows(5);
}

function createUFLIMapSheet(ss, wizardData) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES_V2.UFLI_MAP);
  const headerWidth = LAYOUT.COL_CURRENT_LESSON + LAYOUT.TOTAL_LESSONS;
  createMergedHeader(sheet, 1, "UFLI MAP - MASTER PROGRESS REPORT", headerWidth, {
    background: COLORS.TITLE_BG, fontColor: COLORS.TITLE_FG, fontWeight: "bold", fontSize: 14
  });
  createMergedHeader(sheet, 2, "Master tracking grid for all UFLI lessons by student", headerWidth, {
    fontFamily: "Calibri", fontSize: 10, fontStyle: "italic"
  });
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
  createMergedHeader(sheet, 1, "SKILLS TRACKER", headerWidth, {
    background: COLORS.TITLE_BG, fontColor: COLORS.TITLE_FG, fontWeight: "bold", fontSize: 14
  });
  createMergedHeader(sheet, 2, "Skill section mastery percentages by student", headerWidth, {
    fontFamily: "Calibri", fontSize: 10, fontStyle: "italic"
  });
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
  createMergedHeader(sheet, 1, "GRADE SUMMARY - BENCHMARK TRACKING", headerWidth, {
    background: COLORS.TITLE_BG, fontColor: COLORS.TITLE_FG, fontWeight: "bold", fontSize: 14
  });
  createMergedHeader(sheet, 2, "Student progress metrics and benchmark status", headerWidth, {
    fontFamily: "Calibri", fontSize: 10, fontStyle: "italic"
  });
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
    
    // Group Name Header
    createMergedHeader(sheet, currentRow, groupName, columnCount, {
      background: COLORS.HEADER_BG, fontColor: COLORS.HEADER_FG, fontWeight: "bold", fontSize: 12, horizontalAlignment: "center"
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
  createMergedHeader(dashboardSheet, 1, "PACING DASHBOARD", 11, {
    background: COLORS.TITLE_BG, fontColor: COLORS.TITLE_FG, fontWeight: "bold", fontSize: 14
  });
  createMergedHeader(dashboardSheet, 2, "Group pacing progress and performance metrics", 11, {
    fontFamily: "Calibri", fontSize: 10, fontStyle: "italic"
  });
  // Rows 3-4 are spacers
  setColumnHeaders(dashboardSheet, 5, ["Group", "Teacher", "Students", "Assigned Lessons", "Tracked Lessons", "Pacing %", "Highest Lesson", "Last Entry", "Avg Pass %", "Avg Not Passed %", "Absent Rate"]);
  dashboardSheet.setFrozenRows(5);
  
  // Log Sheet
  const logSheet = getOrCreateSheet(ss, SHEET_NAMES_PACING.LOG);
  createMergedHeader(logSheet, 1, "PACING LOG", 12, {
    background: COLORS.TITLE_BG, fontColor: COLORS.TITLE_FG, fontWeight: "bold", fontSize: 14
  });
  createMergedHeader(logSheet, 2, "Detailed lesson-by-lesson pacing data", 12, {
    fontFamily: "Calibri", fontSize: 10, fontStyle: "italic"
  });
  // Rows 3-4 are spacers
  setColumnHeaders(logSheet, 5, ["Group", "Teacher", "Lesson Slot", "UFLI Lesson", "Student Count", "Y Count", "N Count", "A Count", "Pass %", "Not Passed %", "Absent %", "Last Date"]);
  logSheet.setFrozenRows(5);
}

function updatePacingReports() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);
    const progressSheet = ss.getSheetByName(SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
    if (!mapSheet || !progressSheet) return;
    
    const lookups = buildStudentLookups();
    const progressMap = buildProgressHistory(progressSheet);
    const { dashboardRows, logRows } = scanGradeSheetsForPacing(ss, lookups, progressMap);
    
    writeDataToSheet(ss, SHEET_NAMES_PACING.DASHBOARD, dashboardRows, 6);
    writeDataToSheet(ss, SHEET_NAMES_PACING.LOG, logRows, 6);
    
    // --- SAFE FORMATTING (Granular per column) ---
    // If one column is "typed" (broken), others will still format.
    try {
      formatPacingSheet(ss, SHEET_NAMES_PACING.DASHBOARD, [6, 9, 10, 11], 0, 6);
      formatPacingSheet(ss, SHEET_NAMES_PACING.LOG, [9, 10, 11], 0, 6);
    } catch (formatError) {
      Logger.log(`Pacing format error (non-fatal): ${formatError.message}`);
    }
  } catch (e) {
    Logger.log(`updatePacingReports error: ${e.message}`);
  }
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
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // === READ STUDENT COUNTS FROM GROUP CONFIGURATION ===
    const groupConfigSheet = ss.getSheetByName(SHEET_NAMES.GROUP_CONFIG);
    
    if (groupConfigSheet) {
      const lastRow = groupConfigSheet.getLastRow();
      const GROUP_DATA_START = 8;
      
      if (lastRow >= GROUP_DATA_START) {
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
        const summaryData = summarySheet.getRange(LAYOUT.DATA_START_ROW, 1, lastRow - LAYOUT.DATA_START_ROW + 1, 4).getValues();
        
        summaryData.forEach(row => {
          const teacher = row[2] ? row[2].toString().trim() : "";
          const groupName = row[3] ? row[3].toString().trim() : "";
          
          if (groupName && teacher) {
            teacherByGroup.set(groupName, teacher);
          }
        });
      }
    }
  } catch (e) {
    Logger.log(`buildStudentLookups error: ${e.message}`);
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

   return [
     group,                                                  // Col 1: Group
     teacher,                                                // Col 2: Teacher
     count,                                                  // Col 3: Students
     dash.assigned,                                          // Col 4: Assigned Lessons
     dash.tracked,                                           // Col 5: Tracked Lessons
     dash.assigned > 0 ? dash.tracked / dash.assigned : 0,   // Col 6: Pacing % (decimal)
     dash.highestLessonName,                                 // Col 7: Highest Lesson
     dash.lastEntry,                                         // Col 8: Last Entry
     passRate,                                               // Col 9: Avg Pass % (decimal)
     notPassedRate,                                          // Col 10: Avg Not Passed % (decimal)
     absentRate                                              // Col 11: Absent Rate (decimal)
   ];
 }


function writeDataToSheet(ss, sheetName, data, startRow) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow >= startRow) sheet.getRange(startRow, 1, lastRow - startRow + 1, sheet.getLastColumn()).clearContent();
  if (data && data.length > 0) sheet.getRange(startRow, 1, data.length, data[0].length).setValues(data);
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW FUNCTION: Safe Column Formatting
// Iterates column by column to avoid crashing if one column is typed
// ═══════════════════════════════════════════════════════════════════════════
function formatPacingSheet(ss, sheetName, percentCols, absCol, dataStartRow = 6) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < dataStartRow) return;
  const numRows = sheet.getLastRow() - dataStartRow + 1;
  
  // Format percentage columns one by one
  percentCols.forEach(col => {
    try {
      sheet.getRange(dataStartRow, col, numRows).setNumberFormat("0%");
    } catch (e) {
      Logger.log(`Skipping format for ${sheetName} col ${col}: Likely Typed Column`);
    }
  });

  // Format absolute column (if any)
  if (absCol > 0) {
    try {
      sheet.getRange(dataStartRow, absCol, numRows).setNumberFormat("0");
    } catch (e) {
      Logger.log(`Skipping format for ${sheetName} col ${absCol}: Likely Typed Column`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC & UPDATE FUNCTIONS (OPTIMIZED)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Optimized Sync: Reads all data, updates in memory, calculates current lesson, writes all back.
 * UPDATED: Now handles non-UFLI lessons (Comprehension, etc.) for Group Sheet updates
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
  
  // Group Sheets - load all into memory
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
      updateGroupArrayByLessonName(groupSheetsData, groupName, studentName, lessonNameStr, status);
    }
    
    // C. Track Current Lesson (only for UFLI lessons)
    if (lessonNum) {
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
    }
  });
  
  // 4. APPLY CURRENT LESSON TO MAP ARRAY
  Object.keys(studentCurrentLesson).forEach(name => {
    const mapRowIdx = studentMapRowLookup[name];
    if (mapRowIdx !== undefined) {
      const lessonNum = studentCurrentLesson[name].maxLesson;
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
  updateAllStats(ss, mapData, getGlobalPrepConfig());
  
  log(functionName, 'Sync Complete.');
}

/**
 * Updates Group Sheet by matching EXACT lesson name (not just lesson number)
 * This handles "Comprehension", "Fluency", and any other non-UFLI lessons
 * * Expected Group Sheet Structure:
 * Row 1-2: Empty spacers
 * Row 3: Instructional Sequence + Dates (manually populated)
 * Row 4+: Group blocks, each with structure:
 * - Group Header (e.g., "G3 Group 1 Galdamez")
 * - Column Headers ("Student Name", "Lesson 1", "Lesson 2", ...)
 * - Lesson Names sub-header (e.g., "", "UFLI L101", "UFLI L102", ...)
 * - Student data rows
 * - Empty spacer row before next group
 * * @param {Object} groupSheetsData - Cache of all group sheet data
 * @param {string} groupName - Name of the group (e.g., "G3 Group 1 Tutoring Galdamez")
 * @param {string} studentName - Student name
 * @param {string} lessonName - Full lesson name (e.g., "Comprehension", "UFLI L101")
 * @param {string} status - Y, N, or A
 */
function updateGroupArrayByLessonName(groupSheetsData, groupName, studentName, lessonName, status) {
  // Extract grade from group name to find the right sheet
  const gradeMatch = groupName.match(/^([A-Za-z0-9]+)/);
  if (!gradeMatch) return;
  
  const sheetName = gradeMatch[1] + " Groups";
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

function updateStatsForNewStudents() {
  const functionName = 'updateStatsForNewStudents';
  log(functionName, 'Updating stats for new students...');
  syncSmallGroupProgress(); // Sync will handle everything
  log(functionName, 'Update complete.');
}

function updateAllProgress() {
  syncSmallGroupProgress();
  
  try {
    updatePacingReports();
  } catch (e) {
    Logger.log(`Pacing reports error (continuing): ${e.message}`);
  }
  
  SpreadsheetApp.getUi().alert('Update Complete', 'All progress data synced and statistics recalculated.', SpreadsheetApp.getUi().ButtonSet.OK);
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHOOL SUMMARY DASHBOARD ENGINE (v2 - Polished UI)
// ═══════════════════════════════════════════════════════════════════════════

// Dashboard Color Palette
const DASHBOARD_COLORS = {
  HEADER_BG: "#1a73e8",         // Google Blue - main header
  HEADER_TEXT: "#ffffff",
  GRADE_HEADER_BG: "#4285f4",   // Lighter blue for grade headers
  GRADE_HEADER_TEXT: "#ffffff",
  SECTION_LABEL: "#5f6368",     // Gray for section labels
  TABLE_HEADER_BG: "#e8eaed",   // Light gray for table headers
  TABLE_ALT_ROW: "#f8f9fa",     // Subtle alternating rows
  CARD_BORDER: "#dadce0",       // Card border color
  
  // Status colors
  ON_TRACK: "#34a853",          // Green
  ON_TRACK_BG: "#e6f4ea",
  PROGRESSING: "#fbbc04",       // Yellow/Amber
  PROGRESSING_BG: "#fef7e0",
  AT_RISK: "#ea4335",           // Red
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
  // Data starts on row 6 (index 5), so slice(5) skips rows 1-5 (headers)
  const pacingData = pacingSheet ? pacingSheet.getDataRange().getValues().slice(5) : [];
  
  // Get Initial Assessment data for growth calculations
  const initialData = getSheetDataAsMap(ss, SHEET_NAMES_V2.INITIAL_ASSESSMENT);
  
  const configSheetName = (typeof SHEET_NAMES !== 'undefined' && SHEET_NAMES.CONFIG) 
    ? SHEET_NAMES.CONFIG : "Site Configuration";
  const configSheet = ss.getSheetByName(configSheetName);
  const schoolName = configSheet && configSheet.getLastRow() > 1 
    ? configSheet.getRange(2, 2).getValue() : "UFLI Site";
  
  // 2. INITIAL SETUP
  summarySheet.clear();
  summarySheet.clearConditionalFormatRules();
  
  // Set column widths for clean layout - WIDER for full group names
  summarySheet.setColumnWidth(1, 280);  // Labels/Group names
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

    currentRow = renderGradeCard(summarySheet, currentRow, grade, gradeStudents, gradeGroups, initialData);
  });

  // 5. FINAL TOUCHES
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
  
  // Row 3: Dashboard description
  const description = "Growth & Pacing Metrics: Initial average, current average, growth percentage, and instructional pacing rate  •  " +
    "Student Distribution: Visual breakdown of students On Track (80%+), Progressing (50-79%), and Needs Support (<50%)  •  " +
    "Group Performance Table: Pass rate and Absenteeism rate for each instructional group with status indicators";
  
  sheet.getRange(3, 1, 1, 5).merge()
    .setValue(description)
    .setFontSize(9)
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL)
    .setFontStyle("italic")
    .setFontFamily("Calibri")
    .setVerticalAlignment("middle")
    .setWrap(true);
  sheet.setRowHeight(3, 45);  // Taller row to accommodate wrapped text
  
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

function renderGradeCard(sheet, startRow, grade, students, groups, initialData) {
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

  // --- METRICS ROW (Now includes both Foundational AND Min Grade) ---
  const growth = calculateGrowthMetrics(students, initialData, grade);
  const bands = calculateDistributionBands(students);
  const pace = calculateGradePacing(groups);
  
  row = renderMetricsRow(sheet, row, growth, bands, pace, students.length);
  
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
  
  // === HEADER ROW ===
  sheet.getRange(row, 1, 1, 5).setValues([["Metric", "Initial", "Current", "Growth", "Pacing"]])
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
    (growth.foundGrowth >= 0 ? "+" : "") + growth.foundGrowth + "%",
    pace.pacing / 100
  ];
  
  sheet.getRange(row, 1, 1, 5).setValues([foundValues])
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setFontSize(10);
  
  sheet.getRange(row, 1).setHorizontalAlignment("left").setFontWeight("bold");
  
  // --- FIX: Safe Formatting ---
  try {
    sheet.getRange(row, 2).setNumberFormat("0%");
  } catch(e) {}
  try {
    sheet.getRange(row, 3).setNumberFormat("0%");
  } catch(e) {}
  try {
    sheet.getRange(row, 5).setNumberFormat("0%");
  } catch(e) {} // Ignore formatting errors

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
    (growth.minGrowth >= 0 ? "+" : "") + growth.minGrowth + "%",
    ""  // Pacing only shown once
  ];
  
  sheet.getRange(row, 1, 1, 5).setValues([minValues])
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setFontSize(10)
    .setBackground(DASHBOARD_COLORS.TABLE_ALT_ROW);
  
  sheet.getRange(row, 1).setHorizontalAlignment("left").setFontWeight("bold");
  
  try {
    sheet.getRange(row, 2).setNumberFormat("0%");
  } catch(e) {}
  try {
    sheet.getRange(row, 3).setNumberFormat("0%");
  } catch(e) {}

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
    (growth.fullGrowth >= 0 ? "+" : "") + growth.fullGrowth + "%",
    ""  // Pacing only shown once
  ];
  
  sheet.getRange(row, 1, 1, 5).setValues([fullValues])
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setFontSize(10);
  
  sheet.getRange(row, 1).setHorizontalAlignment("left").setFontWeight("bold");
  
  try {
    sheet.getRange(row, 2).setNumberFormat("0%");
  } catch(e) {}
  try {
    sheet.getRange(row, 3).setNumberFormat("0%");
  } catch(e) {}

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
  
  // Render each band with student names for hover notes
  row = renderProgressBar(sheet, row, "On Track (80%+)", bands.onTrack, totalStudents, 
    DASHBOARD_COLORS.ON_TRACK, DASHBOARD_COLORS.ON_TRACK_BG, bands.onTrackNames);
  row = renderProgressBar(sheet, row, "Progressing (50-79%)", bands.progressing, totalStudents, 
    DASHBOARD_COLORS.PROGRESSING, DASHBOARD_COLORS.PROGRESSING_BG, bands.progressingNames);
  row = renderProgressBar(sheet, row, "Needs Support (<50%)", bands.atRisk, totalStudents, 
    DASHBOARD_COLORS.AT_RISK, DASHBOARD_COLORS.AT_RISK_BG, bands.atRiskNames);
  
  // Spacer
  sheet.setRowHeight(row, 12);
  row++;
  
  return row;
}

function renderProgressBar(sheet, row, label, count, total, accentColor, bgColor, studentNames) {
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
  
  // Add hover note with student names
  if (studentNames && studentNames.length > 0) {
    const noteText = studentNames.join("\n");
    barRange.setNote(noteText);
  } else {
    barRange.clearNote();
  }
  
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
        // Use the global helper 'calculateBenchmarkFromRow', NOT 'ss'
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
    
    // Legacy compatibility (prevents errors in older render functions)
    initialAvg: foundInitialAvg,
    currentAvg: foundCurrentAvg,
    growth: foundCurrentAvg - foundInitialAvg
  };
}

/**
 * Helper: Calculate benchmark percentage from a data row
 * Used for Initial Assessment calculations
 */
function calculateBenchmarkFromRow(row, lessonIndices, denominator) {
  if (!row || denominator === 0) return 0;
  let passed = 0;
  
  lessonIndices.forEach(lessonNum => {
    const idx = LAYOUT.LESSON_COLUMN_OFFSET + lessonNum - 1;
    if (idx < row.length) {
      const status = row[idx] ? row[idx].toString().toUpperCase().trim() : "";
      if (status === 'Y') passed++;
    }
  });
  
  return Math.round((passed / denominator) * 100);
}

function calculateDistributionBands(students) {
  const bands = { 
    onTrack: 0, 
    progressing: 0, 
    atRisk: 0,
    onTrackNames: [],
    progressingNames: [],
    atRiskNames: []
  };
  
  students.forEach(s => {
    const name = s[0] ? s[0].toString() : "";
    const score = parseFloat(s[5]) || 0;  // s[5] = Min Grade Skills %
    
    if (score >= 80) {
      bands.onTrack++;
      bands.onTrackNames.push(name);
    } else if (score >= 50) {
      bands.progressing++;
      bands.progressingNames.push(name);
    } else {
      bands.atRisk++;
      bands.atRiskNames.push(name);
    }
  });
  
  // Sort names alphabetically
  bands.onTrackNames.sort();
  bands.progressingNames.sort();
  bands.atRiskNames.sort();
  
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

// ═══════════════════════════════════════════════════════════════════════════
// FIX #3: Update renderGroupTable() in School Summary to read correctly
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
    // Read values from Pacing Dashboard
    const passRate = parseFloat(g[8]) || 0;
    const absentRate = parseFloat(g[10]) || 0;
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
    
    const groupName = g[0].toString();
    return [groupName, studentCount, passRate, absentRate, status];
  });
  
  // Write table data
  if (tableData.length > 0) {
    sheet.getRange(row, 1, tableData.length, 5).setValues(tableData)
      .setFontSize(10)
      .setVerticalAlignment("middle");
    
    // --- FIX: Granular formatting ---
    // Try to format columns one by one
    const passRateCol = 3;
    const absentRateCol = 4;
    try {
      sheet.getRange(row, passRateCol, tableData.length).setNumberFormat("0%");
    } catch(e) {}
    
    try {
      sheet.getRange(row, absentRateCol, tableData.length).setNumberFormat("0%");
    } catch(e) {}
    
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
      .setFontStyle("italic")
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
  updateAllStats(ss, null, getGlobalPrepConfig());
  SpreadsheetApp.getUi().alert('Skills Tracker values recalculated.');
}

function repairGradeSummaryFormulas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  updateAllStats(ss, null, getGlobalPrepConfig());
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
                  sheetStartRow,       // First student row (1-indexed)
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
