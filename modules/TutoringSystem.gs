// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL PREP - TUTORING TRACKING SYSTEM
// Dual-Track Progress: Whole Group UFLI vs. Tutoring Interventions
// ═══════════════════════════════════════════════════════════════════════════
// Version: 4.0 - MODULAR ARCHITECTURE (PHASE 4)
// Last Updated: February 2026
//
// FEATURE FLAG: SITE_CONFIG.features.tutoringSystem
// This module is only activated when the feature flag is set to true.
//
// PURPOSE:
// Students receive instruction in BOTH whole-group UFLI lessons AND smaller
// tutoring groups (reteach, comprehension, intervention). This module keeps
// those two tracks separate.
//
// USAGE:
// Enable in SiteConfig_TEMPLATE.gs: features.tutoringSystem = true
//
// CHANGES v4.0:
// - Converted to modular architecture with feature flag support
// - Added safeSetNumberFormat() helper to prevent "Typed Column" crashes
// - Wrapped all formatting calls in try/catch blocks
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - TUTORING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

const SHEET_NAMES_TUTORING = {
  PROGRESS_LOG: "Tutoring Progress Log",
  SUMMARY: "Tutoring Summary"
};

const TUTORING_LAYOUT = {
  DATA_START_ROW: 6,
  HEADER_ROW: 5,
  
  // Tutoring Progress Log columns
  LOG_COL_DATE: 1,
  LOG_COL_TEACHER: 2,
  LOG_COL_GROUP: 3,
  LOG_COL_STUDENT: 4,
  LOG_COL_LESSON_TYPE: 5,  // "UFLI Reteach", "Comprehension", etc.
  LOG_COL_LESSON_DETAIL: 6, // Specific lesson (e.g., "L42 reteach")
  LOG_COL_STATUS: 7,
  
  // Tutoring Summary columns
  SUM_COL_STUDENT: 1,
  SUM_COL_GRADE: 2,
  SUM_COL_PRIMARY_GROUP: 3,
  SUM_COL_TUTORING_GROUPS: 4,
  SUM_COL_TOTAL_SESSIONS: 5,
  SUM_COL_UFLI_RETEACH_COUNT: 6,
  SUM_COL_UFLI_RETEACH_PASS: 7,
  SUM_COL_COMPREHENSION_COUNT: 8,
  SUM_COL_COMPREHENSION_PASS: 9,
  SUM_COL_OTHER_COUNT: 10,
  SUM_COL_OTHER_PASS: 11,
  SUM_COL_OVERALL_PASS_RATE: 12,
  SUM_COL_LAST_SESSION: 13
};

