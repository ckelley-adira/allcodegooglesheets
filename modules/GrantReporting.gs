/**
 * ============================================================
 *  MIND TRUST SUMMARY — Standalone Script
 *  Global Preparatory Academy / TILT / CK Consulting
 * ============================================================
 *
 *  Version: 4.0 - MODULAR ARCHITECTURE (PHASE 4)
 *  Last Updated: February 2026
 *
 *  FEATURE FLAG: SITE_CONFIG.features.grantReporting
 *  This module is only activated when the feature flag is set to true.
 *
 *  PURPOSE
 *  Generates a "Mind Trust Summary" sheet with the five metrics
 *  required for the Mind Trust tutoring grant report:
 *
 *    1. Attendance Rate (%)
 *    2. Baseline vs Current Skill Data
 *    3. Growth Percentages
 *    4. Identified Skill Gaps (with % evidence)
 *    5. Instructional Adjustments Tied to Data
 *
 *  USAGE:
 *  Enable in SiteConfig_TEMPLATE.gs: features.grantReporting = true
 *  Configure GRANT_CONFIG settings for your grant requirements
 * ============================================================
 */
 *
 *  REPORTING WINDOW
 *  All session-based data (attendance, tutoring log entries) is
 *  filtered to a 14-day lookback window ending on the trigger date.
 *  Snapshot data (Grade Summary, Skills Tracker) reflects current
 *  state at time of run.
 *
 *  DATA SOURCES (by metric)
 *  ┌──────────────────────────────────┬────────────────────────────────────────┐
 *  │ Metric                           │ Source Sheet(s)                        │
 *  ├──────────────────────────────────┼────────────────────────────────────────┤
 *  │ 1. Attendance Rate               │ Tutoring Progress Log  (tutoring)     │
 *  │                                  │ Small Group Progress   (whole-group)  │
 *  │                                  │ SGPArchive             (whole-group)  │
 *  │                                  │ Pacing Dashboard       (group-level)  │
 *  ├──────────────────────────────────┼────────────────────────────────────────┤
 *  │ 2. Baseline vs Current           │ Grade Summary  (Initial % → Total %)  │
 *  ├──────────────────────────────────┼────────────────────────────────────────┤
 *  │ 3. Growth Percentages            │ Grade Summary  (AG% columns)          │
 *  │                                  │ School Summary (aggregate growth)     │
 *  ├──────────────────────────────────┼────────────────────────────────────────┤
 *  │ 4. Skill Gaps                    │ Skills Tracker (mastery % by section) │
 *  │                                  │ Grade Summary  (section breakdowns)   │
 *  ├──────────────────────────────────┼────────────────────────────────────────┤
 *  │ 5. Instructional Adjustments     │ Derived from #4 gaps + benchmark      │
 *  │                                  │ status from Grade Summary             │
 *  └──────────────────────────────────┴────────────────────────────────────────┘
 *
 *  HOW TO USE
 *  1. Open the Google Sheet → Extensions → Apps Script
 *  2. Paste this entire file into MindTrustSummary.gs
 *  3. Add the menu items to your existing onOpen() Tutoring submenu
 *  4. Run generateMindTrustSummary() for manual with date prompt
 *  5. Or use scheduleMindTrustReport() to auto-run every 14 days
 *
 *  MENU ITEMS (add to your existing onOpen Tutoring submenu):
 *     .addItem('📊 Generate Mind Trust Summary', 'generateMindTrustSummary')
 *     .addItem('⏰ Schedule Mind Trust Report', 'scheduleMindTrustReport')
 *     .addItem('🚫 Remove Scheduled Report', 'removeMindTrustTrigger')
 * ============================================================
 */

// ─────────────────────── CONFIG ───────────────────────
const MT_CONFIG = {
  OUTPUT_SHEET: 'Mind Trust Summary',
  LOOKBACK_DAYS: 14,              // Reporting window
  GAP_THRESHOLD: 50,              // Skills below this % = gap
  CRITICAL_THRESHOLD: 25,         // Skills below this % = critical gap
  HEADER_BG: '#1a73e8',           // Google blue
  HEADER_FONT: '#ffffff',
  SECTION_BG: '#d0e2f3',          // Light blue
  GAP_BG: '#fce4ec',              // Light red
  CRITICAL_BG: '#ef9a9a',         // Stronger red
  SUCCESS_BG: '#e8f5e9',          // Light green
  ALT_ROW: '#f0f7ff',             // Alternating row
  FONT_FAMILY: 'Calibri',
  
  // Sheet name references
  GRADE_SUMMARY: 'Grade Summary',
  SKILLS_TRACKER: 'Skills Tracker',
  TUTORING_LOG: 'Tutoring Progress Log',
  TUTORING_SUMMARY: 'Tutoring Summary',
  SMALL_GROUP: 'Small Group Progress',
  SGP_ARCHIVE: 'SGPArchive',
  PACING_DASHBOARD: 'Pacing Dashboard',
  SCHOOL_SUMMARY: 'School Summary',
  G3_GROUPS: 'G3 Groups',
  STUDENT_ROSTER: 'Student Roster',
  
  // Skill section names (order matches Skills Tracker columns)
  SKILL_SECTIONS: [
    'Single Consonants & Vowels',
    'Blends',
    'Alphabet Review & Longer Words',
    'Digraphs',
    'VCE',
    'Reading Longer Words',
    'Ending Spelling Patterns',
    'R-Controlled Vowels',
    'Long Vowel Teams',
    'Other Vowel Teams',
    'Diphthongs',
    'Silent Letters',
    'Suffixes & Prefixes',
    'Suffix Spelling Changes',
    'Low Frequency Spellings',
    'Additional Affixes'
  ]
};


// ═══════════════════════════════════════════════════════
//  ENTRY POINTS
// ═══════════════════════════════════════════════════════

/**
 * Manual run — prompts user for the reporting end date,
 * then generates the summary for the 14-day window ending on that date.
 */
