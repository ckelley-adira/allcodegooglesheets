// ═══════════════════════════════════════════════════════════════════════════
// SHARED ENGINE I/O - GOOGLE APPS SCRIPT SHEET ACCESS & LOGGING
// ═══════════════════════════════════════════════════════════════════════════
// Version: 3.0 (Modularity Refactor — Business Logic Separation)
// Last Updated: February 2026
//
// PURPOSE:
// This module contains ALL functions that interact with Google Apps Script
// I/O APIs: SpreadsheetApp, Logger, HtmlService, etc. These functions are
// NOT testable in Node.js and must be validated via integration tests or
// manual QA in the GAS environment.
//
// DESIGN PRINCIPLES:
// 1. THIN I/O LAYER: Functions here read/write sheets, then delegate all
//    computation to pure functions in SharedEngine_Core.gs
// 2. ORCHESTRATION: updateAllStats() orchestrates data loading from sheets,
//    calls computeStudentStats() for pure logic, then writes results back
// 3. MINIMAL LOGIC: No business rules live here — only data marshalling
//
// FUNCTIONS INCLUDED:
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ CATEGORY              │ FUNCTIONS                                      │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Sheet Utilities       │ getOrCreateSheet                               │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Logging               │ log                                            │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Statistics Orchestrator│ updateAllStats                                 │
// └─────────────────────────────────────────────────────────────────────────┘
//
// DEPENDENCIES:
// - SharedEngine_Core.gs: computeStudentStats(), createMergedRow(), and all
//   pure calculation functions
// - SharedConstants.gs: SKILL_SECTIONS, getPerformanceStatus()
//
// COMPANION MODULE:
// - SharedEngine_Core.gs: Pure business logic (testable without GAS)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// SHEET UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets or creates a sheet with the specified name
 * @param {Spreadsheet} ss - Spreadsheet object
 * @param {string} sheetName - Name of the sheet
 * @param {boolean} clearIfExists - If true, clears existing sheet content
 * @returns {Sheet} The sheet object
 */
function getOrCreateSheet(ss, sheetName, clearIfExists = true) {
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    if (clearIfExists) {
      sheet.clear();
    }
  } else {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Logs a message (can be extended for more sophisticated logging)
 * @param {string} functionName - Name of the calling function
 * @param {string} message - Log message
 * @param {string} level - Log level (INFO, WARN, ERROR)
 */
function log(functionName, message, level = 'INFO') {
  Logger.log(`[${level}] ${functionName}: ${message}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICS UPDATE FUNCTIONS (I/O ORCHESTRATOR)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Updates all statistics sheets (Skills Tracker and Grade Summary).
 * This is the I/O orchestrator that:
 *   1. Reads data from sheets (UFLI MAP, Pre-K Data, Initial Assessment)
 *   2. Delegates computation to computeStudentStats() (pure logic)
 *   3. Writes results back to Skills Tracker and Grade Summary sheets
 *
 * NOTE: This function requires school-specific configuration:
 * - SHEET_NAMES_V2, SHEET_NAMES_PREK, LAYOUT, PREK_CONFIG
 * - GRADE_METRICS (or uses SHARED_GRADE_METRICS as fallback)
 *
 * @param {Spreadsheet} ss - Spreadsheet object
 * @param {Array} mapData - Optional pre-loaded UFLI MAP data
 * @param {Object} config - Configuration object with school-specific constants
 */
function updateAllStats(ss, mapData, config) {
  const functionName = 'updateAllStats';

  // Extract configuration
  const SHEET_NAMES_V2 = config.SHEET_NAMES_V2;
  const SHEET_NAMES_PREK = config.SHEET_NAMES_PREK;
  const LAYOUT = config.LAYOUT;
  const PREK_CONFIG = config.PREK_CONFIG;

  // ── STEP 1: READ DATA FROM SHEETS ──

  // 1a. GET UFLI DATA
  if (!mapData) {
    const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);
    mapData = mapSheet ? mapSheet.getDataRange().getValues() : [];
  }

  // 1b. GET PRE-K DATA
  const preKSheet = ss.getSheetByName(SHEET_NAMES_PREK.DATA);
  let preKData = [];
  let preKHeaders = [];
  if (preKSheet) {
    preKData = preKSheet.getDataRange().getValues();
    if (preKData.length >= PREK_CONFIG.HEADER_ROW) {
      preKHeaders = preKData[PREK_CONFIG.HEADER_ROW - 1];
    }
  }

  // 1c. READ INITIAL ASSESSMENT DATA (for growth suppression)
  const initialSheet = ss.getSheetByName(SHEET_NAMES_V2.INITIAL_ASSESSMENT);
  const initialData = initialSheet ? initialSheet.getDataRange().getValues() : [];

  // ── STEP 2: COMPUTE (PURE LOGIC — NO I/O) ──

  const { skillsOutput, summaryOutput } = computeStudentStats({
    mapData,
    preKData,
    preKHeaders,
    initialData,
    config
  });

  // ── STEP 3: WRITE RESULTS TO SHEETS ──

  // Skills Tracker
  const skillsSheet = ss.getSheetByName(SHEET_NAMES_V2.SKILLS);
  if (skillsSheet && skillsOutput.length > 0) {
    const skillsRange = skillsSheet.getRange(LAYOUT.DATA_START_ROW, 1, skillsOutput.length, skillsOutput[0].length);
    skillsRange.setValues(skillsOutput);
  }

  // Grade Summary
  const summarySheet = ss.getSheetByName(SHEET_NAMES_V2.GRADE_SUMMARY);
  if (summarySheet && summaryOutput.length > 0) {
    const summaryRange = summarySheet.getRange(LAYOUT.DATA_START_ROW, 1, summaryOutput.length, summaryOutput[0].length);
    summaryRange.setValues(summaryOutput);
  }

  log(functionName, `Updated ${skillsOutput.length} student records (Skills + Summary)`);
}
