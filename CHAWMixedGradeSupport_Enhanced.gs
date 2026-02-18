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
const ENABLE_MIXED_GRADES = true;

/**
 * Sheet Format Type
 * - "STANDARD": Group header in column A (merged), followed by "Student Name" row
 * - "SANKOFA": "Student Name" row, followed by row with group name in column D
 */
const SHEET_FORMAT = "STANDARD";  // Change to "STANDARD" for new format

/**
 * Mixed Grade Sheet Configuration
 * 
 * Define which grades are combined and their sheet names.
 * Format: { sheetName: [array of grades], ... }
 */
const MIXED_GRADE_CONFIG = {
  // Sheet Name : Grades included
  "KG and G1 Groups": ["KG", "G1"],
  "G2 and G3 Groups": ["G2", "G3"],
  "G4 to G6 Groups": ["G4", "G5", "G6"]
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
 * REPLACEMENT for getLessonsAndStudentsForGroup() in GPSetUpWizard.gs
 * Gets lessons and students for a group
 * 
 * @param {string} groupName - Group name (e.g., "1 - T. Jones", "KG Group 1")
 * @returns {Object} {lessons: [{id, name}], students: [names]}
 */
function getLessonsAndStudentsForGroup_MixedGrade(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Logger.log("=== getLessonsAndStudentsForGroup_MixedGrade ===");
  Logger.log("Group requested: " + groupName);
  
  // Handle PreK separately
  if (groupName.toLowerCase().includes("prek")) {
    return getLessonsAndStudentsForPreKGroup(groupName);
  }
  
  // Find which sheet contains this group
  const sheetName = getSheetNameForGroup(groupName);
  
  if (!sheetName) {
    Logger.log("ERROR: Could not find sheet for group: " + groupName);
    return { error: "Could not find sheet for group '" + groupName + "'" };
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
function naturalSort(a, b) {
  // Extract numbers from group names
  const numA = parseInt((a.match(/\d+/) || [])[0]) || 0;
  const numB = parseInt((b.match(/\d+/) || [])[0]) || 0;
  
  if (numA !== numB) {
    return numA - numB;
  }
  
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
// ═══════════════════════════════════════════════════════════════════════════
// SCHOOL SUMMARY - MIXED GRADE SUPPORT
// Add this to MixedGradeSupport_Enhanced.gs
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
  
  // Section header
  rows.push(["", "", "", "", ""]);
  rows.push(["✅ Group Performance", "", "", "", ""]);
  rows.push(["Group", "Teacher", "Students", "Pass Rate", "Status"]);
  
  // Get pacing dashboard for group metrics
  const pacingDashboard = ss.getSheetByName("Pacing Dashboard");
  const groupMetrics = new Map();
  
  if (pacingDashboard) {
    const dashData = pacingDashboard.getDataRange().getValues();
    // Find header row
    let headerRow = -1;
    for (let i = 0; i < dashData.length; i++) {
      if (dashData[i][0] === "Group Name") {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow >= 0) {
      // Build metrics map
      for (let i = headerRow + 1; i < dashData.length; i++) {
        const groupName = dashData[i][0];
        if (!groupName) continue;
        
        groupMetrics.set(groupName, {
          teacher: dashData[i][1] || "",
          students: dashData[i][2] || 0,
          passRate: dashData[i][8] || 0,  // Adjust column index based on your layout
          absentRate: dashData[i][10] || 0
        });
      }
    }
  }
  
  // Collect all groups from mixed-grade sheets
  const allGroups = [];
  const alertGroups = [];
  
  for (const sheetName of Object.keys(MIXED_GRADE_CONFIG)) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 0; i < data.length; i++) {
      const cellA = data[i][0] ? data[i][0].toString().trim() : "";
      
      // Look for group headers (STANDARD format)
      if (cellA.toLowerCase().startsWith("group") && i + 1 < data.length) {
        const nextRowA = data[i + 1][0] ? data[i + 1][0].toString().trim() : "";
        if (nextRowA === "Student Name") {
          // Count students in this group
          let studentCount = 0;
          for (let j = i + 3; j < data.length; j++) {
            const studentName = data[j][0] ? data[j][0].toString().trim() : "";
            if (!studentName || studentName === "Student Name" || studentName.toLowerCase().startsWith("group")) {
              break;
            }
            studentCount++;
          }
          
          // Extract teacher name from group name
          const teacherMatch = cellA.match(/[-–]\s*(.+)$/);
          const teacherName = teacherMatch ? teacherMatch[1].trim() : "";
          
          // Get metrics from pacing dashboard or default
          const metrics = groupMetrics.get(cellA) || {
            teacher: teacherName,
            students: studentCount,
            passRate: 0,
            absentRate: 0
          };
          
          // Determine status
          let status = "🟢 On Track";
          const passRate = typeof metrics.passRate === 'number' ? metrics.passRate : 0;
          
          if (passRate < 0.5) {
            status = "🔴 Alert";
            alertGroups.push(cellA);
          } else if (passRate < 0.7) {
            status = "🟡 Monitor";
          }
          
          // Format pass rate
          const passRateStr = typeof metrics.passRate === 'number' 
            ? Math.round(metrics.passRate * 100) + "%" 
            : "0%";
          
          allGroups.push({
            name: cellA,
            teacher: metrics.teacher || teacherName,
            students: metrics.students || studentCount,
            passRate: passRateStr,
            status: status
          });
        }
      }
    }
  }
  
  // Sort groups naturally
  allGroups.sort((a, b) => naturalSort(a.name, b.name));
  
  // Add group rows
  allGroups.forEach(group => {
    rows.push([group.name, group.teacher, group.students, group.passRate, group.status]);
  });
  
  // Add alert summary if needed
  if (alertGroups.length > 0) {
    rows.push(["", "", "", "", ""]);
    const alertMsg = `⚠️ ${alertGroups.length} group(s) need attention: ${alertGroups.slice(0, 5).join(", ")}${alertGroups.length > 5 ? "..." : ""}`;
    rows.push([alertMsg, "", "", "", ""]);
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
  
  // Build output rows
  const outputRows = [];
  
  // Header
  const siteName = getSiteName(ss);
  outputRows.push(["📊  SCHOOL SUMMARY DASHBOARD", "", "", "", ""]);
  outputRows.push([siteName, "", "", "Updated: " + formatDate(new Date()), ""]);
  outputRows.push(["Growth & Pacing Metrics: Initial average, current average, growth percentage, and instructional pacing rate  •  Student Distribution: Visual breakdown of students On Track (80%+), Progressing (50-79%), and Needs Support (<50%)  •  Group Performance Table: Pass rate and Absenteeism rate for each instructional group with status indicators", "", "", "", ""]);
  outputRows.push(["", "", "", "", ""]);
  outputRows.push(["", "", "", "", ""]);
  
  // Grade sections
  gradesToShow.forEach(grade => {
    const metrics = gradeMetrics.get(grade) || getDefaultGradeMetrics();
    
    // Grade header - NO GROUP COUNT for mixed-grade sites
    outputRows.push([`${grade}  •  ${metrics.studentCount} students`, "", "", "", ""]);
    outputRows.push(["", "", "", "", ""]);
    
    // Growth & Pacing
    outputRows.push(["📈 Growth & Pacing", "", "", "", ""]);
    outputRows.push(["Metric", "Initial", "Current", "Growth", "Pacing"]);
    outputRows.push(["Foundational Skills", formatPercent(metrics.foundInitial), formatPercent(metrics.foundCurrent), formatGrowth(metrics.foundGrowth), formatPercent(metrics.pacing)]);
    outputRows.push(["Min Grade Skills", formatPercent(metrics.minInitial), formatPercent(metrics.minCurrent), formatGrowth(metrics.minGrowth), ""]);
    outputRows.push(["Full Grade Skills", formatPercent(metrics.fullInitial), formatPercent(metrics.fullCurrent), formatGrowth(metrics.fullGrowth), ""]);
    outputRows.push(["", "", "", "", ""]);
    
    // Student Distribution
    outputRows.push(["📊 Student Distribution", "", "", "", ""]);
    outputRows.push(["On Track (80%+)", `${metrics.onTrack} students (${formatPercent(metrics.onTrackPct)})`, "", "", metrics.onTrack > 0 ? "●" : "○"]);
    outputRows.push(["Progressing (50-79%)", `${metrics.progressing} students (${formatPercent(metrics.progressingPct)})`, "", "", metrics.progressing > 0 ? (metrics.progressing > metrics.onTrack ? "●" : "◐") : "○"]);
    outputRows.push(["Needs Support (<50%)", `${metrics.needsSupport} students (${formatPercent(metrics.needsSupportPct)})`, "", "", metrics.needsSupport > 0 ? (metrics.needsSupport > metrics.progressing ? "●" : "◐") : "○"]);
    outputRows.push(["", "", "", "", ""]);
    outputRows.push(["", "", "", "", ""]);
    outputRows.push(["", "", "", "", ""]);
  });
  
  // Add Group Performance section at the bottom
  if (ENABLE_MIXED_GRADES) {
    const groupRows = buildGroupPerformanceSection_MixedGrade(ss);
    outputRows.push(...groupRows);
  }
  
  // Write to sheet
  summarySheet.clearContents();
  if (outputRows.length > 0) {
    summarySheet.getRange(1, 1, outputRows.length, 5).setValues(outputRows);
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
    const gradeCell = data[i][1]; // Grade column
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
  
  // Get Student Roster for grade assignments and counts
  const rosterSheet = ss.getSheetByName("Student Roster");
  if (!rosterSheet) return metrics;
  
  const rosterData = rosterSheet.getDataRange().getValues();
  
  // Find header row
  let headerRow = -1;
  let gradeCol = -1;
  
  for (let i = 0; i < Math.min(10, rosterData.length); i++) {
    for (let j = 0; j < rosterData[i].length; j++) {
      const cell = rosterData[i][j] ? rosterData[i][j].toString().toLowerCase() : "";
      if (cell === "grade") {
        headerRow = i;
        gradeCol = j;
        break;
      }
    }
    if (headerRow >= 0) break;
  }
  
  if (headerRow < 0) return metrics;
  
  // Count students by grade
  const gradeCounts = new Map();
  
  for (let i = headerRow + 1; i < rosterData.length; i++) {
    const grade = rosterData[i][gradeCol] ? rosterData[i][gradeCol].toString().trim() : "";
    if (grade) {
      gradeCounts.set(grade, (gradeCounts.get(grade) || 0) + 1);
    }
  }
  
  // Build metrics for each grade (simplified - you may need to pull from UFLI MAP)
  gradeCounts.forEach((count, grade) => {
    metrics.set(grade, {
      ...getDefaultGradeMetrics(),
      studentCount: count,
      needsSupport: count,
      needsSupportPct: 1.0
    });
  });
  
  return metrics;
}

function applySchoolSummaryFormatting_MixedGrade(sheet, gradeCount) {
  // Basic formatting - customize as needed
  
  // Title row
  sheet.getRange(1, 1).setFontSize(14).setFontWeight("bold");
  
  // Site name
  sheet.getRange(2, 1).setFontSize(12).setFontWeight("bold");
  
  // Find and format Group Performance header
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === "✅ Group Performance") {
      sheet.getRange(i + 1, 1).setFontSize(12).setFontWeight("bold");
      sheet.getRange(i + 2, 1, 1, 5).setFontWeight("bold").setBackground("#f0f0f0");
      break;
    }
  }
}
/**
 * Renders Group Performance table for mixed-grade sites
 * Shows all groups regardless of grade, at the bottom of School Summary
 */
function renderMixedGradeGroupTable(sheet, row, pacingData) {
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
    for (let i = 7; i < configData.length; i++) {
      const groupName = configData[i][0] ? configData[i][0].toString().trim() : "";
      const grades = configData[i][1] ? configData[i][1].toString().trim() : "";
      if (groupName && grades && groupName !== "Total Groups") {
        gradeMapping[groupName] = grades;
      }
    }
  }
  
  // Process groups and add grade info
  let flaggedGroups = [];
  
  const tableData = pacingData.map((g, index) => {
    const groupName = g[0] ? g[0].toString() : "";
    const studentCount = parseFloat(g[2]) || 0;
    const pacing = parseFloat(g[5]) || 0;       // Index 5 = Pacing %
    const passRate = parseFloat(g[10]) || 0;    // Index 10 = Avg Pass % (FIXED!)
    const absentRate = parseFloat(g[12]) || 0;  // Index 12 = Absent Rate (FIXED!)
    
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
