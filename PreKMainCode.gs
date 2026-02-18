// ====================================================================
// ============ ALL CONFIGURATION CONSTANTS ===========================
// ====================================================================

// --- SHEET NAMES ---
const ROSTER_SHEET_NAME = "Roster";
const PRE_SCHOOL_SHEET_NAME = "Pre-School";
const PRE_K_SHEET_NAME = "Pre-K";
const PACING_SHEET_NAME = "Pacing";
const SUMMARY_SHEET_NAME = "Skill Summary Page";
const TUTOR_SHEET_NAME = "Tutors";
const TUTORS_SHEET_NAME = "Tutors"; // Alias for setup wizard
const TUTOR_LOG_SHEET_NAME = "Tutor Log";
const SEQUENCE_SHEET_NAME = "Instructional Sequence"; // Letter teaching order

// --- SHEET STRUCTURE ---
// Setup Wizard creates sheets with: headers in row 1, data starting in row 2
// All functions in this file use this structure.
//
// DEPRECATED LEGACY CONSTANTS (kept for reference only - do not use):
// const HEADER_ROW = 5;        // Old template used row 5 for headers
// const DATA_START_ROW = 6;    // Old template used row 6 for data
// const SUMMARY_START_ROW = 6; // Old template used row 6 for summary data

// --- SUMMARY COLUMN CONFIGURATION ---
const TOTAL_LESSONS = 26; // Total letters in the curriculum
const SUMMARY_PRE_SCHOOL_IN_PROGRESS_COL = 3; // Col C
const SUMMARY_PRE_SCHOOL_CUMULATIVE_COL = 4; // Col D
const SUMMARY_PRE_K_FORM_IN_PROGRESS_COL = 5; // Col E
const SUMMARY_PRE_K_FORM_CUMULATIVE_COL = 6; // Col F
const SUMMARY_PRE_K_NAME_IN_PROGRESS_COL = 7; // Col G
const SUMMARY_PRE_K_NAME_CUMULATIVE_COL = 8; // Col H
const SUMMARY_PRE_K_SOUND_IN_PROGRESS_COL = 9; // Col I
const SUMMARY_PRE_K_SOUND_CUMULATIVE_COL = 10; // Col J
const SUMMARY_LAST_COL = 10; // The last column we are writing to

// --- PARENT REPORT CONFIGURATION ---
const TEMPLATE_DOC_ID = "1gi84aTPTz2ivELGNwDlrAbwOf_DM8x5NoUCNIeyS3I8"; // Your Template ID
const REPORT_FOLDER_ID = "1RDvb8dtVadMNRpsYhjSu0W8QuE_Lj9UX"; // Your Folder ID

// ====================================================================
// ============ UTILITY FUNCTIONS (Available via Quick Fixes menu) ====
// ====================================================================
// Note: These functions are available for manual fixes but are NOT
// required when using the Setup Wizard - all sheets are created
// correctly from the start.

/**
 * QUICK FIX: Creates the Pre-School sheet if it's missing.
 * Run this directly from the Apps Script editor.
 */
function createPreSchoolSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let preSchoolSheet = ss.getSheetByName(PRE_SCHOOL_SHEET_NAME);

  if (preSchoolSheet) {
    SpreadsheetApp.getUi().alert('Pre-School sheet already exists! Use fixPreSchoolHeaders() to update headers.');
    return;
  }

  preSchoolSheet = ss.insertSheet(PRE_SCHOOL_SHEET_NAME);
  const headers = ['Name'];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  letters.forEach(letter => headers.push(`Letter Sound ${letter}`));

  preSchoolSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  preSchoolSheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1E3A5F')
    .setFontColor('white');
  preSchoolSheet.setFrozenRows(1);
  preSchoolSheet.setFrozenColumns(1);
  preSchoolSheet.autoResizeColumns(1, headers.length);

  SpreadsheetApp.getUi().alert('Pre-School sheet created successfully!');
}

/**
 * QUICK FIX: Updates the Pre-School sheet headers to "Letter Sound A" format.
 * Run this to fix an existing Pre-School sheet.
 */
function fixPreSchoolHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const preSchoolSheet = ss.getSheetByName(PRE_SCHOOL_SHEET_NAME);

  if (!preSchoolSheet) {
    SpreadsheetApp.getUi().alert('Pre-School sheet not found! Use createPreSchoolSheet() first.');
    return;
  }

  const headers = ['Name'];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  letters.forEach(letter => headers.push(`Letter Sound ${letter}`));

  preSchoolSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  preSchoolSheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1E3A5F')
    .setFontColor('white');
  preSchoolSheet.autoResizeColumns(1, headers.length);

  SpreadsheetApp.getUi().alert('Pre-School headers updated to "Letter Sound A" through "Letter Sound Z"!');
}

/**
 * QUICK FIX: Updates the Skill Summary Page headers to correct format.
 * Run this to fix an existing Skill Summary Page.
 */
function fixSummaryHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);

  if (!summarySheet) {
    SpreadsheetApp.getUi().alert('Skill Summary Page not found!');
    return;
  }

  const headers = [
    'Name', 'Program',
    'Pre-School Letter Sound In-Progress', 'Pre-School Letter Sound Cumulative',
    'Pre-K Form In-Progress', 'Pre-K Form Cumulative',
    'Pre-K Name In-Progress', 'Pre-K Name Cumulative',
    'Pre-K Sound In-Progress', 'Pre-K Sound Cumulative'
  ];

  summarySheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  summarySheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1E3A5F')
    .setFontColor('white');
  summarySheet.autoResizeColumns(1, headers.length);

  SpreadsheetApp.getUi().alert('Skill Summary Page headers updated!');
}

/**
 * Alias for calculateAllSummaries - kept for backward compatibility.
 * The main function now uses the correct sheet structure.
 */
function fixCalculateSummaries() {
  calculateAllSummaries();
}

/**
 * Alias for fixPacingSheetWithProgress - kept for backward compatibility.
 * Use fixPacingSheetWithProgress for full progress tracking.
 */
function fixUpdatePacingSheet() {
  fixPacingSheetWithProgress();
}

/**
 * QUICK FIX: Comprehensive Pacing sheet update with actual progress data.
 * Restructures the Pacing sheet to show meaningful progress metrics per group.
 * Run this from the Apps Script editor to fix Pacing display issues.
 */
function fixPacingSheetWithProgress() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pacingSheet = ss.getSheetByName(PACING_SHEET_NAME);
  const rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);
  const preKSheet = ss.getSheetByName(PRE_K_SHEET_NAME);
  const preSchoolSheet = ss.getSheetByName(PRE_SCHOOL_SHEET_NAME);

  if (!pacingSheet || !rosterSheet) {
    SpreadsheetApp.getUi().alert("Error: Pacing or Roster sheet not found.");
    return;
  }

  // Get roster data: Map group -> {students: [], programs: Set}
  const rosterData = rosterSheet.getDataRange().getValues();
  const groupInfo = new Map();

  for (let i = 1; i < rosterData.length; i++) {
    const studentName = rosterData[i][0];
    const groupName = rosterData[i][1];
    const program = rosterData[i][2];

    if (!studentName || !groupName) continue;

    if (!groupInfo.has(groupName)) {
      groupInfo.set(groupName, { students: [], programs: new Set() });
    }
    groupInfo.get(groupName).students.push({ name: studentName, program: program });
    groupInfo.get(groupName).programs.add(program);
  }

  // Get Pre-K assessment data (headers row 1, data row 2+)
  let preKMap = new Map();
  let preKHeaders = [];
  if (preKSheet) {
    const pkData = preKSheet.getDataRange().getValues();
    if (pkData.length > 0) {
      preKHeaders = pkData[0];
      for (let i = 1; i < pkData.length; i++) {
        if (pkData[i][0]) preKMap.set(pkData[i][0], pkData[i]);
      }
    }
  }

  // Get Pre-School assessment data (headers row 1, data row 2+)
  let preSchoolMap = new Map();
  let preSchoolHeaders = [];
  if (preSchoolSheet) {
    const psData = preSchoolSheet.getDataRange().getValues();
    if (psData.length > 0) {
      preSchoolHeaders = psData[0];
      for (let i = 1; i < psData.length; i++) {
        if (psData[i][0]) preSchoolMap.set(psData[i][0], psData[i]);
      }
    }
  }

  // Clear and rebuild Pacing sheet
  pacingSheet.clear();

  // New headers with progress columns
  const headers = [
    'Group', 'Students', 'Program(s)', 'Current Letter',
    'Form %', 'Name %', 'Sound %', 'Pre-School %', 'Overall %'
  ];

  pacingSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  pacingSheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1E3A5F')
    .setFontColor('white');

  // Build data rows for each group
  const outputData = [];
  const colorData = [];

  for (const [groupName, info] of groupInfo) {
    const studentCount = info.students.length;
    const programs = Array.from(info.programs).join(', ');

    // Calculate progress for each skill
    let formTotal = 0, formComplete = 0;
    let nameTotal = 0, nameComplete = 0;
    let soundTotal = 0, soundComplete = 0;
    let psTotal = 0, psComplete = 0;
    let currentLetter = 'A';
    let maxLetterIndex = 0;

    for (const student of info.students) {
      if (student.program === 'Pre-K') {
        const studentData = preKMap.get(student.name);
        if (studentData) {
          // Count Form, Name, Sound progress (columns like A-Form, A-Name, A-Sound)
          for (let c = 1; c < preKHeaders.length; c++) {
            const header = preKHeaders[c];
            const value = studentData[c];
            const isComplete = (value === 'Y' || value === 'y');
            const isAssessed = (value === 'Y' || value === 'y' || value === 'N' || value === 'n');

            if (header && header.includes('-Form')) {
              formTotal++;
              if (isComplete) formComplete++;
              // Track progress through letters
              if (isAssessed) {
                const letterMatch = header.match(/^([A-Z])-Form/);
                if (letterMatch) {
                  const letterIndex = letterMatch[1].charCodeAt(0) - 65;
                  if (letterIndex > maxLetterIndex) maxLetterIndex = letterIndex;
                }
              }
            } else if (header && header.includes('-Name')) {
              nameTotal++;
              if (isComplete) nameComplete++;
            } else if (header && header.includes('-Sound')) {
              soundTotal++;
              if (isComplete) soundComplete++;
            }
          }
        }
      } else if (student.program === 'Pre-School') {
        const studentData = preSchoolMap.get(student.name);
        if (studentData) {
          // Count Letter Sound progress
          for (let c = 1; c < preSchoolHeaders.length; c++) {
            const value = studentData[c];
            const isComplete = (value === 'Y' || value === 'y');
            const isAssessed = (value === 'Y' || value === 'y' || value === 'N' || value === 'n');

            psTotal++;
            if (isComplete) psComplete++;

            // Track progress through letters
            if (isAssessed && preSchoolHeaders[c]) {
              const letterMatch = preSchoolHeaders[c].match(/Letter Sound ([A-Z])/);
              if (letterMatch) {
                const letterIndex = letterMatch[1].charCodeAt(0) - 65;
                if (letterIndex > maxLetterIndex) maxLetterIndex = letterIndex;
              }
            }
          }
        }
      }
    }

    // Calculate percentages
    const formPct = formTotal > 0 ? Math.round((formComplete / formTotal) * 100) : 0;
    const namePct = nameTotal > 0 ? Math.round((nameComplete / nameTotal) * 100) : 0;
    const soundPct = soundTotal > 0 ? Math.round((soundComplete / soundTotal) * 100) : 0;
    const psPct = psTotal > 0 ? Math.round((psComplete / psTotal) * 100) : 0;

    // Calculate overall based on what programs are active
    let overallPct = 0;
    let overallCount = 0;
    if (formTotal > 0) { overallPct += formPct; overallCount++; }
    if (nameTotal > 0) { overallPct += namePct; overallCount++; }
    if (soundTotal > 0) { overallPct += soundPct; overallCount++; }
    if (psTotal > 0) { overallPct += psPct; overallCount++; }
    overallPct = overallCount > 0 ? Math.round(overallPct / overallCount) : 0;

    // Determine current letter based on progress
    currentLetter = String.fromCharCode(65 + Math.min(maxLetterIndex, 25));

    outputData.push([
      groupName,
      studentCount,
      programs,
      currentLetter,
      formTotal > 0 ? formPct + '%' : '-',
      nameTotal > 0 ? namePct + '%' : '-',
      soundTotal > 0 ? soundPct + '%' : '-',
      psTotal > 0 ? psPct + '%' : '-',
      overallPct + '%'
    ]);

    // Color coding based on overall progress
    colorData.push(getProgressColor(overallPct));
  }

  // Write data
  if (outputData.length > 0) {
    pacingSheet.getRange(2, 1, outputData.length, headers.length).setValues(outputData);

    // Apply conditional color formatting to the Overall % column
    for (let i = 0; i < colorData.length; i++) {
      pacingSheet.getRange(i + 2, 9).setBackground(colorData[i]); // Column I (Overall %)

      // Also color the individual skill columns based on their percentages
      const row = outputData[i];
      if (row[4] !== '-') pacingSheet.getRange(i + 2, 5).setBackground(getProgressColor(parseInt(row[4])));
      if (row[5] !== '-') pacingSheet.getRange(i + 2, 6).setBackground(getProgressColor(parseInt(row[5])));
      if (row[6] !== '-') pacingSheet.getRange(i + 2, 7).setBackground(getProgressColor(parseInt(row[6])));
      if (row[7] !== '-') pacingSheet.getRange(i + 2, 8).setBackground(getProgressColor(parseInt(row[7])));
    }
  }

  // Auto-resize and format
  pacingSheet.autoResizeColumns(1, headers.length);
  pacingSheet.setFrozenRows(1);

  SpreadsheetApp.getUi().alert("Pacing sheet updated with progress data!");
}

