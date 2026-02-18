// ═══════════════════════════════════════════════════════════════════════════
// Adira Reads Progress Report - SETUP WIZARD (PHASE 1)
// Configuration, Student/Group Management, Reports, and Web App
// ═══════════════════════════════════════════════════════════════════════════
// Version: 3.2 - BATCH WRITE OPTIMIZATIONS
// Last Updated: January 2026
//
// ARCHITECTURE:
// - This file owns: Config constants, menu, wizard, manage UI, reports, web app
// - SystemSheets_v4.gs owns: System constants, sheet generation, sync, pacing
//
// CHANGES FROM v3.1:
// - OPTIMIZED: updateGroupSheetTargeted() - now uses single batch setValues()
// - OPTIMIZED: updateUFLIMapTargeted() - now uses single batch setValues()
// - OPTIMIZED: saveLessonData() PreK section - now uses single batch setValues()
// - Performance improvement: ~90% faster form submissions
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL CONSTANTS - CONFIGURATION SHEETS
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM_VERSION = "3.2";

/**
 * Sheet names for CONFIGURATION sheets (wizard-created)
 * NOTE: System/tracking sheet names are in SystemSheets_v4.gs (SHEET_NAMES_V2)
 */
var SHEET_NAMES = {
  CONFIG: "Site Configuration",
  STUDENT_ROSTER: "Student Roster",
  TEACHER_ROSTER: "Teacher Roster",
  GROUP_CONFIG: "Group Configuration",
  FEATURES: "Feature Settings"
};

/**
 * Grade level options for the system
 */
const GRADE_OPTIONS = [
  { value: "PreK", label: "Pre-K" },
  { value: "KG", label: "Kindergarten" },
  { value: "G1", label: "1st Grade" },
  { value: "G2", label: "2nd Grade" },
  { value: "G3", label: "3rd Grade" },
  { value: "G4", label: "4th Grade" },
  { value: "G5", label: "5th Grade" },
  { value: "G6", label: "6th Grade" },
  { value: "G7", label: "7th Grade" },
  { value: "G8", label: "8th Grade" }
];

/**
 * Optional feature toggles
 */
const FEATURE_OPTIONS = [
  { id: "tutorTracking", name: "Tutor Tracking", description: "Track which tutors work with which students" },
  { id: "parentReports", name: "Parent Reports", description: "Generate parent-friendly progress reports" },
  { id: "pacingSheets", name: "Pacing Sheets", description: "Monitor group pacing against curriculum schedule" },
  { id: "mondayIntegration", name: "Monday.com Integration", description: "Export data to Monday.com workflow" },
  { id: "exceptionReports", name: "Exception Reports", description: "Flag students who need attention" }
];

/**
 * Recommended students per group
 */
const RECOMMENDED_GROUP_SIZE = {
  min: 4,
  max: 10,
  ideal: 6
};

/**
 * Centralized sheet layout configuration
 * Eliminates hardcoded row/column numbers throughout the codebase
 */
const CONFIG_LAYOUT = {
  SITE_CONFIG: {
    SCHOOL_NAME_ROW: 2,
    GRADES_START_ROW: 5,
    GRADE_MIXING_ROW: 17,
    COMBINATIONS_ROW: 18,
    VERSION_ROW: 20,
    LAST_UPDATED_ROW: 21
  },
  ROSTER: {
    TITLE_ROW: 1,
    INSTRUCTIONS_ROW: 2,
    HEADER_ROW: 4,
    DATA_START_ROW: 6
  },
  COLS: {
    LABEL: 1,
    VALUE: 2
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS - SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Standardized logging with function name prefix
 * @param {string} functionName - Name of the calling function
 * @param {string} message - Log message
 * @param {string} [level='INFO'] - Log level (INFO, WARN, ERROR)
 */
function logMessage(functionName, message, level = 'INFO') {
  Logger.log(`[${level}] [${functionName}] ${message}`);
}

/**
 * Gets timezone-safe formatted date string
 * @param {Date} date - Date to format
 * @param {string} format - Format string (e.g., "yyyy-MM-dd HH:mm")
 * @returns {string} Formatted date string
 */
function formatDateSafe(date, format) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timeZone = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  return Utilities.formatDate(date, timeZone, format);
}

/**
 * Creates a standardized result object for function returns
 * @param {boolean} success - Whether operation succeeded
 * @param {string} message - Result message
 * @param {*} [data] - Optional data payload
 * @returns {Object} Standardized result object
 */
function createResult(success, message, data = null) {
  const result = { success, message };
  if (data !== null) {
    result.data = data;
  }
  return result;
}

/**
 * Validates that required properties exist on an object
 * @param {Object} obj - Object to validate
 * @param {Array<string>} requiredProps - Array of required property names
 * @returns {Object} Validation result {valid: boolean, missing: string[]}
 */
function validateRequiredProps(obj, requiredProps) {
  const missing = requiredProps.filter(prop => {
    const value = obj[prop];
    return value === undefined || value === null || 
           (typeof value === 'string' && value.trim() === '');
  });
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Finds the teacher for a specific group using UFLI MAP data
 * This is the SINGLE source of truth for teacher lookups
 * @param {string} groupName - Group name to look up
 * @returns {string} Teacher name or "Unknown Teacher"
 */
function getTeacherForGroup(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const grade = groupName.split(' ')[0];
  
  if (grade === "PreK") {
    const sheet = ss.getSheetByName(SHEET_NAMES_PREK.DATA);
    if (!sheet) return "";
    const data = sheet.getDataRange().getValues();
    for (let i = PREK_CONFIG.DATA_START_ROW - 1; i < data.length; i++) {
      if (data[i][3] === groupName) return data[i][2];
    }
  } else {
    const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);
    if (!mapSheet) return "";
    const data = mapSheet.getDataRange().getValues();
    for (let i = LAYOUT.DATA_START_ROW - 1; i < data.length; i++) {
      if (data[i][3] === groupName) return data[i][2];
    }
  }
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════
// MENU INTEGRATION (CLEANED UP v3.1)
// ═══════════════════════════════════════════════════════════════════════════

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  
  // 1. Unconfigured State (Setup Wizard Only)
  if (!configSheet || !isSystemConfigured()) {
    ui.createMenu('Adira Reads Progress Report')
      .addItem('🚀 Start Setup Wizard', 'startSetupWizard')
      .addToUi();
    return;
  }
  
  // 2. Configured State (Full Menu)
  ui.createMenu('Adira Reads Progress Report')
    // === PRIMARY ACTIONS (Daily Use) ===
    .addItem('📊 View School Summary', 'goToSchoolSummary')
    .addItem('📈 Generate Reports', 'generateReports')
    .addSeparator()
    
    // === MANAGEMENT (Weekly Use) ===
    .addItem('👥 Manage Students', 'manageStudents')
    .addItem('👨‍🏫 Manage Groups', 'manageGroups')
    .addSeparator()

    // === SYNC & PERFORMANCE (The New Workflow) ===
    .addSubMenu(ui.createMenu('🔄 Sync & Performance')
      .addItem('⚡ Recalculate All Stats Now', 'recalculateAllStatsNow') // The only manual sync they need
      .addSeparator()
      .addItem('✅ Enable Nightly Sync', 'setupNightlySyncTrigger')
      .addItem('❌ Disable Nightly Sync', 'removeNightlySyncTrigger')
      .addItem('ℹ️ Check Sync Status', 'showTriggerStatus'))

    // === COACH TOOLS ===
    .addSubMenu(ui.createMenu('🎯 Coach Tools')
      .addItem('👁️ Coach View', 'openCoachView')
      .addItem('🔄 Refresh Coach View', 'refreshCoachView')
      .addItem('⚡ Enable Coach View Auto-Refresh', 'setupCoachViewTrigger')
      .addSeparator()
      .addItem('📊 Weekly Coaching Dashboard', 'openWeeklyDashboard')
      .addSeparator()
      .addItem('📋 Student History', 'openStudentHistory')
      .addItem('📈 Capture Weekly Growth', 'captureWeeklyGrowth')
      .addItem('⏰ Enable Weekly Auto-Capture', 'setupWeeklyGrowthTrigger'))

    // === TUTORING (Optional Module) ===
    .addSubMenu(ui.createMenu('📚 Tutoring')
      .addItem('📋 View Tutoring Summary', 'goToTutoringSummary')
      .addItem('📝 View Tutoring Log', 'goToTutoringLog')
      .addSeparator()
      .addItem('🔄 Sync Tutoring Data', 'syncTutoringProgress'))
    
    // === ADMIN & MAINTENANCE (Consolidated) ===
    .addSubMenu(ui.createMenu('🛠️ Admin Tools')
      // Import
      .addItem('📂 Import Data...', 'showImportDialog')
      .addItem('✅ Validate Import', 'validateImportData')
      .addSeparator()
      // Unenrollment
      .addItem('📦 Manual Archive Student', 'manualArchiveStudent')
      .addItem('📄 View Archive', 'goToArchiveSheet')
      .addSeparator()
      // Repairs (Only the essential ones)
      .addItem('🔧 Repair All Formulas', 'repairAllFormulas')
      .addItem('⚠️ Fix Missing Teachers', 'fixMissingTeachers')
      .addItem('🎨 Repair Formatting', 'repairUFLIMapFormatting'))
    
    .addSeparator()
    
    // === SETTINGS ===
    .addItem('⚙️ System Settings', 'openSettings')
    .addItem('🔄 Re-run Setup Wizard', 'startSetupWizard')
    .addToUi();
}

/**
 * Checks if the system has been configured
 * @returns {boolean} True if configured
 */
function isSystemConfigured() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  
  if (!configSheet) return false;
  
  const schoolName = configSheet.getRange(2, 2).getValue();
  return schoolName && schoolName.toString().trim() !== "";
}

