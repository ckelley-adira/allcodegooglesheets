// ═══════════════════════════════════════════════════════════════════════════
// STUDENT HISTORY - Weekly AG% Growth + Lesson Stats by Skill Section
// Standalone module — references shared constants from Phase2_ProgressTracking.gs
//
// Layout:
//   Row 1: Title
//   Row 2: Subtitle
//   Row 3: Week date headers (merged across paired columns)
//   Row 4: Sub-headers — [Student Name, Grade, Group, Current Section,
//                          %AG Growth, Taken vs Passed, %AG Growth, Taken vs Passed, ...]
//   Row 5+: Data — one row per student
//
// Each call to captureWeeklyGrowth() adds or updates a PAIR of columns:
//   Column A: AG% growth for the student's current skill section
//   Column B: "Taken/Passed" lesson ratio from Small Group Progress
// ═══════════════════════════════════════════════════════════════════════════

var STUDENT_HISTORY_SHEET = "Student History";
var SMALL_GROUP_PROGRESS_SHEET = "Small Group Progress";

var HISTORY_STATIC_COLS = {
  STUDENT: 0,
  GRADE: 1,
  GROUP: 2,
  SECTION: 3,
  LAST_LESSON: 4,
  COUNT: 5
};
var HISTORY_STATIC_HEADERS = ["Student Name", "Grade", "Group", "Current Section", "Last Lesson"];
var HISTORY_FIRST_WEEK_COL = 6; // shifted from 5 to 6
var HISTORY_DATE_HEADER_ROW = 3;  // 1-based row for week date headers
var HISTORY_SUB_HEADER_ROW = 4;   // 1-based row for sub-headers (%AG Growth, Taken vs Passed)
var HISTORY_DATA_ROW = 5;         // 1-based row where student data starts
var HISTORY_COLS_PER_WEEK = 2;    // Each week occupies 2 columns

var HISTORY_STATIC_HEADERS = ["Student Name", "Grade", "Group", "Current Section"];

// Small Group Progress column indices (0-based from header row)
var SGP_COLS = {
  DATE: 0,
  TEACHER: 1,
  GROUP_NAME: 2,
  STUDENT_NAME: 3,
  LESSON: 4,
  STATUS: 5,
  SOURCE_GROUP: 6
};
var SGP_HEADER_ROW = 3; // 1-based row where SGP headers live
var SGP_DATA_ROW = 4;   // 1-based row where SGP data starts