/**
 * Helper function to get background color based on progress percentage.
 */
function getProgressColor(percentage) {
  if (percentage >= 80) return '#d9ead3'; // Light green (excellent)
  if (percentage >= 50) return '#fff2cc'; // Light yellow (good progress)
  if (percentage >= 20) return '#fce5cd'; // Light orange (needs work)
  return '#f4cccc'; // Light red (just started)
}

/**
 * QUICK FIX: Creates any missing sheets (Pre-K, Pre-School, Summary, etc.)
 * Run this directly from the Apps Script editor.
 */
function createAllMissingSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const created = [];

  // Pre-K Sheet
  if (!ss.getSheetByName(PRE_K_SHEET_NAME)) {
    const sheet = ss.insertSheet(PRE_K_SHEET_NAME);
    const headers = ['Name'];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    letters.forEach(letter => {
      headers.push(`${letter}-Form`, `${letter}-Name`, `${letter}-Sound`);
    });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(1);
    created.push('Pre-K');
  }

  // Pre-School Sheet
  if (!ss.getSheetByName(PRE_SCHOOL_SHEET_NAME)) {
    const sheet = ss.insertSheet(PRE_SCHOOL_SHEET_NAME);
    const headers = ['Name'];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    letters.forEach(letter => headers.push(`Letter Sound ${letter}`));
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(1);
    created.push('Pre-School');
  }

  // Skill Summary Page
  if (!ss.getSheetByName(SUMMARY_SHEET_NAME)) {
    const sheet = ss.insertSheet(SUMMARY_SHEET_NAME);
    const headers = ['Name', 'Program',
      'Pre-School Letter Sound In-Progress', 'Pre-School Letter Sound Cumulative',
      'Pre-K Form In-Progress', 'Pre-K Form Cumulative',
      'Pre-K Name In-Progress', 'Pre-K Name Cumulative',
      'Pre-K Sound In-Progress', 'Pre-K Sound Cumulative'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
    created.push('Skill Summary Page');
  }

  // Roster
  if (!ss.getSheetByName(ROSTER_SHEET_NAME)) {
    const sheet = ss.insertSheet(ROSTER_SHEET_NAME);
    sheet.getRange(1, 1, 1, 3).setValues([['Name', 'Group', 'Program']]);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
    created.push('Roster');
  }

  // Tutors
  if (!ss.getSheetByName(TUTORS_SHEET_NAME)) {
    const sheet = ss.insertSheet(TUTORS_SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([['Name', 'Role']]);
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
    created.push('Tutors');
  }

  // Tutor Log
  if (!ss.getSheetByName(TUTOR_LOG_SHEET_NAME)) {
    const sheet = ss.insertSheet(TUTOR_LOG_SHEET_NAME);
    const headers = ['Timestamp', 'Tutor', 'Student', 'Program', 'Letter', 'Form Status', 'Name Status', 'Sound Status', 'Notes'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
    sheet.setFrozenRows(1);
    created.push('Tutor Log');
  }

  // Pacing
  if (!ss.getSheetByName(PACING_SHEET_NAME)) {
    const sheet = ss.insertSheet(PACING_SHEET_NAME);
    sheet.getRange(1, 1, 1, 3).setValues([['Group', 'Current Letter', 'Student Count']]);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
    created.push('Pacing');
  }

  // Instructional Sequence
  if (!ss.getSheetByName(SEQUENCE_SHEET_NAME)) {
    createInstructionalSequenceSheet(ss);
    created.push('Instructional Sequence');
  }

  if (created.length > 0) {
    SpreadsheetApp.getUi().alert('Created sheets:\n\n• ' + created.join('\n• '));
  } else {
    SpreadsheetApp.getUi().alert('All sheets already exist!');
  }
}

/**
 * QUICK FIX: Creates or resets the Instructional Sequence sheet.
 * Populates with default Handwriting Without Tears letter order.
 * Run this from the Apps Script editor or via the menu.
 */
function setupInstructionalSequence() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createInstructionalSequenceSheet(ss);
  SpreadsheetApp.getUi().alert('Instructional Sequence sheet created/updated with default letter sets!');
}

/**
 * Helper function to create the Instructional Sequence sheet.
 * @param {Spreadsheet} ss The active spreadsheet.
 */
function createInstructionalSequenceSheet(ss) {
  let sheet = ss.getSheetByName(SEQUENCE_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SEQUENCE_SHEET_NAME);
  } else {
    sheet.clear();
  }

  // Headers
  const headers = ['Sequence Name', 'Letters', 'Notes'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1E3A5F')
    .setFontColor('white');

  // Default data - Handwriting Without Tears recommended order
  const defaultSequences = [
    ['Set 1', 'A, M, S, T', 'Easy capitals - straight lines'],
    ['Set 2', 'C, O, G, Q', 'Curved letters'],
    ['Set 3', 'H, I, E, L', 'Lines and curves'],
    ['Set 4', 'F, D, P, B', 'Trickier curves'],
    ['Set 5', 'R, N, K, J', 'Diagonal lines'],
    ['Set 6', 'U, V, W, X', 'More diagonals'],
    ['Set 7', 'Y, Z', 'Final letters']
  ];

  sheet.getRange(2, 1, defaultSequences.length, 3).setValues(defaultSequences);

  // Add alternating row colors for readability
  for (let i = 0; i < defaultSequences.length; i++) {
    const bgColor = (i % 2 === 0) ? '#F8FAFC' : '#FFFFFF';
    sheet.getRange(i + 2, 1, 1, 3).setBackground(bgColor);
  }

  // Format and freeze
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 3);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 250);

  // Add a note to the header
  sheet.getRange(1, 2).setNote('Enter letters separated by commas (e.g., "A, M, S, T")');
}


// ====================================================================
// ============ MAIN WEB APP & MENU FUNCTIONS =========================
// ====================================================================

/**
 * Serves the correct HTML file based on a URL parameter.
 * No parameter = Portal (landing page)
 * ?page=teacher = Teacher Portal (Index.html)
 * ?page=tutor = Tutor Portal (TutorForm.html)
 * ?page=dashboard = Program Overview Dashboard
 * ?page=setup = Site Setup Wizard
 */
function doGet(e) {
  var page = e.parameter.page;

  if (page == "teacher") {
    // Teacher Portal
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Teacher Portal - The Indy Learning Team with Adira Reads')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } else if (page == "tutor") {
    // Tutor Portal
    return HtmlService.createHtmlOutputFromFile('TutorForm')
      .setTitle('Tutor Portal - The Indy Learning Team with Adira Reads')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } else if (page == "dashboard") {
    // Program Overview Dashboard
    return HtmlService.createHtmlOutputFromFile('Dashboard')
      .setTitle('Program Overview Dashboard - The Indy Learning Team with Adira Reads')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } else if (page == "setup") {
    // Site Setup Wizard
    return HtmlService.createHtmlOutputFromFile('SetupWizard')
      .setTitle('Site Setup Wizard - The Indy Learning Team with Adira Reads')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } else {
    // Default: Portal landing page
    return HtmlService.createHtmlOutputFromFile('Portal')
      .setTitle('PreK Literacy Program - The Indy Learning Team with Adira Reads')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
}

/**
 * Returns the web app URL for navigation from HTML pages.
 * Called from Portal.html to enable navigation between portals.
 */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * Creates a custom menu in the spreadsheet when it opens.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('TILT Adira Reads PreK Program')
    .addItem('Site Setup Wizard', 'openSetupWizard')
    .addSeparator()
    .addItem('Update Summary Page', 'calculateAllSummaries')
    .addItem('Update Pacing Progress', 'fixPacingSheetWithProgress')
    .addSeparator()
    .addItem('Export Progress Report (CSV)', 'exportProgressCSV')
    .addSeparator()
    .addItem('Generate Parent Reports (Doc)', 'generateParentReports')
    .addSeparator()
    .addSubMenu(ui.createMenu('Demo & Testing')
      .addItem('Generate Test Data', 'generateTestData')
      .addItem('Clear All Data', 'clearAllData'))
    .addSubMenu(ui.createMenu('Quick Fixes')
      .addItem('Fix Summary Data', 'fixCalculateSummaries')
      .addItem('Fix Pacing Progress', 'fixPacingSheetWithProgress')
      .addItem('Fix Summary Headers', 'fixSummaryHeaders')
      .addItem('Fix Pre-School Headers', 'fixPreSchoolHeaders')
      .addItem('Setup Instructional Sequence', 'setupInstructionalSequence')
      .addItem('Create Missing Sheets', 'createAllMissingSheets'))
    .addToUi();
}

/**
 * Opens the Program Overview Dashboard in a new browser tab.
 */
function openDashboard() {
  const url = ScriptApp.getService().getUrl() + '?page=dashboard';
  const html = HtmlService.createHtmlOutput(
    '<script>window.open("' + url + '", "_blank");google.script.host.close();</script>'
  ).setWidth(200).setHeight(50);
  SpreadsheetApp.getUi().showModalDialog(html, 'Opening Dashboard...');
}

/**
 * Opens the Site Setup Wizard in a sidebar or modal dialog.
 */
function openSetupWizard() {
  const html = HtmlService.createHtmlOutputFromFile('SetupWizard')
    .setWidth(900)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Site Setup Wizard');
}