function generateMindTrustSummary() {
  const ui = SpreadsheetApp.getUi();
  
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM/dd/yyyy');
  const response = ui.prompt(
    '📊 Mind Trust Report',
    `Enter the reporting END date (the report will look back ${MT_CONFIG.LOOKBACK_DAYS} days from this date).\n\n` +
    `Leave blank for today (${todayStr}):`,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  let reportDate;
  const input = response.getResponseText().trim();
  
  if (input === '') {
    reportDate = new Date();
  } else {
    reportDate = new Date(input);
    if (isNaN(reportDate.getTime())) {
      ui.alert('Invalid Date', `"${input}" is not a valid date. Use MM/DD/YYYY format.`, ui.ButtonSet.OK);
      return;
    }
  }
  
  // Normalize to end of day
  reportDate.setHours(23, 59, 59, 999);
  
  generateMindTrustSummaryCore_(reportDate);
}


/**
 * Scheduled trigger entry point — uses the current date automatically.
 * This is what the time-driven trigger calls every 14 days.
 */
function generateMindTrustSummaryScheduled() {
  const reportDate = new Date();
  reportDate.setHours(23, 59, 59, 999);
  generateMindTrustSummaryCore_(reportDate);
}


/**
 * Creates a time-driven trigger that runs every 14 days.
 * Prompts for the first run date so the cycle aligns with
 * the school's reporting calendar.
 */
function scheduleMindTrustReport() {
  const ui = SpreadsheetApp.getUi();
  
  // Check for existing trigger
  const existing = getExistingMTTrigger_();
  if (existing) {
    const choice = ui.alert(
      'Trigger Already Exists',
      'A Mind Trust scheduled report already exists. Replace it?',
      ui.ButtonSet.YES_NO
    );
    if (choice !== ui.Button.YES) return;
    ScriptApp.deleteTrigger(existing);
  }
  
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM/dd/yyyy');
  const response = ui.prompt(
    '⏰ Schedule Mind Trust Report',
    `The report will run automatically every ${MT_CONFIG.LOOKBACK_DAYS} days.\n\n` +
    `Enter the FIRST run date (MM/DD/YYYY).\n` +
    `Leave blank to start today (${todayStr}):`,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  let firstRun;
  const input = response.getResponseText().trim();
  
  if (input === '') {
    firstRun = new Date();
  } else {
    firstRun = new Date(input);
    if (isNaN(firstRun.getTime())) {
      ui.alert('Invalid Date', `"${input}" is not a valid date.`, ui.ButtonSet.OK);
      return;
    }
  }
  
  // Create the trigger — runs every 14 days at 6 AM
  ScriptApp.newTrigger('generateMindTrustSummaryScheduled')
    .timeBased()
    .everyDays(MT_CONFIG.LOOKBACK_DAYS)
    .atHour(6)
    .create();
  
  // Store cycle start for reference
  PropertiesService.getScriptProperties().setProperty(
    'MT_CYCLE_START',
    firstRun.toISOString()
  );
  
  // If first run is today, generate now
  const today = new Date();
  if (firstRun.toDateString() === today.toDateString()) {
    generateMindTrustSummaryScheduled();
  }
  
  const nextRunStr = Utilities.formatDate(firstRun, Session.getScriptTimeZone(), 'MMMM d, yyyy');
  ui.alert('✅ Scheduled',
    `Mind Trust Summary will run every ${MT_CONFIG.LOOKBACK_DAYS} days at 6:00 AM.\n\n` +
    `First run: ${nextRunStr}\n` +
    `Each report covers the prior ${MT_CONFIG.LOOKBACK_DAYS}-day window.`,
    ui.ButtonSet.OK);
}


/**
 * Removes the scheduled Mind Trust trigger.
 */
function removeMindTrustTrigger() {
  const ui = SpreadsheetApp.getUi();
  const trigger = getExistingMTTrigger_();
  
  if (!trigger) {
    ui.alert('No Trigger Found', 'There is no scheduled Mind Trust report to remove.', ui.ButtonSet.OK);
    return;
  }
  
  ScriptApp.deleteTrigger(trigger);
  PropertiesService.getScriptProperties().deleteProperty('MT_CYCLE_START');
  
  ui.alert('✅ Removed', 'The scheduled Mind Trust report has been removed.', ui.ButtonSet.OK);
}


/** Finds an existing MT trigger if one exists */
function getExistingMTTrigger_() {
  return ScriptApp.getProjectTriggers().find(
    t => t.getHandlerFunction() === 'generateMindTrustSummaryScheduled'
  ) || null;
}


// ═══════════════════════════════════════════════════════
//  CORE REPORT GENERATOR
// ═══════════════════════════════════════════════════════

/**
 * Main report generation logic.
 * @param {Date} reportDate - The end date of the reporting window.
 *        Session data is filtered to [reportDate - 14 days, reportDate].
 *        Snapshot data (Grade Summary, Skills Tracker) is current state.
 */
function generateMindTrustSummaryCore_(reportDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  
  // Calculate the date window
  const endDate = new Date(reportDate);
  const startDate = new Date(reportDate);
  startDate.setDate(startDate.getDate() - MT_CONFIG.LOOKBACK_DAYS);
  startDate.setHours(0, 0, 0, 0);
  
  const dateRange = { start: startDate, end: endDate };
  
  // Verify required sheets
  const required = [MT_CONFIG.GRADE_SUMMARY, MT_CONFIG.SKILLS_TRACKER];
  for (const name of required) {
    if (!ss.getSheetByName(name)) {
      try {
        SpreadsheetApp.getUi().alert('Missing Sheet', `Required sheet "${name}" not found.`, SpreadsheetApp.getUi().ButtonSet.OK);
      } catch (e) {
        Logger.log(`Missing required sheet: ${name}`);
      }
      return;
    }
  }
  
  // Create or clear output sheet
  let out = ss.getSheetByName(MT_CONFIG.OUTPUT_SHEET);
  if (out) {
    out.clear();
    out.clearFormats();
    out.clearConditionalFormatRules();
  } else {
    out = ss.insertSheet(MT_CONFIG.OUTPUT_SHEET);
  }
  
  // ── Gather data ──
  const tutoringStudents = getTutoringStudentList_(ss);
  const gradeSummary     = getGradeSummaryData_(ss);
  const skillsData       = getSkillsTrackerData_(ss);
  const attendanceData   = getAttendanceData_(ss, tutoringStudents, dateRange);
  const tutoringLogData  = getTutoringLogData_(ss, dateRange);
  const schoolMetrics    = getSchoolSummaryMetrics_(ss);
  
  // ── Build report ──
  let row = 1;
  row = writeReportHeader_(out, row, schoolMetrics, tutoringStudents, dateRange);
  row = writeDataSourceNote_(out, row, tutoringLogData, dateRange);
  row = writeSection1_Attendance_(out, row, tutoringStudents, attendanceData, tutoringLogData, dateRange);
  row = writeSection2_BaselineVsCurrent_(out, row, tutoringStudents, gradeSummary);
  row = writeSection3_Growth_(out, row, tutoringStudents, gradeSummary, schoolMetrics);
  row = writeSection4_SkillGaps_(out, row, tutoringStudents, skillsData);
  row = writeSection5_InstructionalAdjustments_(out, row, tutoringStudents, skillsData, gradeSummary);
  
  // Final formatting
  out.setFrozenRows(0);
  out.autoResizeColumns(1, 2);
  
  ss.setActiveSheet(out);
  ss.moveActiveSheet(2);
  
  // Confirmation (skip if running from trigger — no UI)
  try {
    const startStr = Utilities.formatDate(startDate, tz, 'MM/dd/yyyy');
    const endStr = Utilities.formatDate(endDate, tz, 'MM/dd/yyyy');
    SpreadsheetApp.getUi().alert('✅ Report Generated',
      `"${MT_CONFIG.OUTPUT_SHEET}" created.\n\n` +
      `Reporting Window: ${startStr} – ${endStr} (${MT_CONFIG.LOOKBACK_DAYS} days)\n` +
      `Tutoring Students: ${tutoringStudents.length}\n\n` +
      'Sections:\n' +
      '  1. Attendance Rate\n' +
      '  2. Baseline vs Current Skill Data\n' +
      '  3. Growth Percentages\n' +
      '  4. Identified Skill Gaps\n' +
      '  5. Instructional Adjustments',
      SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    Logger.log(`Mind Trust Summary generated for window ending ${reportDate}`);
  }
}


// ═══════════════════════════════════════════════════════
//  DATA GATHERING FUNCTIONS
// ═══════════════════════════════════════════════════════

/**
 * Identifies students assigned to tutoring groups from the G3 Groups sheet.
 * Falls back to all students in Grade Summary if G3 Groups isn't found.
 */
function getTutoringStudentList_(ss) {
  const groupSheet = ss.getSheetByName(MT_CONFIG.G3_GROUPS);
  const tutoringStudents = [];
  
  if (groupSheet) {
    const data = groupSheet.getDataRange().getValues();
    let currentGroup = '';
    let isTutoringGroup = false;
    
    for (let i = 0; i < data.length; i++) {
      const firstCell = String(data[i][0] || '').trim();
      
      if (firstCell.match(/^G\d+\s+Group\s+\d+/i) && firstCell !== 'Student Name') {
        currentGroup = firstCell;
        isTutoringGroup = /tutoring/i.test(currentGroup);
        continue;
      }
      
      if (firstCell === 'Student Name' || firstCell === '' ||
          firstCell.match(/^Instructional Sequence/i) ||
          firstCell.match(/^Lesson/i)) {
        continue;
      }
      
      if (isTutoringGroup && firstCell) {
        tutoringStudents.push({ name: firstCell, tutoringGroup: currentGroup });
      }
    }
  }
  
  // Deduplicate
  const seen = new Set();
  const unique = [];
  for (const s of tutoringStudents) {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      unique.push(s);
    }
  }
  
  // Fallback to all Grade Summary students
  if (unique.length === 0) {
    const gs = ss.getSheetByName(MT_CONFIG.GRADE_SUMMARY);
    if (gs) {
      const gsData = gs.getDataRange().getValues();
      const headerRow = gsData.findIndex(r => String(r[0]).trim() === 'Student Name');
      if (headerRow >= 0) {
        for (let i = headerRow + 1; i < gsData.length; i++) {
          const name = String(gsData[i][0] || '').trim();
          if (name) unique.push({ name, tutoringGroup: 'N/A — see G3 Groups' });
        }
      }
    }
  }
  
  return unique.sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Reads Grade Summary into a map keyed by student name.
 * (Snapshot data — not date-filtered)
 */
function getGradeSummaryData_(ss) {
  const sheet = ss.getSheetByName(MT_CONFIG.GRADE_SUMMARY);
  if (!sheet) return {};
  
  const data = sheet.getDataRange().getValues();
  const headerRow = data.findIndex(r => String(r[0]).trim() === 'Student Name');
  if (headerRow < 0) return {};
  
  const map = {};
  
  for (let i = headerRow + 1; i < data.length; i++) {
    const name = String(data[i][0] || '').trim();
    if (!name) continue;
    
    const entry = {
      grade: String(data[i][1] || ''),
      teacher: String(data[i][2] || ''),
      group: String(data[i][3] || ''),
      foundPct: parseNum_(data[i][4]),
      minGradePct: parseNum_(data[i][5]),
      fullGradePct: parseNum_(data[i][6]),
      benchmarkStatus: String(data[i][7] || ''),
      skills: {}
    };
    
    const skillStartCol = 8;
    for (let s = 0; s < MT_CONFIG.SKILL_SECTIONS.length; s++) {
      const colBase = skillStartCol + (s * 3);
      entry.skills[MT_CONFIG.SKILL_SECTIONS[s]] = {
        initial: parseNum_(data[i][colBase]),
        ag: parseNum_(data[i][colBase + 1]),
        total: parseNum_(data[i][colBase + 2])
      };
    }
    
    map[name] = entry;
  }
  
  return map;
}


/**
 * Reads Skills Tracker into a map keyed by student name.
 * (Snapshot data — not date-filtered)
 */
function getSkillsTrackerData_(ss) {
  const sheet = ss.getSheetByName(MT_CONFIG.SKILLS_TRACKER);
  if (!sheet) return {};
  
  const data = sheet.getDataRange().getValues();
  const headerRow = data.findIndex(r => String(r[0]).trim() === 'Student Name');
  if (headerRow < 0) return {};
  
  const map = {};
  
  for (let i = headerRow + 1; i < data.length; i++) {
    const name = String(data[i][0] || '').trim();
    if (!name) continue;
    
    const entry = {};
    for (let s = 0; s < MT_CONFIG.SKILL_SECTIONS.length; s++) {
      entry[MT_CONFIG.SKILL_SECTIONS[s]] = parseNum_(data[i][4 + s]);
    }
    map[name] = entry;
  }
  
  return map;
}


/**
 * Calculates per-student whole-group attendance from Small Group Progress
 * and SGPArchive, filtered to the reporting window.
 * Attendance = (Y + N) / (Y + N + A) * 100.
 *
 * @param {Object} dateRange - { start: Date, end: Date }
 */
function getAttendanceData_(ss, tutoringStudents, dateRange) {
  const studentNames = new Set(tutoringStudents.map(s => s.name));
  const counts = {};
  
  for (const name of studentNames) {
    counts[name] = { present: 0, absent: 0, total: 0 };
  }
  
  const sgpSheet = ss.getSheetByName(MT_CONFIG.SMALL_GROUP);
  if (sgpSheet) tallySGPAttendance_(sgpSheet, counts, studentNames, dateRange);
  
  const archiveSheet = ss.getSheetByName(MT_CONFIG.SGP_ARCHIVE);
  if (archiveSheet) tallySGPAttendance_(archiveSheet, counts, studentNames, dateRange);
  
  const result = {};
  for (const [name, c] of Object.entries(counts)) {
    const total = c.present + c.absent;
    result[name] = {
      sessions: total,
      present: c.present,
      absent: c.absent,
      attendancePct: total > 0 ? Math.round((c.present / total) * 100) : null
    };
  }
  
  return result;
}

/**
 * Tallies attendance from a Small Group Progress-style sheet,
 * only counting rows whose date falls within the reporting window.
 */
function tallySGPAttendance_(sheet, counts, studentNames, dateRange) {
  const data = sheet.getDataRange().getValues();
  const headerRow = data.findIndex(r => String(r[0]).trim() === 'Date');
  if (headerRow < 0) return;
  
  for (let i = headerRow + 1; i < data.length; i++) {
    const rawDate = data[i][0];
    const rowDate = toDate_(rawDate);
    if (!rowDate) continue;
    
    // ── Date filter ──
    if (rowDate < dateRange.start || rowDate > dateRange.end) continue;
    
    const name = String(data[i][3] || '').trim();
    const status = String(data[i][5] || '').trim().toUpperCase();
    
    if (!name || !studentNames.has(name)) continue;
    if (!counts[name]) counts[name] = { present: 0, absent: 0, total: 0 };
    
    if (status === 'Y' || status === 'N') {
      counts[name].present++;
    } else if (status === 'A') {
      counts[name].absent++;
    }
  }
}


/**
 * Reads Tutoring Progress Log for tutoring-specific sessions,
 * filtered to the reporting window.
 *
 * @param {Object} dateRange - { start: Date, end: Date }
 */
function getTutoringLogData_(ss, dateRange) {
  const sheet = ss.getSheetByName(MT_CONFIG.TUTORING_LOG);
  if (!sheet) return { students: {}, totalSessions: 0, totalAllTime: 0, hasData: false };
  
  const data = sheet.getDataRange().getValues();
  const headerRow = data.findIndex(r => String(r[0]).trim() === 'Date');
  if (headerRow < 0) return { students: {}, totalSessions: 0, totalAllTime: 0, hasData: false };
  
  const students = {};
  let totalSessions = 0;
  let totalAllTime = 0;
  
  for (let i = headerRow + 1; i < data.length; i++) {
    const name = String(data[i][3] || '').trim();
    if (!name) continue;
    if (/test/i.test(String(data[i][2] || ''))) continue;
    
    totalAllTime++;
    
    // ── Date filter ──
    const rawDate = data[i][0];
    const rowDate = toDate_(rawDate);
    if (!rowDate) continue;
    if (rowDate < dateRange.start || rowDate > dateRange.end) continue;
    
    const status = String(data[i][6] || '').trim().toUpperCase();
    
    if (!students[name]) {
      students[name] = { sessions: 0, passed: 0, failed: 0, absent: 0 };
    }
    
    totalSessions++;
    students[name].sessions++;
    
    if (status === 'Y') students[name].passed++;
    else if (status === 'N') students[name].failed++;
    else if (status === 'A') students[name].absent++;
  }
  
  for (const [name, d] of Object.entries(students)) {
    const attempted = d.passed + d.failed;
    d.passPct = attempted > 0 ? Math.round((d.passed / attempted) * 100) : null;
  }
  
  return {
    students,
    totalSessions,
    totalAllTime,
    hasData: totalSessions > 0
  };
}


/**
 * Reads aggregate metrics from School Summary.
 * (Snapshot — not date-filtered)
 */
function getSchoolSummaryMetrics_(ss) {
  const sheet = ss.getSheetByName(MT_CONFIG.SCHOOL_SUMMARY);
  const defaults = {
    schoolName: 'Global Preparatory Academy',
    updated: '',
    foundInitial: '', foundCurrent: '', foundGrowth: '',
    minInitial: '', minCurrent: '', minGrowth: '',
    fullInitial: '', fullCurrent: '', fullGrowth: '',
    onTrack: '', progressing: '', needsSupport: ''
  };
  
  if (!sheet) return defaults;
  
  const data = sheet.getDataRange().getValues();
  
  for (let i = 0; i < data.length; i++) {
    const label = String(data[i][0] || '').trim();
    
    if (label.includes('Updated:') || String(data[i][3] || '').includes('Updated:')) {
      defaults.updated = String(data[i][3] || data[i][0]).replace('Updated:', '').trim();
    }
    if (label === 'Foundational Skills') {
      defaults.foundInitial = data[i][1]; defaults.foundCurrent = data[i][2]; defaults.foundGrowth = data[i][3];
    }
    if (label === 'Min Grade Skills') {
      defaults.minInitial = data[i][1]; defaults.minCurrent = data[i][2]; defaults.minGrowth = data[i][3];
    }
    if (label === 'Full Grade Skills') {
      defaults.fullInitial = data[i][1]; defaults.fullCurrent = data[i][2]; defaults.fullGrowth = data[i][3];
    }
    if (label.includes('On Track')) defaults.onTrack = String(data[i][1] || '');
    if (label.includes('Progressing')) defaults.progressing = String(data[i][1] || '');
    if (label.includes('Needs Support')) defaults.needsSupport = String(data[i][1] || '');
  }
  
  return defaults;
}


// ═══════════════════════════════════════════════════════
//  REPORT WRITING FUNCTIONS
// ═══════════════════════════════════════════════════════

function writeReportHeader_(out, row, metrics, tutoringStudents, dateRange) {
  const tz = Session.getScriptTimeZone();
  const startStr = Utilities.formatDate(dateRange.start, tz, 'MM/dd/yyyy');
  const endStr = Utilities.formatDate(dateRange.end, tz, 'MM/dd/yyyy');
  
  // Title
  const titleRange = out.getRange(row, 1, 1, 10);
  titleRange.merge();
  titleRange.setValue('MIND TRUST GRANT — TUTORING OUTCOMES SUMMARY');
  titleRange.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(16).setFontWeight('bold')
    .setFontColor(MT_CONFIG.HEADER_FONT).setBackground(MT_CONFIG.HEADER_BG)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  out.setRowHeight(row, 40);
  row++;
  
  // Subtitle
  const subRange = out.getRange(row, 1, 1, 10);
  subRange.merge();
  subRange.setValue(metrics.schoolName + '  •  Grade 3  •  The Indy Learning Team / Adira Reads');
  subRange.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(11).setFontColor('#444444')
    .setHorizontalAlignment('center').setBackground('#e8eef7');
  row++;
  
  // Reporting window — prominent display
  const windowRange = out.getRange(row, 1, 1, 10);
  windowRange.merge();
  windowRange.setValue(`📅  Reporting Window: ${startStr} – ${endStr}  (${MT_CONFIG.LOOKBACK_DAYS}-day period)`);
  windowRange.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(11).setFontWeight('bold')
    .setFontColor('#1a237e').setHorizontalAlignment('center').setBackground('#e8eef7');
  row++;
  
  // Summary stats
  const dateStr = Utilities.formatDate(new Date(), tz, 'MMMM d, yyyy');
  const statsRow = out.getRange(row, 1, 1, 10);
  statsRow.merge();
  statsRow.setValue(`Report Generated: ${dateStr}   |   Tutoring Students: ${tutoringStudents.length}   |   Data Updated: ${metrics.updated || 'N/A'}`);
  statsRow.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10).setFontColor('#666666')
    .setHorizontalAlignment('center').setBackground('#f5f5f5');
  row++;
  
  row++;
  return row;
}


function writeDataSourceNote_(out, row, tutoringLogData, dateRange) {
  const tz = Session.getScriptTimeZone();
  const startStr = Utilities.formatDate(dateRange.start, tz, 'MM/dd/yyyy');
  const endStr = Utilities.formatDate(dateRange.end, tz, 'MM/dd/yyyy');
  
  if (!tutoringLogData.hasData) {
    const noteRange = out.getRange(row, 1, 1, 10);
    noteRange.merge();
    
    let msg = `⚠️  NOTE: No tutoring session data found for the reporting window (${startStr} – ${endStr}). `;
    
    if (tutoringLogData.totalAllTime > 0) {
      msg += 'Tutoring sessions exist outside this window. Whole-group data shown below is from ' +
             'Small Group Progress and SGPArchive within the window. Skill snapshots are current.';
    } else {
      msg += 'The Tutoring Progress Log does not yet have student session data. ' +
             'Whole-group attendance shown below is from Small Group Progress and SGPArchive ' +
             'within the window. Skill data reflects current state. ' +
             'Tutoring-specific metrics will populate once teachers begin logging tutoring sessions.';
    }
    
    noteRange.setValue(msg);
    noteRange.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(9).setFontColor('#b71c1c')
      .setBackground('#fff8e1').setWrap(true);
    out.setRowHeight(row, 50);
    row++;
    row++;
  }
  return row;
}


// ─── SECTION 1: ATTENDANCE ───
function writeSection1_Attendance_(out, row, tutoringStudents, attendanceData, tutoringLogData, dateRange) {
  const tz = Session.getScriptTimeZone();
  const startStr = Utilities.formatDate(dateRange.start, tz, 'MM/dd/yyyy');
  const endStr = Utilities.formatDate(dateRange.end, tz, 'MM/dd/yyyy');
  
  row = writeSectionHeader_(out, row, '1. ATTENDANCE RATE (%)',
    `Source: Tutoring Progress Log + Small Group Progress + SGPArchive  |  Window: ${startStr} – ${endStr}`);
  
  const headers = [
    'Student Name', 'Tutoring Group',
    'WG Sessions\nTracked', 'WG Sessions\nPresent', 'WG Sessions\nAbsent', 'WG Attendance %',
    'Tutoring Sessions', 'Tutoring\nAttendance %'
  ];
  writeHeaderRow_(out, row, headers, 8);
  row++;
  
  let totalWGPresent = 0, totalWGSessions = 0;
  let totalTutPresent = 0, totalTutSessions = 0;
  const dataStartRow = row;
  
  for (const student of tutoringStudents) {
    const att = attendanceData[student.name] || {};
    const tut = (tutoringLogData.students || {})[student.name];
    
    const wgSessions = (att.present || 0) + (att.absent || 0);
    const wgPct = att.attendancePct;
    
    totalWGPresent += (att.present || 0);
    totalWGSessions += wgSessions;
    
    const tutSessions = tut ? tut.sessions : 0;
    const tutPresent = tut ? (tut.sessions - tut.absent) : 0;
    totalTutSessions += tutSessions;
    totalTutPresent += tutPresent;
    
    const rowData = [
      student.name,
      student.tutoringGroup,
      wgSessions || '—',
      att.present || '—',
      att.absent || '—',
      wgPct != null ? wgPct + '%' : 'No data',
      tutSessions || '—',
      tutSessions > 0 ? Math.round((tutPresent / tutSessions) * 100) + '%' : 'Awaiting data'
    ];
    
    out.getRange(row, 1, 1, 8).setValues([rowData])
      .setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10);
    
    if ((row - dataStartRow) % 2 === 1) {
      out.getRange(row, 1, 1, 8).setBackground(MT_CONFIG.ALT_ROW);
    }
    
    if (wgPct != null) {
      const cell = out.getRange(row, 6);
      if (wgPct >= 90) cell.setBackground(MT_CONFIG.SUCCESS_BG);
      else if (wgPct < 75) cell.setBackground(MT_CONFIG.GAP_BG);
    }
    
    row++;
  }
  
  // Summary row
  const summaryRow = out.getRange(row, 1, 1, 8);
  const avgWG = totalWGSessions > 0 ? Math.round((totalWGPresent / totalWGSessions) * 100) : 0;
  const avgTut = totalTutSessions > 0 ? Math.round((totalTutPresent / totalTutSessions) * 100) : 0;
  summaryRow.setValues([[
    'AVERAGES / TOTALS', '',
    totalWGSessions, totalWGPresent, totalWGSessions - totalWGPresent,
    avgWG + '%',
    totalTutSessions,
    totalTutSessions > 0 ? avgTut + '%' : 'N/A'
  ]]);
  summaryRow.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10)
    .setFontWeight('bold').setBackground('#e3f2fd');
  row++;
  
  row++;
  return row;
}


