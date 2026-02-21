// ═══════════════════════════════════════════════════════════════════════════
// UFLI MASTER SYSTEM - PROGRESS TRACKING MODULE (UNIFIED)
// Sheet Generation, Progress Tracking, Sync, and Pacing Engine
// ═══════════════════════════════════════════════════════════════════════════
// Version: 6.0 - PHASE 7D UNIFIED
// Created: February 2026
// Phase 7 Consolidation: Phase2_ProgressTracking module
//
// LINEAGE:
// This file consolidates:
// - AdelantePhase2_ProgressTracking.gs (v5.2, 2792 lines - most comprehensive)
// - AllegiantPhase2_ProgressTracking.gs (v5.1, 1995 lines)
// - SankofaPhase2_ProgressTracking.gs (v5.2, 2503 lines)
// - GlobalPrepPhase2_ProgressTracking.gs (v5.5, 1953 lines - bulletproof formatting)
// - CCAPhase2_ProgressTracking.gs (v5.1, 1672 lines)
// - CHAWPhase2_ProgressTracking.gs (v5.2, 2397 lines)
// See: PHASE7_AUDIT_REPORT.md § 1.1 and § 3.1
//
// CHANGES FROM v5.x:
// - Unified 6 school-specific versions into single parameterized module
// - Removed school-specific branding functions (see extension files below)
// - Removed school-specific config functions (getXXXConfig moved to extension files)
// - Adopted GlobalPrep's v5.5 bulletproof formatting for granular column formatting
// - Adopted CCA's mapSheet parameter support in buildStudentLookups()
// - Standardized function signatures with optional parameters
// - Added feature flag guards for advanced functions
// - All 45+ shared functions now in one file
//
// PURPOSE:
// This module provides core progress tracking functionality for the UFLI Master System:
// - System sheet generation (UFLI MAP, Skills, Grade Summary, etc.)
// - Progress syncing from Small Group Progress log to master sheets
// - Pacing report generation and dashboard updates
// - School summary dashboard with grade cards
// - Repair and maintenance utilities
//
// FEATURE FLAGS (from SiteConfig_TEMPLATE.gs):
// - features.diagnosticTools: Test functions for sheet structure validation (default: OFF)
// - features.lessonArrayTracking: Group sheet array tracking by lesson name (default: ON)
// - features.dynamicStudentRoster: Dynamic student addition to sheets (default: OFF)
// - features.studentNormalization: Field normalization for student objects (default: ON)
//
// SCHOOL-SPECIFIC EXTENSIONS:
// @see AdelanteBrandingExtensions.gs - Logo insertion, color customization, branding cache
//      Functions: loadSchoolBranding(), insertSheetLogo(), applySheetBranding_Adelante(), 
//                 lightenColor(), clearBrandingCache(), normalizeStudent_Adelante()
// @see CHAWBrandingExtensions.gs - Logo insertion, color customization, branding cache
//      Functions: loadSchoolBranding(), insertSheetLogo(), applySheetBranding_CHAW(),
//                 lightenColor(), clearBrandingCache(), getCHAWConfig(), createHeader_CHAW()
// @see SankofaStatsExtensions.gs - Custom statistics calculation
//      Functions: updateAllStats_Sankofa(), goToSchoolSummary_Sankofa()
// @see CCASkillsExtensions.gs - Skill analytics and averaging
//      Feature flag: skillAveragesAnalytics
//      Functions: calculateSkillAverages(), renderSkillAveragesRow(), buildStudentLookups_CCA()
//
// DEPENDENCIES:
// - SharedEngine.gs: Core calculation functions (imported from Phase 5)
// - SharedConstants.gs: LESSON_LABELS, SKILL_SECTIONS, REVIEW_LESSONS, etc.
// - SiteConfig_TEMPLATE.gs: Feature flags and configuration
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

// ═══════════════════════════════════════════════════════════════════════════
// CENTRALIZED SHEET COLUMN LAYOUTS (0-based indices for getValues() arrays)
// All sheet-reading code should reference these instead of magic numbers.
// Adopted from Sankofa's enhanced column layout system.
// ═══════════════════════════════════════════════════════════════════════════

