// ═══════════════════════════════════════════════════════════════════════════
// Adira Reads Progress Report - SETUP WIZARD (PHASE 1)
// Configuration, Student/Group Management, Reports, and Web App
// ═══════════════════════════════════════════════════════════════════════════
// Version: 3.1 - GROUP SHEET INSTANT UPDATE
// Last Updated: December 2025
//
// ARCHITECTURE:
// - This file owns: Config constants, menu, wizard, manage UI, reports, web app
// - SystemSheets_v4.gs owns: System constants, sheet generation, sync, pacing
//
// CHANGES FROM v3.0:
// - NEW: updateGroupSheetWithStatuses() - instant Y/N/A update on form submit
// - UPDATED: saveLessonData() - now calls updateGroupSheetWithStatuses()
// - Teachers now see green/red/yellow colors immediately after submitting
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL CONSTANTS - CONFIGURATION SHEETS
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM_VERSION = "3.1";

/**
 * Sheet names for CONFIGURATION sheets (wizard-created)
 * NOTE: System/tracking sheet names are in SystemSheets_v4.gs (SHEET_NAMES_V2)
 */
const SHEET_NAMES = {
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
 * Layout configuration for wizard-created sheets
 * Used for consistent row/column positioning across configuration sheets
 */
const CONFIG_LAYOUT = {
  // Site Configuration sheet layout
  SITE_CONFIG: {
    SCHOOL_NAME_ROW: 2,
    GRADES_START_ROW: 5,
    GRADE_MIXING_ROW: 17,
    COMBINATIONS_ROW: 18,
    VERSION_ROW: 20,
    LAST_UPDATED_ROW: 21
  },
  // Roster/config sheets layout (Student, Teacher, Group, Feature sheets)
  ROSTER: {
    TITLE_ROW: 1,
    INSTRUCTIONS_ROW: 2,
    HEADER_ROW: 4,
    DATA_START_ROW: 5
  },
  // Column indices (1-based)
  COLS: {
    LABEL: 1,
    VALUE: 2
  }
};

/**
 * Recommended students per group
 */
const RECOMMENDED_GROUP_SIZE = {
  min: 4,
  max: 10,
  ideal: 6
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
    // Look in Pre-K Data Sheet
    const sheet = ss.getSheetByName(SHEET_NAMES_PREK.DATA);
    if (!sheet) return "";
    const data = sheet.getDataRange().getValues();
    // Assuming Teacher is Column C (Index 2), Group is Column D (Index 3)
    for (let i = PREK_CONFIG.DATA_START_ROW - 1; i < data.length; i++) {
      if (data[i][3] === groupName) return data[i][2]; // Return Teacher Name
    }
  } else {
    // Standard Lookup (UFLI MAP)
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
// MENU INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates the UFLI menu when the spreadsheet opens
 * Shows different menu based on whether system is configured
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  
  if (!configSheet || !isSystemConfigured()) {
    // Unconfigured - show setup-only menu
    ui.createMenu('Adira Reads Progress Report')
      .addItem('🚀 Start Setup Wizard', 'startSetupWizard')
      .addToUi();
  } else {
    // Configured - show full menu
    ui.createMenu('Adira Reads Progress Report')
    .addItem('🔄 Refresh Grade Summary Formulas', 'refreshGradeSummaryFormulas')
      .addItem('📊 Update Progress Data', 'updateAllProgress')
      .addSeparator()
      .addItem('📈 Generate Reports', 'generateReports')
      .addItem('👥 Manage Students', 'manageStudents')
      .addItem('👨‍🏫 Manage Groups', 'manageGroups')
      .addSeparator()
      .addItem('🏢 View School Summary', 'goToSchoolSummary')
      .addSubMenu(ui.createMenu('🔧 Maintenance')
        .addItem('Refresh Formulas for New Students', 'updateFormulasForNewStudents')
        .addItem('Repair UFLI MAP Formatting', 'repairUFLIMapFormatting')
        .addItem('Repair Current Lesson Formulas', 'repairCurrentLessonFormulas')
        .addItem('Fix Missing Teachers', 'fixMissingTeachers')
        .addItem('Sync Small Group Progress', 'syncSmallGroupProgress')
        .addItem('🔧 Repair All Formulas', 'repairAllFormulas')
        .addItem('🔧 Repair Grade Summary Formulas', 'repairGradeSummaryFormulas')
        .addItem('🔧 Repair Skills Tracker Formulas', 'repairSkillsTrackerFormulas'))
      .addSeparator()
      .addSubMenu(ui.createMenu('🔐 Admin Tools')
        .addItem('📂 Open Import Dialog...', 'showImportDialog')
        .addSeparator()
        .addItem('✅ Validate Import Data', 'validateImportData')
        .addItem('▶️ Process Import to UFLI MAP', 'processImportData')
        .addSeparator()
        .addItem('🗑️ Clear Import Staging', 'clearImportStaging')
        .addItem('📋 View Import Exceptions', 'goToExceptionsSheet'))
      .addSeparator()
      .addItem('⚙️ System Settings', 'openSettings')
      .addItem('🔄 Re-run Setup Wizard', 'startSetupWizard')
      .addToUi();
  }
}

/**
 * Checks if the system has been configured
 * @returns {boolean} True if configured
 */
function isSystemConfigured() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);

  if (!configSheet) return false;

  const schoolName = configSheet.getRange(
    CONFIG_LAYOUT.SITE_CONFIG.SCHOOL_NAME_ROW,
    CONFIG_LAYOUT.COLS.VALUE
  ).getValue();
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
 * This is the master function that other functions call to get current state
 * @returns {Object} Complete wizard data object
 */
function getWizardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  
  // Return empty defaults if not configured
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
 * @returns {Array<string>} Array of grade values (e.g., ["KG", "G1", "G2"])
 */
