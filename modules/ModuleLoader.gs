// ═══════════════════════════════════════════════════════════════════════════
// MODULE LOADER - Feature Flag-Driven Module Loading
// ═══════════════════════════════════════════════════════════════════════════
// Version: 4.0 - MODULAR ARCHITECTURE (PHASE 4)
// Last Updated: February 2026
//
// PURPOSE:
// This module is responsible for dynamically loading feature modules based on
// SITE_CONFIG.features flags. It provides menu building functions that respect
// feature flags and only add menu items/submenus when features are enabled.
//
// USAGE:
// 1. Include this file in your school's Apps Script project
// 2. Call buildFeatureMenu() from your onOpen() function
// 3. Modules are automatically loaded when their feature flags are enabled
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Builds menu items for enabled feature modules
 * @param {Ui} ui - SpreadsheetApp.getUi() object
 * @param {Menu} baseMenu - Base menu to add feature items to
 * @returns {Menu} Menu with feature items added
 */
function buildFeatureMenu(ui, baseMenu) {
  const features = SITE_CONFIG.features;
  
  // Add Coaching Dashboard menu if enabled
  if (features.coachingDashboard) {
    var coachLabel = getFeatureMenuLabel('coachingDashboard', 'Coach Tools', '👨‍🏫');
    baseMenu.addSubMenu(ui.createMenu(coachLabel.icon + ' ' + coachLabel.label)
      .addItem('📊 Weekly Coaching Dashboard', 'openWeeklyDashboard')
      .addItem('🔄 Refresh Dashboard', 'refreshWeeklyDashboard'));
  }
  
  // Add Tutoring menu if enabled
  if (features.tutoringSystem) {
    var tutorLabel = getFeatureMenuLabel('tutoringSystem', 'Tutoring', '📚');
    baseMenu.addSubMenu(ui.createMenu(tutorLabel.icon + ' ' + tutorLabel.label)
      .addItem('📋 View Tutoring Summary', 'goToTutoringSummary')
      .addItem('📝 View Tutoring Log', 'goToTutoringLog')
      .addSeparator()
      .addItem('🔄 Sync Tutoring Data', 'syncTutoringProgress'));
  }
  
  // Add Grant Reporting menu if enabled
  if (features.grantReporting) {
    var grantLabel = getFeatureMenuLabel('grantReporting', 'Grant Reports', '📊');
    baseMenu.addSubMenu(ui.createMenu(grantLabel.icon + ' ' + grantLabel.label)
      .addItem('📊 Generate Mind Trust Summary', 'generateMindTrustSummary')
      .addItem('⏰ Schedule Mind Trust Report', 'scheduleMindTrustReport')
      .addItem('🚫 Remove Scheduled Report', 'removeMindTrustTrigger'));
  }
  
  // Add Growth Highlighter menu if enabled
  if (features.growthHighlighter) {
    var growthLabel = getFeatureMenuLabel('growthHighlighter', 'Growth Highlighter', '🔍');
    baseMenu.addSubMenu(ui.createMenu(growthLabel.icon + ' ' + growthLabel.label)
      .addItem('Open Utility', 'ghShowSidebar'));
  }
  
  // Add Admin Import menu if enabled
  if (features.adminImport) {
    var adminLabel = getFeatureMenuLabel('adminImport', 'Admin Tools', '🔐');
    baseMenu.addSubMenu(ui.createMenu(adminLabel.icon + ' ' + adminLabel.label)
      .addItem('📂 Open Import Dialog...', 'showImportDialog')
      .addSeparator()
      .addItem('✅ Validate Import Data', 'validateImportData')
      .addItem('▶️ Process Import', 'processImportData')
      .addSeparator()
      .addItem('🗑️ Clear Import Staging', 'clearImportStaging')
      .addItem('📋 View Import Exceptions', 'goToExceptionsSheet')
      .addSeparator()
      .addItem('🔄 Refresh Grade Summary Values', 'refreshGradeSummaryFormulas'));
  }
  
  return baseMenu;
}

/**
 * Checks if mixed grade support is enabled and returns the appropriate grade list
 * @param {string} gradeCode - Grade code (e.g., "KG", "G1")
 * @returns {Array<string>} Array of grades (single grade or mixed grades)
 */