// ====================================================================
// ============ SUMMARY REPORT FUNCTIONS ==============================
// ====================================================================

/**
 * Main function to calculate all student summaries.
 * Works with Setup Wizard structure (headers row 1, data row 2+).
 * This is triggered by the custom menu.
 */
function calculateAllSummaries() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  const rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);
  const preSchoolSheet = ss.getSheetByName(PRE_SCHOOL_SHEET_NAME);
  const preKSheet = ss.getSheetByName(PRE_K_SHEET_NAME);

  if (!summarySheet) {
    SpreadsheetApp.getUi().alert("Error: 'Skill Summary Page' not found.");
    return;
  }

  // Get roster data (Name -> Program mapping)
  const rosterData = rosterSheet.getDataRange().getValues();
  const rosterMap = new Map(rosterData.slice(1).map(row => [row[0], row[2]]));

  // Get Pre-School data (headers in row 1, data starts row 2)
  let preSchoolMap = new Map();
  if (preSchoolSheet) {
    const psData = preSchoolSheet.getDataRange().getValues();
    for (let i = 1; i < psData.length; i++) {
      if (psData[i][0]) {
        preSchoolMap.set(psData[i][0], psData[i]);
      }
    }
  }

  // Get Pre-K data (headers in row 1, data starts row 2)
  let preKMap = new Map();
  let preKHeaders = [];
  if (preKSheet) {
    const pkData = preKSheet.getDataRange().getValues();
    preKHeaders = pkData[0]; // Headers are in row 1 (index 0)
    for (let i = 1; i < pkData.length; i++) {
      if (pkData[i][0]) {
        preKMap.set(pkData[i][0], pkData[i]);
      }
    }
  }

  // Clear existing summary data (except headers)
  const lastRow = summarySheet.getLastRow();
  if (lastRow > 1) {
    summarySheet.getRange(2, 1, lastRow - 1, SUMMARY_LAST_COL).clear();
  }

  // Build output data for all students in roster
  const outputData = [];
  for (const [studentName, program] of rosterMap) {
    if (!studentName) continue;

    let psInProgress = "", psCumulative = "";
    let pkFormInProgress = "", pkFormCumulative = "";
    let pkNameInProgress = "", pkNameCumulative = "";
    let pkSoundInProgress = "", pkSoundCumulative = "";

    if (program === "Pre-School") {
      const studentData = preSchoolMap.get(studentName);
      if (studentData) {
        // Pre-School: columns 1-26 are Letter Sound A-Z (index 1 to 26)
        let yCount = 0, nCount = 0;
        for (let i = 1; i <= 26 && i < studentData.length; i++) {
          const val = studentData[i];
          if (val === "Y" || val === "y") yCount++;
          else if (val === "N" || val === "n") nCount++;
        }
        psInProgress = (yCount + nCount === 0) ? 0 : (yCount / (yCount + nCount));
        psCumulative = yCount / TOTAL_LESSONS;
      }
    } else if (program === "Pre-K") {
      const studentData = preKMap.get(studentName);
      if (studentData) {
        // Pre-K headers: Name, A-Form, A-Name, A-Sound, B-Form, B-Name, B-Sound, ...
        let formY = 0, formN = 0;
        let nameY = 0, nameN = 0;
        let soundY = 0, soundN = 0;

        for (let i = 1; i < preKHeaders.length; i++) {
          const header = preKHeaders[i] || "";
          const val = studentData[i];

          if (header.endsWith("-Form")) {
            if (val === "Y" || val === "y") formY++;
            else if (val === "N" || val === "n") formN++;
          } else if (header.endsWith("-Name")) {
            if (val === "Y" || val === "y") nameY++;
            else if (val === "N" || val === "n") nameN++;
          } else if (header.endsWith("-Sound")) {
            if (val === "Y" || val === "y") soundY++;
            else if (val === "N" || val === "n") soundN++;
          }
        }

        pkFormInProgress = (formY + formN === 0) ? 0 : (formY / (formY + formN));
        pkFormCumulative = formY / TOTAL_LESSONS;

        pkNameInProgress = (nameY + nameN === 0) ? 0 : (nameY / (nameY + nameN));
        pkNameCumulative = nameY / TOTAL_LESSONS;

        pkSoundInProgress = (soundY + soundN === 0) ? 0 : (soundY / (soundY + soundN));
        pkSoundCumulative = soundY / TOTAL_LESSONS;
      }
    }

    outputData.push([
      studentName, program,
      psInProgress, psCumulative,
      pkFormInProgress, pkFormCumulative,
      pkNameInProgress, pkNameCumulative,
      pkSoundInProgress, pkSoundCumulative
    ]);
  }

  // Write all data
  if (outputData.length > 0) {
    summarySheet.getRange(2, 1, outputData.length, 10).setValues(outputData);
    // Format percentage columns (C through J)
    summarySheet.getRange(2, 3, outputData.length, 8).setNumberFormat("0.0%");
  }

  SpreadsheetApp.getUi().alert("Success!", "Skill Summary updated for " + outputData.length + " students.", SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Helper function to calculate percentages for a given student's data.
 * @param {Array} studentDataRow - The full row of data for one student.
 * @param {Array} [headers] - (Optional) The header row for Pre-K.
 * @param {string} [skillFilter] - (Optional) The skill to filter by (e.g., " - Form").
 * @returns {object} An object { inProgress: number, cumulative: number }.
 */
function calculateScores(studentDataRow, headers = null, skillFilter = null) {
  let y_count = 0;
  let n_count = 0;
  
  // Start from column B (index 1) to skip Name column
  for (let i = 1; i < studentDataRow.length; i++) {
    const value = studentDataRow[i];
    
    let include = true;
    if (skillFilter) {
      // If we are filtering (Pre-K), check the header
      include = headers[i] && headers[i].endsWith(skillFilter);
    }
    
    if (include) {
      if (value === "Y" || value === "y") {
        y_count++;
      } else if (value === "N" || value === "n") {
        n_count++;
      }
    }
  }
  
  const inProgressScore = (y_count + n_count === 0) ? 0 : (y_count / (y_count + n_count));
  const cumulativeScore = y_count / TOTAL_LESSONS; // Total lessons is 26
  
  return {
    inProgress: inProgressScore,
    cumulative: cumulativeScore
  };
}

// ====================================================================
// ============ PACING SHEET FORMATTING FUNCTIONS =====================
// ====================================================================

/**
 * Main function to update the Pacing sheet with progress data.
 * This is an alias for fixPacingSheetWithProgress for backward compatibility.
 */
function updatePacingSheetFormatting() {
  // Delegate to the function that works with Setup Wizard structure
  fixPacingSheetWithProgress();
}

/**
 * Helper to build lesson names from letters
 */
function buildLessonNames(letters, isPreK) {
  const builtLessons = [];
  letters.forEach(letter => {
    if (isPreK) {
      builtLessons.push(letter + "-Form");
      builtLessons.push(letter + "-Name");
      builtLessons.push(letter + "-Sound");
    } else {
      builtLessons.push("Letter Sound " + letter);
    }
  });
  return builtLessons;
}

/**
 * Helper to check if a single student is fully assessed for a set of lessons.
 * Works with headers row 1, data row 2+ structure.
 * @returns {boolean} True if the student has a "Y", "N", or "A" for all required lessons.
 */
function isStudentAssessedForSet(studentName, studentDataMap, headers, requiredLessons) {
  const studentData = studentDataMap.get(studentName);
  
  // If student isn't in the data sheet, they are not assessed
  if (!studentData) return false; 
  
  // Loop through every lesson required for this set
  for (const lesson of requiredLessons) {
    const colIndex = headers.indexOf(lesson);
    
    // If the lesson isn't in the header, something is wrong.
    if (colIndex === -1) {
      Logger.log("Warning: Lesson '" + lesson + "' not found in headers.");
      return false; 
    }
    
    const value = studentData[colIndex];
    
    // If the cell is blank (not Y, N, or A), they are not fully assessed
    if (value !== "Y" && value !== "N" && value !== "A" && 
        value !== "y" && value !== "n" && value !== "a") {
      return false;
    }
  }
  
  // If we get here, this student had a value for every required lesson
  return true;
}

// ====================================================================
// ============ PARENT REPORT GENERATOR FUNCTIONS =====================
// ====================================================================

/**
 * Generates a Google Doc report for every student on the summary page.
 * Works with headers row 1, data row 2+ structure.
 */
function generateParentReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  const rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);
  
  if (!summarySheet || !rosterSheet) {
    SpreadsheetApp.getUi().alert("Error: 'Skill Summary Page' or 'Roster' sheet not found.");
    return;
  }

  // Get the template and folder
  try {
    var templateFile = DriveApp.getFileById(TEMPLATE_DOC_ID);
    var outputFolder = DriveApp.getFolderById(REPORT_FOLDER_ID);
  } catch (e) {
    Logger.log(e);
    SpreadsheetApp.getUi().alert("Error: Could not find Template Doc or Report Folder. Please check your IDs in the 'Code.gs' file.");
    return;
  }
  
  // Get all data from sheets (headers row 1, data row 2+)
  const summaryLastRow = summarySheet.getLastRow();
  if (summaryLastRow < 2) {
    SpreadsheetApp.getUi().alert("No student data found in Skill Summary Page. Please run 'Update Summary Page' first.");
    return;
  }
  const summaryData = summarySheet.getRange(2, 1, summaryLastRow - 1, SUMMARY_LAST_COL).getValues();
  
  const rosterLastRow = rosterSheet.getLastRow();
  const rosterData = rosterLastRow >= 2 ? rosterSheet.getRange(2, 1, rosterLastRow - 1, 3).getValues() : [];

  // Create a Map for easy program lookup
  const rosterMap = new Map(rosterData.map(row => [row[0], row[2]])); // Map<StudentName, Program>
  
  const ui = SpreadsheetApp.getUi();
  ui.alert("Starting Report Generation", "This may take several minutes. Please do not close this sheet. You will be notified when it's complete.", ui.ButtonSet.OK);
  
  let filesCreated = 0;
  
  // Loop through each student on the summary sheet
  for (const row of summaryData) {
    const studentName = row[0];
    if (!studentName) continue; // Skip empty rows

    const program = rosterMap.get(studentName) || "Unknown";
    
    // Get all 8 percentage values (indices 2-9 for columns C-J)
    const psMastery = (row[2] || 0) * 100;      // Col C - Pre-School In-Progress
    const psCumulative = (row[3] || 0) * 100;   // Col D - Pre-School Cumulative
    const pkFormMastery = (row[4] || 0) * 100;  // Col E - Pre-K Form In-Progress
    const pkFormCumulative = (row[5] || 0) * 100; // Col F - Pre-K Form Cumulative
    const pkNameMastery = (row[6] || 0) * 100;  // Col G - Pre-K Name In-Progress
    const pkNameCumulative = (row[7] || 0) * 100; // Col H - Pre-K Name Cumulative
    const pkSoundMastery = (row[8] || 0) * 100; // Col I - Pre-K Sound In-Progress
    const pkSoundCumulative = (row[9] || 0) * 100; // Col J - Pre-K Sound Cumulative
    
    // 1. Create a new copy of the template
    const newFileName = `${studentName} - Progress Report`;
    const newFile = templateFile.makeCopy(newFileName, outputFolder);
    
    // 2. Open the new doc to edit it
    const doc = DocumentApp.openById(newFile.getId());
    const body = doc.getBody();
    
    // 3. Replace all merge fields with the student's data
    body.replaceText("{{StudentName}}", studentName);
    body.replaceText("{{Program}}", program);
    
    // Format as "0.0%"
    body.replaceText("{{PS_Mastery}}", psMastery.toFixed(1) + "%");
    body.replaceText("{{PS_Cumulative}}", psCumulative.toFixed(1) + "%");
    body.replaceText("{{PK_Form_Mastery}}", pkFormMastery.toFixed(1) + "%");
    body.replaceText("{{PK_Form_Cumulative}}", pkFormCumulative.toFixed(1) + "%");
    body.replaceText("{{PK_Name_Mastery}}", pkNameMastery.toFixed(1) + "%");
    body.replaceText("{{PK_Name_Cumulative}}", pkNameCumulative.toFixed(1) + "%");
    body.replaceText("{{PK_Sound_Mastery}}", pkSoundMastery.toFixed(1) + "%");
    body.replaceText("{{PK_Sound_Cumulative}}", pkSoundCumulative.toFixed(1) + "%");
    
    // 4. Save and close
    doc.saveAndClose();
    filesCreated++;
  }
  
  ui.alert("Report Generation Complete!", `${filesCreated} reports have been created in your 'Parent Reports' folder.`, ui.ButtonSet.OK);
}