// Grade Summary detailed columns start at this 0-based index
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
 * Captures current AG% and lesson stats for each student and writes
 * to this week's paired columns. Can be run manually or via a weekly trigger.
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

  // 2. Read Small Group Progress data for lesson stats
  var weekDates = getWeekDateRange_(new Date());
  var lessonStats = getWeeklyLessonStats_(ss, weekDates.start, weekDates.end);

  // 3. Build skill section lookup
  var sectionNames = Object.keys(SKILL_SECTIONS);

  // 4. Determine this week's label
  var weekLabel = getWeekLabel_(new Date());

  // 5. Read existing sheet data
  var lastRow = Math.max(sheet.getLastRow(), HISTORY_DATA_ROW - 1);
  var lastCol = Math.max(sheet.getLastColumn(), HISTORY_STATIC_HEADERS.length);
  var dateHeaders = sheet.getRange(HISTORY_DATE_HEADER_ROW, 1, 1, lastCol).getValues()[0];

  // 6. Find or create the paired columns for this week
  var weekCol = findWeekColumn_(dateHeaders, weekLabel);
  if (weekCol === -1) {
    // Add new paired columns
    weekCol = getNextWeekStartCol_(lastCol);
    writeWeekHeaders_(sheet, weekCol, weekLabel);
  }
  var ratioCol = weekCol + 1;

  // 7. Build map of existing students (name -> row number)
  var existingStudents = {};
  if (lastRow >= HISTORY_DATA_ROW) {
    var nameData = sheet.getRange(HISTORY_DATA_ROW, 1, lastRow - HISTORY_DATA_ROW + 1, 1).getValues();
    for (var i = 0; i < nameData.length; i++) {
      var name = nameData[i][0] ? nameData[i][0].toString().trim() : "";
      if (name) existingStudents[name] = HISTORY_DATA_ROW + i;
    }
  }

  // 8. Write growth + lesson data for each student
  var newRows = [];
  var updateCount = 0;

  gradeSummary.forEach(function(gsRow, studentName) {
    var grade = gsRow[COLS.GRADE_SUMMARY.GRADE] ? gsRow[COLS.GRADE_SUMMARY.GRADE].toString().trim() : "";
    var group = gsRow[COLS.GRADE_SUMMARY.GROUP] ? gsRow[COLS.GRADE_SUMMARY.GROUP].toString().trim() : "";

    // AG% from UFLI MAP + Grade Summary
    var sectionInfo = getStudentSectionInfo_(ufliMap, studentName, gsRow, sectionNames);
    var sectionName = sectionInfo.section;
    var agPct = sectionInfo.agPct;

    // Lesson stats from Small Group Progress
    var stats = lessonStats[studentName] || { taken: 0, passed: 0 };
    var ratioStr = stats.taken + "/" + stats.passed;

  if (existingStudents[studentName]) {
      var row = existingStudents[studentName];
      sheet.getRange(row, HISTORY_STATIC_COLS.GROUP + 1).setValue(group);
      sheet.getRange(row, HISTORY_STATIC_COLS.SECTION + 1).setValue(sectionName);
      sheet.getRange(row, HISTORY_STATIC_COLS.LAST_LESSON + 1).setValue(sectionInfo.lastLesson);
      sheet.getRange(row, weekCol).setValue(agPct);
      sheet.getRange(row, ratioCol).setValue(ratioStr);
      updateCount++;
    } else {
      var newRow = [studentName, grade, group, sectionName, sectionInfo.lastLesson];
      while (newRow.length < weekCol - 1) newRow.push("");
      newRow.push(agPct);
      newRow.push(ratioStr);
      newRows.push(newRow);
    }
  });

  // 9. Append new students
  if (newRows.length > 0) {
    var appendRow = Math.max(sheet.getLastRow() + 1, HISTORY_DATA_ROW);
    var maxCols = newRows[0].length;
    sheet.getRange(appendRow, 1, newRows.length, maxCols).setValues(newRows);
  }

  // 10. Format AG% column as whole-number percent
  var totalStudents = Object.keys(existingStudents).length + newRows.length;
  if (totalStudents > 0) {
    sheet.getRange(HISTORY_DATA_ROW, weekCol, totalStudents, 1).setNumberFormat('0"%"');
    sheet.getRange(HISTORY_DATA_ROW, ratioCol, totalStudents, 1)
      .setHorizontalAlignment("center")
      .setFontFamily("Calibri")
      .setFontSize(10);
  }

  // 11. Apply formatting
  formatStudentHistory_(sheet);

  // 12. Set column widths for the pair
  sheet.setColumnWidth(weekCol, 80);
  sheet.setColumnWidth(ratioCol, 100);

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

  var weekDates = getWeekDateRange_(new Date());
  var lessonStats = getWeeklyLessonStats_(ss, weekDates.start, weekDates.end);
  var sectionNames = Object.keys(SKILL_SECTIONS);
  var weekLabel = getWeekLabel_(new Date());

  var lastRow = Math.max(sheet.getLastRow(), HISTORY_DATA_ROW - 1);
  var lastCol = Math.max(sheet.getLastColumn(), HISTORY_STATIC_HEADERS.length);
  var dateHeaders = sheet.getRange(HISTORY_DATE_HEADER_ROW, 1, 1, lastCol).getValues()[0];

  var weekCol = findWeekColumn_(dateHeaders, weekLabel);
  if (weekCol === -1) {
    weekCol = getNextWeekStartCol_(lastCol);
    writeWeekHeaders_(sheet, weekCol, weekLabel);
  }
  var ratioCol = weekCol + 1;

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

    var stats = lessonStats[studentName] || { taken: 0, passed: 0 };
    var ratioStr = stats.taken + "/" + stats.passed;

  if (existingStudents[studentName]) {
      var row = existingStudents[studentName];
      sheet.getRange(row, HISTORY_STATIC_COLS.GROUP + 1).setValue(group);
      sheet.getRange(row, HISTORY_STATIC_COLS.SECTION + 1).setValue(sectionName);
      sheet.getRange(row, HISTORY_STATIC_COLS.LAST_LESSON + 1).setValue(sectionInfo.lastLesson);
      sheet.getRange(row, weekCol).setValue(agPct);
      sheet.getRange(row, ratioCol).setValue(ratioStr);
    } else {
      var newRow = [studentName, grade, group, sectionName, sectionInfo.lastLesson];
      while (newRow.length < weekCol - 1) newRow.push("");
      newRow.push(agPct);
      newRow.push(ratioStr);
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
    sheet.getRange(HISTORY_DATA_ROW, ratioCol, totalStudents, 1)
      .setHorizontalAlignment("center");
  }

  formatStudentHistory_(sheet);
  sheet.setColumnWidth(weekCol, 80);
  sheet.setColumnWidth(ratioCol, 100);

  log(functionName, "Auto-captured weekly growth for " + totalStudents + " students, week " + weekLabel);
}