function getExistingGrades(configSheet) {
  const grades = [];
  for (let i = 0; i < GRADE_OPTIONS.length; i++) {
    const value = configSheet.getRange(
      CONFIG_LAYOUT.SITE_CONFIG.GRADES_START_ROW + i,
      CONFIG_LAYOUT.COLS.VALUE
    ).getValue();
    if (value === true || value === "TRUE") {
      grades.push(GRADE_OPTIONS[i].value);
    }
  }
  return grades;
}

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
    .filter(row => row[0]) // Filter out blank rows
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
  
  // Only read columns 1 (Grade) and 2 (# of Groups). Col 3 is calculated.
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
  const allowed = configSheet.getRange(
    CONFIG_LAYOUT.SITE_CONFIG.GRADE_MIXING_ROW,
    CONFIG_LAYOUT.COLS.VALUE
  ).getValue();
  const combinations = configSheet.getRange(
    CONFIG_LAYOUT.SITE_CONFIG.COMBINATIONS_ROW,
    CONFIG_LAYOUT.COLS.VALUE
  ).getValue();

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
  
  // Clear existing group assignments
  result.students = (result.students || []).map(s => ({ ...s, group: "" }));
  
  // For each grade, distribute students evenly
  (wizardData.groups || []).forEach(groupConfig => {
    const grade = groupConfig.grade;
    const groupCount = groupConfig.count;

    if (!grade || !groupCount || groupCount === 0) {
      logMessage('autoBalanceStudents', `Skipping invalid group config: ${JSON.stringify(groupConfig)}`, 'WARN');
      return;
    }
    
    // Get students for this grade without assignments
    const studentsInGrade = result.students.filter(s => s.grade === grade && !s.group);
    
    if (studentsInGrade.length === 0) return;
    
    // Distribute students round-robin
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

/**
 * Validates Step 1 (School Info)
 * @param {Object} data - Wizard data
 * @returns {Object} Validation result
 */
function validateStep1(data) {
  if (!data.schoolName || data.schoolName.trim() === "") {
    return createResult(false, "Please enter a school name.");
  }
  return createResult(true, "Valid");
}

/**
 * Validates Step 2 (Grades Served)
 * @param {Object} data - Wizard data
 * @returns {Object} Validation result
 */
function validateStep2(data) {
  if (!data.gradesServed || data.gradesServed.length === 0) {
    return createResult(false, "Please select at least one grade level.");
  }
  return createResult(true, "Valid");
}

/**
 * Validates Step 3 (Students)
 * @param {Object} data - Wizard data
 * @returns {Object} Validation result
 */
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

/**
 * Validates Step 4 (Teachers)
 * @param {Object} data - Wizard data
 * @returns {Object} Validation result
 */
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

/**
 * Validates Step 5 (Groups)
 * @param {Object} data - Wizard data
 * @returns {Object} Validation result
 */
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

/**
 * Validates Step 6 (Features) - Always passes
 * @param {Object} data - Wizard data
 * @returns {Object} Validation result
 */
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
    
    // Validate all steps
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
    
    // Create or update configuration sheets
    createConfigurationSheet(ss, wizardData);
    createStudentRosterSheet(ss, wizardData);
    createTeacherRosterSheet(ss, wizardData);
    createGroupConfigSheet(ss, wizardData);
    createFeatureSettingsSheet(ss, wizardData);
    
    // Create pacing report sheets (from SystemSheets_v4.gs)
    createPacingReports(ss);
    
    logMessage(functionName, 'Configuration sheets created, generating system sheets...');
    
    // Generate system sheets based on configuration (from SystemSheets_v4.gs)
    const generationResult = generateSystemSheets(ss, wizardData);
    
    if (!generationResult.success) {
      throw new Error("Failed to generate system sheets: " + generationResult.error);
    }
    
    // Refresh menu
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

/**
 * Creates or updates the Site Configuration sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} data - Wizard data
 */
function createConfigurationSheet(ss, data) {
  let sheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.CONFIG);
  } else {
    sheet.clear();
  }
  
  // Header
  sheet.getRange(1, 1, 1, 2).setValues([["Adira Reads Progress Report Configuration", ""]]);
  sheet.getRange(1, 1, 1, 2).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG).setFontWeight("bold");
  
  // School Name
  sheet.getRange(2, 1).setValue("School Name:");
  sheet.getRange(2, 2).setValue(data.schoolName);
  
  // Grades Served Header
  sheet.getRange(4, 1).setValue("Grades Served:");
  sheet.getRange(4, 1).setFontWeight("bold");
  
  // Grades Served checkboxes
  GRADE_OPTIONS.forEach((grade, index) => {
    sheet.getRange(5 + index, 1).setValue(grade.label);
    sheet.getRange(5 + index, 2).setValue(data.gradesServed.includes(grade.value));
  });
  
  // Grade Mixing Configuration
  sheet.getRange(16, 1).setValue("Grade Mixing Settings:");
  sheet.getRange(16, 1).setFontWeight("bold");
  
  sheet.getRange(17, 1).setValue("Allow Grade Mixing:");
  sheet.getRange(17, 2).setValue(data.gradeMixing ? data.gradeMixing.allowed : false);
  
  sheet.getRange(18, 1).setValue("Mixed Grade Combinations:");
  sheet.getRange(18, 2).setValue(data.gradeMixing && data.gradeMixing.combinations ? 
                                  data.gradeMixing.combinations.join(', ') : "");
  
  // System Info
  sheet.getRange(20, 1).setValue("System Version:");
  sheet.getRange(20, 2).setValue(SYSTEM_VERSION);
  
  sheet.getRange(21, 1).setValue("Last Updated:");
  sheet.getRange(21, 2).setValue(new Date());
  
  // Format
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 300);
  sheet.getRange(2, 1, 21, 2).setFontFamily("Calibri");
  
  protectSheet(sheet);
}

/**
 * Creates or updates the Student Roster sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} data - Wizard data
 */
function createStudentRosterSheet(ss, data) {
  let sheet = ss.getSheetByName(SHEET_NAMES.STUDENT_ROSTER);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.STUDENT_ROSTER);
  } else {
    sheet.clear();
  }
  
  // Header row 1
  sheet.getRange(1, 1, 1, 4).setValues([["STUDENT ROSTER", "", "", ""]]);
  sheet.getRange(1, 1, 1, 4).merge().setBackground(COLORS.TITLE_BG).setFontColor(COLORS.TITLE_FG)
    .setFontWeight("bold").setFontSize(14);
  
  // Instructions row 2
  sheet.getRange(2, 1, 1, 4).setValues([["Complete roster of all students receiving UFLI intervention", "", "", ""]]);
  sheet.getRange(2, 1, 1, 4).merge().setFontFamily("Calibri").setFontSize(10).setFontStyle("italic");
  
  // Column headers row 4
  sheet.getRange(4, 1, 1, 4).setValues([["Student Name", "Grade", "Teacher", "Group"]]);
  sheet.getRange(4, 1, 1, 4).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG)
    .setFontWeight("bold").setFontFamily("Calibri");
  
  // Data rows
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
  
  // Formatting
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 150);
  
  sheet.setFrozenRows(4);
  sheet.getRange(LAYOUT.DATA_START_ROW, 1, Math.max(1, sheet.getMaxRows() - 4), 4).setFontFamily("Calibri");
}

/**
 * Creates or updates the Teacher Roster sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} data - Wizard data
 */
