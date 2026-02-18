// ═══════════════════════════════════════════════════════════════════════════
// UFLI MASTER SYSTEM - MIXED GRADE SUPPORT MODULE (ENHANCED)
// Enables sites with combined grade groups (e.g., KG+G1, G2+G3, G4-G6)
// ═══════════════════════════════════════════════════════════════════════════
// Version: 2.0 - SANKOFA FORMAT COMPATIBLE
// Last Updated: January 2026
//
// PURPOSE:
// This module extends the UFLI Master System to support schools that group
// students by skill level across multiple grades, rather than by single grade.
//
// SUPPORTS TWO FORMATS:
// 1. STANDARD FORMAT - Group header in column A (for new sheets created by wizard)
// 2. SANKOFA FORMAT - Group name in column D with "Student Name" header rows
//
// USAGE:
// 1. Add this file to your Google Apps Script project
// 2. Configure MIXED_GRADE_CONFIG for your site
// 3. Set SHEET_FORMAT based on your sheets (STANDARD or SANKOFA)
// 4. Replace/update functions in GPSetUpWizard.gs and GPProgressEngine.gs
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION - CUSTOMIZE FOR YOUR SITE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Site Grade Mixing Mode
 * Set to true for sites that combine grades in groups
 */
var ENABLE_MIXED_GRADES = true;

/**
 * Sheet Format Type
 * - "STANDARD": Group header in column A (merged), followed by "Student Name" row
 * - "SANKOFA": "Student Name" row, followed by row with group name in column D
 */
var SHEET_FORMAT = "STANDARD";  // Change to "STANDARD" for new format

/**
 * Mixed Grade Sheet Configuration
 *
 * Define which grades are combined and their sheet names.
 * Format: { sheetName: [array of grades], ... }
 *
 * NOTE: This configuration is read from Site Configuration sheet at runtime.
 * The values below are defaults and will be overridden by the site config.
 *
 * Site Configuration sheet (Row 16) contains:
 * - Allow Grade Mixing: TRUE/FALSE
 * - Mixed Grade Combinations: "G6+G7+G8, G1+G2+G3+G4" (comma-separated combinations)
 */
var MIXED_GRADE_CONFIG = {
  // Sheet Name : Grades included
  // These are DEFAULTS - actual config is loaded from Site Configuration
  "KG and G1 Groups": ["KG", "G1"],
  "G2 and G3 Groups": ["G2", "G3"],
  "G4 to G6 Groups": ["G4", "G5", "G6"],
  "G6 to G8 Groups": ["G6", "G7", "G8"],
  "SC Classroom": ["G1", "G2", "G3", "G4"]
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
 * Group Naming Pattern
 * 
 * For mixed-grade sites, groups are typically named differently:
 * - "NUMBERED_TEACHER": "1 - T. Jones", "2 - Smith" (Sankofa style)
 * - "NUMBERED": "Group 1", "Group 2"
 * - "ALPHA": "Group A", "Group B"
 */
const GROUP_NAMING_PATTERN = "NUMBERED_TEACHER";


// ═══════════════════════════════════════════════════════════════════════════
// LOOKUP FUNCTIONS - Finding the right sheet for a group
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
  
  // Search mixed grade config
  for (const [sheetName, grades] of Object.entries(MIXED_GRADE_CONFIG)) {
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

  // Special case: SC Classroom is both the sheet name and group name
  if (groupName === "SC Classroom") {
    const scSheet = ss.getSheetByName("SC Classroom");
    if (scSheet) return "SC Classroom";
  }

  // Special case: G6 to G8 groups
  if (groupName.includes("G6 to G8")) {
    const mixedSheet = ss.getSheetByName("G6 to G8 Groups");
    if (mixedSheet) return "G6 to G8 Groups";
    // If no dedicated sheet, these groups might be in individual grade sheets
    // The fallback below will handle it
  }

  if (!ENABLE_MIXED_GRADES) {
    // Standard single-grade logic
    const gradeMatch = groupName.match(/^(PreK|KG|G[1-8])/);
    if (gradeMatch) {
      return gradeMatch[1] + " Groups";
    }
    return null;
  }

  // Mixed-grade logic: Scan all mixed-grade sheets to find the group
  for (const sheetName of Object.keys(MIXED_GRADE_CONFIG)) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;

    const data = sheet.getDataRange().getValues();

    if (SHEET_FORMAT === "SANKOFA") {
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
        if (isGroupHeader_Standard(cellA, data, i) && cellA === groupName) {
          return sheetName;
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

  // Last resort: Search ALL sheets for the group
  const standardPattern = /^(PreK|KG|G[1-8]) Groups$/;
  const allSheets = ss.getSheets().filter(s => standardPattern.test(s.getName()));

  for (const sheet of allSheets) {
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      const cellA = data[i][0] ? data[i][0].toString().trim() : "";
      if (cellA === groupName && isGroupHeader_Standard(cellA, data, i)) {
        return sheet.getName();
      }
    }
  }

  return null;
}

/**
 * Checks if a cell value is a group header (STANDARD format)
 */
function isGroupHeader_Standard(cellValue, data, rowIndex) {
  if (!cellValue) return false;
  
  // Standard pattern: Contains "Group" but not "Student"
  if (cellValue.includes("Group") && !cellValue.includes("Student")) {
    if (rowIndex + 1 < data.length) {
      const nextRowA = data[rowIndex + 1][0] ? data[rowIndex + 1][0].toString().trim() : "";
      return nextRowA === "Student Name";
    }
  }
  
  // Mixed-grade pattern: "N - Teacher" format
  const numberedTeacherPattern = /^\d+\s*-\s*.+$/;
  if (numberedTeacherPattern.test(cellValue)) {
    if (rowIndex + 1 < data.length) {
      const nextRowA = data[rowIndex + 1][0] ? data[rowIndex + 1][0].toString().trim() : "";
      return nextRowA === "Student Name";
    }
  }
  
  return false;
}

/**
 * Checks if a row is the start of a group block (SANKOFA format)
 * Returns the group name if found, null otherwise
 * 
 * In Sankofa format:
 * Row N: "Student Name", "Prior Group", "Prior Group", "New Group", "Lesson"...
 * Row N+1: "", "", "", "1 - Helman", "UFLI L67"...
 */
function getGroupFromSankofaRow(data, rowIndex) {
  if (rowIndex >= data.length) return null;
  
  const row = data[rowIndex];
  const cellA = row[0] ? row[0].toString().trim() : "";
  
  // Check if this is a "Student Name" header row
  if (cellA === "Student Name") {
    // Look at the next row for the group name in column D
    if (rowIndex + 1 < data.length) {
      const nextRow = data[rowIndex + 1];
      const groupName = nextRow[SANKOFA_COLUMNS.NEW_GROUP];
      if (groupName && groupName.toString().trim()) {
        return groupName.toString().trim();
      }
    }
  }
  
  return null;
}


// ═══════════════════════════════════════════════════════════════════════════
// FORM FUNCTIONS - Get Groups and Students for Lesson Entry
// ═══════════════════════════════════════════════════════════════════════════

/**
 * REPLACEMENT for getGroupsForForm() in GPSetUpWizard.gs
 * Gets all groups for the lesson entry form dropdown
 *
 * @returns {Array<string>} Sorted array of group names
 */
function getGroupsForForm_MixedGrade() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allGroupNames = [];

  // === FIRST: Read groups from Group Configuration sheet (most reliable source) ===
  const groupConfigSheet = ss.getSheetByName("Group Configuration");
  if (groupConfigSheet) {
    const configData = groupConfigSheet.getDataRange().getValues();
    // Find where group data starts (after headers)
    // Group Configuration structure: Row 5 = headers, Row 6 = totals, Row 7 = blank, Row 8+ = groups
    // Or: Look for "Group Name" header
    let dataStartRow = 7; // Default: skip first 7 rows

    for (let i = 0; i < Math.min(10, configData.length); i++) {
      if (configData[i][0] && configData[i][0].toString().trim() === "Group Name") {
        dataStartRow = i + 1; // Data starts after header
        break;
      }
    }

    // Read all group names from column A
    for (let i = dataStartRow; i < configData.length; i++) {
      const groupName = configData[i][COLS.GROUP_CONFIG.GROUP_NAME] ? configData[i][COLS.GROUP_CONFIG.GROUP_NAME].toString().trim() : "";
      // Skip empty rows and totals row
      if (groupName && groupName !== "Total Groups" && !groupName.includes("Not Grouped")) {
        if (!allGroupNames.includes(groupName)) {
          allGroupNames.push(groupName);
          Logger.log("Found group from config: " + groupName);
        }
      }
    }

    Logger.log("Loaded " + allGroupNames.length + " groups from Group Configuration");
  }

  // === THEN: Also scan group sheets for any additional groups ===
  // Determine which sheets to scan
  const sheetsToScan = [];

  if (ENABLE_MIXED_GRADES) {
    for (const sheetName of Object.keys(MIXED_GRADE_CONFIG)) {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) sheetsToScan.push(sheet);
    }
  }

  // Also check standard grade sheets
  const standardPattern = /^(PreK|KG|G[1-8]) Groups$/;
  ss.getSheets().forEach(sheet => {
    if (standardPattern.test(sheet.getName())) {
      if (!sheetsToScan.some(s => s.getName() === sheet.getName())) {
        sheetsToScan.push(sheet);
      }
    }
  });

  // Scan each sheet for groups
  sheetsToScan.forEach(sheet => {
    const sheetName = sheet.getName();
    const data = sheet.getDataRange().getValues();
    
    if (SHEET_FORMAT === "SANKOFA") {
      // Sankofa format: Collect unique group names from column D
      const groupsInSheet = new Set();
      
      for (let i = 0; i < data.length; i++) {
        const cellA = data[i][0] ? data[i][0].toString().trim() : "";
        
        // When we hit a "Student Name" row, get the group from next row
        if (cellA === "Student Name" && i + 1 < data.length) {
          const groupName = data[i + 1][SANKOFA_COLUMNS.NEW_GROUP];
          if (groupName && groupName.toString().trim()) {
            groupsInSheet.add(groupName.toString().trim());
          }
        }
        
        // Also check column D directly for any group names in data rows
        const newGroupCol = data[i][SANKOFA_COLUMNS.NEW_GROUP];
        if (newGroupCol) {
          const groupStr = newGroupCol.toString().trim();
          // Match pattern like "1 - Name" or "N - Name"
          if (/^\d+\s*-\s*.+/.test(groupStr)) {
            groupsInSheet.add(groupStr);
          }
        }
      }
      
      groupsInSheet.forEach(group => {
        if (!allGroupNames.includes(group)) {
          allGroupNames.push(group);
          Logger.log("Found Sankofa group: " + group + " in sheet: " + sheetName);
        }
      });
      
    } else {
      // Standard format: Look for group headers in column A
      for (let i = 0; i < data.length; i++) {
        const cellA = data[i][0] ? data[i][0].toString().trim() : "";
        
        if (isGroupHeader_Standard(cellA, data, i)) {
          if (!allGroupNames.includes(cellA)) {
            allGroupNames.push(cellA);
            Logger.log("Found standard group: " + cellA + " in sheet: " + sheetName);
          }
        }
      }
    }
  });
  
  // Check for SC Classroom (Self-Contained Classroom with flat structure)
  const scClassroomSheet = ss.getSheetByName("SC Classroom");
  if (scClassroomSheet) {
    // SC Classroom is treated as a single group, not divided into sub-groups
    if (!allGroupNames.includes("SC Classroom")) {
      allGroupNames.push("SC Classroom");
      Logger.log("Found SC Classroom sheet, adding as group");
    }
  }

  // Also check Pre-K Data sheet
  const preKSheet = ss.getSheetByName("Pre-K Data");
  if (preKSheet) {
    const preKData = preKSheet.getDataRange().getValues();
    const preKGroups = new Set();
    
    let headerRow = -1;
    for (let i = 0; i < Math.min(10, preKData.length); i++) {
      if (preKData[i][0] && preKData[i][0].toString().toLowerCase() === 'student') {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow >= 0) {
      for (let i = headerRow + 1; i < preKData.length; i++) {
        const groupName = preKData[i][1] ? preKData[i][1].toString().trim() : "";
        if (groupName) {
          preKGroups.add(groupName);
        }
      }
      
      preKGroups.forEach(group => {
        if (!allGroupNames.includes(group)) {
          allGroupNames.push(group);
        }
      });
    }
  }
  
  // Sort groups
  allGroupNames.sort(naturalSort);
  
  Logger.log("Total groups found: " + allGroupNames.length);
  return allGroupNames;
}

/**
 * Gets the grade(s) for a group from Group Configuration sheet
 * @param {string} groupName - Group name to look up
 * @returns {string|null} Grade(s) string or null if not found
 */
function getGradeForGroup(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupConfigSheet = ss.getSheetByName("Group Configuration");

  if (!groupConfigSheet) {
    Logger.log("getGradeForGroup: Group Configuration sheet not found");
    return null;
  }

  const lastRow = groupConfigSheet.getLastRow();
  const GROUP_DATA_START = COLS.GROUP_CONFIG.DATA_START_ROW;

  if (lastRow < GROUP_DATA_START) return null;

  // Columns: A=Group Name, B=Grade
  const configData = groupConfigSheet.getRange(GROUP_DATA_START, 1, lastRow - GROUP_DATA_START + 1, 2).getValues();

  for (const row of configData) {
    const name = row[COLS.GROUP_CONFIG.GROUP_NAME] ? row[COLS.GROUP_CONFIG.GROUP_NAME].toString().trim() : "";
    const grade = row[COLS.GROUP_CONFIG.GRADE] ? row[COLS.GROUP_CONFIG.GRADE].toString().trim() : "";

    if (name === groupName) {
      Logger.log("getGradeForGroup: Found grade '" + grade + "' for group '" + groupName + "'");
      return grade;
    }
  }

  Logger.log("getGradeForGroup: Group '" + groupName + "' not found in Group Configuration");
  return null;
}

/**
 * Determines if a group belongs to the G6-G8 mixed grade sheet based on its grade
 * @param {string} groupName - Group name to check
 * @returns {boolean} True if group is G6, G7, or G8
 */
function isG6ToG8Group(groupName) {
  // First check if the name contains "G6 to G8"
  if (groupName.includes("G6 to G8")) {
    return true;
  }

  // Check Group Configuration for the grade
  const grade = getGradeForGroup(groupName);
  if (grade) {
    // Check if any of the grades in the comma-separated list is G6, G7, or G8
    const grades = grade.split(",").map(g => g.trim());
    return grades.some(g => ["G6", "G7", "G8"].includes(g));
  }

  return false;
}
/**
 * Determines if a group belongs to the G4 to G6 mixed grade sheet based on its grade
 * @param {string} groupName - Group name to check
 * @returns {boolean} True if group is G4, G5, or G6
 */
function isG4ToG6Group(groupName) {
  // First check if the name contains "G4 to G6"
  if (groupName.includes("G4 to G6")) {
    return true;
  }

  // Check Group Configuration for the grade
  const grade = getGradeForGroup(groupName);
  if (grade) {
    // Check if any of the grades in the comma-separated list is G4, G5, or G6
    const grades = grade.split(",").map(g => g.trim());
    return grades.some(g => ["G4", "G5", "G6"].includes(g));
  }

  // Also check if this group exists in the G4 to G6 Groups sheet directly
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("G4 to G6 Groups");
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      const cellA = data[i][0] ? data[i][0].toString().trim() : "";
      if (cellA === groupName) {
        return true;
      }
    }
  }

  return false;
}
/**
 * Determines if a group belongs to the SC Classroom sheet based on its grade
 * @param {string} groupName - Group name to check
 * @returns {boolean} True if group is in SC Classroom (G1-G4)
 */
