// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY COACHING DASHBOARD - Pass % and Week-over-Week Change by Group
// Standalone module — references shared constants from Phase2_ProgressTracking.gs
// ═══════════════════════════════════════════════════════════════════════════

const WEEKLY_DASHBOARD_SHEET = "Weekly Coaching Dashboard";

const WEEKLY_HEADERS = [
  "Week Of", "Group", "Lessons Taught",
  "Pass %", "Not Passed %", "Absent %",
  "Prior Week Pass %", "Change", "Students"
];

const WEEKLY_COL = {
  WEEK_OF: 0,
  GROUP: 1,
  LESSONS_TAUGHT: 2,
  PASS_PCT: 3,
  NOT_PASSED_PCT: 4,
  ABSENT_PCT: 5,
  PRIOR_PASS_PCT: 6,
  CHANGE: 7,
  STUDENTS: 8,
  TOTAL: 9
};

/**
 * Opens / navigates to the Weekly Coaching Dashboard sheet.
 * Called from menu: Coach Tools > Weekly Coaching Dashboard
 */
function openWeeklyDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  refreshWeeklyDashboard();
  const sheet = ss.getSheetByName(WEEKLY_DASHBOARD_SHEET);
  if (sheet) ss.setActiveSheet(sheet);
}

/**
 * Rebuilds the Weekly Coaching Dashboard from Small Group Progress data.
 * Can be called from menu or from a time-based trigger.
 */
function refreshWeeklyDashboard() {
  const functionName = "refreshWeeklyDashboard";
  log(functionName, "Building Weekly Coaching Dashboard...");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, WEEKLY_DASHBOARD_SHEET, true);

  // 1. Read all Small Group Progress data
  const sgpSheet = ss.getSheetByName(SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
  if (!sgpSheet || sgpSheet.getLastRow() < LAYOUT.DATA_START_ROW) {
    writeWeeklyEmptyState_(sheet);
    log(functionName, "No Small Group Progress data found.");
    return;
  }

  const allData = sgpSheet.getRange(
    LAYOUT.DATA_START_ROW, 1,
    sgpSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1,
    COLS.SMALL_GROUP_PROGRESS.TOTAL_COLS
  ).getValues();

  // 2. Get the full list of all groups from Grade Summary
  const allGroups = getAllGroupNamesForDashboard_(ss);

  // 3. Bucket submissions by week and group
  const weekBuckets = bucketByWeek_(allData);

  // 4. Get sorted week keys (most recent first)
  const weekKeys = Object.keys(weekBuckets).sort().reverse();

  if (weekKeys.length === 0) {
    writeWeeklyEmptyState_(sheet);
    return;
  }

  // 5. Build output rows — all groups per week, including those with no data
  const outputRows = buildWeeklyRows_(weekBuckets, weekKeys, allGroups);

  // 6. Write to sheet
  writeWeeklySheet_(sheet, outputRows, weekKeys);

  log(functionName, "Weekly Coaching Dashboard built: " + weekKeys.length + " weeks, " + outputRows.length + " rows.");
}

// ─────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns all unique group names from Pacing Dashboard and Small Group Progress.
 * Both sources use grade-sheet group names, ensuring consistency with SGP data.
 */
