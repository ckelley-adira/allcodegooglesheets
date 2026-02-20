/**
 * ============================================
 * GROWTH HIGHLIGHTER UTILITY
 * Standalone utility for UFLI Grade Summary
 * ============================================
 * Version: 4.0 - MODULAR ARCHITECTURE (PHASE 4)
 * Last Updated: February 2026
 * 
 * FEATURE FLAG: SITE_CONFIG.features.growthHighlighter
 * This module is only activated when the feature flag is set to true.
 * 
 * PURPOSE:
 * Highlights student names for students who are
 * "Unenrolled" or "Finished Sequence" but have
 * growth in AG% columns.
 *
 * USAGE:
 * Enable in SiteConfig_TEMPLATE.gs: features.growthHighlighter = true
 */

// ============================================
// CONFIGURATION (prefixed to avoid conflicts)
// ============================================
const GH_CONFIG = {
  HEADER_ROW: 5,
  NAME_COLUMN: 1,        // Column A - Student Name
  GROUP_COLUMN: 4,       // Column D - Group
  DATA_START_ROW: 6,     // First row of student data
  HIGHLIGHT_COLOR: '#FFF59D',  // Light yellow
  TARGET_GROUP: 'Unenrolled or Finished Sequence',
  AG_COLUMN_PATTERN: '(AG%)'
};

// AG% Columns (0-indexed) based on provided headers
const GH_AG_COLUMNS = [
  { index: 9,  name: 'Single Consonants & Vowels (AG%)' },
  { index: 12, name: 'Blends (AG%)' },
  { index: 15, name: 'Alphabet Review & Longer Words (AG%)' },
  { index: 18, name: 'Digraphs (AG%)' },
  { index: 21, name: 'VCE (AG%)' },
  { index: 24, name: 'Reading Longer Words (AG%)' },
  { index: 27, name: 'Ending Spelling Patterns (AG%)' },
  { index: 30, name: 'R-Controlled Vowels (AG%)' },
  { index: 33, name: 'Long Vowel Teams (AG%)' },
  { index: 36, name: 'Other Vowel Teams (AG%)' },
  { index: 39, name: 'Diphthongs (AG%)' },
  { index: 42, name: 'Silent Letters (AG%)' },
  { index: 45, name: 'Suffixes & Prefixes (AG%)' },
  { index: 48, name: 'Suffix Spelling Changes (AG%)' },
  { index: 51, name: 'Low Frequency Spellings (AG%)' },
  { index: 54, name: 'Additional Affixes (AG%)' }
];

/**
 * Show the sidebar UI
 */
function ghShowSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('GrowthHighlighterSidebar')
    .setTitle('Growth Highlighter')
    .setWidth(350);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Add menu on open - call this from your existing onOpen or run once
 */
function ghAddMenu() {
  SpreadsheetApp.getUi()
    .createMenu('🔍 Growth Highlighter')
    .addItem('Open Utility', 'ghShowSidebar')
    .addToUi();
}

/**
 * Get sheet info for sidebar
 */
function ghGetSheetInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const lastRow = sheet.getLastRow();
  const dataRows = Math.max(0, lastRow - GH_CONFIG.DATA_START_ROW + 1);
  
  // Count students in target group
  let targetGroupCount = 0;
  
  if (dataRows > 0) {
    const groups = sheet.getRange(GH_CONFIG.DATA_START_ROW, GH_CONFIG.GROUP_COLUMN, dataRows, 1).getValues();
    groups.forEach(row => {
      const group = String(row[0]).trim().toLowerCase();
      if (group === GH_CONFIG.TARGET_GROUP.toLowerCase()) targetGroupCount++;
    });
  }
  
  return {
    sheetName: sheet.getName(),
    totalRows: dataRows,
    targetGroupCount: targetGroupCount,
    agColumnCount: GH_AG_COLUMNS.length
  };
}

/**
 * Main highlight function - called from sidebar
 */