// ====================================================================
// ============ WEB APP BACKEND FUNCTIONS (TEACHER) ===================
// ====================================================================

/**
 * Gets the unique list of groups from the Roster sheet.
 * @returns {string[]} A list of group names.
 */
function getGroups() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
    if (!sheet) throw new Error("Roster sheet not found");
    
    // Get all data from column B, starting from row 2
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    
    const range = sheet.getRange(2, 2, lastRow - 1, 1);
    const values = range.getValues();
    
    // Get unique, non-blank values
    const uniqueGroups = [...new Set(values.flat())].filter(g => g);
    return uniqueGroups.sort();
  } catch (e) {
    Logger.log(e);
    return [];
  }
}

/**
 * Gets the students for a specific group.
 * @param {string} groupName The selected group.
 * @returns {Object[]} A list of student objects {name, program}.
 */
function getStudentsByGroup(groupName) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
    if (!sheet) throw new Error("Roster sheet not found");

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    
    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues(); // Get Name, Group, Program
    
    const students = data
      .filter(row => row[1] === groupName) // Filter by selected group
      .map(row => ({ name: row[0], program: row[2] })); // Return object
      
    return students.sort((a, b) => a.name.localeCompare(b.name)); // Sort by name
  } catch (e) {
    Logger.log(e);
    return [];
  }
}

/**
 * Gets all necessary data to build the assessment form for a student.
 * Works with Setup Wizard structure (headers row 1, data row 2+, skills column 2+).
 * @param {string} studentName The name of the selected student.
 * @param {string} program The student's program ('Pre-School' or 'Pre-K').
 * @returns {Object} An object { lessons: [], currentData: {} }.
 */
function getStudentAssessmentData(studentName, program) {
  try {
    const sheetName = (program === 'Pre-School') ? PRE_SCHOOL_SHEET_NAME : PRE_K_SHEET_NAME;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error("Data sheet not found: " + sheetName);

    const data = sheet.getDataRange().getValues();
    if (data.length < 1) {
      return { lessons: [], currentData: {} };
    }

    // Headers are in row 1 (index 0), skills start at column 2 (index 1)
    const allHeaders = data[0];
    const lessonHeaders = allHeaders.slice(1).filter(h => h); // Skip "Name" column

    // Find student row (data starts at row 2, index 1)
    let currentData = {};
    let studentRowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === studentName) {
        studentRowIndex = i;
        break;
      }
    }

    if (studentRowIndex !== -1) {
      const studentData = data[studentRowIndex];
      lessonHeaders.forEach((header, index) => {
        currentData[header] = studentData[index + 1] || ''; // +1 to skip Name column
      });
    } else {
      Logger.log("Student not found in sheet: " + studentName);
    }

    return {
      lessons: lessonHeaders,
      currentData: currentData
    };

  } catch (e) {
    Logger.log("Error in getStudentAssessmentData: " + e);
    return { lessons: [], currentData: {} };
  }
}


/**
 * Saves the assessment data back to the sheet.
 * Works with Setup Wizard structure (headers row 1, data row 2+).
 * @param {Object} data - The data from the form { studentName, program, assessments }.
 * @returns {string} A success or error message.
 */
function saveAssessmentData(data) {
  const { studentName, program, assessments } = data;

  try {
    const sheetName = (program === 'Pre-School') ? PRE_SCHOOL_SHEET_NAME : PRE_K_SHEET_NAME;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error("Data sheet not found: " + sheetName);

    const sheetData = sheet.getDataRange().getValues();
    if (sheetData.length < 2) {
      return "Error: No data in sheet '" + sheetName + "'.";
    }

    // Headers are in row 1 (index 0)
    const allHeaders = sheetData[0];

    // Find the student's row (data starts at row 2, index 1)
    let studentRowIndex = -1;
    for (let i = 1; i < sheetData.length; i++) {
      if (sheetData[i][0] === studentName) {
        studentRowIndex = i;
        break;
      }
    }

    if (studentRowIndex === -1) {
      return "Error: Student '" + studentName + "' not found in sheet '" + sheetName + "'.";
    }

    const studentRow = studentRowIndex + 1; // Convert to 1-based row number

    // Get the whole row, update it, and write it back
    const rowRange = sheet.getRange(studentRow, 1, 1, sheet.getLastColumn());
    const rowValues = rowRange.getValues()[0];

    for (const [lessonName, status] of Object.entries(assessments)) {
      const colIndex = allHeaders.indexOf(lessonName);
      if (colIndex !== -1) {
        rowValues[colIndex] = status; // Update the value in our local array
      }
    }

    // Write the entire updated array back to the row
    rowRange.setValues([rowValues]);

    return "Success! Data saved for " + studentName + ".";
  } catch (e) {
    Logger.log("Error in saveAssessmentData: " + e);
    return "Error: " + e.message;
  }
}

/**
 * Gets the list of instructional sequences AND their corresponding letters.
 * Reads from the "Instructional Sequence" sheet.
 * @param {string} groupName The group name (used to get the program type from Roster).
 * @returns {object[]} A list of objects {sequenceName: string, letters: string}.
 */
function getSequences(groupName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const seqSheet = ss.getSheetByName(SEQUENCE_SHEET_NAME);

    if (!seqSheet) {
      Logger.log("Instructional Sequence sheet not found. Using default sequence.");
      // Return default sequences if sheet doesn't exist
      return getDefaultSequences();
    }

    const data = seqSheet.getDataRange().getValues();
    const sequences = [];

    // Headers: Sequence Name, Letters, Notes (row 1)
    // Data starts at row 2 (index 1)
    for (let i = 1; i < data.length; i++) {
      const sequenceName = data[i][0];
      const letters = data[i][1];

      if (sequenceName && letters) {
        sequences.push({
          sequenceName: sequenceName,
          letters: letters.toString()
        });
      }
    }

    if (sequences.length === 0) {
      return getDefaultSequences();
    }

    return sequences;

  } catch (e) {
    Logger.log("Error in getSequences: " + e);
    return getDefaultSequences();
  }
}

/**
 * Returns default instructional sequences (Handwriting Without Tears order).
 * Used when no Instructional Sequence sheet exists.
 */
function getDefaultSequences() {
  return [
    { sequenceName: "Set 1", letters: "A, M, S, T" },
    { sequenceName: "Set 2", letters: "C, O, G, Q" },
    { sequenceName: "Set 3", letters: "H, I, E, L" },
    { sequenceName: "Set 4", letters: "F, D, P, B" },
    { sequenceName: "Set 5", letters: "R, N, K, J" },
    { sequenceName: "Set 6", letters: "U, V, W, X" },
    { sequenceName: "Set 7", letters: "Y, Z" }
  ];
}

/**
 * Gets the specific lesson names for a given group and sequence.
 * @param {string} groupName The group (e.g., "Group A").
 * @param {string} sequenceName The sequence (e.g., "Set 1").
 * @returns {string[]} A list of final lesson names (e.g., "A-Form", "Letter Sound A").
 */
function getLessonsForSequence(groupName, sequenceName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Get sequences to find the letters for this sequence
    const sequences = getSequences(groupName);
    const targetSequence = sequences.find(seq => seq.sequenceName === sequenceName);

    if (!targetSequence || !targetSequence.letters) {
      Logger.log("Sequence '" + sequenceName + "' not found or has no letters.");
      return [];
    }

    // Determine if this group is Pre-K or Pre-School from the Roster
    const rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);
    let isPreK = true; // Default to Pre-K

    if (rosterSheet) {
      const rosterData = rosterSheet.getDataRange().getValues();
      // Find a student in this group to determine the program
      for (let i = 1; i < rosterData.length; i++) {
        if (rosterData[i][1] === groupName) {
          isPreK = rosterData[i][2] === "Pre-K";
          break;
        }
      }
    }

    // Build lesson names from the letters
    const letters = targetSequence.letters.split(',').map(l => l.trim());
    const builtLessons = [];

    letters.forEach(letter => {
      if (isPreK) {
        // Pre-K format: "A-Form", "A-Name", "A-Sound"
        builtLessons.push(letter + "-Form");
        builtLessons.push(letter + "-Name");
        builtLessons.push(letter + "-Sound");
      } else {
        // Pre-School format: "Letter Sound A"
        builtLessons.push("Letter Sound " + letter);
      }
    });

    return builtLessons;

  } catch (e) {
    Logger.log("Error in getLessonsForSequence: " + e);
    return [];
  }
}

/**
 * Gets filtered assessment data based on sequence.
 * @param {string} studentName The name of the selected student.
 * @param {string} program The student's program ('Pre-School' or 'Pre-K').
 * @param {string} groupName The student's group (for Pacing sheet lookup).
 * @param {string} sequenceName The selected instructional sequence.
 * @returns {Object} An object { lessons: [], currentData: {} }.
 */
function getFilteredAssessmentData(studentName, program, groupName, sequenceName) {
  // 1. Get the list of lessons that *should* be shown for this sequence
  const sequenceLessonNames = getLessonsForSequence(groupName, sequenceName); 

  // 2. Get *all* assessment data for the student
  const allData = getStudentAssessmentData(studentName, program);

  // 3. Filter the lessons based on the sequence list
  const filteredLessons = allData.lessons.filter(lesson => sequenceLessonNames.includes(lesson));

  // 4. Return just the filtered lessons and data
  return {
    lessons: filteredLessons,
    currentData: allData.currentData
  };
}


// ====================================================================
// ============ TUTOR WEB APP FUNCTIONS ===============================
// ====================================================================

/**
 * Gets the unique list of tutors from the Tutors sheet.
 * @returns {string[]} A list of tutor names.
 */
function getTutorNames() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TUTOR_SHEET_NAME);
    if (!sheet) throw new Error("Tutor sheet not found");
    
    // Assumes names are in Column A, starting row 2
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    
    const range = sheet.getRange(2, 1, lastRow - 1, 1);
    const values = range.getValues();
    
    const uniqueTutors = [...new Set(values.flat())].filter(t => t);
    return uniqueTutors.sort();
  } catch (e) {
    Logger.log(e);
    return [];
  }
}

/**
 * Gets the full student roster (Name and Program).
 * @returns {Object[]} A list of student objects {name, program}.
 */