function createTeacherRosterSheet(ss, data) {
  let sheet = ss.getSheetByName(SHEET_NAMES.TEACHER_ROSTER);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.TEACHER_ROSTER);
  } else {
    sheet.clear();
  }
  
  // Header
  sheet.getRange(1, 1, 1, 2).setValues([["TEACHER ROSTER", ""]]);
  sheet.getRange(1, 1, 1, 2).merge().setBackground(COLORS.TITLE_BG).setFontColor(COLORS.TITLE_FG)
    .setFontWeight("bold").setFontSize(14);
  
  // Instructions
  sheet.getRange(2, 1, 1, 2).setValues([["All teachers with homeroom assignments", ""]]);
  sheet.getRange(2, 1, 1, 2).merge().setFontFamily("Calibri").setFontSize(10).setFontStyle("italic");
  
  // Column headers
  sheet.getRange(4, 1, 1, 2).setValues([["Teacher Name", "Grade Assignment(s)"]]);
  sheet.getRange(4, 1, 1, 2).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG)
    .setFontWeight("bold").setFontFamily("Calibri");
  
  // Data rows
  const teachers = data.teachers || [];
  if (teachers.length > 0) {
    const teacherData = teachers.map(t => [
      t.name || "",
      (t.grades || []).join(', ')
    ]);
    sheet.getRange(LAYOUT.DATA_START_ROW, 1, teacherData.length, 2).setValues(teacherData);
  }
  
  // Formatting
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 200);
  
  sheet.setFrozenRows(4);
  sheet.getRange(LAYOUT.DATA_START_ROW, 1, Math.max(1, sheet.getMaxRows() - 4), 2).setFontFamily("Calibri");
}

/**
 * Creates or updates the Group Configuration sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} data - Wizard data
 */
function createGroupConfigSheet(ss, data) {
  let sheet = ss.getSheetByName(SHEET_NAMES.GROUP_CONFIG);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.GROUP_CONFIG);
  } else {
    sheet.clear();
  }
  
  // Header
  sheet.getRange(1, 1, 1, 3).setValues([["GROUP CONFIGURATION", "", ""]]);
  sheet.getRange(1, 1, 1, 3).merge().setBackground(COLORS.TITLE_BG).setFontColor(COLORS.TITLE_FG)
    .setFontWeight("bold").setFontSize(14);
  
  // Instructions
  sheet.getRange(2, 1, 1, 3).setValues([["Intervention group structure by grade level", "", ""]]);
  sheet.getRange(2, 1, 1, 3).merge().setFontFamily("Calibri").setFontSize(10).setFontStyle("italic");
  
  // Column headers
  sheet.getRange(4, 1, 1, 3).setValues([["Grade", "# of Groups", "Students per Group"]]);
  sheet.getRange(4, 1, 1, 3).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG)
    .setFontWeight("bold").setFontFamily("Calibri");
  
  // Data rows
  const groups = data.groups || [];
  const students = data.students || [];
  
  if (groups.length > 0) {
    const groupData = groups.map(g => {
      const studentsInGrade = students.filter(s => s.grade === g.grade).length;
      const avgPerGroup = g.count > 0 ? Math.round(studentsInGrade / g.count) : 0;
      return [g.grade || "", g.count || 0, avgPerGroup];
    });
    
    sheet.getRange(LAYOUT.DATA_START_ROW, 1, groupData.length, 3).setValues(groupData);
  }
  
  // Formatting
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 150);
  
  sheet.setFrozenRows(4);
  sheet.getRange(LAYOUT.DATA_START_ROW, 1, Math.max(1, sheet.getMaxRows() - 4), 3).setFontFamily("Calibri");
}

/**
 * Creates or updates the Feature Settings sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {Object} data - Wizard data
 */
function createFeatureSettingsSheet(ss, data) {
  let sheet = ss.getSheetByName(SHEET_NAMES.FEATURES);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.FEATURES);
  } else {
    sheet.clear();
  }
  
  // Header
  sheet.getRange(1, 1, 1, 3).setValues([["FEATURE SETTINGS", "", ""]]);
  sheet.getRange(1, 1, 1, 3).merge().setBackground(COLORS.TITLE_BG).setFontColor(COLORS.TITLE_FG)
    .setFontWeight("bold").setFontSize(14);
  
  // Instructions
  sheet.getRange(2, 1, 1, 3).setValues([["Optional features enabled for this site", "", ""]]);
  sheet.getRange(2, 1, 1, 3).merge().setFontFamily("Calibri").setFontSize(10).setFontStyle("italic");
  
  // Column headers
  sheet.getRange(4, 1, 1, 3).setValues([["Feature", "Enabled", "Description"]]);
  sheet.getRange(4, 1, 1, 3).setBackground(COLORS.HEADER_BG).setFontColor(COLORS.HEADER_FG)
    .setFontWeight("bold").setFontFamily("Calibri");
  
  // Feature rows
  const features = data.features || {};
  FEATURE_OPTIONS.forEach((feature, index) => {
    sheet.getRange(LAYOUT.DATA_START_ROW + index, 1).setValue(feature.name);
    sheet.getRange(LAYOUT.DATA_START_ROW + index, 2).setValue(features[feature.id] || false);
    sheet.getRange(LAYOUT.DATA_START_ROW + index, 3).setValue(feature.description);
  });
  
  // Formatting
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 350);
  
  sheet.setFrozenRows(4);
  sheet.getRange(LAYOUT.DATA_START_ROW, 1, FEATURE_OPTIONS.length, 3).setFontFamily("Calibri");
  
  protectSheet(sheet);
}

/**
 * Adds warning protection to a sheet
 * @param {Sheet} sheet - Sheet to protect
 */
function protectSheet(sheet) {
  const protection = sheet.protect().setDescription('System Configuration - Protected');
  protection.setWarningOnly(true);
}

// ═══════════════════════════════════════════════════════════════════════════
// SITE CONFIG FOR UI - Provides branding and labels to HTML dialogs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets site configuration for use in HTML UI dialogs
 * Returns branding (colors, logo) and school name
 * @returns {Object} Site config with schoolName, primaryColor, secondaryColor, logoFileId
 */
function getSiteConfigForUI() {
  const defaults = {
    schoolName: "UFLI Master System",
    primaryColor: "#4A90E2",
    secondaryColor: "#90EE90",
    logoFileId: "",
    accentColor: "#B8E6DC"
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);

    if (!configSheet) return defaults;

    // Row 2: School Name
    // Row 24: Primary Color, Row 25: Secondary Color, Row 26: Logo File ID
    const schoolName = configSheet.getRange(2, 2).getValue();
    const primaryColor = configSheet.getRange(24, 2).getValue();
    const secondaryColor = configSheet.getRange(25, 2).getValue();
    const logoFileId = configSheet.getRange(26, 2).getValue();

    // Derive accent color by lightening primary color
    const accent = lightenColor(primaryColor || defaults.primaryColor, 0.7);

    return {
      schoolName: schoolName || defaults.schoolName,
      primaryColor: primaryColor || defaults.primaryColor,
      secondaryColor: secondaryColor || defaults.secondaryColor,
      logoFileId: logoFileId || "",
      accentColor: accent
    };
  } catch (e) {
    Logger.log("Could not load site config for UI: " + e.message);
    return defaults;
  }
}

