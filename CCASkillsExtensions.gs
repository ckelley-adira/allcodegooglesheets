// ═══════════════════════════════════════════════════════════════════════════
// CCA SKILLS EXTENSIONS
// School: Citizens of the World Charter Schools (CCA)
// ═══════════════════════════════════════════════════════════════════════════
//
// PURPOSE:
// This file contains CCA-specific skill analytics functions that extend the
// unified Phase2_ProgressTracking_Unified.gs system. These functions provide
// advanced metrics and visualizations for tracking student progress across
// foundational, minimum grade-level, and full grade-level skills.
//
// EXTENDS:
// Phase2_ProgressTracking_Unified.gs - Core progress tracking system
//
// FEATURE FLAGS:
// - skillAveragesAnalytics: Enables skill-based performance analytics
//
// DEPENDENCIES:
// - Skills Tracker sheet: Source data for skill-based metrics
// - Grade Summary sheet: Student roster and grade information
// - School Summary sheet: Dashboard rendering location
//
// FUNCTIONS:
// 1. buildStudentLookups(mapSheet) - CCA override for historical compatibility
//    (unified version in Phase2_ProgressTracking_Unified.gs has identical functionality)
// 2. calculateSkillAverages(students) - Skill-based performance analytics
// 3. renderSkillAveragesRow(sheet, row, skills, grade, pace) - Dashboard visualization
//
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Builds lookup maps for student counts and teachers by group.
 * CCA-SPECIFIC OVERRIDE: This is a custom version maintained for CCA.
 * 
 * NOTE: The unified version in Phase2_ProgressTracking_Unified.gs also supports
 * the mapSheet parameter with identical functionality. CCA maintains this override
 * for historical compatibility and to allow future CCA-specific customizations
 * without affecting the unified codebase.
 * 
 * @param {Sheet} mapSheet - The UFLI MAP sheet
 * @returns {Object} { studentCountByGroup: Map, teacherByGroup: Map }
 */
function buildStudentLookups(mapSheet) {
  const studentCountByGroup = new Map();
  const teacherByGroup = new Map();
  const lastRow = mapSheet.getLastRow();
  if (lastRow < LAYOUT.DATA_START_ROW) return { studentCountByGroup, teacherByGroup };
  const data = mapSheet.getRange(LAYOUT.DATA_START_ROW, 1, lastRow - LAYOUT.DATA_START_ROW + 1, 4).getValues();
  data.forEach(row => {
    if (!row[0] || !row[3]) return;
    const groupKey = row[3].toString().trim();
    studentCountByGroup.set(groupKey, (studentCountByGroup.get(groupKey) || 0) + 1);
    if (row[2]) teacherByGroup.set(groupKey, row[2]);
  });
  return { studentCountByGroup, teacherByGroup };
}

/**
 * Calculates skill-based performance averages for a cohort of students.
 * 
 * Computes both current and initial metrics for three skill tiers:
 * - Foundational Skills: Basic phonics (first 4 skill sections)
 * - Min Grade Skills: Core grade-level skills (first 8 skill sections)
 * - Full Grade Skills: Complete grade-level mastery (all skill sections)
 * 
 * For grades where all metrics use the same lessons (PreK, KG), ensures
 * consistency by using foundational initial values across all tiers.
 * 
 * @param {Array<Array>} students - Array of student data rows from Skills Tracker
 * @returns {Object} Skill averages with initial, current, and growth for each tier
 */