function getStudentRoster() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
    if (!sheet) throw new Error("Roster sheet not found");

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    
    // Get Name (col 1) and Program (col 3)
    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues(); 
    
    const students = data
      .filter(row => row[0]) // Filter out blank rows
      .map(row => ({ name: row[0], program: row[2] })); // Return object
      
    return students.sort((a, b) => a.name.localeCompare(b.name)); // Sort by name
  } catch (e) {
    Logger.log(e);
    return [];
  }
}

/**
 * Saves the tutor's lesson data to the "TutorLog" sheet
 * AND updates the main student data sheet ("Pre-K" or "Pre-School").
 * Works with Setup Wizard structure (headers row 1, data row 2+).
 * @param {Object} data - {tutor, student, program, lesson, formStatus, nameStatus, soundStatus}
 * @returns {string} A success or error message.
 */
function saveTutorSession(data) {
  const { tutor, student, program, lesson, formStatus, nameStatus, soundStatus } = data;

  // --- Step 1: Log the session ---
  try {
    const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TUTOR_LOG_SHEET_NAME);
    if (logSheet) {
      logSheet.appendRow([new Date(), tutor, student, program, lesson, formStatus || "", nameStatus || "", soundStatus || "", ""]);
    } else {
      Logger.log("Tutor Log sheet not found. Skipping log.");
    }
  } catch (e) {
    Logger.log("Error logging tutor session: " + e.message);
  }

  // --- Step 2: Update the main student sheet ---
  try {
    const isPreK = (program === 'Pre-K');
    const sheetName = isPreK ? PRE_K_SHEET_NAME : PRE_SCHOOL_SHEET_NAME;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error("Student data sheet not found: " + sheetName);

    // Get all data (headers row 1, data row 2+)
    const sheetData = sheet.getDataRange().getValues();
    if (sheetData.length < 2) {
      return "Success! Session logged. (No student data in sheet).";
    }

    const allHeaders = sheetData[0]; // Row 1 headers

    // Find the student's row (data starts at index 1)
    let studentRowIndex = -1;
    for (let i = 1; i < sheetData.length; i++) {
      if (sheetData[i][0] === student) {
        studentRowIndex = i;
        break;
      }
    }

    if (studentRowIndex === -1) {
      Logger.log("Student '" + student + "' not found in sheet '" + sheetName + "'. Skipping main sheet update.");
      return "Success! Session saved to log. (Student not found in main sheet for update).";
    }

    const studentRow = studentRowIndex + 1; // Convert to 1-based row number

    // Get the whole row's data
    const rowRange = sheet.getRange(studentRow, 1, 1, sheet.getLastColumn());
    const rowValues = rowRange.getValues()[0];

    // Define the target columns based on the program
    // `lesson` is just the letter, e.g., "A"
    // Pre-K headers: A-Form, A-Name, A-Sound
    // Pre-School headers: Letter Sound A
    let formColName = isPreK ? `${lesson}-Form` : null;
    let nameColName = isPreK ? `${lesson}-Name` : null;
    let soundColName = isPreK ? `${lesson}-Sound` : `Letter Sound ${lesson}`;

    // Find and update Letter Form (if Pre-K and data was provided)
    if (isPreK && formStatus) {
      const colIndex = allHeaders.indexOf(formColName);
      if (colIndex !== -1) {
        rowValues[colIndex] = formStatus;
        Logger.log(`Updated ${student} -> ${formColName} to ${formStatus}`);
      } else {
        Logger.log(`Column not found: ${formColName}`);
      }
    }

    // Find and update Letter Name (if Pre-K and data was provided)
    if (isPreK && nameStatus) {
      const colIndex = allHeaders.indexOf(nameColName);
      if (colIndex !== -1) {
        rowValues[colIndex] = nameStatus;
        Logger.log(`Updated ${student} -> ${nameColName} to ${nameStatus}`);
      } else {
        Logger.log(`Column not found: ${nameColName}`);
      }
    }

    // Find and update Letter Sound (if data was provided)
    if (soundStatus) {
      const colIndex = allHeaders.indexOf(soundColName);
      if (colIndex !== -1) {
        rowValues[colIndex] = soundStatus;
        Logger.log(`Updated ${student} -> ${soundColName} to ${soundStatus}`);
      } else {
        Logger.log(`Column not found: ${soundColName}`);
      }
    }

    // Write the updated row back to the sheet
    rowRange.setValues([rowValues]);

    return "Success! Session saved and student sheet updated.";
    
  } catch (e) {
    Logger.log("Error updating student sheet: " + e.message);
    // Send a more user-friendly error
    return "Session logged, but error updating student sheet: " + e.message;
  }
}

/**
 * Saves the tutor's absence data to the "TutorLog" sheet.
 * @param {Object} data - {tutor, student}
 * @returns {string} A success or error message.
 */
function saveTutorAbsence(data) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TUTOR_LOG_SHEET_NAME);
    if (!sheet) throw new Error("Tutor Log sheet not found");

    const newRow = [
      new Date(),
      data.tutor,
      data.student,
      "", // Program
      "", // Lesson
      "", // Form Status
      "", // Name Status
      "", // Sound Status
      "Absent" // Notes
    ];
    
    sheet.appendRow(newRow);
    return "Success! " + data.student + " marked as absent.";
  } catch (e) {
    Logger.log(e);
    return "Error: " + e.message;
  }
}

/**
 * Finds all lessons where a student scored "N" for "Name" or "Sound".
 * Works with headers row 1, data row 2+ structure.
 * @param {string} studentName The name of the selected student.
 * @param {string} program The student's program ('Pre-School' or 'Pre-K').
 * @returns {string[]} A list of letter names (e.g., "A", "C").
 */
function getNeedsWorkLetters(studentName, program) {
  try {
    const sheetName = (program === 'Pre-School') ? PRE_SCHOOL_SHEET_NAME : PRE_K_SHEET_NAME;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error("Data sheet not found: " + sheetName);

    // Get all data (headers row 1, data row 2+)
    const allData = sheet.getDataRange().getValues();
    if (allData.length < 2) return [];
    
    const headers = allData[0]; // Row 1 headers
    
    // Find student row (data starts at index 1)
    let studentRowIndex = -1;
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][0] === studentName) {
        studentRowIndex = i;
        break;
      }
    }
    
    if (studentRowIndex === -1) {
      Logger.log("Student not found in sheet: " + studentName);
      return [];
    }
    
    const studentData = allData[studentRowIndex];
    const needsWork = new Set();

    // Loop through data and find "N"s (start at column 1 to skip Name column)
    for (let i = 1; i < headers.length; i++) {
      const header = headers[i];
      const value = studentData[i];
      
      if (value === "N" || value === "n") {
        // Only include "Name" or "Sound" lessons
        if (header && (header.includes("-Name") || header.includes("-Sound") || header.includes("Letter Sound"))) {
          // Extract the letter
          if (header.includes("-Name") || header.includes("-Sound")) {
            // Pre-K format: "A-Name" -> "A"
            needsWork.add(header.split('-')[0]);
          } else if (header.includes("Letter Sound ")) {
            // Pre-School format: "Letter Sound A" -> "A"
            needsWork.add(header.replace("Letter Sound ", ""));
          }
        }
      }
    }

    return Array.from(needsWork).sort();

  } catch (e) {
    Logger.log("Error in getNeedsWorkLetters: " + e);
    return [];
  }
}

/**
 * Gets the combined "smart list" for the tutor dropdown.
 * @param {string} studentName The name of the selected student.
 * @param {string} program The student's program.
 * @returns {object} An object with two arrays: {needsWork: [], otherLetters: []}
 */
function getTutorLessonList(studentName, program) {
  const allLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
  const needsWorkLetters = getNeedsWorkLetters(studentName, program);

  // Create a Set of the "needs work" letters for fast lookup
  const needsWorkSet = new Set(needsWorkLetters);

  // Filter allLetters to get only the ones NOT in the needsWorkSet
  const otherLetters = allLetters.filter(letter => !needsWorkSet.has(letter));

  return {
    needsWork: needsWorkLetters,
    otherLetters: otherLetters
  };
}

// ====================================================================
// ============ Program Overview DASHBOARD FUNCTIONS ==================
// ====================================================================

/**
 * Gets all data needed for the Program Overview Dashboard.
 * Works with headers row 1, data row 2+ structure.
 * @returns {Object} Dashboard data including stats, charts data, and student list.
 */
function getDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);
  const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  const preKSheet = ss.getSheetByName(PRE_K_SHEET_NAME);
  const preSchoolSheet = ss.getSheetByName(PRE_SCHOOL_SHEET_NAME);

  // Get roster data (Name, Group, Program) - headers row 1, data row 2+
  const rosterLastRow = rosterSheet.getLastRow();
  if (rosterLastRow < 2) {
    return getEmptyDashboardData();
  }
  const rosterData = rosterSheet.getRange(2, 1, rosterLastRow - 1, 3).getValues();

  // Create maps for quick lookup
  const studentMap = new Map(); // Map<Name, {group, program}>
  let preSchoolCount = 0;
  let preKCount = 0;
  const groupSet = new Set();

  rosterData.forEach(row => {
    const name = row[0];
    const group = row[1];
    const program = row[2];
    if (name) {
      studentMap.set(name, { group, program });
      groupSet.add(group);
      if (program === 'Pre-School') preSchoolCount++;
      else if (program === 'Pre-K') preKCount++;
    }
  });

  // Get summary data if available (headers row 1, data row 2+)
  let summaryData = [];
  const summaryLastRow = summarySheet ? summarySheet.getLastRow() : 0;
  if (summarySheet && summaryLastRow >= 2) {
    summaryData = summarySheet.getRange(2, 1, summaryLastRow - 1, SUMMARY_LAST_COL).getValues();
  }

  // Calculate statistics
  let totalMastery = 0;
  let totalProgress = 0;
  let masteredCount = 0;
  let progressingCount = 0;
  let beginningCount = 0;
  let totalLettersAssessed = 0;
  let studentsWithData = 0;

  // Skill-specific stats
  let formTotal = 0, formCount = 0;
  let nameTotal = 0, nameCount = 0;
  let soundTotal = 0, soundCount = 0;

  // Group progress
  const groupProgress = new Map(); // Map<GroupName, {total, count}>

  const studentResults = [];

  summaryData.forEach(row => {
    const studentName = row[0];
    const studentInfo = studentMap.get(studentName);
    if (!studentName || !studentInfo) return;

    const program = studentInfo.program;
    const group = studentInfo.group;

    let mastery = 0;
    let progress = 0;
    let lettersCount = 0;

    if (program === 'Pre-School') {
      // Pre-School: Columns C (in-progress, index 2) and D (cumulative, index 3)
      mastery = (row[2] || 0) * 100;
      progress = (row[3] || 0) * 100;
      soundTotal += row[2] || 0;
      soundCount++;
    } else if (program === 'Pre-K') {
      // Pre-K: Form (E,F - index 4,5), Name (G,H - index 6,7), Sound (I,J - index 8,9)
      const formMastery = row[4] || 0;
      const nameMastery = row[6] || 0;
      const soundMastery = row[8] || 0;
      const formCum = row[5] || 0;
      const nameCum = row[7] || 0;
      const soundCum = row[9] || 0;

      mastery = ((formMastery + nameMastery + soundMastery) / 3) * 100;
      progress = ((formCum + nameCum + soundCum) / 3) * 100;

      if (formMastery > 0) { formTotal += formMastery; formCount++; }
      if (nameMastery > 0) { nameTotal += nameMastery; nameCount++; }
      if (soundMastery > 0) { soundTotal += soundMastery; soundCount++; }
    }

    // Count letters assessed (rough estimate based on cumulative)
    lettersCount = Math.round((progress / 100) * TOTAL_LESSONS);

    if (mastery > 0 || progress > 0) {
      studentsWithData++;
      totalMastery += mastery;
      totalProgress += progress;
      totalLettersAssessed += lettersCount;

      // Mastery distribution
      if (mastery >= 80) masteredCount++;
      else if (mastery >= 50) progressingCount++;
      else beginningCount++;

      // Group progress
      if (!groupProgress.has(group)) {
        groupProgress.set(group, { total: 0, count: 0 });
      }
      const gp = groupProgress.get(group);
      gp.total += progress;
      gp.count++;
    }

    studentResults.push({
      name: studentName,
      group: group,
      program: program,
      progress: Math.round(progress),
      mastery: Math.round(mastery)
    });
  });

  // Calculate averages
  const avgMastery = studentsWithData > 0 ? Math.round(totalMastery / studentsWithData) : 0;
  const avgLetters = studentsWithData > 0 ? Math.round(totalLettersAssessed / studentsWithData) : 0;

  // Skills averages (Pre-K)
  const formAvg = formCount > 0 ? Math.round((formTotal / formCount) * 100) : 0;
  const nameAvg = nameCount > 0 ? Math.round((nameTotal / nameCount) * 100) : 0;
  const soundAvg = soundCount > 0 ? Math.round((soundTotal / soundCount) * 100) : 0;

  // Group progress array
  const groupProgressArray = [];
  groupProgress.forEach((value, key) => {
    groupProgressArray.push({
      name: key,
      avgProgress: value.count > 0 ? Math.round(value.total / value.count) : 0
    });
  });
  groupProgressArray.sort((a, b) => b.avgProgress - a.avgProgress);

  // Sort students by progress descending
  studentResults.sort((a, b) => b.progress - a.progress);

  return {
    stats: {
      totalStudents: studentMap.size,
      avgMastery: avgMastery,
      lettersAssessed: avgLetters,
      totalGroups: groupSet.size
    },
    programBreakdown: {
      preSchool: preSchoolCount,
      preK: preKCount
    },
    masteryDistribution: {
      mastered: masteredCount,
      progressing: progressingCount,
      beginning: beginningCount
    },
    skillsProgress: {
      form: formAvg,
      name: nameAvg,
      sound: soundAvg
    },
    groupProgress: groupProgressArray,
    students: studentResults
  };
}