function getAllGroupNamesForDashboard_(ss) {
  var groups = [];
  var seen = {};

  // Primary: Pacing Dashboard (has all groups from grade sheets)
  var dashSheet = ss.getSheetByName(SHEET_NAMES_PACING.DASHBOARD);
  if (dashSheet && dashSheet.getLastRow() >= COLS.PACING_DASHBOARD.DATA_START_ROW) {
    var dashData = dashSheet.getRange(
      COLS.PACING_DASHBOARD.DATA_START_ROW, 1,
      dashSheet.getLastRow() - COLS.PACING_DASHBOARD.DATA_START_ROW + 1, 1
    ).getValues();

    for (var i = 0; i < dashData.length; i++) {
      var name = dashData[i][0] ? dashData[i][0].toString().trim() : "";
      if (name && !seen[name]) {
        groups.push(name);
        seen[name] = true;
      }
    }
  }

  // Also include any groups from Small Group Progress not already seen
  var sgpSheet = ss.getSheetByName(SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
  if (sgpSheet && sgpSheet.getLastRow() >= LAYOUT.DATA_START_ROW) {
    var sgpData = sgpSheet.getRange(
      LAYOUT.DATA_START_ROW, COLS.SMALL_GROUP_PROGRESS.GROUP + 1,
      sgpSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 1
    ).getValues();

    for (var j = 0; j < sgpData.length; j++) {
      var sgpName = sgpData[j][0] ? sgpData[j][0].toString().trim() : "";
      if (sgpName && !seen[sgpName]) {
        groups.push(sgpName);
        seen[sgpName] = true;
      }
    }
  }

  return groups.sort();
}

/**
 * Buckets Small Group Progress rows by ISO week and group.
 * Returns: { "2025-W05": { "KG Group 1": { Y: n, N: n, A: n, lessons: {}, students: {} } } }
 */
function bucketByWeek_(data) {
  const buckets = {};

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var dateVal = row[COLS.SMALL_GROUP_PROGRESS.DATE];
    var group = row[COLS.SMALL_GROUP_PROGRESS.GROUP] ? row[COLS.SMALL_GROUP_PROGRESS.GROUP].toString().trim() : "";
    var student = row[COLS.SMALL_GROUP_PROGRESS.STUDENT] ? row[COLS.SMALL_GROUP_PROGRESS.STUDENT].toString().trim() : "";
    var status = row[COLS.SMALL_GROUP_PROGRESS.STATUS] ? row[COLS.SMALL_GROUP_PROGRESS.STATUS].toString().trim().toUpperCase() : "";

    if (!dateVal || !group || !student || !status) continue;

    var d = new Date(dateVal);
    if (isNaN(d.getTime())) continue;

    var weekKey = getISOWeekKey_(d);

    if (!buckets[weekKey]) buckets[weekKey] = {};
    if (!buckets[weekKey][group]) {
      buckets[weekKey][group] = { Y: 0, N: 0, A: 0, lessons: {}, students: {} };
    }

    var bucket = buckets[weekKey][group];
    if (status === "Y") bucket.Y++;
    else if (status === "N") bucket.N++;
    else if (status === "A") bucket.A++;

    // Track unique lessons and students
    var lesson = row[COLS.SMALL_GROUP_PROGRESS.LESSON] ? row[COLS.SMALL_GROUP_PROGRESS.LESSON].toString().trim() : "";
    if (lesson) bucket.lessons[lesson] = true;
    bucket.students[student] = true;
  }

  return buckets;
}

/**
 * Returns ISO week key like "2025-W05" for a given date.
 */
function getISOWeekKey_(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + "-W" + (weekNo < 10 ? "0" : "") + weekNo;
}

/**
 * Returns the Monday date for a given ISO week key.
 */
function weekKeyToDate_(weekKey) {
  var parts = weekKey.split("-W");
  var year = parseInt(parts[0]);
  var week = parseInt(parts[1]);
  var jan4 = new Date(year, 0, 4);
  var dayOfWeek = jan4.getDay() || 7;
  var monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday;
}

/**
 * Builds output rows with week-over-week change calculations.
 * Shows ALL groups per week, not just those with data.
 */
