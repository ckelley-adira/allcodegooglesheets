/**
 * UFLI Progress Comparison Script
 * Compares Initial Assessment and UFLI MAP sheets to identify students with no progress
 * Highlights those students in yellow on Grade Summary, Initial Assessment, and UFLI MAP sheets
 * 
 * @author CK Consulting / TILT
 * @version 1.0
 */

// Configuration - adjust these if your sheet names or structure differ
const CONFIG = {
  INITIAL_ASSESSMENT_SHEET: 'Initial Assessment',
  UFLI_MAP_SHEET: 'UFLI MAP',
  GRADE_SUMMARY_SHEET: 'Grade Summary',
  HEADER_ROW: 5,  // Row where headers are (1-indexed)
  DATA_START_ROW: 6,  // Row where student data starts (1-indexed)
  STUDENT_NAME_COL: 1,  // Column A
  HIGHLIGHT_COLOR: '#FFFF00',  // Yellow
  CLEAR_COLOR: null  // No fill
};

/**
 * Main function to find and highlight students with no progress
 */
function findNoProgressStudents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  // Show loading message
  ss.toast('Analyzing student progress...', 'Please wait', -1);
  
  try {
    // Get sheets
    const initialSheet = ss.getSheetByName(CONFIG.INITIAL_ASSESSMENT_SHEET);
    const ufliSheet = ss.getSheetByName(CONFIG.UFLI_MAP_SHEET);
    const summarySheet = ss.getSheetByName(CONFIG.GRADE_SUMMARY_SHEET);
    
    // Validate sheets exist
    if (!initialSheet || !ufliSheet || !summarySheet) {
      ui.alert('Error', 'Could not find one or more required sheets:\n• Initial Assessment\n• UFLI MAP\n• Grade Summary', ui.ButtonSet.OK);
      return;
    }
    
    // Get data from both sheets
    const initialData = getSheetData(initialSheet);
    const ufliData = getSheetData(ufliSheet);
    
    // Get lesson columns (columns that contain UFLI lesson data)
    const lessonCols = getLessonColumns(initialSheet);
    
    // Compare students and find those with no progress
    const noProgressStudents = compareStudents(initialData, ufliData, lessonCols);
    
    // Clear previous highlighting
    clearAllHighlighting();
    
    // Highlight students on all three sheets
    highlightStudents(initialSheet, noProgressStudents);
    highlightStudents(ufliSheet, noProgressStudents);
    highlightStudents(summarySheet, noProgressStudents);
    
    // Show results
    ss.toast('Analysis complete!', 'Done', 3);
    
    const message = `Found ${noProgressStudents.length} students with no difference between Initial Assessment and UFLI MAP.\n\nThese students have been highlighted in yellow on:\n• Grade Summary\n• Initial Assessment\n• UFLI MAP`;
    ui.alert('Progress Analysis Complete', message, ui.ButtonSet.OK);
    
    // Log the students for reference
    Logger.log('Students with no progress:');
    noProgressStudents.forEach(student => Logger.log('  - ' + student));
    
  } catch (error) {
    ss.toast('Error occurred', 'Error', 3);
    ui.alert('Error', 'An error occurred: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error: ' + error.message);
  }
}

/**
 * Gets student data from a sheet as a map of student name -> row data
 */
function getSheetData(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow < CONFIG.DATA_START_ROW) {
    return new Map();
  }
  
  const dataRange = sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, lastCol);
  const values = dataRange.getValues();
  
  const studentData = new Map();
  
  values.forEach((row, index) => {
    const studentName = normalizeStudentName(row[0]);
    if (studentName) {
      studentData.set(studentName, {
        rowIndex: index + CONFIG.DATA_START_ROW,
        values: row
      });
    }
  });
  
  return studentData;
}

/**
 * Gets the column indices that contain UFLI lesson data
 */
function getLessonColumns(sheet) {
  const headerRange = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, sheet.getLastColumn());
  const headers = headerRange.getValues()[0];
  
  const lessonCols = [];
  headers.forEach((header, index) => {
    if (header && header.toString().startsWith('UFLI L')) {
      lessonCols.push(index);
    }
  });
  
  return lessonCols;
}

/**
 * Compares student data between Initial Assessment and UFLI MAP
 * Returns array of student names with no progress
 */