/**
 * Helper function to return empty dashboard data when no data exists.
 */
function getEmptyDashboardData() {
  return {
    stats: {
      totalStudents: 0,
      avgMastery: 0,
      lettersAssessed: 0,
      totalGroups: 0
    },
    programBreakdown: {
      preSchool: 0,
      preK: 0
    },
    masteryDistribution: {
      mastered: 0,
      progressing: 0,
      beginning: 0
    },
    skillsProgress: {
      form: 0,
      name: 0,
      sound: 0
    },
    groupProgress: [],
    students: []
  };
}

/**
 * Creates a CSV download and returns the blob URL.
 * @param {string} csvContent The CSV content string.
 * @param {string} fileName The desired filename.
 * @returns {string|null} The download URL or null.
 */
function createCSVDownload(csvContent, fileName) {
  try {
    const blob = Utilities.newBlob(csvContent, 'text/csv', fileName);
    const file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = file.getDownloadUrl();
    // Clean up after 1 minute (let user download)
    Utilities.sleep(60000);
    try { file.setTrashed(true); } catch(e) {}
    return url;
  } catch (e) {
    Logger.log('CSV Download Error: ' + e.message);
    return null;
  }
}

/**
 * Exports the progress report as a CSV file from the spreadsheet menu.
 */
function exportProgressCSV() {
  const data = getDashboardData();
  if (!data || !data.students || data.students.length === 0) {
    SpreadsheetApp.getUi().alert('No student data found to export.');
    return;
  }

  // Build CSV
  const headers = ['Student Name', 'Group', 'Program', 'Progress %', 'Mastery %'];
  const rows = data.students.map(s =>
    [s.name, s.group, s.program, s.progress, s.mastery].join(',')
  );
  const csvContent = [headers.join(','), ...rows].join('\n');

  // Create file in Drive
  const fileName = 'PreK_Progress_Report_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + '.csv';
  const blob = Utilities.newBlob(csvContent, 'text/csv', fileName);
  const file = DriveApp.createFile(blob);

  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Export Complete!',
    'File "' + fileName + '" has been saved to your Google Drive.\n\nYou can also access it here:\n' + file.getUrl(),
    ui.ButtonSet.OK
  );
}

// ====================================================================
// ============ SITE SETUP WIZARD FUNCTIONS ===========================
// ====================================================================

/**
 * Processes the Setup Wizard data and configures the spreadsheet.
 * @param {Object} data The wizard data containing site info, students, staff, etc.
 * @returns {Object} Result object with success status and message.
 */
function setupNewSite(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // 1. Store site configuration
    setupSiteConfig(ss, data.site, data.programs, data.schedule);

    // 2. Setup Roster sheet with students
    setupRosterSheet(ss, data.students);

    // 3. Setup Tutors sheet with staff
    setupTutorsSheet(ss, data.teachers, data.tutors);

    // 4. Setup Groups in Pacing sheet
    setupPacingSheet(ss, data.groups, data.students);

    // 5. Initialize data sheets if needed
    initializeDataSheets(ss, data.programs.selected);

    // 6. Create Instructional Sequence sheet
    if (!ss.getSheetByName(SEQUENCE_SHEET_NAME)) {
      createInstructionalSequenceSheet(ss);
    }

    // 7. Update the spreadsheet name
    const siteName = data.site.name || 'New Site';
    ss.rename(`PreK Tracker - ${siteName}`);

    return {
      success: true,
      message: `
        <strong>Site "${siteName}" has been configured!</strong><br><br>
        ✓ ${data.students.length} students added to roster<br>
        ✓ ${data.groups.length} groups configured<br>
        ✓ ${data.teachers.length + data.tutors.length} staff members added<br>
        ✓ Programs: ${data.programs.selected.join(', ')}<br>
        ✓ Instructional Sequence sheet created<br><br>
        You can now close this wizard and start using the tracker.
      `
    };

  } catch (error) {
    Logger.log('Setup Error: ' + error.message);
    return {
      success: false,
      message: 'Setup failed: ' + error.message
    };
  }
}

/**
 * Creates or updates the Site Config sheet with site information.
 */
function setupSiteConfig(ss, site, programs, schedule) {
  let configSheet = ss.getSheetByName('Site Config');

  if (!configSheet) {
    configSheet = ss.insertSheet('Site Config');
  }

  // Clear existing content
  configSheet.clear();

  // Set up configuration
  const configData = [
    ['Site Configuration', ''],
    ['', ''],
    ['Site Name', site.name || ''],
    ['Site Code', site.code || ''],
    ['Address', site.address || ''],
    ['Phone', site.phone || ''],
    ['Coordinator', site.coordinatorName || ''],
    ['Coordinator Email', site.coordinatorEmail || ''],
    ['', ''],
    ['Program Configuration', ''],
    ['Programs', programs.selected.join(', ')],
    ['Academic Year', programs.academicYear || ''],
    ['Start Date', programs.startDate || ''],
    ['', ''],
    ['Schedule', ''],
    ['Sessions/Week', schedule.sessionsPerWeek || ''],
    ['Session Duration', (schedule.sessionDuration || '') + ' minutes'],
    ['Weekly Minutes', (schedule.sessionsPerWeek * schedule.sessionDuration) || ''],
    ['Notes', schedule.notes || ''],
    ['', ''],
    ['Session Times', ''],
    ['Monday', schedule.times.mon || ''],
    ['Tuesday', schedule.times.tue || ''],
    ['Wednesday', schedule.times.wed || ''],
    ['Thursday', schedule.times.thu || ''],
    ['Friday', schedule.times.fri || '']
  ];

  configSheet.getRange(1, 1, configData.length, 2).setValues(configData);

  // Format headers
  configSheet.getRange('A1').setFontWeight('bold').setFontSize(14);
  configSheet.getRange('A10').setFontWeight('bold').setFontSize(12);
  configSheet.getRange('A15').setFontWeight('bold').setFontSize(12);
  configSheet.getRange('A21').setFontWeight('bold').setFontSize(12);

  // Auto-resize columns
  configSheet.autoResizeColumns(1, 2);
}

/**
 * Sets up the Roster sheet with student data.
 */
function setupRosterSheet(ss, students) {
  let rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);

  if (!rosterSheet) {
    rosterSheet = ss.insertSheet(ROSTER_SHEET_NAME);
    // Add headers
    rosterSheet.getRange(1, 1, 1, 3).setValues([['Name', 'Group', 'Program']]);
    rosterSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
  }

  // Clear existing student data (keep header)
  if (rosterSheet.getLastRow() > 1) {
    rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, 3).clear();
  }

  // Add student data
  if (students.length > 0) {
    const studentData = students.map(s => [s.name, s.group, s.program]);
    rosterSheet.getRange(2, 1, studentData.length, 3).setValues(studentData);
  }

  // Auto-resize columns
  rosterSheet.autoResizeColumns(1, 3);
}

/**
 * Sets up the Tutors sheet with staff data.
 */
function setupTutorsSheet(ss, teachers, tutors) {
  let tutorsSheet = ss.getSheetByName(TUTORS_SHEET_NAME);

  if (!tutorsSheet) {
    tutorsSheet = ss.insertSheet(TUTORS_SHEET_NAME);
    // Add headers
    tutorsSheet.getRange(1, 1, 1, 2).setValues([['Name', 'Role']]);
    tutorsSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
  }

  // Clear existing data (keep header)
  if (tutorsSheet.getLastRow() > 1) {
    tutorsSheet.getRange(2, 1, tutorsSheet.getLastRow() - 1, 2).clear();
  }

  // Combine teachers and tutors
  const staffData = [];
  teachers.forEach(name => staffData.push([name, 'Teacher']));
  tutors.forEach(name => staffData.push([name, 'Tutor']));

  // Add staff data
  if (staffData.length > 0) {
    tutorsSheet.getRange(2, 1, staffData.length, 2).setValues(staffData);
  }

  // Auto-resize columns
  tutorsSheet.autoResizeColumns(1, 2);
}

/**
 * Sets up the Pacing sheet with groups.
 */
function setupPacingSheet(ss, groups, students) {
  let pacingSheet = ss.getSheetByName(PACING_SHEET_NAME);

  if (!pacingSheet) {
    pacingSheet = ss.insertSheet(PACING_SHEET_NAME);
  }

  // Clear and setup headers
  pacingSheet.clear();

  // Header row: Group | Current Letter | Students...
  const headerRow = ['Group', 'Current Letter', 'Student Count'];
  pacingSheet.getRange(1, 1, 1, 3).setValues([headerRow]);
  pacingSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');

  // Add groups
  const groupData = groups.map(group => {
    const studentCount = students.filter(s => s.group === group).length;
    return [group, 'A', studentCount];
  });

  if (groupData.length > 0) {
    pacingSheet.getRange(2, 1, groupData.length, 3).setValues(groupData);
  }

  // Auto-resize columns
  pacingSheet.autoResizeColumns(1, 3);
}

/**
 * Initializes the data sheets (Pre-K, Pre-School) if they don't exist.
 */
