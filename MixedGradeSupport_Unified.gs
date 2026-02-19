// ═══════════════════════════════════════════════════════════════════════════
// UFLI MASTER SYSTEM - MIXED GRADE SUPPORT MODULE (UNIFIED)
// Multi-Grade Group Management with Format & Feature Flexibility
// ═══════════════════════════════════════════════════════════════════════════
// Version: 3.0 - PHASE 7C UNIFIED
// Created: February 2026
// Phase 7 Consolidation: MixedGradeSupport module
//
// LINEAGE:
// This file consolidates:
// - AdelanteMixedGradeSupport_Enhanced.gs (SC Classroom groups)
// - CHAWMixedGradeSupport_Enhanced.gs (KG-G1, G2-G3, G4-G6 combinations)
// - SankofaMixedGradeSupport_Enhanced.gs (co-teaching support, G4-G6, G6-G8)
// See: PHASE7_AUDIT_REPORT.md § 1.3 and § 3.3
//
// CHANGES FROM v2.0:
// - Unified three school-specific versions into single parameterized module
// - Runtime-loaded configuration from MIXED_GRADE_CONFIG (no hardcoding)
// - Adopted Sankofa's co-teaching support (feature-flagged)
// - Adopted Adelante/Sankofa's SC Classroom functions (feature-flagged)
// - Generalized grade range helpers (isGradeRangeGroup replaces isG6ToG8Group)
// - All 40+ shared functions now in one file
//
// PURPOSE:
// This module extends the UFLI Master System to support schools that group
// students by skill level across multiple grades, rather than by single grade.
//
// SUPPORTS TWO FORMATS:
// 1. STANDARD FORMAT - Group header in column A (merged), followed by "Student Name" row
// 2. SANKOFA FORMAT - Group name in column D with "Student Name" header rows
//
// FEATURE FLAGS (from SiteConfig_TEMPLATE.gs):
// - features.scClassroomGroups: Enable SC Classroom multi-grade groups (default: OFF)
// - features.coTeachingSupport: Enable co-teaching partner groups (default: OFF)
//
// CONFIGURATION:
// - MIXED_GRADE_CONFIG.combinations: Grade combinations per sheet
// - MIXED_GRADE_CONFIG.sheetFormat: "STANDARD" or "SANKOFA"
// - MIXED_GRADE_CONFIG.namingPattern: "NUMBERED_TEACHER", "NUMBERED", or "ALPHA"
//
// DEPENDENCIES:
// - Phase2_ProgressTracking.js (for lesson data structures)
// - SiteConfig_TEMPLATE.gs (for feature flags and MIXED_GRADE_CONFIG)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Site Grade Mixing Mode
 * Set to true for sites that combine grades in groups
 */
const ENABLE_MIXED_GRADES = true;

/**
 * Sheet Format Type
 * - "STANDARD": Group header in column A (merged), followed by "Student Name" row
 * - "SANKOFA": "Student Name" row, followed by row with group name in column D
 * 
 * NOTE: This is overridden by MIXED_GRADE_CONFIG.sheetFormat at runtime
 */
const SHEET_FORMAT = "STANDARD";

/**
 * Mixed Grade Sheet Configuration
 *
 * Define which grades are combined and their sheet names.
 * Format: { sheetName: [array of grades], ... }
 *
 * NOTE: This configuration is read from SITE_CONFIG at runtime.
 * The values below are defaults and will be overridden by the site config.
 */
const MIXED_GRADE_CONFIG = {
  combinations: {
    "KG and G1 Groups": ["KG", "G1"],
    "G2 and G3 Groups": ["G2", "G3"],
    "G4 to G6 Groups": ["G4", "G5", "G6"],
    "G6 to G8 Groups": ["G6", "G7", "G8"],
    "SC Classroom": ["G1", "G2", "G3", "G4"]
  },
  sheetFormat: "STANDARD",
  namingPattern: "NUMBERED_TEACHER"
};

/**
 * Column Configuration for Sankofa Format
 * Adjust these if your columns are different
 */
const SANKOFA_COLUMNS = {
  STUDENT_NAME: 0,      // Column A (0-indexed)
  PRIOR_GROUP_1: 1,     // Column B
  PRIOR_GROUP_2: 2,     // Column C  
  NEW_GROUP: 3,         // Column D - This is where group names appear
  LESSONS_START: 4      // Column E - Where lesson data starts
};

/**
 * Group Configuration Column Indices
 * Used for co-teaching support
 */
const GROUP_CONFIG_COLS = {
  GROUP_NAME: 0,        // Column A
  GRADE: 1,             // Column B (may be multi-grade like "KG, G1")
  PARTNER_GROUP: 2,     // Column C - Partner group for co-teaching
  STUDENTS: 3,          // Column D - Student count
  DATA_START_ROW: 8     // 1-based row where group data begins
};

/**
 * Group Naming Pattern
 * 
 * For mixed-grade sites, groups are typically named differently:
 * - "NUMBERED_TEACHER": "1 - T. Jones", "2 - Smith" (Sankofa style)
 * - "NUMBERED": "Group 1", "Group 2"
 * - "ALPHA": "Group A", "Group B"
 * 
 * NOTE: This is overridden by MIXED_GRADE_CONFIG.namingPattern at runtime
 */
const GROUP_NAMING_PATTERN = "NUMBERED_TEACHER";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets runtime configuration from SITE_CONFIG or falls back to defaults
 * 
 * @returns {Object} Configuration object with combinations, sheetFormat, namingPattern
 */
function getMixedGradeConfig() {
  // Try to load from SITE_CONFIG if available
  if (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG?.mixedGradeConfig) {
    return {
      combinations: SITE_CONFIG.mixedGradeConfig.combinations || MIXED_GRADE_CONFIG.combinations,
      sheetFormat: SITE_CONFIG.mixedGradeConfig.sheetFormat || MIXED_GRADE_CONFIG.sheetFormat,
      namingPattern: SITE_CONFIG.mixedGradeConfig.namingPattern || MIXED_GRADE_CONFIG.namingPattern
    };
  }
  
  // Fallback to constants
  return MIXED_GRADE_CONFIG;
}

/**
 * Gets all grade combinations from runtime config
 * 
 * @returns {Object} Sheet name to grades array mapping
 */