function isSCClassroomGroup(groupName) {
  // Check if it's the SC Classroom group itself
  if (groupName === "SC Classroom") {
    return true;
  }

  // Check Group Configuration for the grade
  const grade = getGradeForGroup(groupName);
  if (grade) {
    // SC Classroom typically has G1-G4 students
    // But we should only return true if the group is actually IN SC Classroom sheet
    // Check if the group exists in the SC Classroom sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const scSheet = ss.getSheetByName("SC Classroom");
    if (scSheet) {
      const data = scSheet.getDataRange().getValues();
      for (let i = 0; i < data.length; i++) {
        const cellA = data[i][0] ? data[i][0].toString().trim() : "";
        if (cellA === groupName) {
          return true;
        }
      }
    }
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// CO-TEACHING SUPPORT FUNCTIONS
// Enables two groups to be combined for instruction while tracking separately
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets the partner group for co-teaching from Group Configuration sheet
 *
 * Group Configuration sheet structure:
 * - Column A: Group Name
 * - Column B: Grade
 * - Column C: Partner Group (NEW - for co-teaching)
 *
 * @param {string} groupName - Group name to look up
 * @returns {string|null} Partner group name or null if solo teaching
 */
function getPartnerGroup(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupConfigSheet = ss.getSheetByName("Group Configuration");

  if (!groupConfigSheet) {
    Logger.log("getPartnerGroup: Group Configuration sheet not found");
    return null;
  }

  const lastRow = groupConfigSheet.getLastRow();
  const GROUP_DATA_START = COLS.GROUP_CONFIG.DATA_START_ROW;

  if (lastRow < GROUP_DATA_START) return null;

  // Columns: A=Group Name, B=Grade, C=Partner Group
  const numCols = Math.min(groupConfigSheet.getLastColumn(), 3);
  if (numCols < 3) {
    // Partner Group column doesn't exist yet
    Logger.log("getPartnerGroup: Partner Group column (C) not found - co-teaching not configured");
    return null;
  }

  const configData = groupConfigSheet.getRange(GROUP_DATA_START, 1, lastRow - GROUP_DATA_START + 1, 3).getValues();

  for (const row of configData) {
    const name = row[COLS.GROUP_CONFIG.GROUP_NAME] ? row[COLS.GROUP_CONFIG.GROUP_NAME].toString().trim() : "";
    const partnerGroup = row[COLS.GROUP_CONFIG.PARTNER_GROUP] ? row[COLS.GROUP_CONFIG.PARTNER_GROUP].toString().trim() : "";

    if (name === groupName && partnerGroup) {
      Logger.log("getPartnerGroup: Found partner '" + partnerGroup + "' for group '" + groupName + "'");
      return partnerGroup;
    }
  }

  Logger.log("getPartnerGroup: No partner found for group '" + groupName + "' (solo teaching)");
  return null;
}

/**
 * Determines if a group is part of a co-teaching pair
 *
 * @param {string} groupName - Group name to check
 * @returns {boolean} True if group has a partner configured
 */
function isCoTeachingGroup(groupName) {
  return getPartnerGroup(groupName) !== null;
}

/**
 * Gets all co-teaching pairs from Group Configuration
 *
 * @returns {Array} Array of {group1, group2, grade} objects for each co-teaching pair
 */
function getAllCoTeachingPairs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupConfigSheet = ss.getSheetByName("Group Configuration");

  if (!groupConfigSheet) return [];

  const lastRow = groupConfigSheet.getLastRow();
  const GROUP_DATA_START = COLS.GROUP_CONFIG.DATA_START_ROW;

  if (lastRow < GROUP_DATA_START) return [];

  const numCols = groupConfigSheet.getLastColumn();
  if (numCols < 3) return []; // No Partner Group column

  const configData = groupConfigSheet.getRange(GROUP_DATA_START, 1, lastRow - GROUP_DATA_START + 1, 3).getValues();

  const pairs = [];
  const processedGroups = new Set();

  for (const row of configData) {
    const groupName = row[COLS.GROUP_CONFIG.GROUP_NAME] ? row[COLS.GROUP_CONFIG.GROUP_NAME].toString().trim() : "";
    const grade = row[COLS.GROUP_CONFIG.GRADE] ? row[COLS.GROUP_CONFIG.GRADE].toString().trim() : "";
    const partnerGroup = row[COLS.GROUP_CONFIG.PARTNER_GROUP] ? row[COLS.GROUP_CONFIG.PARTNER_GROUP].toString().trim() : "";

    if (groupName && partnerGroup && !processedGroups.has(groupName)) {
      pairs.push({
        group1: groupName,
        group2: partnerGroup,
        grade: grade
      });
      // Mark both as processed to avoid duplicate pairs
      processedGroups.add(groupName);
      processedGroups.add(partnerGroup);
    }
  }

  Logger.log("getAllCoTeachingPairs: Found " + pairs.length + " co-teaching pairs");
  return pairs;
}

/**
 * Gets all solo (non-co-teaching) groups from Group Configuration
 *
 * @returns {Array} Array of {groupName, grade} objects for solo groups
 */
function getAllSoloGroups() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupConfigSheet = ss.getSheetByName("Group Configuration");

  if (!groupConfigSheet) return [];

  const lastRow = groupConfigSheet.getLastRow();
  const GROUP_DATA_START = COLS.GROUP_CONFIG.DATA_START_ROW;

  if (lastRow < GROUP_DATA_START) return [];

  const numCols = groupConfigSheet.getLastColumn();
  const configData = groupConfigSheet.getRange(GROUP_DATA_START, 1, lastRow - GROUP_DATA_START + 1, Math.max(numCols, 3)).getValues();

  const soloGroups = [];

  for (const row of configData) {
    const groupName = row[COLS.GROUP_CONFIG.GROUP_NAME] ? row[COLS.GROUP_CONFIG.GROUP_NAME].toString().trim() : "";
    const grade = row[COLS.GROUP_CONFIG.GRADE] ? row[COLS.GROUP_CONFIG.GRADE].toString().trim() : "";
    const partnerGroup = row[COLS.GROUP_CONFIG.PARTNER_GROUP] ? row[COLS.GROUP_CONFIG.PARTNER_GROUP].toString().trim() : "";

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
// LESSON AND STUDENT RETRIEVAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * REPLACEMENT for getLessonsAndStudentsForGroup() in GPSetUpWizard.gs
 * Gets lessons and students for a group (with co-teaching support)
 *
 * @param {string} groupName - Group name (e.g., "1 - T. Jones", "KG Group 1")
 * @returns {Object} {lessons: [{id, name}], students: [{name, sourceGroup}], isCoTeaching, partnerGroup}
 */
/**
 * REPLACEMENT for getLessonsAndStudentsForGroup() in GPSetUpWizard.gs
 * Gets lessons and students for a group (with co-teaching support)
 *
 * @param {string} groupName - Group name (e.g., "1 - T. Jones", "KG Group 1", "Group 2 - Dever")
 * @returns {Object} {lessons: [{id, name}], students: [{name, sourceGroup}], isCoTeaching, partnerGroup}
 */
function getLessonsAndStudentsForGroup_MixedGrade(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log("=== getLessonsAndStudentsForGroup_MixedGrade ===");
  Logger.log("Group requested: " + groupName);

  // Handle PreK separately
  if (groupName.toLowerCase().includes("prek")) {
    return getLessonsAndStudentsForPreKGroup(groupName);
  }

  // Handle SC Classroom specially (flat structure - no sub-groups)
  if (groupName === "SC Classroom") {
    return getLessonsAndStudentsForSCClassroom();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CO-TEACHING CHECK - Combine students from partner groups
  // ═══════════════════════════════════════════════════════════════════════════
  const partnerGroup = getPartnerGroup(groupName);
  if (partnerGroup) {
    Logger.log("Co-teaching detected: '" + groupName + "' paired with '" + partnerGroup + "'");
    return getLessonsAndStudentsForCoTeachingGroup(groupName, partnerGroup);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MIXED GRADE SHEET ROUTING - Check for specific mixed-grade sheets
  // ═══════════════════════════════════════════════════════════════════════════

  // Check if this is a G4 to G6 group (by name OR by grade from Group Configuration)
  if (isG4ToG6Group(groupName)) {
    Logger.log("Group '" + groupName + "' identified as G4 to G6 group");
    return getLessonsAndStudentsForMixedGradeGroup(groupName, "G4 to G6 Groups");
  }

  // Check if this is a G6 to G8 group (by name OR by grade from Group Configuration)
  if (isG6ToG8Group(groupName)) {
    Logger.log("Group '" + groupName + "' identified as G6 to G8 group");
    return getLessonsAndStudentsForMixedGradeGroup(groupName, "G6 to G8 Groups");
  }

  // Check if this group is in SC Classroom sheet
  if (isSCClassroomGroup(groupName)) {
    Logger.log("Group '" + groupName + "' identified as SC Classroom group");
    return getLessonsAndStudentsForSCClassroomGroup(groupName);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERIC LOOKUP - Find which sheet contains this group
  // ═══════════════════════════════════════════════════════════════════════════
  const sheetName = getSheetNameForGroup(groupName);

  if (!sheetName) {
    Logger.log("ERROR: Could not find sheet for group: " + groupName);
    return { error: "Could not find group '" + groupName + "' in any sheet" };
  }

  Logger.log("Found sheet: " + sheetName);

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return { error: "Sheet '" + sheetName + "' not found." };
  }

  const data = sheet.getDataRange().getValues();

  if (SHEET_FORMAT === "SANKOFA") {
    return getLessonsAndStudents_Sankofa(data, groupName);
  } else {
    return getLessonsAndStudents_Standard(data, groupName);
  }
}
/**
 * Gets lessons and students for a co-teaching group (combined from two groups)
 *
 * @param {string} primaryGroup - Primary group name selected by user
 * @param {string} partnerGroup - Partner group name from configuration
 * @returns {Object} {lessons, students (with sourceGroup), isCoTeaching, partnerGroup}
 */
function getLessonsAndStudentsForCoTeachingGroup(primaryGroup, partnerGroup) {
  Logger.log("=== getLessonsAndStudentsForCoTeachingGroup ===");
  Logger.log("Primary group: " + primaryGroup);
  Logger.log("Partner group: " + partnerGroup);

  // Get data for primary group (without triggering co-teaching recursion)
  const primaryData = getStudentsForSingleGroup(primaryGroup);
  const partnerData = getStudentsForSingleGroup(partnerGroup);

  if (primaryData.error) {
    Logger.log("Error getting primary group data: " + primaryData.error);
    return primaryData;
  }

  if (partnerData.error) {
    Logger.log("Warning: Error getting partner group data: " + partnerData.error);
    // Continue with just primary group students
  }

  // Combine students with source group tracking
  const combinedStudents = [];

  // Add primary group students
  if (primaryData.students) {
    for (const student of primaryData.students) {
      const studentName = typeof student === 'string' ? student : student.name;
      combinedStudents.push({
        name: studentName,
        sourceGroup: primaryGroup
      });
    }
  }

  // Add partner group students
  if (partnerData.students) {
    for (const student of partnerData.students) {
      const studentName = typeof student === 'string' ? student : student.name;
      combinedStudents.push({
        name: studentName,
        sourceGroup: partnerGroup
      });
    }
  }

  Logger.log("Combined " + combinedStudents.length + " students from both groups");
  Logger.log("  - Primary (" + primaryGroup + "): " + (primaryData.students ? primaryData.students.length : 0));
  Logger.log("  - Partner (" + partnerGroup + "): " + (partnerData.students ? partnerData.students.length : 0));

  return {
    lessons: primaryData.lessons || [],
    students: combinedStudents,
    isCoTeaching: true,
    primaryGroup: primaryGroup,
    partnerGroup: partnerGroup
  };
}

/**
 * Gets students for a single group WITHOUT triggering co-teaching logic
 * Used internally by getLessonsAndStudentsForCoTeachingGroup
 *
 * @param {string} groupName - Group name
 * @returns {Object} {lessons, students}
 */
/**
 * Gets students for a single group WITHOUT triggering co-teaching logic
 * Used internally by getLessonsAndStudentsForCoTeachingGroup
 *
 * @param {string} groupName - Group name
 * @returns {Object} {lessons, students}
 */
function getStudentsForSingleGroup(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log("getStudentsForSingleGroup: " + groupName);

  // Handle PreK separately
  if (groupName.toLowerCase().includes("prek")) {
    return getLessonsAndStudentsForPreKGroup(groupName);
  }

  // Handle SC Classroom
  if (groupName === "SC Classroom") {
    return getLessonsAndStudentsForSCClassroom();
  }

  // Check if this group is in SC Classroom sheet
  if (isSCClassroomGroup(groupName)) {
    return getLessonsAndStudentsForSCClassroomGroup(groupName);
  }

  // Check if this is a G4 to G6 group
  if (isG4ToG6Group(groupName)) {
    return getLessonsAndStudentsForMixedGradeGroup(groupName, "G4 to G6 Groups");
  }

  // Check if this is a G6 to G8 group
  if (isG6ToG8Group(groupName)) {
    return getLessonsAndStudentsForMixedGradeGroup(groupName, "G6 to G8 Groups");
  }

  // Find which sheet contains this group
  const sheetName = getSheetNameForGroup(groupName);

  if (!sheetName) {
    return { error: "Could not find sheet for group '" + groupName + "'" };
  }

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return { error: "Sheet '" + sheetName + "' not found." };
  }

  const data = sheet.getDataRange().getValues();

  if (SHEET_FORMAT === "SANKOFA") {
    return getLessonsAndStudents_Sankofa(data, groupName);
  } else {
    return getLessonsAndStudents_Standard(data, groupName);
  }
}

/**
 * Gets lessons and students for SC Classroom (flat structure)
 * SC Classroom has all students in one sheet without sub-groups
 *
 * Handles multiple possible structures:
 * Structure A (flat with UFLI in header):
 *   Row N: "Student Name" | "Grade" | "UFLI L1" | "UFLI L2" | ...
 *   Row N+1: Student | G1 | Y/N | Y/N | ...
 *
 * Structure B (with sub-header):
 *   Row N: "Student Name" | "Lesson 1" | "Lesson 2" | ...
 *   Row N+1: [empty/grade] | "UFLI L1" | "UFLI L2" | ...
 *   Row N+2: Student | Y/N | Y/N | ...
 */
function getLessonsAndStudentsForSCClassroom() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("SC Classroom");

  if (!sheet) {
    Logger.log("SC Classroom sheet not found");
    return { error: "SC Classroom sheet not found." };
  }

  const data = sheet.getDataRange().getValues();
  const students = [];
  let lessons = [];

  // Find the "Student Name" header row
  let headerRowIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim() === "Student Name") {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    Logger.log('SC Classroom: Could not find "Student Name" header');
    return { error: "Could not find header row in SC Classroom sheet." };
  }

  Logger.log("SC Classroom: Found 'Student Name' header at row " + (headerRowIndex + 1));

  // Try to find UFLI lessons in the header row first (columns B/C onwards)
  const headerRow = data[headerRowIndex];
  for (let col = 1; col < headerRow.length; col++) {
    const cellValue = headerRow[col] ? headerRow[col].toString().trim() : "";
    if (cellValue && cellValue.toUpperCase().startsWith("UFLI")) {
      lessons.push({ id: col, name: cellValue });
    }
  }

  // If no UFLI lessons found in header row, check sub-header row
  if (lessons.length === 0 && headerRowIndex + 1 < data.length) {
    Logger.log("SC Classroom: No UFLI lessons in header row, checking sub-header row");
    const subHeaderRow = data[headerRowIndex + 1];
    for (let col = 1; col < subHeaderRow.length; col++) {
      const cellValue = subHeaderRow[col] ? subHeaderRow[col].toString().trim() : "";
      if (cellValue && cellValue.toUpperCase().startsWith("UFLI")) {
        lessons.push({ id: col, name: cellValue });
      }
    }
  }

  Logger.log("SC Classroom: Found " + lessons.length + " lessons");

  // Determine where students start
  // If lessons were in sub-header row, students start at headerRowIndex + 2
  // If lessons were in header row, students start at headerRowIndex + 1
  let studentStartRow = headerRowIndex + 1;

  // Check if the first data row has student names or is a sub-header
  if (studentStartRow < data.length) {
    const firstDataRow = data[studentStartRow];
    const firstCell = firstDataRow[0] ? firstDataRow[0].toString().trim() : "";

    // If the first cell is empty or looks like a sub-header, skip this row
    if (!firstCell || firstCell === "Grade" || firstCell === "") {
      // Check if this row has UFLI lesson names (sub-header row)
      const hasUFLI = firstDataRow.some((cell, idx) =>
        idx > 0 && cell && cell.toString().trim().toUpperCase().startsWith("UFLI")
      );
      if (hasUFLI) {
        studentStartRow++;
        Logger.log("SC Classroom: Skipping sub-header row, students start at row " + (studentStartRow + 1));
      }
    }
  }

  // Collect students
  for (let i = studentStartRow; i < data.length; i++) {
    const studentName = data[i][0] ? data[i][0].toString().trim() : "";
    // Skip empty rows and header-like rows
    if (studentName && studentName !== "Student Name" && studentName !== "Grade") {
      students.push(studentName);
    }
  }

  Logger.log("SC Classroom: Found " + students.length + " students");

  return {
    lessons: lessons,
    students: students.sort()
  };
}

/**
 * Gets lessons and students for a specific group within SC Classroom sheet
 * Used when SC Classroom has sub-groups (not flat structure)
 */
function getLessonsAndStudentsForSCClassroomGroup(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("SC Classroom");

  if (!sheet) {
    Logger.log("SC Classroom sheet not found");
    return { error: "SC Classroom sheet not found." };
  }

  const data = sheet.getDataRange().getValues();

  // Try STANDARD format first (group headers in column A)
  return getLessonsAndStudents_Standard(data, groupName);
}

/**
 * Gets lessons and students for mixed-grade groups (G6 to G8, etc.)
 */
function getLessonsAndStudentsForMixedGradeGroup(groupName, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    Logger.log("Mixed grade sheet not found: " + sheetName);
    // Try to find the group in standard grade sheets
    return getLessonsAndStudentsFromGradeSheets(groupName);
  }

  const data = sheet.getDataRange().getValues();
  return getLessonsAndStudents_Standard(data, groupName);
}