const TUTORING_COLORS = {
  HEADER_BG: "#6a1b9a",      // Purple for tutoring distinction
  HEADER_FG: "#ffffff",
  TITLE_BG: "#e1bee7",       // Light purple
  TITLE_FG: "#000000",
  RETEACH_BG: "#fff3e0",     // Light orange for reteach
  COMPREHENSION_BG: "#e3f2fd", // Light blue for comprehension
  Y: "#c8e6c9",              // Light green
  N: "#ffcdd2",              // Light red
  A: "#fff9c4"               // Light yellow
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Safely sets number format, ignoring errors from typed columns
 * This prevents the "You can't set the number format..." crash.
 */
function safeSetNumberFormat(sheet, row, col, numRows, format) {
  try {
    sheet.getRange(row, col, numRows, 1).setNumberFormat(format);
  } catch (e) {
    Logger.log(`safeSetNumberFormat skipped formatting for Col ${col}: Likely Typed Column`);
  }
}

/**
 * Determines if a group is a tutoring group based on its name
 * @param {string} groupName - Name of the group
 * @returns {boolean} True if this is a tutoring group
 */
function isTutoringGroup(groupName) {
  if (!groupName) return false;
  return groupName.toString().toLowerCase().includes("tutoring");
}

/**
 * Categorizes a lesson for tutoring tracking
 * @param {string} lessonName - The lesson name (e.g., "UFLI L42 reteach", "Comprehension")
 * @returns {Object} {type: "UFLI Reteach"|"Comprehension"|"Other", lessonNum: number|null}
 */
function categorizeTutoringLesson(lessonName) {
  if (!lessonName) return { type: "Other", lessonNum: null };
  
  const lessonStr = lessonName.toString().toLowerCase().trim();
  
  // Check for Comprehension
  if (lessonStr.includes("comprehension")) {
    return { type: "Comprehension", lessonNum: null };
  }
  
  // Check for UFLI lesson (with or without "reteach")
  const ufliMatch = lessonStr.match(/(?:ufli\s*)?l\s*(\d+)/i);
  if (ufliMatch) {
    const lessonNum = parseInt(ufliMatch[1], 10);
    const isReteach = lessonStr.includes("reteach");
    return { 
      type: isReteach ? "UFLI Reteach" : "UFLI New", 
      lessonNum: lessonNum 
    };
  }
  
  return { type: "Other", lessonNum: null };
}

/**
 * Gets the primary (non-tutoring) group for a student
 * @param {string} studentName - Student name
 * @returns {string} Primary group name or empty string
 */
function getPrimaryGroupForStudent(studentName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterSheet = ss.getSheetByName(SHEET_NAMES.STUDENT_ROSTER);
  
  if (!rosterSheet) return "";
  
  const data = rosterSheet.getDataRange().getValues();
  for (let i = LAYOUT.DATA_START_ROW - 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim() === studentName) {
      return data[i][3] ? data[i][3].toString() : "";
    }
  }
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEET CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates all tutoring system sheets
 * Call this from your setup wizard or run manually
 */
function createTutoringSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  createTutoringProgressLogSheet(ss);
  createTutoringSummarySheet(ss);
  
  Logger.log("Tutoring sheets created successfully.");
}

/**
 * Creates the Tutoring Progress Log sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 */
function createTutoringProgressLogSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAMES_TUTORING.PROGRESS_LOG);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES_TUTORING.PROGRESS_LOG);
  } else {
    sheet.clear();
    sheet.clearConditionalFormatRules();
  }
  
  // Title row
  sheet.getRange(1, 1, 1, 7).merge()
    .setValue("TUTORING PROGRESS LOG")
    .setBackground(TUTORING_COLORS.TITLE_BG)
    .setFontColor(TUTORING_COLORS.TITLE_FG)
    .setFontWeight("bold")
    .setFontSize(14)
    .setFontFamily("Calibri");
  
  // Subtitle
  sheet.getRange(2, 1, 1, 7).merge()
    .setValue("Tracks all tutoring/intervention sessions separately from whole-group UFLI instruction")
    .setFontFamily("Calibri")
    .setFontSize(10)
    .setFontStyle("italic");
  
  // Headers
  const headers = ["Date", "Teacher", "Tutoring Group", "Student Name", "Lesson Type", "Lesson Detail", "Status"];
  sheet.getRange(TUTORING_LAYOUT.HEADER_ROW, 1, 1, headers.length)
    .setValues([headers])
    .setBackground(TUTORING_COLORS.HEADER_BG)
    .setFontColor(TUTORING_COLORS.HEADER_FG)
    .setFontWeight("bold")
    .setFontFamily("Calibri");
  
  // Column widths
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 200);
  sheet.setColumnWidth(4, 180);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 150);
  sheet.setColumnWidth(7, 70);
  
  sheet.setFrozenRows(TUTORING_LAYOUT.HEADER_ROW);
}

/**
 * Creates the Tutoring Summary sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 */
function createTutoringSummarySheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let sheet = ss.getSheetByName(SHEET_NAMES_TUTORING.SUMMARY);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES_TUTORING.SUMMARY);
  } else {
    sheet.clear();
    sheet.clearConditionalFormatRules();
  }
  
  // Title row
  sheet.getRange(1, 1, 1, 13).merge()
    .setValue("TUTORING SUMMARY - INTERVENTION TRACKING")
    .setBackground(TUTORING_COLORS.TITLE_BG)
    .setFontColor(TUTORING_COLORS.TITLE_FG)
    .setFontWeight("bold")
    .setFontSize(14)
    .setFontFamily("Calibri");
  
  // Subtitle
  sheet.getRange(2, 1, 1, 13).merge()
    .setValue("Aggregated view of tutoring interventions by student (updates automatically when you sync)")
    .setFontFamily("Calibri")
    .setFontSize(10)
    .setFontStyle("italic");
  
  // Headers
  const headers = [
    "Student Name", 
    "Grade", 
    "Primary Group",
    "Tutoring Group(s)",
    "Total Sessions",
    "UFLI Reteach #",
    "Reteach Pass %",
    "Comprehension #",
    "Comp. Pass %",
    "Other #",
    "Other Pass %",
    "Overall Pass %",
    "Last Session"
  ];
  
  sheet.getRange(TUTORING_LAYOUT.HEADER_ROW, 1, 1, headers.length)
    .setValues([headers])
    .setBackground(TUTORING_COLORS.HEADER_BG)
    .setFontColor(TUTORING_COLORS.HEADER_FG)
    .setFontWeight("bold")
    .setFontFamily("Calibri")
    .setWrap(true);
  
  // Column widths
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 60);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 200);
  sheet.setColumnWidth(5, 90);
  sheet.setColumnWidth(6, 100);
  sheet.setColumnWidth(7, 100);
  sheet.setColumnWidth(8, 110);
  sheet.setColumnWidth(9, 100);
  sheet.setColumnWidth(10, 80);
  sheet.setColumnWidth(11, 90);
  sheet.setColumnWidth(12, 100);
  sheet.setColumnWidth(13, 100);
  
  sheet.setFrozenRows(TUTORING_LAYOUT.HEADER_ROW);
  sheet.setRowHeight(TUTORING_LAYOUT.HEADER_ROW, 40);
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE FUNCTION - REPLACEMENT FOR saveLessonData()
// ═══════════════════════════════════════════════════════════════════════════

/**
 * MASTER SAVE FUNCTION - Routes to appropriate tracking system
 * REPLACES the existing saveLessonData() in GPSetUpWizard.gs
 * * @param {Object} formObject - {groupName, lessonName, teacherName, studentStatuses}
 * @returns {Object} - {success: boolean, message: string}
 */