function getGradesFromConfig() {
  const config = getMixedGradeConfig();
  return config.combinations || {};
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEET & GROUP LOOKUP FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets the sheet name for a given grade (mixed or single)
 * 
 * @param {string} grade - Grade code (e.g., "KG", "G1", "G2")
 * @returns {string} Sheet name (e.g., "KG and G1 Groups" or "KG Groups")
 */
function getSheetNameForGrade(grade) {
  if (!ENABLE_MIXED_GRADES) {
    return grade + " Groups";
  }
  
  const combinations = getGradesFromConfig();
  
  // Search mixed grade config
  for (const [sheetName, grades] of Object.entries(combinations)) {
    if (grades.includes(grade)) {
      return sheetName;
    }
  }
  
  // Fallback to standard naming
  return grade + " Groups";
}

/**
 * Gets the sheet name for a given group name
 * This is the KEY function for mixed-grade support
 *
 * @param {string} groupName - Full group name (e.g., "1 - T. Jones", "KG Group 1")
 * @returns {string|null} Sheet name or null if not found
 */
function getSheetNameForGroup(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // SC Classroom groups (feature-flagged)
  if (SITE_CONFIG?.features?.scClassroomGroups === true) {
    if (groupName === "SC Classroom" || groupName.startsWith("SC Classroom")) {
      const scSheet = ss.getSheetByName("SC Classroom");
      if (scSheet) return "SC Classroom";
    }
  }

  if (!ENABLE_MIXED_GRADES) {
    // Standard single-grade logic
    const gradeMatch = groupName.match(/^(PreK|KG|G[1-8])/);
    if (gradeMatch) {
      return gradeMatch[1] + " Groups";
    }
    return null;
  }

  const combinations = getGradesFromConfig();
  const config = getMixedGradeConfig();

  // Mixed-grade logic: Scan all mixed-grade sheets to find the group
  for (const sheetName of Object.keys(combinations)) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;

    const data = sheet.getDataRange().getValues();

    if (config.sheetFormat === "SANKOFA") {
      // Sankofa format: Look for group name in column D (NEW_GROUP column)
      for (let i = 0; i < data.length; i++) {
        const newGroupCell = data[i][SANKOFA_COLUMNS.NEW_GROUP];
        if (newGroupCell && newGroupCell.toString().trim() === groupName) {
          return sheetName;
        }
      }
    } else {
      // Standard format: Look for group header in column A
      for (let i = 0; i < data.length; i++) {
        const cellA = data[i][0] ? data[i][0].toString().trim() : "";
        
        if (cellA === groupName && i + 1 < data.length) {
          const nextRowA = data[i + 1][0] ? data[i + 1][0].toString().trim() : "";
          if (nextRowA === "Student Name") {
            return sheetName;
          }
        }
      }
    }
  }

  // Fallback: Try standard pattern
  const gradeMatch = groupName.match(/^(PreK|KG|G[1-8])/);
  if (gradeMatch) {
    const standardSheet = ss.getSheetByName(gradeMatch[1] + " Groups");
    if (standardSheet) return gradeMatch[1] + " Groups";
  }

  return null;
}

/**
 * Gets the grade(s) for a given group from Group Configuration sheet
 * 
 * @param {string} groupName - Group name to look up
 * @returns {string|null} Grade string (may be comma-separated for multi-grade)
 */
function getGradeForGroup(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupConfigSheet = ss.getSheetByName("Group Configuration");

  if (!groupConfigSheet) {
    Logger.log("getGradeForGroup: Group Configuration sheet not found");
    return null;
  }

  const lastRow = groupConfigSheet.getLastRow();
  const DATA_START_ROW = GROUP_CONFIG_COLS.DATA_START_ROW;

  if (lastRow < DATA_START_ROW) return null;

  const configData = groupConfigSheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 2).getValues();

  for (const row of configData) {
    const name = row[GROUP_CONFIG_COLS.GROUP_NAME] ? row[GROUP_CONFIG_COLS.GROUP_NAME].toString().trim() : "";
    const grade = row[GROUP_CONFIG_COLS.GRADE] ? row[GROUP_CONFIG_COLS.GRADE].toString().trim() : "";

    if (name === groupName) {
      return grade;
    }
  }

  return null;
}

/**
 * Generalized function to check if a group belongs to a specific grade range
 * Replaces school-specific helpers like isG6ToG8Group, isG4ToG6Group
 * 
 * @param {string} groupName - Group name to check
 * @param {Array<string>} gradeRange - Array of grade codes (e.g., ["G6", "G7", "G8"])
 * @returns {boolean} True if group is in the grade range
 */
