// ═══════════════════════════════════════════════════════════════════════════
// UFLI MASTER SYSTEM - ADMIN IMPORT UTILITY
// Historical Data Import with Validation and Exception Reporting
// ═══════════════════════════════════════════════════════════════════════════
// Version: 3.0 - PERFORMANCE COMPATIBLE
// Last Updated: January 2026
//
// CHANGES FROM v2.0:
// - Removed formula generation logic (now handled by Phase 2 static calc)
// - Updated refreshGradeSummaryFormulas to use updateAllStats()
// - Imports now trigger auto-recalculation of stats
//
// PURPOSE:
// - Import Initial Assessment data (baseline) to establish starting point
// - Import Lesson Progress data (growth) to update UFLI MAP
// - Validate data before committing
// - Generate exception reports for data issues
// - Archive imported data to historical sheets
//
// DEPENDENCIES:
// - Phase2_ProgressTracking.js (for updateAllStats, extractLessonNumber, etc.)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_SHEET_NAMES = {
  IMPORT_STAGING: "Import Staging",
  IMPORT_EXCEPTIONS: "Import Exceptions",
  HISTORICAL: "Small Group Historical",
  INITIAL_ASSESSMENT: "Initial Assessment"
};

const IMPORT_COLUMNS = {
  STUDENT_NAME: 1,
  DATE: 2,
  GROUP: 3,
  LESSON: 4,
  STATUS: 5
};

const IMPORT_TYPES = {
  INITIAL_ASSESSMENT: 'initial',
  LESSON_PROGRESS: 'progress'
};

const VALID_STATUSES = ['Y', 'N', 'A'];

// Status priority for "best entry" logic (higher = better)
const STATUS_PRIORITY = {
  'Y': 3,
  'N': 2,
  'A': 1
};

// ═══════════════════════════════════════════════════════════════════════════
// MENU INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Adds Admin Tools submenu to the main UFLI menu
 * Call this from onOpen() or add items directly to existing menu
 */
function addAdminMenu() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('🔐 Admin Tools')
    .addItem('📂 Open Import Dialog...', 'showImportDialog')
    .addSeparator()
    .addItem('✅ Validate Import Data', 'validateImportData')
    .addItem('▶️ Process Import', 'processImportData')
    .addSeparator()
    .addItem('🗑️ Clear Import Staging', 'clearImportStaging')
    .addItem('📋 View Import Exceptions', 'goToExceptionsSheet')
    .addSeparator()
    .addItem('🔄 Refresh Grade Summary Values', 'refreshGradeSummaryFormulas')
    .addToUi();
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT DIALOG
// ═══════════════════════════════════════════════════════════════════════════

function showImportDialog() {
  const html = HtmlService.createHtmlOutput(getImportDialogHtml())
    .setWidth(650)
    .setHeight(600)
    .setTitle('Import Data');
  SpreadsheetApp.getUi().showModalDialog(html, 'Import Data');
}

function getImportDialogHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Calibri, sans-serif; padding: 20px; background: #f5f5f5; }
    .container { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-height: 90vh; overflow-y: auto; }
    h2 { color: #4A90E2; margin-bottom: 8px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 20px; }
    .section { margin-bottom: 24px; }
    .section-title { font-weight: bold; color: #333; margin-bottom: 8px; }
    .format-example { background: #f8f9fa; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 11px; overflow-x: auto; white-space: nowrap; }
    .upload-area { border: 2px dashed #4A90E2; border-radius: 8px; padding: 30px; text-align: center; cursor: pointer; transition: background 0.2s; }
    .upload-area:hover { background: #f0f7ff; }
    .or-divider { text-align: center; color: #999; margin: 16px 0; }
    textarea { width: 100%; height: 100px; padding: 12px; border: 2px solid #e0e0e0; border-radius: 6px; font-family: monospace; font-size: 12px; resize: vertical; }
    textarea:focus { outline: none; border-color: #4A90E2; }
    .btn { padding: 12px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-right: 8px; }
    .btn-primary { background: #4A90E2; color: white; }
    .btn-primary:hover { background: #357ABD; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-secondary:hover { background: #5a6268; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .actions { margin-top: 20px; text-align: right; }
    .status { margin-top: 16px; padding: 12px; border-radius: 6px; display: none; }
    .status.success { display: block; background: #d4edda; color: #155724; }
    .status.error { display: block; background: #f8d7da; color: #721c24; }
    .status.info { display: block; background: #d1ecf1; color: #0c5460; }
    input[type="file"] { display: none; }
    .import-type-selector { margin-bottom: 24px; }
    .import-type-option { display: flex; align-items: flex-start; padding: 16px; margin-bottom: 12px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
    .import-type-option:hover { border-color: #4A90E2; background: #f8f9fa; }
    .import-type-option.selected { border-color: #4A90E2; background: #e8f4fc; }
    .import-type-option input[type="radio"] { margin-right: 12px; margin-top: 2px; width: 18px; height: 18px; }
    .import-type-info { flex: 1; }
    .import-type-name { font-weight: bold; color: #333; margin-bottom: 4px; }
    .import-type-desc { font-size: 13px; color: #666; }
    .info-box { background: #e7f3ff; border: 1px solid #b3d7ff; border-radius: 6px; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #004085; }
    .info-box.warning { background: #fff3cd; border-color: #ffc107; color: #856404; }
    .info-box.success { background: #d4edda; border-color: #c3e6cb; color: #155724; }
  </style>
</head>
<body>
  <div class="container">
    <h2>📂 Import Data</h2>
    <p class="subtitle">Import assessment or lesson progress data into the UFLI system</p>
    
    <div class="section import-type-selector">
      <div class="section-title">Step 1: Select Import Type</div>
      <div class="import-type-option selected" onclick="selectImportType('initial-grid')">
        <input type="radio" name="importType" id="typeInitialGrid" value="initial-grid" checked />
        <div class="import-type-info">
          <div class="import-type-name">📋 Initial Assessment - Grid Format (Recommended)</div>
          <div class="import-type-desc">Import from a spreadsheet that looks like UFLI MAP. <strong>Use this FIRST for new schools.</strong></div>
        </div>
      </div>
      <div class="import-type-option" onclick="selectImportType('progress')">
        <input type="radio" name="importType" id="typeProgress" value="progress" />
        <div class="import-type-info">
          <div class="import-type-name">📈 Lesson Progress - Row Format</div>
          <div class="import-type-desc">Import lesson check data. Updates "UFLI MAP" only.</div>
        </div>
      </div>
      <div class="import-type-option" onclick="selectImportType('initial-row')">
        <input type="radio" name="importType" id="typeInitialRow" value="initial-row" />
        <div class="import-type-info">
          <div class="import-type-name">📋 Initial Assessment - Row Format</div>
          <div class="import-type-desc">Import assessment data in row format.</div>
        </div>
      </div>
    </div>
    
    <div id="gridFormatInfo" class="info-box success">
      <strong>📊 Grid Format:</strong> Data like UFLI MAP - one row per student, lessons in columns.
    </div>
    <div id="rowFormatInfo" class="info-box" style="display: none;">
      <strong>📝 Row Format:</strong> Required columns: Student Name, Date, Group, Lesson, Status.
    </div>
    <div id="initialWarning" class="info-box warning">
      <strong>⚠️ Initial Assessment:</strong> Sets baseline in BOTH "Initial Assessment" and "UFLI MAP".
    </div>
    <div id="progressInfo" class="info-box" style="display: none;">
      <strong>💡 Lesson Progress:</strong> Updates "UFLI MAP" only (Growth).
    </div>
    
    <div class="section" id="formatSection">
      <div class="section-title">Step 2: Expected Format</div>
      <div id="gridFormatExample" class="format-example">Student Name,Grade,Teacher,UFLI L1,UFLI L2...<br>John Doe,G1,Ms. Smith,Y,Y...</div>
      <div id="rowFormatExample" class="format-example" style="display: none;">Student Name,Date,Group,Lesson,Status<br>John Doe,12/1/24,G1 Group 1,UFLI L42,Y</div>
    </div>
    
    <div class="section">
      <div class="section-title">Step 3: Upload or Paste Data</div>
      <div class="upload-area" onclick="document.getElementById('csvFile').click()">
        <div style="font-size: 36px; margin-bottom: 8px;">📄</div>
        <div>Click to select CSV file</div>
      </div>
      <input type="file" id="csvFile" accept=".csv,.txt,.tsv" onchange="handleFileUpload(event)" />
      <div class="or-divider">— OR —</div>
      <textarea id="pasteArea" placeholder="Paste your data here (including header row)..."></textarea>
    </div>
    
    <div id="statusMessage" class="status"></div>
    
    <div class="actions">
      <button class="btn btn-secondary" onclick="google.script.host.close()">Cancel</button>
      <button class="btn btn-primary" id="importBtn" onclick="processImport()">Import to Staging</button>
    </div>
  </div>
  
  <script>
    let csvData = '';
    let selectedImportType = 'initial-grid';
    
    function selectImportType(type) {
      selectedImportType = type;
      document.getElementById('typeInitialGrid').checked = (type === 'initial-grid');
      document.getElementById('typeProgress').checked = (type === 'progress');
      document.getElementById('typeInitialRow').checked = (type === 'initial-row');
      
      document.querySelectorAll('.import-type-option').forEach(opt => opt.classList.remove('selected'));
      event.currentTarget.classList.add('selected');
      
      const isGrid = (type === 'initial-grid');
      document.getElementById('gridFormatInfo').style.display = isGrid ? 'block' : 'none';
      document.getElementById('rowFormatInfo').style.display = isGrid ? 'none' : 'block';
      document.getElementById('gridFormatExample').style.display = isGrid ? 'block' : 'none';
      document.getElementById('rowFormatExample').style.display = isGrid ? 'none' : 'block';
      
      const isInitial = (type === 'initial-grid' || type === 'initial-row');
      document.getElementById('initialWarning').style.display = isInitial ? 'block' : 'none';
      document.getElementById('progressInfo').style.display = isInitial ? 'none' : 'block';
    }
    
    function handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        csvData = e.target.result;
        document.getElementById('pasteArea').value = csvData;
        showStatus('File loaded: ' + file.name, 'info');
      };
      reader.readAsText(file);
    }
    
    function processImport() {
      const pasteData = document.getElementById('pasteArea').value.trim();
      if (!pasteData) { showStatus('Please upload or paste data.', 'error'); return; }
      
      document.getElementById('importBtn').disabled = true;
      showStatus('Importing to staging...', 'info');
      
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showStatus(result.message, 'success');
            setTimeout(() => google.script.host.close(), 2000);
          } else {
            showStatus(result.message, 'error');
            document.getElementById('importBtn').disabled = false;
          }
        })
        .withFailureHandler(function(error) {
          showStatus('Error: ' + error.message, 'error');
          document.getElementById('importBtn').disabled = false;
        })
        .importCsvToStaging(pasteData, selectedImportType);
    }
    
    function showStatus(message, type) {
      const el = document.getElementById('statusMessage');
      el.textContent = message;
      el.className = 'status ' + type;
    }
  </script>
</body>
</html>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGING SHEET FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function importCsvToStaging(csvData, importType) {
  const functionName = 'importCsvToStaging';
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateAdminSheet(ss, ADMIN_SHEET_NAMES.IMPORT_STAGING);
    
    let dataRows;
    let isGridFormat = (importType === 'initial-grid');
    
    if (isGridFormat) {
      dataRows = parseGridFormat(csvData);
    } else {
      dataRows = parseRowFormat(csvData);
    }
    
    if (!dataRows || dataRows.length === 0) return { success: false, message: 'No valid data rows found.' };
    
    sheet.clear();
    const actualImportType = isGridFormat ? 'initial' : (importType === 'initial-row' ? 'initial' : 'progress');
    const importTypeLabel = actualImportType === 'initial' ? 'Initial Assessment' : 'Lesson Progress';
    
    const stagingHeaders = ["Student Name", "Date", "Group", "Lesson", "Status", "Import Type", "Validation Status"];
    sheet.getRange(1, 1, 1, stagingHeaders.length).setValues([stagingHeaders])
      .setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG).setFontWeight("bold");
    
        // Add import type and status columns, ensuring consistent row lengths
    const expectedCols = 7; // 5 data cols + Import Type + Validation Status
    const dataWithStatus = dataRows.map(row => {
      const baseRow = Array.isArray(row) ? row.slice(0, 5) : [row, '', '', '', ''];
      while (baseRow.length < 5) baseRow.push(''); // Pad if needed
      return [...baseRow, importTypeLabel, "Pending"];
    });

    if (dataWithStatus.length > 0) {
      sheet.getRange(2, 1, dataWithStatus.length, expectedCols).setValues(dataWithStatus);
    }

    
    sheet.setColumnWidth(1, 180); sheet.setColumnWidth(6, 140); sheet.setColumnWidth(7, 120);
    sheet.setFrozenRows(1);
    
    PropertiesService.getDocumentProperties().setProperty('CURRENT_IMPORT_TYPE', actualImportType);
    ss.setActiveSheet(sheet);
    
    return { success: true, message: `Imported ${dataRows.length} rows to staging. Run "Validate Import Data" next.` };
    
  } catch (error) {
    log(functionName, `Error: ${error.toString()}`, 'ERROR');
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

function parseGridFormat(csvData) {
  const rows = [];
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) throw new Error('Grid format must have header + data.');
  
  const headers = parseCSVLine(lines[0]);
  let lessonStartCol = -1;
  const lessonColumnMap = [];
  
  // Use globally available extractLessonNumber from Phase2 script
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toString().trim();
    const lessonNum = extractLessonNumber(header); 
    if (lessonNum) {
      if (lessonStartCol === -1) lessonStartCol = i;
      lessonColumnMap.push({ col: i, lessonNum: lessonNum });
    }
  }
  
  if (lessonColumnMap.length === 0) throw new Error('No lesson columns found (e.g. "UFLI L1").');
  
  let nameColIndex = 0;
  for (let i = 0; i < Math.min(headers.length, lessonStartCol); i++) {
    if (headers[i].toString().toLowerCase().includes('name')) { nameColIndex = i; break; }
  }
  
  const today = new Date().toLocaleDateString();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const studentName = values[nameColIndex] ? values[nameColIndex].toString().trim() : '';
    if (!studentName) continue;
    
    for (const lessonCol of lessonColumnMap) {
      const status = values[lessonCol.col] ? values[lessonCol.col].toString().toUpperCase().trim() : '';
      if (status && ['Y','N','A'].includes(status)) {
        rows.push([studentName, today, '', `UFLI L${lessonCol.lessonNum}`, status]);
      }
    }
  }
  return rows;
}

function parseRowFormat(csvData) {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have header + data.');
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const expected = ['student', 'date', 'group', 'lesson', 'status'];
  if (!expected.every(h => headers.some(hdr => hdr.includes(h)))) throw new Error('Missing required columns.');
  
  const dataRows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    if (values.length >= 5) {
      dataRows.push([
        values[0]||'', values[1]||'', values[2]||'', values[3]||'', (values[4]||'').toUpperCase().trim()
      ]);
    }
  }
  return dataRows;
}

function parseCSVLine(line) {
  const values = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if ((char === ',' || char === '\t') && !inQuotes) { values.push(sanitizeCellValue(current.trim())); current = ''; }
    else current += char;
  }
  values.push(sanitizeCellValue(current.trim()));
  return values;
}


function getOrCreateAdminSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  return sheet;
}
/**
 * Sanitizes a cell value to prevent formula injection attacks.
 * Cells starting with =, +, -, @, tab, or carriage return are prefixed with a single quote.
 * Also limits string length to prevent excessively long inputs.
 * @param {*} value - The value to sanitize
 * @returns {string} Sanitized string value
 */
function sanitizeCellValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') value = value.toString();

  // Limit string length to prevent excessively long inputs (max 32767 chars for Google Sheets cell)
  const MAX_CELL_LENGTH = 32767;
  if (value.length > MAX_CELL_LENGTH) {
    value = value.substring(0, MAX_CELL_LENGTH);
  }

  // Prevent formula injection - escape cells starting with dangerous characters
  // These characters can trigger formula execution in spreadsheet applications
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value; // Prefix with single quote to treat as text
  }

  // Remove null bytes which could cause issues
  value = value.replace(/\x00/g, '');

  return value;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function validateImportData() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stagingSheet = ss.getSheetByName(ADMIN_SHEET_NAMES.IMPORT_STAGING);
  
  if (!stagingSheet || stagingSheet.getLastRow() < 2) {
    ui.alert('No Data', 'Import Staging sheet is empty.', ui.ButtonSet.OK);
    return;
  }
  
  const lastRow = stagingSheet.getLastRow();
  const stagingData = stagingSheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const studentLookup = buildStudentLookup(ss);
  
  const exceptions = [];
  const validationStatuses = [];
  let validCount = 0, errorCount = 0;
  
  stagingData.forEach((row, i) => {
    const [name, date, group, lesson, status] = row;
    const rowExceptions = validateRow(i + 2, name, date, group, lesson, status, studentLookup);
    if (rowExceptions.length === 0) {
      validationStatuses.push(["✓ Valid"]);
      validCount++;
    } else {
      validationStatuses.push(["✗ Error"]);
      errorCount++;
      exceptions.push(...rowExceptions);
    }
  });
  
  stagingSheet.getRange(2, 7, validationStatuses.length, 1).setValues(validationStatuses);
  applyValidationFormatting(stagingSheet, lastRow);
  createExceptionsReport(ss, exceptions);
  
  const msg = `✓ Valid: ${validCount}\n✗ Errors: ${errorCount}\n\n` + (errorCount > 0 ? 'Review "Import Exceptions".' : 'Ready to Process Import.');
  ui.alert('Validation Results', msg, ui.ButtonSet.OK);
}

function buildStudentLookup(ss) {
  const lookup = new Map();
  const rosterSheet = ss.getSheetByName(SHEET_NAMES.STUDENT_ROSTER);
  if (rosterSheet && rosterSheet.getLastRow() >= LAYOUT.DATA_START_ROW) {
    const data = rosterSheet.getRange(LAYOUT.DATA_START_ROW, 1, rosterSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 1).getValues();
    data.forEach(row => { if(row[0]) lookup.set(normalizeStudentName(row[0]), row[0].toString().trim()); });
  }
  return lookup;
}

function normalizeStudentName(name) {
  return name ? name.toString().toLowerCase().trim().replace(/\s+/g, ' ') : '';
}

function validateRow(rowNum, name, date, group, lesson, status, lookup) {
  const ex = [];
  const raw = `${lesson}, ${status}`;
  if (!name) ex.push({ row: rowNum, studentName: '(empty)', issueType: 'Missing Name', details: 'Required', rawData: raw });
  else if (!lookup.has(normalizeStudentName(name))) ex.push({ row: rowNum, studentName: name, issueType: 'Not Found', details: 'Not in Roster', rawData: raw });
  
  if (!lesson || !extractLessonNumber(lesson)) ex.push({ row: rowNum, studentName: name||'', issueType: 'Invalid Lesson', details: lesson, rawData: raw });
  if (!['Y','N','A'].includes(status.toString().toUpperCase())) ex.push({ row: rowNum, studentName: name||'', issueType: 'Invalid Status', details: status, rawData: raw });
  
  return ex;
}

function applyValidationFormatting(sheet, lastRow) {
  const range = sheet.getRange(2, 7, lastRow - 1, 1);
  const rules = sheet.getConditionalFormatRules().filter(r => !r.getRanges().some(rng => rng.getA1Notation() === range.getA1Notation()));
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Valid').setBackground('#d4edda').setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Error').setBackground('#f8d7da').setRanges([range]).build());
  sheet.setConditionalFormatRules(rules);
}

function createExceptionsReport(ss, exceptions) {
  const sheet = getOrCreateAdminSheet(ss, ADMIN_SHEET_NAMES.IMPORT_EXCEPTIONS);
  sheet.clear();
  const headers = ["Row", "Student Name", "Issue Type", "Details", "Raw Data"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG).setFontWeight("bold");
  
  if (exceptions.length > 0) {
    const data = exceptions.map(e => [e.row, e.studentName, e.issueType, e.details, e.rawData]);
    sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
  } else {
    sheet.getRange(2, 1).setValue("No exceptions found - all data is valid!");
  }
  sheet.setFrozenRows(1);
}

function goToExceptionsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ADMIN_SHEET_NAMES.IMPORT_EXCEPTIONS);
  if (sheet) ss.setActiveSheet(sheet);
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESS IMPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function processImportData() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stagingSheet = ss.getSheetByName(ADMIN_SHEET_NAMES.IMPORT_STAGING);
  
  if (!stagingSheet || stagingSheet.getLastRow() < 2) { ui.alert('No Data to process.'); return; }
  
  const importType = PropertiesService.getDocumentProperties().getProperty('CURRENT_IMPORT_TYPE') || 'progress';
  const stagingData = stagingSheet.getRange(2, 1, stagingSheet.getLastRow() - 1, 7).getValues();
  const validRows = stagingData.filter(row => row[6] && row[6].toString().includes('Valid'));
  
  if (validRows.length === 0) { ui.alert('No valid rows to import.'); return; }
  
  const response = ui.alert('Confirm Import', `Import ${validRows.length} rows as "${importType}"?`, ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;
  
  const studentLookup = buildStudentLookup(ss);
  const bestEntries = buildBestEntryMap(validRows, studentLookup);
  
  let result;
  if (importType === 'initial') result = processInitialAssessmentImport(ss, bestEntries, studentLookup);
  else result = processLessonProgressImport(ss, bestEntries, studentLookup);
  
  archiveToHistorical(ss, validRows, studentLookup, importType);
  
  ui.alert('Import Complete', `Processed: ${result.processedCount}\nSkipped: ${result.skippedCount}`, ui.ButtonSet.OK);
}

function processInitialAssessmentImport(ss, bestEntries, studentLookup) {
  const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);
  let initialSheet = ss.getSheetByName(ADMIN_SHEET_NAMES.INITIAL_ASSESSMENT);
  if (!initialSheet) initialSheet = createInitialAssessmentSheet(ss, mapSheet);
  
  const mapRowLookup = buildStudentRowLookup(mapSheet);
  const initialRowLookup = buildStudentRowLookup(initialSheet);
  
  const updates = [];
  const initialUpdates = [];
  let processedCount = 0, skippedCount = 0;
  
  bestEntries.forEach((entry, key) => {
    const [normName, lessonNum] = key.split('|');
    const mapRow = mapRowLookup.get(normName);
    const initialRow = initialRowLookup.get(normName);
    
    if (mapRow && initialRow) {
      const col = LAYOUT.LESSON_COLUMN_OFFSET + parseInt(lessonNum);
      updates.push({ row: mapRow, col: col, value: entry.status });
      initialUpdates.push({ row: initialRow, col: col, value: entry.status });
      processedCount++;
    } else skippedCount++;
  });
  
  if (updates.length > 0) applyMapUpdates(mapSheet, updates);
  if (initialUpdates.length > 0) applyMapUpdates(initialSheet, initialUpdates);
  
  repairSheetFormatting(mapSheet);
  repairSheetFormatting(initialSheet);
  
  // TRIGGER STATS UPDATE using Phase 2 engine
  updateAllStats(ss);
  
  return { processedCount, skippedCount };
}

function processLessonProgressImport(ss, bestEntries, studentLookup) {
  const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);
  const mapRowLookup = buildStudentRowLookup(mapSheet);
  
  const updates = [];
  let processedCount = 0, skippedCount = 0;
  
  bestEntries.forEach((entry, key) => {
    const [normName, lessonNum] = key.split('|');
    const mapRow = mapRowLookup.get(normName);
    if (mapRow) {
      updates.push({ row: mapRow, col: LAYOUT.LESSON_COLUMN_OFFSET + parseInt(lessonNum), value: entry.status });
      processedCount++;
    } else skippedCount++;
  });
  
  if (updates.length > 0) applyMapUpdates(mapSheet, updates);
  repairSheetFormatting(mapSheet);
  
  // TRIGGER STATS UPDATE using Phase 2 engine
  updateAllStats(ss);
  
  return { processedCount, skippedCount };
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createInitialAssessmentSheet(ss, mapSheet) {
  const initialSheet = mapSheet.copyTo(ss).setName(ADMIN_SHEET_NAMES.INITIAL_ASSESSMENT);
  initialSheet.getRange(1, 1).setValue("INITIAL ASSESSMENT - BASELINE DATA");
  
  const lastRow = initialSheet.getLastRow();
  if (lastRow >= LAYOUT.DATA_START_ROW) {
    // Clear lesson data, keep names
    initialSheet.getRange(LAYOUT.DATA_START_ROW, LAYOUT.COL_CURRENT_LESSON, 
      lastRow - LAYOUT.DATA_START_ROW + 1, initialSheet.getLastColumn() - LAYOUT.COL_CURRENT_LESSON + 1).clearContent();
  }
  return initialSheet;
}

function buildStudentRowLookup(sheet) {
  const lookup = new Map();
  const lastRow = sheet.getLastRow();
  if (lastRow < LAYOUT.DATA_START_ROW) return lookup;
  const data = sheet.getRange(LAYOUT.DATA_START_ROW, 1, lastRow - LAYOUT.DATA_START_ROW + 1, 1).getValues();
  data.forEach((row, i) => { if(row[0]) lookup.set(normalizeStudentName(row[0]), i + LAYOUT.DATA_START_ROW); });
  return lookup;
}

function buildBestEntryMap(validRows, studentLookup) {
  const best = new Map();
  validRows.forEach(row => {
    const [name, date, group, lesson, status] = row;
    const norm = normalizeStudentName(name);
    const num = extractLessonNumber(lesson);
    if (!norm || !num) return;
    
    const key = `${norm}|${num}`;
    const normStatus = status.toUpperCase().trim();
    const priority = STATUS_PRIORITY[normStatus] || 0;
    
    const existing = best.get(key);
    if (!existing || priority > existing.priority) {
      best.set(key, { studentName: studentLookup.get(norm)||name, lessonNum: num, status: normStatus, priority });
    }
  });
  return best;
}

function applyMapUpdates(sheet, updates) {
  const rowUpdates = new Map();
  updates.forEach(u => {
    if (!rowUpdates.has(u.row)) rowUpdates.set(u.row, []);
    rowUpdates.get(u.row).push(u);
  });
  rowUpdates.forEach((cells, row) => {
    cells.forEach(c => sheet.getRange(c.row, c.col).setValue(c.value));
  });
}

function repairSheetFormatting(sheet) {
  // Leverages Phase 2 shared formatting logic if available, or locally re-applies
  if (typeof applyStatusConditionalFormatting === 'function') {
    sheet.clearConditionalFormatRules();
    applyStatusConditionalFormatting(sheet, LAYOUT.DATA_START_ROW, LAYOUT.COL_FIRST_LESSON, sheet.getLastRow(), LAYOUT.TOTAL_LESSONS);
  }
}

function archiveToHistorical(ss, validRows, studentLookup, importType) {
  const sheet = getOrCreateAdminSheet(ss, ADMIN_SHEET_NAMES.HISTORICAL);
  if (sheet.getLastRow() === 0) {
    const headers = ["Import Date", "Import Type", "Student Name", "Original Date", "Group", "Lesson", "Status"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  
  const date = new Date();
  const typeLabel = importType === 'initial' ? 'Initial Assessment' : 'Lesson Progress';
  const rows = validRows.map(r => [date, typeLabel, studentLookup.get(normalizeStudentName(r[0]))||r[0], r[1], r[2], r[3], r[4]]);
  
  if (rows.length > 0) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function clearImportStaging() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ui.alert('Clear Import Staging?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  
  const stg = ss.getSheetByName(ADMIN_SHEET_NAMES.IMPORT_STAGING);
  if (stg) {
    stg.clear();
    const h = ["Student Name", "Date", "Group", "Lesson", "Status", "Import Type", "Validation Status"];
    stg.getRange(1, 1, 1, h.length).setValues([h]).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG).setFontWeight("bold");
  }
  
  const exc = ss.getSheetByName(ADMIN_SHEET_NAMES.IMPORT_EXCEPTIONS);
  if (exc) exc.clear();
  
  PropertiesService.getDocumentProperties().deleteProperty('CURRENT_IMPORT_TYPE');
  ui.alert('Cleared.');
}

// ═══════════════════════════════════════════════════════════════════════════
// GRADE SUMMARY FORMULA REFRESH (UPDATED)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * REPLACED: Now calls the static calculation engine from Phase 2
 * instead of building volatile formulas.
 */
function refreshGradeSummaryFormulas() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Call the shared function from Phase2_ProgressTracking.js
    // This recalculates all stats (Skills + Grade Summary) and writes static values
    if (typeof updateAllStats === 'function') {
      updateAllStats(ss);
      ui.alert('Success', 'Grade Summary and Skills Tracker values have been recalculated.', ui.ButtonSet.OK);
    } else {
      throw new Error('updateAllStats function not found. Please ensure Phase2_ProgressTracking.js is updated.');
    }
  } catch (error) {
    ui.alert('Error', error.toString(), ui.ButtonSet.OK);
  }
}
// NOTE: log() function is defined in Phase2_ProgressTracking
// This file uses the canonical log() from there to avoid duplicate definitions