// ─── SECTION 2: BASELINE VS CURRENT ───
function writeSection2_BaselineVsCurrent_(out, row, tutoringStudents, gradeSummary) {
  row = writeSectionHeader_(out, row, '2. BASELINE vs CURRENT SKILL DATA',
    'Source: Grade Summary — Initial Assessment % (baseline) vs Total % (current)  |  Snapshot: current state at time of report');
  
  const headers = [
    'Student Name', 'Grade', 'Teacher', 'Primary Group',
    'Baseline\nFoundational %', 'Current\nFoundational %',
    'Baseline\nMin Grade %', 'Current\nMin Grade %',
    'Benchmark\nStatus'
  ];
  writeHeaderRow_(out, row, headers, 9);
  row++;
  
  const dataStartRow = row;
  
  for (const student of tutoringStudents) {
    const gs = gradeSummary[student.name];
    if (!gs) {
      out.getRange(row, 1, 1, 9).setValues([[
        student.name, '', '', '', 'Not in Grade Summary', '', '', '', ''
      ]]).setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10);
      row++;
      continue;
    }
    
    let baselineFoundSum = 0, baselineFoundCount = 0;
    
    for (const skill of MT_CONFIG.SKILL_SECTIONS) {
      const sd = gs.skills[skill];
      if (sd && sd.initial != null) { baselineFoundSum += sd.initial; baselineFoundCount++; }
    }
    
    const baselineAvg = baselineFoundCount > 0 ? Math.round(baselineFoundSum / baselineFoundCount) : null;
    
    const rowData = [
      student.name,
      gs.grade,
      gs.teacher,
      gs.group,
      baselineAvg != null ? baselineAvg + '%' : '—',
      gs.foundPct != null ? gs.foundPct + '%' : '—',
      baselineAvg != null ? baselineAvg + '%' : '—',
      gs.minGradePct != null ? gs.minGradePct + '%' : '—',
      gs.benchmarkStatus
    ];
    
    out.getRange(row, 1, 1, 9).setValues([rowData])
      .setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10);
    
    if ((row - dataStartRow) % 2 === 1) {
      out.getRange(row, 1, 1, 9).setBackground(MT_CONFIG.ALT_ROW);
    }
    
    const statusCell = out.getRange(row, 9);
    if (gs.benchmarkStatus === 'On Track') statusCell.setBackground(MT_CONFIG.SUCCESS_BG);
    else if (gs.benchmarkStatus === 'Intervention') statusCell.setBackground(MT_CONFIG.CRITICAL_BG);
    else if (gs.benchmarkStatus === 'Needs Support') statusCell.setBackground('#fff9c4');
    
    row++;
  }
  
  row++;
  return row;
}