function isGradeRangeGroup(groupName, gradeRange) {
  // First check if the name contains a pattern that matches the range
  const rangePattern = gradeRange.join("|").replace(/G/g, "G");
  if (new RegExp(rangePattern).test(groupName)) {
    return true;
  }

  // Check Group Configuration for the grade
  const grade = getGradeForGroup(groupName);
  if (grade) {
    // Check if any of the grades in the comma-separated list is in our range
    const grades = grade.split(",").map(g => g.trim());
    return grades.some(g => gradeRange.includes(g));
  }

  // Also check if this group exists in a sheet matching the range
  const combinations = getGradesFromConfig();
  for (const [sheetName, sheetGrades] of Object.entries(combinations)) {
    // Check if the sheet's grades match our range
    if (JSON.stringify(sheetGrades.sort()) === JSON.stringify(gradeRange.sort())) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        const data = sheet.getDataRange().getValues();
        for (let i = 0; i < data.length; i++) {
          const cellA = data[i][0] ? data[i][0].toString().trim() : "";
          if (cellA === groupName) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Checks if a group is an SC Classroom group
 * Feature-flagged with SITE_CONFIG.features.scClassroomGroups
 * 
 * @param {string} groupName - Group name to check
 * @returns {boolean} True if group is SC Classroom group
 */
function isSCClassroomGroup(groupName) {
  if (SITE_CONFIG?.features?.scClassroomGroups !== true) {
    return false;
  }
  
  return groupName === "SC Classroom" || groupName.startsWith("SC Classroom");
}

// ═══════════════════════════════════════════════════════════════════════════
// CO-TEACHING SUPPORT (FEATURE-FLAGGED)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets the partner group for a co-teaching pair
 * Feature-flagged with SITE_CONFIG.features.coTeachingSupport
 * 
 * @param {string} groupName - Group name to find partner for
 * @returns {string|null} Partner group name or null if none
 */
function getPartnerGroup(groupName) {
  if (SITE_CONFIG?.features?.coTeachingSupport !== true) {
    return null;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupConfigSheet = ss.getSheetByName("Group Configuration");

  if (!groupConfigSheet) {
    Logger.log("getPartnerGroup: Group Configuration sheet not found");
    return null;
  }

  const lastRow = groupConfigSheet.getLastRow();
  const DATA_START_ROW = GROUP_CONFIG_COLS.DATA_START_ROW;

  if (lastRow < DATA_START_ROW) return null;

  const numCols = Math.min(groupConfigSheet.getLastColumn(), 3);
  if (numCols < 3) {
    Logger.log("getPartnerGroup: Partner Group column (C) not found - co-teaching not configured");
    return null;
  }

  const configData = groupConfigSheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 3).getValues();

  for (const row of configData) {
    const name = row[GROUP_CONFIG_COLS.GROUP_NAME] ? row[GROUP_CONFIG_COLS.GROUP_NAME].toString().trim() : "";
    const partnerGroup = row[GROUP_CONFIG_COLS.PARTNER_GROUP] ? row[GROUP_CONFIG_COLS.PARTNER_GROUP].toString().trim() : "";

    if (name === groupName && partnerGroup) {
      Logger.log("getPartnerGroup: Found partner '" + partnerGroup + "' for group '" + groupName + "'");
      return partnerGroup;
    }
  }

  return null;
}

/**
 * Checks if a group is part of a co-teaching pair
 * Feature-flagged with SITE_CONFIG.features.coTeachingSupport
 * 
 * @param {string} groupName - Group name to check
 * @returns {boolean} True if group has a partner
 */
function isCoTeachingGroup(groupName) {
  if (SITE_CONFIG?.features?.coTeachingSupport !== true) {
    return false;
  }
  
  return getPartnerGroup(groupName) !== null;
}

/**
 * Gets all co-teaching pairs from Group Configuration
 * Feature-flagged with SITE_CONFIG.features.coTeachingSupport
 *
 * @returns {Array} Array of {group1, group2, grade} objects for each co-teaching pair
 */
function getAllCoTeachingPairs() {
  if (SITE_CONFIG?.features?.coTeachingSupport !== true) {
    return [];
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupConfigSheet = ss.getSheetByName("Group Configuration");

  if (!groupConfigSheet) return [];

  const lastRow = groupConfigSheet.getLastRow();
  const DATA_START_ROW = GROUP_CONFIG_COLS.DATA_START_ROW;

  if (lastRow < DATA_START_ROW) return [];

  const numCols = groupConfigSheet.getLastColumn();
  if (numCols < 3) return [];

  const configData = groupConfigSheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 3).getValues();

  const pairs = [];
  const processedGroups = new Set();

  for (const row of configData) {
    const groupName = row[GROUP_CONFIG_COLS.GROUP_NAME] ? row[GROUP_CONFIG_COLS.GROUP_NAME].toString().trim() : "";
    const grade = row[GROUP_CONFIG_COLS.GRADE] ? row[GROUP_CONFIG_COLS.GRADE].toString().trim() : "";
    const partnerGroup = row[GROUP_CONFIG_COLS.PARTNER_GROUP] ? row[GROUP_CONFIG_COLS.PARTNER_GROUP].toString().trim() : "";

    if (groupName && partnerGroup && !processedGroups.has(groupName)) {
      pairs.push({
        group1: groupName,
        group2: partnerGroup,
        grade: grade
      });
      processedGroups.add(groupName);
      processedGroups.add(partnerGroup);
    }
  }

  Logger.log("getAllCoTeachingPairs: Found " + pairs.length + " co-teaching pairs");
  return pairs;
}

/**
 * Gets all groups that are NOT in co-teaching pairs
 * Feature-flagged with SITE_CONFIG.features.coTeachingSupport
 *
 * @returns {Array} Array of {groupName, grade} objects for solo groups
 */
function getAllSoloGroups() {
  if (SITE_CONFIG?.features?.coTeachingSupport !== true) {
    // If co-teaching is disabled, return all groups as solo groups
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const groupConfigSheet = ss.getSheetByName("Group Configuration");
    
    if (!groupConfigSheet) return [];
    
    const lastRow = groupConfigSheet.getLastRow();
    const DATA_START_ROW = GROUP_CONFIG_COLS.DATA_START_ROW;
    
    if (lastRow < DATA_START_ROW) return [];
    
    const configData = groupConfigSheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 2).getValues();
    
    const soloGroups = [];
    for (const row of configData) {
      const groupName = row[GROUP_CONFIG_COLS.GROUP_NAME] ? row[GROUP_CONFIG_COLS.GROUP_NAME].toString().trim() : "";
      const grade = row[GROUP_CONFIG_COLS.GRADE] ? row[GROUP_CONFIG_COLS.GRADE].toString().trim() : "";
      
      if (groupName) {
        soloGroups.push({ groupName: groupName, grade: grade });
      }
    }
    
    return soloGroups;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupConfigSheet = ss.getSheetByName("Group Configuration");

  if (!groupConfigSheet) return [];

  const lastRow = groupConfigSheet.getLastRow();
  const DATA_START_ROW = GROUP_CONFIG_COLS.DATA_START_ROW;

  if (lastRow < DATA_START_ROW) return [];

  const numCols = groupConfigSheet.getLastColumn();
  const configData = groupConfigSheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, Math.max(numCols, 3)).getValues();

  const soloGroups = [];

  for (const row of configData) {
    const groupName = row[GROUP_CONFIG_COLS.GROUP_NAME] ? row[GROUP_CONFIG_COLS.GROUP_NAME].toString().trim() : "";
    const grade = row[GROUP_CONFIG_COLS.GRADE] ? row[GROUP_CONFIG_COLS.GRADE].toString().trim() : "";
    const partnerGroup = row[GROUP_CONFIG_COLS.PARTNER_GROUP] ? row[GROUP_CONFIG_COLS.PARTNER_GROUP].toString().trim() : "";

    if (groupName && !partnerGroup) {
      soloGroups.push({
        groupName: groupName,
        grade: grade
      });
    }
  }

  Logger.log("getAllSoloGroups: Found " + soloGroups.length + " solo groups");
  return soloGroups;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEET FORMAT DETECTION & HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Checks if a cell in column A is a group header (STANDARD format)
 * 
 * @param {string} cellValue - Cell value to check
 * @param {Array} data - Full sheet data array
 * @param {number} rowIndex - Current row index
 * @returns {boolean} True if this is a group header
 */
function isGroupHeader_Standard(cellValue, data, rowIndex) {
  if (!cellValue) return false;
  
  // Must be followed by "Student Name" row
  if (rowIndex + 1 >= data.length) return false;
  
  const nextRowA = data[rowIndex + 1][0] ? data[rowIndex + 1][0].toString().trim() : "";
  return nextRowA === "Student Name";
}

/**
 * Gets group name from a SANKOFA format row
 * 
 * @param {Array} row - Row data array
 * @returns {string|null} Group name or null
 */
function getGroupFromSankofaRow(row) {
  const groupCell = row[SANKOFA_COLUMNS.NEW_GROUP];
  return groupCell ? groupCell.toString().trim() : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// LESSON & STUDENT DATA RETRIEVAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets lessons and students for a mixed-grade group (main entry point)
 * Handles both STANDARD and SANKOFA formats
 * 
 * @param {string} groupName - Group name
 * @returns {Object} {lessons: [...], students: [...]} or {error: "..."}
 */
function getLessonsAndStudentsForGroup_MixedGrade(groupName) {
  const sheetName = getSheetNameForGroup(groupName);
  if (!sheetName) {
    return { error: "Could not find sheet for group: " + groupName };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return { error: "Sheet not found: " + sheetName };
  }

  const data = sheet.getDataRange().getValues();
  const config = getMixedGradeConfig();

  // SC Classroom special handling
  if (SITE_CONFIG?.features?.scClassroomGroups === true && isSCClassroomGroup(groupName)) {
    return getLessonsAndStudentsForSCClassroom(data, groupName);
  }

  // Co-teaching special handling
  if (SITE_CONFIG?.features?.coTeachingSupport === true && isCoTeachingGroup(groupName)) {
    return getLessonsAndStudentsForCoTeachingGroup(data, groupName);
  }

  // Standard mixed-grade handling
  return getLessonsAndStudentsForMixedGradeGroup(data, groupName, config.sheetFormat);
}

/**
 * Gets lessons and students for a standard mixed-grade group
 * 
 * @param {Array} data - Sheet data array
 * @param {string} groupName - Group name
 * @param {string} format - "STANDARD" or "SANKOFA"
 * @returns {Object} Lessons and students data
 */
function getLessonsAndStudentsForMixedGradeGroup(data, groupName, format) {
  if (format === "SANKOFA") {
    return getLessonsAndStudents_Sankofa(data, groupName);
  } else {
    return getLessonsAndStudents_Standard(data, groupName);
  }
}

/**
 * Gets lessons and students for STANDARD format sheets
 * 
 * @param {Array} data - Sheet data array
 * @param {string} groupName - Group name
 * @returns {Object} Lessons and students data
 */
function getLessonsAndStudents_Standard(data, groupName) {
  // Find the group header row
  let groupStartRow = -1;
  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";
    if (isGroupHeader_Standard(cellA, data, i) && cellA === groupName) {
      groupStartRow = i;
      break;
    }
  }

  if (groupStartRow === -1) {
    return { error: "Group not found: " + groupName };
  }

  // Student Name row is immediately after group header
  const headerRow = groupStartRow + 1;
  const lessonHeaders = data[headerRow].slice(1); // Skip "Student Name" column

  // Collect student rows (until next group or end)
  const students = [];
  let currentRow = headerRow + 1;
  
  while (currentRow < data.length) {
    const cellA = data[currentRow][0] ? data[currentRow][0].toString().trim() : "";
    
    // Stop if we hit another group header or empty row
    if (!cellA || isGroupHeader_Standard(cellA, data, currentRow)) {
      break;
    }
    
    students.push({
      name: cellA,
      rowIndex: currentRow,
      lessonData: data[currentRow].slice(1)
    });
    
    currentRow++;
  }

  return {
    lessons: lessonHeaders.filter(l => l),
    students: students,
    headerRow: headerRow,
    dataStartRow: headerRow + 1
  };
}

/**
 * Gets lessons and students for SANKOFA format sheets
 * 
 * @param {Array} data - Sheet data array
 * @param {string} groupName - Group name
 * @returns {Object} Lessons and students data
 */
function getLessonsAndStudents_Sankofa(data, groupName) {
  // Find "Student Name" header row
  let headerRow = -1;
  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][SANKOFA_COLUMNS.STUDENT_NAME];
    if (cellA && cellA.toString().trim() === "Student Name") {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) {
    return { error: "Student Name header not found" };
  }

  // Get lesson headers from LESSONS_START column onward
  const lessonHeaders = data[headerRow].slice(SANKOFA_COLUMNS.LESSONS_START);

  // Collect students for this group
  const students = [];
  let currentRow = headerRow + 1;

  while (currentRow < data.length) {
    const studentName = data[currentRow][SANKOFA_COLUMNS.STUDENT_NAME];
    const groupCell = data[currentRow][SANKOFA_COLUMNS.NEW_GROUP];
    
    if (!studentName) break; // End of data
    
    const rowGroupName = groupCell ? groupCell.toString().trim() : "";
    
    if (rowGroupName === groupName) {
      students.push({
        name: studentName.toString().trim(),
        rowIndex: currentRow,
        lessonData: data[currentRow].slice(SANKOFA_COLUMNS.LESSONS_START)
      });
    }
    
    currentRow++;
  }

  return {
    lessons: lessonHeaders.filter(l => l),
    students: students,
    headerRow: headerRow,
    dataStartRow: headerRow + 1
  };
}

/**
 * Gets lessons and students for SC Classroom groups
 * Feature-flagged with SITE_CONFIG.features.scClassroomGroups
 * 
 * @param {Array} data - Sheet data array
 * @param {string} groupName - SC Classroom group name
 * @returns {Object} Lessons and students data
 */
function getLessonsAndStudentsForSCClassroom(data, groupName) {
  if (SITE_CONFIG?.features?.scClassroomGroups !== true) {
    return { error: "SC Classroom feature not enabled" };
  }

  // SC Classroom uses standard format with multiple groups
  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";
    if (isGroupHeader_Standard(cellA, data, i) && cellA === groupName) {
      return getLessonsAndStudents_Standard(data, groupName);
    }
  }

  return { error: "SC Classroom group not found: " + groupName };
}

/**
 * Gets lessons and students for a co-teaching group (combined from both partners)
 * Feature-flagged with SITE_CONFIG.features.coTeachingSupport
 * 
 * @param {Array} data - Sheet data array
 * @param {string} groupName - Group name
 * @returns {Object} Combined lessons and students data
 */
function getLessonsAndStudentsForCoTeachingGroup(data, groupName) {
  if (SITE_CONFIG?.features?.coTeachingSupport !== true) {
    return { error: "Co-teaching feature not enabled" };
  }

  const config = getMixedGradeConfig();
  const partnerGroup = getPartnerGroup(groupName);

  // Get data for primary group
  const primaryData = getLessonsAndStudents_Standard(data, groupName);
  
  if (!partnerGroup) {
    return primaryData; // No partner, return as-is
  }

  // Get data for partner group
  const partnerData = getLessonsAndStudents_Standard(data, partnerGroup);

  // Merge students from both groups
  const allStudents = [...(primaryData.students || []), ...(partnerData.students || [])];

  return {
    lessons: primaryData.lessons || [],
    students: allStudents,
    headerRow: primaryData.headerRow,
    dataStartRow: primaryData.dataStartRow,
    isCoTeaching: true,
    partnerGroup: partnerGroup
  };
}

/**
 * Gets lessons and students for PreK groups (compatibility function)
 * 
 * @param {string} groupName - PreK group name
 * @returns {Object} Lessons and students data
 */
function getLessonsAndStudentsForPreKGroup(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("PreK Groups");
  
  if (!sheet) {
    return { error: "PreK Groups sheet not found" };
  }

  const data = sheet.getDataRange().getValues();
  const config = getMixedGradeConfig();

  if (config.sheetFormat === "SANKOFA") {
    return getLessonsAndStudents_Sankofa(data, groupName);
  } else {
    return getLessonsAndStudents_Standard(data, groupName);
  }
}

/**
 * Gets all groups and their sheets for a given set of grades
 * 
 * @param {Array<string>} grades - Array of grade codes
 * @returns {Array} Array of {groupName, sheetName, grade} objects
 */
function getGroupsAndSheets_MixedGrade(grades) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const combinations = getGradesFromConfig();
  const groups = [];

  for (const [sheetName, sheetGrades] of Object.entries(combinations)) {
    // Check if this sheet contains any of our target grades
    if (!grades.some(g => sheetGrades.includes(g))) {
      continue;
    }

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;

    const data = sheet.getDataRange().getValues();
    const config = getMixedGradeConfig();

    if (config.sheetFormat === "SANKOFA") {
      // Find all unique group names in column D
      const uniqueGroups = new Set();
      for (let i = 0; i < data.length; i++) {
        const groupName = getGroupFromSankofaRow(data[i]);
        if (groupName) {
          uniqueGroups.add(groupName);
        }
      }
      
      uniqueGroups.forEach(groupName => {
        groups.push({
          groupName: groupName,
          sheetName: sheetName,
          grade: sheetGrades.join(", ")
        });
      });
    } else {
      // Standard format: Find all group headers
      for (let i = 0; i < data.length; i++) {
        const cellA = data[i][0] ? data[i][0].toString().trim() : "";
        if (isGroupHeader_Standard(cellA, data, i)) {
          groups.push({
            groupName: cellA,
            sheetName: sheetName,
            grade: sheetGrades.join(", ")
          });
        }
      }
    }
  }

  return groups;
}

