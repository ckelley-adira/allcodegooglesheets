// ═══════════════════════════════════════════════════════════════════════════
// COACH VIEW - Filtered Student Data for Coaches & Leaders
// Standalone module — references shared constants from Phase2_ProgressTracking.gs
// ═══════════════════════════════════════════════════════════════════════════

const COACH_VIEW_SHEET = "Coach View";

const COACH_VIEW_COLS = {
  STUDENT: 0,
  GRADE: 1,
  GROUP: 2,
  TEACHER: 3,
  CURRENT_LESSON: 4,
  FOUNDATIONAL: 5,
  MIN_GRADE: 6,
  FULL_GRADE: 7,
  TOTAL: 8
};

const COACH_VIEW_HEADERS = [
  "Student Name", "Grade", "Group", "Teacher",
  "Current Lesson", "Foundational %", "Min Grade %", "Full Grade %"
];

/**
 * Opens the Coach View sheet, creating it if needed.
 * Called from menu: Adira Reads Progress Report > Coach Tools > Coach View
 */
function openCoachView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(COACH_VIEW_SHEET);

  if (!sheet) {
    buildCoachViewSheet_(ss);
    sheet = ss.getSheetByName(COACH_VIEW_SHEET);
  }

  ss.setActiveSheet(sheet);
  SpreadsheetApp.flush();
}

/**
 * Refreshes Coach View data based on the selected group filter.
 * Called from menu or via onEdit when the dropdown changes.
 */
function refreshCoachView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(COACH_VIEW_SHEET);

  if (!sheet) {
    buildCoachViewSheet_(ss);
    sheet = ss.getSheetByName(COACH_VIEW_SHEET);
  }

  // Refresh dropdown with current groups
  const selectedGroup = sheet.getRange("B1").getValue().toString().trim();
  updateGroupDropdown_(ss, sheet, selectedGroup);

  writeCoachViewData_(ss, sheet, selectedGroup);
}

/**
 * Builds the Coach View sheet from scratch with dropdown and headers.
 */
function buildCoachViewSheet_(ss) {
  const sheet = getOrCreateSheet(ss, COACH_VIEW_SHEET, true);

  // --- Filter row ---
  sheet.getRange("A1").setValue("Filter by Group:")
    .setFontWeight("bold")
    .setFontFamily("Calibri")
    .setFontSize(11)
    .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG);

  // Populate dropdown with all group names
  const groups = getAllGroupNames_(ss);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["All Groups"].concat(groups), true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange("B1")
    .setDataValidation(rule)
    .setValue("All Groups")
    .setFontFamily("Calibri")
    .setFontSize(11)
    .setBackground("#ffffff");

  sheet.getRange("C1").setValue("← Select a group — view updates automatically")
    .setFontStyle("italic")
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL)
    .setFontFamily("Calibri")
    .setFontSize(10);

  // --- Spacer ---
  sheet.getRange("A2:H2").setBackground("#ffffff");

  // --- Headers (row 3) ---
  const headerRange = sheet.getRange(3, 1, 1, COACH_VIEW_HEADERS.length);
  headerRange.setValues([COACH_VIEW_HEADERS])
    .setFontWeight("bold")
    .setFontFamily("Calibri")
    .setFontSize(10)
    .setBackground(DASHBOARD_COLORS.HEADER_BG)
    .setFontColor(DASHBOARD_COLORS.HEADER_TEXT)
    .setHorizontalAlignment("center");

  // Column widths
  sheet.setColumnWidth(1, 180); // Student Name
  sheet.setColumnWidth(2, 80);  // Grade
  sheet.setColumnWidth(3, 160); // Group
  sheet.setColumnWidth(4, 140); // Teacher
  sheet.setColumnWidth(5, 120); // Current Lesson
  sheet.setColumnWidth(6, 120); // Foundational %
  sheet.setColumnWidth(7, 110); // Min Grade %
  sheet.setColumnWidth(8, 110); // Full Grade %

  sheet.setFrozenRows(3);

  // Load all data initially
  writeCoachViewData_(ss, sheet, "All Groups");

  // Protect structure (coaches can use dropdown but not edit data)
  protectCoachView_(sheet);
}

