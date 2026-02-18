// ═══════════════════════════════════════════════════════════════════════════
// STUDENT HISTORY - Weekly AG% Growth by Skill Section
// Standalone module — references shared constants from Phase2_ProgressTracking.gs
//
// Layout:
//   Row 1: Title
//   Row 2: Subtitle
//   Row 3: Headers — [Student Name, Grade, Group, Current Section, Week1, Week2, ...]
//   Row 4+: Data — one row per student, AG% for active skill section each week
//
// Each call to captureWeeklyGrowth() adds or updates a column for the current week.
// The AG% shown is the growth (Total% - Initial%) for the student's current skill
// section, determined by their most recent lesson on the UFLI MAP.
// ═══════════════════════════════════════════════════════════════════════════

var STUDENT_HISTORY_SHEET = "Student History";

var HISTORY_STATIC_COLS = {
  STUDENT: 0,
  GRADE: 1,
  GROUP: 2,
  SECTION: 3,
  COUNT: 4          // first 4 columns (0-3) are static; week columns start at index 4
};
var HISTORY_FIRST_WEEK_COL = 5; // 1-based column E — first weekly data column
var HISTORY_DATA_ROW = 4;       // 1-based row where student data starts

var HISTORY_STATIC_HEADERS = ["Student Name", "Grade", "Group", "Current Section"];

// Grade Summary detailed columns start at this 0-based index
// After: Name(0), Grade(1), Teacher(2), Group(3), Found(4), Min(5), Full(6), Benchmark(7)
var GS_SKILL_DETAIL_START = 8;

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC FUNCTIONS (Menu-callable)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Opens / navigates to the Student History sheet, creating if needed.
 */
function openStudentHistory() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureStudentHistorySheet_(ss);
  ss.setActiveSheet(ss.getSheetByName(STUDENT_HISTORY_SHEET));
}

/**
 * Captures current AG% for each student's active skill section and writes
 * to this week's column. Can be run manually or via a weekly trigger.
 *
 * - Determines each student's current section from their UFLI MAP current lesson
 * - Reads the AG% for that section from Grade Summary
 * - If a column for this week already exists, it updates it
 * - If not, it adds a new column
 * - New students are appended; existing students are matched by name
 */