function calculateSkillAverages(students) {
  // Sums for Current values (from main metric columns)
  let foundCurrSum = 0, minCurrSum = 0, fullCurrSum = 0;
  // Sums for Initial values (from detailed skill section columns)
  let foundInitSum = 0, minInitSum = 0, fullInitSum = 0;
  let count = 0;

  students.forEach(s => {
    const foundCurrent = parseFloat(s[4]) || 0;
    const minCurrent = parseFloat(s[5]) || 0;
    const fullCurrent = parseFloat(s[6]) || 0;

    // Initial values from detailed skill section columns
    // Columns 8, 11, 14, 17... are Initial % for each skill section
    // Foundational: First 4 skill sections (8, 11, 14, 17) - Basic phonics
    // Min Grade: First 8 sections (8, 11, 14, 17, 20, 23, 26, 29)
    // Full Grade: All skill sections
    let foundInitials = [], minInitials = [], fullInitials = [];

    // Extract Initial values from columns 8, 11, 14, 17, 20, 23... (every 3rd starting at 8)
    for (let col = 8; col < s.length; col += 3) {
      const initVal = parseFloat(s[col]);
      if (!isNaN(initVal)) {
        fullInitials.push(initVal);
        if (fullInitials.length <= 8) minInitials.push(initVal);
        if (fullInitials.length <= 4) foundInitials.push(initVal);
      }
    }

    // Calculate averages of Initial values
    const foundInit = foundInitials.length > 0 ? foundInitials.reduce((a, b) => a + b, 0) / foundInitials.length : 0;
    const minInit = minInitials.length > 0 ? minInitials.reduce((a, b) => a + b, 0) / minInitials.length : 0;
    const fullInit = fullInitials.length > 0 ? fullInitials.reduce((a, b) => a + b, 0) / fullInitials.length : 0;

    foundCurrSum += foundCurrent;
    minCurrSum += minCurrent;
    fullCurrSum += fullCurrent;
    foundInitSum += foundInit;
    minInitSum += minInit;
    fullInitSum += fullInit;
    count++;
  });

  let foundCurr = count > 0 ? Math.round(foundCurrSum / count) : 0;
  let minCurr = count > 0 ? Math.round(minCurrSum / count) : 0;
  let fullCurr = count > 0 ? Math.round(fullCurrSum / count) : 0;
  let foundInit = count > 0 ? Math.round(foundInitSum / count) : 0;
  let minInit = count > 0 ? Math.round(minInitSum / count) : 0;
  let fullInit = count > 0 ? Math.round(fullInitSum / count) : 0;

  // For grades where all three metrics use the same lessons (KG, PreK),
  // the Current values will be identical. Use consistent Initial values too.
  if (foundCurr === minCurr && minCurr === fullCurr) {
    // Use foundational Initial for all three to ensure consistency
    minInit = foundInit;
    fullInit = foundInit;
  }

  return {
    foundational: { initial: foundInit, current: foundCurr, growth: foundCurr - foundInit },
    minGrade: { initial: minInit, current: minCurr, growth: minCurr - minInit },
    fullGrade: { initial: fullInit, current: fullCurr, growth: fullCurr - fullInit },
    // Keep legacy format for backward compatibility
    foundationalAvg: foundCurr,
    minGradeAvg: minCurr,
    fullGradeAvg: fullCurr
  };
}

/**
 * Renders skill averages visualization on the dashboard.
 * 
 * PreK Format: Single-row display with current percentages for:
 * - Motor (Form)
 * - Literacy (Name+Sound)
 * - K-Readiness (All)
 * 
 * K-8 Format: Table with Initial, Current, Growth, and Sequential Pacing:
 * - Foundational Skills
 * - Min Grade Skills
 * - Full Grade Skills
 * 
 * Color-coding:
 * - Green (bold): On track (≥80% or growth >5%)
 * - Red (bold): At risk (<50% or negative growth)
 * 
 * @param {Sheet} sheet - The dashboard sheet to render to
 * @param {number} row - Starting row number
 * @param {Object} skills - Skill averages from calculateSkillAverages()
 * @param {string} grade - Grade level (PreK, KG, G1-G8)
 * @param {Object} pace - Pacing data with pacing percentage
 * @returns {number} Next available row number after rendering
 */