/**
 * Writes filtered student data to the Coach View sheet.
 */
function writeCoachViewData_(ss, sheet, selectedGroup) {
  const dataStartRow = 4;

  // Clear old data and stale status count
  const lastRow = sheet.getLastRow();
  if (lastRow >= dataStartRow) {
    sheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, COACH_VIEW_HEADERS.length).clear();
  }
  sheet.getRange("E1").clear();

  // Gather data from Grade Summary and UFLI MAP
  const gradeSummary = getSheetDataAsMap(ss, SHEET_NAMES_V2.GRADE_SUMMARY);
  const ufliMap = getSheetDataAsMap(ss, SHEET_NAMES_V2.UFLI_MAP);

  if (gradeSummary.size === 0) {
    sheet.getRange(dataStartRow, 1).setValue("No student data found. Run 'Recalculate All Stats Now' first.")
      .setFontStyle("italic")
      .setFontColor(DASHBOARD_COLORS.AT_RISK);
    return;
  }

  // Build rows
  const rows = [];
  gradeSummary.forEach(function(gsRow, studentName) {
    const group = gsRow[COLS.GRADE_SUMMARY.GROUP] ? gsRow[COLS.GRADE_SUMMARY.GROUP].toString().trim() : "";
    const grade = gsRow[COLS.GRADE_SUMMARY.GRADE] ? gsRow[COLS.GRADE_SUMMARY.GRADE].toString().trim() : "";
    const teacher = gsRow[COLS.GRADE_SUMMARY.TEACHER] ? gsRow[COLS.GRADE_SUMMARY.TEACHER].toString().trim() : "";

    // Filter
    if (selectedGroup && selectedGroup !== "All Groups" && group !== selectedGroup) return;

    // Get current lesson from UFLI MAP
    let currentLesson = "";
    if (ufliMap.has(studentName)) {
      const mapRow = ufliMap.get(studentName);
      currentLesson = mapRow[LAYOUT.COL_CURRENT_LESSON - 1] || ""; // COL_CURRENT_LESSON is 1-based
    }

    // Skill percentages from Grade Summary
    const foundational = gsRow[COLS.GRADE_SUMMARY.FOUNDATIONAL] || 0;
    const minGrade = gsRow[COLS.GRADE_SUMMARY.MIN_GRADE] || 0;
    const fullGrade = gsRow[COLS.GRADE_SUMMARY.FULL_GRADE] || 0;

    rows.push([studentName, grade, group, teacher, currentLesson, foundational, minGrade, fullGrade]);
  });

  if (rows.length === 0) {
    sheet.getRange(dataStartRow, 1).setValue("No students found for the selected group.")
      .setFontStyle("italic")
      .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
    return;
  }

  // Sort by group, then student name
  rows.sort(function(a, b) {
    if (a[COACH_VIEW_COLS.GROUP] !== b[COACH_VIEW_COLS.GROUP]) {
      return a[COACH_VIEW_COLS.GROUP].localeCompare(b[COACH_VIEW_COLS.GROUP]);
    }
    return a[COACH_VIEW_COLS.STUDENT].localeCompare(b[COACH_VIEW_COLS.STUDENT]);
  });

  // Write data
  const dataRange = sheet.getRange(dataStartRow, 1, rows.length, COACH_VIEW_HEADERS.length);
  dataRange.setValues(rows)
    .setFontFamily("Calibri")
    .setFontSize(10);

  // Format percentage columns (F, G, H) — values are whole numbers, not decimals
  if (rows.length > 0) {
    sheet.getRange(dataStartRow, 6, rows.length, 3).setNumberFormat('0"%"');
  }

  // Alternating row colors
  for (var i = 0; i < rows.length; i++) {
    if (i % 2 === 1) {
      sheet.getRange(dataStartRow + i, 1, 1, COACH_VIEW_HEADERS.length)
        .setBackground(DASHBOARD_COLORS.TABLE_ALT_ROW);
    }
  }

  // Center-align non-name columns
  if (rows.length > 0) {
    sheet.getRange(dataStartRow, 2, rows.length, COACH_VIEW_HEADERS.length - 1)
      .setHorizontalAlignment("center");
  }

  // Status line
  sheet.getRange("E1").setValue(rows.length + " students")
    .setFontFamily("Calibri")
    .setFontSize(10)
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
}

