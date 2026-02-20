// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TEST FIXTURES - Setup / Teardown / Fixture Data
// ═══════════════════════════════════════════════════════════════════════════
// Version: 1.0 - Tier 2 Integration Testing
// Last Updated: February 2026
//
// PURPOSE:
// Provides functions to create, populate, and clean up test fixture data
// in the dedicated test spreadsheet. Each test suite can call setup/teardown
// to ensure a known, repeatable state.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Names of sheets created by the test fixtures (cleaned up in teardown).
 */
const TEST_SHEET_PREFIX = '_TEST_';

/**
 * Fixture student roster data for testing.
 */
const FIXTURE_STUDENTS = [
  { id: 'S001', firstName: 'Alice', lastName: 'Anderson', grade: 'G3', group: 'Group A', teacher: 'Ms. Smith' },
  { id: 'S002', firstName: 'Bob', lastName: 'Brown', grade: 'G3', group: 'Group A', teacher: 'Ms. Smith' },
  { id: 'S003', firstName: 'Carol', lastName: 'Clark', grade: 'G4', group: 'Group B', teacher: 'Mr. Jones' },
  { id: 'S004', firstName: 'David', lastName: 'Davis', grade: 'G4', group: 'Group B', teacher: 'Mr. Jones' },
  { id: 'S005', firstName: 'Eve', lastName: 'Evans', grade: 'KG', group: 'Group C', teacher: 'Mrs. Lee' },
  { id: 'S006', firstName: 'Frank', lastName: 'Foster', grade: 'G6', group: 'Group D', teacher: 'Mr. Patel' },
  { id: 'S007', firstName: 'Grace', lastName: 'Garcia', grade: 'G6', group: 'Group D', teacher: 'Mr. Patel' },
  { id: 'S008', firstName: 'Hank', lastName: 'Hill', grade: 'PreK', group: 'Group E', teacher: 'Ms. Rivera' }
];

/**
 * Fixture lesson score data (student ID → lesson number → score).
 */
const FIXTURE_LESSON_SCORES = {
  'S001': { 5: 90, 10: 85, 19: 78, 35: 92, 38: 88, 41: 80 },
  'S002': { 5: 65, 10: 70, 19: 60, 35: 55, 38: 50, 41: 45 },
  'S003': { 5: 95, 10: 92, 19: 88, 35: 90, 38: 85, 41: 82 },
  'S004': { 5: 72, 10: 68, 19: 75, 35: 70, 38: 65, 41: 60 },
  'S005': { 5: 88, 10: 82 },
  'S006': { 5: 78, 10: 80, 19: 76, 35: 74, 38: 72, 41: 70, 49: 68, 53: 65 },
  'S007': { 5: 100, 10: 98, 19: 95, 35: 97, 38: 96, 41: 94, 49: 92, 53: 90 }
};

/**
 * Fixture feature flag configurations for different school scenarios.
 */