// ─── SECTION 3: GROWTH ───
function writeSection3_Growth_(out, row, tutoringStudents, gradeSummary, schoolMetrics) {
  row = writeSectionHeader_(out, row, '3. GROWTH PERCENTAGES',
    'Source: Grade Summary AG% columns + School Summary aggregate  |  Snapshot: current cumulative growth');
  
  const aggRange = out.getRange(row, 1, 1, 10);
  aggRange.merge();
  aggRange.setValue(
    `School-Wide Growth:  Foundational Skills ${schoolMetrics.foundGrowth || 'N/A'}  |  ` +
    `Min Grade Skills ${schoolMetrics.minGrowth || 'N/A'}  |  ` +
    `Full Grade Skills ${schoolMetrics.fullGrowth || 'N/A'}`
  );
  aggRange.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10).setFontWeight('bold')
    .setBackground('#e8f5e9').setFontColor('#2e7d32');
  row++;
  
  const distRange = out.getRange(row, 1, 1, 10);
  distRange.merge();
  distRange.setValue(
    `Student Distribution:  ${schoolMetrics.onTrack}  |  ` +
    `${schoolMetrics.progressing}  |  ` +
    `${schoolMetrics.needsSupport}`
  );
  distRange.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10).setBackground('#f5f5f5');
  row++;
  row++;
  
  const headers = [
    'Student Name', 'Tutoring Group',
    'Foundational\nSkills %', 'Min Grade\nSkills %', 'Full Grade\nSkills %',
    'Benchmark', 'Top Growing\nSkill Area', 'Growth\nAmount'
  ];
  writeHeaderRow_(out, row, headers, 8);
  row++;
  
  const dataStartRow = row;
  
  for (const student of tutoringStudents) {
    const gs = gradeSummary[student.name];
    if (!gs) { row++; continue; }
    
    let topSkill = '—';
    let topGrowth = 0;
    for (const skill of MT_CONFIG.SKILL_SECTIONS) {
      const ag = gs.skills[skill] ? gs.skills[skill].ag : null;
      if (ag != null && ag > topGrowth) {
        topGrowth = ag;
        topSkill = skill;
      }
    }
    
    const rowData = [
      student.name,
      student.tutoringGroup,
      gs.foundPct != null ? gs.foundPct + '%' : '—',
      gs.minGradePct != null ? gs.minGradePct + '%' : '—',
      gs.fullGradePct != null ? gs.fullGradePct + '%' : '—',
      gs.benchmarkStatus,
      topSkill,
      topGrowth > 0 ? '+' + topGrowth + '%' : '—'
    ];
    
    out.getRange(row, 1, 1, 8).setValues([rowData])
      .setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10);
    
    if ((row - dataStartRow) % 2 === 1) {
      out.getRange(row, 1, 1, 8).setBackground(MT_CONFIG.ALT_ROW);
    }
    
    const statusCell = out.getRange(row, 6);
    if (gs.benchmarkStatus === 'On Track') statusCell.setBackground(MT_CONFIG.SUCCESS_BG);
    else if (gs.benchmarkStatus === 'Intervention') statusCell.setBackground(MT_CONFIG.CRITICAL_BG);
    else if (gs.benchmarkStatus === 'Needs Support') statusCell.setBackground('#fff9c4');
    
    row++;
  }
  
  row++;
  return row;
}