function initializeDataSheets(ss, selectedPrograms) {
  // Pre-K Sheet
  if (selectedPrograms.includes('Pre-K')) {
    let preKSheet = ss.getSheetByName(PRE_K_SHEET_NAME);
    if (!preKSheet) {
      preKSheet = ss.insertSheet(PRE_K_SHEET_NAME);
      // Setup headers: Name, A-Form, A-Name, A-Sound, B-Form, B-Name, B-Sound, etc.
      const headers = ['Name'];
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      letters.forEach(letter => {
        headers.push(`${letter}-Form`, `${letter}-Name`, `${letter}-Sound`);
      });
      preKSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      preKSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
      preKSheet.setFrozenRows(1);
      preKSheet.setFrozenColumns(1);
    }
  }

  // Pre-School Sheet
  if (selectedPrograms.includes('Pre-School')) {
    let preSchoolSheet = ss.getSheetByName(PRE_SCHOOL_SHEET_NAME);
    if (!preSchoolSheet) {
      preSchoolSheet = ss.insertSheet(PRE_SCHOOL_SHEET_NAME);
      // Setup headers: Name, Letter Sound A, Letter Sound B, etc.
      const headers = ['Name'];
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      letters.forEach(letter => headers.push(`Letter Sound ${letter}`));
      preSchoolSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      preSchoolSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
      preSchoolSheet.setFrozenRows(1);
      preSchoolSheet.setFrozenColumns(1);
    }
  }

  // Skill Summary Page
  let summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  if (!summarySheet) {
    summarySheet = ss.insertSheet(SUMMARY_SHEET_NAME);
    const headers = [
      'Name', 'Program',
      'Pre-School Letter Sound In-Progress', 'Pre-School Letter Sound Cumulative',
      'Pre-K Form In-Progress', 'Pre-K Form Cumulative',
      'Pre-K Name In-Progress', 'Pre-K Name Cumulative',
      'Pre-K Sound In-Progress', 'Pre-K Sound Cumulative'
    ];
    summarySheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    summarySheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
    summarySheet.setFrozenRows(1);
    summarySheet.autoResizeColumns(1, headers.length);
  }

  // Tutor Log
  let tutorLogSheet = ss.getSheetByName(TUTOR_LOG_SHEET_NAME);
  if (!tutorLogSheet) {
    tutorLogSheet = ss.insertSheet(TUTOR_LOG_SHEET_NAME);
    const headers = ['Timestamp', 'Tutor', 'Student', 'Program', 'Letter', 'Form Status', 'Name Status', 'Sound Status', 'Notes'];
    tutorLogSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    tutorLogSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1E3A5F').setFontColor('white');
    tutorLogSheet.setFrozenRows(1);
  }
}

// ====================================================================
// ============ TEST DATA GENERATOR ===================================
// ====================================================================

/**
 * Generates sample test data for demonstration purposes.
 * Creates a complete demo site with students, staff, and assessment data.
 */
function generateTestData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Generate Test Data',
    'This will create a demo site "Central Library Branch" with:\n\n' +
    '• 24 sample students across 4 groups\n' +
    '• 3 teachers and 6 tutors\n' +
    '• Sample assessment data for all students\n\n' +
    'This will overwrite existing data. Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Sample data
  const siteData = {
    site: {
      name: 'Central Library Branch',
      code: 'CLB',
      address: '40 E St Clair St, Indianapolis, IN 46204',
      phone: '(317) 275-4100',
      coordinatorName: 'Sarah Mitchell',
      coordinatorEmail: 's.mitchell@indypl.org'
    },
    programs: {
      selected: ['Pre-K', 'Pre-School'],
      academicYear: '2025-2026',
      startDate: '2025-09-02'
    },
    schedule: {
      sessionsPerWeek: 3,
      sessionDuration: 45,
      times: { mon: '09:00', tue: '', wed: '09:00', thu: '', fri: '09:00' },
      notes: 'Monday/Wednesday/Friday morning sessions'
    }
  };

  // Sample student names (diverse and realistic)
  const studentNames = [
    // Group A - Pre-K
    { name: 'Emma Rodriguez', group: 'Group A', program: 'Pre-K' },
    { name: 'Liam Johnson', group: 'Group A', program: 'Pre-K' },
    { name: 'Olivia Williams', group: 'Group A', program: 'Pre-K' },
    { name: 'Noah Brown', group: 'Group A', program: 'Pre-K' },
    { name: 'Ava Davis', group: 'Group A', program: 'Pre-K' },
    { name: 'Elijah Miller', group: 'Group A', program: 'Pre-K' },
    // Group B - Pre-K
    { name: 'Sophia Garcia', group: 'Group B', program: 'Pre-K' },
    { name: 'James Martinez', group: 'Group B', program: 'Pre-K' },
    { name: 'Isabella Anderson', group: 'Group B', program: 'Pre-K' },
    { name: 'Benjamin Taylor', group: 'Group B', program: 'Pre-K' },
    { name: 'Mia Thomas', group: 'Group B', program: 'Pre-K' },
    { name: 'Lucas Jackson', group: 'Group B', program: 'Pre-K' },
    // Group C - Pre-School
    { name: 'Charlotte White', group: 'Group C', program: 'Pre-School' },
    { name: 'Henry Harris', group: 'Group C', program: 'Pre-School' },
    { name: 'Amelia Clark', group: 'Group C', program: 'Pre-School' },
    { name: 'Alexander Lewis', group: 'Group C', program: 'Pre-School' },
    { name: 'Harper Walker', group: 'Group C', program: 'Pre-School' },
    { name: 'Sebastian Hall', group: 'Group C', program: 'Pre-School' },
    // Group D - Pre-School
    { name: 'Evelyn Allen', group: 'Group D', program: 'Pre-School' },
    { name: 'Jack Young', group: 'Group D', program: 'Pre-School' },
    { name: 'Luna King', group: 'Group D', program: 'Pre-School' },
    { name: 'Owen Wright', group: 'Group D', program: 'Pre-School' },
    { name: 'Camila Scott', group: 'Group D', program: 'Pre-School' },
    { name: 'Daniel Green', group: 'Group D', program: 'Pre-School' }
  ];

  const teachers = ['Ms. Jennifer Adams', 'Mr. Robert Chen', 'Ms. Maria Santos'];
  const tutors = ['David Kim', 'Ashley Thompson', 'Marcus Williams', 'Rachel Lee', 'Kevin Patel', 'Nicole Brown'];
  const groups = ['Group A', 'Group B', 'Group C', 'Group D'];

  // 1. Setup site config
  setupSiteConfig(ss, siteData.site, siteData.programs, siteData.schedule);

  // 2. Setup roster
  setupRosterSheet(ss, studentNames);

  // 3. Setup staff
  setupTutorsSheet(ss, teachers, tutors);

  // 4. Setup pacing
  setupPacingSheet(ss, groups, studentNames);

  // 5. Initialize data sheets
  initializeDataSheets(ss, siteData.programs.selected);

  // 6. Create Instructional Sequence sheet
  createInstructionalSequenceSheet(ss);

  // 7. Generate sample assessment data
  generateSampleAssessments(ss, studentNames);

  // 8. Update summary
  calculateAllSummaries();

  // 9. Rename spreadsheet
  ss.rename('PreK Tracker - Central Library Branch (DEMO)');

  ui.alert(
    'Test Data Generated!',
    'Demo site "Central Library Branch" has been created with:\n\n' +
    '✓ 24 students across 4 groups\n' +
    '✓ 3 teachers and 6 tutors\n' +
    '✓ Sample assessment data\n' +
    '✓ Instructional Sequence configured\n' +
    '✓ Summary calculations updated\n\n' +
    'You can now explore the Dashboard, run reports, and test all features!',
    ui.ButtonSet.OK
  );
}

/**
 * Generates sample assessment data for all students.
 */
function generateSampleAssessments(ss, students) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Pre-K students get Form, Name, Sound assessments
  const preKSheet = ss.getSheetByName(PRE_K_SHEET_NAME);
  if (preKSheet) {
    const preKStudents = students.filter(s => s.program === 'Pre-K');
    const preKData = preKStudents.map((student, idx) => {
      const row = [student.name];
      // Each student has completed different amounts (simulate progress)
      const completedLetters = 8 + Math.floor(idx * 1.5); // 8-26 letters completed
      const masteryRate = 0.65 + (Math.random() * 0.3); // 65-95% mastery rate

      letters.forEach((letter, letterIdx) => {
        if (letterIdx < completedLetters) {
          // Completed - assign Y or N based on mastery rate
          const formResult = Math.random() < masteryRate ? 'Y' : 'N';
          const nameResult = Math.random() < masteryRate ? 'Y' : 'N';
          const soundResult = Math.random() < (masteryRate - 0.1) ? 'Y' : 'N'; // Sound slightly harder
          row.push(formResult, nameResult, soundResult);
        } else {
          // Not yet assessed
          row.push('', '', '');
        }
      });
      return row;
    });

    if (preKData.length > 0) {
      preKSheet.getRange(2, 1, preKData.length, preKData[0].length).setValues(preKData);
    }
  }

  // Pre-School students get Sound assessments only
  const preSchoolSheet = ss.getSheetByName(PRE_SCHOOL_SHEET_NAME);
  if (preSchoolSheet) {
    const preSchoolStudents = students.filter(s => s.program === 'Pre-School');
    const preSchoolData = preSchoolStudents.map((student, idx) => {
      const row = [student.name];
      const completedLetters = 6 + Math.floor(idx * 1.2); // 6-20 letters completed
      const masteryRate = 0.60 + (Math.random() * 0.35); // 60-95% mastery rate

      letters.forEach((letter, letterIdx) => {
        if (letterIdx < completedLetters) {
          row.push(Math.random() < masteryRate ? 'Y' : 'N');
        } else {
          row.push('');
        }
      });
      return row;
    });

    if (preSchoolData.length > 0) {
      preSchoolSheet.getRange(2, 1, preSchoolData.length, preSchoolData[0].length).setValues(preSchoolData);
    }
  }

  // Generate some tutor log entries
  const tutorLogSheet = ss.getSheetByName(TUTOR_LOG_SHEET_NAME);
  if (tutorLogSheet) {
    const tutors = ['David Kim', 'Ashley Thompson', 'Marcus Williams', 'Rachel Lee'];
    const sampleLogs = [];

    // Generate 20 sample log entries over the past 2 weeks
    for (let i = 0; i < 20; i++) {
      const daysAgo = Math.floor(Math.random() * 14);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      const student = students[Math.floor(Math.random() * students.length)];
      const tutor = tutors[Math.floor(Math.random() * tutors.length)];
      const letterIdx = Math.floor(Math.random() * 15);
      const letter = letters[letterIdx];

      sampleLogs.push([
        date,
        tutor,
        student.name,
        student.program,
        letter,
        Math.random() < 0.75 ? 'Y' : 'N',
        Math.random() < 0.70 ? 'Y' : 'N',
        Math.random() < 0.65 ? 'Y' : 'N',
        ''
      ]);
    }

    // Sort by date descending
    sampleLogs.sort((a, b) => b[0] - a[0]);

    if (sampleLogs.length > 0) {
      tutorLogSheet.getRange(2, 1, sampleLogs.length, 9).setValues(sampleLogs);
    }
  }
}

/**
 * Clears all test data and resets the spreadsheet.
 */