// ═══════════════════════════════════════════════════════════════════════════
// WEB APP (LESSON ENTRY FORM) - ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serves the standalone web app HTML
 * @param {Object} e - Event object from web request
 * @returns {HtmlOutput} HTML page
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('LessonEntryForm')
    .setTitle('UFLI Lesson Data Entry')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP WIZARD - MAIN LAUNCHER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Opens the setup wizard modal dialog
 */
function startSetupWizard() {
  const html = HtmlService.createHtmlOutputFromFile('SetupWizardUI')
    .setWidth(900)
    .setHeight(700)
    .setTitle('Adira Reads Progress Report Setup Wizard');
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Setup Wizard');
}

/**
 * Opens settings (alias for setup wizard)
 */
function openSettings() {
  startSetupWizard();
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP WIZARD - DATA HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets all wizard configuration data from sheets
 * @returns {Object} Complete wizard data object
 */
function getWizardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  
  if (!configSheet) {
    return {
      schoolName: "",
      gradesServed: [],
      students: [],
      teachers: [],
      groups: [],
      gradeMixing: {
        allowed: false,
        combinations: []
      },
      features: {}
    };
  }
  
  return {
    schoolName: configSheet.getRange(CONFIG_LAYOUT.SITE_CONFIG.SCHOOL_NAME_ROW, CONFIG_LAYOUT.COLS.VALUE).getValue() || "",
    gradesServed: getExistingGrades(configSheet),
    students: getExistingStudents(),
    teachers: getExistingTeachers(),
    groups: getExistingGroups(),
    gradeMixing: getExistingGradeMixing(configSheet),
    features: getExistingFeatures()
  };
}

/**
 * Gets existing grade selections from config sheet
 * @param {Sheet} configSheet - Site Configuration sheet
 * @returns {Array<string>} Array of grade values
 */
// getExistingGrades: canonical version in Phase2_ProgressTracking.gs

/**
 * Gets existing students from roster sheet
 * @returns {Array<Object>} Array of student objects
 */
function getExistingStudents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterSheet = ss.getSheetByName(SHEET_NAMES.STUDENT_ROSTER);
  
  if (!rosterSheet || rosterSheet.getLastRow() < LAYOUT.DATA_START_ROW) {
    return [];
  }
  
  const data = rosterSheet.getRange(LAYOUT.DATA_START_ROW, 1, 
    rosterSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 4).getValues();
  return data
    .filter(row => row[0])
    .map(row => ({
      name: row[0] ? row[0].toString().trim() : "",
      grade: row[1] ? row[1].toString().trim() : "",
      teacher: row[2] ? row[2].toString().trim() : "",
      group: row[3] ? row[3].toString().trim() : ""
    }));
}

/**
 * Gets existing teachers from roster sheet
 * @returns {Array<Object>} Array of teacher objects
 */
function getExistingTeachers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const teacherSheet = ss.getSheetByName(SHEET_NAMES.TEACHER_ROSTER);
  
  if (!teacherSheet || teacherSheet.getLastRow() < LAYOUT.DATA_START_ROW) {
    return [];
  }
  
  const data = teacherSheet.getRange(LAYOUT.DATA_START_ROW, 1, 
    teacherSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 2).getValues();
  return data
    .filter(row => row[0])
    .map(row => ({
      name: row[0] ? row[0].toString().trim() : "",
      grades: row[1] ? row[1].toString().split(',').map(g => g.trim()) : []
    }));
}

/**
 * Gets existing group configuration
 * @returns {Array<Object>} Array of group config objects
 */
function getExistingGroups() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupSheet = ss.getSheetByName(SHEET_NAMES.GROUP_CONFIG);
  
  if (!groupSheet || groupSheet.getLastRow() < LAYOUT.DATA_START_ROW) {
    return [];
  }
  
  const data = groupSheet.getRange(LAYOUT.DATA_START_ROW, 1, 
    groupSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 2).getValues();
  return data
    .filter(row => row[0])
    .map(row => ({
      grade: row[0] ? row[0].toString().trim() : "",
      count: parseInt(row[1]) || 1
    }));
}

/**
 * Gets existing grade mixing configuration
 * @param {Sheet} configSheet - Site Configuration sheet
 * @returns {Object} Grade mixing settings
 */
function getExistingGradeMixing(configSheet) {
  const allowed = configSheet.getRange(CONFIG_LAYOUT.SITE_CONFIG.COMBINATIONS_ROW, CONFIG_LAYOUT.COLS.VALUE).getValue();
  const combinations = configSheet.getRange(19, 2).getValue();
  
  return {
    allowed: allowed === true || allowed === "TRUE",
    combinations: combinations ? combinations.toString().split(',').map(c => c.trim()) : []
  };
}

/**
 * Gets existing feature settings
 * @returns {Object} Feature toggle states
 */
function getExistingFeatures() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const featureSheet = ss.getSheetByName(SHEET_NAMES.FEATURES);
  
  if (!featureSheet) {
    return {};
  }
  
  const features = {};
  FEATURE_OPTIONS.forEach((feature, index) => {
    const value = featureSheet.getRange(LAYOUT.DATA_START_ROW + index, 2).getValue();
    features[feature.id] = value === true || value === "TRUE";
  });
  
  return features;
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART GROUP RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculates recommended group counts based on student numbers
 * @param {Object} wizardData - Current wizard data
 * @returns {Object} Recommendations keyed by grade
 */
function calculateGroupRecommendations(wizardData) {
  const recommendations = {};
  
  (wizardData.gradesServed || []).forEach(grade => {
    const studentsInGrade = (wizardData.students || []).filter(s => s.grade === grade).length;
    
    if (studentsInGrade === 0) {
      recommendations[grade] = {
        studentCount: 0,
        recommended: 0,
        min: 0,
        max: 0,
        message: "No students in this grade"
      };
    } else {
      const idealGroups = Math.ceil(studentsInGrade / RECOMMENDED_GROUP_SIZE.ideal);
      const minGroups = Math.ceil(studentsInGrade / RECOMMENDED_GROUP_SIZE.max);
      const maxGroups = Math.ceil(studentsInGrade / RECOMMENDED_GROUP_SIZE.min);
      const avgSize = idealGroups > 0 ? Math.round(studentsInGrade / idealGroups) : 0;
      
      recommendations[grade] = {
        studentCount: studentsInGrade,
        recommended: idealGroups,
        min: minGroups,
        max: maxGroups,
        averageSize: avgSize,
        message: `${studentsInGrade} students → ${idealGroups} group${idealGroups > 1 ? 's' : ''} (${avgSize} students each)`
      };
    }
  });
  
  return recommendations;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-BALANCE STUDENT ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Automatically distributes students evenly across groups
 * @param {Object} wizardData - Current wizard data
 * @returns {Object} Updated wizard data with balanced assignments
 */
function autoBalanceStudents(wizardData) {
  const result = { ...wizardData };
  
  result.students = (result.students || []).map(s => ({ ...s, group: "" }));
  
  (wizardData.groups || []).forEach(groupConfig => {
    const grade = groupConfig.grade;
    const groupCount = groupConfig.count;

    if (!grade || !groupCount || groupCount === 0) {
      logMessage('autoBalanceStudents', `Skipping invalid group config: ${JSON.stringify(groupConfig)}`, 'WARN');
      return;
    }
    
    const studentsInGrade = result.students.filter(s => s.grade === grade && !s.group);
    
    if (studentsInGrade.length === 0) return;
    
    studentsInGrade.forEach((student, index) => {
      const groupNumber = (index % groupCount) + 1;
      const groupName = groupCount === 1 ? `${grade} Group` : `${grade} Group ${groupNumber}`;
      
      const studentIndex = result.students.findIndex(s => s.name === student.name && s.grade === student.grade);
      if (studentIndex !== -1) {
        result.students[studentIndex].group = groupName;
      }
    });
  });
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function validateStep1(data) {
  if (!data.schoolName || data.schoolName.trim() === "") {
    return createResult(false, "Please enter a school name.");
  }
  return createResult(true, "Valid");
}

function validateStep2(data) {
  if (!data.gradesServed || data.gradesServed.length === 0) {
    return createResult(false, "Please select at least one grade level.");
  }
  return createResult(true, "Valid");
}

function validateStep3(data) {
  if (!data.students || data.students.length === 0) {
    return createResult(false, "Please import at least one student.");
  }
  
  for (let i = 0; i < data.students.length; i++) {
    const student = data.students[i];
    const validation = validateRequiredProps(student, ['name', 'grade', 'teacher']);
    
    if (!validation.valid) {
      return createResult(false, 
        `Row ${i + 1}: Student is missing required information (${validation.missing.join(', ')}).`);
    }
    
    if (!data.gradesServed.includes(student.grade)) {
      return createResult(false,
        `Row ${i + 1}: Student "${student.name}" has grade "${student.grade}" which is not in your selected grades served.`);
    }
  }
  
  return createResult(true, "Valid");
}

function validateStep4(data) {
  if (!data.teachers || data.teachers.length === 0) {
    return createResult(false, "Please add at least one teacher.");
  }
  
  for (let i = 0; i < data.teachers.length; i++) {
    const teacher = data.teachers[i];
    
    if (!teacher.name || !teacher.grades || teacher.grades.length === 0) {
      return createResult(false,
        `Row ${i + 1}: Teacher is missing name or grade assignment.`);
    }
    
    for (let grade of teacher.grades) {
      if (!data.gradesServed.includes(grade)) {
        return createResult(false,
          `Teacher "${teacher.name}" is assigned to grade "${grade}" which is not in your selected grades served.`);
      }
    }
  }
  
  return createResult(true, "Valid");
}

function validateStep5(data) {
  if (!data.groups || data.groups.length === 0) {
    return createResult(false, "Please define at least one group.");
  }
  
  for (let i = 0; i < data.groups.length; i++) {
    const group = data.groups[i];
    if (!group.grade || !group.count || group.count < 1) {
      return createResult(false,
        `Row ${i + 1}: Group is missing grade or valid count.`);
    }
  }
  
  if (data.gradeMixing && data.gradeMixing.allowed) {
    if (!data.gradeMixing.combinations || data.gradeMixing.combinations.length === 0) {
      return createResult(false,
        "Grade mixing is enabled but no combinations are defined.");
    }
  }
  
  return createResult(true, "Valid");
}

function validateStep6(data) {
  return createResult(true, "Valid");
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Saves all wizard configuration and generates system sheets
 * @param {Object} wizardData - Complete wizard data object
 * @returns {Object} Result with success status and message
 */
function saveConfiguration(wizardData) {
  const functionName = 'saveConfiguration';
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const validations = [
      validateStep1(wizardData),
      validateStep2(wizardData),
      validateStep3(wizardData),
      validateStep4(wizardData),
      validateStep5(wizardData),
      validateStep6(wizardData)
    ];
    
    for (let validation of validations) {
      if (!validation.success) {
        return validation;
      }
    }
    
    logMessage(functionName, 'Validation passed, creating configuration sheets...');
    
    createConfigurationSheet(ss, wizardData);
    createStudentRosterSheet(ss, wizardData);
    createTeacherRosterSheet(ss, wizardData);
    createGroupConfigSheet(ss, wizardData);
    createFeatureSettingsSheet(ss, wizardData);
    createPacingReports(ss);
    
    logMessage(functionName, 'Configuration sheets created, generating system sheets...');
    
    const generationResult = generateSystemSheets(ss, wizardData);
    
    if (!generationResult.success) {
      throw new Error("Failed to generate system sheets: " + generationResult.error);
    }
    
    onOpen();
    
    logMessage(functionName, 'Configuration saved successfully');
    return createResult(true, 
      "Configuration saved successfully! Your Adira Reads Progress Report is ready to use.");
    
  } catch (error) {
    logMessage(functionName, `Error: ${error.toString()}`, 'ERROR');
    return createResult(false, "Error saving configuration: " + error.toString());
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION SHEET CREATION
// ═══════════════════════════════════════════════════════════════════════════

function createConfigurationSheet(ss, data) {
  let sheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.CONFIG);
  } else {
    sheet.clear();
  }
  
  sheet.getRange(1, 1, 1, 2).setValues([["Adira Reads Progress Report Configuration", ""]]);
  sheet.getRange(1, 1, 1, 2).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG).setFontWeight("bold");
  
  sheet.getRange(2, 1).setValue("School Name:");
  sheet.getRange(2, 2).setValue(data.schoolName);
  
  sheet.getRange(4, 1).setValue("Grades Served:");
  sheet.getRange(4, 1).setFontWeight("bold");
  
  GRADE_OPTIONS.forEach((grade, index) => {
    sheet.getRange(5 + index, 1).setValue(grade.label);
    sheet.getRange(5 + index, 2).setValue(data.gradesServed.includes(grade.value));
  });
  
  sheet.getRange(16, 1).setValue("Grade Mixing Settings:");
  sheet.getRange(16, 1).setFontWeight("bold");
  
  sheet.getRange(17, 1).setValue("Allow Grade Mixing:");
  sheet.getRange(17, 2).setValue(data.gradeMixing ? data.gradeMixing.allowed : false);
  
  sheet.getRange(18, 1).setValue("Mixed Grade Combinations:");
  sheet.getRange(CONFIG_LAYOUT.SITE_CONFIG.COMBINATIONS_ROW, CONFIG_LAYOUT.COLS.VALUE)
    .setValue(data.gradeMixing && data.gradeMixing.combinations ? 
      data.gradeMixing.combinations.join(', ') : "");
  
  sheet.getRange(20, 1).setValue("System Version:");
  sheet.getRange(20, 2).setValue(SYSTEM_VERSION);
  
  sheet.getRange(21, 1).setValue("Last Updated:");
  sheet.getRange(21, 2).setValue(new Date());
  
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 300);
  sheet.getRange(2, 1, 21, 2).setFontFamily("Calibri");
  
  protectSheet(sheet);
}