var COLS = {
  // Small Group Progress: the raw lesson log
  SMALL_GROUP_PROGRESS: {
    DATE: 0,           // Column A - Timestamp
    TEACHER: 1,        // Column B - Teacher name
    GROUP: 2,          // Column C - Teaching group name
    STUDENT: 3,        // Column D - Student name
    LESSON: 4,         // Column E - Lesson name
    STATUS: 5,         // Column F - Status (Y/N/A)
    SOURCE_GROUP: 6    // Column G - Source group (co-teaching only)
  },

  // UFLI MAP: comprehensive lesson tracking grid (master sheet)
  UFLI_MAP: {
    STUDENT_NAME: 0,   // Column A
    GRADE: 1,          // Column B
    TEACHER: 2,        // Column C
    GROUP: 3,          // Column D
    CURRENT_LESSON: 4, // Column E
    FIRST_LESSON: 5    // Column F - Start of 128 lesson columns
  },

  // Skills Tracker: section-level mastery percentages
  SKILLS: {
    STUDENT_NAME: 0,   // Column A
    GRADE: 1,          // Column B
    TEACHER: 2,        // Column C
    GROUP: 3,          // Column D
    FIRST_SKILL: 4     // Column E - Start of skill section columns
  },

  // Grade Summary: benchmark tracking and growth metrics
  GRADE_SUMMARY: {
    STUDENT_NAME: 0,         // Column A
    GRADE: 1,                // Column B
    TEACHER: 2,              // Column C
    GROUP: 3,                // Column D
    FOUNDATIONAL_PCT: 4,     // Column E - Foundational Skills %
    MIN_GRADE_PCT: 5,        // Column F - Min Grade Skills %
    FULL_GRADE_PCT: 6,       // Column G - Full Grade Skills %
    BENCHMARK_STATUS: 7,     // Column H - Benchmark Status
    FIRST_SKILL_INITIAL: 8   // Column I - Start of skill section details
  }
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
// - SHARED_GRADE_METRICS: Grade-level lesson benchmarks
// ═══════════════════════════════════════════════════════════════════════════

// Alias SHARED_GRADE_METRICS for backward compatibility with school-specific code
// that references GRADE_METRICS directly (e.g., calculateGrowthMetrics)
var GRADE_METRICS = typeof SHARED_GRADE_METRICS !== 'undefined' ? SHARED_GRADE_METRICS : {};

// ═══════════════════════════════════════════════════════════════════════════
// SHARED ENGINE - Core calculation functions imported from SharedEngine.gs
// ═══════════════════════════════════════════════════════════════════════════
// SharedEngine.gs provides:
// - getLessonStatus(mapRow, lessonNum, layout): Get lesson status from UFLI MAP row
// - calculateSectionPercentage(mapRow, sectionLessons, isInitialAssessment, layout): 
//   Calculate skill section percentage with weighted review logic
// - extractLessonNumber(lessonText): Extract numeric lesson ID from lesson text
// - getOrCreateSheet(ss, sheetName, clearIfExists): Get or create sheet helper
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTING & DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a non-merged header row with consistent formatting
 * @param {Sheet} sheet - The sheet to add header to
 * @param {number} row - Row number for the header
 * @param {string} text - Header text
 * @param {number} width - Number of columns to span (background only, no merge)
 * @param {Object} options - Formatting options (background, fontColor, fontWeight, fontSize, fontFamily, fontStyle, horizontalAlignment)
 */
function createHeader(sheet, row, text, width, options = {}) {
  // Set background across the full width (no merge)
  const fullRange = sheet.getRange(row, 1, 1, width);
  if (options.background) fullRange.setBackground(options.background);

  // Set text in first column
  const textRange = sheet.getRange(row, 1);
  textRange.setValue(text);

  // Apply font styling to the text cell
  textRange.setFontFamily(options.fontFamily || "Calibri");
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
 * Applies conditional formatting for lesson status cells (Y/N/A)
 * @param {Sheet} sheet - Target sheet
 * @param {number} startRow - First row to format
 * @param {number} startCol - First column to format
 * @param {number} numRows - Number of rows to format
 * @param {number} numCols - Number of columns to format
 */
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

/**
 * Sets up basic sheet formatting with title and subtitle headers
 * Unified implementation without school-specific branding
 * @see AdelanteBrandingExtensions.gs - For logo insertion and custom branding
 * @see CHAWBrandingExtensions.gs - For logo insertion and custom branding
 * 
 * @param {Sheet} sheet - The sheet to format
 * @param {string} title - Main title text
 * @param {string} subtitle - Subtitle/description text
 * @param {number} width - Number of columns
 */
function applySheetBranding(sheet, title, subtitle, width) {
  // Row 1: Title header
  createHeader(sheet, 1, title, width, {
    background: COLORS.TITLE_BG,
    fontColor: COLORS.TITLE_FG,
    fontWeight: "bold",
    fontSize: 14
  });

  // Row 2: Subtitle
  createHeader(sheet, 2, subtitle, width, {
    fontFamily: "Calibri",
    fontSize: 10,
    fontStyle: "italic"
  });

  // Apply Calibri font to entire sheet (affects new data)
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
    .setFontFamily("Calibri");
}

/**
 * Normalizes student object fields (feature-flagged)
 * @feature studentNormalization - Auto-enabled, placed in extension file for school customization
 * @see AdelanteBrandingExtensions.gs - normalizeStudent() with custom field mapping
 * 
 * @param {Object} student - Student object
 * @returns {Object} Student with normalized fields
 */
function normalizeStudent(student) {
  if (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.features && SITE_CONFIG.features.studentNormalization === false) {
    return student;
  }
  return {
    name: (student && student.name) ? student.name.toString().trim() : "",
    grade: (student && student.grade) ? student.grade.toString().trim() : "",
    teacher: (student && student.teacher) ? student.teacher.toString().trim() : "",
    group: (student && student.group) ? student.group.toString().trim() : ""
  };
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
    const status = getLessonStatus(mapRow, lessonNum, LAYOUT);
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
 * Builds student count and teacher lookup maps from UFLI MAP or config sheets
 * Unified signature supporting optional mapSheet parameter (CCA approach)
 * 
 * @param {Sheet} mapSheet - Optional UFLI MAP sheet (if not provided, will fetch from active spreadsheet)
 * @returns {Object} { studentCountByGroup: Map, teacherByGroup: Map }
 * @see CCASkillsExtensions.gs - CCA maintains a custom override with identical functionality for historical compatibility
 */
function buildStudentLookups(mapSheet = null) {
  const studentCountByGroup = new Map();
  const teacherByGroup = new Map();
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // If mapSheet provided, use it directly (CCA approach)
  if (mapSheet) {
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
  
  // Original approach: read from Group Configuration and Grade Summary
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
// PACING DASHBOARD HELPERS
// Absent Rate stored as decimal; all rates use total responses (Y+N+A) as denominator
// ═══════════════════════════════════════════════════════════════════════════

function buildDashboardRow(group, teacher, count, dash) {
  const MINUTES_PER_LESSON = 60;
  
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
    expectedTime,                                           // Col 9: Expected Time (min)
    actualTime,                                             // Col 10: Actual Time (min)
    passRate,                                               // Col 11: Avg Pass % (decimal)
    notPassedRate,                                          // Col 12: Avg Not Passed % (decimal)
    absentRate                                              // Col 13: Absent % (decimal)
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// renderGroupTable() - 7-column simplified layout
//
// Pacing Dashboard Array Indices:
//   [0]=Group, [1]=Teacher, [2]=Students, [3]=Assigned, [4]=Tracked,
//   [5]=Pacing%, [6]=HighestLesson, [7]=LastEntry, [8]=ExpectedTime,
//   [9]=ActualTime, [10]=AvgPass%, [11]=AvgNotPassed%, [12]=AbsentRate
// ═══════════════════════════════════════════════════════════════════════════

function renderGroupTable(sheet, row, groups) {
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
// DATA WRITING & FORMATTING UTILITIES
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
// SYNC ENGINE - SMALL GROUP PROGRESS → MASTER SHEETS
// ═══════════════════════════════════════════════════════════════════════════

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
  // Use generic config object - school-specific configs should be in extension files
  const config = {
    SHEET_NAMES_V2,
    SHEET_NAMES_PREK,
    LAYOUT,
    PREK_CONFIG,
    GRADE_METRICS: typeof SHARED_GRADE_METRICS !== 'undefined' ? SHARED_GRADE_METRICS : {}
  };
  updateAllStats(ss, mapData, config);
  
  log(functionName, 'Sync Complete.');
}

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
// STATS UPDATE WRAPPER (Uses SharedEngine.gs)
// ═══════════════════════════════════════════════════════════════════════════

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
// SCHOOL SUMMARY DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

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

  // Row 3: Dashboard description (MERGED - intentional for multi-column spanning text)
  // Note: Merge used here for descriptive text that naturally spans the dashboard width
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

/**
 * Renders a grade-level summary card on the dashboard
 * Standardized signature with optional overrideCount parameter
 * 
 * @param {Sheet} sheet - Target sheet
 * @param {number} startRow - Starting row for the card
 * @param {string} grade - Grade level (e.g., "KG", "G1")
 * @param {Array} students - Array of student data
 * @param {Array} groups - Array of group data
 * @param {Map} initialData - Initial assessment data map
 * @param {number} overrideCount - Optional student count override (default: null, uses students.length)
 * @returns {number} Next available row after the card
 */
function renderGradeCard(sheet, startRow, grade, students, groups, initialData, overrideCount = null) {
  let row = startRow;
  
  // Use overrideCount if provided, otherwise use students.length
  const displayCount = overrideCount !== null ? overrideCount : students.length;

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
  
  // Columns 2-4: Progress bar (MERGED - required for visual progress bar effect)
  // Note: Merge intentional here for graphical progress bar representation
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
// CALCULATION & ANALYSIS HELPERS
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
    if (getLessonStatus(row, lessonNum, LAYOUT) === 'Y') passed++;
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

// getSheetDataAsMap — canonical implementation is in SetupWizard.gs (shared via GAS flat namespace)
// getExistingGrades — canonical implementation is in SetupWizard.gs (shared via GAS flat namespace)

// ═══════════════════════════════════════════════════════════════════════════
// MAINTENANCE & REPAIR UTILITIES
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
  const config = {
    SHEET_NAMES_V2,
    SHEET_NAMES_PREK,
    LAYOUT,
    PREK_CONFIG,
    GRADE_METRICS: typeof SHARED_GRADE_METRICS !== 'undefined' ? SHARED_GRADE_METRICS : {}
  };
  updateAllStats(ss, null, config);
  SpreadsheetApp.getUi().alert('Skills Tracker values recalculated.');
}

function repairGradeSummaryFormulas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = {
    SHEET_NAMES_V2,
    SHEET_NAMES_PREK,
    LAYOUT,
    PREK_CONFIG,
    GRADE_METRICS: typeof SHARED_GRADE_METRICS !== 'undefined' ? SHARED_GRADE_METRICS : {}
  };
  updateAllStats(ss, null, config);
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
 * Adds skill formulas for a new student row (placeholder for formula-based approach)
 * Most schools now use script-based calculations; this is a legacy compatibility function.
 * @param {Sheet} sheet - Skills Tracker sheet
 * @param {number} row - Row number to add formulas to
 */
function addSkillFormulasForRow(sheet, row) {
  // Placeholder - data filled on next sync by updateAllProgress()
  // Legacy function kept for compatibility with older school implementations
}

/**
 * Adds grade summary formulas for a new student row (placeholder for formula-based approach)
 * Most schools now use script-based calculations; this is a legacy compatibility function.
 * @param {Sheet} sheet - Grade Summary sheet
 * @param {number} row - Row number to add formulas to
 * @param {Object} studentObj - Student data object
 */
function addGradeSummaryFormulasForRow(sheet, row, studentObj) {
  // Placeholder - data filled on next sync by updateAllProgress()
  // Legacy function kept for compatibility with older school implementations
}

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE-FLAGGED FUNCTIONS
// These functions are enabled/disabled via SITE_CONFIG feature flags
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tests group sheet structure for debugging (diagnostic tool)
 * @feature diagnosticTools - Enable with features.diagnosticTools = true
 */
function testGroupSheetStructure() {
  if (typeof SITE_CONFIG === 'undefined' || !SITE_CONFIG.features || !SITE_CONFIG.features.diagnosticTools) {
    throw new Error('Diagnostic tools are disabled. Enable with features.diagnosticTools = true');
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gradeSheetRegex = /^(PreK|KG|G[1-8]) Groups$/;
  const gradeSheets = ss.getSheets().filter(sheet => gradeSheetRegex.test(sheet.getName()));
  
  Logger.log(`Testing ${gradeSheets.length} grade sheets...`);
  gradeSheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    Logger.log(`\n${sheet.getName()}:`);
    Logger.log(`  Total rows: ${data.length}`);
    Logger.log(`  Row 3 (Instructional Sequence): ${data[2] ? data[2][0] : 'MISSING'}`);
  });
}

// addStudentToSheet — canonical implementation is in SetupWizard.gs (shared via GAS flat namespace)
// updateStudentInSheet — canonical implementation is in SetupWizard.gs (shared via GAS flat namespace)


// ═══════════════════════════════════════════════════════════════════════════
// DEBUGGING & DIAGNOSTIC UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

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