/**
 * Lightens a hex color by a factor
 * @param {string} hex - Hex color (e.g., "#00838F")
 * @param {number} factor - Lightening factor 0-1 (0.7 = 70% lighter)
 * @returns {string} Lightened hex color
 */
function lightenColor(hex, factor) {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert to RGB
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Lighten by moving toward white (255)
  r = Math.round(r + (255 - r) * factor);
  g = Math.round(g + (255 - g) * factor);
  b = Math.round(b + (255 - b) * factor);
  
  // Convert back to hex
  const toHex = (n) => {
    const hexStr = n.toString(16);
    return hexStr.length === 1 ? '0' + hexStr : hexStr;
  };
  
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

// ═══════════════════════════════════════════════════════════════════════════
// MANAGE STUDENTS - UI LAUNCHER & DATA FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Opens the Manage Students modal dialog
 */
function manageStudents() {
  const html = HtmlService.createHtmlOutputFromFile('ManageStudentsUI')
    .setWidth(800)
    .setHeight(600)
    .setTitle('Manage Student Roster');
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage Students');
}

/**
 * Fetches all student data for the Manage Students UI
 * @returns {Array<Object>} Array of student objects with row indices
 */
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

/**
 * Saves a student's data (add or update)
 * @param {Object} studentObject - Student data with optional rowIndex
 * @returns {Object} Result with success status
 */
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
      // UPDATE EXISTING STUDENT
      const row = studentObject.rowIndex;
      rosterSheet.getRange(row, 1, 1, 4).setValues([studentData]);
      
      // Update in all tracker sheets
      const originalName = studentObject.originalName || studentObject.name;
      updateStudentInSheet(ss, SHEET_NAMES_V2.UFLI_MAP, originalName, studentData);
      updateStudentInSheet(ss, SHEET_NAMES_V2.SKILLS, originalName, studentData);
      updateStudentInSheet(ss, SHEET_NAMES_V2.GRADE_SUMMARY, originalName, studentData);
      
      logMessage(functionName, `Updated student: ${studentObject.name}`);
      
    } else {
      // ADD NEW STUDENT
      rosterSheet.appendRow(studentData);
      
      // Add to all tracker sheets
      addStudentToSheet(ss, SHEET_NAMES_V2.UFLI_MAP, studentData);
      addStudentToSheet(ss, SHEET_NAMES_V2.SKILLS, studentData);
      addStudentToSheet(ss, SHEET_NAMES_V2.GRADE_SUMMARY, studentData);
      
      logMessage(functionName, `Added new student: ${studentObject.name}`);
    }
    
    // Rebuild grade group sheets
    createGradeGroupSheets(ss, getWizardData());
    
    return createResult(true, "Student saved successfully.");
    
  } catch (e) {
    logMessage(functionName, `Error: ${e.message}`, 'ERROR');
    return createResult(false, "Error saving student: " + e.message);
  }
}

/**
 * Deletes a student from all sheets
 * @param {Object} studentObject - Student to delete (must have name)
 * @returns {Object} Result with success status
 */
function deleteStudent(studentObject) {
  const functionName = 'deleteStudent';
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const studentName = studentObject.name;
    
    // Delete from all sheets
    deleteStudentFromSheet(ss, SHEET_NAMES.STUDENT_ROSTER, studentName);
    deleteStudentFromSheet(ss, SHEET_NAMES_V2.UFLI_MAP, studentName);
    deleteStudentFromSheet(ss, SHEET_NAMES_V2.SKILLS, studentName);
    deleteStudentFromSheet(ss, SHEET_NAMES_V2.GRADE_SUMMARY, studentName);
    
    // Rebuild grade group sheets
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

/**
 * Updates a student's info in a tracker sheet
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {string} sheetName - Target sheet name
 * @param {string} studentName - Student name to find
 * @param {Array} studentData - New data [name, grade, teacher, group]
 */
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

/**
 * Adds a new student row to a tracker sheet with appropriate formulas
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {string} sheetName - Target sheet name
 * @param {Array} studentData - Student data [name, grade, teacher, group]
 */
function addStudentToSheet(ss, sheetName, studentData) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  
  const lastCol = sheet.getLastColumn();
  const newRow = Array(lastCol).fill("");
  
  // Splice in the student data (first 4 columns)
  newRow.splice(0, 4, studentData[0], studentData[1], studentData[2], studentData[3]);
  
  sheet.appendRow(newRow);
  
  const newRowIndex = sheet.getLastRow();
  
  // Add appropriate formulas for the new row
  if (sheetName === SHEET_NAMES_V2.UFLI_MAP) {
    // Current Lesson formula now pulls from Small Group Progress
    const currentLessonFormula = buildCurrentLessonFormula(newRowIndex);
    sheet.getRange(newRowIndex, LAYOUT.COL_CURRENT_LESSON).setFormula(currentLessonFormula);
    
  } else if (sheetName === SHEET_NAMES_V2.SKILLS) {
    // Add skill formulas for the new row
    addSkillFormulasForRow(sheet, newRowIndex);
    
  } else if (sheetName === SHEET_NAMES_V2.GRADE_SUMMARY) {
    // Add grade summary formulas for the new row
    const studentObj = { grade: studentData[1] };
    addGradeSummaryFormulasForRow(sheet, newRowIndex, studentObj);
  }
}

/**
 * Deletes a student row from any sheet by name
 * @param {Spreadsheet} ss - Active spreadsheet
 * @param {string} sheetName - Target sheet name
 * @param {string} studentName - Student name to delete
 */
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

/**
 * Opens the Manage Groups modal dialog
 */
function manageGroups() {
  const html = HtmlService.createHtmlOutputFromFile('ManageGroupsUI')
    .setWidth(600)
    .setHeight(500)
    .setTitle('Manage Group Configuration');
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage Groups');
}

/**
 * Fetches data for the Manage Groups UI
 * @returns {Array<Object>} Array of grade group data
 */