function buildWeeklyRows_(weekBuckets, weekKeys, allGroups) {
  var rows = [];

  for (var w = 0; w < weekKeys.length; w++) {
    var weekKey = weekKeys[w];
    var weekDate = weekKeyToDate_(weekKey);
    var weekData = weekBuckets[weekKey] || {};
    var priorWeek = (w + 1 < weekKeys.length) ? weekKeys[w + 1] : null;

    for (var g = 0; g < allGroups.length; g++) {
      var groupName = allGroups[g];
      var bucket = weekData[groupName];

      var passRate = "";
      var notPassedRate = "";
      var absentRate = "";
      var lessonCount = 0;
      var studentCount = 0;

      if (bucket) {
        var total = bucket.Y + bucket.N + bucket.A;
        if (total > 0) {
          passRate = bucket.Y / total;
          notPassedRate = bucket.N / total;
          absentRate = bucket.A / total;
        }
        lessonCount = Object.keys(bucket.lessons).length;
        studentCount = Object.keys(bucket.students).length;
      }

      // Prior week pass rate for this group
      var priorPassRate = "";
      var change = "";
      if (priorWeek && weekBuckets[priorWeek] && weekBuckets[priorWeek][groupName]) {
        var priorBucket = weekBuckets[priorWeek][groupName];
        var priorTotal = priorBucket.Y + priorBucket.N + priorBucket.A;
        if (priorTotal > 0 && passRate !== "") {
          priorPassRate = priorBucket.Y / priorTotal;
          change = passRate - priorPassRate;
        }
      }

      rows.push([weekDate, groupName, lessonCount,
        passRate, notPassedRate, absentRate,
        priorPassRate, change, studentCount]);
    }
  }

  return rows;
}

/**
 * Writes headers, data, and formatting to the Weekly Dashboard sheet.
 */
function writeWeeklySheet_(sheet, rows, weekKeys) {
  var colCount = WEEKLY_HEADERS.length;

  // --- Title ---
  sheet.getRange(1, 1, 1, colCount).merge();
  sheet.getRange("A1")
    .setValue("Weekly Coaching Dashboard")
    .setFontWeight("bold")
    .setFontSize(14)
    .setFontFamily("Calibri")
    .setFontColor(DASHBOARD_COLORS.HEADER_TEXT)
    .setBackground(DASHBOARD_COLORS.HEADER_BG)
    .setHorizontalAlignment("center");

  // --- Subtitle ---
  sheet.getRange(2, 1, 1, colCount).merge();
  var subtitle = weekKeys.length + " weeks of data | Last refreshed: " +
    formatDateSafe(new Date(), "MM/dd/yyyy h:mm a");
  sheet.getRange("A2")
    .setValue(subtitle)
    .setFontSize(9)
    .setFontFamily("Calibri")
    .setFontStyle("italic")
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL)
    .setHorizontalAlignment("center");

  // --- Headers (row 3) ---
  var headerRange = sheet.getRange(3, 1, 1, colCount);
  headerRange.setValues([WEEKLY_HEADERS])
    .setFontWeight("bold")
    .setFontFamily("Calibri")
    .setFontSize(10)
    .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
    .setHorizontalAlignment("center");

  sheet.setFrozenRows(3);

  if (rows.length === 0) return;

  // --- Data (row 4+) ---
  var dataRange = sheet.getRange(4, 1, rows.length, colCount);
  dataRange.setValues(rows)
    .setFontFamily("Calibri")
    .setFontSize(10);

  // Date format for "Week Of" column
  sheet.getRange(4, 1, rows.length, 1).setNumberFormat("MM/dd/yyyy");

  // Center columns B onward
  sheet.getRange(4, 2, rows.length, colCount - 1).setHorizontalAlignment("center");

  // Percentage formats
  sheet.getRange(4, WEEKLY_COL.PASS_PCT + 1, rows.length, 3).setNumberFormat("0.0%");       // Pass, Not Passed, Absent
  sheet.getRange(4, WEEKLY_COL.PRIOR_PASS_PCT + 1, rows.length, 1).setNumberFormat("0.0%"); // Prior
  sheet.getRange(4, WEEKLY_COL.CHANGE + 1, rows.length, 1).setNumberFormat("+0.0%;-0.0%");  // Change with +/-

  // Column widths
  sheet.setColumnWidth(1, 100);  // Week Of
  sheet.setColumnWidth(2, 180);  // Group
  sheet.setColumnWidth(3, 110);  // Lessons Taught
  sheet.setColumnWidth(4, 80);   // Pass %
  sheet.setColumnWidth(5, 100);  // Not Passed %
  sheet.setColumnWidth(6, 80);   // Absent %
  sheet.setColumnWidth(7, 120);  // Prior Week Pass %
  sheet.setColumnWidth(8, 80);   // Change
  sheet.setColumnWidth(9, 80);   // Students

  // --- Conditional formatting ---
  applyChangeConditionalFormatting_(sheet, rows.length);

  // --- Week separator borders ---
  applyWeekSeparators_(sheet, rows);

  // --- Gray out groups with no data this week ---
  applyNoDataStyling_(sheet, rows);
}