function createStudentRosterSheet(ss, data) {
  let sheet = ss.getSheetByName(SHEET_NAMES.STUDENT_ROSTER);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.STUDENT_ROSTER);
  } else {
    sheet.clear();
  }
  
  sheet.getRange(1, 1, 1, 4).setValues([["STUDENT ROSTER", "", "", ""]]);
  sheet.getRange(1, 1, 1, 4).merge().setBackground(COLORS.TITLE_BG).setFontColor(COLORS.TITLE_FG)
    .setFontWeight("bold").setFontSize(14);
  
  sheet.getRange(2, 1, 1, 4).setValues([["Complete roster of all students receiving UFLI intervention", "", "", ""]]);
  sheet.getRange(2, 1, 1, 4).merge().setFontFamily("Calibri").setFontSize(10).setFontStyle("italic");
  
  sheet.getRange(5, 1, 1, 4).setValues([["Student Name", "Grade", "Teacher", "Group"]]);
  sheet.getRange(5, 1, 1, 4).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG)
    .setFontWeight("bold").setFontFamily("Calibri");
  
  const students = data.students || [];
  if (students.length > 0) {
    const studentData = students.map(s => [
      s.name || "",
      s.grade || "",
      s.teacher || "",
      s.group || ""
    ]);
    sheet.getRange(LAYOUT.DATA_START_ROW, 1, studentData.length, 4).setValues(studentData);
  }
  
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 150);
  
  sheet.setFrozenRows(5);
  sheet.getRange(LAYOUT.DATA_START_ROW, 1, Math.max(1, sheet.getMaxRows() - 5), 4).setFontFamily("Calibri");
}

function createTeacherRosterSheet(ss, data) {
  let sheet = ss.getSheetByName(SHEET_NAMES.TEACHER_ROSTER);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.TEACHER_ROSTER);
  } else {
    sheet.clear();
  }
  
  sheet.getRange(1, 1, 1, 2).setValues([["TEACHER ROSTER", ""]]);
  sheet.getRange(1, 1, 1, 2).merge().setBackground(COLORS.TITLE_BG).setFontColor(COLORS.TITLE_FG)
    .setFontWeight("bold").setFontSize(14);
  
  sheet.getRange(2, 1, 1, 2).setValues([["All teachers with homeroom assignments", ""]]);
  sheet.getRange(2, 1, 1, 2).merge().setFontFamily("Calibri").setFontSize(10).setFontStyle("italic");
  
  sheet.getRange(5, 1, 1, 2).setValues([["Teacher Name", "Grade Assignment(s)"]]);
  sheet.getRange(5, 1, 1, 2).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG)
    .setFontWeight("bold").setFontFamily("Calibri");

  const teachers = data.teachers || [];
  if (teachers.length > 0) {
    const teacherData = teachers.map(t => [
      t.name || "",
      (t.grades || []).join(', ')
    ]);
    sheet.getRange(LAYOUT.DATA_START_ROW, 1, teacherData.length, 2).setValues(teacherData);
  }
  
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 200);
  
  sheet.setFrozenRows(5);
  sheet.getRange(LAYOUT.DATA_START_ROW, 1, Math.max(1, sheet.getMaxRows() - 5), 2).setFontFamily("Calibri");
}

function createGroupConfigSheet(ss, data) {
  let sheet = ss.getSheetByName(SHEET_NAMES.GROUP_CONFIG);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.GROUP_CONFIG);
  } else {
    sheet.clear();
  }
  
  sheet.getRange(1, 1, 1, 4).setValues([["", "GROUP CONFIGURATION", "", ""]]);
  sheet.getRange(1, 2, 1, 3).merge().setBackground(COLORS.TITLE_BG).setFontColor(COLORS.TITLE_FG)
    .setFontWeight("bold").setFontSize(14);
  
  sheet.getRange(2, 1, 1, 4).setValues([["", "Intervention group structure by grade level", "", ""]]);
  sheet.getRange(2, 2, 1, 3).merge().setFontFamily("Calibri").setFontSize(10).setFontStyle("italic");
  
  sheet.getRange(5, 1, 1, 4).setValues([["Group Name", "Grade", "# of Groups", "Students"]]);
  sheet.getRange(5, 1, 1, 4).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG)
    .setFontWeight("bold").setFontFamily("Calibri");
  
  const groups = data.groups || [];
  const students = data.students || [];
  
  const allGroupNames = [];
  groups.forEach(g => {
    const count = g.count || 1;
    for (let i = 1; i <= count; i++) {
      const groupName = count === 1 ? `${g.grade} Group` : `${g.grade} Group ${i}`;
      allGroupNames.push({ name: groupName, grade: g.grade });
    }
  });
  
  const configuredGroupNames = new Set(allGroupNames.map(g => g.name));
  students.forEach(s => {
    if (s.group && !configuredGroupNames.has(s.group)) {
      const grade = s.group.split(' ')[0];
      allGroupNames.push({ name: s.group, grade: grade });
      configuredGroupNames.add(s.group);
    }
  });
  
  const gradeOrder = {'PreK': 0, 'KG': 1, 'G1': 2, 'G2': 3, 'G3': 4, 'G4': 5, 'G5': 6, 'G6': 7, 'G7': 8, 'G8': 9};
  allGroupNames.sort((a, b) => {
    const orderA = gradeOrder[a.grade] !== undefined ? gradeOrder[a.grade] : 99;
    const orderB = gradeOrder[b.grade] !== undefined ? gradeOrder[b.grade] : 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'});
  });
  
  const totalStudents = students.length;
  const totalGroups = allGroupNames.length;
  
  sheet.getRange(6, 1, 1, 4).setValues([["Total Groups", "", totalGroups, totalStudents]]);
  sheet.getRange(6, 1, 1, 4).setFontWeight("bold").setBackground("#f0f0f0");
  
  if (allGroupNames.length > 0) {
    const groupData = allGroupNames.map(g => {
      const studentsInGroup = students.filter(s => s.group === g.name).length;
      return [g.name, g.grade, 1, studentsInGroup];
    });
    
    sheet.getRange(8, 1, groupData.length, 4).setValues(groupData);
    sheet.getRange(8, 1, groupData.length, 4).setFontFamily("Calibri");
  }
  
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 100);
  
  sheet.setFrozenRows(5);
}