function clearAllData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Clear All Data',
    'This will DELETE all data from:\n\n' +
    '• Roster\n' +
    '• Pre-K assessments\n' +
    '• Pre-School assessments\n' +
    '• Skill Summary\n' +
    '• Tutor Log\n' +
    '• Site Config\n\n' +
    'This cannot be undone. Are you sure?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Clear each sheet (keep headers)
  const sheetsToClear = [
    { name: ROSTER_SHEET_NAME, headerRows: 1 },
    { name: PRE_K_SHEET_NAME, headerRows: 1 },
    { name: PRE_SCHOOL_SHEET_NAME, headerRows: 1 },
    { name: SUMMARY_SHEET_NAME, headerRows: 1 },
    { name: TUTOR_LOG_SHEET_NAME, headerRows: 1 },
    { name: TUTORS_SHEET_NAME, headerRows: 1 },
    { name: PACING_SHEET_NAME, headerRows: 1 }
  ];

  sheetsToClear.forEach(config => {
    const sheet = ss.getSheetByName(config.name);
    if (sheet && sheet.getLastRow() > config.headerRows) {
      sheet.getRange(config.headerRows + 1, 1, sheet.getLastRow() - config.headerRows, sheet.getLastColumn()).clear();
    }
  });

  // Delete Site Config sheet
  const configSheet = ss.getSheetByName('Site Config');
  if (configSheet) {
    ss.deleteSheet(configSheet);
  }

  // Reset spreadsheet name
  ss.rename('PreK Assessment Tracker');

  ui.alert('All Data Cleared', 'The spreadsheet has been reset. Use the Setup Wizard to configure a new site.', ui.ButtonSet.OK);
}

// ====================================================================
// ============ ENHANCED PARENT REPORT FUNCTIONS ======================
// ====================================================================

/**
 * Generates beautiful HTML-based parent reports for all students.
 * Creates individual HTML files that can be printed or shared as PDFs.
 * Works with headers row 1, data row 2+ structure.
 */
function generateEnhancedParentReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  const rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);

  if (!summarySheet || !rosterSheet) {
    SpreadsheetApp.getUi().alert("Error: 'Skill Summary Page' or 'Roster' sheet not found.");
    return;
  }

  // Get the template HTML
  const template = HtmlService.createHtmlOutputFromFile('ParentReport').getContent();

  // Get or create output folder
  let outputFolder;
  try {
    outputFolder = DriveApp.getFolderById(REPORT_FOLDER_ID);
  } catch (e) {
    // Create a new folder if the configured one doesn't exist
    outputFolder = DriveApp.createFolder('PreK Parent Reports - ' + new Date().toLocaleDateString());
  }

  // Get all data from sheets (headers row 1, data row 2+)
  const summaryLastRow = summarySheet.getLastRow();
  if (summaryLastRow < 2) {
    SpreadsheetApp.getUi().alert("No student data found in Skill Summary Page. Please run 'Update Summary Page' first.");
    return;
  }
  const summaryData = summarySheet.getRange(2, 1, summaryLastRow - 1, SUMMARY_LAST_COL).getValues();
  
  const rosterLastRow = rosterSheet.getLastRow();
  const rosterData = rosterLastRow >= 2 ? rosterSheet.getRange(2, 1, rosterLastRow - 1, 3).getValues() : [];

  // Create maps
  const rosterMap = new Map(rosterData.map(row => [row[0], { group: row[1], program: row[2] }]));

  const ui = SpreadsheetApp.getUi();
  ui.alert("Starting Enhanced Report Generation", "Creating progress reports for all students. This may take a few minutes.", ui.ButtonSet.OK);

  let filesCreated = 0;
  const currentDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy');

  for (const row of summaryData) {
    const studentName = row[0];
    if (!studentName) continue;

    const studentInfo = rosterMap.get(studentName);
    if (!studentInfo) continue;

    const program = studentInfo.program || "Unknown";
    const isPreK = program === 'Pre-K';

    // Get percentage values (indices match columns C-J)
    let overallMastery, formMastery, formCum, nameMastery, nameCum, soundMastery, soundCum, psMastery, psCum;

    if (isPreK) {
      formMastery = Math.round((row[4] || 0) * 100);
      formCum = Math.round((row[5] || 0) * 100);
      nameMastery = Math.round((row[6] || 0) * 100);
      nameCum = Math.round((row[7] || 0) * 100);
      soundMastery = Math.round((row[8] || 0) * 100);
      soundCum = Math.round((row[9] || 0) * 100);
      overallMastery = Math.round((formMastery + nameMastery + soundMastery) / 3);
    } else {
      psMastery = Math.round((row[2] || 0) * 100);
      psCum = Math.round((row[3] || 0) * 100);
      overallMastery = psMastery;
    }

    // Calculate ring offset (314.159 is circumference for r=50)
    const ringOffset = 314.159 - (314.159 * overallMastery / 100);

    // Determine encouragement based on mastery level
    let encouragementIcon, encouragementTitle, encouragementText;
    if (overallMastery >= 80) {
      encouragementIcon = "🌟";
      encouragementTitle = "Outstanding Progress!";
      encouragementText = studentName.split(' ')[0] + " is doing an amazing job! Keep up the wonderful work at home by practicing letter recognition together.";
    } else if (overallMastery >= 60) {
      encouragementIcon = "🎯";
      encouragementTitle = "Great Progress!";
      encouragementText = studentName.split(' ')[0] + " is making excellent progress! Continue supporting their learning journey with fun letter activities at home.";
    } else if (overallMastery >= 40) {
      encouragementIcon = "📚";
      encouragementTitle = "Building Strong Foundations!";
      encouragementText = studentName.split(' ')[0] + " is developing important skills! Practice makes perfect - try pointing out letters during everyday activities.";
    } else {
      encouragementIcon = "🌱";
      encouragementTitle = "Growing Every Day!";
      encouragementText = studentName.split(' ')[0] + " is learning new things every day! Keep encouraging them - every small step counts on this learning journey.";
    }

    // Determine progress message
    let progressMessage, progressDetail;
    if (overallMastery >= 80) {
      progressMessage = "Excellent Progress!";
      progressDetail = studentName.split(' ')[0] + " has mastered most of the skills introduced so far and is well-prepared for continued success.";
    } else if (overallMastery >= 60) {
      progressMessage = "Strong Progress!";
      progressDetail = studentName.split(' ')[0] + " is performing well and consistently improving in letter recognition skills.";
    } else if (overallMastery >= 40) {
      progressMessage = "Steady Progress!";
      progressDetail = studentName.split(' ')[0] + " is building foundational skills and making consistent progress with our curriculum.";
    } else {
      progressMessage = "Building Skills!";
      progressDetail = studentName.split(' ')[0] + " is working hard to develop early literacy skills. Every lesson brings new learning!";
    }

    // Helper function for skill class
    function getSkillClass(mastery) {
      if (mastery >= 80) return 'high';
      if (mastery >= 50) return 'medium';
      return 'low';
    }

    // Replace all placeholders
    let reportHtml = template
      .replace(/\{\{StudentName\}\}/g, studentName)
      .replace(/\{\{Program\}\}/g, program)
      .replace(/\{\{Date\}\}/g, currentDate)
      .replace(/\{\{OverallMastery\}\}/g, overallMastery)
      .replace(/\{\{OverallOffset\}\}/g, ringOffset)
      .replace(/\{\{ProgressMessage\}\}/g, progressMessage)
      .replace(/\{\{ProgressDetail\}\}/g, progressDetail)
      .replace(/\{\{EncouragementIcon\}\}/g, encouragementIcon)
      .replace(/\{\{EncouragementTitle\}\}/g, encouragementTitle)
      .replace(/\{\{EncouragementText\}\}/g, encouragementText);

    if (isPreK) {
      reportHtml = reportHtml
        .replace(/\{\{PreKDisplay\}\}/g, '')
        .replace(/\{\{PreSchoolDisplay\}\}/g, 'display:none')
        .replace(/\{\{FormMastery\}\}/g, formMastery)
        .replace(/\{\{FormCumulative\}\}/g, formCum)
        .replace(/\{\{FormClass\}\}/g, getSkillClass(formMastery))
        .replace(/\{\{NameMastery\}\}/g, nameMastery)
        .replace(/\{\{NameCumulative\}\}/g, nameCum)
        .replace(/\{\{NameClass\}\}/g, getSkillClass(nameMastery))
        .replace(/\{\{SoundMastery\}\}/g, soundMastery)
        .replace(/\{\{SoundCumulative\}\}/g, soundCum)
        .replace(/\{\{SoundClass\}\}/g, getSkillClass(soundMastery));
    } else {
      reportHtml = reportHtml
        .replace(/\{\{PreKDisplay\}\}/g, 'display:none')
        .replace(/\{\{PreSchoolDisplay\}\}/g, '')
        .replace(/\{\{PSMastery\}\}/g, psMastery)
        .replace(/\{\{PSCumulative\}\}/g, psCum)
        .replace(/\{\{PSClass\}\}/g, getSkillClass(psMastery));
    }

    // Create the HTML file
    const fileName = `${studentName} - Progress Report.html`;
    const blob = Utilities.newBlob(reportHtml, 'text/html', fileName);
    outputFolder.createFile(blob);
    filesCreated++;
  }

  ui.alert(
    "Report Generation Complete!",
    `${filesCreated} enhanced progress reports have been created.\n\nYou can find them in your Google Drive folder:\n${outputFolder.getUrl()}\n\nTip: Open each HTML file in Chrome and use "Print > Save as PDF" for a PDF report!`,
    ui.ButtonSet.OK
  );
}

/**
 * Gets a preview of a single student's enhanced report (for web app use).
 * Works with headers row 1, data row 2+ structure.
 */
function getParentReportPreview(studentName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  const rosterSheet = ss.getSheetByName(ROSTER_SHEET_NAME);

  if (!summarySheet || !rosterSheet) {
    return { error: "Required sheets not found" };
  }

  // Find student in roster (headers row 1, data row 2+)
  const rosterLastRow = rosterSheet.getLastRow();
  if (rosterLastRow < 2) {
    return { error: "No students in roster" };
  }
  const rosterData = rosterSheet.getRange(2, 1, rosterLastRow - 1, 3).getValues();
  const studentRoster = rosterData.find(row => row[0] === studentName);
  if (!studentRoster) {
    return { error: "Student not found in roster" };
  }

  const program = studentRoster[2];
  const isPreK = program === 'Pre-K';

  // Find student in summary (headers row 1, data row 2+)
  const summaryLastRow = summarySheet.getLastRow();
  if (summaryLastRow < 2) {
    return { error: "No data in Skill Summary Page. Please run 'Update Summary Page' first." };
  }
  const summaryData = summarySheet.getRange(2, 1, summaryLastRow - 1, SUMMARY_LAST_COL).getValues();
  const studentSummary = summaryData.find(row => row[0] === studentName);

  if (!studentSummary) {
    return { error: "Student not found in summary. Please run 'Update Summary Page' first." };
  }

  // Calculate values
  let data = {
    studentName: studentName,
    program: program,
    date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy')
  };

  if (isPreK) {
    data.formMastery = Math.round((studentSummary[4] || 0) * 100);
    data.formCumulative = Math.round((studentSummary[5] || 0) * 100);
    data.nameMastery = Math.round((studentSummary[6] || 0) * 100);
    data.nameCumulative = Math.round((studentSummary[7] || 0) * 100);
    data.soundMastery = Math.round((studentSummary[8] || 0) * 100);
    data.soundCumulative = Math.round((studentSummary[9] || 0) * 100);
    data.overallMastery = Math.round((data.formMastery + data.nameMastery + data.soundMastery) / 3);
  } else {
    data.psMastery = Math.round((studentSummary[2] || 0) * 100);
    data.psCumulative = Math.round((studentSummary[3] || 0) * 100);
    data.overallMastery = data.psMastery;
  }

  return data;
}