// ─── SECTION 4: SKILL GAPS ───
function writeSection4_SkillGaps_(out, row, tutoringStudents, skillsData) {
  row = writeSectionHeader_(out, row, '4. IDENTIFIED SKILL GAPS (with % evidence)',
    `Source: Skills Tracker — mastery % by skill section  |  Gap: <${MT_CONFIG.GAP_THRESHOLD}%, Critical: <${MT_CONFIG.CRITICAL_THRESHOLD}%  |  Snapshot: current state`);
  
  const gapCounts = {};
  for (const skill of MT_CONFIG.SKILL_SECTIONS) { gapCounts[skill] = { gap: 0, critical: 0 }; }
  let studentsWithGaps = 0;
  
  for (const student of tutoringStudents) {
    const sd = skillsData[student.name];
    if (!sd) continue;
    let hasGap = false;
    for (const skill of MT_CONFIG.SKILL_SECTIONS) {
      const pct = sd[skill];
      if (pct != null && pct < MT_CONFIG.GAP_THRESHOLD) {
        gapCounts[skill].gap++;
        hasGap = true;
      }
      if (pct != null && pct < MT_CONFIG.CRITICAL_THRESHOLD) {
        gapCounts[skill].critical++;
      }
    }
    if (hasGap) studentsWithGaps++;
  }
  
  const summLabel = out.getRange(row, 1, 1, 10);
  summLabel.merge();
  summLabel.setValue(`Aggregate Skill Gap Analysis — ${studentsWithGaps} of ${tutoringStudents.length} tutoring students have at least one gap (<${MT_CONFIG.GAP_THRESHOLD}%)`);
  summLabel.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10).setFontWeight('bold')
    .setBackground('#fce4ec');
  row++;
  
  const gapHeaders = ['Skill Section', '# Students\n<' + MT_CONFIG.GAP_THRESHOLD + '%', '% of Tutoring\nStudents', '# Critical\n<' + MT_CONFIG.CRITICAL_THRESHOLD + '%'];
  writeHeaderRow_(out, row, gapHeaders, 4);
  row++;
  
  const sortedSkills = [...MT_CONFIG.SKILL_SECTIONS].sort((a, b) => gapCounts[b].gap - gapCounts[a].gap);
  
  for (const skill of sortedSkills) {
    const gc = gapCounts[skill];
    if (gc.gap === 0) continue;
    
    const pctOfStudents = Math.round((gc.gap / tutoringStudents.length) * 100);
    out.getRange(row, 1, 1, 4).setValues([[
      skill, gc.gap, pctOfStudents + '%', gc.critical
    ]]).setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10);
    
    if (pctOfStudents >= 50) {
      out.getRange(row, 1, 1, 4).setBackground(MT_CONFIG.GAP_BG);
    }
    row++;
  }
  
  row++;
  
  const perStudentLabel = out.getRange(row, 1, 1, 10);
  perStudentLabel.merge();
  perStudentLabel.setValue('Per-Student Skill Gap Detail');
  perStudentLabel.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(11).setFontWeight('bold')
    .setBackground(MT_CONFIG.SECTION_BG);
  row++;
  
  const detailHeaders = ['Student Name', 'Tutoring Group', '# Gaps', 'Skill Gaps (Skill: Mastery %)'];
  writeHeaderRow_(out, row, detailHeaders, 4);
  out.setColumnWidth(4, 500);
  row++;
  
  const dataStartRow = row;
  
  for (const student of tutoringStudents) {
    const sd = skillsData[student.name];
    if (!sd) continue;
    
    const gaps = [];
    for (const skill of MT_CONFIG.SKILL_SECTIONS) {
      const pct = sd[skill];
      if (pct != null && pct < MT_CONFIG.GAP_THRESHOLD) {
        const prefix = pct < MT_CONFIG.CRITICAL_THRESHOLD ? '⚠️ ' : '';
        gaps.push(`${prefix}${skill}: ${pct}%`);
      }
    }
    
    if (gaps.length === 0) continue;
    
    out.getRange(row, 1, 1, 4).setValues([[
      student.name,
      student.tutoringGroup,
      gaps.length,
      gaps.join('  |  ')
    ]]).setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10);
    
    if ((row - dataStartRow) % 2 === 1) {
      out.getRange(row, 1, 1, 4).setBackground(MT_CONFIG.ALT_ROW);
    }
    
    if (gaps.length >= 10) {
      out.getRange(row, 3).setBackground(MT_CONFIG.CRITICAL_BG).setFontWeight('bold');
    } else if (gaps.length >= 5) {
      out.getRange(row, 3).setBackground(MT_CONFIG.GAP_BG);
    }
    
    row++;
  }
  
  row++;
  return row;
}