const FIXTURE_SCENARIOS = {
  /** All features disabled — core system only */
  coreOnly: {
    schoolName: 'Test Core School',
    gradeRangeModel: 'k5',
    features: {
      mixedGradeSupport: false,
      coachingDashboard: false,
      tutoringSystem: false,
      grantReporting: false,
      growthHighlighter: false,
      adminImport: false,
      unenrollmentAutomation: false,
      preKSystem: false,
      syncQueueProcessing: false,
      nightlySyncAutomation: false,
      syncStatusMonitoring: false,
      enhancedSecurity: true,
      structuredLogging: false,
      scClassroomGroups: false,
      coTeachingSupport: false
    }
  },
  /** Mixed-grade school with admin tools */
  mixedGrade: {
    schoolName: 'Test Mixed Grade School',
    gradeRangeModel: 'k8',
    features: {
      mixedGradeSupport: true,
      coachingDashboard: false,
      tutoringSystem: false,
      grantReporting: false,
      growthHighlighter: true,
      adminImport: true,
      unenrollmentAutomation: true,
      preKSystem: false,
      syncQueueProcessing: true,
      nightlySyncAutomation: true,
      syncStatusMonitoring: false,
      enhancedSecurity: true,
      structuredLogging: false,
      scClassroomGroups: false,
      coTeachingSupport: false
    }
  },
  /** Tutoring-focused school */
  tutoringOnly: {
    schoolName: 'Test Tutoring School',
    gradeRangeModel: 'k5',
    features: {
      mixedGradeSupport: false,
      coachingDashboard: false,
      tutoringSystem: true,
      grantReporting: true,
      growthHighlighter: false,
      adminImport: false,
      unenrollmentAutomation: false,
      preKSystem: false,
      syncQueueProcessing: false,
      nightlySyncAutomation: true,
      syncStatusMonitoring: false,
      enhancedSecurity: true,
      structuredLogging: false,
      scClassroomGroups: false,
      coTeachingSupport: false
    }
  },
  /** Pre-K only school */
  preKOnly: {
    schoolName: 'Test Pre-K School',
    gradeRangeModel: 'prek_only',
    features: {
      mixedGradeSupport: false,
      coachingDashboard: false,
      tutoringSystem: false,
      grantReporting: false,
      growthHighlighter: false,
      adminImport: false,
      unenrollmentAutomation: false,
      preKSystem: 'hwt',
      syncQueueProcessing: false,
      nightlySyncAutomation: false,
      syncStatusMonitoring: false,
      enhancedSecurity: true,
      structuredLogging: false,
      scClassroomGroups: false,
      coTeachingSupport: false
    }
  },
  /** Full-featured school */
  fullFeatures: {
    schoolName: 'Test Full School',
    gradeRangeModel: 'prek_8',
    features: {
      mixedGradeSupport: true,
      coachingDashboard: true,
      tutoringSystem: true,
      grantReporting: true,
      growthHighlighter: true,
      adminImport: true,
      unenrollmentAutomation: true,
      preKSystem: 'hwt',
      syncQueueProcessing: true,
      nightlySyncAutomation: true,
      syncStatusMonitoring: true,
      enhancedSecurity: true,
      structuredLogging: true,
      scClassroomGroups: true,
      coTeachingSupport: true
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SETUP / TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a test Configuration sheet with the given scenario data.
 * @param {string} scenarioKey - Key from FIXTURE_SCENARIOS
 * @returns {Sheet} The created Configuration sheet
 */
function setupTestConfigSheet(scenarioKey) {
  const scenario = FIXTURE_SCENARIOS[scenarioKey];
  if (!scenario) throw new Error('Unknown fixture scenario: ' + scenarioKey);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = TEST_SHEET_PREFIX + 'Config';

  // Remove existing test config sheet
  const existing = ss.getSheetByName(sheetName);
  if (existing) ss.deleteSheet(existing);

  const sheet = ss.insertSheet(sheetName);
  // Write config rows matching CONFIG_LAYOUT.SITE_CONFIG structure
  const configRows = [
    ['Setting', 'Value'],
    ['School Name', scenario.schoolName],
    ['Grade Range Model', scenario.gradeRangeModel],
    ['System Version', '7.0']
  ];
  sheet.getRange(1, 1, configRows.length, 2).setValues(configRows);

  return sheet;
}

/**
 * Create a test Feature Settings sheet with the given scenario flags.
 * @param {string} scenarioKey - Key from FIXTURE_SCENARIOS
 * @returns {Sheet} The created Feature Settings sheet
 */
function setupTestFeatureSheet(scenarioKey) {
  const scenario = FIXTURE_SCENARIOS[scenarioKey];
  if (!scenario) throw new Error('Unknown fixture scenario: ' + scenarioKey);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = TEST_SHEET_PREFIX + 'Features';

  const existing = ss.getSheetByName(sheetName);
  if (existing) ss.deleteSheet(existing);

  const sheet = ss.insertSheet(sheetName);
  const headers = [['Feature', 'Enabled']];
  sheet.getRange(1, 1, 1, 2).setValues(headers).setFontWeight('bold');

  const featureKeys = Object.keys(scenario.features);
  const rows = featureKeys.map(function(key) {
    return [key, scenario.features[key]];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  }

  return sheet;
}

/**
 * Create a test group sheet with fixture student data and lesson scores.
 * @param {string} groupName - Group name (e.g. "Group A")
 * @param {Array<Object>} students - Subset of FIXTURE_STUDENTS
 * @returns {Sheet} The created group sheet
 */
function setupTestGroupSheet(groupName, students) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = TEST_SHEET_PREFIX + groupName.replace(/\s+/g, '_');

  const existing = ss.getSheetByName(sheetName);
  if (existing) ss.deleteSheet(existing);

  const sheet = ss.insertSheet(sheetName);

  // Build header rows matching LAYOUT conventions (5 header rows, data starts row 6)
  // Row 1: Title
  sheet.getRange(1, 1).setValue(groupName + ' - UFLI Progress Tracking');
  // Row 5: Column headers
  const headers = ['Student ID', 'First Name', 'Last Name', 'Grade', 'Teacher'];

  // Add lesson columns (simplified: just the review lessons)
  const lessonCols = [5, 10, 19, 35, 38, 41, 49, 53];
  for (let l = 0; l < lessonCols.length; l++) {
    headers.push('L' + lessonCols[l]);
  }
  sheet.getRange(5, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  // Row 6+: Student data
  for (let s = 0; s < students.length; s++) {
    const student = students[s];
    const row = [student.id, student.firstName, student.lastName, student.grade, student.teacher];
    const scores = FIXTURE_LESSON_SCORES[student.id] || {};
    for (let l = 0; l < lessonCols.length; l++) {
      row.push(scores[lessonCols[l]] !== undefined ? scores[lessonCols[l]] : '');
    }
    sheet.getRange(6 + s, 1, 1, row.length).setValues([row]);
  }

  return sheet;
}

/**
 * Clean up all test sheets created by the fixtures.
 */
function teardownTestSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  for (let i = sheets.length - 1; i >= 0; i--) {
    if (sheets[i].getName().indexOf(TEST_SHEET_PREFIX) === 0) {
      ss.deleteSheet(sheets[i]);
    }
  }
}

/**
 * Full setup for a given scenario: config sheet + feature sheet + group sheets.
 * @param {string} scenarioKey - Key from FIXTURE_SCENARIOS
 */
function setupFullScenario(scenarioKey) {
  teardownTestSheets();
  setupTestConfigSheet(scenarioKey);
  setupTestFeatureSheet(scenarioKey);

  // Create group sheets for fixture students
  const groups = {};
  for (let s = 0; s < FIXTURE_STUDENTS.length; s++) {
    const student = FIXTURE_STUDENTS[s];
    if (!groups[student.group]) groups[student.group] = [];
    groups[student.group].push(student);
  }

  const groupNames = Object.keys(groups);
  for (let g = 0; g < groupNames.length; g++) {
    setupTestGroupSheet(groupNames[g], groups[groupNames[g]]);
  }
}