function compareStudents(initialData, ufliData, lessonCols) {
  const noProgressStudents = [];
  
  initialData.forEach((initialRow, studentName) => {
    // Check if student exists in UFLI MAP
    if (!ufliData.has(studentName)) {
      return; // Skip students not in both sheets
    }
    
    const ufliRow = ufliData.get(studentName);
    let hasDifference = false;
    
    // Compare each lesson column
    for (const colIndex of lessonCols) {
      const initialVal = normalizeValue(initialRow.values[colIndex]);
      const ufliVal = normalizeValue(ufliRow.values[colIndex]);
      
      // Check for meaningful differences
      if (hasMeaningfulDifference(initialVal, ufliVal)) {
        hasDifference = true;
        break;
      }
    }
    
    if (!hasDifference) {
      noProgressStudents.push(studentName);
    }
  });
  
  return noProgressStudents.sort();
}

/**
 * Normalizes a student name for comparison
 */
function normalizeStudentName(name) {
  if (!name) return '';
  return name.toString().trim();
}

/**
 * Normalizes a cell value for comparison
 */
function normalizeValue(val) {
  if (val === null || val === undefined || val === '') {
    return '';
  }
  return val.toString().trim().toUpperCase();
}

/**
 * Determines if there's a meaningful difference between two values
 */
function hasMeaningfulDifference(initialVal, ufliVal) {
  // If values are the same, no difference
  if (initialVal === ufliVal) {
    return false;
  }
  
  // Meaningful differences:
  // - Initial was empty/N and UFLI is Y (student learned skill)
  // - Initial was Y and UFLI is N/empty (regression - unlikely but possible)
  // - One has A (absent) where other doesn't
  
  const initialEmpty = initialVal === '' || initialVal === 'N';
  const ufliEmpty = ufliVal === '' || ufliVal === 'N';
  
  // Progress: went from empty/N to Y
  if (initialEmpty && ufliVal === 'Y') {
    return true;
  }
  
  // Regression: went from Y to empty/N
  if (initialVal === 'Y' && ufliEmpty) {
    return true;
  }
  
  // Absent marking changed
  if (initialVal === 'A' || ufliVal === 'A') {
    return true;
  }
  
  return false;
}

/**
 * Highlights students on a sheet
 */
function highlightStudents(sheet, studentNames) {
  const lastRow = sheet.getLastRow();
  const studentNameCol = CONFIG.STUDENT_NAME_COL;
  
  if (lastRow < CONFIG.DATA_START_ROW) {
    return;
  }
  
  // Get all student names from the sheet
  const nameRange = sheet.getRange(CONFIG.DATA_START_ROW, studentNameCol, lastRow - CONFIG.DATA_START_ROW + 1, 1);
  const names = nameRange.getValues();
  
  // Create a set for faster lookup
  const noProgressSet = new Set(studentNames);
  
  // Build array of rows to highlight
  const rowsToHighlight = [];
  names.forEach((row, index) => {
    const name = normalizeStudentName(row[0]);
    if (noProgressSet.has(name)) {
      rowsToHighlight.push(index + CONFIG.DATA_START_ROW);
    }
  });
  
  // Highlight rows in batches for better performance
  const lastCol = sheet.getLastColumn();
  rowsToHighlight.forEach(rowNum => {
    sheet.getRange(rowNum, 1, 1, lastCol).setBackground(CONFIG.HIGHLIGHT_COLOR);
  });
}

/**
 * Clears all highlighting from the three main sheets
 */
function clearAllHighlighting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheetNames = [
    CONFIG.INITIAL_ASSESSMENT_SHEET,
    CONFIG.UFLI_MAP_SHEET,
    CONFIG.GRADE_SUMMARY_SHEET
  ];
  
  sheetNames.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      if (lastRow >= CONFIG.DATA_START_ROW) {
        const dataRange = sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, lastCol);
        dataRange.setBackground(CONFIG.CLEAR_COLOR);
      }
    }
  });
  
  ss.toast('Highlighting cleared from all sheets', 'Done', 2);
}

/**
 * Generates a detailed report of students with no progress
 */
function generateNoProgressReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  ss.toast('Generating report...', 'Please wait', -1);
  
  try {
    // Get sheets
    const initialSheet = ss.getSheetByName(CONFIG.INITIAL_ASSESSMENT_SHEET);
    const ufliSheet = ss.getSheetByName(CONFIG.UFLI_MAP_SHEET);
    const summarySheet = ss.getSheetByName(CONFIG.GRADE_SUMMARY_SHEET);
    
    if (!initialSheet || !ufliSheet || !summarySheet) {
      ui.alert('Error', 'Could not find required sheets.', ui.ButtonSet.OK);
      return;
    }
    
    // Get data
    const initialData = getSheetData(initialSheet);
    const ufliData = getSheetData(ufliSheet);
    const summaryData = getSheetData(summarySheet);
    const lessonCols = getLessonColumns(initialSheet);
    
    // Find no progress students
    const noProgressStudents = compareStudents(initialData, ufliData, lessonCols);
    
    // Create or get report sheet
    let reportSheet = ss.getSheetByName('No Progress Report');
    if (reportSheet) {
      reportSheet.clear();
    } else {
      reportSheet = ss.insertSheet('No Progress Report');
    }
    
    // Get summary headers for reference
    const summaryHeaders = summarySheet.getRange(CONFIG.HEADER_ROW, 1, 1, summarySheet.getLastColumn()).getValues()[0];
    
    // Find column indices in summary sheet
    const gradeCol = findColumnIndex(summaryHeaders, 'Grade');
    const groupCol = findColumnIndex(summaryHeaders, 'Group');
    const foundationalCol = findColumnIndex(summaryHeaders, 'Foundational Skills %');
    const benchmarkCol = findColumnIndex(summaryHeaders, 'Benchmark Status');
    
    // Set up report headers
    const reportHeaders = [
      'Student Name',
      'Grade',
      'Group',
      'Foundational Skills %',
      'Benchmark Status',
      'Report Generated'
    ];
    
    reportSheet.getRange(1, 1, 1, reportHeaders.length).setValues([reportHeaders]);
    reportSheet.getRange(1, 1, 1, reportHeaders.length)
      .setBackground('#4472C4')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    
    // Add student data
    const reportData = [];
    const timestamp = new Date().toLocaleString();
    
    noProgressStudents.forEach(studentName => {
      const summaryRow = summaryData.get(studentName);
      if (summaryRow) {
        reportData.push([
          studentName,
          gradeCol >= 0 ? summaryRow.values[gradeCol] : '',
          groupCol >= 0 ? summaryRow.values[groupCol] : '',
          foundationalCol >= 0 ? summaryRow.values[foundationalCol] : '',
          benchmarkCol >= 0 ? summaryRow.values[benchmarkCol] : '',
          timestamp
        ]);
      } else {
        reportData.push([studentName, '', '', '', '', timestamp]);
      }
    });
    
    if (reportData.length > 0) {
      reportSheet.getRange(2, 1, reportData.length, reportHeaders.length).setValues(reportData);
      
      // Highlight all rows in yellow
      reportSheet.getRange(2, 1, reportData.length, reportHeaders.length).setBackground(CONFIG.HIGHLIGHT_COLOR);
    }
    
    // Format columns
    reportSheet.setColumnWidth(1, 250);
    reportSheet.setColumnWidth(2, 80);
    reportSheet.setColumnWidth(3, 200);
    reportSheet.setColumnWidth(4, 150);
    reportSheet.setColumnWidth(5, 120);
    reportSheet.setColumnWidth(6, 150);
    
    // Add summary at top
    reportSheet.insertRowBefore(1);
    reportSheet.getRange(1, 1).setValue(`No Progress Students Report - ${noProgressStudents.length} students found`);
    reportSheet.getRange(1, 1).setFontSize(14).setFontWeight('bold');
    
    // Activate the report sheet
    reportSheet.activate();
    
    ss.toast('Report generated!', 'Done', 3);
    ui.alert('Report Generated', `Created "No Progress Report" sheet with ${noProgressStudents.length} students.`, ui.ButtonSet.OK);
    
  } catch (error) {
    ss.toast('Error occurred', 'Error', 3);
    ui.alert('Error', 'An error occurred: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error: ' + error.message);
  }
}

/**
 * Helper function to find column index by header name
 */
function findColumnIndex(headers, headerName) {
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] && headers[i].toString().toLowerCase().includes(headerName.toLowerCase())) {
      return i;
    }
  }
  return -1;
}