// ─── SECTION 5: INSTRUCTIONAL ADJUSTMENTS ───
function writeSection5_InstructionalAdjustments_(out, row, tutoringStudents, skillsData, gradeSummary) {
  row = writeSectionHeader_(out, row, '5. INSTRUCTIONAL ADJUSTMENTS TIED TO DATA',
    'Derived from: Skill gap patterns (Skills Tracker) + Benchmark status (Grade Summary)  |  ' +
    'Recommendations mapped to specific UFLI lesson ranges');
  
  const headers = [
    'Student Name', 'Tutoring Group', 'Benchmark',
    'Primary Gap Area', 'Mastery %',
    'Recommended Instructional Focus', 'Priority'
  ];
  writeHeaderRow_(out, row, headers, 7);
  row++;
  
  const dataStartRow = row;
  
  for (const student of tutoringStudents) {
    const sd = skillsData[student.name];
    const gs = gradeSummary[student.name];
    if (!sd || !gs) continue;
    
    let lowestSkill = null;
    let lowestPct = 999;
    const gapSkills = [];
    
    for (const skill of MT_CONFIG.SKILL_SECTIONS) {
      const pct = sd[skill];
      if (pct != null) {
        if (pct < lowestPct) { lowestPct = pct; lowestSkill = skill; }
        if (pct < MT_CONFIG.GAP_THRESHOLD) { gapSkills.push({ skill, pct }); }
      }
    }
    
    if (gapSkills.length === 0) continue;
    
    const recommendation = generateRecommendation_(lowestSkill, lowestPct, gs.benchmarkStatus, gapSkills);
    const priority = gs.benchmarkStatus === 'Intervention' ? 'HIGH' :
                     gs.benchmarkStatus === 'Needs Support' ? 'MEDIUM' : 'LOW';
    
    out.getRange(row, 1, 1, 7).setValues([[
      student.name,
      student.tutoringGroup,
      gs.benchmarkStatus,
      lowestSkill,
      lowestPct + '%',
      recommendation,
      priority
    ]]).setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10).setWrap(true);
    
    if ((row - dataStartRow) % 2 === 1) {
      out.getRange(row, 1, 1, 7).setBackground(MT_CONFIG.ALT_ROW);
    }
    
    const priorityCell = out.getRange(row, 7);
    if (priority === 'HIGH') priorityCell.setBackground(MT_CONFIG.CRITICAL_BG).setFontWeight('bold');
    else if (priority === 'MEDIUM') priorityCell.setBackground('#fff9c4');
    else priorityCell.setBackground(MT_CONFIG.SUCCESS_BG);
    
    row++;
  }
  
  row++;
  
  const legendRange = out.getRange(row, 1, 1, 7);
  legendRange.merge();
  legendRange.setValue(
    'Priority Key:  HIGH = Intervention status, needs intensive support  |  ' +
    'MEDIUM = Needs Support status, targeted reteaching  |  ' +
    'LOW = On Track, monitor only'
  );
  legendRange.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(9).setFontColor('#666666')
    .setBackground('#f5f5f5');
  row++;
  
  row++;
  return row;
}