// ─────────────────────────────────────────────────────────────────────────
// SMALL GROUP PROGRESS HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns the Monday–Sunday date range for the week containing the given date.
 * @param {Date} date
 * @returns {{start: Date, end: Date}}
 */
function getWeekDateRange_(date) {
  var d = new Date(date);
  var day = d.getDay() || 7; // Sunday = 7
  var monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);

  var sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

/**
 * Reads Small Group Progress and returns lesson taken/passed counts
 * for each student within the given date range.
 *
 * Taken = rows where Status is "Y" or "N" (present, attempted the lesson)
 * Passed = rows where Status is "Y"
 * Absent ("A") rows are excluded from both counts.
 *
 * @param {Spreadsheet} ss
 * @param {Date} startDate - Monday 00:00:00
 * @param {Date} endDate   - Sunday 23:59:59
 * @returns {Object} Map of studentName → { taken: number, passed: number }
 */
function getWeeklyLessonStats_(ss, startDate, endDate) {
  var stats = {};
  var sgpSheet = ss.getSheetByName(SMALL_GROUP_PROGRESS_SHEET);
  if (!sgpSheet) {
    log("getWeeklyLessonStats_", "Sheet '" + SMALL_GROUP_PROGRESS_SHEET + "' not found.");
    return stats;
  }

  var lastRow = sgpSheet.getLastRow();
  if (lastRow < SGP_DATA_ROW) return stats;

  var data = sgpSheet.getRange(SGP_DATA_ROW, 1, lastRow - SGP_DATA_ROW + 1, 7).getValues();

  // Track unique student+lesson combos to avoid double-counting
  var seen = {}; // key: "StudentName|LessonNumber"

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var dateVal = row[SGP_COLS.DATE];
    if (!dateVal) continue;

    var entryDate = new Date(dateVal);
    if (isNaN(entryDate.getTime())) continue;
    entryDate.setHours(0, 0, 0, 0);

    if (entryDate < startDate || entryDate > endDate) continue;

    var studentName = row[SGP_COLS.STUDENT_NAME] ? row[SGP_COLS.STUDENT_NAME].toString().trim() : "";
    if (!studentName) continue;

    var status = row[SGP_COLS.STATUS] ? row[SGP_COLS.STATUS].toString().trim().toUpperCase() : "";
    if (status === "A") continue;

    var lesson = row[SGP_COLS.LESSON] ? row[SGP_COLS.LESSON].toString().trim() : "";
    var key = studentName + "|" + lesson;

    // Skip if we've already counted this student+lesson combo
    if (seen[key]) continue;
    seen[key] = true;

    if (!stats[studentName]) {
      stats[studentName] = { taken: 0, passed: 0 };
    }

    if (status === "Y" || status === "N") {
      stats[studentName].taken++;
      if (status === "Y") {
        stats[studentName].passed++;
      }
    }
  }

  return stats;
}


// ─────────────────────────────────────────────────────────────────────────
// SKILL SECTION HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Determines a student's active skill section and AG% for that section.
 */
function getStudentSectionInfo_(ufliMap, studentName, gsRow, sectionNames) {
  var result = { section: "—", agPct: "", lastLesson: "" };

  if (!ufliMap.has(studentName)) return result;

  var mapRow = ufliMap.get(studentName);
  var currentLessonStr = mapRow[LAYOUT.COL_CURRENT_LESSON - 1] || "";
  currentLessonStr = currentLessonStr.toString().trim();

  result.lastLesson = currentLessonStr;

  var lessonNum = parseLessonNumber_(currentLessonStr);
  if (!lessonNum) return result;

  var sectionName = findSectionForLesson_(lessonNum, sectionNames);
  if (!sectionName) return result;

  var sectionIndex = sectionNames.indexOf(sectionName);
  var agColIndex = GS_SKILL_DETAIL_START + sectionIndex * 3 + 1;

  var agPct = (agColIndex < gsRow.length) ? gsRow[agColIndex] : "";
  if (agPct === "" || agPct === null || agPct === undefined) agPct = 0;

  result.section = sectionName;
  result.agPct = agPct;
  return result;
}