function saveLessonData(formObject) {
  const { groupName, lessonName, teacherName, studentStatuses } = formObject;
  const grade = groupName.split(' ')[0];
  
  try {
    // ═══════════════════════════════════════════════════════════════
    // ROUTE 1: PRE-K (Direct to Pre-K Data matrix)
    // ═══════════════════════════════════════════════════════════════
    if (grade === "PreK") {
      return savePreKData(formObject);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ROUTE 2: TUTORING GROUPS (To Tutoring Progress Log)
    // ═══════════════════════════════════════════════════════════════
    if (isTutoringGroup(groupName)) {
      return saveTutoringData(formObject);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ROUTE 3: STANDARD UFLI (To Small Group Progress → UFLI MAP)
    // ═══════════════════════════════════════════════════════════════
    return saveStandardUFLIData(formObject);
    
  } catch (error) {
    Logger.log("saveLessonData Error: " + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Saves Pre-K data directly to the Pre-K Data matrix
 * @param {Object} formObject
 * @returns {Object}
 */
function savePreKData(formObject) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const { groupName, lessonName, studentStatuses } = formObject;
  
  const sheet = ss.getSheetByName(SHEET_NAMES_PREK.DATA);
  if (!sheet) throw new Error(`Sheet '${SHEET_NAMES_PREK.DATA}' not found.`);
  
  const data = sheet.getDataRange().getValues();
  const headers = data[PREK_CONFIG.HEADER_ROW - 1];
  
  const colIndex = headers.indexOf(lessonName);
  if (colIndex === -1) throw new Error(`Column '${lessonName}' not found in Pre-K Data.`);
  
  studentStatuses.forEach(entry => {
    for (let i = PREK_CONFIG.DATA_START_ROW - 1; i < data.length; i++) {
      if (data[i][0] === entry.name) {
        sheet.getRange(i + 1, colIndex + 1).setValue(entry.status);
        break;
      }
    }
  });
  
  return { success: true, message: "Pre-K Data Saved Successfully!" };
}

/**
 * Saves tutoring data to BOTH systems:
 * 1. Small Group Progress → syncs to UFLI MAP (master progress)
 * 2. Tutoring Progress Log → syncs to Tutoring Summary (intervention tracking)
 * * @param {Object} formObject - {groupName, lessonName, teacherName, studentStatuses}
 * @returns {Object} - {success: boolean, message: string}
 */
function saveTutoringData(formObject) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const { groupName, lessonName, teacherName, studentStatuses } = formObject;
  
  const timestamp = new Date();
  const lessonInfo = categorizeTutoringLesson(lessonName);
  
  // ═══════════════════════════════════════════════════════════════
  // PART 1: Write to Small Group Progress (feeds UFLI MAP)
  // ═══════════════════════════════════════════════════════════════
  const progressSheet = ss.getSheetByName(SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
  if (progressSheet) {
    const progressRows = studentStatuses.map(s => [
      timestamp,
      teacherName,
      groupName,
      s.name,
      lessonName,
      s.status
    ]);
    
    if (progressRows.length > 0) {
      const startRow = progressSheet.getLastRow() + 1;
      progressSheet.getRange(startRow, 1, progressRows.length, 6).setValues(progressRows);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PART 2: Write to Tutoring Progress Log (intervention tracking)
  // ═══════════════════════════════════════════════════════════════
  let logSheet = ss.getSheetByName(SHEET_NAMES_TUTORING.PROGRESS_LOG);
  if (!logSheet) {
    createTutoringSheets();
    logSheet = ss.getSheetByName(SHEET_NAMES_TUTORING.PROGRESS_LOG);
  }
  
  const tutoringRows = studentStatuses.map(s => [
    timestamp,
    teacherName,
    groupName,
    s.name,
    lessonInfo.type,           // "UFLI Reteach", "Comprehension", "Other"
    lessonName,                // Full lesson detail
    s.status
  ]);
  
  if (tutoringRows.length > 0) {
    const startRow = logSheet.getLastRow() + 1;
    logSheet.getRange(startRow, 1, tutoringRows.length, 7).setValues(tutoringRows);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PART 3: Sync to update UFLI MAP and all related sheets
  // ═══════════════════════════════════════════════════════════════
  syncSmallGroupProgress();
  
  Logger.log(`Saved ${studentStatuses.length} tutoring entries for group: ${groupName} (UFLI MAP + Tutoring Log)`);
  
  return { 
    success: true, 
    message: `Tutoring data saved! ${studentStatuses.length} student(s) recorded for ${lessonName}. Updated UFLI MAP and Tutoring Log.`
  };
}

/**
 * Saves standard UFLI data to Small Group Progress and syncs
 * @param {Object} formObject
 * @returns {Object}
 */
function saveStandardUFLIData(formObject) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const { groupName, lessonName, teacherName, studentStatuses } = formObject;
  
  const progressSheet = ss.getSheetByName(SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
  if (!progressSheet) throw new Error("Small Group Progress sheet not found.");
  
  const timestamp = new Date();
  
  const newRows = studentStatuses.map(s => [
    timestamp,
    teacherName,
    groupName,
    s.name,
    lessonName,
    s.status
  ]);
  
  if (newRows.length > 0) {
    const startRow = progressSheet.getLastRow() + 1;
    progressSheet.getRange(startRow, 1, newRows.length, 6).setValues(newRows);
  }
  
  // Sync to update UFLI MAP and group sheets
  syncSmallGroupProgress();
  
  return { 
    success: true, 
    message: `UFLI lesson data saved and synced! ${newRows.length} student(s) recorded.`
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Navigates to the Tutoring Summary sheet
 */
function goToTutoringSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES_TUTORING.SUMMARY);

  if (sheet) {
    ss.setActiveSheet(sheet);
  } else {
    SpreadsheetApp.getUi().alert('Tutoring Summary sheet not found. Run "Sync Tutoring Data" first to create it.');
  }
}

/**
 * Navigates to the Tutoring Progress Log sheet
 */
function goToTutoringLog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES_TUTORING.PROGRESS_LOG);

  if (sheet) {
    ss.setActiveSheet(sheet);
  } else {
    SpreadsheetApp.getUi().alert('Tutoring Progress Log sheet not found. Run "Sync Tutoring Data" first to create it.');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC TUTORING DATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Syncs Tutoring Progress Log to Tutoring Summary
 * Aggregates all tutoring sessions per student
 */
function syncTutoringProgress() {
  const functionName = 'syncTutoringProgress';
  Logger.log(`[${functionName}] Starting tutoring sync...`);
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    let logSheet = ss.getSheetByName(SHEET_NAMES_TUTORING.PROGRESS_LOG);
    let summarySheet = ss.getSheetByName(SHEET_NAMES_TUTORING.SUMMARY);
    
    if (!logSheet || !summarySheet) {
      Logger.log(`[${functionName}] Tutoring sheets not found. Skipping tutoring sync.`);
      return;
    }
    
    // Read all tutoring log data
    const lastRow = logSheet.getLastRow();
    if (lastRow < TUTORING_LAYOUT.DATA_START_ROW) {
      Logger.log(`[${functionName}] No tutoring data to sync.`);
      return;
    }
    
    const logData = logSheet.getRange(
      TUTORING_LAYOUT.DATA_START_ROW, 1, 
      lastRow - TUTORING_LAYOUT.DATA_START_ROW + 1, 7
    ).getValues();
    
    // Aggregate by student
    const studentStats = {};
    
    logData.forEach(row => {
      const [date, teacher, group, studentName, lessonType, lessonDetail, status] = row;
      
      if (!studentName) return;
      
      const key = studentName.toString().trim();
      
      if (!studentStats[key]) {
        studentStats[key] = {
          name: key,
          tutoringGroups: new Set(),
          totalSessions: 0,
          ufliReteach: { count: 0, pass: 0 },
          comprehension: { count: 0, pass: 0 },
          other: { count: 0, pass: 0 },
          lastSession: null
        };
      }
      
      const stats = studentStats[key];
      stats.tutoringGroups.add(group);
      stats.totalSessions++;
      
      // Track by lesson type
      const statusUpper = status ? status.toString().toUpperCase() : "";
      const isPass = statusUpper === "Y";
      const isAttempt = statusUpper === "Y" || statusUpper === "N";
      
      if (lessonType === "UFLI Reteach" || lessonType === "UFLI New") {
        if (isAttempt) stats.ufliReteach.count++;
        if (isPass) stats.ufliReteach.pass++;
      } else if (lessonType === "Comprehension") {
        if (isAttempt) stats.comprehension.count++;
        if (isPass) stats.comprehension.pass++;
      } else {
        if (isAttempt) stats.other.count++;
        if (isPass) stats.other.pass++;
      }
      
      // Track most recent session
      const sessionDate = new Date(date);
      if (!isNaN(sessionDate) && (!stats.lastSession || sessionDate > stats.lastSession)) {
        stats.lastSession = sessionDate;
      }
    });
    
    // Get student grade and primary group info from roster
    const rosterSheet = ss.getSheetByName(SHEET_NAMES.STUDENT_ROSTER);
    const rosterData = rosterSheet ? rosterSheet.getDataRange().getValues() : [];
    const rosterMap = {};
    
    for (let i = LAYOUT.DATA_START_ROW - 1; i < rosterData.length; i++) {
      const name = rosterData[i][0] ? rosterData[i][0].toString().trim() : "";
      if (name) {
        rosterMap[name] = {
          grade: rosterData[i][1] || "",
          primaryGroup: rosterData[i][3] || ""
        };
      }
    }
    
    // Build output rows
    const outputRows = Object.values(studentStats).map(stats => {
      const rosterInfo = rosterMap[stats.name] || { grade: "", primaryGroup: "" };
      
      const totalAttempts = stats.ufliReteach.count + stats.comprehension.count + stats.other.count;
      const totalPass = stats.ufliReteach.pass + stats.comprehension.pass + stats.other.pass;
      
      return [
        stats.name,
        rosterInfo.grade,
        rosterInfo.primaryGroup,
        Array.from(stats.tutoringGroups).join(", "),
        stats.totalSessions,
        stats.ufliReteach.count,
        stats.ufliReteach.count > 0 ? stats.ufliReteach.pass / stats.ufliReteach.count : "",
        stats.comprehension.count,
        stats.comprehension.count > 0 ? stats.comprehension.pass / stats.comprehension.count : "",
        stats.other.count,
        stats.other.count > 0 ? stats.other.pass / stats.other.count : "",
        totalAttempts > 0 ? totalPass / totalAttempts : "",
        stats.lastSession
      ];
    });
    
    // Sort by grade then name
    outputRows.sort((a, b) => {
      const gradeCompare = (a[1] || "").localeCompare(b[1] || "");
      if (gradeCompare !== 0) return gradeCompare;
      return (a[0] || "").localeCompare(b[0] || "");
    });
    
    // Write to summary sheet
    if (outputRows.length > 0) {
      // Clear existing data
      const lastSummaryRow = summarySheet.getLastRow();
      if (lastSummaryRow >= TUTORING_LAYOUT.DATA_START_ROW) {
        summarySheet.getRange(
          TUTORING_LAYOUT.DATA_START_ROW, 1, 
          lastSummaryRow - TUTORING_LAYOUT.DATA_START_ROW + 1, 13
        ).clearContent();
      }
      
      // Write new data
      summarySheet.getRange(
        TUTORING_LAYOUT.DATA_START_ROW, 1, 
        outputRows.length, outputRows[0].length
      ).setValues(outputRows);
      
      // --- SAFE FORMATTING FOR SUMMARY SHEET ---
      // Formats pass rate columns as % (Cols 7, 9, 11, 12)
      // Wrapped in safeSetNumberFormat to avoid crashes
      const numRows = outputRows.length;
      safeSetNumberFormat(summarySheet, TUTORING_LAYOUT.DATA_START_ROW, 7, numRows, "0%");
      safeSetNumberFormat(summarySheet, TUTORING_LAYOUT.DATA_START_ROW, 9, numRows, "0%");
      safeSetNumberFormat(summarySheet, TUTORING_LAYOUT.DATA_START_ROW, 11, numRows, "0%");
      safeSetNumberFormat(summarySheet, TUTORING_LAYOUT.DATA_START_ROW, 12, numRows, "0%");
    }
    
    Logger.log(`[${functionName}] Synced ${outputRows.length} students to Tutoring Summary.`);
    
  } catch (e) {
    Logger.log(`[${functionName}] Error (non-fatal): ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED SYNC - UPDATES BOTH SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Master sync function - updates both UFLI and Tutoring systems
 * Call this from the menu or after data entry
 */
function syncAllProgress() {
  const functionName = 'syncAllProgress';
  Logger.log(`[${functionName}] Starting full sync...`);
  
  // Sync standard UFLI progress
  syncSmallGroupProgress();
  
  // Sync tutoring progress (wrapped to prevent blocking)
  try {
    syncTutoringProgress();
  } catch (e) {
    Logger.log(`[${functionName}] Tutoring sync error (non-fatal): ${e.message}`);
  }
  
  Logger.log(`[${functionName}] Full sync complete.`);
  
  SpreadsheetApp.getUi().alert(
    'Sync Complete', 
    'Both UFLI and Tutoring progress data have been synced.', 
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTING - COMBINED STUDENT VIEW
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generates a combined report showing both UFLI and Tutoring progress
 * for a specific student or all students
 * * @param {string} studentName - Optional: specific student (null for all)
 * @returns {Object} Report data
 */
function getStudentCombinedProgress(studentName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get UFLI data from Grade Summary
  const summarySheet = ss.getSheetByName(SHEET_NAMES_V2.GRADE_SUMMARY);
  const summaryData = summarySheet ? summarySheet.getDataRange().getValues() : [];
  
  // Get Tutoring data from Tutoring Summary
  const tutoringSheet = ss.getSheetByName(SHEET_NAMES_TUTORING.SUMMARY);
  const tutoringData = tutoringSheet ? tutoringSheet.getDataRange().getValues() : [];
  
  // Build lookup maps
  const ufliMap = {};
  for (let i = LAYOUT.DATA_START_ROW - 1; i < summaryData.length; i++) {
    const name = summaryData[i][0];
    if (name) {
      ufliMap[name] = {
        grade: summaryData[i][1],
        group: summaryData[i][3],
        foundational: summaryData[i][4],
        minGrade: summaryData[i][5],
        fullGrade: summaryData[i][6],
        benchmark: summaryData[i][7]
      };
    }
  }
  
  const tutoringMap = {};
  for (let i = TUTORING_LAYOUT.DATA_START_ROW - 1; i < tutoringData.length; i++) {
    const name = tutoringData[i][0];
    if (name) {
      tutoringMap[name] = {
        tutoringGroups: tutoringData[i][3],
        totalSessions: tutoringData[i][4],
        reteachCount: tutoringData[i][5],
        reteachPassRate: tutoringData[i][6],
        comprehensionCount: tutoringData[i][7],
        comprehensionPassRate: tutoringData[i][8],
        overallPassRate: tutoringData[i][11],
        lastSession: tutoringData[i][12]
      };
    }
  }
  
  // Combine data
  const allStudents = new Set([...Object.keys(ufliMap), ...Object.keys(tutoringMap)]);
  const combinedData = [];
  
  allStudents.forEach(name => {
    if (studentName && name !== studentName) return;
    
    const ufli = ufliMap[name] || {};
    const tutoring = tutoringMap[name] || {};
    
    combinedData.push({
      name: name,
      grade: ufli.grade || "",
      primaryGroup: ufli.group || "",
      // UFLI Progress
      ufli: {
        foundational: ufli.foundational,
        minGrade: ufli.minGrade,
        fullGrade: ufli.fullGrade,
        benchmark: ufli.benchmark
      },
      // Tutoring Progress
      tutoring: {
        groups: tutoring.tutoringGroups,
        sessions: tutoring.totalSessions,
        reteachCount: tutoring.reteachCount,
        reteachPassRate: tutoring.reteachPassRate,
        comprehensionCount: tutoring.comprehensionCount,
        comprehensionPassRate: tutoring.comprehensionPassRate,
        overallPassRate: tutoring.overallPassRate,
        lastSession: tutoring.lastSession
      }
    });
  });
  
  return combinedData;
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION & TESTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Test function to verify tutoring system is working
 */
function testTutoringSystem() {
  Logger.log("=== TUTORING SYSTEM TEST ===");
  
  // Test 1: Detection
  Logger.log("\n--- Test 1: Group Detection ---");
  Logger.log("G3 Group 1 Galdamez → isTutoring: " + isTutoringGroup("G3 Group 1 Galdamez"));
  Logger.log("G3 Group 1 Tutoring Galdamez → isTutoring: " + isTutoringGroup("G3 Group 1 Tutoring Galdamez"));
  
  // Test 2: Lesson categorization
  Logger.log("\n--- Test 2: Lesson Categorization ---");
  Logger.log("UFLI L42: " + JSON.stringify(categorizeTutoringLesson("UFLI L42")));
  Logger.log("UFLI L42 reteach: " + JSON.stringify(categorizeTutoringLesson("UFLI L42 reteach")));
  Logger.log("Comprehension: " + JSON.stringify(categorizeTutoringLesson("Comprehension")));
  Logger.log("UFLI L41c: " + JSON.stringify(categorizeTutoringLesson("UFLI L41c")));
  
  // Test 3: Sheet creation
  Logger.log("\n--- Test 3: Creating Sheets ---");
  createTutoringSheets();
  
  Logger.log("\n=== TEST COMPLETE ===");
}
