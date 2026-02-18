// ═══════════════════════════════════════════════════════════════════════════
// UNENROLLMENT AUTOMATION MODULE
// Monday.com Integration + Automated Archival
// ═══════════════════════════════════════════════════════════════════════════
// Version: 2.0
// Last Updated: January 2026
//
// PURPOSE:
// When a student is marked as "U" (unenrolled), this module:
//   1. Creates a task in Monday.com to track the workflow
//   2. Automatically archives the student's COMPLETE data from all tracking sheets
//   3. Removes the student from their group sheet and source sheets
//
// ARCHIVE STRUCTURE:
//   - 3 rows per student (Initial Assessment, UFLI Map, Grade Summary)
//   - Complete original row data preserved
//
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION - MONDAY.COM API
// ═══════════════════════════════════════════════════════════════════════════

const MONDAY_CONFIG = {
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠️ IMPORTANT: Store your API key in Script Properties for security
  // Go to: Extensions > Apps Script > Project Settings > Script Properties
  // Add property: MONDAY_API_KEY with your API key value
  // ══════════════════════════════════════════════════════════════════════════
  
  apiEndpoint: 'https://api.monday.com/v2',
  
  // Board Configuration
  boardId: '18395953659',
  groupId: 'topics',
  
  // Column IDs
  columns: {
    person: 'person',
    date: 'date4',
    school: 'text_mkzngckb',
    group: 'text_mkznw7pg',
    status: 'status'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION - ARCHIVE SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

const ARCHIVE_CONFIG = {
  // Archive sheet name
  archiveSheetName: 'Student Archive',
  
  // Sheets to archive data FROM (student rows will be moved to archive)
  sourceSheets: {
    initialAssessment: 'Initial Assessment',
    ufliMap: 'UFLI MAP',
    gradeSummary: 'Grade Summary'
  },
  
  // Whether to automatically delete from group sheets
  autoDeleteFromGroups: true,
  
  // Whether to create Monday.com task
  createMondayTask: true,
  
  // Log all actions for audit trail
  enableAuditLog: true
};

// ═══════════════════════════════════════════════════════════════════════════
// MONDAY.COM API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets the Monday.com API key from Script Properties
 * @returns {string} API key
 */
function getMondayApiKey_() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('MONDAY_API_KEY');
  
  if (!apiKey) {
    throw new Error(
      'Monday.com API key not found. Please add MONDAY_API_KEY to Script Properties:\n' +
      'Extensions > Apps Script > Project Settings > Script Properties'
    );
  }
  
  return apiKey;
}

/**
 * Creates a task in Monday.com for an unenrolled student
 * 
 * @param {Object} data - Student data
 * @param {string} data.studentName - Name of the student
 * @param {string} data.groupName - Group the student was in
 * @param {string} data.gradeSheet - Grade level
 * @param {Date} data.date - Date of unenrollment
 * @returns {Object} Result with success status and item ID
 */
function createMondayTask(data) {
  const functionName = 'createMondayTask';
  
  try {
    const apiKey = getMondayApiKey_();
    
    // Format the date for Monday.com (YYYY-MM-DD)
    const unenrollDate = data.date || new Date();
    const formattedDate = Utilities.formatDate(unenrollDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    // Build column values JSON
    const columnValues = {};
    
    // Date column
    columnValues[MONDAY_CONFIG.columns.date] = { date: formattedDate };
    
    // School column
    const schoolName = UNENROLLED_REPORT_CONFIG.schoolName || 'School';
    columnValues[MONDAY_CONFIG.columns.school] = schoolName;
    
    // Group column
    columnValues[MONDAY_CONFIG.columns.group] = data.groupName || '';
    
    // Status column - set to initial status
    columnValues[MONDAY_CONFIG.columns.status] = { label: 'Working on it' };
    
    // GraphQL mutation to create item
    const mutation = `
      mutation {
        create_item (
          board_id: ${MONDAY_CONFIG.boardId},
          group_id: "${MONDAY_CONFIG.groupId}",
          item_name: "${escapeGraphQL_(data.studentName)}",
          column_values: ${JSON.stringify(JSON.stringify(columnValues))}
        ) {
          id
          name
        }
      }
    `;
    
    // Make API request
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': apiKey,
        'API-Version': '2024-01'
      },
      payload: JSON.stringify({ query: mutation }),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(MONDAY_CONFIG.apiEndpoint, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.errors) {
      Logger.log(`[${functionName}] Monday.com API Error: ${JSON.stringify(result.errors)}`);
      return { 
        success: false, 
        message: 'Monday.com API error: ' + result.errors[0].message 
      };
    }
    
    const itemId = result.data.create_item.id;
    Logger.log(`[${functionName}] Created Monday.com task #${itemId} for ${data.studentName}`);
    
    return { 
      success: true, 
      itemId: itemId,
      message: `Monday.com task created: #${itemId}` 
    };
    
  } catch (error) {
    Logger.log(`[${functionName}] Error: ${error.toString()}`);
    return { 
      success: false, 
      message: error.toString() 
    };
  }
}

/**
 * Escapes special characters for GraphQL strings
 * @private
 */
function escapeGraphQL_(str) {
  if (!str) return '';
  return str.toString()
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Tests the Monday.com connection
 * Run this to verify your API key and board ID are correct
 */
function testMondayConnection() {
  try {
    const apiKey = getMondayApiKey_();
    
    const query = `
      query {
        boards(ids: [${MONDAY_CONFIG.boardId}]) {
          id
          name
          groups {
            id
            title
          }
          columns {
            id
            title
            type
          }
        }
      }
    `;
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': apiKey,
        'API-Version': '2024-01'
      },
      payload: JSON.stringify({ query: query }),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(MONDAY_CONFIG.apiEndpoint, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.errors) {
      SpreadsheetApp.getUi().alert('❌ Connection Failed', 
        'Error: ' + result.errors[0].message, 
        SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    
    const board = result.data.boards[0];
    
    let message = `✅ Connection Successful!\n\n`;
    message += `Board: ${board.name}\n\n`;
    message += `Groups:\n`;
    board.groups.forEach(g => {
      message += `  - ${g.title} (ID: ${g.id})\n`;
    });
    message += `\nColumns:\n`;
    board.columns.forEach(c => {
      message += `  - ${c.title} (ID: ${c.id}, Type: ${c.type})\n`;
    });
    
    Logger.log(message);
    SpreadsheetApp.getUi().alert('Monday.com Connection Test', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Connection Failed', 
      'Error: ' + error.toString(), 
      SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHIVE SHEET CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates the Student Archive sheet with proper structure
 * Each archived student gets 3 rows: Initial Assessment, UFLI Map, Grade Summary
 * @param {Spreadsheet} ss - Active spreadsheet
 * @returns {Sheet} The archive sheet
 */
function createArchiveSheet_(ss) {
  let sheet = ss.getSheetByName(ARCHIVE_CONFIG.archiveSheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(ARCHIVE_CONFIG.archiveSheetName);
  } else {
    // Sheet exists, check if it has data
    if (sheet.getLastRow() > 5) {
      return sheet;
    }
    sheet.clear();
  }
  
  // Title row (no merge)
  sheet.getRange(1, 1).setValue('STUDENT ARCHIVE');
  sheet.getRange(1, 1, 1, 20).setBackground('#98D4BB');
  sheet.getRange(1, 1).setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(14)
    .setFontFamily('Calibri');

  // Subtitle (no merge)
  sheet.getRange(2, 1).setValue('Complete data preservation for unenrolled students (3 rows per student: Initial Assessment, UFLI Map, Grade Summary)');
  sheet.getRange(2, 1).setFontFamily('Calibri')
    .setFontSize(10)
    .setFontStyle('italic')
    .setFontColor('#666666');
  
  // Archive Index Headers (Row 4)
  const indexHeaders = [
    'Archive Date',
    'Student Name',
    'Group',
    'Source Sheet',
    'Monday.com Task',
    'Archived By',
    '|',
    'Original Row Data →'
  ];
  
  sheet.getRange(4, 1, 1, indexHeaders.length)
    .setValues([indexHeaders])
    .setBackground('#98D4BB')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontFamily('Calibri');
  
  // Set column widths for metadata columns
  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(4, 140);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 120);
  sheet.setColumnWidth(7, 20);
  
  // Freeze header rows
  sheet.setFrozenRows(4);
  sheet.setFrozenColumns(7);
  
  // Add note explaining structure
  sheet.getRange(3, 1).setValue('Each student has 3 rows below - one for each source sheet. Original columns start at column H.')
    .setFontStyle('italic')
    .setFontColor('#666666')
    .setFontSize(9);
  
  return sheet;
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT DATA COLLECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Collects COMPLETE student rows from all source sheets
 * @private
 */
function collectStudentData_(ss, studentName) {
  const data = {
    initialAssessment: { found: false, rowData: [], headers: [], rowIndex: null },
    ufliMap: { found: false, rowData: [], headers: [], rowIndex: null },
    gradeSummary: { found: false, rowData: [], headers: [], rowIndex: null }
  };
  
  // ═══════════════════════════════════════════════════════════════════════
  // Collect from Initial Assessment
  // ═══════════════════════════════════════════════════════════════════════
  const iaSheet = ss.getSheetByName(ARCHIVE_CONFIG.sourceSheets.initialAssessment);
  if (iaSheet) {
    const iaAllData = iaSheet.getDataRange().getValues();
    
    // Find header row (usually row 1 or within first 5 rows)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(iaAllData.length, 5); i++) {
      if (iaAllData[i][0] && iaAllData[i][0].toString().toLowerCase().includes('student')) {
        headerRowIndex = i;
        break;
      }
    }
    data.initialAssessment.headers = iaAllData[headerRowIndex] || [];
    
    // Find student row
    for (let i = headerRowIndex + 1; i < iaAllData.length; i++) {
      if (iaAllData[i][0] && iaAllData[i][0].toString().trim() === studentName) {
        data.initialAssessment.found = true;
        data.initialAssessment.rowData = iaAllData[i];
        data.initialAssessment.rowIndex = i + 1;
        break;
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // Collect from UFLI MAP
  // ═══════════════════════════════════════════════════════════════════════
  const mapSheet = ss.getSheetByName(ARCHIVE_CONFIG.sourceSheets.ufliMap);
  if (mapSheet) {
    const mapAllData = mapSheet.getDataRange().getValues();
    
    // Find header row
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(mapAllData.length, 10); i++) {
      if (mapAllData[i][0] && mapAllData[i][0].toString().toLowerCase().includes('student')) {
        headerRowIndex = i;
        break;
      }
    }
    data.ufliMap.headers = mapAllData[headerRowIndex] || [];
    
    // Find student row
    for (let i = headerRowIndex + 1; i < mapAllData.length; i++) {
      if (mapAllData[i][0] && mapAllData[i][0].toString().trim() === studentName) {
        data.ufliMap.found = true;
        data.ufliMap.rowData = mapAllData[i];
        data.ufliMap.rowIndex = i + 1;
        break;
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // Collect from Grade Summary
  // ═══════════════════════════════════════════════════════════════════════
  const gsSheet = ss.getSheetByName(ARCHIVE_CONFIG.sourceSheets.gradeSummary);
  if (gsSheet) {
    const gsAllData = gsSheet.getDataRange().getValues();
    
    // Find header row (Grade Summary often has title rows first)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(gsAllData.length, 10); i++) {
      if (gsAllData[i][0] && gsAllData[i][0].toString().toLowerCase().includes('student')) {
        headerRowIndex = i;
        break;
      }
    }
    data.gradeSummary.headers = gsAllData[headerRowIndex] || [];
    
    // Find student row
    for (let i = headerRowIndex + 1; i < gsAllData.length; i++) {
      if (gsAllData[i][0] && gsAllData[i][0].toString().trim() === studentName) {
        data.gradeSummary.found = true;
        data.gradeSummary.rowData = gsAllData[i];
        data.gradeSummary.rowIndex = i + 1;
        break;
      }
    }
  }
  
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// WRITE TO ARCHIVE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Writes archived student data to the archive sheet (3 rows per student)
 * @private
 */
function writeToArchive_(archiveSheet, data) {
  const startRow = Math.max(archiveSheet.getLastRow() + 2, 6);
  const archiveDate = data.archiveDate || new Date();
  const mondayTaskId = data.mondayTaskId || '';
  
  const sources = [
    { key: 'initialAssessment', name: 'Initial Assessment', color: '#e3f2fd' },
    { key: 'ufliMap', name: 'UFLI MAP', color: '#fff3e0' },
    { key: 'gradeSummary', name: 'Grade Summary', color: '#f3e5f5' }
  ];
  
  let currentRow = startRow;
  let rowsWritten = 0;
  
  sources.forEach((source, index) => {
    const sourceData = data[source.key];
    
    if (sourceData && sourceData.found) {
      // Metadata columns (A-F)
      const metadata = [
        index === 0 ? archiveDate : '',
        data.studentName,
        data.groupName,
        source.name,
        index === 0 ? mondayTaskId : '',
        index === 0 ? (data.teacherName || 'System') : ''
      ];
      
      // Write metadata
      archiveSheet.getRange(currentRow, 1, 1, metadata.length).setValues([metadata]);
      
      // Write separator
      archiveSheet.getRange(currentRow, 7).setValue('|').setFontColor('#cccccc');
      
      // Write full original row data starting at column H
      if (sourceData.rowData && sourceData.rowData.length > 0) {
        archiveSheet.getRange(currentRow, 8, 1, sourceData.rowData.length)
          .setValues([sourceData.rowData]);
      }
      
      // Apply row background color
      const totalCols = Math.max(8 + (sourceData.rowData ? sourceData.rowData.length : 0), 20);
      archiveSheet.getRange(currentRow, 1, 1, totalCols).setBackground(source.color);
      
      // Format date column
      if (index === 0) {
        archiveSheet.getRange(currentRow, 1).setNumberFormat('MM/dd/yyyy HH:mm');
      }
      
      currentRow++;
      rowsWritten++;
    }
  });
  
  // If no data was found, still write a placeholder row
  if (rowsWritten === 0) {
    archiveSheet.getRange(startRow, 1, 1, 6).setValues([[
      archiveDate,
      data.studentName,
      data.groupName,
      'NO DATA FOUND',
      mondayTaskId,
      data.teacherName || 'System'
    ]]);
    archiveSheet.getRange(startRow, 1).setNumberFormat('MM/dd/yyyy HH:mm');
    archiveSheet.getRange(startRow, 1, 1, 6).setBackground('#ffcdd2');
    currentRow++;
  }
  
  // Add a subtle border below this student's rows
  archiveSheet.getRange(currentRow - 1, 1, 1, 20)
    .setBorder(false, false, true, false, false, false, '#98D4BB', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  
  return startRow;
}

/**
 * Writes headers from source sheets to archive (call once to document columns)
 */
function writeArchiveHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const archiveSheet = ss.getSheetByName(ARCHIVE_CONFIG.archiveSheetName);
  
  if (!archiveSheet) {
    SpreadsheetApp.getUi().alert('Archive sheet not found. Archive a student first.');
    return;
  }
  
  const sources = [
    { sheet: ARCHIVE_CONFIG.sourceSheets.initialAssessment, name: 'Initial Assessment' },
    { sheet: ARCHIVE_CONFIG.sourceSheets.ufliMap, name: 'UFLI MAP' },
    { sheet: ARCHIVE_CONFIG.sourceSheets.gradeSummary, name: 'Grade Summary' }
  ];
  
  let refRow = archiveSheet.getLastRow() + 3;
  
  // Section header (no merge)
  archiveSheet.getRange(refRow, 1).setValue('═══ COLUMN REFERENCE (Original Sheet Headers) ═══');
  archiveSheet.getRange(refRow, 1, 1, 10).setBackground('#e0e0e0');
  archiveSheet.getRange(refRow, 1).setFontWeight('bold').setFontFamily('Calibri');
  refRow++;
  
  sources.forEach(source => {
    const sheet = ss.getSheetByName(source.sheet);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      
      let headerRow = data[0];
      for (let i = 0; i < Math.min(data.length, 10); i++) {
        if (data[i][0] && data[i][0].toString().toLowerCase().includes('student')) {
          headerRow = data[i];
          break;
        }
      }
      
      archiveSheet.getRange(refRow, 1).setValue(source.name + ':').setFontWeight('bold');
      
      if (headerRow && headerRow.length > 0) {
        archiveSheet.getRange(refRow, 8, 1, headerRow.length).setValues([headerRow]);
      }
      
      refRow++;
    }
  });
  
  SpreadsheetApp.getUi().alert('Header reference added to bottom of archive sheet.');
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deletes student from their group sheet
 * @private
 */
function deleteFromGroupSheet_(ss, studentName, groupName, gradeSheet) {
  try {
    const grade = groupName ? groupName.split(' ')[0] : '';
    const sheetName = gradeSheet || (grade + ' Groups');
    
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return { success: false, message: `Sheet '${sheetName}' not found` };
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][0] && data[i][0].toString().trim() === studentName) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    
    return { success: false, message: 'Student not found in group sheet' };
    
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * Deletes student from all source sheets
 * @private
 */
function deleteFromSourceSheets_(ss, studentName) {
  const results = [];
  
  Object.entries(ARCHIVE_CONFIG.sourceSheets).forEach(([key, sheetName]) => {
    try {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        results.push({ sheet: sheetName, success: false, message: 'Sheet not found' });
        return;
      }
      
      const data = sheet.getDataRange().getValues();
      
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i][0] && data[i][0].toString().trim() === studentName) {
          sheet.deleteRow(i + 1);
          results.push({ sheet: sheetName, success: true });
          return;
        }
      }
      
      results.push({ sheet: sheetName, success: false, message: 'Student not found' });
      
    } catch (error) {
      results.push({ sheet: sheetName, success: false, message: error.toString() });
    }
  });
  
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Logs archive action for audit trail
 * @private
 */
function logArchiveAction_(data, results) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName('Archive Audit Log');
  
  if (!logSheet) {
    logSheet = ss.insertSheet('Archive Audit Log');
    logSheet.getRange(1, 1, 1, 6).setValues([[
      'Timestamp', 'Student Name', 'Group', 'Actions', 'Errors', 'Monday.com Task'
    ]]);
    logSheet.getRange(1, 1, 1, 6)
      .setBackground('#98D4BB')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
  }
  
  logSheet.appendRow([
    new Date(),
    data.studentName,
    data.groupName,
    results.actions.join('; '),
    results.errors.join('; '),
    results.mondayTaskId || ''
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ARCHIVE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Archives a student's data from all tracking sheets
 * This is the main function called when a student is unenrolled
 * 
 * @param {Object} data - Unenrollment data
 * @param {string} data.studentName - Name of the student
 * @param {string} data.groupName - Group the student was in
 * @param {string} data.gradeSheet - Grade level sheet name
 * @param {string} data.teacherName - Teacher who reported the unenrollment
 * @returns {Object} Result with success status and details
 */
function archiveUnenrolledStudent(data) {
  const functionName = 'archiveUnenrolledStudent';
  Logger.log(`[${functionName}] Starting archive for: ${data.studentName}`);
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const results = {
    success: true,
    studentName: data.studentName,
    actions: [],
    mondayTaskId: null,
    errors: []
  };
  
  try {
    // 1. Get or create the archive sheet
    const archiveSheet = createArchiveSheet_(ss);
    
    // 2. Collect COMPLETE data from all source sheets
    const studentData = collectStudentData_(ss, data.studentName);
    
    // 3. Create Monday.com task FIRST (so we have the ID for the archive)
    if (ARCHIVE_CONFIG.createMondayTask) {
      const mondayResult = createMondayTask({
        studentName: data.studentName,
        groupName: data.groupName,
        gradeSheet: data.gradeSheet,
        date: new Date()
      });
      
      if (mondayResult.success) {
        results.mondayTaskId = mondayResult.itemId;
        results.actions.push(`Created Monday.com task #${mondayResult.itemId}`);
      } else {
        results.errors.push(`Monday.com: ${mondayResult.message}`);
      }
    }
    
    // 4. Write to archive sheet (3 rows - one per source sheet)
    const archiveRow = writeToArchive_(archiveSheet, {
      studentName: data.studentName,
      groupName: data.groupName,
      teacherName: data.teacherName,
      archiveDate: new Date(),
      mondayTaskId: results.mondayTaskId,
      initialAssessment: studentData.initialAssessment,
      ufliMap: studentData.ufliMap,
      gradeSummary: studentData.gradeSummary
    });
    
    const rowsArchived = [
      studentData.initialAssessment.found ? 'Initial Assessment' : null,
      studentData.ufliMap.found ? 'UFLI MAP' : null,
      studentData.gradeSummary.found ? 'Grade Summary' : null
    ].filter(Boolean);
    
    results.actions.push(`Archived ${rowsArchived.length} rows: ${rowsArchived.join(', ')}`);
    
    // 5. Delete from group sheet (if enabled)
    if (ARCHIVE_CONFIG.autoDeleteFromGroups) {
      const groupResult = deleteFromGroupSheet_(ss, data.studentName, data.groupName, data.gradeSheet);
      if (groupResult.success) {
        results.actions.push(`Removed from group sheet: ${data.groupName}`);
      } else {
        results.errors.push(`Group sheet: ${groupResult.message}`);
      }
    }
    
    // 6. Delete from source sheets
    const deleteResults = deleteFromSourceSheets_(ss, data.studentName);
    deleteResults.forEach(r => {
      if (r.success) {
        results.actions.push(`Removed from ${r.sheet}`);
      } else if (r.message !== 'Student not found') {
        results.errors.push(`${r.sheet}: ${r.message}`);
      }
    });
    
    // 7. Log to audit trail
    if (ARCHIVE_CONFIG.enableAuditLog) {
      logArchiveAction_(data, results);
    }
    
    Logger.log(`[${functionName}] Archive complete for ${data.studentName}. Actions: ${results.actions.length}, Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      results.success = results.actions.length > 0;
    }
    
    return results;
    
  } catch (error) {
    Logger.log(`[${functionName}] Error: ${error.toString()}`);
    results.success = false;
    results.errors.push(error.toString());
    return results;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATED UNENROLLMENT LOGGING FUNCTION
// Replace your existing logUnenrolledStudent function with this one
// ═══════════════════════════════════════════════════════════════════════════

/**
 * UPDATED: Logs unenrolled students AND triggers automated archival
 * Called from save functions when students are marked as 'U'
 * 
 * @param {Object} data - Unenrollment data
 * @param {string} data.studentName - Name of the unenrolled student
 * @param {string} data.groupName - Group the student was in
 * @param {string} data.gradeSheet - Grade level sheet name
 * @param {string} data.teacherName - Teacher who reported the unenrollment
 * @param {string} data.lessonName - Lesson when unenrollment was noted
 */
function logUnenrolledStudent(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName(UNENROLLED_REPORT_CONFIG.unenrolledLogSheetName);
  
  // Create the log sheet if it doesn't exist
  if (!logSheet) {
    logSheet = createUnenrolledLogSheet_(ss);
  }
  
  // Add the log entry
  const timestamp = new Date();
  const newRow = [
    timestamp,
    data.studentName,
    data.gradeSheet || '',
    data.groupName,
    data.teacherName,
    data.lessonName || '',
    'Processing',
    ''
  ];
  
  logSheet.appendRow(newRow);
  
  // Format the new row
  const lastRow = logSheet.getLastRow();
  logSheet.getRange(lastRow, 1).setNumberFormat('MM/dd/yyyy HH:mm');
  
  // ═══════════════════════════════════════════════════════════════════════
  // Trigger automated archival
  // ═══════════════════════════════════════════════════════════════════════
  const archiveResult = archiveUnenrolledStudent(data);
  
  // Update log entry with results
  if (archiveResult.success) {
    logSheet.getRange(lastRow, 7).setValue('Archived');
    logSheet.getRange(lastRow, 8).setValue(
      `Actions: ${archiveResult.actions.join(', ')}` +
      (archiveResult.mondayTaskId ? ` | Monday: #${archiveResult.mondayTaskId}` : '')
    );
  } else {
    logSheet.getRange(lastRow, 7).setValue('Error');
    logSheet.getRange(lastRow, 8).setValue(
      `Errors: ${archiveResult.errors.join(', ')}`
    );
  }
  
  return { 
    success: archiveResult.success, 
    message: archiveResult.success ? 'Student archived successfully' : 'Archive completed with errors',
    details: archiveResult
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MANUAL ARCHIVE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Manually archives a student by name
 * Use this for students already marked as 'U' who weren't auto-archived
 */
function manualArchiveStudent() {
  const ui = SpreadsheetApp.getUi();
  
  const nameResponse = ui.prompt(
    'Archive Student',
    'Enter the student name to archive:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (nameResponse.getSelectedButton() !== ui.Button.OK) return;
  
  const studentName = nameResponse.getResponseText().trim();
  if (!studentName) {
    ui.alert('Error', 'Student name cannot be empty.', ui.ButtonSet.OK);
    return;
  }
  
  const groupResponse = ui.prompt(
    'Archive Student',
    'Enter the group name (e.g., "G3 Group 1 Smith"):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (groupResponse.getSelectedButton() !== ui.Button.OK) return;
  
  const groupName = groupResponse.getResponseText().trim();
  
  // Confirm
  const confirm = ui.alert(
    'Confirm Archive',
    `Are you sure you want to archive "${studentName}" from "${groupName}"?\n\n` +
    'This will:\n' +
    '• Move their data to the Archive sheet (3 rows)\n' +
    '• Remove them from tracking sheets\n' +
    '• Create a Monday.com task',
    ui.ButtonSet.YES_NO
  );
  
  if (confirm !== ui.Button.YES) return;
  
  // Run archive
  const result = archiveUnenrolledStudent({
    studentName: studentName,
    groupName: groupName,
    gradeSheet: groupName.split(' ')[0] + ' Groups',
    teacherName: 'Manual Archive'
  });
  
  if (result.success) {
    ui.alert('Success', 
      `Student "${studentName}" has been archived.\n\n` +
      `Actions completed:\n• ${result.actions.join('\n• ')}`,
      ui.ButtonSet.OK);
  } else {
    ui.alert('Archive Completed with Errors',
      `Some actions could not be completed:\n• ${result.errors.join('\n• ')}`,
      ui.ButtonSet.OK);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Initial setup for unenrollment automation
 */
function setupUnenrollmentAutomation() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  ui.alert(
    'Setup: Unenrollment Automation',
    'This will set up the automated unenrollment system.\n\n' +
    'Requirements:\n' +
    '1. Monday.com API key\n' +
    '2. Monday.com Board ID (already configured: ' + MONDAY_CONFIG.boardId + ')\n\n' +
    'Click OK to continue.',
    ui.ButtonSet.OK
  );
  
  // Create archive sheet
  createArchiveSheet_(ss);
  Logger.log('Archive sheet created/verified.');
  
  // Check if API key exists
  const existingKey = PropertiesService.getScriptProperties().getProperty('MONDAY_API_KEY');
  
  if (!existingKey) {
    const apiKeyResponse = ui.prompt(
      'Monday.com API Key',
      'Enter your Monday.com API key:\n(This will be stored securely in Script Properties)',
      ui.ButtonSet.OK_CANCEL
    );
    
    if (apiKeyResponse.getSelectedButton() === ui.Button.OK) {
      const apiKey = apiKeyResponse.getResponseText().trim();
      if (apiKey) {
        PropertiesService.getScriptProperties().setProperty('MONDAY_API_KEY', apiKey);
        Logger.log('API key stored.');
      }
    }
  } else {
    ui.alert('API Key', 'Monday.com API key is already configured.', ui.ButtonSet.OK);
  }
  
  ui.alert(
    'Setup Complete',
    'The unenrollment automation system is now configured.\n\n' +
    'Board ID: ' + MONDAY_CONFIG.boardId + '\n' +
    'Group ID: ' + MONDAY_CONFIG.groupId + '\n\n' +
    'Next: Run "Test Monday Connection" to verify the setup.',
    ui.ButtonSet.OK
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function goToArchiveSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ARCHIVE_CONFIG.archiveSheetName);
  
  if (!sheet) {
    sheet = createArchiveSheet_(ss);
  }
  
  ss.setActiveSheet(sheet);
}

function goToAuditLog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Archive Audit Log');
  
  if (sheet) {
    ss.setActiveSheet(sheet);
  } else {
    SpreadsheetApp.getUi().alert('No audit log found yet. Archive a student to create one.');
  }
}
