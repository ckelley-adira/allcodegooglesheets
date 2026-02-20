// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE: FEATURE FLAG-DRIVEN onOpen() IMPLEMENTATION
// Use this as a reference for updating your school's Setup Wizard
// ═══════════════════════════════════════════════════════════════════════════
// Version: 4.0 - MODULAR ARCHITECTURE (PHASE 4)
// Last Updated: February 2026
//
// PURPOSE:
// This file demonstrates how to refactor onOpen() to use feature flags from
// SITE_CONFIG.features to conditionally add menu items based on enabled modules.
//
// INSTRUCTIONS FOR IMPLEMENTATION:
// 1. Copy the relevant sections from this file into your school's SetUpWizard.gs
// 2. Replace the hardcoded menu items with calls to buildFeatureMenu()
// 3. Ensure SITE_CONFIG and ModuleLoader.gs are included in your project
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Updated onOpen() function with feature flag support
 * This replaces the hardcoded menu structure with dynamic feature-based menus
 */
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
  
  // 2. Load feature flags from config
  loadSiteConfig();
  
  // 3. Build base menu (always present)
  const baseMenu = ui.createMenu('Adira Reads Progress Report')
    // === PRIMARY ACTIONS (Daily Use) ===
    .addItem('📊 View School Summary', 'goToSchoolSummary')
    .addItem('📈 Generate Reports', 'generateReports')
    .addSeparator()
    
    // === MANAGEMENT (Weekly Use) ===
    .addItem('👥 Manage Students', 'manageStudents')
    .addItem('👨‍🏫 Manage Groups', 'manageGroups')
    .addSeparator()
    
    // === SYNC & PERFORMANCE (Core Feature) ===
    .addSubMenu(ui.createMenu('🔄 Sync & Performance')
      .addItem('⚡ Recalculate All Stats Now', 'recalculateAllStatsNow')
      .addSeparator()
      .addItem('▶️ Process UFLI MAP Queue Now', 'processSyncQueueManual')
      .addItem('✅ Enable Hourly UFLI Sync', 'setupSyncQueueTrigger')
      .addItem('❌ Disable Hourly UFLI Sync', 'disableSyncQueueTrigger')
      .addSeparator()
      .addItem('✅ Enable Nightly Full Sync', 'setupNightlySyncTrigger')
      .addItem('❌ Disable Nightly Full Sync', 'removeNightlySyncTrigger')
      .addItem('ℹ️ Check Sync Status', 'showSyncStatus'));
  
  // 4. Add feature-specific menus (only if enabled)
  buildFeatureMenu(ui, baseMenu);
  
  // 5. Add core maintenance tools (always present)
  baseMenu.addSeparator()
    .addSubMenu(ui.createMenu('🔧 System Tools')
      .addItem('🔧 Repair All Formulas', 'repairAllFormulas')
      .addItem('⚠️ Fix Missing Teachers', 'fixMissingTeachers')
      .addItem('🎨 Repair Formatting', 'repairUFLIMapFormatting'))
    .addSeparator()
    .addItem('⚙️ System Settings', 'openSettings')
    .addItem('🔄 Re-run Setup Wizard', 'startSetupWizard')
    .addToUi();
}

/**
 * Loads SITE_CONFIG from the configuration sheet
 * This ensures feature flags are available before building menus
 */
function loadSiteConfig() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
    
    if (!configSheet) {
      Logger.log('No configuration sheet found, using defaults');
      return;
    }
    
    // Read feature flags from the Feature Settings sheet
    const featureSheet = ss.getSheetByName(SHEET_NAMES.FEATURES);
    if (!featureSheet) {
      Logger.log('No Feature Settings sheet found, using defaults');
      return;
    }
    
    // Parse feature flags
    const featureData = featureSheet.getDataRange().getValues();
    const features = {};
    
    // Skip header rows and read feature flags
    for (let i = 5; i < featureData.length; i++) {
      const featureId = featureData[i][0]; // Column A: Feature ID
      const enabled = featureData[i][1];   // Column B: Enabled (TRUE/FALSE)
      
      if (featureId && featureId !== '') {
        features[featureId] = enabled === true || enabled === 'TRUE';
      }
    }
    
    // Update global SITE_CONFIG
    if (typeof SITE_CONFIG !== 'undefined') {
      SITE_CONFIG.features = features;
    }
    
    Logger.log('Loaded ' + Object.keys(features).length + ' feature flags');
  } catch (e) {
    Logger.log('Error loading site config: ' + e.message);
  }
}

/**
 * Example: Feature-specific function that only runs when feature is enabled
 */
