// ═══════════════════════════════════════════════════════════════════════════
// SANKOFA SCHOOL - STATS EXTENSIONS
// ═══════════════════════════════════════════════════════════════════════════
//
// PURPOSE:
// This file contains Sankofa-specific statistics and navigation functions that
// extend the core Phase2_ProgressTracking_Unified.gs system. These functions
// provide school-specific customizations for Sankofa's statistics calculations
// and dashboard navigation.
//
// SCHOOL:
// Sankofa School
//
// EXTENDS:
// Phase2_ProgressTracking_Unified.gs
//
// DEPENDENCIES:
// - Phase2_ProgressTracking_Unified.gs (updateAllStats function)
// - SankofaPhase2_ProgressTracking.gs (getSankofaConfig function, updateSchoolSummary function)
// - SharedConstants.gs (SHEET_NAMES_V2 constants)
//
// FEATURE FLAGS:
// None - These are core Sankofa functions that are always active for Sankofa.
// The updateAllStats_Sankofa() function uses Sankofa-specific configuration
// passed via getSankofaConfig().
//
// FUNCTIONS:
// 1. updateAllStats_Sankofa() - Wrapper for updateAllStats with Sankofa config
// 2. goToSchoolSummary_Sankofa() - Navigation helper to School Summary dashboard
//    (renamed to avoid conflict with goToSchoolSummary() in the unified module)
//
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Updates all statistics using Sankofa-specific configuration.
 * This is an alternative to the standard updateAllStats() that injects
 * Sankofa's custom configuration for statistics calculations.
 * 
 * @param {Spreadsheet} ss - The active spreadsheet
 * @param {Map} mapData - Map of UFLI lesson data (optional)
 */
function updateAllStats_Sankofa(ss, mapData) {
  updateAllStats(ss, mapData, getSankofaConfig());
}

/**
 * Navigates to the School Summary dashboard sheet.
 * Creates the School Summary sheet if it doesn't exist.
 * This is a helper function for menu items and UI navigation.
 * 
 * NOTE: This function is also available in Phase2_ProgressTracking_Unified.gs.
 * This Sankofa-specific version is provided for backward compatibility with
 * Sankofa menu items and can be removed once all Sankofa references point
 * to the unified module version.
 */
function goToSchoolSummary_Sankofa() {
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