function parseLessonNumber_(lessonStr) {
  if (!lessonStr) return null;
  var match = lessonStr.toString().match(/L?(\d+)/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

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
// WEEK COLUMN HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns the week label for the Monday of the given date's week.
 * Format: "M/D/YYYY" (e.g., "2/9/2026")
 */
function getWeekLabel_(date) {
  var d = new Date(date);
  var day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1); // Monday
  var month = d.getMonth() + 1;
  var dayNum = d.getDate();
  var year = d.getFullYear();
  return month + "/" + dayNum + "/" + year;
}

/**
 * Finds the 1-based column index for a given week label in the date header row.
 * Searches row 3 for the week label across paired columns.
 * Returns -1 if not found.
 */
function findWeekColumn_(dateHeaders, weekLabel) {
  for (var i = HISTORY_STATIC_HEADERS.length; i < dateHeaders.length; i++) {
    var h = dateHeaders[i] ? dateHeaders[i].toString().trim() : "";
    if (h === weekLabel) return i + 1; // convert to 1-based
  }
  return -1;
}

/**
 * Calculates the next available start column for a new week pair.
 * Ensures alignment to paired column boundaries.
 */
function getNextWeekStartCol_(lastCol) {
  var firstWeekStart = HISTORY_FIRST_WEEK_COL; // 1-based col 5
  if (lastCol < firstWeekStart) return firstWeekStart;

  // Calculate how many week pairs exist after the static columns
  var weekCols = lastCol - firstWeekStart + 1;
  var completePairs = Math.ceil(weekCols / HISTORY_COLS_PER_WEEK);
  return firstWeekStart + (completePairs * HISTORY_COLS_PER_WEEK);
}

/**
 * Writes the date header (row 3, merged) and sub-headers (row 4)
 * for a new week's paired columns.
 */
function writeWeekHeaders_(sheet, weekCol, weekLabel) {
  var ratioCol = weekCol + 1;

  // Row 3: Merge and write the date label across both columns
  var dateRange = sheet.getRange(HISTORY_DATE_HEADER_ROW, weekCol, 1, 2);
  dateRange.merge();
  dateRange.setValue(weekLabel)
    .setFontWeight("bold")
    .setFontFamily("Calibri")
    .setFontSize(10)
    .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("bottom");

  // Row 4: Sub-headers
  sheet.getRange(HISTORY_SUB_HEADER_ROW, weekCol)
    .setValue("%AG\nGrowth")
    .setFontWeight("bold")
    .setFontFamily("Calibri")
    .setFontSize(9)
    .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("bottom")
    .setWrap(true);

  sheet.getRange(HISTORY_SUB_HEADER_ROW, ratioCol)
    .setValue("Lessons Taken\nvs.\nLessons Passed")
    .setFontWeight("bold")
    .setFontFamily("Calibri")
    .setFontSize(9)
    .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("bottom")
    .setWrap(true);
}


// ─────────────────────────────────────────────────────────────────────────
// SHEET SETUP & FORMATTING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Creates the Student History sheet if it doesn't exist.
 * Recreates if the header structure doesn't match the current version.
 * Returns the sheet.
 */
function ensureStudentHistorySheet_(ss) {
  var sheet = ss.getSheetByName(STUDENT_HISTORY_SHEET);
  if (sheet) {
    // Verify the sheet has the correct header structure on the sub-header row
    var existingHeaders = sheet.getRange(HISTORY_SUB_HEADER_ROW, 1, 1, HISTORY_STATIC_HEADERS.length).getValues()[0];
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

  var initCols = HISTORY_STATIC_HEADERS.length;

  // Row 1: Title
  sheet.getRange(1, 1, 1, initCols).merge();
  sheet.getRange("A1")
    .setValue("Student History — Weekly AG% Growth")
    .setFontWeight("bold")
    .setFontSize(14)
    .setFontFamily("Calibri")
    .setFontColor(DASHBOARD_COLORS.HEADER_TEXT)
    .setBackground(DASHBOARD_COLORS.HEADER_BG)
    .setHorizontalAlignment("center");

  // Row 2: Subtitle
  sheet.getRange(2, 1, 1, initCols).merge();
  sheet.getRange("A2")
    .setValue("AG% by active skill section | Menu > Coach Tools > Capture Weekly Growth")
    .setFontStyle("italic")
    .setFontSize(9)
    .setFontFamily("Calibri")
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);

  // Row 3: Date header row (static area left blank — week dates will be added dynamically)
  sheet.getRange(HISTORY_DATE_HEADER_ROW, 1, 1, initCols)
    .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG);

  // Row 4: Sub-headers (static column labels)
  var subHeaderRange = sheet.getRange(HISTORY_SUB_HEADER_ROW, 1, 1, HISTORY_STATIC_HEADERS.length);
  subHeaderRange.setValues([HISTORY_STATIC_HEADERS])
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
  sheet.setColumnWidth(5, 100); // Last Lesson

  sheet.setFrozenRows(HISTORY_SUB_HEADER_ROW);
  sheet.setFrozenColumns(5); // freeze through Last Lesson now

  return sheet;
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

  // Left-align the Section column (D)
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

  // Conditional formatting on AG% columns only (every other column in the week range)
  if (lastCol >= HISTORY_FIRST_WEEK_COL) {
    var rules = sheet.getConditionalFormatRules();

    // Remove existing rules on week columns
    rules = rules.filter(function(rule) {
      var ranges = rule.getRanges();
      for (var r = 0; r < ranges.length; r++) {
        if (ranges[r].getColumn() >= HISTORY_FIRST_WEEK_COL) return false;
      }
      return true;
    });

    // Build ranges for AG% columns only (first of each pair)
    var agRanges = [];
    for (var col = HISTORY_FIRST_WEEK_COL; col <= lastCol; col += HISTORY_COLS_PER_WEEK) {
      agRanges.push(sheet.getRange(HISTORY_DATA_ROW, col, dataRows, 1));
    }

    if (agRanges.length > 0) {
      // Color scale: 0% = red, 50% = yellow, 100% = green
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .setGradientMinpointWithValue("#f8d7da", SpreadsheetApp.InterpolationType.NUMBER, "0")
        .setGradientMidpointWithValue("#fff3cd", SpreadsheetApp.InterpolationType.NUMBER, "50")
        .setGradientMaxpointWithValue("#d4edda", SpreadsheetApp.InterpolationType.NUMBER, "100")
        .setRanges(agRanges)
        .build());
    }

    // Conditional formatting on ratio columns — highlight mismatches (taken ≠ passed)
    var ratioRanges = [];
    for (var col = HISTORY_FIRST_WEEK_COL + 1; col <= lastCol; col += HISTORY_COLS_PER_WEEK) {
      ratioRanges.push(sheet.getRange(HISTORY_DATA_ROW, col, dataRows, 1));
    }

    if (ratioRanges.length > 0) {
      // Light red background when taken ≠ passed (formula checks the two numbers differ)
      // Custom formula: parse "X/Y" and flag when X ≠ Y
      var firstRatioCell = sheet.getRange(HISTORY_DATA_ROW, HISTORY_FIRST_WEEK_COL + 1).getA1Notation();
      var formula = '=AND(LEN(' + firstRatioCell + ')>0, LEFT(' + firstRatioCell + ', FIND("/", ' + firstRatioCell + ')-1)+0 <> RIGHT(' + firstRatioCell + ', LEN(' + firstRatioCell + ')-FIND("/", ' + firstRatioCell + '))+0)';

      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(formula)
        .setBackground("#f8d7da")
        .setRanges(ratioRanges)
        .build());

     // Green when taken = passed AND taken > 0 (all passed, not empty)
      var formulaMatch = '=AND(LEN(' + firstRatioCell + ')>0, LEFT(' + firstRatioCell + ', FIND("/", ' + firstRatioCell + ')-1)+0 = RIGHT(' + firstRatioCell + ', LEN(' + firstRatioCell + ')-FIND("/", ' + firstRatioCell + '))+0, LEFT(' + firstRatioCell + ', FIND("/", ' + firstRatioCell + ')-1)+0 > 0)';

      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(formulaMatch)
        .setBackground("#d4edda")
        .setRanges(ratioRanges)
        .build());
    }

    sheet.setConditionalFormatRules(rules);
  }
}