/**
 * Gets all groups within a specific mixed-grade sheet
 * 
 * @param {string} sheetName - Sheet name to scan
 * @returns {Array} Array of group names
 */
function getGroupsForMixedSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const config = getMixedGradeConfig();
  const groups = [];

  if (config.sheetFormat === "SANKOFA") {
    const uniqueGroups = new Set();
    for (let i = 0; i < data.length; i++) {
      const groupName = getGroupFromSankofaRow(data[i]);
      if (groupName) {
        uniqueGroups.add(groupName);
      }
    }
    groups.push(...uniqueGroups);
  } else {
    for (let i = 0; i < data.length; i++) {
      const cellA = data[i][0] ? data[i][0].toString().trim() : "";
      if (isGroupHeader_Standard(cellA, data, i)) {
        groups.push(cellA);
      }
    }
  }

  return groups;
}

/**
 * Gets groups for lesson entry form dropdown
 * 
 * @param {string} grade - Grade code
 * @returns {Array} Array of group names
 */
function getGroupsForForm_MixedGrade(grade) {
  const groups = getGroupsAndSheets_MixedGrade([grade]);
  return groups.map(g => g.groupName);
}

// ═══════════════════════════════════════════════════════════════════════════
// LESSON PROGRESS UPDATE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Updates lesson progress array for a mixed-grade group
 * 
 * @param {string} groupName - Group name
 * @param {string} lessonName - Lesson name
 * @param {Object} statusData - {studentName: status} mapping
 * @returns {Object} Result object with success/error
 */