function createFeatureSettingsSheet(ss, data) {
  let sheet = ss.getSheetByName(SHEET_NAMES.FEATURES);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.FEATURES);
  } else {
    sheet.clear();
  }
  
  sheet.getRange(1, 1, 1, 3).setValues([["FEATURE SETTINGS", "", ""]]);
  sheet.getRange(1, 1, 1, 3).merge().setBackground(COLORS.TITLE_BG).setFontColor(COLORS.TITLE_FG)
    .setFontWeight("bold").setFontSize(14);
  
  sheet.getRange(2, 1, 1, 3).setValues([["Optional features enabled for this site", "", ""]]);
  sheet.getRange(2, 1, 1, 3).merge().setFontFamily("Calibri").setFontSize(10).setFontStyle("italic");
  
  sheet.getRange(5, 1, 1, 3).setValues([["Feature", "Enabled", "Description"]]);
  sheet.getRange(5, 1, 1, 3).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG)
    .setFontWeight("bold").setFontFamily("Calibri");
  
  const features = data.features || {};
  FEATURE_OPTIONS.forEach((feature, index) => {
    sheet.getRange(LAYOUT.DATA_START_ROW + index, 1).setValue(feature.name);
    sheet.getRange(LAYOUT.DATA_START_ROW + index, 2).setValue(features[feature.id] || false);
    sheet.getRange(LAYOUT.DATA_START_ROW + index, 3).setValue(feature.description);
  });
  
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 350);
  
  sheet.setFrozenRows(5);
  sheet.getRange(LAYOUT.DATA_START_ROW, 1, FEATURE_OPTIONS.length, 3).setFontFamily("Calibri");
  
  protectSheet(sheet);
}

function protectSheet(sheet) {
  const protection = sheet.protect().setDescription('System Configuration - Protected');
  protection.setWarningOnly(true);
}

// ═══════════════════════════════════════════════════════════════════════════
// MANAGE STUDENTS - UI LAUNCHER & DATA FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function manageStudents() {
  const html = HtmlService.createHtmlOutputFromFile('ManageStudentsUI')
    .setWidth(800)
    .setHeight(600)
    .setTitle('Manage Student Roster');
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage Students');
}

function getStudentRosterData() {
  const functionName = 'getStudentRosterData';
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rosterSheet = ss.getSheetByName(SHEET_NAMES.STUDENT_ROSTER);
    
    if (!rosterSheet || rosterSheet.getLastRow() < LAYOUT.DATA_START_ROW) {
      return [];
    }
    
    const data = rosterSheet.getRange(LAYOUT.DATA_START_ROW, 1, 
      rosterSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 4).getValues();
    
    return data
      .filter(row => row[0])
      .map((row, index) => ({
        rowIndex: index + LAYOUT.DATA_START_ROW,
        name: row[0] ? row[0].toString() : "",
        grade: row[1] ? row[1].toString() : "",
        teacher: row[2] ? row[2].toString() : "",
        group: row[3] ? row[3].toString() : ""
      }));
      
  } catch (e) {
    logMessage(functionName, `Error: ${e.message}`, 'ERROR');
    throw new Error('Could not load student roster: ' + e.message);
  }
}

function saveStudent(studentObject) {
  const functionName = 'saveStudent';
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rosterSheet = ss.getSheetByName(SHEET_NAMES.STUDENT_ROSTER);
    
    const studentData = [
      studentObject.name || "",
      studentObject.grade || "",
      studentObject.teacher || "",
      studentObject.group || ""
    ];
    
    if (studentObject.rowIndex) {
      const row = studentObject.rowIndex;
      rosterSheet.getRange(row, 1, 1, 4).setValues([studentData]);
      
      const originalName = studentObject.originalName || studentObject.name;
      updateStudentInSheet(ss, SHEET_NAMES_V2.UFLI_MAP, originalName, studentData);
      updateStudentInSheet(ss, SHEET_NAMES_V2.SKILLS, originalName, studentData);
      updateStudentInSheet(ss, SHEET_NAMES_V2.GRADE_SUMMARY, originalName, studentData);
      
      logMessage(functionName, `Updated student: ${studentObject.name}`);
      
    } else {
      rosterSheet.appendRow(studentData);
      
      addStudentToSheet(ss, SHEET_NAMES_V2.UFLI_MAP, studentData);
      addStudentToSheet(ss, SHEET_NAMES_V2.SKILLS, studentData);
      addStudentToSheet(ss, SHEET_NAMES_V2.GRADE_SUMMARY, studentData);
      
      logMessage(functionName, `Added new student: ${studentObject.name}`);
    }
    
    createGradeGroupSheets(ss, getWizardData());
    
    return createResult(true, "Student saved successfully.");
    
  } catch (e) {
    logMessage(functionName, `Error: ${e.message}`, 'ERROR');
    return createResult(false, "Error saving student: " + e.message);
  }
}

function deleteStudent(studentObject) {
  const functionName = 'deleteStudent';
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const studentName = studentObject.name;
    
    deleteStudentFromSheet(ss, SHEET_NAMES.STUDENT_ROSTER, studentName);
    deleteStudentFromSheet(ss, SHEET_NAMES_V2.UFLI_MAP, studentName);
    deleteStudentFromSheet(ss, SHEET_NAMES_V2.SKILLS, studentName);
    deleteStudentFromSheet(ss, SHEET_NAMES_V2.GRADE_SUMMARY, studentName);
    
    createGradeGroupSheets(ss, getWizardData());
    
    logMessage(functionName, `Deleted student: ${studentName}`);
    return createResult(true, "Student deleted successfully.");
    
  } catch (e) {
    logMessage(functionName, `Error: ${e.message}`, 'ERROR');
    return createResult(false, "Error deleting student: " + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT SYNC HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function updateStudentInSheet(ss, sheetName, studentName, studentData) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < LAYOUT.DATA_START_ROW) return;
  
  const data = sheet.getRange(LAYOUT.DATA_START_ROW, 1, 
    sheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 1).getValues();
  const rowIndex = data.findIndex(row => row[0] === studentName);
  
  if (rowIndex !== -1) {
    const sheetRow = rowIndex + LAYOUT.DATA_START_ROW;
    sheet.getRange(sheetRow, 1, 1, 4).setValues([studentData]);
  }
}

function addStudentToSheet(ss, sheetName, studentData) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  
  const lastCol = sheet.getLastColumn();
  const newRow = Array(lastCol).fill("");
  
  newRow.splice(0, 4, studentData[0], studentData[1], studentData[2], studentData[3]);
  
  sheet.appendRow(newRow);
  
  const newRowIndex = sheet.getLastRow();
  
  if (sheetName === SHEET_NAMES_V2.UFLI_MAP) {
    const currentLessonFormula = buildCurrentLessonFormula(newRowIndex);
    sheet.getRange(newRowIndex, LAYOUT.COL_CURRENT_LESSON).setFormula(currentLessonFormula);
    
  } else if (sheetName === SHEET_NAMES_V2.SKILLS) {
    addSkillFormulasForRow(sheet, newRowIndex);
    
  } else if (sheetName === SHEET_NAMES_V2.GRADE_SUMMARY) {
    const studentObj = { grade: studentData[1] };
    addGradeSummaryFormulasForRow(sheet, newRowIndex, studentObj);
  }
}

function deleteStudentFromSheet(ss, sheetName, studentName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < LAYOUT.DATA_START_ROW) return;
  
  const data = sheet.getRange(LAYOUT.DATA_START_ROW, 1, 
    sheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 1).getValues();
  const rowIndex = data.findIndex(row => row[0] === studentName);
  
  if (rowIndex !== -1) {
    const sheetRow = rowIndex + LAYOUT.DATA_START_ROW;
    sheet.deleteRow(sheetRow);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MANAGE GROUPS - UI LAUNCHER & DATA FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function manageGroups() {
  const html = HtmlService.createHtmlOutputFromFile('ManageGroupsUI')
    .setWidth(600)
    .setHeight(500)
    .setTitle('Manage Group Configuration');
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage Groups');
}

function getGroupsData() {
  const functionName = 'getGroupsData';
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
    if (!configSheet) throw new Error("Site Configuration sheet not found.");
    const gradesServed = getExistingGrades(configSheet);
    
    const students = getExistingStudents();
    const studentCounts = {};
    gradesServed.forEach(grade => studentCounts[grade] = 0);
    students.forEach(s => {
      if (studentCounts[s.grade] !== undefined) {
        studentCounts[s.grade]++;
      }
    });

    const groups = getExistingGroups();
    const groupCounts = {};
    groups.forEach(g => groupCounts[g.grade] = g.count);

    const gradeLabels = GRADE_OPTIONS.reduce((acc, g) => {
      acc[g.value] = g.label;
      return acc;
    }, {});
    
    return gradesServed.map(grade => ({
      grade: grade,
      label: gradeLabels[grade] || grade,
      studentCount: studentCounts[grade] || 0,
      groupCount: groupCounts[grade] || 0
    }));

  } catch (e) {
    logMessage(functionName, `Error: ${e.message}`, 'ERROR');
    throw new Error('Could not load group data: ' + e.message);
  }
}