function captureWeeklyGrowth() {
  var functionName = "captureWeeklyGrowth";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ensureStudentHistorySheet_(ss);

  // 1. Read current student data from Grade Summary and UFLI MAP
  var gradeSummary = getSheetDataAsMap(ss, SHEET_NAMES_V2.GRADE_SUMMARY);
  var ufliMap = getSheetDataAsMap(ss, SHEET_NAMES_V2.UFLI_MAP);

  if (gradeSummary.size === 0) {
    SpreadsheetApp.getUi().alert(
      "No Data",
      "No student data found in Grade Summary. Run 'Recalculate All Stats Now' first.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  // 2. Build skill section lookup
  var sectionNames = Object.keys(SKILL_SECTIONS);

  // 3. Determine this week's column header (e.g., "02/03")
  var weekLabel = getWeekLabel_(new Date());

  // 4. Read existing sheet data
  var lastRow = Math.max(sheet.getLastRow(), HISTORY_DATA_ROW - 1);
  var lastCol = Math.max(sheet.getLastColumn(), HISTORY_STATIC_HEADERS.length);
  var headers = sheet.getRange(3, 1, 1, lastCol).getValues()[0];

  // 5. Find or create the column for this week
  var weekCol = findWeekColumn_(headers, weekLabel);
  if (weekCol === -1) {
    // Add new column
    weekCol = lastCol + 1;
    sheet.getRange(3, weekCol).setValue(weekLabel)
      .setFontWeight("bold")
      .setFontFamily("Calibri")
      .setFontSize(10)
      .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
      .setHorizontalAlignment("center");
  }

  // 6. Build map of existing students (name -> row number)
  var existingStudents = {};
  if (lastRow >= HISTORY_DATA_ROW) {
    var nameData = sheet.getRange(HISTORY_DATA_ROW, 1, lastRow - HISTORY_DATA_ROW + 1, 1).getValues();
    for (var i = 0; i < nameData.length; i++) {
      var name = nameData[i][0] ? nameData[i][0].toString().trim() : "";
      if (name) existingStudents[name] = HISTORY_DATA_ROW + i;
    }
  }

  // 7. Write growth data for each student
  var newRows = [];
  var updateCount = 0;

  gradeSummary.forEach(function(gsRow, studentName) {
    var grade = gsRow[COLS.GRADE_SUMMARY.GRADE] ? gsRow[COLS.GRADE_SUMMARY.GRADE].toString().trim() : "";
    var group = gsRow[COLS.GRADE_SUMMARY.GROUP] ? gsRow[COLS.GRADE_SUMMARY.GROUP].toString().trim() : "";

    // Determine student's current skill section and AG% from UFLI MAP + Grade Summary
    var sectionInfo = getStudentSectionInfo_(ufliMap, studentName, gsRow, sectionNames);
    var sectionName = sectionInfo.section;
    var agPct = sectionInfo.agPct;

    if (existingStudents[studentName]) {
      // Update existing row — write section, group (may have changed), and week value
      var row = existingStudents[studentName];
      sheet.getRange(row, HISTORY_STATIC_COLS.GROUP + 1).setValue(group);
      sheet.getRange(row, HISTORY_STATIC_COLS.SECTION + 1).setValue(sectionName);
      sheet.getRange(row, weekCol).setValue(agPct);
      updateCount++;
    } else {
      // New student — queue for appending
      var newRow = [studentName, grade, group, sectionName];
      // Pad with empty cells up to the week column
      while (newRow.length < weekCol - 1) newRow.push("");
      newRow.push(agPct);
      newRows.push(newRow);
    }
  });

  // 8. Append new students
  if (newRows.length > 0) {
    var appendRow = Math.max(sheet.getLastRow() + 1, HISTORY_DATA_ROW);
    var maxCols = newRows[0].length;
    sheet.getRange(appendRow, 1, newRows.length, maxCols).setValues(newRows);
  }

  // 9. Format the week column as whole-number percent
  var totalStudents = Object.keys(existingStudents).length + newRows.length;
  if (totalStudents > 0) {
    sheet.getRange(HISTORY_DATA_ROW, weekCol, totalStudents, 1).setNumberFormat('0"%"');
  }

  // 10. Apply formatting
  formatStudentHistory_(sheet);

  // 11. Set column width for week column
  sheet.setColumnWidth(weekCol, 75);

  var totalCaptured = updateCount + newRows.length;
  log(functionName, "Weekly growth captured: " + totalCaptured + " students for week " + weekLabel);

  SpreadsheetApp.getUi().alert(
    "Weekly Growth Captured",
    totalCaptured + " students updated for week of " + weekLabel + ".\n" +
    (newRows.length > 0 ? newRows.length + " new students added." : ""),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Sets up a weekly time-based trigger to auto-capture growth every Monday.
 */
function setupWeeklyGrowthTrigger() {
  // Remove existing triggers for this function
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "captureWeeklyGrowthAuto_") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("captureWeeklyGrowthAuto_")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(6)
    .create();

  SpreadsheetApp.getUi().alert(
    "Weekly Growth Trigger Enabled",
    "Student growth will be automatically captured every Monday at 6 AM.\n\n" +
    "You can also capture manually anytime via:\nMenu > Coach Tools > Capture Weekly Growth",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Auto-capture (called by trigger — no UI alerts).
 */
function captureWeeklyGrowthAuto_() {
  var functionName = "captureWeeklyGrowthAuto_";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ensureStudentHistorySheet_(ss);

  var gradeSummary = getSheetDataAsMap(ss, SHEET_NAMES_V2.GRADE_SUMMARY);
  var ufliMap = getSheetDataAsMap(ss, SHEET_NAMES_V2.UFLI_MAP);

  if (gradeSummary.size === 0) {
    log(functionName, "No Grade Summary data — skipping auto capture.");
    return;
  }

  var sectionNames = Object.keys(SKILL_SECTIONS);
  var weekLabel = getWeekLabel_(new Date());

  var lastRow = Math.max(sheet.getLastRow(), HISTORY_DATA_ROW - 1);
  var lastCol = Math.max(sheet.getLastColumn(), HISTORY_STATIC_HEADERS.length);
  var headers = sheet.getRange(3, 1, 1, lastCol).getValues()[0];

  var weekCol = findWeekColumn_(headers, weekLabel);
  if (weekCol === -1) {
    weekCol = lastCol + 1;
    sheet.getRange(3, weekCol).setValue(weekLabel)
      .setFontWeight("bold")
      .setFontFamily("Calibri")
      .setFontSize(10)
      .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
      .setHorizontalAlignment("center");
  }

  var existingStudents = {};
  if (lastRow >= HISTORY_DATA_ROW) {
    var nameData = sheet.getRange(HISTORY_DATA_ROW, 1, lastRow - HISTORY_DATA_ROW + 1, 1).getValues();
    for (var i = 0; i < nameData.length; i++) {
      var name = nameData[i][0] ? nameData[i][0].toString().trim() : "";
      if (name) existingStudents[name] = HISTORY_DATA_ROW + i;
    }
  }

  var newRows = [];
  gradeSummary.forEach(function(gsRow, studentName) {
    var grade = gsRow[COLS.GRADE_SUMMARY.GRADE] ? gsRow[COLS.GRADE_SUMMARY.GRADE].toString().trim() : "";
    var group = gsRow[COLS.GRADE_SUMMARY.GROUP] ? gsRow[COLS.GRADE_SUMMARY.GROUP].toString().trim() : "";

    var sectionInfo = getStudentSectionInfo_(ufliMap, studentName, gsRow, sectionNames);
    var sectionName = sectionInfo.section;
    var agPct = sectionInfo.agPct;

    if (existingStudents[studentName]) {
      var row = existingStudents[studentName];
      sheet.getRange(row, HISTORY_STATIC_COLS.GROUP + 1).setValue(group);
      sheet.getRange(row, HISTORY_STATIC_COLS.SECTION + 1).setValue(sectionName);
      sheet.getRange(row, weekCol).setValue(agPct);
    } else {
      var newRow = [studentName, grade, group, sectionName];
      while (newRow.length < weekCol - 1) newRow.push("");
      newRow.push(agPct);
      newRows.push(newRow);
    }
  });

  if (newRows.length > 0) {
    var appendRow = Math.max(sheet.getLastRow() + 1, HISTORY_DATA_ROW);
    sheet.getRange(appendRow, 1, newRows.length, newRows[0].length).setValues(newRows);
  }

  var totalStudents = Object.keys(existingStudents).length + newRows.length;
  if (totalStudents > 0) {
    sheet.getRange(HISTORY_DATA_ROW, weekCol, totalStudents, 1).setNumberFormat('0"%"');
  }

  formatStudentHistory_(sheet);
  sheet.setColumnWidth(weekCol, 75);

  log(functionName, "Auto-captured weekly growth for " + totalStudents + " students, week " + weekLabel);
}

// ─────────────────────────────────────────────────────────────────────────
// SKILL SECTION HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Determines a student's active skill section and AG% for that section.
 *
 * @param {Map} ufliMap - UFLI MAP data keyed by student name
 * @param {string} studentName - Student name to look up
 * @param {Array} gsRow - Grade Summary row data for this student
 * @param {string[]} sectionNames - Ordered array of SKILL_SECTIONS keys
 * @returns {{section: string, agPct: number|string}} Section name and AG%
 */
function getStudentSectionInfo_(ufliMap, studentName, gsRow, sectionNames) {
  var result = { section: "—", agPct: "" };

  // Get current lesson from UFLI MAP
  if (!ufliMap.has(studentName)) return result;

  var mapRow = ufliMap.get(studentName);
  var currentLessonStr = mapRow[LAYOUT.COL_CURRENT_LESSON - 1] || "";
  currentLessonStr = currentLessonStr.toString().trim();

  // Parse lesson number from "UFLI L49" format
  var lessonNum = parseLessonNumber_(currentLessonStr);
  if (!lessonNum) return result;

  // Find which skill section contains this lesson
  var sectionName = findSectionForLesson_(lessonNum, sectionNames);
  if (!sectionName) return result;

  // Get the AG% for this section from Grade Summary detailed columns
  // Layout: GS_SKILL_DETAIL_START + sectionIndex * 3 gives [Initial%, AG%, Total%]
  var sectionIndex = sectionNames.indexOf(sectionName);
  var agColIndex = GS_SKILL_DETAIL_START + sectionIndex * 3 + 1; // +1 for AG% (middle of the triple)

  var agPct = (agColIndex < gsRow.length) ? gsRow[agColIndex] : "";
  if (agPct === "" || agPct === null || agPct === undefined) agPct = 0;

  result.section = sectionName;
  result.agPct = agPct;
  return result;
}

/**
 * Parses a lesson number from strings like "UFLI L49", "L49", or "49".
 * Returns the numeric lesson number, or null if not parseable.
 */
function parseLessonNumber_(lessonStr) {
  if (!lessonStr) return null;
  var match = lessonStr.toString().match(/L?(\d+)/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Finds which SKILL_SECTIONS entry contains the given lesson number.
 * Returns the section name, or null if not found.
 */
function findSectionForLesson_(lessonNum, sectionNames) {
  for (var i = 0; i < sectionNames.length; i++) {
    var lessons = SKILL_SECTIONS[sectionNames[i]];
    if (lessons.indexOf(lessonNum) >= 0) {
      return sectionNames[i];
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// SHEET SETUP & FORMATTING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Creates the Student History sheet if it doesn't exist.
 * If the sheet exists but has the wrong number of static headers (e.g., from an
 * older version), it is deleted and recreated.
 * Returns the sheet.
 */
function ensureStudentHistorySheet_(ss) {
  var sheet = ss.getSheetByName(STUDENT_HISTORY_SHEET);
  if (sheet) {
    // Verify the sheet has the correct header structure
    var existingHeaders = sheet.getRange(3, 1, 1, HISTORY_STATIC_HEADERS.length).getValues()[0];
    var headersMatch = true;
    for (var i = 0; i < HISTORY_STATIC_HEADERS.length; i++) {
      if (existingHeaders[i] !== HISTORY_STATIC_HEADERS[i]) {
        headersMatch = false;
        break;
      }
    }
    if (headersMatch) return sheet;

    // Headers don't match (old version) — recreate
    ss.deleteSheet(sheet);
  }

  sheet = ss.insertSheet(STUDENT_HISTORY_SHEET);

  // Title — merge only across static columns so frozen columns don't conflict
  var initCols = HISTORY_STATIC_HEADERS.length;
  sheet.getRange(1, 1, 1, initCols).merge();
  sheet.getRange("A1")
    .setValue("Student History — Weekly AG% Growth")
    .setFontWeight("bold")
    .setFontSize(14)
    .setFontFamily("Calibri")
    .setFontColor(DASHBOARD_COLORS.HEADER_TEXT)
    .setBackground(DASHBOARD_COLORS.HEADER_BG)
    .setHorizontalAlignment("center");

  // Subtitle
  sheet.getRange(2, 1, 1, initCols).merge();
  sheet.getRange("A2")
    .setValue("AG% by active skill section | Menu > Coach Tools > Capture Weekly Growth")
    .setFontStyle("italic")
    .setFontSize(9)
    .setFontFamily("Calibri")
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);

  // Static headers
  var headerRange = sheet.getRange(3, 1, 1, HISTORY_STATIC_HEADERS.length);
  headerRange.setValues([HISTORY_STATIC_HEADERS])
    .setFontWeight("bold")
    .setFontFamily("Calibri")
    .setFontSize(10)
    .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
    .setHorizontalAlignment("center");

  // Column widths
  sheet.setColumnWidth(1, 160); // Student Name
  sheet.setColumnWidth(2, 60);  // Grade
  sheet.setColumnWidth(3, 140); // Group
  sheet.setColumnWidth(4, 180); // Current Section

  sheet.setFrozenRows(3);
  sheet.setFrozenColumns(4);

  return sheet;
}

/**
 * Returns the week label for the Monday of the given date's week.
 * Format: "MM/DD" (e.g., "02/03")
 */
function getWeekLabel_(date) {
  // Find Monday of this week
  var d = new Date(date);
  var day = d.getDay() || 7; // Sunday = 7
  d.setDate(d.getDate() - day + 1); // Monday
  var month = (d.getMonth() + 1).toString();
  if (month.length < 2) month = "0" + month;
  var dayNum = d.getDate().toString();
  if (dayNum.length < 2) dayNum = "0" + dayNum;
  return month + "/" + dayNum;
}

/**
 * Finds the 1-based column index for a given week label in the header row.
 * Returns -1 if not found.
 */
function findWeekColumn_(headers, weekLabel) {
  for (var i = HISTORY_STATIC_HEADERS.length; i < headers.length; i++) {
    var h = headers[i] ? headers[i].toString().trim() : "";
    if (h === weekLabel) return i + 1; // convert to 1-based
  }
  return -1;
}

/**
 * Applies formatting to the Student History data area.
 */
function formatStudentHistory_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < HISTORY_DATA_ROW || lastCol < 1) return;

  var dataRows = lastRow - HISTORY_DATA_ROW + 1;

  // Font
  sheet.getRange(HISTORY_DATA_ROW, 1, dataRows, lastCol)
    .setFontFamily("Calibri")
    .setFontSize(10);

  // Center everything except student name
  if (lastCol > 1) {
    sheet.getRange(HISTORY_DATA_ROW, 2, dataRows, lastCol - 1)
      .setHorizontalAlignment("center");
  }

  // Left-align the Section column (D) since section names are long
  sheet.getRange(HISTORY_DATA_ROW, HISTORY_STATIC_COLS.SECTION + 1, dataRows, 1)
    .setHorizontalAlignment("left");

  // Alternating row colors
  for (var i = 0; i < dataRows; i++) {
    if (i % 2 === 1) {
      sheet.getRange(HISTORY_DATA_ROW + i, 1, 1, lastCol)
        .setBackground(DASHBOARD_COLORS.TABLE_ALT_ROW);
    } else {
      sheet.getRange(HISTORY_DATA_ROW + i, 1, 1, lastCol)
        .setBackground("#ffffff");
    }
  }

  // Conditional formatting on week columns — color scale from red to green
  if (lastCol >= HISTORY_FIRST_WEEK_COL) {
    var weekRange = sheet.getRange(HISTORY_DATA_ROW, HISTORY_FIRST_WEEK_COL, dataRows, lastCol - HISTORY_FIRST_WEEK_COL + 1);

    var rules = sheet.getConditionalFormatRules();

    // Remove any existing rules on the week range to avoid stacking
    rules = rules.filter(function(rule) {
      var ranges = rule.getRanges();
      for (var r = 0; r < ranges.length; r++) {
        if (ranges[r].getColumn() >= HISTORY_FIRST_WEEK_COL) return false;
      }
      return true;
    });

    // Color scale: 0% = red, 50% = yellow, 100% = green
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .setGradientMinpointWithValue("#f8d7da", SpreadsheetApp.InterpolationType.NUMBER, "0")
      .setGradientMidpointWithValue("#fff3cd", SpreadsheetApp.InterpolationType.NUMBER, "50")
      .setGradientMaxpointWithValue("#d4edda", SpreadsheetApp.InterpolationType.NUMBER, "100")
      .setRanges([weekRange])
      .build());

    sheet.setConditionalFormatRules(rules);
  }
}