function getGroupsData() {
  const functionName = 'getGroupsData';
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get grades served
    const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
    if (!configSheet) throw new Error("Site Configuration sheet not found.");
    const gradesServed = getExistingGrades(configSheet);
    
    // Get student counts
    const students = getExistingStudents();
    const studentCounts = {};
    gradesServed.forEach(grade => studentCounts[grade] = 0);
    students.forEach(s => {
      if (studentCounts[s.grade] !== undefined) {
        studentCounts[s.grade]++;
      }
    });

    // Get current group counts
    const groups = getExistingGroups();
    const groupCounts = {};
    groups.forEach(g => groupCounts[g.grade] = g.count);

    // Build UI data with labels
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

/**
 * Saves new group configuration and rebuilds grade sheets
 * @param {Array<Object>} newGroupConfig - Array of {grade, count} objects
 * @returns {Object} Result with success status
 */
function saveGroups(newGroupConfig) {
  const functionName = 'saveGroups';
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get full wizard data and update groups
    const wizardData = getWizardData();
    wizardData.groups = newGroupConfig;

    // Rewrite Group Configuration sheet
    createGroupConfigSheet(ss, wizardData);

    // Delete all existing grade sheets
    const allSheets = ss.getSheets();
    const gradeSheetRegex = /^(PreK|KG|G[1-8]) Groups$/;
    allSheets.forEach(sheet => {
      if (gradeSheetRegex.test(sheet.getName())) {
        ss.deleteSheet(sheet);
      }
    });

    // Create new grade sheets
    createGradeGroupSheets(ss, wizardData);

    // Update student assignments - clear invalid group references
    const rosterSheet = ss.getSheetByName(SHEET_NAMES.STUDENT_ROSTER);
    if (rosterSheet && rosterSheet.getLastRow() >= LAYOUT.DATA_START_ROW) {
      const rosterData = rosterSheet.getRange(LAYOUT.DATA_START_ROW, 1, 
                                               rosterSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 4).getValues();
      
      // Build set of valid group names
      const validGroupNames = new Set();
      newGroupConfig.forEach(g => {
        if (g.count > 0) {
          for (let i = 1; i <= g.count; i++) {
            const groupName = g.count === 1 ? `${g.grade} Group` : `${g.grade} Group ${i}`;
            validGroupNames.add(groupName);
          }
        }
      });

      // Clear invalid assignments
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
        
        // Also update tracker sheets
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

/**
 * Syncs student group assignments from roster to tracker sheets
 * @param {Spreadsheet} ss - Active spreadsheet
 */
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

/**
 * Opens the Generate Reports modal dialog
 */
function generateReports() {
  const html = HtmlService.createHtmlOutputFromFile('GenerateReportsUI')
    .setWidth(700)
    .setHeight(600)
    .setTitle('Report Generator');
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Report Generator');
}

/**
 * Gets available columns and filters for the report builder
 * @returns {Object} Options and filter data
 */
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

  // Dynamically get skill section columns
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
  
  // Get filter data
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

/**
 * Builds a custom report sheet based on selected columns and filters
 * @param {Array<Object>} selectedColumns - Column configurations
 * @param {Object} filters - Filter settings {grade, group, student}
 * @returns {Object} Result with success status
 */
function buildReport(selectedColumns, filters) {
  const functionName = 'buildReport';
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timestamp = formatDateSafe(new Date(), "yyyy-MM-dd HH:mm");

    // Get students from roster
    const rosterSheet = ss.getSheetByName(SHEET_NAMES.STUDENT_ROSTER);
    if (!rosterSheet || rosterSheet.getLastRow() < LAYOUT.DATA_START_ROW) {
      throw new Error("Student Roster is empty.");
    }
    
    let studentRosterData = rosterSheet.getRange(LAYOUT.DATA_START_ROW, 1, 
                                                  rosterSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 4).getValues();
    
    // Apply filters
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

    // Get data from other sheets as Maps for fast lookup
    const mapData = getSheetDataAsMap(ss, SHEET_NAMES_V2.UFLI_MAP);
    const skillsData = getSheetDataAsMap(ss, SHEET_NAMES_V2.SKILLS);
    const summaryData = getSheetDataAsMap(ss, SHEET_NAMES_V2.GRADE_SUMMARY);

    // Build report data
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

    // Create report sheet
    const reportSheetName = `Report - ${timestamp}`;
    const reportSheet = ss.insertSheet(reportSheetName);
    
    // Write data
    reportSheet.appendRow(reportHeaders);
    if (reportData.length > 0) {
      reportSheet.getRange(2, 1, reportData.length, reportData[0].length).setValues(reportData);
    }
    
    // Format
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

// NOTE: getSheetDataAsMap() is defined in Phase2_ProgressTracking.gs
// This file uses the canonical version from there to avoid duplicate definitions

// ═══════════════════════════════════════════════════════════════════════════
// WEB APP (LESSON ENTRY FORM) - DATA FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets all groups for the lesson entry form dropdown
 * @returns {Array<string>} Sorted array of group names
 */
function getGroupsForForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupSheet = ss.getSheetByName(SHEET_NAMES.GROUP_CONFIG);

  if (!groupSheet || groupSheet.getLastRow() < LAYOUT.DATA_START_ROW) {
    throw new Error("Group Configuration sheet is not set up.");
  }

  // Valid grades to filter by (excludes summary rows like "Group", "Total", etc.)
  const VALID_GRADES = ['PreK', 'KG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];

  // Read Group Name (col 1) and Grade (col 2)
  const data = groupSheet.getRange(LAYOUT.DATA_START_ROW, 1,
                                    groupSheet.getLastRow() - LAYOUT.DATA_START_ROW + 1, 2).getValues();

  // Filter by valid grade in column 2, return group name from column 1
  const allGroupNames = data
    .filter(row => row[0] && row[1] && VALID_GRADES.includes(row[1].toString().trim()))
    .map(row => row[0].toString().trim());

  return allGroupNames.sort();
}

/**
 * Gets lessons and students for a group - CORRECTED VERSION
 * - K-8: Reads from Grade Group sheets (e.g., "KG Groups", "G1 Groups")
 * - PreK: Reads from "Pre-K Data" sheet (HWT curriculum)
 */
function getLessonsAndStudentsForGroup(groupName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const grade = groupName.split(' ')[0]; // "KG Group 1" → "KG", "PreK Group" → "PreK"
  
  Logger.log("=== getLessonsAndStudentsForGroup ===");
  Logger.log("Group requested: " + groupName);
  Logger.log("Grade extracted: " + grade);

  // ═══════════════════════════════════════════════════════════════
  // PRE-K: Uses "Pre-K Data" sheet (Handwriting Without Tears)
  // ═══════════════════════════════════════════════════════════════
  if (grade === "PreK") {
    const preKSheetName = (typeof SHEET_NAMES_PREK !== 'undefined') ? SHEET_NAMES_PREK.DATA : "Pre-K Data";
    const sheet = ss.getSheetByName(preKSheetName);
    if (!sheet) {
      Logger.log("ERROR: Pre-K Data sheet not found");
      return { error: "Sheet '" + preKSheetName + "' not found." };
    }

    const data = sheet.getDataRange().getValues();
    const students = [];
    
    // Pre-K Data Structure:
    // Row 5 (index 4) = Headers: "Student", "Group", "A - Form", "A - Name", etc.
    // Row 6+ (index 5+) = Student data
    const PREK_HEADER_ROW = 4;  // 0-based index for row 5
    const PREK_DATA_START = 5;  // 0-based index for row 6
    
    // Log the header row for debugging
    Logger.log("PreK Headers: " + JSON.stringify(data[PREK_HEADER_ROW]));
    
    for (let i = PREK_DATA_START; i < data.length; i++) {
      const row = data[i];
      const studentName = row[0];  // Column A = Student Name
      const studentGroup = row[1] ? row[1].toString().trim() : "";  // Column B = Group
      
      if (!studentName) continue; // Skip empty rows
      
      // Handle group name matching:
      // Form might send "PreK Group" but data might have "PreK Group 1"
      const groupMatches = (
        studentGroup === groupName ||  // Exact match
        (groupName === "PreK Group" && studentGroup.startsWith("PreK Group")) ||  // "PreK Group" matches "PreK Group 1"
        (studentGroup === "PreK Group" && groupName.startsWith("PreK Group"))     // Vice versa
      );
      
      if (groupMatches) {
        students.push(studentName);
        Logger.log("Found PreK student: " + studentName + " in group: " + studentGroup);
      }
    }

    Logger.log("Total PreK students found: " + students.length);
    
    // PreK doesn't use UFLI lessons - the HTML form handles A-Z letters
    return {
      lessons: [],
      students: students.sort()
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // K-8: Uses Grade Group Sheets (e.g., "KG Groups", "G1 Groups")
  // ═══════════════════════════════════════════════════════════════
  const sheetName = grade + " Groups";  // "KG" → "KG Groups"
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    Logger.log("ERROR: Sheet '" + sheetName + "' not found");
    return { error: "Sheet '" + sheetName + "' not found." };
  }

  const data = sheet.getDataRange().getValues();
  const students = [];
  let lessons = [];
  let inTargetGroup = false;
  let foundLessonRow = false;

  Logger.log("Scanning sheet: " + sheetName);

  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";
    
    // Check if this row is a group header (e.g., "KG Group 1")
    if (cellA.includes("Group") && !cellA.includes("Student")) {
      if (cellA === groupName) {
        inTargetGroup = true;
        foundLessonRow = false;
        Logger.log("Found target group '" + groupName + "' at row " + (i + 1));
      } else if (inTargetGroup) {
        // We've hit the next group header, stop collecting
        Logger.log("Hit next group '" + cellA + "', stopping collection");
        break;
      }
      continue;
    }
    
    // Skip "Student Name" header row
    if (cellA === "Student Name") {
      continue;
    }
    
    // Collect lesson names from the sub-header row (row after "Student Name")
    // This row contains the actual UFLI lesson assignments like "UFLI L7 reteach"
    if (inTargetGroup && !foundLessonRow) {
      // Check if this row has lesson data in column B onwards
      if (data[i][1]) {
        for (let col = 1; col < data[i].length; col++) {
          const lessonName = data[i][col] ? data[i][col].toString().trim() : "";
          if (lessonName) {
            lessons.push({ id: col, name: lessonName });
          }
        }
        foundLessonRow = true;
        Logger.log("Found " + lessons.length + " lessons: " + JSON.stringify(lessons.map(l => l.name)));
        continue;
      }
    }
    
    // Collect student names (rows after the lesson row)
    if (inTargetGroup && foundLessonRow && cellA && cellA !== "(No students assigned)") {
      students.push(cellA);
    }
  }

  Logger.log("Found " + students.length + " students for group: " + groupName);
  
  return {
    lessons: lessons,
    students: students.sort()
  };
}

/**
 * Gets existing Y/N/A data for a specific lesson in a group
 * Used to pre-populate the form when editing an existing lesson entry
 * @param {string} groupName - The group name (e.g., "KG Group 1")
 * @param {string} lessonName - The lesson name (e.g., "UFLI L7")
 * @returns {Object} Map of studentName -> Y/N/A value
 */
function getExistingLessonData(groupName, lessonName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const grade = groupName.split(' ')[0];
  const sheetName = grade + " Groups";
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    Logger.log("getExistingLessonData: Sheet not found: " + sheetName);
    return {};
  }

  const data = sheet.getDataRange().getValues();
  const existingData = {};
  let inTargetGroup = false;
  let lessonColIndex = -1;
  let foundLessonRow = false;

  for (let i = 0; i < data.length; i++) {
    const cellA = data[i][0] ? data[i][0].toString().trim() : "";

    // Check if this row is a group header
    if (cellA.includes("Group") && !cellA.includes("Student")) {
      if (cellA === groupName) {
        inTargetGroup = true;
        foundLessonRow = false;
        lessonColIndex = -1;
      } else if (inTargetGroup) {
        break; // Hit next group
      }
      continue;
    }

    if (cellA === "Student Name") continue;

    // Find the lesson column in the lesson row
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

    // Collect student Y/N/A values
    if (inTargetGroup && foundLessonRow && lessonColIndex >= 0 && cellA && cellA !== "(No students assigned)") {
      const studentName = cellA;
      const value = data[i][lessonColIndex] ? data[i][lessonColIndex].toString().trim().toUpperCase() : "";
      if (value === "Y" || value === "N" || value === "A") {
        existingData[studentName] = value;
      }
    }
  }

  Logger.log("getExistingLessonData: Found " + Object.keys(existingData).length + " existing entries for " + lessonName);
  return existingData;
}

// Helper to get lesson list for standard grades
function getLessonsForGrade(grade) {
  // Define lesson ranges based on UFLI manuals
  let lessonRange = [];
  
  if (grade === "KG") lessonRange = {start: 1, end: 34}; // Foundations
  else if (grade === "G1") lessonRange = {start: 35, end: 68};
  else if (grade === "G2") lessonRange = {start: 69, end: 128};
  else lessonRange = {start: 1, end: 128}; // Default to all

  const lessons = [];
  // Use the global LESSON_LABELS from your System Sheets file if available, 
  // otherwise generate simple labels.
  for (let i = lessonRange.start; i <= lessonRange.end; i++) {
    // Try to use the constant from System Sheets.gs if accessible
    let label = `Lesson ${i}`;
    try {
      if (typeof LESSON_LABELS !== 'undefined' && LESSON_LABELS[i]) {
        label = LESSON_LABELS[i];
      }
    } catch(e) {
      // Fallback if constant isn't reachable
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
 * Saves lesson data from the web app form
 * @param {Object} data - Form data {groupName, lessonName, teacherName, studentStatuses}
 * @returns {Object} Result with success status
 */
/**
 * MASTER HUB: Saves lesson data and updates all relevant sheets instantly.
 * Updated: v3.1.2 - Includes Master MAP update and Batch Optimizations.
 */
/**
 * Saves lesson data submitted by the HTML form.
 * Includes lock protection for concurrent write operations.
 * UPDATED: Redirects 'PreK' writes to 'Pre-K Data' sheet.
 * @param {Object} formObject - Form data {groupName, lessonName, teacherName, studentStatuses}
 * @returns {Object} Result with success status and message
 */
function saveLessonData(formObject) {
  const functionName = 'saveLessonData';
  const lock = LockService.getScriptLock();

  try {
    // Acquire lock with 15 second timeout to prevent concurrent modifications
    if (!lock.tryLock(15000)) {
      logMessage(functionName, 'Could not acquire lock - another save may be in progress', 'WARN');
      return { success: false, message: 'Another save is in progress. Please try again in a moment.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const { groupName, lessonName, teacherName, studentStatuses } = formObject;
    const grade = groupName.split(' ')[0];
    // --- PRE-K SAVE LOGIC (Direct to Matrix) ---
    if (grade === "PreK") {
      const sheet = ss.getSheetByName(SHEET_NAMES_PREK.DATA);
      if (!sheet) throw new Error(`Sheet '${SHEET_NAMES_PREK.DATA}' not found.`);

      const data = sheet.getDataRange().getValues();
      const headers = data[PREK_CONFIG.HEADER_ROW - 1]; // Row 5 (Index 4)

      // Find Column Index for the specific Skill (e.g., "A - Name")
      const colIndex = headers.indexOf(lessonName);
      if (colIndex === -1) throw new Error(`Column '${lessonName}' not found in Pre-K Data.`);

      // Update each student
      studentStatuses.forEach(entry => {
        const studentName = entry.name;
        const status = entry.status;

        // Find Student Row
        let rowIndex = -1;
        for (let i = PREK_CONFIG.DATA_START_ROW - 1; i < data.length; i++) {
          if (data[i][0] === studentName) {
            rowIndex = i + 1; // Convert 0-based index to 1-based Row ID
            break;
          }
        }

        if (rowIndex !== -1) {
          // Write Status (Direct Write)
          sheet.getRange(rowIndex, colIndex + 1).setValue(status);
        }
      });

      // Trigger stats update so Grade Summary reflects PreK data
      syncSmallGroupProgress();

      // Update School Summary Dashboard to reflect new PreK data
      updateSchoolSummary();

      return { success: true, message: "Pre-K Data Saved & Synced!" };
    }

    // --- STANDARD K-8 SAVE LOGIC (Log to Progress Sheet) ---
    else {
      const progressSheet = ss.getSheetByName(SHEET_NAMES_V2.SMALL_GROUP_PROGRESS);
      const timestamp = new Date();
      
      const newRows = studentStatuses.map(s => [
        timestamp,
        teacherName,
        groupName,
        s.name,
        lessonName,
        s.status
      ]);

      if (newRows.length > 0) {
        progressSheet.getRange(progressSheet.getLastRow() + 1, 1, newRows.length, 6).setValues(newRows);
      }
      
      // Trigger a sync so the Dashboard updates immediately
      syncSmallGroupProgress();

      return { success: true, message: "Lesson Data Saved & Synced!" };
    }

  } catch (error) {
    logMessage(functionName, `Error saving lesson data: ${error.toString()}`, 'ERROR');
    return { success: false, message: error.toString() };
  } finally {
    // Always release the lock, even if an error occurred
    try {
      lock.releaseLock();
    } catch (e) {
      // Lock may have already been released or expired
      logMessage(functionName, 'Lock release warning: ' + e.toString(), 'WARN');
    }
  }
}

function updateUFLIMapWithStatuses(ss, lessonName, studentStatuses) {
  const mapSheet = ss.getSheetByName(SHEET_NAMES_V2.UFLI_MAP);
  if (!mapSheet) return;

  const lessonNum = extractLessonNumber(lessonName);
  if (!lessonNum) return;

  const lastRow = mapSheet.getLastRow();
  const mapData = mapSheet.getRange(LAYOUT.DATA_START_ROW, 1, lastRow - LAYOUT.DATA_START_ROW + 1, 1).getValues();
  
  const studentRowMap = {};
  mapData.forEach((row, index) => {
    if (row[0]) studentRowMap[row[0].toString().trim().toUpperCase()] = index + LAYOUT.DATA_START_ROW;
  });

  const updates = {};
  const lessonCol = LAYOUT.LESSON_COLUMN_OFFSET + lessonNum;

  studentStatuses.forEach(s => {
    const row = studentRowMap[s.name.trim().toUpperCase()];
    if (row) updates[`${row},${lessonCol}`] = s.status;
  });

  if (Object.keys(updates).length > 0) applyBatchUpdates(mapSheet, updates);
}
function updateGroupSheetWithStatuses(ss, groupName, lessonName, studentStatuses) {
  const gradeMatch = groupName.match(/^([A-Za-z0-9]+)/);
  if (!gradeMatch) return;
  
  const sheetName = gradeMatch[1] + " Groups";
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const lessonNum = extractLessonNumber(lessonName);

  let groupStartRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === groupName && i + 1 < data.length && data[i+1][0] === "Student Name") {
      groupStartRow = i;
      break;
    }
  }
  if (groupStartRow === -1) return;

  const subHeaderRow = data[groupStartRow + 2];
  let lessonColIndex = -1;
  for (let i = 1; i < subHeaderRow.length; i++) {
    if (extractLessonNumber(subHeaderRow[i]) === lessonNum) {
      lessonColIndex = i;
      break;
    }
  }
  if (lessonColIndex === -1) return;

  const groupUpdates = {};
  const statusMap = new Map(studentStatuses.map(s => [s.name.trim().toUpperCase(), s.status]));

  for (let i = groupStartRow + 3; i < data.length; i++) {
    const cellValue = data[i][0] ? data[i][0].toString().trim().toUpperCase() : "";
    if (!cellValue || (cellValue.includes("GROUP") && cellValue !== groupName.toUpperCase())) break;
    
    if (statusMap.has(cellValue)) {
      groupUpdates[`${i + 1},${lessonColIndex + 1}`] = statusMap.get(cellValue);
    }
  }

  if (Object.keys(groupUpdates).length > 0) applyBatchUpdates(sheet, groupUpdates);
}
// ═══════════════════════════════════════════════════════════════════════════════
// PREK ASSESSMENT FUNCTIONS
// Add these functions to your SetupWizard.gs or create a new PreKFunctions.gs file
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get students for a PreK group
 * @param {string} groupName - e.g., "PreK Group 1"
 * @returns {Array} - [{name: "Student Name", group: "PreK Group 1"}, ...]
 */
function getPreKStudentsByGroup(groupName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const preKSheetName = (typeof SHEET_NAMES_PREK !== 'undefined') ? SHEET_NAMES_PREK.DATA : "Pre-K Data";
    const sheet = ss.getSheetByName(preKSheetName);

    if (!sheet) {
      Logger.log('Pre-K Data sheet not found');
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const students = [];
    
    // Find header row (contains "Student" in column A)
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
    
    // Extract group name without number for flexible matching
    // "PreK Group 1" -> "PreK Group"
    const baseGroupName = groupName.replace(/\s+\d+$/, '').trim();
    
    // Collect students from data rows
    for (let i = headerRow + 1; i < data.length; i++) {
      const studentName = data[i][0];
      const studentGroup = data[i][1];
      
      if (!studentName || studentName.toString().trim() === '') continue;
      
      // Flexible group matching
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
    
    // Sort alphabetically
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
 * @param {string} groupName - e.g., "PreK Group 1"
 * @returns {Array} - [{sequenceName: "Sequence 1", letters: "A, M, S, T"}, ...]
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
    
    // Structure expected:
    // Row 0 (index 0): Title row (optional)
    // Row 1 (index 1): Empty or spacer
    // Row 2 (index 2): Sequence headers - "Sequence 1", "Sequence 2", etc. in columns C, E, G...
    // Row 3 (index 3): Column headers - "Group", "Skills", "Letters", "Assess", "Letters", "Assess"...
    // Row 4+ (index 4+): Group data
    
    // Find the sequence header row (contains "Sequence" in some cell)
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
    
    // If no sequence row found, assume it's one row above header
    if (sequenceRow === -1) {
      sequenceRow = headerRow - 1;
    }
    
    // Find the group row
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
    
    // Extract sequences from column C onwards (every other column: C, E, G, I...)
    // Column indices: 2, 4, 6, 8... (0-indexed)
    let seqNum = 1;
    for (let col = 2; col < data[groupRow].length; col += 2) {
      const letters = data[groupRow][col];
      
      if (letters && letters.toString().trim() !== '') {
        // Get sequence name from sequence row, or generate one
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
 * @param {string} studentName
 * @param {string} groupName
 * @param {string} sequenceName
 * @returns {Object} - {lessons: ["A - Form", "A - Name", ...], currentData: {"A - Form": "Y", ...}}
 */
function getPreKAssessmentData(studentName, groupName, sequenceName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get the sequence info to find which letters
    const sequences = getPreKSequences(groupName);
    const sequence = sequences.find(s => s.sequenceName === sequenceName);
    
    if (!sequence) {
      Logger.log('Sequence not found: ' + sequenceName);
      return { lessons: [], currentData: {} };
    }
    
    // Parse letters from sequence (e.g., "A, M, S, T" -> ["A", "M", "S", "T"])
    const letters = sequence.letters.split(',').map(l => l.trim().toUpperCase());
    
    // Get skills from PreK Pacing (column B for the group)
    const skills = getPreKSkillsForGroup(groupName);
    
    // Build lesson names: "A - Form", "A - Name", "A - Sound", etc.
    const lessons = [];
    letters.forEach(letter => {
      skills.forEach(skill => {
        lessons.push(letter + ' - ' + skill);
      });
    });
    
    // Get current data from Pre-K Data sheet
    const currentData = {};
    const preKSheetName = (typeof SHEET_NAMES_PREK !== 'undefined') ? SHEET_NAMES_PREK.DATA : "Pre-K Data";
    const sheet = ss.getSheetByName(preKSheetName);
    
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      
      // Find header row
      let headerRow = -1;
      for (let i = 0; i < Math.min(10, data.length); i++) {
        if (data[i][0] && data[i][0].toString().toLowerCase() === 'student') {
          headerRow = i;
          break;
        }
      }
      
      if (headerRow >= 0) {
        // Build column map from headers
        const headers = data[headerRow];
        const colMap = {};
        for (let c = 0; c < headers.length; c++) {
          if (headers[c]) {
            colMap[headers[c].toString().trim()] = c;
          }
        }
        
        // Find student row
        for (let i = headerRow + 1; i < data.length; i++) {
          if (data[i][0] && data[i][0].toString().trim() === studentName) {
            // Extract current values for each lesson
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
 * Get the skills tracked for a PreK group (from PreK Pacing column B)
 * @param {string} groupName
 * @returns {Array} - ["Form", "Name", "Sound"]
 */
function getPreKSkillsForGroup(groupName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PreK Pacing');
    
    // Default skills if not found
    const defaultSkills = ['Form', 'Name', 'Sound'];
    
    if (!sheet) {
      return defaultSkills;
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Find header row and group row
    let headerRow = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i][0] && data[i][0].toString().toLowerCase() === 'group') {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) return defaultSkills;
    
    // Find group row
    const baseGroupName = groupName.replace(/\s+\d+$/, '').trim();
    
    for (let i = headerRow + 1; i < data.length; i++) {
      const rowGroup = data[i][0] ? data[i][0].toString().trim() : '';
      const rowBaseGroup = rowGroup.replace(/\s+\d+$/, '').trim();
      
      if (rowGroup === groupName || rowBaseGroup === baseGroupName ||
          groupName.includes(rowGroup) || rowGroup.includes(baseGroupName)) {
        // Column B contains skills like "Letter Name, Letter Sound, Letter Form"
        const skillsStr = data[i][1] ? data[i][1].toString() : '';
        
        if (skillsStr) {
          // Parse skills - handle both "Letter Name" and just "Name" formats
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
 * @param {Object} formData - {studentName, groupName, assessments: {"A - Form": "Y", ...}}
 * @returns {Object} - {success: boolean, message: string}
 */
function savePreKAssessmentData(formData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const preKSheetName = (typeof SHEET_NAMES_PREK !== 'undefined') ? SHEET_NAMES_PREK.DATA : "Pre-K Data";
    const sheet = ss.getSheetByName(preKSheetName);

    if (!sheet) {
      return { success: false, message: 'Pre-K Data sheet not found' };
    }
    
    const { studentName, groupName, assessments } = formData;
    
    if (!studentName || !assessments) {
      return { success: false, message: 'Missing required data' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Find header row
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
    
    // Build column map
    const headers = data[headerRow];
    const colMap = {};
    for (let c = 0; c < headers.length; c++) {
      if (headers[c]) {
        colMap[headers[c].toString().trim()] = c;
      }
    }
    
    // Find student row
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
    
    // Update each assessment
    let updatedCount = 0;
    for (const [lessonName, value] of Object.entries(assessments)) {
      if (colMap[lessonName] !== undefined && value) {
        // Sheet is 1-indexed, data is 0-indexed
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
// TEST FUNCTIONS - Run these to verify setup
// ═══════════════════════════════════════════════════════════════════════════════

function testPreKFunctions() {
  // Test 1: Get students
  Logger.log('=== TEST: getPreKStudentsByGroup ===');
  const students = getPreKStudentsByGroup('PreK Group 1');
  Logger.log('Students: ' + JSON.stringify(students));
  
  // Test 2: Get sequences
  Logger.log('\n=== TEST: getPreKSequences ===');
  const sequences = getPreKSequences('PreK Group 1');
  Logger.log('Sequences: ' + JSON.stringify(sequences));
  
  // Test 3: Get skills
  Logger.log('\n=== TEST: getPreKSkillsForGroup ===');
  const skills = getPreKSkillsForGroup('PreK Group 1');
  Logger.log('Skills: ' + JSON.stringify(skills));
  
  // Test 4: Get assessment data (if we have a student)
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