/**
 * Applies green/red conditional formatting to the Change column and Pass %.
 */
function applyChangeConditionalFormatting_(sheet, rowCount) {
  var changeCol = WEEKLY_COL.CHANGE + 1;
  var range = sheet.getRange(4, changeCol, rowCount, 1);

  var rules = sheet.getConditionalFormatRules();

  // Positive change = green
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)
    .setBackground(DASHBOARD_COLORS.ON_TRACK_BG)
    .setFontColor(DASHBOARD_COLORS.ON_TRACK)
    .setRanges([range])
    .build());

  // Negative change = red
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0)
    .setBackground(DASHBOARD_COLORS.AT_RISK_BG)
    .setFontColor(DASHBOARD_COLORS.AT_RISK)
    .setRanges([range])
    .build());

  // Pass % column thresholds
  var passRange = sheet.getRange(4, WEEKLY_COL.PASS_PCT + 1, rowCount, 1);

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThanOrEqualTo(0.8)
    .setBackground(DASHBOARD_COLORS.ON_TRACK_BG)
    .setFontColor(DASHBOARD_COLORS.ON_TRACK)
    .setRanges([passRange])
    .build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(0.5, 0.7999)
    .setBackground(DASHBOARD_COLORS.PROGRESSING_BG)
    .setFontColor("#b45309")
    .setRanges([passRange])
    .build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0.5)
    .setBackground(DASHBOARD_COLORS.AT_RISK_BG)
    .setFontColor(DASHBOARD_COLORS.AT_RISK)
    .setRanges([passRange])
    .build());

  sheet.setConditionalFormatRules(rules);
}

/**
 * Adds a heavier bottom border between weeks for visual grouping.
 */
function applyWeekSeparators_(sheet, rows) {
  for (var i = 1; i < rows.length; i++) {
    var curDate = rows[i][WEEKLY_COL.WEEK_OF];
    var prevDate = rows[i - 1][WEEKLY_COL.WEEK_OF];
    if (curDate.getTime() !== prevDate.getTime()) {
      sheet.getRange(3 + i, 1, 1, WEEKLY_HEADERS.length)
        .setBorder(true, null, null, null, null, null, "#999999", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    }
  }
}

/**
 * Grays out rows for groups with no data (lessons = 0) in a given week.
 */
function applyNoDataStyling_(sheet, rows) {
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][WEEKLY_COL.LESSONS_TAUGHT] === 0) {
      sheet.getRange(4 + i, 1, 1, WEEKLY_HEADERS.length)
        .setFontColor("#999999");
    }
  }
}

/**
 * Writes an empty state message when no data is available.
 */
function writeWeeklyEmptyState_(sheet) {
  sheet.getRange(1, 1, 1, WEEKLY_HEADERS.length).merge();
  sheet.getRange("A1")
    .setValue("Weekly Coaching Dashboard")
    .setFontWeight("bold")
    .setFontSize(14)
    .setFontFamily("Calibri")
    .setFontColor(DASHBOARD_COLORS.HEADER_TEXT)
    .setBackground(DASHBOARD_COLORS.HEADER_BG)
    .setHorizontalAlignment("center");

  sheet.getRange("A3")
    .setValue("No lesson data found. Submit lessons through the form to see weekly trends.")
    .setFontStyle("italic")
    .setFontFamily("Calibri")
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
}