/**
 * Searches all grade sheets to find a group's lessons and students
 */
function getLessonsAndStudentsFromGradeSheets(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const standardPattern = /^(PreK|KG|G[1-8]) Groups$/;

  // Search all grade sheets
  const sheets = ss.getSheets().filter(s => standardPattern.test(s.getName()));

  for (const sheet of sheets) {
    const data = sheet.getDataRange().getValues();

    // Look for the group in this sheet
    for (let i = 0; i < data.length; i++) {
      const cellA = data[i][0] ? data[i][0].toString().trim() : "";
      if (cellA === groupName && isGroupHeader_Standard(cellA, data, i)) {
        Logger.log("Found group '" + groupName + "' in sheet: " + sheet.getName());
        return getLessonsAndStudents_Standard(data, groupName);
      }
    }
  }

  Logger.log("Could not find group '" + groupName + "' in any grade sheet");
  return { error: "Could not find group '" + groupName + "' in any sheet." };
}

/**
 * Gets lessons and students for SANKOFA format
 * 
 * Structure:
 * Row N:   "Student Name", "Prior Group", "Prior Group", "New Group", "Lesson 20", ...
 * Row N+1: "", "", "", "1 - Helman", "UFLI L67", "UFLI L68", ...
 * Row N+2: "Student Name", "", "", "1 - Helman", "Y", "N", ...
 * ...
 * (blank row)
 * Row M:   "Student Name", ...  <- Next group block
 */
function getLessonsAndStudents_Sankofa(data, groupName) {
  const students = [];
  const lessons = [];
  let inTargetGroup = false;
  let lessonRowFound = false;
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const cellA = row[0] ? row[0].toString().trim() : "";
    
    // Check if this is a "Student Name" header row (start of a group block)
    if (cellA === "Student Name") {
      // Look at next row for group name
      if (i + 1 < data.length) {
        const nextRow = data[i + 1];
        const groupInNextRow = nextRow[SANKOFA_COLUMNS.NEW_GROUP];
        
        if (groupInNextRow && groupInNextRow.toString().trim() === groupName) {
          // Found our target group!
          inTargetGroup = true;
          lessonRowFound = false;
          Logger.log("Found target group '" + groupName + "' at row " + (i + 1));
          
          // Extract lessons from the next row (columns E onwards)
          for (let col = SANKOFA_COLUMNS.LESSONS_START; col < nextRow.length; col++) {
            const lessonName = nextRow[col] ? nextRow[col].toString().trim() : "";
            if (lessonName && lessonName.startsWith("UFLI")) {
              lessons.push({ id: col, name: lessonName });
            }
          }
          lessonRowFound = true;
          Logger.log("Found " + lessons.length + " lessons");
          
          // Skip the header and lesson rows
          i += 1;
          continue;
          
        } else if (inTargetGroup) {
          // Hit a new group block, stop collecting
          Logger.log("Hit new group block, stopping collection");
          break;
        }
      }
      continue;
    }
    
    // Skip blank rows
    if (!cellA && inTargetGroup) {
      // Could be end of group, but check next row first
      if (i + 1 < data.length && data[i + 1][0] && 
          data[i + 1][0].toString().trim() === "Student Name") {
        // Next row is a new group header, stop
        break;
      }
      continue;
    }
    
    // Collect students (rows with student names in column A)
    if (inTargetGroup && lessonRowFound && cellA && cellA !== "(No students assigned)") {
      // Verify this student belongs to our group (check New Group column)
      const studentGroup = row[SANKOFA_COLUMNS.NEW_GROUP];
      if (studentGroup && studentGroup.toString().trim() === groupName) {
        students.push(cellA);
      }
    }
  }
  
  Logger.log("Found " + students.length + " students for group: " + groupName);
  
  return {
    lessons: lessons,
    students: students.sort()
  };
}

/**
 * Gets lessons and students for STANDARD format
 */
function getLessonsAndStudents_Standard(data, groupName) {
  const students = [];
  let lessons = [];
  let inTargetGroup = false;
  let foundLessonRow = false;
  
  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";
    
    if (isGroupHeader_Standard(cellA, data, i)) {
      if (cellA === groupName) {
        inTargetGroup = true;
        foundLessonRow = false;
        Logger.log("Found target group at row " + (i + 1));
      } else if (inTargetGroup) {
        break;
      }
      continue;
    }
    
    if (cellA === "Student Name") {
      continue;
    }
    
    // Collect lessons from sub-header row
    if (inTargetGroup && !foundLessonRow && data[i][1]) {
      for (let col = 1; col < data[i].length; col++) {
        const lessonName = data[i][col] ? data[i][col].toString().trim() : "";
        if (lessonName) {
          lessons.push({ id: col, name: lessonName });
        }
      }
      foundLessonRow = true;
      continue;
    }
    
    // Collect students
    if (inTargetGroup && foundLessonRow && cellA && cellA !== "(No students assigned)") {
      students.push(cellA);
    }
  }
  
  return {
    lessons: lessons,
    students: students.sort()
  };
}

/**
 * Helper for PreK groups
 */
