// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED PHASE 2 PROGRESS TRACKING - PARAMETERIZED FOR ALL SCHOOLS
// ═══════════════════════════════════════════════════════════════════════════
// Version: 7.0 - PHASE 7 LOGIC LAYER UNIFICATION
// Last Updated: February 2026
//
// PURPOSE:
// This module replaces ALL per-school Phase2_ProgressTracking.gs files with a
// single, parameterized implementation. All school-specific constants (LAYOUT,
// SHEET_NAMES_V2, PREK_CONFIG, COLORS, GRADE_METRICS) are resolved at runtime
// from SITE_CONFIG via UnifiedConfig.gs — no school-specific copies needed.
//
// REPLACES:
// - AdelantePhase2_ProgressTracking.gs
// - SankofaPhase2_ProgressTracking.gs
// - GlobalPrepPhase2_ProgressTracking.gs
// - CHAWPhase2_ProgressTracking.gs
// - CCAPhase2_ProgressTracking.gs
// - AllegiantPhase2_ProgressTracking.gs
//
// DEPENDENCIES:
// - UnifiedConfig.gs: getUnifiedConfig() for all runtime constants
// - SharedConstants.gs: LESSON_LABELS, SKILL_SECTIONS, REVIEW_LESSONS, etc.
// - SharedEngine.gs: calculateBenchmark, calculateSectionPercentage,
//   updateAllStats, calculatePreKScores, and all utility functions
// - SiteConfig_TEMPLATE.gs: SITE_CONFIG object with feature flags and layout
// - ModuleLoader.gs: buildFeatureMenu() for dynamic menu items
//
// MIGRATION:
// Schools migrating from per-school Phase2 files should:
// 1. Configure SITE_CONFIG with their school's layout settings
// 2. Include UnifiedConfig.gs + UnifiedPhase2_ProgressTracking.gs
// 3. Remove the old [School]Phase2_ProgressTracking.gs file
// 4. Verify all sheets generate correctly via the SetUp Wizard
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM SHEET GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generates all system sheets based on the unified configuration.
 * Called by the SetUpWizard after configuration is saved.
 *
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} wizardData - Wizard configuration data
 * @returns {Object} Result object {success: boolean, error: string}
 */