function getGradeList(gradeCode) {
  if (!isFeatureEnabled('mixedGradeSupport')) {
    return [gradeCode];
  }
  
  // Check if this grade is part of a mixed-grade configuration
  const mixedConfig = getFeatureConfig('mixedGradeSupport');
  if (!mixedConfig || !mixedConfig.enabled) {
    return [gradeCode];
  }
  
  // Parse combinations from config
  // Format: "G6+G7+G8, G1+G2+G3+G4"
  const combinations = mixedConfig.combinations || "";
  const combos = combinations.split(',').map(c => c.trim());
  
  for (const combo of combos) {
    const grades = combo.split('+').map(g => g.trim());
    if (grades.includes(gradeCode)) {
      return grades;
    }
  }
  
  return [gradeCode];
}

/**
 * Gets the sheet name for a grade (handles mixed grades)
 * @param {string} gradeCode - Grade code (e.g., "KG", "G1")
 * @returns {string} Sheet name
 */
function getSheetNameForGradeCode(gradeCode) {
  if (!isFeatureEnabled('mixedGradeSupport')) {
    return gradeCode + " Groups";
  }
  
  const grades = getGradeList(gradeCode);
  if (grades.length === 1) {
    return gradeCode + " Groups";
  }
  
  // Mixed grades - use first and last grade
  return grades[0] + " to " + grades[grades.length - 1] + " Groups";
}

/**
 * Initializes feature modules that need setup
 * Call this after system configuration is complete
 */
function initializeFeatureModules() {
  const features = SITE_CONFIG.features;
  
  // Initialize Mixed Grade Support
  if (features.mixedGradeSupport) {
    Logger.log('Mixed Grade Support module enabled');
    // Module functions are automatically available
  }
  
  // Initialize Coaching Dashboard
  if (features.coachingDashboard) {
    Logger.log('Coaching Dashboard module enabled');
    // Create dashboard sheet if needed
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const dashboardSheet = ss.getSheetByName('Weekly Coaching Dashboard');
      if (!dashboardSheet) {
        Logger.log('Creating Weekly Coaching Dashboard sheet');
        // Dashboard will be created on first refresh
      }
    } catch (e) {
      Logger.log('Error initializing Coaching Dashboard: ' + e.message);
    }
  }
  
  // Initialize Tutoring System
  if (features.tutoringSystem) {
    Logger.log('Tutoring System module enabled');
    // Tutoring sheets will be created by the module functions
  }
  
  // Initialize Grant Reporting
  if (features.grantReporting) {
    Logger.log('Grant Reporting module enabled');
    // Check if auto-schedule is enabled
    const grantConfig = getFeatureConfig('grantReporting');
    if (grantConfig.autoSchedule) {
      Logger.log('Grant reports will be auto-scheduled');
    }
  }
  
  // Initialize Admin Import
  if (features.adminImport) {
    Logger.log('Admin Import module enabled');
    // Import sheets will be created by import dialog
  }
  
  // Initialize Unenrollment Automation
  if (features.unenrollmentAutomation) {
    Logger.log('Unenrollment Automation module enabled');
    // Check Monday.com configuration
    const unenrollConfig = getFeatureConfig('unenrollmentAutomation');
    if (unenrollConfig.createMondayTask && !unenrollConfig.mondayBoardId) {
      Logger.log('WARNING: Monday.com integration enabled but no board ID configured');
    }
  }
  
  Logger.log('Feature module initialization complete');
}

/**
 * Returns a summary of enabled features for display
 * @returns {string} HTML-formatted feature summary
 */
function getEnabledFeaturesDisplay() {
  const enabled = getEnabledFeatures();
  
  if (enabled.length === 0) {
    return '<p>No optional features are currently enabled.</p>';
  }
  
  const featureNames = {
    mixedGradeSupport: 'Mixed Grade Support',
    coachingDashboard: 'Weekly Coaching Dashboard',
    tutoringSystem: 'Tutoring System',
    grantReporting: 'Grant Reporting',
    growthHighlighter: 'Growth Highlighter',
    adminImport: 'Admin Import Tools',
    unenrollmentAutomation: 'Unenrollment Automation'
  };
  
  let html = '<p><strong>Enabled Features:</strong></p><ul>';
  enabled.forEach(feature => {
    html += '<li>' + (featureNames[feature] || feature) + '</li>';
  });
  html += '</ul>';
  
  return html;
}