function ghRunHighlighter(options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  
  const highlightColor = options.color || GH_CONFIG.HIGHLIGHT_COLOR;
  const minGrowth = options.minGrowth || 0;
  
  // Get data
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const numRows = lastRow - GH_CONFIG.DATA_START_ROW + 1;
  
  if (numRows <= 0) {
    return { success: false, message: 'No data rows found.' };
  }
  
  const data = sheet.getRange(GH_CONFIG.DATA_START_ROW, 1, numRows, lastCol).getValues();
  
  // Clear existing highlights first
  const nameRange = sheet.getRange(GH_CONFIG.DATA_START_ROW, GH_CONFIG.NAME_COLUMN, numRows, 1);
  nameRange.setBackground(null);
  
  // Process rows
  const results = {
    highlighted: [],
    scanned: 0,
    targetGroupCount: 0
  };
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = GH_CONFIG.DATA_START_ROW + i;
    
    // Skip empty rows
    if (!row[GH_CONFIG.NAME_COLUMN - 1]) continue;
    
    results.scanned++;
    
    const studentName = row[GH_CONFIG.NAME_COLUMN - 1];
    const grade = row[1]; // Column B
    const teacher = row[2]; // Column C
    const group = String(row[GH_CONFIG.GROUP_COLUMN - 1]).trim();
    
    // Check if in target group
    if (group.toLowerCase() !== GH_CONFIG.TARGET_GROUP.toLowerCase()) continue;
    
    results.targetGroupCount++;
    
    // Check for growth
    const growthInfo = ghGetGrowthInfo(row, minGrowth);
    
    if (growthInfo.hasGrowth) {
      sheet.getRange(rowNum, GH_CONFIG.NAME_COLUMN).setBackground(highlightColor);
      
      results.highlighted.push({
        row: rowNum,
        name: studentName,
        grade: grade,
        teacher: teacher,
        group: group,
        growthAreas: growthInfo.areas,
        maxGrowth: growthInfo.maxGrowth
      });
    }
  }
  
  return {
    success: true,
    results: results,
    message: `Found ${results.highlighted.length} students with growth out of ${results.targetGroupCount} in "${GH_CONFIG.TARGET_GROUP}".`
  };
}

/**
 * Get growth information for a row
 */
function ghGetGrowthInfo(row, minGrowth) {
  const areas = [];
  let maxGrowth = 0;
  
  for (const col of GH_AG_COLUMNS) {
    const value = row[col.index];
    let numValue = ghParseNumericValue(value);
    
    if (numValue > minGrowth) {
      // Extract short name (before the parenthesis)
      const shortName = col.name.replace(' (AG%)', '');
      areas.push({
        name: shortName,
        value: numValue
      });
      
      if (numValue > maxGrowth) {
        maxGrowth = numValue;
      }
    }
  }
  
  return {
    hasGrowth: areas.length > 0,
    areas: areas,
    maxGrowth: maxGrowth
  };
}

/**
 * Parse numeric value from various formats
 */
function ghParseNumericValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace('%', '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Clear all highlights
 */
function ghClearAllHighlights() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  
  const lastRow = sheet.getLastRow();
  const numRows = lastRow - GH_CONFIG.DATA_START_ROW + 1;
  
  if (numRows > 0) {
    const nameRange = sheet.getRange(GH_CONFIG.DATA_START_ROW, GH_CONFIG.NAME_COLUMN, numRows, 1);
    nameRange.setBackground(null);
  }
  
  return { success: true, message: 'All highlights cleared.' };
}

/**
 * Export results to a new sheet
 */
function ghExportResults(students) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create or get export sheet
  let exportSheet = ss.getSheetByName('Growth Highlight Export');
  if (exportSheet) {
    exportSheet.clear();
  } else {
    exportSheet = ss.insertSheet('Growth Highlight Export');
  }
  
  // Headers
  const headers = ['Row', 'Student Name', 'Grade', 'Teacher', 'Group', 'Growth Areas', 'Max Growth %'];
  exportSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#4A90A4').setFontColor('white');
  
  // Data
  if (students.length > 0) {
    const exportData = students.map(s => [
      s.row,
      s.name,
      s.grade,
      s.teacher,
      s.group,
      s.growthAreas.map(a => a.name).join(', '),
      s.maxGrowth
    ]);
    
    exportSheet.getRange(2, 1, exportData.length, headers.length).setValues(exportData);
  }
  
  // Format
  exportSheet.autoResizeColumns(1, headers.length);
  
  return { success: true, message: `Exported ${students.length} students to "Growth Highlight Export" sheet.` };
}