function saveGroups(newGroupConfig) {
  const functionName = 'saveGroups';
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const wizardData = getWizardData();
    wizardData.groups = newGroupConfig;

    createGroupConfigSheet(ss, wizardData);

    const allSheets = ss.getSheets();
    const gradeSheetRegex = /^(PreK|KG|G[1-8]) Groups$/;
    allSheets.forEach(sheet => {
      if (gradeSheetRegex.test(sheet.getName())) {
        ss.deleteSheet(sheet);
      }
    });

    createGradeGroupSheets(ss, wizardData);

    const rosterSheet = ss.getSheetByName(SHEET_NAMES.STUDENT_ROSTER);
    if (rosterSheet && rosterSheet.getLastRow() >= LAYOUT.DATA_START_ROW) {
      const rosterData = rosterSheet.getRange(LAYOUT.DATA_START_ROW, 1, 
        rosterSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 4).getValues();
      
      const validGroupNames = new Set();
      newGroupConfig.forEach(g => {
        if (g.count > 0) {
          for (let i = 1; i <= g.count; i++) {
            const groupName = g.count === 1 ? `${g.grade} Group` : `${g.grade} Group ${i}`;
            validGroupNames.add(groupName);
          }
        }
      });

      let changesMade = false;
      const updatedRosterData = rosterData.map(row => {
        const studentGroup = row[3];
        if (studentGroup && !validGroupNames.has(studentGroup)) {
          row[3] = "";
          changesMade = true;
        }
        return row;
      });

      if (changesMade) {
        rosterSheet.getRange(LAYOUT.DATA_START_ROW, 1, updatedRosterData.length, 4).setValues(updatedRosterData);
        syncStudentGroupsToTrackers(ss);
      }
    }

    logMessage(functionName, 'Groups updated successfully');
    return createResult(true, "Groups updated and sheets rebuilt.");

  } catch (e) {
    logMessage(functionName, `Error: ${e.message}`, 'ERROR');
    return createResult(false, "Error saving groups: " + e.message);
  }
}

function syncStudentGroupsToTrackers(ss) {
  const students = getExistingStudents();
  const studentMap = new Map(students.map(s => [s.name, s]));
  
  [SHEET_NAMES_V2.UFLI_MAP, SHEET_NAMES_V2.SKILLS, SHEET_NAMES_V2.GRADE_SUMMARY].forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < LAYOUT.DATA_START_ROW) return;
    
    const sheetData = sheet.getRange(LAYOUT.DATA_START_ROW, 1, 
      sheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 4).getValues();
    let changed = false;
    
    sheetData.forEach(row => {
      const studentName = row[0];
      const updatedStudent = studentMap.get(studentName);
      
      if (updatedStudent) {
        if (row[1] !== updatedStudent.grade || 
            row[2] !== updatedStudent.teacher || 
            row[3] !== updatedStudent.group) {
          row[1] = updatedStudent.grade;
          row[2] = updatedStudent.teacher;
          row[3] = updatedStudent.group;
          changed = true;
        }
      }
    });
    
    if (changed) {
      sheet.getRange(LAYOUT.DATA_START_ROW, 1, sheetData.length, 4).setValues(sheetData);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE REPORTS - UI LAUNCHER & DATA FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function generateReports() {
  const html = HtmlService.createHtmlOutputFromFile('GenerateReportsUI')
    .setWidth(700)
    .setHeight(600)
    .setTitle('Report Generator');
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Report Generator');
}

function getReportOptions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const options = {
    student: [
      { id: 'name', name: 'Student Name', sheet: 'roster', col: 1, default: true },
      { id: 'grade', name: 'Grade', sheet: 'roster', col: 2, default: true },
      { id: 'teacher', name: 'Teacher', sheet: 'roster', col: 3 },
      { id: 'group', name: 'Group', sheet: 'roster', col: 4, default: true }
    ],
    progress: [
      { id: 'currentLesson', name: 'Current Lesson #', sheet: 'map', col: 5, default: true },
      { id: 'benchmark', name: 'Benchmark Status', sheet: 'summary', col: 8, default: true },
      { id: 'foundational', name: 'Foundational Skills %', sheet: 'summary', col: 5 },
      { id: 'minGrade', name: 'Min. Grade Skills %', sheet: 'summary', col: 6 },
      { id: 'fullGrade', name: 'Full Grade Skills %', sheet: 'summary', col: 7 }
    ],
    skills: []
  };

  const skillsSheet = ss.getSheetByName(SHEET_NAMES_V2.SKILLS);
  if (skillsSheet && skillsSheet.getLastColumn() > 4) {
    const headers = skillsSheet.getRange(4, 5, 1, skillsSheet.getLastColumn() - 4).getValues()[0];
    headers.forEach((header, index) => {
      if (header) {
        options.skills.push({
          id: `skill_${index}`,
          name: header.toString(),
          sheet: 'skills',
          col: index + 5
        });
      }
    });
  }
  
  const students = getExistingStudents();
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  const grades = configSheet ? getExistingGrades(configSheet) : [];
  
  const filterOptions = {
    grades: grades.map(g => ({ 
      value: g, 
      label: GRADE_OPTIONS.find(opt => opt.value === g)?.label || g 
    })),
    groups: [...new Set(students.map(s => s.group).filter(g => g))].sort(),
    students: students.map(s => s.name).sort()
  };

  return { options, filterOptions };
}

function buildReport(selectedColumns, filters) {
  const functionName = 'buildReport';
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timestamp = formatDateSafe(new Date(), "yyyy-MM-dd HH:mm");

    const rosterSheet = ss.getSheetByName(SHEET_NAMES.STUDENT_ROSTER);
    if (!rosterSheet || rosterSheet.getLastRow() < LAYOUT.DATA_START_ROW) {
      throw new Error("Student Roster is empty.");
    }
    
    let studentRosterData = rosterSheet.getRange(LAYOUT.DATA_START_ROW, 1, 
      rosterSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 4).getValues();
    
    if (filters.grade !== 'ALL') {
      studentRosterData = studentRosterData.filter(row => row[1] === filters.grade);
    }
    if (filters.group !== 'ALL') {
      studentRosterData = studentRosterData.filter(row => row[3] === filters.group);
    }
    if (filters.student !== 'ALL') {
      studentRosterData = studentRosterData.filter(row => row[0] === filters.student);
    }
    
    if (studentRosterData.length === 0) {
      return createResult(true, "Report generated, but no students matched your filter criteria.");
    }

    const mapData = getSheetDataAsMap(ss, SHEET_NAMES_V2.UFLI_MAP);
    const skillsData = getSheetDataAsMap(ss, SHEET_NAMES_V2.SKILLS);
    const summaryData = getSheetDataAsMap(ss, SHEET_NAMES_V2.GRADE_SUMMARY);

    const reportHeaders = selectedColumns.map(col => col.name);
    const reportData = [];

    studentRosterData.forEach(studentRow => {
      const studentName = studentRow[0];
      if (!studentName) return;
      
      const reportRow = [];
      const studentMapRow = mapData.get(studentName);
      const studentSkillsRow = skillsData.get(studentName);
      const studentSummaryRow = summaryData.get(studentName);
      
      selectedColumns.forEach(col => {
        let value = "";
        try {
          switch (col.sheet) {
            case 'roster':
              value = studentRow[col.col - 1];
              break;
            case 'map':
              if (studentMapRow) value = studentMapRow[col.col - 1];
              break;
            case 'skills':
              if (studentSkillsRow) value = studentSkillsRow[col.col - 1];
              break;
            case 'summary':
              if (studentSummaryRow) value = studentSummaryRow[col.col - 1];
              break;
          }
        } catch (e) {
          logMessage(functionName, `Error getting ${col.name} for ${studentName}: ${e.message}`, 'WARN');
          value = "#ERROR";
        }
        reportRow.push(value !== undefined && value !== null ? value : "");
      });
      reportData.push(reportRow);
    });

    const reportSheetName = `Report - ${timestamp}`;
    const reportSheet = ss.insertSheet(reportSheetName);
    
    reportSheet.appendRow(reportHeaders);
    if (reportData.length > 0) {
      reportSheet.getRange(2, 1, reportData.length, reportData[0].length).setValues(reportData);
    }
    
    reportSheet.getRange(1, 1, 1, reportHeaders.length)
      .setFontWeight("bold")
      .setBackground(COLORS.HEADER_BG)
      .setFontColor(COLORS.HEADER_FG);
    reportSheet.setFrozenRows(1);
    reportSheet.autoResizeColumns(1, reportHeaders.length);

    ss.setActiveSheet(reportSheet);
    
    logMessage(functionName, `Report created: ${reportSheetName}`);
    return createResult(true, `Report "${reportSheetName}" generated successfully!`);
    
  } catch (e) {
    logMessage(functionName, `Error: ${e.message}`, 'ERROR');
    return createResult(false, "Error building report: " + e.message);
  }
}

// getSheetDataAsMap: canonical version in Phase2_ProgressTracking.gs

// ═══════════════════════════════════════════════════════════════════════════
// WEB APP (LESSON ENTRY FORM) - DATA FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getGroupsForForm() {
  return getGroupsForForm_MixedGrade();
}

function getLessonsAndStudentsForGroup(groupName) {
  return getLessonsAndStudentsForGroup_MixedGrade(groupName);
}