/**
 * Updates the B1 dropdown with current group names, preserving selection.
 */
function updateGroupDropdown_(ss, sheet, currentSelection) {
  var groups = getAllGroupNames_(ss);
  var options = ["All Groups"].concat(groups);

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange("B1").setDataValidation(rule);

  // Preserve selection if still valid, otherwise default to All Groups
  if (currentSelection && options.indexOf(currentSelection) >= 0) {
    sheet.getRange("B1").setValue(currentSelection);
  } else {
    sheet.getRange("B1").setValue("All Groups");
  }
}

/**
 * Returns all group names from Grade Summary — the same data source
 * that writeCoachViewData_ filters against, so names always match.
 */
function getAllGroupNames_(ss) {
  var groups = [];
  var seen = {};

  var gsSheet = ss.getSheetByName(SHEET_NAMES_V2.GRADE_SUMMARY);
  if (gsSheet && gsSheet.getLastRow() >= LAYOUT.DATA_START_ROW) {
    var gsData = gsSheet.getRange(
      LAYOUT.DATA_START_ROW, COLS.GRADE_SUMMARY.GROUP + 1,
      gsSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 1
    ).getValues();

    for (var i = 0; i < gsData.length; i++) {
      var name = gsData[i][0] ? gsData[i][0].toString().trim() : "";
      if (name && !seen[name]) {
        groups.push(name);
        seen[name] = true;
      }
    }
  }

  return groups.sort();
}

/**
 * Protects the Coach View sheet so coaches can only change the filter dropdown.
 */
function protectCoachView_(sheet) {
  // Remove any existing protections on this sheet
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  for (var i = 0; i < protections.length; i++) {
    protections[i].remove();
  }

  var protection = sheet.protect().setDescription("Coach View - Read Only (filter dropdown editable)");
  // Allow editing only B1 (the dropdown)
  protection.setUnprotectedRanges([sheet.getRange("B1")]);
  protection.setWarningOnly(true); // Warning-based so no editor management needed
}

// ─────────────────────────────────────────────────────────────────────────
// AUTO-REFRESH VIA INSTALLABLE onEdit TRIGGER
// ─────────────────────────────────────────────────────────────────────────

/**
 * Installable onEdit handler — runs as the spreadsheet owner so it works
 * for viewers who can't access the menu. Fires when any cell is edited;
 * we filter to only act when Coach View B1 changes.
 *
 * To install, run setupCoachViewTrigger() once from the script editor
 * or from the menu (Coach Tools > Enable Coach View Auto-Refresh).
 */
function onCoachViewEdit(e) {
  try {
    if (!e || !e.range) return;

    var sheet = e.range.getSheet();
    if (sheet.getName() !== COACH_VIEW_SHEET) return;

    // Only react to B1 (the group dropdown)
    if (e.range.getRow() !== 1 || e.range.getColumn() !== 2) return;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var selectedGroup = e.range.getValue().toString().trim();
    writeCoachViewData_(ss, sheet, selectedGroup);
  } catch (err) {
    // Silently fail for viewers — don't show error dialogs
    Logger.log("CoachView onEdit error: " + err.message);
  }
}

/**
 * Creates the installable onEdit trigger for Coach View auto-refresh.
 * Run once by the spreadsheet owner (from menu or script editor).
 */
function setupCoachViewTrigger() {
  // Remove any existing Coach View triggers to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onCoachViewEdit") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create new installable onEdit trigger
  ScriptApp.newTrigger("onCoachViewEdit")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert(
    "Coach View Auto-Refresh Enabled",
    "The Coach View will now update automatically when the group dropdown is changed — even for viewers.",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