function updateGroupArrayByLessonName_MixedGrade(groupName, lessonName, statusData) {
  const sheetName = getSheetNameForGroup(groupName);
  if (!sheetName) {
    return { success: false, error: "Could not find sheet for group: " + groupName };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return { success: false, error: "Sheet not found: " + sheetName };
  }

  const data = sheet.getDataRange().getValues();
  const config = getMixedGradeConfig();

  if (config.sheetFormat === "SANKOFA") {
    return updateGroupArray_Sankofa(sheet, data, groupName, lessonName, statusData);
  } else {
    return updateGroupArray_Standard(sheet, data, groupName, lessonName, statusData);
  }
}

/**
 * Updates lesson progress for STANDARD format
 * 
 * @param {Sheet} sheet - Sheet object
 * @param {Array} data - Sheet data
 * @param {string} groupName - Group name
 * @param {string} lessonName - Lesson name
 * @param {Object} statusData - Status mapping
 * @returns {Object} Result object
 */
function updateGroupArray_Standard(sheet, data, groupName, lessonName, statusData) {
  // Find group header row
  let groupStartRow = -1;
  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";
    if (isGroupHeader_Standard(cellA, data, i) && cellA === groupName) {
      groupStartRow = i;
      break;
    }
  }

  if (groupStartRow === -1) {
    return { success: false, error: "Group not found: " + groupName };
  }

  const headerRow = groupStartRow + 1;
  const lessonHeaders = data[headerRow].slice(1);
  
  // Find lesson column
  const lessonColIndex = lessonHeaders.findIndex(l => l && l.toString().trim() === lessonName);
  if (lessonColIndex === -1) {
    return { success: false, error: "Lesson not found: " + lessonName };
  }

  const lessonCol = lessonColIndex + 2; // +1 for slice, +1 for 1-based indexing

  // Update student rows
  let updatedCount = 0;
  let currentRow = headerRow + 1;

  while (currentRow < data.length) {
    const cellA = data[currentRow][0] ? data[currentRow][0].toString().trim() : "";
    
    if (!cellA || isGroupHeader_Standard(cellA, data, currentRow)) {
      break;
    }

    if (statusData[cellA]) {
      sheet.getRange(currentRow + 1, lessonCol).setValue(statusData[cellA]);
      updatedCount++;
    }

    currentRow++;
  }

  return { success: true, updatedCount: updatedCount };
}