function getLessonsForGrade(grade) {
  let lessonRange = [];
  
  if (grade === "KG") lessonRange = {start: 1, end: 34};
  else if (grade === "G1") lessonRange = {start: 35, end: 68};
  else if (grade === "G2") lessonRange = {start: 69, end: 128};
  else lessonRange = {start: 1, end: 128};

  const lessons = [];
  for (let i = lessonRange.start; i <= lessonRange.end; i++) {
    let label = `Lesson ${i}`;
    try {
      if (typeof LESSON_LABELS !== 'undefined' && LESSON_LABELS[i]) {
        label = LESSON_LABELS[i];
      }
    } catch(e) {
      label = `UFLI Lesson ${i}`;
    }
    
    lessons.push({
      id: i,
      name: label
    });
  }
  return lessons;
}

/**
 * Gets existing Y/N/A/U data for a specific lesson
 * @param {string} gradeSheet - The sheet name
 * @param {string} groupName - The group name
 * @param {string} lessonName - The lesson name
 * @returns {Object} Map of studentName -> Y/N/A/U value
 */
function getExistingLessonData(gradeSheet, groupName, lessonName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(gradeSheet);

  if (!sheet) {
    Logger.log("getExistingLessonData: Sheet not found: " + gradeSheet);
    return {};
  }

  const data = sheet.getDataRange().getValues();
  const existingData = {};
  let inTargetGroup = false;
  let lessonColIndex = -1;
  let foundLessonRow = false;

  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";

    if (cellA.includes("Group") && !cellA.includes("Student")) {
      if (cellA === groupName) {
        inTargetGroup = true;
        foundLessonRow = false;
        lessonColIndex = -1;
      } else if (inTargetGroup) {
        break;
      }
      continue;
    }

    if (cellA === "Student Name") continue;

    if (inTargetGroup && !foundLessonRow) {
      if (data[i][1]) {
        for (let col = 1; col < data[i].length; col++) {
          const colLessonName = data[i][col] ? data[i][col].toString().trim() : "";
          if (colLessonName === lessonName) {
            lessonColIndex = col;
            break;
          }
        }
        foundLessonRow = true;
        continue;
      }
    }

    if (inTargetGroup && foundLessonRow && lessonColIndex >= 0 && cellA && cellA !== "(No students assigned)") {
      const studentName = cellA;
      const value = data[i][lessonColIndex] ? data[i][lessonColIndex].toString().trim().toUpperCase() : "";
      if (value === "Y" || value === "N" || value === "A" || value === "U") {
        existingData[studentName] = value;
      }
    }
  }

  Logger.log("getExistingLessonData: Found " + Object.keys(existingData).length + " existing entries for " + lessonName + " in " + groupName);
  return existingData;
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE LESSON DATA - OPTIMIZED WITH BATCH WRITES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Saves lesson data submitted by the HTML form.
 * - PreK: Direct write to Pre-K Data matrix (batch write)
 * - K-8: Fast path - logs to Small Group Progress + targeted sheet updates (batch write)
 * 
 * @param {Object} formData - Data from the lesson entry form
 * @returns {Object} {success: boolean, message: string}
 */
/**
 * Saves lesson data submitted by the HTML form.
 * OPTIMIZED: Uses targeted batch updates instead of full sync.
 */
/**
 * Saves lesson data submitted by the HTML form.
 * OPTIMIZED: Uses targeted batch updates instead of full sync.
 */