function openFeatureSpecificTool() {
  if (!isFeatureEnabled('adminImport')) {
    SpreadsheetApp.getUi().alert(
      'Feature Not Enabled',
      'The Admin Import feature is not enabled. Please enable it in System Settings.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }
  
  // Feature is enabled, proceed with functionality
  showImportDialog();
}

/**
 * Updated wizard step to configure feature flags
 * This should be added to your existing setup wizard flow
 */
function showFeatureConfigurationStep() {
  const html = HtmlService.createHtmlOutput(getFeatureConfigHtml())
    .setWidth(700)
    .setHeight(600)
    .setTitle('Configure Optional Features');
  SpreadsheetApp.getUi().showModalDialog(html, 'Optional Features');
}

/**
 * HTML for feature configuration dialog
 */
function getFeatureConfigHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; }
    h2 { color: #1a73e8; margin-bottom: 10px; }
    .intro { margin-bottom: 20px; color: #666; }
    .feature-group { margin-bottom: 20px; }
    .feature-item { 
      padding: 15px; 
      border: 1px solid #e0e0e0; 
      border-radius: 4px; 
      margin-bottom: 10px;
      background: #f8f9fa;
    }
    .feature-header { display: flex; align-items: center; margin-bottom: 8px; }
    .feature-checkbox { margin-right: 10px; }
    .feature-name { font-weight: bold; color: #333; }
    .feature-desc { color: #666; font-size: 14px; margin-left: 30px; }
    .button-group { margin-top: 20px; text-align: right; }
    button { 
      padding: 10px 20px; 
      margin-left: 10px; 
      border: none; 
      border-radius: 4px; 
      cursor: pointer;
      font-size: 14px;
    }
    .btn-primary { background: #1a73e8; color: white; }
    .btn-secondary { background: #e0e0e0; color: #333; }
    .btn-primary:hover { background: #1557b0; }
    .btn-secondary:hover { background: #d0d0d0; }
  </style>
</head>
<body>
  <h2>Configure Optional Features</h2>
  <p class="intro">
    Select which optional features you want to enable for your school.
    Features can be enabled or disabled at any time from System Settings.
  </p>
  
  <div class="feature-group">
    <div class="feature-item">
      <div class="feature-header">
        <input type="checkbox" id="mixedGradeSupport" class="feature-checkbox">
        <label for="mixedGradeSupport" class="feature-name">Mixed Grade Support</label>
      </div>
      <div class="feature-desc">
        Enable grouping students across multiple grade levels by skill.
        Required for schools with cross-grade grouping (e.g., G6+G7+G8).
      </div>
    </div>
    
    <div class="feature-item">
      <div class="feature-header">
        <input type="checkbox" id="coachingDashboard" class="feature-checkbox">
        <label for="coachingDashboard" class="feature-name">Weekly Coaching Dashboard</label>
      </div>
      <div class="feature-desc">
        Weekly metrics and week-over-week performance tracking for coaching staff.
        Adds Coach Tools menu with dashboard and refresh options.
      </div>
    </div>
    
    <div class="feature-item">
      <div class="feature-header">
        <input type="checkbox" id="tutoringSystem" class="feature-checkbox">
        <label for="tutoringSystem" class="feature-name">Tutoring System</label>
      </div>
      <div class="feature-desc">
        Dual-track progress tracking: Whole Group UFLI + Tutoring Interventions.
        Required for schools running separate tutoring programs.
      </div>
    </div>
    
    <div class="feature-item">
      <div class="feature-header">
        <input type="checkbox" id="grantReporting" class="feature-checkbox">
        <label for="grantReporting" class="feature-name">Grant Reporting</label>
      </div>
      <div class="feature-desc">
        Automated grant report generation (e.g., Mind Trust Summary).
        Required for schools reporting to grant funders.
      </div>
    </div>
    
    <div class="feature-item">
      <div class="feature-header">
        <input type="checkbox" id="growthHighlighter" class="feature-checkbox">
        <label for="growthHighlighter" class="feature-name">Growth Highlighter</label>
      </div>
      <div class="feature-desc">
        Visual highlighting of students with growth in specific skill areas.
        Adds Growth Highlighter sidebar for quick visual identification.
      </div>
    </div>
    
    <div class="feature-item">
      <div class="feature-header">
        <input type="checkbox" id="adminImport" class="feature-checkbox">
        <label for="adminImport" class="feature-name">Admin Import Tools</label>
      </div>
      <div class="feature-desc">
        Historical data import with validation and exception reporting.
        Required for migrating from legacy systems or bulk data imports.
      </div>
    </div>
    
    <div class="feature-item">
      <div class="feature-header">
        <input type="checkbox" id="unenrollmentAutomation" class="feature-checkbox">
        <label for="unenrollmentAutomation" class="feature-name">Unenrollment Automation</label>
      </div>
      <div class="feature-desc">
        Automatic archival and Monday.com integration for unenrolled students.
        Required for schools using Monday.com workflow tracking.
      </div>
    </div>
  </div>
  
  <div class="button-group">
    <button class="btn-secondary" onclick="google.script.host.close()">Cancel</button>
    <button class="btn-primary" onclick="saveFeatureConfig()">Save Configuration</button>
  </div>
  
  <script>
    function saveFeatureConfig() {
      const features = {
        mixedGradeSupport: document.getElementById('mixedGradeSupport').checked,
        coachingDashboard: document.getElementById('coachingDashboard').checked,
        tutoringSystem: document.getElementById('tutoringSystem').checked,
        grantReporting: document.getElementById('grantReporting').checked,
        growthHighlighter: document.getElementById('growthHighlighter').checked,
        adminImport: document.getElementById('adminImport').checked,
        unenrollmentAutomation: document.getElementById('unenrollmentAutomation').checked
      };
      
      google.script.run
        .withSuccessHandler(() => {
          alert('Feature configuration saved successfully!');
          google.script.host.close();
        })
        .withFailureHandler((error) => {
          alert('Error saving configuration: ' + error.message);
        })
        .saveFeatureConfiguration(features);
    }
  </script>
</body>
</html>
  `;
}

/**
 * Server-side function to save feature configuration
 */
function saveFeatureConfiguration(features) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const featureSheet = ss.getSheetByName(SHEET_NAMES.FEATURES);
    
    if (!featureSheet) {
      throw new Error('Feature Settings sheet not found');
    }
    
    // Update each feature flag
    const featureIds = Object.keys(features);
    const data = featureSheet.getDataRange().getValues();
    
    for (let i = 5; i < data.length; i++) {
      const featureId = data[i][0];
      if (featureIds.includes(featureId)) {
        featureSheet.getRange(i + 1, 2).setValue(features[featureId]);
      }
    }
    
    Logger.log('Feature configuration saved');
    return true;
  } catch (e) {
    Logger.log('Error saving feature configuration: ' + e.message);
    throw e;
  }
}