function generateSystemSheets(ss, wizardData) {
  const config = getUnifiedConfig();

  try {
    // Generate UFLI MAP sheet
    generateUFLIMapSheet(ss, config, wizardData);

    // Generate grade-level group sheets
    generateGroupSheets(ss, config, wizardData);

    // Generate Skills Tracker sheet
    generateSkillsTrackerSheet(ss, config);

    // Generate Grade Summary sheet
    generateGradeSummarySheet(ss, config);

    // Generate Initial Assessment sheet
    generateInitialAssessmentSheet(ss, config);

    // Generate School Summary sheet
    generateSchoolSummarySheet(ss, config);

    // Generate Pre-K Data sheet if Pre-K is in grades served
    if (wizardData.gradesServed && wizardData.gradesServed.includes('PreK')) {
      generatePreKDataSheet(ss, config);
    }

    // Generate Pacing sheets if pacing feature is enabled
    if (typeof isFeatureEnabled === 'function' && isFeatureEnabled('pacingSheets')) {
      generatePacingSheets(ss, config);
    }

    // Initialize feature modules (creates module-specific sheets)
    if (typeof initializeFeatureModules === 'function') {
      initializeFeatureModules();
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Generates the UFLI MAP sheet with lesson columns and student rows
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} config - Unified configuration
 * @param {Object} wizardData - Wizard configuration data
 */
function generateUFLIMapSheet(ss, config, wizardData) {
  const sheet = getOrCreateSheet(ss, config.SHEET_NAMES_V2.UFLI_MAP);
  const LAYOUT = config.LAYOUT;

  // Build header rows
  const headerRow = ['Student Name', 'Grade', 'Teacher', 'Group', 'Current Lesson'];
  for (let i = 1; i <= LAYOUT.TOTAL_LESSONS; i++) {
    headerRow.push(LESSON_LABELS[i] || ('L' + i));
  }

  // Write headers
  sheet.getRange(LAYOUT.HEADER_ROW_COUNT, 1, 1, headerRow.length).setValues([headerRow]);
  sheet.getRange(LAYOUT.HEADER_ROW_COUNT, 1, 1, headerRow.length)
    .setBackground(config.COLORS.HEADER_BG)
    .setFontColor(config.COLORS.HEADER_FG)
    .setFontWeight('bold');

  // Title row
  sheet.getRange(1, 1).setValue(config.schoolName + ' — UFLI MAP');
  sheet.getRange(1, 1).setFontSize(14).setFontWeight('bold')
    .setBackground(config.COLORS.TITLE_BG).setFontColor(config.COLORS.TITLE_FG);

  // Freeze header rows and metadata columns
  sheet.setFrozenRows(LAYOUT.HEADER_ROW_COUNT);
  sheet.setFrozenColumns(5);
}

/**
 * Generates grade-level group sheets based on wizard configuration
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} config - Unified configuration
 * @param {Object} wizardData - Wizard configuration data
 */
function generateGroupSheets(ss, config, wizardData) {
  if (!wizardData.groups || wizardData.groups.length === 0) return;

  const LAYOUT = config.LAYOUT;

  wizardData.groups.forEach(function(groupConfig) {
    const grade = groupConfig.grade;
    const groupCount = groupConfig.count || 1;

    // Determine sheet name (handles mixed grades via ModuleLoader)
    const sheetName = (typeof getSheetNameForGradeCode === 'function')
      ? getSheetNameForGradeCode(grade)
      : grade + ' Groups';

    const sheet = getOrCreateSheet(ss, sheetName);

    // Title
    sheet.getRange(1, 1).setValue(sheetName);
    sheet.getRange(1, 1).setFontSize(12).setFontWeight('bold')
      .setBackground(config.COLORS.TITLE_BG);

    // Column headers
    const headers = ['Student Name', 'Grade', 'Teacher', 'Group'];
    const lessonCount = LAYOUT.LESSONS_PER_GROUP_SHEET;
    for (let i = 1; i <= lessonCount; i++) {
      headers.push('Lesson ' + i);
    }
    headers.push('Status');

    sheet.getRange(LAYOUT.HEADER_ROW_COUNT, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(LAYOUT.HEADER_ROW_COUNT, 1, 1, headers.length)
      .setBackground(config.COLORS.HEADER_BG)
      .setFontColor(config.COLORS.HEADER_FG)
      .setFontWeight('bold');

    sheet.setFrozenRows(LAYOUT.HEADER_ROW_COUNT);
    sheet.setFrozenColumns(4);
  });
}

/**
 * Generates the Skills Tracker output sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} config - Unified configuration
 */
function generateSkillsTrackerSheet(ss, config) {
  const sheet = getOrCreateSheet(ss, config.SHEET_NAMES_V2.SKILLS);
  const LAYOUT = config.LAYOUT;

  // Build headers: metadata + 16 skill sections
  const headers = ['Student Name', 'Grade', 'Teacher', 'Group'];
  const skillEntries = Object.keys(SKILL_SECTIONS);
  skillEntries.forEach(function(section) {
    headers.push(section);
  });

  sheet.getRange(1, 1).setValue(config.schoolName + ' — Skills Tracker');
  sheet.getRange(1, 1).setFontSize(12).setFontWeight('bold')
    .setBackground(config.COLORS.TITLE_BG);

  sheet.getRange(LAYOUT.HEADER_ROW_COUNT, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(LAYOUT.HEADER_ROW_COUNT, 1, 1, headers.length)
    .setBackground(config.COLORS.HEADER_BG)
    .setFontColor(config.COLORS.HEADER_FG)
    .setFontWeight('bold');

  sheet.setFrozenRows(LAYOUT.HEADER_ROW_COUNT);
  sheet.setFrozenColumns(4);
}

/**
 * Generates the Grade Summary output sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} config - Unified configuration
 */
function generateGradeSummarySheet(ss, config) {
  const sheet = getOrCreateSheet(ss, config.SHEET_NAMES_V2.GRADE_SUMMARY);
  const LAYOUT = config.LAYOUT;

  const headers = [
    'Student Name', 'Grade', 'Teacher', 'Group',
    'Foundational Skills %', 'Min Grade Skills %', 'Current Year %', 'Benchmark Status'
  ];

  sheet.getRange(1, 1).setValue(config.schoolName + ' — Grade Summary');
  sheet.getRange(1, 1).setFontSize(12).setFontWeight('bold')
    .setBackground(config.COLORS.TITLE_BG);

  sheet.getRange(LAYOUT.HEADER_ROW_COUNT, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(LAYOUT.HEADER_ROW_COUNT, 1, 1, headers.length)
    .setBackground(config.COLORS.HEADER_BG)
    .setFontColor(config.COLORS.HEADER_FG)
    .setFontWeight('bold');

  sheet.setFrozenRows(LAYOUT.HEADER_ROW_COUNT);
  sheet.setFrozenColumns(4);
}

/**
 * Generates the Initial Assessment sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} config - Unified configuration
 */
function generateInitialAssessmentSheet(ss, config) {
  const sheet = getOrCreateSheet(ss, config.SHEET_NAMES_V2.INITIAL_ASSESSMENT);
  const LAYOUT = config.LAYOUT;

  const headerRow = ['Student Name', 'Grade', 'Teacher', 'Group', 'Assessment Date'];
  for (let i = 1; i <= LAYOUT.TOTAL_LESSONS; i++) {
    headerRow.push(LESSON_LABELS[i] || ('L' + i));
  }

  sheet.getRange(1, 1).setValue(config.schoolName + ' — Initial Assessment');
  sheet.getRange(1, 1).setFontSize(12).setFontWeight('bold')
    .setBackground(config.COLORS.TITLE_BG);

  sheet.getRange(LAYOUT.HEADER_ROW_COUNT, 1, 1, headerRow.length).setValues([headerRow]);
  sheet.getRange(LAYOUT.HEADER_ROW_COUNT, 1, 1, headerRow.length)
    .setBackground(config.COLORS.HEADER_BG)
    .setFontColor(config.COLORS.HEADER_FG)
    .setFontWeight('bold');

  sheet.setFrozenRows(LAYOUT.HEADER_ROW_COUNT);
  sheet.setFrozenColumns(5);
}

/**
 * Generates the School Summary dashboard sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} config - Unified configuration
 */
function generateSchoolSummarySheet(ss, config) {
  const sheet = getOrCreateSheet(ss, config.SHEET_NAMES_V2.SCHOOL_SUMMARY);

  sheet.getRange(1, 1).setValue(config.schoolName + ' — School Summary');
  sheet.getRange(1, 1).setFontSize(14).setFontWeight('bold')
    .setBackground(config.COLORS.TITLE_BG);

  sheet.getRange(3, 1).setValue('Grade');
  sheet.getRange(3, 2).setValue('Total Students');
  sheet.getRange(3, 3).setValue('On Track %');
  sheet.getRange(3, 4).setValue('Needs Support %');
  sheet.getRange(3, 5).setValue('At Risk %');
  sheet.getRange(3, 1, 1, 5)
    .setBackground(config.COLORS.HEADER_BG)
    .setFontColor(config.COLORS.HEADER_FG)
    .setFontWeight('bold');

  sheet.setFrozenRows(3);
}

/**
 * Generates the Pre-K Data sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} config - Unified configuration
 */
function generatePreKDataSheet(ss, config) {
  const sheet = getOrCreateSheet(ss, config.SHEET_NAMES_PREK.DATA);
  const PREK = config.PREK_CONFIG;

  sheet.getRange(1, 1).setValue(config.schoolName + ' — Pre-K Data (Handwriting Without Tears)');
  sheet.getRange(1, 1).setFontSize(12).setFontWeight('bold')
    .setBackground(config.COLORS.TITLE_BG);

  // Build Pre-K headers: Name, Grade, Teacher, Group, then 26 letters × 3 categories
  const headers = ['Student Name', 'Grade', 'Teacher', 'Group'];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  letters.forEach(function(letter) {
    headers.push(letter + ' Name');
    headers.push(letter + ' Sound');
    headers.push(letter + ' Form');
  });

  sheet.getRange(PREK.HEADER_ROW, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(PREK.HEADER_ROW, 1, 1, headers.length)
    .setBackground(config.COLORS.HEADER_BG)
    .setFontColor(config.COLORS.HEADER_FG)
    .setFontWeight('bold');

  sheet.setFrozenRows(PREK.HEADER_ROW);
  sheet.setFrozenColumns(4);
}

/**
 * Generates Pacing Dashboard and Log sheets
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} config - Unified configuration
 */
function generatePacingSheets(ss, config) {
  // Pacing Dashboard
  var dashSheet = getOrCreateSheet(ss, config.SHEET_NAMES_PACING.DASHBOARD);
  dashSheet.getRange(1, 1).setValue(config.schoolName + ' — Pacing Dashboard');
  dashSheet.getRange(1, 1).setFontSize(12).setFontWeight('bold')
    .setBackground(config.COLORS.TITLE_BG);

  // Pacing Log
  var logSheet = getOrCreateSheet(ss, config.SHEET_NAMES_PACING.LOG);
  logSheet.getRange(1, 1).setValue(config.schoolName + ' — Pacing Log');
  logSheet.getRange(1, 1).setFontSize(12).setFontWeight('bold')
    .setBackground(config.COLORS.TITLE_BG);
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED STATISTICS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Recalculates all stats using the unified configuration.
 * This is the parameterized replacement for per-school recalculate functions.
 * Reads config from SITE_CONFIG via getUnifiedConfig() at runtime.
 */
function recalculateAllStatsNow() {
  var config = getUnifiedConfig();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Build the config object expected by SharedEngine.updateAllStats()
  var engineConfig = {
    SHEET_NAMES_V2: config.SHEET_NAMES_V2,
    SHEET_NAMES_PREK: config.SHEET_NAMES_PREK,
    LAYOUT: config.LAYOUT,
    PREK_CONFIG: config.PREK_CONFIG,
    GRADE_METRICS: config.GRADE_METRICS
  };

  updateAllStats(ss, null, engineConfig);

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'All statistics recalculated successfully.',
    'Sync Complete',
    5
  );
}

/**
 * Creates pacing reports for all configured grades.
 * Called during wizard setup to initialize pacing sheets.
 * @param {Spreadsheet} ss - Active spreadsheet
 */
function createPacingReports(ss) {
  var config = getUnifiedConfig();
  if (typeof isFeatureEnabled === 'function' && isFeatureEnabled('pacingSheets')) {
    generatePacingSheets(ss, config);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Navigation function: Go to School Summary sheet
 */
function goToSchoolSummary() {
  var config = getUnifiedConfig();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(config.SHEET_NAMES_V2.SCHOOL_SUMMARY);
  if (sheet) {
    ss.setActiveSheet(sheet);
  } else {
    SpreadsheetApp.getUi().alert('School Summary sheet not found. Please run the Setup Wizard first.');
  }
}