/**
 * Updates lesson progress for SANKOFA format
 * 
 * @param {Sheet} sheet - Sheet object
 * @param {Array} data - Sheet data
 * @param {string} groupName - Group name
 * @param {string} lessonName - Lesson name
 * @param {Object} statusData - Status mapping
 * @returns {Object} Result object
 */
function updateGroupArray_Sankofa(sheet, data, groupName, lessonName, statusData) {
  // Find header row
  let headerRow = -1;
  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][SANKOFA_COLUMNS.STUDENT_NAME];
    if (cellA && cellA.toString().trim() === "Student Name") {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) {
    return { success: false, error: "Student Name header not found" };
  }

  const lessonHeaders = data[headerRow].slice(SANKOFA_COLUMNS.LESSONS_START);
  const lessonColIndex = lessonHeaders.findIndex(l => l && l.toString().trim() === lessonName);
  
  if (lessonColIndex === -1) {
    return { success: false, error: "Lesson not found: " + lessonName };
  }

  const lessonCol = SANKOFA_COLUMNS.LESSONS_START + lessonColIndex + 1; // 1-based

  // Update student rows
  let updatedCount = 0;
  let currentRow = headerRow + 1;

  while (currentRow < data.length) {
    const studentName = data[currentRow][SANKOFA_COLUMNS.STUDENT_NAME];
    if (!studentName) break;

    const rowGroupName = getGroupFromSankofaRow(data[currentRow]);
    const studentNameTrim = studentName.toString().trim();

    if (rowGroupName === groupName && statusData[studentNameTrim]) {
      sheet.getRange(currentRow + 1, lessonCol).setValue(statusData[studentNameTrim]);
      updatedCount++;
    }

    currentRow++;
  }

  return { success: true, updatedCount: updatedCount };
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEET GENERATION & FORMATTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates all mixed-grade group sheets based on configuration
 * 
 * @returns {Object} Result with created sheet names
 */
function createMixedGradeGroupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const combinations = getGradesFromConfig();
  const createdSheets = [];

  for (const [sheetName, grades] of Object.entries(combinations)) {
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log("Created mixed-grade sheet: " + sheetName);
    }

    createMixedGradeSheet(sheet, grades);
    createdSheets.push(sheetName);
  }

  return { success: true, sheets: createdSheets };
}

/**
 * Creates and formats a single mixed-grade sheet
 * 
 * @param {Sheet} sheet - Sheet object to format
 * @param {Array<string>} grades - Array of grade codes for this sheet
 */
function createMixedGradeSheet(sheet, grades) {
  const config = getMixedGradeConfig();

  if (config.sheetFormat === "SANKOFA") {
    formatSheet_Sankofa(sheet, grades);
  } else {
    formatSheet_Standard(sheet, grades);
  }
}

/**
 * Formats a sheet in STANDARD format
 * 
 * @param {Sheet} sheet - Sheet to format
 * @param {Array<string>} grades - Grades for this sheet
 */
function formatSheet_Standard(sheet, grades) {
  // Clear existing content
  sheet.clear();

  // Add title row
  const gradeText = grades.join(" and ");
  sheet.getRange(1, 1).setValue(gradeText + " Groups").setFontWeight("bold").setFontSize(14);

  // Placeholder text
  sheet.getRange(3, 1).setValue("Groups will be added here during setup wizard.");
  
  Logger.log("Formatted sheet in STANDARD format: " + sheet.getName());
}

/**
 * Formats a sheet in SANKOFA format
 * 
 * @param {Sheet} sheet - Sheet to format
 * @param {Array<string>} grades - Grades for this sheet
 */
function formatSheet_Sankofa(sheet, grades) {
  // Clear existing content
  sheet.clear();

  // Add title row
  const gradeText = grades.join(" and ");
  sheet.getRange(1, 1).setValue(gradeText + " Groups").setFontWeight("bold").setFontSize(14);

  // Add column headers (Sankofa style)
  const headerRow = 3;
  sheet.getRange(headerRow, 1, 1, 5).setValues([[
    "Student Name",
    "Prior Group 1",
    "Prior Group 2",
    "New Group",
    "Lesson 1"
  ]]).setFontWeight("bold");

  Logger.log("Formatted sheet in SANKOFA format: " + sheet.getName());
}

/**
 * Repairs formatting for all mixed-grade group sheets
 */
function repairAllGroupSheetFormatting_MixedGrade() {
  const combinations = getGradesFromConfig();
  let repairedCount = 0;

  for (const [sheetName, grades] of Object.entries(combinations)) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (sheet) {
      createMixedGradeSheet(sheet, grades);
      repairedCount++;
      Logger.log("Repaired formatting for: " + sheetName);
    }
  }

  return { success: true, repairedCount: repairedCount };
}

// ═══════════════════════════════════════════════════════════════════════════
// PACING & REPORTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Scans all grade sheets for pacing data (mixed-grade aware)
 * 
 * @param {Array<string>} grades - Grades to scan (optional, defaults to all)
 * @returns {Object} Pacing data by grade and group
 */
