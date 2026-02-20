// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS: Sheet Operations (Create, Read, Write)
// ═══════════════════════════════════════════════════════════════════════════
// Version: 1.0 - Tier 2 Integration Testing
// Last Updated: February 2026
//
// TESTS COVERED:
// - Test fixture sheets can be created and populated
// - Group sheet structure matches expected layout
// - Student data can be read back from fixture sheets
// - Lesson scores are written and retrievable
// - Config and Feature sheets are created correctly
// - Teardown removes all test sheets
// - Lesson entry data can be saved and retrieved
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register all sheet operation integration tests.
 */
function registerSheetOpsTests() {
  registerTestSuite('SheetOperations', [
    { name: 'Fixture config sheet created', fn: testFixtureConfigSheet },
    { name: 'Fixture feature sheet created', fn: testFixtureFeatureSheet },
    { name: 'Fixture group sheet created with correct headers', fn: testFixtureGroupSheetHeaders },
    { name: 'Fixture group sheet has correct student count', fn: testFixtureGroupSheetStudents },
    { name: 'Fixture lesson scores are retrievable', fn: testFixtureLessonScores },
    { name: 'Full scenario setup creates all expected sheets', fn: testFullScenarioSetup },
    { name: 'Teardown removes all test sheets', fn: testTeardown },
    { name: 'SpreadsheetApp is accessible', fn: testSpreadsheetAppAccess },
    { name: 'Active spreadsheet has sheets', fn: testActiveSpreadsheetSheets },
    { name: 'Sheet insert and delete round-trip', fn: testSheetInsertDelete }
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

function testFixtureConfigSheet() {
  const sheet = setupTestConfigSheet('coreOnly');
  Assert.isNotNull(sheet, 'Config sheet should be created');
  Assert.equals(sheet.getName(), TEST_SHEET_PREFIX + 'Config', 'Sheet name should match');

  // Verify first data row
  const schoolName = sheet.getRange(2, 2).getValue();
  Assert.equals(schoolName, 'Test Core School', 'School name should match coreOnly scenario');

  // Clean up
  SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
}

function testFixtureFeatureSheet() {
  const sheet = setupTestFeatureSheet('coreOnly');
  Assert.isNotNull(sheet, 'Feature sheet should be created');
  Assert.equals(sheet.getName(), TEST_SHEET_PREFIX + 'Features', 'Sheet name should match');

  // Verify header row
  const header1 = sheet.getRange(1, 1).getValue();
  Assert.equals(header1, 'Feature', 'First header should be "Feature"');

  const header2 = sheet.getRange(1, 2).getValue();
  Assert.equals(header2, 'Enabled', 'Second header should be "Enabled"');

  // Verify feature count matches scenario
  const lastRow = sheet.getLastRow();
  const featureCount = lastRow - 1; // minus header row
  const scenarioFeatureCount = Object.keys(FIXTURE_SCENARIOS.coreOnly.features).length;
  Assert.equals(featureCount, scenarioFeatureCount,
    'Feature count should match scenario (' + scenarioFeatureCount + ')');

  SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
}

function testFixtureGroupSheetHeaders() {
  const students = FIXTURE_STUDENTS.filter(function(s) { return s.group === 'Group A'; });
  const sheet = setupTestGroupSheet('Group A', students);
  Assert.isNotNull(sheet, 'Group sheet should be created');

  // Row 5 should have headers
  const firstHeader = sheet.getRange(5, 1).getValue();
  Assert.equals(firstHeader, 'Student ID', 'First column header should be "Student ID"');

  const teacherHeader = sheet.getRange(5, 5).getValue();
  Assert.equals(teacherHeader, 'Teacher', 'Fifth column header should be "Teacher"');

  SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
}

function testFixtureGroupSheetStudents() {
  const students = FIXTURE_STUDENTS.filter(function(s) { return s.group === 'Group A'; });
  const sheet = setupTestGroupSheet('Group A', students);

  // Data starts at row 6
  const studentId1 = sheet.getRange(6, 1).getValue();
  Assert.equals(studentId1, 'S001', 'First student ID should be S001');

  const studentId2 = sheet.getRange(7, 1).getValue();
  Assert.equals(studentId2, 'S002', 'Second student ID should be S002');

  // Verify correct count
  const lastRow = sheet.getLastRow();
  const dataRows = lastRow - 5; // rows 6+ contain data
  Assert.equals(dataRows, students.length, 'Data row count should match student count');

  SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
}

function testFixtureLessonScores() {
  const students = FIXTURE_STUDENTS.filter(function(s) { return s.group === 'Group A'; });
  const sheet = setupTestGroupSheet('Group A', students);

  // Column 6 = first lesson column (L5), Row 6 = first student (S001)
  // FIXTURE_LESSON_SCORES.S001[5] = 90
  const score = sheet.getRange(6, 6).getValue();
  Assert.equals(score, 90, 'S001 L5 score should be 90');

  // S002 L5 score = 65 (row 7, col 6)
  const score2 = sheet.getRange(7, 6).getValue();
  Assert.equals(score2, 65, 'S002 L5 score should be 65');

  SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
}

function testFullScenarioSetup() {
  setupFullScenario('coreOnly');

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Verify config sheet exists
  const configSheet = ss.getSheetByName(TEST_SHEET_PREFIX + 'Config');
  Assert.isNotNull(configSheet, 'Config sheet should exist after full setup');

  // Verify features sheet exists
  const featuresSheet = ss.getSheetByName(TEST_SHEET_PREFIX + 'Features');
  Assert.isNotNull(featuresSheet, 'Features sheet should exist after full setup');

  // Verify at least one group sheet exists
  const groupASheet = ss.getSheetByName(TEST_SHEET_PREFIX + 'Group_A');
  Assert.isNotNull(groupASheet, 'Group A sheet should exist after full setup');

  // Clean up
  teardownTestSheets();
}

function testTeardown() {
  // Create some test sheets
  setupTestConfigSheet('coreOnly');
  setupTestFeatureSheet('coreOnly');

  // Verify they exist
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Assert.isNotNull(ss.getSheetByName(TEST_SHEET_PREFIX + 'Config'), 'Config sheet exists pre-teardown');

  // Teardown
  teardownTestSheets();

  // Verify they're gone
  Assert.isNull(ss.getSheetByName(TEST_SHEET_PREFIX + 'Config'), 'Config sheet removed after teardown');
  Assert.isNull(ss.getSheetByName(TEST_SHEET_PREFIX + 'Features'), 'Features sheet removed after teardown');
}

function testSpreadsheetAppAccess() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Assert.isNotNull(ss, 'Active spreadsheet should be accessible');
  Assert.isNotNull(ss.getName(), 'Spreadsheet should have a name');
}

function testActiveSpreadsheetSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  Assert.isTrue(Array.isArray(sheets), 'getSheets should return array');
  Assert.greaterThan(sheets.length, 0, 'Spreadsheet should have at least one sheet');
}

function testSheetInsertDelete() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const testName = TEST_SHEET_PREFIX + 'RoundTrip';

  // Insert
  const sheet = ss.insertSheet(testName);
  Assert.isNotNull(sheet, 'Inserted sheet should not be null');
  Assert.equals(sheet.getName(), testName, 'Sheet name should match');

  // Write and read
  sheet.getRange(1, 1).setValue('hello');
  const readBack = sheet.getRange(1, 1).getValue();
  Assert.equals(readBack, 'hello', 'Value should round-trip');

  // Delete
  ss.deleteSheet(sheet);
  Assert.isNull(ss.getSheetByName(testName), 'Sheet should be deleted');
}