function getLessonsAndStudentsForPreKGroup(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Pre-K Data");
  
  if (!sheet) {
    return { error: "Sheet 'Pre-K Data' not found." };
  }
  
  const data = sheet.getDataRange().getValues();
  const students = [];
  
  const PREK_DATA_START = 5;
  
  for (let i = PREK_DATA_START; i < data.length; i++) {
    const row = data[i];
    const studentName = row[0];
    const studentGroup = row[1] ? row[1].toString().trim() : "";
    
    if (!studentName) continue;
    
    // Flexible group matching
    if (studentGroup === groupName || 
        (groupName.includes("PreK") && studentGroup.includes("PreK"))) {
      students.push(studentName);
    }
  }
  
  return {
    lessons: [],
    students: students.sort()
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// SYNC FUNCTIONS - Updated for Mixed Grades
// ═══════════════════════════════════════════════════════════════════════════

/**
 * REPLACEMENT for updateGroupArrayByLessonName() in GPProgressEngine.gs
 * Updates Group Sheet by matching lesson name
 * 
 * @param {Object} groupSheetsData - Cache of all group sheet data
 * @param {string} groupName - Group name
 * @param {string} studentName - Student name
 * @param {string} lessonName - Full lesson name
 * @param {string} status - Y, N, or A
 */
function updateGroupArrayByLessonName_MixedGrade(groupSheetsData, groupName, studentName, lessonName, status) {
  // Find the correct sheet for this group
  let sheetName = null;
  
  // Search through all cached sheets to find this group
  for (const [name, cache] of Object.entries(groupSheetsData)) {
    const data = cache.values;
    
    if (SHEET_FORMAT === "SANKOFA") {
      // Search column D for the group name
      for (let i = 0; i < data.length; i++) {
        const newGroupCell = data[i][SANKOFA_COLUMNS.NEW_GROUP];
        if (newGroupCell && newGroupCell.toString().trim() === groupName) {
          sheetName = name;
          break;
        }
      }
    } else {
      // Search column A for standard format
      for (let i = 0; i < data.length; i++) {
        const cellA = data[i][0] ? data[i][0].toString().trim() : "";
        if (cellA === groupName) {
          sheetName = name;
          break;
        }
      }
    }
    if (sheetName) break;
  }
  
  if (!sheetName || !groupSheetsData[sheetName]) {
    return;
  }
  
  const cache = groupSheetsData[sheetName];
  const data = cache.values;
  const cleanStudentName = studentName.toString().trim().toUpperCase();
  const cleanLessonName = lessonName.toString().trim().toUpperCase();
  
  if (SHEET_FORMAT === "SANKOFA") {
    updateGroupArray_Sankofa(cache, data, groupName, cleanStudentName, cleanLessonName, status);
  } else {
    updateGroupArray_Standard(cache, data, groupName, cleanStudentName, cleanLessonName, status);
  }
}

/**
 * Updates group array for SANKOFA format
 */
function updateGroupArray_Sankofa(cache, data, groupName, studentName, lessonName, status) {
  // Find the lesson column in the header row for this group
  let lessonRowIdx = -1;
  let lessonColIdx = -1;
  
  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";
    
    if (cellA === "Student Name" && i + 1 < data.length) {
      const nextRow = data[i + 1];
      const groupInRow = nextRow[SANKOFA_COLUMNS.NEW_GROUP];
      
      if (groupInRow && groupInRow.toString().trim() === groupName) {
        // Found our group, now find the lesson column
        lessonRowIdx = i + 1;
        
        for (let col = SANKOFA_COLUMNS.LESSONS_START; col < nextRow.length; col++) {
          const headerLesson = nextRow[col] ? nextRow[col].toString().trim().toUpperCase() : "";
          
          if (headerLesson === lessonName) {
            lessonColIdx = col;
            break;
          }
          
          // Also try matching by lesson number
          const headerLessonNum = extractLessonNumber(headerLesson);
          const inputLessonNum = extractLessonNumber(lessonName);
          if (headerLessonNum && inputLessonNum && headerLessonNum === inputLessonNum) {
            lessonColIdx = col;
            break;
          }
        }
        break;
      }
    }
  }
  
  if (lessonColIdx === -1) return;
  
  // Find the student row and update
  for (let k = lessonRowIdx + 1; k < data.length; k++) {
    const cellA = data[k][0] ? data[k][0].toString().trim().toUpperCase() : "";
    
    // Stop at blank row or next "Student Name" header
    if (!cellA || cellA === "STUDENT NAME") break;
    
    // Check if this student is in our group
    const studentGroup = data[k][SANKOFA_COLUMNS.NEW_GROUP];
    if (!studentGroup || studentGroup.toString().trim() !== groupName) continue;
    
    if (cellA === studentName) {
      data[k][lessonColIdx] = status;
      cache.dirty = true;
      break;
    }
  }
}

/**
 * Updates group array for STANDARD format
 */
function updateGroupArray_Standard(cache, data, groupName, studentName, lessonName, status) {
  // Find the group header row
  let groupStartRow = -1;
  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";
    if (cellA === groupName) {
      groupStartRow = i;
      break;
    }
  }
  if (groupStartRow === -1) return;
  
  // Sub-header row is 2 rows after group header
  const subHeaderRowIdx = groupStartRow + 2;
  if (subHeaderRowIdx >= data.length) return;
  
  const subHeaderRow = data[subHeaderRowIdx];
  
  // Find the lesson column
  let lessonColIdx = -1;
  for (let j = 1; j < subHeaderRow.length; j++) {
    const headerLesson = subHeaderRow[j] ? subHeaderRow[j].toString().trim().toUpperCase() : "";
    
    if (headerLesson === lessonName) {
      lessonColIdx = j;
      break;
    }
    
    const headerLessonNum = extractLessonNumber(headerLesson);
    const inputLessonNum = extractLessonNumber(lessonName);
    if (headerLessonNum && inputLessonNum && headerLessonNum === inputLessonNum) {
      lessonColIdx = j;
      break;
    }
  }
  
  if (lessonColIdx === -1) return;
  
  // Find student row and update
  for (let k = groupStartRow + 3; k < data.length; k++) {
    const cellA = data[k][0] ? data[k][0].toString().trim().toUpperCase() : "";
    
    if (!cellA) break;
    if (isGroupHeader_Standard(data[k][0], data, k)) break;
    
    if (cellA === studentName) {
      data[k][lessonColIdx] = status;
      cache.dirty = true;
      break;
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// PACING REPORTS - Updated for Mixed Grades
// ═══════════════════════════════════════════════════════════════════════════

/**
 * REPLACEMENT for scanGradeSheetsForPacing() in GPProgressEngine.gs
 */
function scanGradeSheetsForPacing_MixedGrade(ss, lookups, progressMap) {
  const { studentCountByGroup, teacherByGroup } = lookups;
  const dashboardRows = [];
  const logRows = [];

  // Build list of sheets to scan
  const sheetsToScan = [];

  if (ENABLE_MIXED_GRADES) {
    for (const sheetName of Object.keys(MIXED_GRADE_CONFIG)) {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) sheetsToScan.push(sheet);
    }
  }

  // Also add SC Classroom if it exists (special flat structure)
  const scClassroom = ss.getSheetByName("SC Classroom");
  if (scClassroom) {
    Logger.log('scanGradeSheetsForPacing_MixedGrade: Found SC Classroom sheet');
  }

  const standardPattern = /^(PreK|KG|G[1-8]) Groups$/;
  ss.getSheets().forEach(sheet => {
    if (standardPattern.test(sheet.getName())) {
      if (!sheetsToScan.some(s => s.getName() === sheet.getName())) {
        sheetsToScan.push(sheet);
      }
    }
  });

  sheetsToScan.forEach(sheet => {
    const sheetData = sheet.getDataRange().getValues();

    if (SHEET_FORMAT === "SANKOFA") {
      processPacing_Sankofa(sheetData, lookups, progressMap, dashboardRows, logRows);
    } else {
      processPacing_Standard(sheetData, lookups, progressMap, dashboardRows, logRows);
    }
  });

  // Process SC Classroom separately (different structure)
  if (scClassroom) {
    const scData = scClassroom.getDataRange().getValues();
    processPacing_SCClassroom(scData, lookups, progressMap, dashboardRows, logRows);
  }

  return { dashboardRows, logRows };
}

/**
 * Process pacing for SANKOFA format
 */
function processPacing_Sankofa(sheetData, lookups, progressMap, dashboardRows, logRows) {
  const { studentCountByGroup, teacherByGroup } = lookups;
  
  for (let i = 0; i < sheetData.length; i++) {
    const cellA = sheetData[i][0] ? sheetData[i][0].toString().trim() : "";
    
    if (cellA === "Student Name" && i + 1 < sheetData.length) {
      const nextRow = sheetData[i + 1];
      const groupName = nextRow[SANKOFA_COLUMNS.NEW_GROUP];
      
      if (groupName && groupName.toString().trim()) {
        const cleanGroupName = groupName.toString().trim();
        const studentCount = studentCountByGroup.get(cleanGroupName) || 0;
        const teacher = teacherByGroup.get(cleanGroupName) || "Unknown Teacher";
        
        let dash = { 
          assigned: 0, tracked: 0, pass: 0, fail: 0, absent: 0, 
          lastEntry: null, highestLessonName: "" 
        };
        let dashHighestNum = 0;
        
        // Process lessons from the next row
        for (let col = SANKOFA_COLUMNS.LESSONS_START; col < nextRow.length; col++) {
          const lessonName = nextRow[col] ? nextRow[col].toString().trim() : "";
          const lessonNum = extractLessonNumber(lessonName);
          if (!lessonName || !lessonNum) continue;
          
          dash.assigned++;
          const stats = progressMap.get(`${cleanGroupName}|${lessonNum}`);
          let log_Y = 0, log_N = 0, log_A = 0, log_Date = null;
          
          if (stats) {
            dash.tracked++;
            log_Y = stats.Y; log_N = stats.N; log_A = stats.A;
            dash.pass += log_Y; dash.fail += log_N; dash.absent += log_A;
            if (stats.lastDate > 0) {
              log_Date = stats.lastDate;
              if (!dash.lastEntry || log_Date > dash.lastEntry) dash.lastEntry = log_Date;
            }
            if (lessonNum > dashHighestNum) {
              dashHighestNum = lessonNum;
              dash.highestLessonName = lessonName;
            }
          }
          
          const total = log_Y + log_N;
          logRows.push([
            cleanGroupName, teacher, `Lesson ${col - SANKOFA_COLUMNS.LESSONS_START + 1}`, 
            lessonName, studentCount, log_Y, log_N, log_A,
            total > 0 ? log_Y / total : 0,
            total > 0 ? log_N / total : 0,
            studentCount > 0 ? log_A / studentCount : 0,
            log_Date
          ]);
        }
        
        dashboardRows.push(buildDashboardRow(cleanGroupName, teacher, studentCount, dash));
      }
    }
  }
}

/**
 * Process pacing for SC Classroom (Self-Contained Classroom)
 * SC Classroom has a flat structure:
 * - Row with "Student Name" header
 * - Next row has lesson names (UFLI L1, UFLI L2, etc.) starting at column C
 * - Following rows have student data with Grade in column B
 * - No group divisions - treated as single group "SC Classroom"
 */
function processPacing_SCClassroom(sheetData, lookups, progressMap, dashboardRows, logRows) {
  const { studentCountByGroup, teacherByGroup } = lookups;
  const groupName = "SC Classroom";

  // Find the "Student Name" header row
  let headerRowIndex = -1;
  for (let i = 0; i < sheetData.length; i++) {
    if (sheetData[i][0] && sheetData[i][0].toString().trim() === "Student Name") {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    Logger.log('processPacing_SCClassroom: Could not find "Student Name" header');
    return;
  }

  // Lesson names are in the row after header
  const lessonNameRowIndex = headerRowIndex + 1;
  if (lessonNameRowIndex >= sheetData.length) {
    Logger.log('processPacing_SCClassroom: No lesson name row found');
    return;
  }

  const lessonNames = sheetData[lessonNameRowIndex];

  // Build lesson column map (lessons start at column C, index 2)
  const lessonColumnMap = {};
  for (let col = 2; col < lessonNames.length; col++) {
    const lessonName = lessonNames[col] ? lessonNames[col].toString().trim() : "";
    if (lessonName && lessonName.toUpperCase().startsWith("UFLI")) {
      lessonColumnMap[col] = lessonName;
    }
  }

  const lessonCount = Object.keys(lessonColumnMap).length;
  Logger.log(`processPacing_SCClassroom: Found ${lessonCount} lessons`);

  // Count students and build pacing data
  let studentCount = 0;
  let dash = {
    assigned: lessonCount,
    tracked: 0,
    pass: 0,
    fail: 0,
    absent: 0,
    lastEntry: null,
    highestLessonName: ""
  };
  let dashHighestNum = 0;

  // Students start 2 rows after header (header row + lesson name row + 1)
  const studentStartRow = lessonNameRowIndex + 1;

  for (let i = studentStartRow; i < sheetData.length; i++) {
    const studentName = sheetData[i][0] ? sheetData[i][0].toString().trim() : "";
    if (!studentName) continue; // Skip empty rows

    studentCount++;

    // Process each lesson for this student
    for (const colStr in lessonColumnMap) {
      const col = parseInt(colStr);
      const lessonName = lessonColumnMap[col];
      const cellValue = sheetData[i][col] ? sheetData[i][col].toString().trim().toUpperCase() : "";

      if (cellValue === "Y") {
        dash.pass++;
        dash.tracked++;

        // Track highest lesson
        const lessonNum = extractLessonNumber(lessonName);
        if (lessonNum && lessonNum > dashHighestNum) {
          dashHighestNum = lessonNum;
          dash.highestLessonName = lessonName;
        }
      } else if (cellValue === "N") {
        dash.fail++;
        dash.tracked++;
      } else if (cellValue === "A") {
        dash.absent++;
        dash.tracked++;
      }
    }
  }

  Logger.log(`processPacing_SCClassroom: Found ${studentCount} students`);

  // Get teacher from lookups or default
  const teacher = teacherByGroup.get(groupName) || "SC Teacher";

  // Override student count from lookups if available
  const lookupCount = studentCountByGroup.get(groupName);
  if (lookupCount) {
    studentCount = lookupCount;
  }

  // Add dashboard row for SC Classroom
  if (studentCount > 0) {
    dashboardRows.push(buildDashboardRow(groupName, teacher, studentCount, dash));

    // Add log rows for each lesson
    for (const colStr in lessonColumnMap) {
      const col = parseInt(colStr);
      const lessonName = lessonColumnMap[col];
      const lessonNum = extractLessonNumber(lessonName);

      // Get stats from progress map
      const stats = progressMap.get(`${groupName}|${lessonNum}`);
      let log_Y = 0, log_N = 0, log_A = 0, log_Date = null;

      if (stats) {
        log_Y = stats.Y || 0;
        log_N = stats.N || 0;
        log_A = stats.A || 0;
        log_Date = stats.lastDate || null;
      }

      const total = log_Y + log_N;
      logRows.push([
        groupName, teacher, `Lesson ${col - 1}`, lessonName,
        studentCount, log_Y, log_N, log_A,
        total > 0 ? log_Y / total : 0,
        total > 0 ? log_N / total : 0,
        studentCount > 0 ? log_A / studentCount : 0,
        log_Date
      ]);
    }
  }
}

/**
 * Process pacing for STANDARD format
 */
function processPacing_Standard(sheetData, lookups, progressMap, dashboardRows, logRows) {
  const { studentCountByGroup, teacherByGroup } = lookups;
  let currentGroupName = "", currentTeacher = "", studentCount = 0;
  let dash = { assigned: 0, tracked: 0, pass: 0, fail: 0, absent: 0, lastEntry: null, highestLessonName: "" };
  let dashHighestNum = 0;
  
  for (let i = 0; i < sheetData.length; i++) {
    const cellA = sheetData[i][0] ? sheetData[i][0].toString().trim() : "";
    
    if (isGroupHeader_Standard(cellA, sheetData, i)) {
      if (currentGroupName) {
        dashboardRows.push(buildDashboardRow(currentGroupName, currentTeacher, studentCount, dash));
      }
      
      currentGroupName = cellA;
      studentCount = studentCountByGroup.get(currentGroupName) || 0;
      currentTeacher = teacherByGroup.get(currentGroupName) || "Unknown Teacher";
      dash = { assigned: 0, tracked: 0, pass: 0, fail: 0, absent: 0, lastEntry: null, highestLessonName: "" };
      dashHighestNum = 0;
      
      if (i + 2 < sheetData.length) {
        const lessonRow = sheetData[i + 2];
        for (let col = 1; col <= LAYOUT.LESSONS_PER_GROUP_SHEET; col++) {
          if (col >= lessonRow.length) break;
          const lessonName = lessonRow[col] ? lessonRow[col].toString().trim() : "";
          const lessonNum = extractLessonNumber(lessonName);
          if (!lessonName || !lessonNum) continue;
          
          dash.assigned++;
          const stats = progressMap.get(`${currentGroupName}|${lessonNum}`);
          let log_Y = 0, log_N = 0, log_A = 0, log_Date = null;
          
          if (stats) {
            dash.tracked++;
            log_Y = stats.Y; log_N = stats.N; log_A = stats.A;
            dash.pass += log_Y; dash.fail += log_N; dash.absent += log_A;
            if (stats.lastDate > 0) {
              log_Date = stats.lastDate;
              if (!dash.lastEntry || log_Date > dash.lastEntry) dash.lastEntry = log_Date;
            }
            if (lessonNum > dashHighestNum) {
              dashHighestNum = lessonNum;
              dash.highestLessonName = lessonName;
            }
          }
          
          const total = log_Y + log_N;
          logRows.push([
            currentGroupName, currentTeacher, `Lesson ${col}`, lessonName,
            studentCount, log_Y, log_N, log_A,
            total > 0 ? log_Y / total : 0,
            total > 0 ? log_N / total : 0,
            studentCount > 0 ? log_A / studentCount : 0,
            log_Date
          ]);
        }
      }
    }
  }
  
  if (currentGroupName) {
    dashboardRows.push(buildDashboardRow(currentGroupName, currentTeacher, studentCount, dash));
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// REPAIR FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * REPLACEMENT for repairAllGroupSheetFormatting() in GPProgressEngine.gs
 */
function repairAllGroupSheetFormatting_MixedGrade() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let totalGroupsFormatted = 0;
  
  const sheetsToProcess = [];
  
  if (ENABLE_MIXED_GRADES) {
    for (const sheetName of Object.keys(MIXED_GRADE_CONFIG)) {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) sheetsToProcess.push(sheet);
    }
  }
  
  const standardPattern = /^(PreK|KG|G[1-8]) Groups$/;
  ss.getSheets().forEach(sheet => {
    if (standardPattern.test(sheet.getName())) {
      if (!sheetsToProcess.some(s => s.getName() === sheet.getName())) {
        sheetsToProcess.push(sheet);
      }
    }
  });
  
  sheetsToProcess.forEach(sheet => {
    Logger.log("Processing sheet: " + sheet.getName());
    sheet.clearConditionalFormatRules();
    
    const data = sheet.getDataRange().getValues();
    const lastCol = sheet.getLastColumn();
    
    if (SHEET_FORMAT === "SANKOFA") {
      totalGroupsFormatted += formatSheet_Sankofa(sheet, data, lastCol);
    } else {
      totalGroupsFormatted += formatSheet_Standard(sheet, data, lastCol);
    }
  });
  
  SpreadsheetApp.getUi().alert(
    'Formatting Complete',
    `Applied Y/N/A conditional formatting to ${totalGroupsFormatted} groups.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function formatSheet_Sankofa(sheet, data, lastCol) {
  let groupsFormatted = 0;
  
  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";
    
    if (cellA === "Student Name" && i + 1 < data.length) {
      const nextRow = data[i + 1];
      const groupName = nextRow[SANKOFA_COLUMNS.NEW_GROUP];
      
      if (groupName && groupName.toString().trim()) {
        // Find start and end of student data
        const studentStartRow = i + 2; // Row after lesson row
        const sheetStartRow = studentStartRow + 1; // 1-indexed
        
        let studentEndRow = studentStartRow;
        for (let j = studentStartRow; j < data.length; j++) {
          const checkCell = data[j][0] ? data[j][0].toString().trim() : "";
          if (!checkCell || checkCell === "Student Name") break;
          studentEndRow = j;
        }
        
        const numStudentRows = studentEndRow - studentStartRow + 1;
        
        if (numStudentRows > 0) {
          const numLessonCols = lastCol - SANKOFA_COLUMNS.LESSONS_START;
          
          if (numLessonCols > 0) {
            applyStatusConditionalFormatting(
              sheet,
              sheetStartRow,
              SANKOFA_COLUMNS.LESSONS_START + 1, // 1-indexed
              numStudentRows,
              numLessonCols
            );
            groupsFormatted++;
          }
        }
      }
    }
  }
  
  return groupsFormatted;
}

function formatSheet_Standard(sheet, data, lastCol) {
  let groupsFormatted = 0;
  
  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";
    
    if (isGroupHeader_Standard(cellA, data, i)) {
      const studentStartRow = i + 3;
      const sheetStartRow = studentStartRow + 1;
      
      let studentEndRow = studentStartRow;
      for (let j = studentStartRow; j < data.length; j++) {
        const checkCell = data[j][0] ? data[j][0].toString().trim() : "";
        if (!checkCell || isGroupHeader_Standard(checkCell, data, j)) break;
        if (checkCell === "(No students assigned)") break;
        studentEndRow = j;
      }
      
      const numStudentRows = studentEndRow - studentStartRow + 1;
      
      if (numStudentRows > 0) {
        const numLessonCols = Math.max(lastCol - 1, LAYOUT.LESSONS_PER_GROUP_SHEET);
        applyStatusConditionalFormatting(sheet, sheetStartRow, 2, numStudentRows, numLessonCols);
        groupsFormatted++;
      }
    }
  }
  
  return groupsFormatted;
}


// ═══════════════════════════════════════════════════════════════════════════
// SHEET GENERATION - Create Mixed Grade Sheets (STANDARD Format)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates mixed-grade group sheets in STANDARD format
 * Call this instead of createGradeGroupSheets() for mixed-grade sites
 */
function createMixedGradeGroupSheets(ss, wizardData) {
  if (!ENABLE_MIXED_GRADES) {
    createGradeGroupSheets(ss, wizardData);
    return;
  }
  
  const allStudents = wizardData.students || [];
  
  for (const [sheetName, grades] of Object.entries(MIXED_GRADE_CONFIG)) {
    const groupsInSheet = getGroupsForMixedSheet(wizardData, grades);
    
    if (groupsInSheet.length > 0) {
      createMixedGradeSheet(ss, sheetName, groupsInSheet, allStudents);
    }
  }
}

function getGroupsForMixedSheet(wizardData, grades) {
  const students = wizardData.students || [];
  const groupSet = new Set();
  
  students.forEach(s => {
    if (grades.includes(s.grade) && s.group) {
      groupSet.add(s.group);
    }
  });
  
  return Array.from(groupSet).sort(naturalSort);
}

function createMixedGradeSheet(ss, sheetName, groupNames, allStudents) {
  let sheet = ss.getSheetByName(sheetName);
  
  if (sheet) {
    sheet.clear();
    sheet.clearConditionalFormatRules();
  } else {
    sheet = ss.insertSheet(sheetName);
  }
  
  const columnCount = 1 + LAYOUT.LESSONS_PER_GROUP_SHEET;
  
  // Row 3: Instructional Sequence
  const sequenceRow = ["Instructional Sequence"];
  for (let i = 1; i <= LAYOUT.LESSONS_PER_GROUP_SHEET; i++) sequenceRow.push("");
  sheet.getRange(3, 1, 1, columnCount).setValues([sequenceRow])
    .setBackground("#e8f0fe")
    .setFontStyle("italic")
    .setFontFamily("Calibri");
  
  let currentRow = 4;
  
  groupNames.forEach(groupName => {
    const groupStudents = allStudents.filter(s => s && s.group === groupName);
    
    // Group Header
    createMergedHeader(sheet, currentRow, groupName, columnCount, {
      background: COLORS.HEADER_BG,
      fontColor: COLORS.HEADER_FG,
      fontWeight: "bold",
      fontSize: 12,
      horizontalAlignment: "center"
    });
    currentRow++;
    
    // Column Headers
    const columnHeaders = ["Student Name"];
    for (let i = 1; i <= LAYOUT.LESSONS_PER_GROUP_SHEET; i++) {
      columnHeaders.push(`Lesson ${i}`);
    }
    sheet.getRange(currentRow, 1, 1, columnHeaders.length).setValues([columnHeaders])
      .setBackground(COLORS.TITLE_BG)
      .setFontColor(COLORS.TITLE_FG)
      .setFontWeight("bold");
    currentRow++;
    
    // Sub-header for lesson names
    sheet.getRange(currentRow, 1, 1, columnCount).setBackground(COLORS.SUB_HEADER_BG);
    currentRow++;
    
    // Student rows
    if (groupStudents.length > 0) {
      const studentData = groupStudents.map(student => {
        const row = [normalizeStudent(student).name];
        for (let i = 0; i < LAYOUT.LESSONS_PER_GROUP_SHEET; i++) row.push("");
        return row;
      });
      sheet.getRange(currentRow, 1, studentData.length, columnCount).setValues(studentData);
      applyStatusConditionalFormatting(sheet, currentRow, 2, studentData.length, LAYOUT.LESSONS_PER_GROUP_SHEET);
      currentRow += studentData.length;
    } else {
      sheet.getRange(currentRow, 1).setValue("(No students assigned)")
        .setFontStyle("italic")
        .setFontColor(COLORS.PLACEHOLDER_FG);
      currentRow++;
    }
    
    currentRow++; // Spacer
  });
  
  sheet.setColumnWidth(1, 200);
  sheet.setFrozenRows(3);
}


// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function naturalSort(a, b) {
  const numA = parseInt((a.match(/^(\d+)/) || [])[1]) || 0;
  const numB = parseInt((b.match(/^(\d+)/) || [])[1]) || 0;
  
  if (numA !== numB) {
    return numA - numB;
  }
  
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Test function to verify configuration
 */
function testMixedGradeConfig() {
  Logger.log("=== Mixed Grade Configuration Test ===");
  Logger.log("ENABLE_MIXED_GRADES: " + ENABLE_MIXED_GRADES);
  Logger.log("SHEET_FORMAT: " + SHEET_FORMAT);
  Logger.log("\nConfiguration:");
  
  for (const [sheetName, grades] of Object.entries(MIXED_GRADE_CONFIG)) {
    Logger.log("  " + sheetName + ": " + grades.join(", "));
  }
  
  Logger.log("\n=== Testing getSheetNameForGrade ===");
  ["PreK", "KG", "G1", "G2", "G3", "G4", "G5", "G6"].forEach(grade => {
    Logger.log("  " + grade + " -> " + getSheetNameForGrade(grade));
  });
  
  Logger.log("\n=== Testing getGroupsForForm_MixedGrade ===");
  const groups = getGroupsForForm_MixedGrade();
  Logger.log("Found " + groups.length + " groups:");
  groups.forEach(g => Logger.log("  - " + g));
}


// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION INSTRUCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/*

TO INTEGRATE THIS MODULE:

1. Add this file (MixedGradeSupport_Enhanced.gs) to your Google Apps Script project

2. Configure the settings at the top:
   - ENABLE_MIXED_GRADES = true
   - SHEET_FORMAT = "SANKOFA" (for your existing sheets) or "STANDARD" (for new format)
   - MIXED_GRADE_CONFIG matches your sheet names

3. In GPSetUpWizard.gs:
   
   OPTION A: Replace the functions directly:
   - Rename getGroupsForForm() to getGroupsForForm_OLD()
   - Rename getGroupsForForm_MixedGrade() to getGroupsForForm()
   
   OPTION B: Add redirects:
   
   function getGroupsForForm() {
     return getGroupsForForm_MixedGrade();
   }
   
   function getLessonsAndStudentsForGroup(groupName) {
     return getLessonsAndStudentsForGroup_MixedGrade(groupName);
   }

4. In GPProgressEngine.gs:
   
   Update syncSmallGroupProgress() to cache mixed-grade sheets:
   
   // BEFORE:
   const gradeSheetRegex = /^(PreK|KG|G[1-8]) Groups$/;
   
   // AFTER:
   // Add mixed-grade sheets to the cache
   if (ENABLE_MIXED_GRADES) {
     for (const sheetName of Object.keys(MIXED_GRADE_CONFIG)) {
       const sheet = ss.getSheetByName(sheetName);
       if (sheet) {
         groupSheetsData[sheetName] = {
           sheet: sheet,
           values: sheet.getDataRange().getValues(),
           dirty: false
         };
       }
     }
   }
   
   And update the function calls:
   - updateGroupArrayByLessonName() -> updateGroupArrayByLessonName_MixedGrade()
   - scanGradeSheetsForPacing() -> scanGradeSheetsForPacing_MixedGrade()
   - repairAllGroupSheetFormatting() -> repairAllGroupSheetFormatting_MixedGrade()

5. For creating NEW sheets with wizard:
   - In saveConfiguration(), call createMixedGradeGroupSheets() instead of createGradeGroupSheets()
   - New sheets will use STANDARD format (regardless of SHEET_FORMAT setting)

MIGRATION STRATEGY:

If you want to convert your Sankofa sheets to the new STANDARD format:
1. Set SHEET_FORMAT = "SANKOFA" initially (to read existing data)
2. Use the Import utility to export data to "Small Group Progress" log
3. Delete the old mixed-grade sheets
4. Run the Setup Wizard to create new sheets in STANDARD format
5. The sync will repopulate data from the progress log

*/
// ═══════════════════════════════════════════════════════════════════════════
// ADD THIS FUNCTION TO MixedGradeSupport_Enhanced.gs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets all groups organized by sheet name for the Lesson Entry Form
 * Used by LessonEntryForm_MixedGrade.html
 * 
 * @returns {Object} { groups: [all group names], groupsBySheet: {sheetName: [groups]} }
 */
function getGroupsAndSheets_MixedGrade() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allGroups = [];
  const groupsBySheet = {};
  
  // Scan mixed-grade sheets
  if (ENABLE_MIXED_GRADES) {
    for (const sheetName of Object.keys(MIXED_GRADE_CONFIG)) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) continue;
      
      const data = sheet.getDataRange().getValues();
      const groupsInSheet = [];
      
      for (let i = 0; i < data.length; i++) {
        const cellA = data[i][0] ? data[i][0].toString().trim() : "";
        
        // STANDARD format: Look for "Group N - Name" pattern in column A
        // Followed by "Student Name" row
        if (cellA.toLowerCase().startsWith("group") && i + 1 < data.length) {
          const nextRowA = data[i + 1][0] ? data[i + 1][0].toString().trim() : "";
          if (nextRowA === "Student Name") {
            if (!groupsInSheet.includes(cellA)) {
              groupsInSheet.push(cellA);
              allGroups.push(cellA);
            }
          }
        }
      }
      
      // Sort groups naturally (Group 1, Group 2, ... Group 10)
      groupsInSheet.sort(naturalSort);
      groupsBySheet[sheetName] = groupsInSheet;
    }
  }
  
  // Also check standard single-grade sheets
  const standardPattern = /^(PreK|KG|G[1-8]) Groups$/;
  ss.getSheets().forEach(sheet => {
    const sheetName = sheet.getName();
    if (standardPattern.test(sheetName) && !groupsBySheet[sheetName]) {
      const data = sheet.getDataRange().getValues();
      const groupsInSheet = [];
      
      for (let i = 0; i < data.length; i++) {
        const cellA = data[i][0] ? data[i][0].toString().trim() : "";
        
        // Look for group headers
        if ((cellA.includes("Group") || /^\d+\s*-\s*.+/.test(cellA)) && 
            !cellA.includes("Student") && i + 1 < data.length) {
          const nextRowA = data[i + 1][0] ? data[i + 1][0].toString().trim() : "";
          if (nextRowA === "Student Name") {
            if (!groupsInSheet.includes(cellA)) {
              groupsInSheet.push(cellA);
              allGroups.push(cellA);
            }
          }
        }
      }
      
      groupsInSheet.sort(naturalSort);
      groupsBySheet[sheetName] = groupsInSheet;
    }
  });
  
  Logger.log("Found " + allGroups.length + " total groups across " + Object.keys(groupsBySheet).length + " sheets");
  
  return {
    groups: allGroups.sort(naturalSort),
    groupsBySheet: groupsBySheet
  };
}


/**
 * Natural sort for group names
 * Handles "Group 1", "Group 2", ... "Group 10" correctly
 */
// ═══════════════════════════════════════════════════════════════════════════
// SCHOOL SUMMARY - MIXED GRADE SUPPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Builds the Group Performance section for School Summary
 * Lists all groups from mixed-grade sheets with their metrics
 * 
 * @param {Spreadsheet} ss - Active spreadsheet
 * @returns {Array<Array>} Rows for the Group Performance section
 */
function buildGroupPerformanceSection_MixedGrade(ss) {
  const rows = [];

  // Section header (7 columns to match table width)
  rows.push(["", "", "", "", "", "", ""]);
  rows.push(["✅ Group Performance", "", "", "", "", "", ""]);
  rows.push(["Group", "Grades", "Students", "Pacing", "Pass Rate", "Absent Rate", "Status"]);

  // Get pacing dashboard for group metrics
  // Pacing Dashboard columns (0-indexed):
  //   0=Group, 1=Teacher, 2=Students, 3=Assigned, 4=Tracked,
  //   5=Pacing%, 6=Highest Lesson, 7=Last Entry, 8=Expected Time,
  //   9=Actual Time, 10=Avg Pass%, 11=Avg Not Passed%, 12=Absent Rate
  const pacingDashboard = ss.getSheetByName("Pacing Dashboard");
  const groupMetrics = new Map();

  if (pacingDashboard && pacingDashboard.getLastRow() >= 6) {
    const dashData = pacingDashboard.getDataRange().getValues();
    // Data starts at row 6 (index 5), headers at row 5 (index 4)
    for (let i = COLS.PACING_DASHBOARD.DATA_START_ROW - 1; i < dashData.length; i++) {
      const groupName = dashData[i][COLS.PACING_DASHBOARD.GROUP] ? dashData[i][COLS.PACING_DASHBOARD.GROUP].toString().trim() : "";
      if (!groupName) continue;

      groupMetrics.set(groupName, {
        teacher: dashData[i][COLS.PACING_DASHBOARD.TEACHER] || "",
        students: parseFloat(dashData[i][COLS.PACING_DASHBOARD.STUDENTS]) || 0,
        pacing: parseFloat(dashData[i][COLS.PACING_DASHBOARD.PACING_PCT]) || 0,
        passRate: parseFloat(dashData[i][COLS.PACING_DASHBOARD.PASS_PCT]) || 0,
        absentRate: parseFloat(dashData[i][COLS.PACING_DASHBOARD.ABSENT_RATE]) || 0
      });
    }
  }

  Logger.log(`buildGroupPerformanceSection_MixedGrade: Found ${groupMetrics.size} groups in Pacing Dashboard`);

  // Get grade mapping from Group Configuration
  const groupConfigSheet = ss.getSheetByName(
    (typeof SHEET_NAMES !== 'undefined' && SHEET_NAMES.GROUP_CONFIG)
      ? SHEET_NAMES.GROUP_CONFIG : "Group Configuration"
  );
  const gradeMapping = {};

  if (groupConfigSheet) {
    const configData = groupConfigSheet.getDataRange().getValues();
    for (let i = COLS.GROUP_CONFIG.DATA_START_ROW - 1; i < configData.length; i++) {
      const groupName = configData[i][COLS.GROUP_CONFIG.GROUP_NAME] ? configData[i][COLS.GROUP_CONFIG.GROUP_NAME].toString().trim() : "";
      const grades = configData[i][COLS.GROUP_CONFIG.GRADE] ? configData[i][COLS.GROUP_CONFIG.GRADE].toString().trim() : "";
      if (groupName && grades && groupName !== "Total Groups") {
        gradeMapping[groupName] = grades;
      }
    }
  }

  // Build group rows from pacing dashboard data (source of truth for groups)
  const allGroups = [];
  const alertGroups = [];

  // First add all groups from pacing dashboard
  for (const [groupName, metrics] of groupMetrics) {
    const grades = gradeMapping[groupName] || "";
    const passRate = metrics.passRate;
    const absentRate = metrics.absentRate;

    let status = "🟢 Strong";
    if (passRate < 0.50 || absentRate > 0.15) {
      status = "🔴 Alert";
      alertGroups.push(groupName);
    } else if (passRate < 0.70 || absentRate > 0.10) {
      status = "🟡 Watch";
    } else if (passRate < 0.85) {
      status = "✅ Good";
    }

    // Sort key based on grade
    const gradeOrder = { 'KG': 0, 'G1': 1, 'G2': 2, 'G3': 3, 'G4': 4, 'G5': 5, 'G6': 6, 'G7': 7, 'G8': 8 };
    const firstGrade = grades.split(',')[0].trim();
    const sortKey = gradeOrder[firstGrade] !== undefined ? gradeOrder[firstGrade] : 99;

    allGroups.push({
      name: groupName,
      grades: grades,
      students: metrics.students,
      pacing: metrics.pacing,
      passRate: passRate,
      absentRate: absentRate,
      status: status,
      sortKey: sortKey
    });
  }

  // Also scan mixed-grade sheets for any groups NOT already in pacing dashboard
  for (const sheetName of Object.keys(MIXED_GRADE_CONFIG)) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;

    const data = sheet.getDataRange().getValues();

    for (let i = 0; i < data.length; i++) {
      const cellA = data[i][0] ? data[i][0].toString().trim() : "";

      if (isGroupHeader_Standard(cellA, data, i)) {
        if (!groupMetrics.has(cellA)) {
          // Count students in this group
          let studentCount = 0;
          for (let j = i + 3; j < data.length; j++) {
            const studentName = data[j][0] ? data[j][0].toString().trim() : "";
            if (!studentName || studentName === "Student Name" ||
                isGroupHeader_Standard(studentName, data, j)) break;
            studentCount++;
          }

          const grades = gradeMapping[cellA] || "";
          const firstGrade = grades.split(',')[0].trim();
          const gradeOrder = { 'KG': 0, 'G1': 1, 'G2': 2, 'G3': 3, 'G4': 4, 'G5': 5, 'G6': 6, 'G7': 7, 'G8': 8 };

          allGroups.push({
            name: cellA,
            grades: grades,
            students: studentCount,
            pacing: 0,
            passRate: 0,
            absentRate: 0,
            status: "🔴 Alert",
            sortKey: gradeOrder[firstGrade] !== undefined ? gradeOrder[firstGrade] : 99
          });
          alertGroups.push(cellA);
        }
      }
    }
  }

  // Sort by grade, then by group name
  allGroups.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.name.localeCompare(b.name);
  });

  // Add group rows with numeric values (formatted by applySchoolSummaryFormatting_MixedGrade)
  allGroups.forEach(group => {
    rows.push([group.name, group.grades, group.students, group.pacing, group.passRate, group.absentRate, group.status]);
  });

  // Add alert summary if needed
  if (alertGroups.length > 0) {
    rows.push(["", "", "", "", "", "", ""]);
    const alertMsg = `⚠️ ${alertGroups.length} group(s) need attention: ${alertGroups.join(", ")}`;
    rows.push([alertMsg, "", "", "", "", "", ""]);
  }

  return rows;
}


/**
 * Gets the grade header text for mixed-grade sites
 * Returns "KG • 28 students" instead of "KG • 28 students • 0 groups"
 * 
 * @param {string} grade - Grade code (e.g., "KG", "G1")
 * @param {number} studentCount - Number of students in grade
 * @returns {string} Formatted header text
 */
function getGradeHeaderText_MixedGrade(grade, studentCount) {
  if (ENABLE_MIXED_GRADES) {
    // Don't include group count for mixed-grade sites
    return `${grade}  •  ${studentCount} students`;
  }
  
  // Standard format would include groups
  return `${grade}  •  ${studentCount} students`;
}


/**
 * INTEGRATION INSTRUCTIONS:
 * 
 * In GPProgressEngine.gs, find the updateSchoolSummary() function.
 * 
 * 1. Find where grade headers are built (look for student count and group count):
 *    
 *    CHANGE FROM something like:
 *    const headerText = `${grade}  •  ${studentCount} students  •  ${groupCount} groups`;
 *    
 *    TO:
 *    const headerText = ENABLE_MIXED_GRADES 
 *      ? getGradeHeaderText_MixedGrade(grade, studentCount)
 *      : `${grade}  •  ${studentCount} students  •  ${groupCount} groups`;
 * 
 * 
 * 2. At the END of updateSchoolSummary(), before writing to the sheet, add:
 *    
 *    // Add Group Performance section for mixed-grade sites
 *    if (ENABLE_MIXED_GRADES) {
 *      const groupPerformanceRows = buildGroupPerformanceSection_MixedGrade(ss);
 *      outputRows.push(...groupPerformanceRows);
 *    }
 * 
 * 
 * 3. Make sure the Group Performance section gets proper formatting:
 *    - "✅ Group Performance" header should be bold/larger
 *    - Column headers (Group, Teacher, Students, Pass Rate, Status) should be bold
 *    - Status emojis will color-code automatically
 */


// ═══════════════════════════════════════════════════════════════════════════
// ALTERNATIVE: Complete replacement function for updateSchoolSummary
// Use this if you want a full replacement rather than modifying existing code
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Updates School Summary with mixed-grade support
 * Call this instead of the standard updateSchoolSummary() for mixed-grade sites
 */
function updateSchoolSummary_MixedGrade() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName("School Summary");

  if (!summarySheet) {
    Logger.log("School Summary sheet not found");
    return;
  }

  // Get configuration
  const configSheet = ss.getSheetByName("Group Configuration");
  const rosterSheet = ss.getSheetByName("Student Roster");
  const ufliMap = ss.getSheetByName("UFLI MAP");

  // Build grade metrics from Student Roster / UFLI MAP
  const gradeMetrics = buildGradeMetrics(ss);

  // Get list of grades to display
  const gradesToShow = getGradesFromConfig(configSheet);

  // Build output rows (7 columns to accommodate Group Performance table)
  const outputRows = [];

  // Header
  const siteName = getSiteName(ss);
  outputRows.push(["📊  SCHOOL SUMMARY DASHBOARD", "", "", "", "", "", ""]);
  outputRows.push([siteName, "", "", "Updated: " + formatDate(new Date()), "", "", ""]);
  outputRows.push(["Growth & Pacing Metrics: Initial average, current average, growth percentage, and instructional pacing rate  •  Student Distribution: Visual breakdown of students On Track (80%+), Progressing (50-79%), and Needs Support (<50%)  •  Group Performance Table: Pass rate and Absenteeism rate for each instructional group with status indicators", "", "", "", "", "", ""]);
  outputRows.push(["", "", "", "", "", "", ""]);
  outputRows.push(["", "", "", "", "", "", ""]);

  // Grade sections
  gradesToShow.forEach(grade => {
    const metrics = gradeMetrics.get(grade) || getDefaultGradeMetrics();

    // Grade header - NO GROUP COUNT for mixed-grade sites
    outputRows.push([`${grade}  •  ${metrics.studentCount} students`, "", "", "", "", "", ""]);
    outputRows.push(["", "", "", "", "", "", ""]);

    // Growth & Pacing
    outputRows.push(["📈 Growth & Pacing", "", "", "", "", "", ""]);
    outputRows.push(["Metric", "Initial", "Current", "Growth", "Pacing", "", ""]);
    outputRows.push(["Foundational Skills", formatPercent(metrics.foundInitial), formatPercent(metrics.foundCurrent), formatGrowth(metrics.foundGrowth), formatPercent(metrics.pacing), "", ""]);
    outputRows.push(["Min Grade Skills", formatPercent(metrics.minInitial), formatPercent(metrics.minCurrent), formatGrowth(metrics.minGrowth), "", "", ""]);
    outputRows.push(["Full Grade Skills", formatPercent(metrics.fullInitial), formatPercent(metrics.fullCurrent), formatGrowth(metrics.fullGrowth), "", "", ""]);
    outputRows.push(["", "", "", "", "", "", ""]);

    // Student Distribution
    outputRows.push(["📊 Student Distribution", "", "", "", "", "", ""]);
    outputRows.push(["On Track (80%+)", `${metrics.onTrack} students (${formatPercent(metrics.onTrackPct)})`, "", "", metrics.onTrack > 0 ? "●" : "○", "", ""]);
    outputRows.push(["Progressing (50-79%)", `${metrics.progressing} students (${formatPercent(metrics.progressingPct)})`, "", "", metrics.progressing > 0 ? (metrics.progressing > metrics.onTrack ? "●" : "◐") : "○", "", ""]);
    outputRows.push(["Needs Support (<50%)", `${metrics.needsSupport} students (${formatPercent(metrics.needsSupportPct)})`, "", "", metrics.needsSupport > 0 ? (metrics.needsSupport > metrics.progressing ? "●" : "◐") : "○", "", ""]);
    outputRows.push(["", "", "", "", "", "", ""]);
    outputRows.push(["", "", "", "", "", "", ""]);
    outputRows.push(["", "", "", "", "", "", ""]);
  });

  // Add Group Performance section at the bottom
  if (ENABLE_MIXED_GRADES) {
    const groupRows = buildGroupPerformanceSection_MixedGrade(ss);
    outputRows.push(...groupRows);
  }

  // Write to sheet (clear everything including old merges/formatting so fresh formatting applies cleanly)
  summarySheet.clear();
  if (outputRows.length > 0) {
    summarySheet.getRange(1, 1, outputRows.length, 7).setValues(outputRows);
  }

  // Apply formatting
  applySchoolSummaryFormatting_MixedGrade(summarySheet, gradesToShow.length);

  Logger.log("School Summary updated with " + gradesToShow.length + " grades");
}


// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getDefaultGradeMetrics() {
  return {
    studentCount: 0,
    foundInitial: 0, foundCurrent: 0, foundGrowth: 0,
    minInitial: 0, minCurrent: 0, minGrowth: 0,
    fullInitial: 0, fullCurrent: 0, fullGrowth: 0,
    pacing: 0,
    onTrack: 0, onTrackPct: 0,
    progressing: 0, progressingPct: 0,
    needsSupport: 0, needsSupportPct: 0
  };
}

function formatPercent(value) {
  if (typeof value !== 'number' || isNaN(value)) return "0%";
  return Math.round(value * 100) + "%";
}

function formatGrowth(value) {
  if (typeof value !== 'number' || isNaN(value)) return "+0%";
  const rounded = Math.round(value * 100);
  return (rounded >= 0 ? "+" : "") + rounded + "%";
}

function formatDate(date) {
  return (date.getMonth() + 1) + "/" + date.getDate() + "/" + date.getFullYear();
}

function getSiteName(ss) {
  const configSheet = ss.getSheetByName("Site Configuration");
  if (configSheet) {
    const data = configSheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === "School Name" && data[i][1]) {
        return data[i][1];
      }
    }
  }
  return ss.getName().split(" - ")[0] || "School";
}

function getGradesFromConfig(configSheet) {
  const grades = [];
  if (!configSheet) return ["KG", "G1", "G2", "G3", "G4", "G5", "G6"];
  
  const data = configSheet.getDataRange().getValues();
  const gradeSet = new Set();
  
  for (let i = 0; i < data.length; i++) {
    const gradeCell = data[i][COLS.GROUP_CONFIG.GRADE]; // Grade column
    if (gradeCell && typeof gradeCell === 'string') {
      // Parse grades like "KG, G1" or "G4, G5, G6"
      gradeCell.split(",").forEach(g => {
        const grade = g.trim();
        if (grade && /^(PreK|KG|G[1-8])$/.test(grade)) {
          gradeSet.add(grade);
        }
      });
    }
  }
  
  // Sort grades in order
  const gradeOrder = ["PreK", "KG", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"];
  return gradeOrder.filter(g => gradeSet.has(g));
}

function buildGradeMetrics(ss) {
  const metrics = new Map();

  // ─── Use the SAME data sources as the standard updateSchoolSummary ───
  // Grade Summary: keyed by student name, row = [Name, Grade, Teacher, Group, Foundational%, MinGrade%, FullGrade%]
  const studentData = getSheetDataAsMap(ss, SHEET_NAMES_V2.GRADE_SUMMARY);
  // Initial Assessment: keyed by student name, row = lesson scores
  const initialData = getSheetDataAsMap(ss, SHEET_NAMES_V2.INITIAL_ASSESSMENT);

  if (studentData.size === 0) return metrics;

  // Group students by grade (from Grade Summary column B)
  const studentsByGrade = {};
  studentData.forEach((row, name) => {
    const grade = row[COLS.GRADE_SUMMARY.GRADE] ? row[COLS.GRADE_SUMMARY.GRADE].toString().trim() : "";
    if (!grade) return;
    if (!studentsByGrade[grade]) studentsByGrade[grade] = [];
    studentsByGrade[grade].push(row);
  });

  // Get student count overrides from Group Configuration (for students not yet in Grade Summary)
  const configCounts = (typeof getGradeCountsFromConfig === 'function')
    ? getGradeCountsFromConfig(ss) : {};

  // ─── Calculate growth, distribution, and pacing for each grade ───
  for (const [grade, students] of Object.entries(studentsByGrade)) {
    const totalCount = configCounts[grade] || students.length;

    // Use the SAME growth calculation as the standard dashboard
    const growth = calculateGrowthMetrics(students, initialData, grade);
    const bands = calculateDistributionBands(students);

    metrics.set(grade, {
      studentCount: totalCount,
      // Growth values (calculateGrowthMetrics returns 0-100, convert to 0-1 decimal)
      foundInitial: growth.foundInitialAvg / 100,
      foundCurrent: growth.foundCurrentAvg / 100,
      foundGrowth: growth.foundGrowth / 100,
      minInitial: growth.minInitialAvg / 100,
      minCurrent: growth.minCurrentAvg / 100,
      minGrowth: growth.minGrowth / 100,
      fullInitial: growth.fullInitialAvg / 100,
      fullCurrent: growth.fullCurrentAvg / 100,
      fullGrowth: growth.fullGrowth / 100,
      // Pacing (populated below)
      pacing: 0,
      // Distribution
      onTrack: bands.onTrack,
      onTrackPct: students.length > 0 ? bands.onTrack / students.length : 0,
      progressing: bands.progressing,
      progressingPct: students.length > 0 ? bands.progressing / students.length : 0,
      needsSupport: bands.atRisk,
      needsSupportPct: students.length > 0 ? bands.atRisk / students.length : 0
    });
  }

  // Also add grades from configCounts that aren't in Grade Summary yet
  for (const [grade, count] of Object.entries(configCounts)) {
    if (!metrics.has(grade) && count > 0) {
      metrics.set(grade, { ...getDefaultGradeMetrics(), studentCount: count });
    }
  }

  // ─── Read Pacing Dashboard to get per-grade pacing rates ───
  const pacingSheet = ss.getSheetByName("Pacing Dashboard");
  if (pacingSheet && pacingSheet.getLastRow() >= 6) {
    const pacingData = pacingSheet.getDataRange().getValues();

    // Build grade mapping from Group Configuration: groupName -> grade(s)
    const groupConfigSheet = ss.getSheetByName(
      (typeof SHEET_NAMES !== 'undefined' && SHEET_NAMES.GROUP_CONFIG)
        ? SHEET_NAMES.GROUP_CONFIG : "Group Configuration"
    );
    const groupToGrade = {};
    if (groupConfigSheet) {
      const configData = groupConfigSheet.getDataRange().getValues();
      for (let i = COLS.GROUP_CONFIG.DATA_START_ROW - 1; i < configData.length; i++) {
        const groupName = configData[i][COLS.GROUP_CONFIG.GROUP_NAME] ? configData[i][COLS.GROUP_CONFIG.GROUP_NAME].toString().trim() : "";
        const grade = configData[i][COLS.GROUP_CONFIG.GRADE] ? configData[i][COLS.GROUP_CONFIG.GRADE].toString().trim() : "";
        if (groupName && grade && groupName !== "Total Groups") {
          groupToGrade[groupName] = grade;
        }
      }
    }

    // Aggregate pacing by grade from Pacing Dashboard (col 5 = Pacing %)
    const gradeAgg = {};
    for (let i = COLS.PACING_DASHBOARD.DATA_START_ROW - 1; i < pacingData.length; i++) {
      const groupName = pacingData[i][COLS.PACING_DASHBOARD.GROUP] ? pacingData[i][COLS.PACING_DASHBOARD.GROUP].toString().trim() : "";
      if (!groupName) continue;

      let gradeStr = groupToGrade[groupName] || "";
      if (!gradeStr) {
        const gradeMatch = groupName.match(/^(PreK|KG|G[1-8])/);
        if (gradeMatch) gradeStr = gradeMatch[1];
      }
      if (!gradeStr) continue;

      const pacingVal = parseFloat(pacingData[i][COLS.PACING_DASHBOARD.PACING_PCT]) || 0;

      // Split multi-grade strings (e.g., "KG, G1") and attribute to each grade
      const grades = gradeStr.split(",").map(g => g.trim()).filter(g => g);
      grades.forEach(grade => {
        if (!gradeAgg[grade]) gradeAgg[grade] = { sum: 0, count: 0 };
        gradeAgg[grade].sum += pacingVal;
        gradeAgg[grade].count++;
      });
    }

    for (const [grade, agg] of Object.entries(gradeAgg)) {
      if (agg.count > 0 && metrics.has(grade)) {
        metrics.get(grade).pacing = agg.sum / agg.count;
      }
    }
  }

  return metrics;
}

function applySchoolSummaryFormatting_MixedGrade(sheet, gradeCount) {
  // Use same color palette as standard dashboard
  const COLORS = typeof DASHBOARD_COLORS !== 'undefined' ? DASHBOARD_COLORS : {
    HEADER_BG: "#1a73e8", HEADER_TEXT: "#ffffff",
    GRADE_HEADER_BG: "#4285f4", GRADE_HEADER_TEXT: "#ffffff",
    SECTION_LABEL: "#5f6368", TABLE_HEADER_BG: "#e8eaed",
    TABLE_ALT_ROW: "#f8f9fa", CARD_BORDER: "#dadce0",
    ON_TRACK: "#34a853", ON_TRACK_BG: "#e6f4ea",
    PROGRESSING: "#fbbc04", PROGRESSING_BG: "#fef7e0",
    AT_RISK: "#ea4335", AT_RISK_BG: "#fce8e6"
  };

  // Title row
  sheet.getRange(1, 1, 1, 7).merge();
  sheet.getRange(1, 1).setFontSize(14).setFontWeight("bold")
    .setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_TEXT).setHorizontalAlignment("center");
  sheet.setRowHeight(1, 40);

  // Site name
  sheet.getRange(2, 1, 1, 7).merge();
  sheet.getRange(2, 1).setFontSize(12).setFontWeight("bold");

  // Description row - merge across A:G with wrap for long text
  sheet.getRange(3, 1, 1, 7).merge();
  sheet.getRange(3, 1).setFontSize(9).setFontStyle("italic").setWrap(true);
  sheet.setRowHeight(3, 50);

  // Column widths for 7-column layout
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 80);
  sheet.setColumnWidth(6, 90);
  sheet.setColumnWidth(7, 90);

  // Scan data to format grade sections and Group Performance
  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString() : "";
    const rowNum = i + 1; // 1-based

    // ─── Grade headers (e.g., "KG  •  40 students") ───
    if (cellA.match(/^(PreK|KG|G[1-8])\s+•\s+\d+ students$/)) {
      sheet.getRange(rowNum, 1, 1, 7).merge();
      sheet.getRange(rowNum, 1)
        .setBackground(COLORS.GRADE_HEADER_BG)
        .setFontColor(COLORS.GRADE_HEADER_TEXT)
        .setFontSize(13)
        .setFontWeight("bold")
        .setVerticalAlignment("middle");
      sheet.setRowHeight(rowNum, 36);
    }

    // ─── Section labels (📈 Growth & Pacing, 📊 Student Distribution) ───
    else if (cellA.startsWith("📈") || cellA === "📊 Student Distribution") {
      sheet.getRange(rowNum, 1)
        .setFontWeight("bold")
        .setFontSize(11)
        .setFontColor(COLORS.SECTION_LABEL);
    }

    // ─── Growth & Pacing table header row ("Metric | Initial | Current | Growth | Pacing") ───
    else if (cellA === "Metric" && data[i][1] && data[i][1].toString() === "Initial") {
      sheet.getRange(rowNum, 1, 1, 5)
        .setBackground(COLORS.TABLE_HEADER_BG)
        .setFontWeight("bold")
        .setFontSize(10)
        .setHorizontalAlignment("center");
      sheet.setRowHeight(rowNum, 26);
    }

    // ─── Growth & Pacing data rows ───
    else if (cellA === "Foundational Skills" || cellA === "Min Grade Skills" || cellA === "Full Grade Skills") {
      sheet.getRange(rowNum, 1, 1, 5)
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle")
        .setFontSize(10);
      sheet.getRange(rowNum, 1).setHorizontalAlignment("left").setFontWeight("bold");
      sheet.setRowHeight(rowNum, 28);

      // Alternating row for Min Grade Skills
      if (cellA === "Min Grade Skills") {
        sheet.getRange(rowNum, 1, 1, 5).setBackground(COLORS.TABLE_ALT_ROW);
      }

      // Color-code growth values in column D (col 4)
      const growthText = data[i][3] ? data[i][3].toString() : "";
      const growthVal = parseInt(growthText.replace(/[+%]/g, "")) || 0;
      if (growthVal > 5) {
        sheet.getRange(rowNum, 4).setFontColor(COLORS.ON_TRACK).setFontWeight("bold");
      } else if (growthVal < 0) {
        sheet.getRange(rowNum, 4).setFontColor(COLORS.AT_RISK).setFontWeight("bold");
      }
    }

    // ─── Student Distribution rows ───
    else if (cellA.startsWith("On Track") || cellA.startsWith("Progressing") || cellA.startsWith("Needs Support")) {
      sheet.getRange(rowNum, 1).setFontWeight("bold").setFontSize(10);
      sheet.getRange(rowNum, 2).setFontSize(10);
      sheet.setRowHeight(rowNum, 26);

      if (cellA.startsWith("On Track")) {
        sheet.getRange(rowNum, 1).setFontColor(COLORS.ON_TRACK);
        sheet.getRange(rowNum, 5).setFontColor(COLORS.ON_TRACK).setFontSize(14);
      } else if (cellA.startsWith("Progressing")) {
        sheet.getRange(rowNum, 1).setFontColor(COLORS.PROGRESSING);
        sheet.getRange(rowNum, 5).setFontColor(COLORS.PROGRESSING).setFontSize(14);
      } else if (cellA.startsWith("Needs Support")) {
        sheet.getRange(rowNum, 1).setFontColor(COLORS.AT_RISK);
        sheet.getRange(rowNum, 5).setFontColor(COLORS.AT_RISK).setFontSize(14);
      }
    }

    // ─── Group Performance section ───
    else if (cellA === "✅ Group Performance") {
      sheet.getRange(rowNum, 1).setFontSize(12).setFontWeight("bold").setFontFamily("Calibri");

      // Table column headers row
      const headerRowNum = rowNum + 1;
      sheet.getRange(headerRowNum, 1, 1, 7)
        .setFontWeight("bold")
        .setFontStyle("italic")
        .setFontFamily("Calibri")
        .setFontSize(10)
        .setBackground(COLORS.TABLE_HEADER_BG)
        .setHorizontalAlignment("center");

      // Count data rows (stop at empty group name or alert)
      let dataRowCount = 0;
      for (let r = i + 2; r < data.length; r++) {
        const val = data[r] ? (data[r][0] ? data[r][0].toString() : "") : "";
        if (!val || val.startsWith("⚠")) break;
        dataRowCount++;
      }

      if (dataRowCount > 0) {
        sheet.getRange(headerRowNum + 1, 1, dataRowCount, 7)
          .setFontFamily("Calibri")
          .setFontSize(10);
        sheet.getRange(headerRowNum + 1, 3, dataRowCount, 1).setNumberFormat("0");
        sheet.getRange(headerRowNum + 1, 4, dataRowCount, 3).setNumberFormat("0%");
        sheet.getRange(headerRowNum + 1, 3, dataRowCount, 4).setHorizontalAlignment("center");

        for (let r = 0; r < dataRowCount; r++) {
          if (r % 2 === 1) {
            sheet.getRange(headerRowNum + 1 + r, 1, 1, 7).setBackground(COLORS.TABLE_ALT_ROW);
          }
        }
      }

      // Alert row merge
      for (let r = i + 2 + dataRowCount; r < data.length; r++) {
        const val = data[r] ? (data[r][0] ? data[r][0].toString() : "") : "";
        if (val.startsWith("⚠")) {
          const alertRowNum = r + 1;
          sheet.getRange(alertRowNum, 1, 1, 7).merge();
          sheet.getRange(alertRowNum, 1)
            .setWrap(true)
            .setFontSize(10)
            .setFontWeight("bold")
            .setFontColor(COLORS.AT_RISK)
            .setFontFamily("Calibri");
          sheet.setRowHeight(alertRowNum, 60);
          break;
        }
      }
    }
  }
}
/**
 * Renders Group Performance table for mixed-grade sites
 * Shows all groups regardless of grade, at the bottom of School Summary
 */
function renderMixedGradeGroupTable(sheet, row, pacingData) {
  Logger.log('[renderMixedGradeGroupTable] Starting at row ' + row + ' with ' + pacingData.length + ' pacing entries');

  // Section label
  sheet.getRange(row, 1).setValue("✅ Group Performance")
    .setFontWeight("bold")
    .setFontSize(11)
    .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
  row++;
  
  // Headers
  const headers = ["Group", "Grades", "Students", "Pacing", "Pass Rate", "Absent Rate", "Status"];
  sheet.getRange(row, 1, 1, 7).setValues([headers])
    .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center");
  sheet.setRowHeight(row, 26);
  row++;
  
  // Get grade mapping from Group Configuration
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupConfigSheet = ss.getSheetByName(SHEET_NAMES.GROUP_CONFIG);
  const gradeMapping = {};
  
  if (groupConfigSheet) {
    const configData = groupConfigSheet.getDataRange().getValues();
    for (let i = COLS.GROUP_CONFIG.DATA_START_ROW - 1; i < configData.length; i++) {
      const groupName = configData[i][COLS.GROUP_CONFIG.GROUP_NAME] ? configData[i][COLS.GROUP_CONFIG.GROUP_NAME].toString().trim() : "";
      const grades = configData[i][COLS.GROUP_CONFIG.GRADE] ? configData[i][COLS.GROUP_CONFIG.GRADE].toString().trim() : "";
      if (groupName && grades && groupName !== "Total Groups") {
        gradeMapping[groupName] = grades;
      }
    }
  }

  // Process groups and add grade info
  let flaggedGroups = [];
  
  const tableData = pacingData.map((g, index) => {
    const groupName = g[COLS.PACING_DASHBOARD.GROUP] ? g[COLS.PACING_DASHBOARD.GROUP].toString() : "";
    const studentCount = parseFloat(g[COLS.PACING_DASHBOARD.STUDENTS]) || 0;
    const pacing = parseFloat(g[COLS.PACING_DASHBOARD.PACING_PCT]) || 0;
    const passRate = parseFloat(g[COLS.PACING_DASHBOARD.PASS_PCT]) || 0;
    const absentRate = parseFloat(g[COLS.PACING_DASHBOARD.ABSENT_RATE]) || 0;
    
    // Get grades for this group
    const grades = gradeMapping[groupName] || "";
    
    // Determine status
    let status = "✅ Good";
    if (passRate < 0.50 || absentRate > 0.15) {
      status = "🔴 Alert";
      flaggedGroups.push(groupName);
    } else if (passRate < 0.70 || absentRate > 0.10) {
      status = "🟡 Watch";
    } else if (passRate >= 0.85) {
      status = "🟢 Strong";
    }
    
    // Sort key based on grade
    const gradeOrder = { 'KG': 0, 'G1': 1, 'G2': 2, 'G3': 3, 'G4': 4, 'G5': 5, 'G6': 6, 'G7': 7, 'G8': 8 };
    const firstGrade = grades.split(',')[0].trim();
    const sortKey = gradeOrder[firstGrade] !== undefined ? gradeOrder[firstGrade] : 99;
    
    return {
      data: [groupName, grades, studentCount, pacing, passRate, absentRate, status],
      sortKey: sortKey,
      groupName: groupName
    };
  }).filter(item => item.data[0]);
  
  // Sort by grade, then by group name
  tableData.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.groupName.localeCompare(b.groupName);
  });

  Logger.log('[renderMixedGradeGroupTable] Found ' + tableData.length + ' groups to display');

  // Write table data
  if (tableData.length > 0) {
    const rows = tableData.map(item => item.data);

    sheet.getRange(row, 1, rows.length, 7).setValues(rows)
      .setFontSize(10)
      .setVerticalAlignment("middle");
    
    // Format Students column as number (column 3)
    sheet.getRange(row, 3, rows.length, 1).setNumberFormat("0");
    
    // Format percentage columns (Pacing, Pass Rate, Absent Rate - columns 4, 5, 6)
    sheet.getRange(row, 4, rows.length, 3).setNumberFormat("0%");
    
    // Center align numeric columns (columns 3-6)
    sheet.getRange(row, 3, rows.length, 4).setHorizontalAlignment("center");
    
    // Alternating row colors
    for (let i = 0; i < rows.length; i++) {
      if (i % 2 === 1) {
        sheet.getRange(row + i, 1, 1, 7).setBackground(DASHBOARD_COLORS.TABLE_ALT_ROW);
      }
      sheet.setRowHeight(row + i, 24);
    }
    
    row += rows.length;
  } else {
    // No data yet - show informative message
    sheet.getRange(row, 1).setValue("No group data available yet. Submit lesson data to populate this table.")
      .setFontStyle("italic")
      .setFontColor("#666666");
    row++;
  }

  // Flags summary if any (no merge)
  if (flaggedGroups.length > 0) {
    sheet.getRange(row, 1).setValue(`⚠️ ${flaggedGroups.length} group(s) need attention: ${flaggedGroups.join(", ")}`);
    sheet.getRange(row, 1, 1, 7).setBackground("#fff8e1"); // Light warning background
    sheet.getRange(row, 1).setFontColor(DASHBOARD_COLORS.AT_RISK)
      .setFontSize(10)
      .setFontStyle("italic")
      .setFontFamily("Calibri")
      .setWrap(true);
    sheet.setRowHeight(row, 36);
    row++;
  }
  
  // Spacer
  sheet.setRowHeight(row, 8);
  row++;
  
  return row;
}