function saveLessonData(formData) {
  const functionName = 'saveLessonData';
  const startTime = new Date();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const { gradeSheet, groupName, lessonName, teacherName, studentStatuses, unenrolledStudents } = formData;

  // Co-teaching support: extract co-teaching metadata
  const isCoTeaching = formData.isCoTeaching || false;
  const partnerGroup = formData.partnerGroup || null;
  const primaryGroup = formData.primaryGroup || groupName;

  const grade = groupName.split(' ')[0];

  try {
    // ═══════════════════════════════════════════════════════════
    // PRE-K SAVE LOGIC (Unchanged)
    // ═══════════════════════════════════════════════════════════
    if (grade === "PreK") {
      const sheet = ss.getSheetByName('Pre-K Data');
      if (!sheet) throw new Error("Sheet 'Pre-K Data' not found.");

      const data = sheet.getDataRange().getValues();
      const headers = data[PREK_CONFIG.HEADER_ROW - 1];
      const colIndex = headers.indexOf(lessonName);
      if (colIndex === -1) throw new Error(`Column '${lessonName}' not found in Pre-K Data.`);

      const activeStatuses = studentStatuses.filter(s => s.status !== 'U');
      activeStatuses.forEach(entry => {
        for (let i = PREK_CONFIG.DATA_START_ROW - 1; i < data.length; i++) {
          if (data[i][0] === entry.name) {
            sheet.getRange(i + 1, colIndex + 1).setValue(entry.status);
            break;
          }
        }
      });

      if (unenrolledStudents && unenrolledStudents.length > 0) {
        logUnenrolledStudents(ss, groupName, lessonName, unenrolledStudents, new Date());
      }
      return { success: true, message: "Pre-K data saved." };
    }

    // ═══════════════════════════════════════════════════════════
    // K-8 FAST SAVE LOGIC (Optimized, with Co-Teaching Support)
    // ═══════════════════════════════════════════════════════════
    else {
      const progressSheet = ss.getSheetByName(SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
      const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);

      if (!progressSheet) throw new Error('Small Group Progress sheet not found');

      const timestamp = new Date();
      const activeStatuses = studentStatuses.filter(s => s.status !== 'U');

      if (activeStatuses.length === 0) {
        if (unenrolledStudents && unenrolledStudents.length > 0) {
          logUnenrolledStudents(ss, groupName, lessonName, unenrolledStudents, timestamp);
        }
        return { success: true, message: 'No active students to record.' };
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 1: Log to "Small Group Progress" (with Source Group for co-teaching)
      // Row layout matches COLS.SMALL_GROUP_PROGRESS:
      //   [DATE, TEACHER, GROUP, STUDENT, LESSON, STATUS, SOURCE_GROUP]
      // ═══════════════════════════════════════════════════════════
      const progressRows = activeStatuses.map(student => {
        const sourceGroup = student.sourceGroup || groupName;
        return [
          timestamp,
          teacherName || 'Unknown',
          isCoTeaching ? primaryGroup : groupName,  // Teaching group (combined)
          student.name,
          lessonName,
          student.status,
          isCoTeaching ? sourceGroup : ''  // Source Group column (Column G) for co-teaching
        ];
      });

      // Write to Small Group Progress (7 columns if co-teaching, 6 otherwise)
      const numCols = isCoTeaching ? 7 : 6;
      progressSheet.getRange(progressSheet.getLastRow() + 1, 1, progressRows.length, numCols).setValues(
        isCoTeaching ? progressRows : progressRows.map(row => row.slice(0, 6))
      );

      if (isCoTeaching) {
        Logger.log(`[${functionName}] Co-teaching mode: ${primaryGroup} + ${partnerGroup}`);
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 2: Update Group Sheet(s) - Dual write for co-teaching
      // ═══════════════════════════════════════════════════════════
      if (isCoTeaching) {
        // Group students by their source group
        const studentsByGroup = {};
        activeStatuses.forEach(student => {
          const sourceGroup = student.sourceGroup || groupName;
          if (!studentsByGroup[sourceGroup]) {
            studentsByGroup[sourceGroup] = [];
          }
          studentsByGroup[sourceGroup].push(student);
        });

        // Update each source group's sheet separately
        for (const [srcGroup, students] of Object.entries(studentsByGroup)) {
          Logger.log(`[${functionName}] Updating group sheet for: ${srcGroup} (${students.length} students)`);
          updateGroupSheetTargeted(ss, gradeSheet, srcGroup, lessonName, students);
        }
      } else {
        // Standard single-group update
        updateGroupSheetTargeted(ss, gradeSheet, groupName, lessonName, activeStatuses);
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 3: Queue UFLI MAP update via SyncQueue (deferred batch processing)
      // Uses addToSyncQueue() instead of direct updateUFLIMapTargeted() to:
      // - Reduce teacher wait time from ~16s to ~3-4s
      // - Batch updates every 30 minutes via processSyncQueue() trigger
      // ═══════════════════════════════════════════════════════════
      const lessonNum = extractLessonNumber(lessonName);
      if (lessonNum) {
        addToSyncQueue(groupName, lessonName, lessonNum, activeStatuses);
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 4: Log unenrolled
      // ═══════════════════════════════════════════════════════════
      if (unenrolledStudents && unenrolledStudents.length > 0) {
        logUnenrolledStudents(ss, groupName, lessonName, unenrolledStudents, timestamp);
      }

      const elapsed = (new Date() - startTime) / 1000;
      Logger.log(`[${functionName}] ${isCoTeaching ? 'Co-Teaching ' : ''}Fast Save Complete: ${elapsed.toFixed(2)}s`);

      return {
        success: true,
        message: isCoTeaching
          ? `Co-teaching data saved for ${primaryGroup} + ${partnerGroup} in ${elapsed.toFixed(1)}s`
          : `Saved successfully in ${elapsed.toFixed(1)}s`
      };
    }

  } catch (error) {
    Logger.log(`[${functionName}] Error: ${error.toString()}`);
    return { success: false, message: error.toString() };
  }
}
// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Update Group Sheet (Targeted - BATCH WRITE - Change 1A)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Updates only the specific group's cells in the Group Sheet
 * Uses single batch setValues() for performance
 */
/**
 * OPTIMIZED: Updates only the specific group's cells in the Group Sheet
 * Uses TextFinder and Batch Writes for speed.
 */
/**
 * OPTIMIZED: Updates only the specific group's cells in the Group Sheet
 * Uses Batch Read/Write to minimize API calls.
 */
/**
 * ROBUST: Updates only the specific group's cells in the Group Sheet.
 * Reads Column A into memory to reliably find the group, then batch updates.
 */
/**
 * ROBUST & UNIVERSAL: Updates the specific group's cells in the Group Sheet.
 * Works for both Standard (Col A) and Sankofa (Col D) layouts.
 */
function updateGroupSheetTargeted(ss, gradeSheetName, groupName, lessonName, studentStatuses) {
  const sheet = ss.getSheetByName(gradeSheetName);
  if (!sheet) return;
  
  const cleanGroupName = groupName.toString().trim().toUpperCase();
  const cleanLessonName = lessonName.toString().trim().toUpperCase();
  
  // 1. Find the Group Header (Search ALL text to support Col A or Col D layouts)
  const finder = sheet.createTextFinder(groupName).matchEntireCell(false);
  const found = finder.findNext();
  
  if (!found) {
    Logger.log('Group not found in ' + gradeSheetName + ': ' + groupName);
    return;
  }
  
  const groupStartRow = found.getRow(); 
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  // 2. Find Lesson Column (Sub-header is usually 1 or 2 rows below group header)
  // We scan the next 3 rows just to be safe
  let lessonColIdx = -1;
  let studentsStartRow = -1;

  for (let r = 1; r <= 3; r++) {
    const currentRow = groupStartRow + r;
    if (currentRow > lastRow) break;
    
    const rowValues = sheet.getRange(currentRow, 1, 1, lastCol).getValues()[0];
    
    // Check if this is the lesson header row
    for (let j = 1; j < rowValues.length; j++) {
      const val = rowValues[j] ? rowValues[j].toString().trim().toUpperCase() : "";
      if (!val) continue;

      // Match Exact Name or Lesson Number
      if (val === cleanLessonName) {
        lessonColIdx = j;
      } else {
        const hNum = extractLessonNumber(val);
        const iNum = extractLessonNumber(cleanLessonName);
        if (hNum && iNum && hNum === iNum) lessonColIdx = j;
      }

      if (lessonColIdx !== -1) {
        studentsStartRow = currentRow + 1; // Students start immediately after lesson headers
        break;
      }
    }
    if (studentsStartRow !== -1) break;
  }
  
  if (lessonColIdx === -1) {
    Logger.log('Lesson column not found: ' + lessonName);
    return;
  }
  
  // 3. Batch Update Students
  const maxRows = Math.min(50, lastRow - studentsStartRow + 1);
  if (maxRows <= 0) return;
  
  // Read Student Names (Always in Column A for students)
  const rangeName = sheet.getRange(studentsStartRow, 1, maxRows, 1);
  const rangeLesson = sheet.getRange(studentsStartRow, lessonColIdx + 1, maxRows, 1);
  
  const valuesName = rangeName.getValues();
  const valuesLesson = rangeLesson.getValues();
  
  const statusMap = new Map();
  studentStatuses.forEach(s => statusMap.set(s.name.toString().trim().toUpperCase(), s.status));
  
  let changesMade = false;
  
  for (let i = 0; i < valuesName.length; i++) {
    const rowName = valuesName[i][0] ? valuesName[i][0].toString().trim().toUpperCase() : "";
    
    // Stop if we hit a new group header or blank
    if (!rowName || rowName.includes("GROUP")) break;
    
    if (statusMap.has(rowName)) {
      const newStatus = statusMap.get(rowName);
      if (valuesLesson[i][0] !== newStatus) {
        valuesLesson[i][0] = newStatus;
        changesMade = true;
      }
    }
  }
  
  if (changesMade) {
    rangeLesson.setValues(valuesLesson);
    Logger.log(`Updated group sheet for ${groupName}`);
  }
}

/**
 * OPTIMIZED: Updates only the affected students in UFLI MAP
 * Uses Batch Read/Write to minimize API calls (2 writes total).
 */
function updateUFLIMapTargeted(mapSheet, studentStatuses, lessonNum, timestamp) {
  const lastRow = mapSheet.getLastRow();
  if (lastRow < LAYOUT.DATA_START_ROW) return;
  
  const numRows = lastRow - LAYOUT.DATA_START_ROW + 1;
  
  // 1. Read Student Names (Column A)
  const nameData = mapSheet.getRange(LAYOUT.DATA_START_ROW, 1, numRows, 1).getValues().flat();
  
  // 2. Identify target column indices
  const lessonColIdx = LAYOUT.COL_FIRST_LESSON + lessonNum - 1; // 1-based column index
  const currentLessonColIdx = LAYOUT.COL_CURRENT_LESSON;        // 1-based column index
  
  // 3. Read the Data Columns (Lesson Column and Current Lesson Column)
  const lessonRange = mapSheet.getRange(LAYOUT.DATA_START_ROW, lessonColIdx, numRows, 1);
  const currentLessonRange = mapSheet.getRange(LAYOUT.DATA_START_ROW, currentLessonColIdx, numRows, 1);
  
  const lessonValues = lessonRange.getValues();
  const currentLessonValues = currentLessonRange.getValues();
  
  // 4. Build Lookup and Update Arrays
  const statusMap = new Map();
  studentStatuses.forEach(s => statusMap.set(s.name.toString().trim().toUpperCase(), s.status));
  
  let updatesMade = 0;
  const lessonLabel = `UFLI L${lessonNum}`;
  
  for (let i = 0; i < nameData.length; i++) {
    const name = nameData[i].toString().trim().toUpperCase();
    if (statusMap.has(name)) {
      const status = statusMap.get(name);
      
      // Update Status
      lessonValues[i][0] = status;
      
      // Update Current Lesson text
      currentLessonValues[i][0] = lessonLabel;
      
      updatesMade++;
    }
  }
  
  // 5. Batch Write
  if (updatesMade > 0) {
    lessonRange.setValues(lessonValues);
    currentLessonRange.setValues(currentLessonValues);
    Logger.log(`Fast updated UFLI MAP for ${updatesMade} students`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Log Unenrolled Students
// ═══════════════════════════════════════════════════════════════════════════

function logUnenrolledStudents(ss, groupName, lessonName, students, timestamp) {
  if (!students || students.length === 0) return;
  
  let logSheet = ss.getSheetByName('Exception Log');
  
  if (!logSheet) {
    logSheet = ss.insertSheet('Exception Log');
    logSheet.getRange(1, 1, 1, 5).setValues([['Date', 'Type', 'Group', 'Lesson', 'Student']]);
    logSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#4A90E2').setFontColor('#FFFFFF');
  }
  
  const rows = students.map(name => [timestamp, 'Unenrolled', groupName, lessonName, name]);
  logSheet.getRange(logSheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  
  Logger.log('logUnenrolledStudents: Logged ' + students.length + ' unenrolled students');
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFERRED SYNC FUNCTIONS (Run nightly or on-demand)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * FULL SYNC: Run this nightly or on-demand
 * Recalculates all stats, pacing reports, school summary
 */
function runFullSyncDeferred() {
  const functionName = 'runFullSyncDeferred';
  const startTime = new Date();
  Logger.log(`[${functionName}] Starting full deferred sync...`);
  
  try {
    syncSmallGroupProgress();
    updatePacingReports();
    updateSchoolSummary();
    
    const elapsed = (new Date() - startTime) / 1000;
    Logger.log(`[${functionName}] Completed in ${elapsed.toFixed(2)}s`);
    
    return { success: true, elapsed: elapsed };
    
  } catch (error) {
    Logger.log(`[${functionName}] Error: ${error.toString()}`);
    return { success: false, error: error.toString() };
  }
}

/**
 * Manual trigger for users who want to see updated stats immediately
 */
function recalculateAllStatsNow() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    'Recalculate All Stats?',
    'This will update all statistics, pacing reports, and the school summary.\n\n' +
    'This may take 30-60 seconds for large sites.\n\nProceed?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) return;
  
  SpreadsheetApp.getActiveSpreadsheet().toast('Recalculating all stats...', 'Please wait', -1);
  
  const result = runFullSyncDeferred();
  
  SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);
  
  if (result.success) {
    ui.alert('Complete!', `All stats recalculated in ${result.elapsed.toFixed(1)} seconds.`, ui.ButtonSet.OK);
  } else {
    ui.alert('Error', result.error, ui.ButtonSet.OK);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER MANAGEMENT - Setup/Remove Nightly Sync
// ═══════════════════════════════════════════════════════════════════════════

function setupNightlySyncTrigger() {
  removeNightlySyncTrigger();
  
  ScriptApp.newTrigger('runFullSyncDeferred')
    .timeBased()
    .atHour(0)
    .everyDays(1)
    .inTimezone(Session.getScriptTimeZone())
    .create();
  
  Logger.log('Nightly sync trigger created for midnight');
  
  SpreadsheetApp.getUi().alert(
    'Nightly Sync Enabled',
    'Stats will automatically update every night at midnight.\n\n' +
    'You can also manually recalculate anytime from the menu.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function removeNightlySyncTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runFullSyncDeferred') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  
  if (removed > 0) {
    Logger.log('Removed ' + removed + ' nightly sync trigger(s)');
    SpreadsheetApp.getUi().alert('Nightly Sync Disabled', 'Automatic nightly updates have been turned off.', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function showTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  const syncTrigger = triggers.find(t => t.getHandlerFunction() === 'runFullSyncDeferred');
  
  let message;
  if (syncTrigger) {
    message = '✅ Nightly sync is ENABLED.\n\n' +
              'Stats automatically update at midnight.\n\n' +
              'To disable: Menu → Performance → Disable Nightly Sync';
  } else {
    message = '❌ Nightly sync is DISABLED.\n\n' +
              'Stats only update when you manually run "Recalculate Now".\n\n' +
              'To enable: Menu → Performance → Enable Nightly Sync';
  }
  
  SpreadsheetApp.getUi().alert('Sync Status', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREK ASSESSMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get students for a PreK group
 * @param {string} groupName - e.g., "PreK Group 1"
 * @returns {Array} - [{name: "Student Name", group: "PreK Group 1"}, ...]
 */
function getPreKStudentsByGroup(groupName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Pre-K Data');
    
    if (!sheet) {
      Logger.log('Pre-K Data sheet not found');
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const students = [];
    
    let headerRow = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i][0] && data[i][0].toString().toLowerCase() === 'student') {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) {
      Logger.log('Could not find header row in Pre-K Data');
      return [];
    }
    
    const baseGroupName = groupName.replace(/\s+\d+$/, '').trim();
    
    for (let i = headerRow + 1; i < data.length; i++) {
      const studentName = data[i][0];
      const studentGroup = data[i][1];
      
      if (!studentName || studentName.toString().trim() === '') continue;
      
      const studentBaseGroup = studentGroup ? studentGroup.toString().replace(/\s+\d+$/, '').trim() : '';
      
      if (studentGroup === groupName || 
          studentBaseGroup === baseGroupName ||
          (groupName.includes(studentGroup) || (studentGroup && studentGroup.includes(baseGroupName)))) {
        students.push({
          name: studentName.toString().trim(),
          group: studentGroup ? studentGroup.toString().trim() : groupName
        });
      }
    }
    
    students.sort((a, b) => a.name.localeCompare(b.name));
    
    Logger.log('Found ' + students.length + ' students for group: ' + groupName);
    return students;
    
  } catch (error) {
    Logger.log('Error in getPreKStudentsByGroup: ' + error.message);
    return [];
  }
}

/**
 * Get sequences for a PreK group from the PreK Pacing sheet
 */
function getPreKSequences(groupName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PreK Pacing');
    
    if (!sheet) {
      Logger.log('PreK Pacing sheet not found');
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const sequences = [];
    
    let sequenceRow = -1;
    let headerRow = -1;
    
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const rowStr = data[i].join(' ').toLowerCase();
      if (rowStr.includes('sequence 1') || rowStr.includes('instructional sequence')) {
        sequenceRow = i;
      }
      if (data[i][0] && data[i][0].toString().toLowerCase() === 'group') {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) {
      Logger.log('Could not find header row in PreK Pacing');
      return [];
    }
    
    if (sequenceRow === -1) {
      sequenceRow = headerRow - 1;
    }
    
    let groupRow = -1;
    const baseGroupName = groupName.replace(/\s+\d+$/, '').trim();
    
    for (let i = headerRow + 1; i < data.length; i++) {
      const rowGroup = data[i][0] ? data[i][0].toString().trim() : '';
      const rowBaseGroup = rowGroup.replace(/\s+\d+$/, '').trim();
      
      if (rowGroup === groupName || rowBaseGroup === baseGroupName ||
          groupName.includes(rowGroup) || rowGroup.includes(baseGroupName)) {
        groupRow = i;
        break;
      }
    }
    
    if (groupRow === -1) {
      Logger.log('Group not found in PreK Pacing: ' + groupName);
      return [];
    }
    
    let seqNum = 1;
    for (let col = 2; col < data[groupRow].length; col += 2) {
      const letters = data[groupRow][col];
      
      if (letters && letters.toString().trim() !== '') {
        let seqName = '';
        if (sequenceRow >= 0 && data[sequenceRow][col]) {
          seqName = data[sequenceRow][col].toString().trim();
        }
        if (!seqName) {
          seqName = 'Sequence ' + seqNum;
        }
        
        sequences.push({
          sequenceName: seqName,
          letters: letters.toString().trim(),
          columnIndex: col
        });
        seqNum++;
      }
    }
    
    Logger.log('Found ' + sequences.length + ' sequences for group: ' + groupName);
    return sequences;
    
  } catch (error) {
    Logger.log('Error in getPreKSequences: ' + error.message);
    return [];
  }
}

/**
 * Get assessment data for a specific student and sequence
 */
function getPreKAssessmentData(studentName, groupName, sequenceName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const sequences = getPreKSequences(groupName);
    const sequence = sequences.find(s => s.sequenceName === sequenceName);
    
    if (!sequence) {
      Logger.log('Sequence not found: ' + sequenceName);
      return { lessons: [], currentData: {} };
    }
    
    const letters = sequence.letters.split(',').map(l => l.trim().toUpperCase());
    const skills = getPreKSkillsForGroup(groupName);
    
    const lessons = [];
    letters.forEach(letter => {
      skills.forEach(skill => {
        lessons.push(letter + ' - ' + skill);
      });
    });
    
    const currentData = {};
    const sheet = ss.getSheetByName('Pre-K Data');
    
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      
      let headerRow = -1;
      for (let i = 0; i < Math.min(10, data.length); i++) {
        if (data[i][0] && data[i][0].toString().toLowerCase() === 'student') {
          headerRow = i;
          break;
        }
      }
      
      if (headerRow >= 0) {
        const headers = data[headerRow];
        const colMap = {};
        for (let c = 0; c < headers.length; c++) {
          if (headers[c]) {
            colMap[headers[c].toString().trim()] = c;
          }
        }
        
        for (let i = headerRow + 1; i < data.length; i++) {
          if (data[i][0] && data[i][0].toString().trim() === studentName) {
            lessons.forEach(lesson => {
              if (colMap[lesson] !== undefined) {
                const val = data[i][colMap[lesson]];
                currentData[lesson] = val ? val.toString().trim() : '';
              }
            });
            break;
          }
        }
      }
    }
    
    Logger.log('Returning ' + lessons.length + ' lessons for ' + studentName);
    return { lessons: lessons, currentData: currentData };
    
  } catch (error) {
    Logger.log('Error in getPreKAssessmentData: ' + error.message);
    return { lessons: [], currentData: {} };
  }
}

/**
 * Get the skills tracked for a PreK group
 */
function getPreKSkillsForGroup(groupName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PreK Pacing');
    
    const defaultSkills = ['Form', 'Name', 'Sound'];
    
    if (!sheet) {
      return defaultSkills;
    }
    
    const data = sheet.getDataRange().getValues();
    
    let headerRow = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i][0] && data[i][0].toString().toLowerCase() === 'group') {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) return defaultSkills;
    
    const baseGroupName = groupName.replace(/\s+\d+$/, '').trim();
    
    for (let i = headerRow + 1; i < data.length; i++) {
      const rowGroup = data[i][0] ? data[i][0].toString().trim() : '';
      const rowBaseGroup = rowGroup.replace(/\s+\d+$/, '').trim();
      
      if (rowGroup === groupName || rowBaseGroup === baseGroupName ||
          groupName.includes(rowGroup) || rowGroup.includes(baseGroupName)) {
        const skillsStr = data[i][1] ? data[i][1].toString() : '';
        
        if (skillsStr) {
          const skills = [];
          if (skillsStr.toLowerCase().includes('form')) skills.push('Form');
          if (skillsStr.toLowerCase().includes('name')) skills.push('Name');
          if (skillsStr.toLowerCase().includes('sound')) skills.push('Sound');
          
          if (skills.length > 0) return skills;
        }
        break;
      }
    }
    
    return defaultSkills;
    
  } catch (error) {
    Logger.log('Error in getPreKSkillsForGroup: ' + error.message);
    return ['Form', 'Name', 'Sound'];
  }
}

/**
 * Save PreK assessment data for a student
 */
function savePreKAssessmentData(formData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Pre-K Data');
    
    if (!sheet) {
      return { success: false, message: 'Pre-K Data sheet not found' };
    }
    
    const { studentName, groupName, assessments } = formData;
    
    if (!studentName || !assessments) {
      return { success: false, message: 'Missing required data' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    let headerRow = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i][0] && data[i][0].toString().toLowerCase() === 'student') {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) {
      return { success: false, message: 'Could not find header row in Pre-K Data' };
    }
    
    const headers = data[headerRow];
    const colMap = {};
    for (let c = 0; c < headers.length; c++) {
      if (headers[c]) {
        colMap[headers[c].toString().trim()] = c;
      }
    }
    
    let studentRow = -1;
    for (let i = headerRow + 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === studentName) {
        studentRow = i;
        break;
      }
    }
    
    if (studentRow === -1) {
      return { success: false, message: 'Student not found: ' + studentName };
    }
    
    let updatedCount = 0;
    for (const [lessonName, value] of Object.entries(assessments)) {
      if (colMap[lessonName] !== undefined && value) {
        sheet.getRange(studentRow + 1, colMap[lessonName] + 1).setValue(value);
        updatedCount++;
      }
    }
    
    Logger.log('Updated ' + updatedCount + ' assessments for ' + studentName);
    
    return { 
      success: true, 
      message: 'Saved ' + updatedCount + ' assessments for ' + studentName 
    };
    
  } catch (error) {
    Logger.log('Error in savePreKAssessmentData: ' + error.message);
    return { success: false, message: 'Error saving data: ' + error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function testPreKFunctions() {
  Logger.log('=== TEST: getPreKStudentsByGroup ===');
  const students = getPreKStudentsByGroup('PreK Group 1');
  Logger.log('Students: ' + JSON.stringify(students));
  
  Logger.log('\n=== TEST: getPreKSequences ===');
  const sequences = getPreKSequences('PreK Group 1');
  Logger.log('Sequences: ' + JSON.stringify(sequences));
  
  Logger.log('\n=== TEST: getPreKSkillsForGroup ===');
  const skills = getPreKSkillsForGroup('PreK Group 1');
  Logger.log('Skills: ' + JSON.stringify(skills));
  
  if (students.length > 0) {
    Logger.log('\n=== TEST: getPreKAssessmentData ===');
    const assessmentData = getPreKAssessmentData(
      students[0].name, 
      'PreK Group 1', 
      sequences.length > 0 ? sequences[0].sequenceName : 'Sequence 1'
    );
    Logger.log('Assessment Data: ' + JSON.stringify(assessmentData));
  }
}