function scanGradeSheetsForPacing_MixedGrade(grades) {
  const combinations = getGradesFromConfig();
  const config = getMixedGradeConfig();
  const pacingData = {};

  // If no grades specified, scan all
  const targetGrades = grades || Object.values(combinations).flat();

  for (const [sheetName, sheetGrades] of Object.entries(combinations)) {
    // Check if this sheet contains any target grades
    if (!targetGrades.some(g => sheetGrades.includes(g))) {
      continue;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;

    const data = sheet.getDataRange().getValues();

    let sheetPacing;
    if (config.sheetFormat === "SANKOFA") {
      sheetPacing = processPacing_Sankofa(data, sheetName, sheetGrades);
    } else {
      sheetPacing = processPacing_Standard(data, sheetName, sheetGrades);
    }

    // Handle SC Classroom separately if enabled
    if (SITE_CONFIG?.features?.scClassroomGroups === true && sheetName === "SC Classroom") {
      sheetPacing = processPacing_SCClassroom(data, sheetName, sheetGrades);
    }

    // Merge into main pacing data
    for (const [grade, gradeData] of Object.entries(sheetPacing)) {
      if (!pacingData[grade]) {
        pacingData[grade] = { groups: [] };
      }
      pacingData[grade].groups.push(...gradeData.groups);
    }
  }

  return pacingData;
}

/**
 * Process pacing data from STANDARD format sheet
 * 
 * @param {Array} data - Sheet data
 * @param {string} sheetName - Sheet name
 * @param {Array<string>} grades - Grades in this sheet
 * @returns {Object} Pacing data by grade
 */
function processPacing_Standard(data, sheetName, grades) {
  const pacingData = {};

  // Initialize all grades
  grades.forEach(g => {
    pacingData[g] = { groups: [] };
  });

  // Find all groups
  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";
    
    if (!isGroupHeader_Standard(cellA, data, i)) continue;

    const groupName = cellA;
    const headerRow = i + 1;
    const lessons = data[headerRow].slice(1).filter(l => l);

    // Count students
    let studentCount = 0;
    let currentRow = headerRow + 1;
    
    while (currentRow < data.length) {
      const studentName = data[currentRow][0] ? data[currentRow][0].toString().trim() : "";
      if (!studentName || isGroupHeader_Standard(studentName, data, currentRow)) break;
      studentCount++;
      currentRow++;
    }

    // Add to each applicable grade
    grades.forEach(grade => {
      pacingData[grade].groups.push({
        groupName: groupName,
        sheetName: sheetName,
        lessonCount: lessons.length,
        studentCount: studentCount,
        currentLesson: lessons[lessons.length - 1] || "None"
      });
    });
  }

  return pacingData;
}

/**
 * Process pacing data from SANKOFA format sheet
 * 
 * @param {Array} data - Sheet data
 * @param {string} sheetName - Sheet name
 * @param {Array<string>} grades - Grades in this sheet
 * @returns {Object} Pacing data by grade
 */
function processPacing_Sankofa(data, sheetName, grades) {
  const pacingData = {};

  // Initialize all grades
  grades.forEach(g => {
    pacingData[g] = { groups: [] };
  });

  // Find header row
  let headerRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][SANKOFA_COLUMNS.STUDENT_NAME]?.toString().trim() === "Student Name") {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) return pacingData;

  const lessons = data[headerRow].slice(SANKOFA_COLUMNS.LESSONS_START).filter(l => l);

  // Group students by group name
  const groupStudentCounts = {};
  let currentRow = headerRow + 1;

  while (currentRow < data.length) {
    const studentName = data[currentRow][SANKOFA_COLUMNS.STUDENT_NAME];
    if (!studentName) break;

    const groupName = getGroupFromSankofaRow(data[currentRow]);
    if (groupName) {
      groupStudentCounts[groupName] = (groupStudentCounts[groupName] || 0) + 1;
    }

    currentRow++;
  }

  // Add pacing data for each group
  for (const [groupName, studentCount] of Object.entries(groupStudentCounts)) {
    grades.forEach(grade => {
      pacingData[grade].groups.push({
        groupName: groupName,
        sheetName: sheetName,
        lessonCount: lessons.length,
        studentCount: studentCount,
        currentLesson: lessons[lessons.length - 1] || "None"
      });
    });
  }

  return pacingData;
}

/**
 * Process pacing data from SC Classroom sheet
 * Feature-flagged with SITE_CONFIG.features.scClassroomGroups
 * 
 * @param {Array} data - Sheet data
 * @param {string} sheetName - Sheet name
 * @param {Array<string>} grades - Grades in this sheet
 * @returns {Object} Pacing data by grade
 */
function processPacing_SCClassroom(data, sheetName, grades) {
  if (SITE_CONFIG?.features?.scClassroomGroups !== true) {
    return {};
  }

  // SC Classroom uses standard format but may have sub-groups
  return processPacing_Standard(data, sheetName, grades);
}

/**
 * Renders mixed-grade group table for dashboard
 * 
 * @param {Array} groups - Array of group objects
 * @returns {Array} 2D array for sheet rendering
 */
function renderMixedGradeGroupTable(groups) {
  const rows = [];
  
  // Header row
  rows.push(["Group Name", "Sheet", "Students", "Lessons", "Current Lesson"]);

  // Data rows
  groups.forEach(g => {
    rows.push([
      g.groupName,
      g.sheetName,
      g.studentCount || 0,
      g.lessonCount || 0,
      g.currentLesson || "None"
    ]);
  });

  return rows;
}

/**
 * Updates school summary with mixed-grade data
 * 
 * @param {Sheet} summarySheet - School Summary sheet
 * @param {Object} pacingData - Pacing data from scanGradeSheetsForPacing_MixedGrade
 */
function updateSchoolSummary_MixedGrade(summarySheet, pacingData) {
  let currentRow = 5; // Start after header section

  for (const [grade, gradeData] of Object.entries(pacingData)) {
    // Grade header
    summarySheet.getRange(currentRow, 1).setValue(grade + " Groups")
      .setFontWeight("bold").setFontSize(12);
    currentRow++;

    // Group table
    if (gradeData.groups && gradeData.groups.length > 0) {
      const tableData = renderMixedGradeGroupTable(gradeData.groups);
      summarySheet.getRange(currentRow, 1, tableData.length, tableData[0].length)
        .setValues(tableData);
      currentRow += tableData.length + 1; // +1 for spacing
    } else {
      summarySheet.getRange(currentRow, 1).setValue("No groups found");
      currentRow += 2;
    }
  }
}

/**
 * Applies formatting to school summary mixed-grade sections
 * 
 * @param {Sheet} summarySheet - School Summary sheet
 * @param {number} startRow - Starting row for formatting
 * @param {number} endRow - Ending row for formatting
 */
function applySchoolSummaryFormatting_MixedGrade(summarySheet, startRow, endRow) {
  // Header row formatting
  summarySheet.getRange(startRow, 1, 1, 5)
    .setBackground("#4A86E8")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold");

  // Data row formatting (alternating colors)
  for (let row = startRow + 1; row <= endRow; row++) {
    const color = (row - startRow) % 2 === 0 ? "#F3F3F3" : "#FFFFFF";
    summarySheet.getRange(row, 1, 1, 5).setBackground(color);
  }
}

/**
 * Builds grade-level metrics for mixed-grade groups
 * 
 * @param {Object} gradeData - Grade data from pacing scan
 * @returns {Object} Metrics object with totals and averages
 */