/**
 * Generates a plain-language instructional recommendation
 * based on skill gap data and benchmark status.
 */
function generateRecommendation_(lowestSkill, lowestPct, benchmark, gapSkills) {
  const skillMap = {
    'Single Consonants & Vowels': 'basic letter-sound correspondence (UFLI Lessons 1-34); focus on individual phoneme isolation and CVC blending',
    'Blends': 'consonant blends (UFLI Lessons 35-41); explicit modeling of blending adjacent consonants',
    'Alphabet Review & Longer Words': 'multi-syllable word decoding and alphabet fluency (UFLI Lessons 42-44)',
    'Digraphs': 'digraph recognition (sh, ch, th, wh, ph — UFLI Lessons 45-53); use phoneme cards for discrimination practice',
    'VCE': 'vowel-consonant-e patterns (UFLI Lessons 54-62); contrast short vs long vowel pairs with word sorts',
    'Reading Longer Words': 'multisyllabic word strategies (UFLI Lessons 63-65); teach syllable division rules',
    'Ending Spelling Patterns': 'ending patterns (-tch, -dge, -le, etc. — UFLI Lessons 66-76); rule-based spelling instruction',
    'R-Controlled Vowels': 'r-controlled vowel sounds (ar, or, er, ir, ur — UFLI Lessons 77-83); use minimal pairs for discrimination',
    'Long Vowel Teams': 'long vowel team patterns (ai, ee, oa, ie — UFLI Lessons 84-88); word sort activities by pattern',
    'Other Vowel Teams': 'less common vowel teams (oo, ew, au — UFLI Lessons 89-92); teach within connected text',
    'Diphthongs': 'diphthong patterns (oi/oy, ou/ow — UFLI Lessons 93-97); use dictation and word chains',
    'Silent Letters': 'silent letter patterns (kn, wr, mb — UFLI Lesson 98); morphological awareness approach',
    'Suffixes & Prefixes': 'affix instruction (un-, re-, -ly, -ful — UFLI Lessons 99-106); teach morpheme meaning and spelling',
    'Suffix Spelling Changes': 'suffix spelling rules (doubling, drop-e, y-to-i — UFLI Lessons 107-110); rule-based practice with word building',
    'Low Frequency Spellings': 'uncommon spelling patterns (UFLI Lessons 111-118); increase exposure through reading and dictation',
    'Additional Affixes': 'advanced affixes (-tion, -ture, -able — UFLI Lessons 119-128); morphological analysis with connected text'
  };
  
  let rec = skillMap[lowestSkill] || `targeted reteaching of ${lowestSkill} patterns`;
  
  if (benchmark === 'Intervention') {
    rec = `INTENSIVE: Daily reteach of ${rec}`;
    if (gapSkills.length > 8) {
      rec += '. Multiple foundational gaps suggest starting with systematic phonics review from the student\'s earliest gap area.';
    }
  } else if (benchmark === 'Needs Support') {
    rec = `TARGETED: Small-group reteach of ${rec}`;
  }
  
  return rec;
}