function renderSkillAveragesRow(sheet, row, skills, grade, pace) {
  const isPreK = grade === "PreK";

  if (isPreK) {
    // --- PreK Format: Single row with current values ---
    sheet.getRange(row, 1).setValue("📝 HWT Skill Averages")
      .setFontWeight("bold")
      .setFontSize(11)
      .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
    row++;

    const headers = ["Motor (Form)", "Literacy (Name+Sound)", "K-Readiness (All)", "", ""];
    sheet.getRange(row, 1, 1, 5).setValues([headers])
      .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
      .setFontWeight("bold")
      .setFontSize(10)
      .setHorizontalAlignment("center");
    sheet.setRowHeight(row, 28);
    row++;

    const values = [
      skills.foundationalAvg / 100,
      skills.minGradeAvg / 100,
      skills.fullGradeAvg / 100,
      "", ""
    ];
    sheet.getRange(row, 1, 1, 5).setValues([values])
      .setHorizontalAlignment("center")
      .setFontSize(11);
    sheet.getRange(row, 1, 1, 3).setNumberFormat("0%");

    // Color-code
    [skills.foundationalAvg, skills.minGradeAvg, skills.fullGradeAvg].forEach((val, i) => {
      const cell = sheet.getRange(row, i + 1);
      if (val >= 80) cell.setFontColor(DASHBOARD_COLORS.ON_TRACK).setFontWeight("bold");
      else if (val < 50) cell.setFontColor(DASHBOARD_COLORS.AT_RISK).setFontWeight("bold");
    });

    sheet.setRowHeight(row, 30);
    row++;

  } else {
    // --- K-8 Format: Table with Metric/Initial/Current/Growth/Pacing ---
    sheet.getRange(row, 1).setValue("📈 Growth & Pacing")
      .setFontWeight("bold")
      .setFontSize(11)
      .setFontColor(DASHBOARD_COLORS.SECTION_LABEL);
    row++;

    // Headers
    const headers = ["Metric", "Initial", "Current", "Growth", "Seq. Pacing"];
    sheet.getRange(row, 1, 1, 5).setValues([headers])
      .setBackground(DASHBOARD_COLORS.TABLE_HEADER_BG)
      .setFontWeight("bold")
      .setFontSize(10)
      .setHorizontalAlignment("center");
    sheet.setRowHeight(row, 28);
    row++;

    // Data rows - Pacing only on first row, will merge cells below
    const pacing = pace ? pace.pacing / 100 : 0;
    const tableData = [
      ["Foundational Skills", skills.foundational.initial / 100, skills.foundational.current / 100,
       (skills.foundational.growth >= 0 ? "+" : "") + skills.foundational.growth + "%", ""],
      ["Min Grade Skills", skills.minGrade.initial / 100, skills.minGrade.current / 100,
       (skills.minGrade.growth >= 0 ? "+" : "") + skills.minGrade.growth + "%", ""],
      ["Full Grade Skills", skills.fullGrade.initial / 100, skills.fullGrade.current / 100,
       (skills.fullGrade.growth >= 0 ? "+" : "") + skills.fullGrade.growth + "%", ""]
    ];

    sheet.getRange(row, 1, 3, 5).setValues(tableData)
      .setFontSize(10)
      .setVerticalAlignment("middle");

    // Format columns
    sheet.getRange(row, 2, 3, 2).setNumberFormat("0%");  // Initial & Current as %
    sheet.getRange(row, 2, 3, 4).setHorizontalAlignment("center");

    // Merge Pacing column cells and add labeled pacing value
    const pacingRange = sheet.getRange(row, 5, 3, 1);
    pacingRange.merge()
      .setValue(pacing)
      .setNumberFormat("0%")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle")
      .setFontSize(14)
      .setFontWeight("bold");

    // Color-code growth values
    for (let i = 0; i < 3; i++) {
      const growthCell = sheet.getRange(row + i, 4);
      const growth = [skills.foundational.growth, skills.minGrade.growth, skills.fullGrade.growth][i];
      if (growth > 5) {
        growthCell.setFontColor(DASHBOARD_COLORS.ON_TRACK).setFontWeight("bold");
      } else if (growth < 0) {
        growthCell.setFontColor(DASHBOARD_COLORS.AT_RISK).setFontWeight("bold");
      }
    }

    // Alternating row colors
    sheet.getRange(row + 1, 1, 1, 5).setBackground(DASHBOARD_COLORS.TABLE_ALT_ROW);

    for (let i = 0; i < 3; i++) {
      sheet.setRowHeight(row + i, 26);
    }
    row += 3;
  }

  // Spacer
  sheet.setRowHeight(row, 12);
  row++;

  return row;
}