function buildGradeMetrics(gradeData) {
  if (!gradeData || !gradeData.groups || gradeData.groups.length === 0) {
    return getDefaultGradeMetrics();
  }

  const totalGroups = gradeData.groups.length;
  const totalStudents = gradeData.groups.reduce((sum, g) => sum + (g.studentCount || 0), 0);
  const avgLessons = gradeData.groups.reduce((sum, g) => sum + (g.lessonCount || 0), 0) / totalGroups;

  return {
    totalGroups: totalGroups,
    totalStudents: totalStudents,
    avgLessonsPerGroup: Math.round(avgLessons * 10) / 10,
    groupDetails: gradeData.groups
  };
}

/**
 * Gets default metrics structure when no data available
 * 
 * @returns {Object} Empty metrics object
 */
function getDefaultGradeMetrics() {
  return {
    totalGroups: 0,
    totalStudents: 0,
    avgLessonsPerGroup: 0,
    groupDetails: []
  };
}

/**
 * Builds group performance section for a grade
 * 
 * @param {string} grade - Grade code
 * @param {Object} metrics - Grade metrics from buildGradeMetrics
 * @returns {Array} 2D array for rendering
 */
function buildGroupPerformanceSection_MixedGrade(grade, metrics) {
  const rows = [];

  // Summary row
  rows.push([
    grade,
    metrics.totalGroups,
    metrics.totalStudents,
    metrics.avgLessonsPerGroup
  ]);

  return rows;
}

/**
 * Gets header text for mixed-grade section
 * 
 * @param {Array<string>} grades - Array of grades
 * @returns {string} Formatted header text
 */
function getGradeHeaderText_MixedGrade(grades) {
  if (grades.length === 1) {
    return grades[0] + " Groups";
  } else if (grades.length === 2) {
    return grades[0] + " and " + grades[1] + " Groups";
  } else {
    return grades[0] + " to " + grades[grades.length - 1] + " Groups";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Natural sort for group names (handles numbers correctly)
 * 
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Sort comparison result
 */
function naturalSort(a, b) {
  const ax = [];
  const bx = [];

  a.replace(/(\d+)|(\D+)/g, (_, num, str) => {
    ax.push([num || Infinity, str || ""]);
  });
  
  b.replace(/(\d+)|(\D+)/g, (_, num, str) => {
    bx.push([num || Infinity, str || ""]);
  });

  while (ax.length && bx.length) {
    const an = ax.shift();
    const bn = bx.shift();
    const nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
    if (nn) return nn;
  }

  return ax.length - bx.length;
}

/**
 * Formats a date value safely
 * 
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return "";
  
  try {
    if (typeof date === "string") {
      date = new Date(date);
    }
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "MM/dd/yyyy");
  } catch (e) {
    return date.toString();
  }
}

/**
 * Formats a percentage value
 * 
 * @param {number} value - Value to format (0-1 or 0-100)
 * @returns {string} Formatted percentage string
 */
function formatPercent(value) {
  if (value === null || value === undefined) return "0%";
  
  // If value is already 0-100, use as-is
  if (value > 1) {
    return Math.round(value) + "%";
  }
  
  // If value is 0-1, multiply by 100
  return Math.round(value * 100) + "%";
}

/**
 * Formats a growth metric (+/-)
 * 
 * @param {number} value - Growth value
 * @returns {string} Formatted growth string
 */
function formatGrowth(value) {
  if (value === null || value === undefined) return "—";
  
  const sign = value >= 0 ? "+" : "";
  return sign + Math.round(value);
}

/**
 * Gets site name from configuration
 * 
 * @returns {string} Site name
 */
function getSiteName() {
  if (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG?.siteName) {
    return SITE_CONFIG.siteName;
  }
  return "School";
}

// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC & TESTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tests mixed-grade configuration and reports issues
 * Use this to debug mixed-grade setup problems
 */
function testMixedGradeConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = getMixedGradeConfig();
  const combinations = getGradesFromConfig();
  
  Logger.log("=== Mixed Grade Configuration Test ===");
  Logger.log("Enable Mixed Grades: " + ENABLE_MIXED_GRADES);
  Logger.log("Sheet Format: " + config.sheetFormat);
  Logger.log("Group Naming Pattern: " + config.namingPattern);
  Logger.log("");
  
  Logger.log("Configured Combinations:");
  for (const [sheetName, grades] of Object.entries(combinations)) {
    const sheet = ss.getSheetByName(sheetName);
    const exists = sheet ? "✓" : "✗";
    Logger.log("  " + exists + " " + sheetName + ": " + grades.join(", "));
    
    if (sheet) {
      const groups = getGroupsForMixedSheet(sheetName);
      Logger.log("    Groups found: " + groups.length + " - " + groups.join(", "));
    }
  }
  
  Logger.log("");
  Logger.log("Feature Flags:");
  Logger.log("  SC Classroom: " + (SITE_CONFIG?.features?.scClassroomGroups === true ? "✓" : "✗"));
  Logger.log("  Co-Teaching: " + (SITE_CONFIG?.features?.coTeachingSupport === true ? "✓" : "✗"));
  
  if (SITE_CONFIG?.features?.coTeachingSupport === true) {
    const pairs = getAllCoTeachingPairs();
    Logger.log("  Co-Teaching Pairs: " + pairs.length);
    pairs.forEach(p => {
      Logger.log("    " + p.group1 + " ↔ " + p.group2 + " (" + p.grade + ")");
    });
  }
  
  Logger.log("");
  Logger.log("=== Test Complete ===");
}

/**
 * Debug function to test group loading for a specific group
 * 
 * @param {string} groupName - Group name to test
 */
function debugGroupLoading(groupName) {
  Logger.log("=== Debug Group Loading: " + groupName + " ===");
  
  const sheetName = getSheetNameForGroup(groupName);
  Logger.log("Sheet Name: " + (sheetName || "NOT FOUND"));
  
  if (sheetName) {
    const data = getLessonsAndStudentsForGroup_MixedGrade(groupName);
    if (data.error) {
      Logger.log("Error: " + data.error);
    } else {
      Logger.log("Lessons: " + (data.lessons ? data.lessons.length : 0));
      Logger.log("Students: " + (data.students ? data.students.length : 0));
      if (data.students && data.students.length > 0) {
        Logger.log("First Student: " + data.students[0].name);
      }
    }
  }
  
  if (SITE_CONFIG?.features?.coTeachingSupport === true) {
    const partner = getPartnerGroup(groupName);
    Logger.log("Partner Group: " + (partner || "None"));
  }
  
  if (SITE_CONFIG?.features?.scClassroomGroups === true) {
    Logger.log("Is SC Classroom: " + isSCClassroomGroup(groupName));
  }
  
  Logger.log("=== Debug Complete ===");
}