// ═══════════════════════════════════════════════════════
//  UTILITY / FORMATTING HELPERS
// ═══════════════════════════════════════════════════════

function writeSectionHeader_(out, row, title, subtitle) {
  const titleRange = out.getRange(row, 1, 1, 10);
  titleRange.merge();
  titleRange.setValue(title);
  titleRange.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(13).setFontWeight('bold')
    .setFontColor('#1a237e').setBackground(MT_CONFIG.SECTION_BG);
  out.setRowHeight(row, 30);
  row++;
  
  if (subtitle) {
    const subRange = out.getRange(row, 1, 1, 10);
    subRange.merge();
    subRange.setValue(subtitle);
    subRange.setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(9).setFontColor('#666666')
      .setBackground('#f5f5f5').setWrap(true);
    row++;
  }
  
  return row;
}


function writeHeaderRow_(out, row, headers, numCols) {
  out.getRange(row, 1, 1, numCols).setValues([headers])
    .setFontFamily(MT_CONFIG.FONT_FAMILY).setFontSize(10).setFontWeight('bold')
    .setFontColor(MT_CONFIG.HEADER_FONT).setBackground(MT_CONFIG.HEADER_BG)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true);
  out.setRowHeight(row, 35);
  
  for (let c = 1; c <= numCols; c++) {
    const w = c === 1 ? 180 : c === numCols ? 200 : 130;
    if (out.getColumnWidth(c) < w) out.setColumnWidth(c, w);
  }
}


function parseNum_(val) {
  if (val == null || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}


/**
 * Safely converts a value to a Date object.
 * Handles Date objects, date strings, and timestamps.
 */
function toDate_(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
