// ═══════════════════════════════════════════════════════════════════════════
// SITE CONFIGURATION TEMPLATE
// Instructions for configuring optional feature modules
// ═══════════════════════════════════════════════════════════════════════════
// Version: 7.0 - UNIFIED SCHOOL SITE TEMPLATE (PHASE 7)
// Last Updated: February 2026
//
// PURPOSE:
// This template defines ALL school-specific configuration for the UFLI
// Master System. When combined with UnifiedConfig.gs and
// UnifiedPhase2_ProgressTracking.gs, it eliminates the need for per-school
// copies of logic files. Each feature and layout option can be configured
// via the SetUp Wizard or by editing this file directly.
//
// USAGE:
// 1. Deploy the template package to a new Google Sheet
// 2. Run the SetUp Wizard (it auto-launches on first open)
// 3. All settings below are written by the wizard — or edit directly
// 4. Features are automatically activated/deactivated in menus and sheets
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Site Configuration Object
 * This object controls all optional features in the system
 */
const SITE_CONFIG = {
  // ═══════════════════════════════════════════════════════════════════════════
  // BASIC SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  schoolName: "Your School Name",
  systemVersion: "7.0",

  // ═══════════════════════════════════════════════════════════════════════════
  // GRADE RANGE MODEL (Phase 7)
  // Determines which grades this school serves and Pre-K inclusion.
  // Selecting a preset auto-populates the gradesServed list via the wizard.
  // Valid values: "prek_only", "k5", "k8", "prek_8", "custom"
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * GRADE RANGE MODEL
   * Preset grade range for the school. Selecting a preset auto-populates
   * the gradesServed list. Use "custom" for school-defined grade lists.
   * Valid values: "prek_only", "k5", "k8", "prek_8", "custom"
   */
  gradeRangeModel: "custom",

  /**
   * Explicit list of active grade codes (used when gradeRangeModel is "custom"
   * or to override model defaults).
   * Valid values: "PreK", "KG", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"
   */
  gradesServed: [],

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET LAYOUT (Phase 7)
  // Controls how tracking sheets are structured. These values are resolved
  // by UnifiedConfig.gs into the LAYOUT object used by all modules.
  // dataStartRow: First row containing student data (= headerRowCount + 1).
  // lessonColumnOffset: 0-based column index where lesson data begins.
  // ═══════════════════════════════════════════════════════════════════════════
  layout: {
    headerRowCount: 5,          // Number of header rows (3-10)
    dataStartRow: 6,            // First data row = headerRowCount + 1
    lessonColumnOffset: 5,      // 0-based offset to first lesson column (default 5 = col F)
    lessonsPerGroupSheet: 12,   // Lesson columns shown on each group sheet
    groupFormat: "standard",    // "standard", "condensed", "expanded", "sankofa", "prek"
    includeSCClassroom: false   // Add Self-Contained Classroom column
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BRANDING
  // Visual identity and styling for all UI components
  // Defaults are applied automatically during onboarding if values are empty.
  // Schools may configure full branding or rely on these defaults.
  // ═══════════════════════════════════════════════════════════════════════════
  branding: {
    schoolName: "Your School Name",
    shortName: "",
    tagline: "Innovate. Educate. Empower.",
    logoUrl: "",  // Google Drive file ID or public URL
    primaryColor: "#B8E6DC",  // Main accent color for UI elements
    headerGradientStart: "#4A90E2",  // Setup wizard header gradient start
    headerGradientEnd: "#357ABD",  // Setup wizard header gradient end
    accentColor: "#4A90A4"  // Secondary accent for sidebars and highlights
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VERSION TRACKING
  // Tracks upgrade history for schools migrating from legacy configurations.
  // previousVersions: Array of prior systemVersion values before upgrade.
  // upgradeDate: ISO date string of last upgrade.
  // legacyConfigFormat: Set to the legacy format name if migrated (e.g., "v3.2").
  // ═══════════════════════════════════════════════════════════════════════════
  versionTracking: {
    previousVersions: [],    // e.g., ["3.0", "3.2"]
    upgradeDate: "",         // e.g., "2026-02-19"
    legacyConfigFormat: ""   // e.g., "v3.2" if migrated from older config
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MENU CUSTOMIZATION
  // Override default menu labels and icons per school.
  // If a key is omitted or empty, the built-in default is used.
  // ═══════════════════════════════════════════════════════════════════════════
  menuCustomization: {
    // Override the top-level menu name (default: school short name or "UFLI Tools")
    menuName: "",
    // Override individual feature menu labels/icons
    // Keys match feature flag names; values are { label, icon } objects
    featureLabels: {}
    // Example:
    // featureLabels: {
    //   coachingDashboard: { label: "Coaching", icon: "📋" },
    //   adminImport:       { label: "Data Import", icon: "📂" }
    // }
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE FLAGS
  // Set to true to enable, false to disable
  // ═══════════════════════════════════════════════════════════════════════════
  features: {
    /**
     * PRE-K ONLY MODE
     * Selects the Pre-K–specific sheet layout (Pre-K Data, Pre-K Pacing,
     * Pre-K Summary) and skips UFLI lesson-based sheets during onboarding.
     * For mixed-grade sites that include Pre-K alongside K–8 grades, leave
     * this false and add "PreK" to the grade list instead.
     * Required for: Sites serving only Pre-K students
     * Adds: Pre-K–only sheet generation and dashboard
     */
    preKOnlyMode: false,
    
    /**
     * MIXED GRADE SUPPORT
     * Enables grouping students across multiple grade levels
     * Required for: Schools with cross-grade skill-based grouping
     * Adds: Mixed-grade sheet generation, cross-grade reporting
     * File: modules/MixedGradeSupport.gs
     */
    mixedGradeSupport: false,
    
    /**
     * COACHING DASHBOARD
     * Weekly coaching metrics and week-over-week performance tracking
     * Required for: Schools with coaching staff needing performance visibility
     * Adds: "Weekly Coaching Dashboard" sheet, "Coach Tools" menu
     * File: modules/CoachingDashboard.gs
     */
    coachingDashboard: false,
    
    /**
     * TUTORING SYSTEM
     * Dual-track progress: Whole Group UFLI + Tutoring Interventions
     * Required for: Schools running separate tutoring/intervention programs
     * Adds: "Tutoring Progress Log", "Tutoring Summary" sheets, "Tutoring" menu
     * File: modules/TutoringSystem.gs
     */
    tutoringSystem: false,
    
    /**
     * GRANT REPORTING
     * Automated grant report generation (e.g., Mind Trust Summary)
     * Required for: Schools reporting to grant funders
     * Adds: Grant report sheets, scheduled report generation, "Grant Reports" menu
     * File: modules/GrantReporting.gs
     */
    grantReporting: false,
    
    /**
     * GROWTH HIGHLIGHTER
     * Visual highlighting of students with growth in specific skill areas
     * Required for: Quick visual identification of student progress
     * Adds: "Growth Highlighter" sidebar, visual highlighting utility
     * File: modules/GrowthHighlighter.gs
     */
    growthHighlighter: false,
    
    /**
     * ADMIN IMPORT
     * Historical data import with validation and exception reporting
     * Required for: Migrating from legacy systems or bulk data imports
     * Adds: "Admin Tools" menu, import dialog, validation, exception reporting
     * File: modules/AdminImport.gs
     */
    adminImport: false,
    
    /**
     * ENHANCED SECURITY
     * Input sanitization and formula injection prevention
     * Required for: All schools (default: ON)
     * Adds: sanitizeCellValue() for all user inputs
     * Security: Prevents formula injection, null bytes, enforces length limits
     */
    enhancedSecurity: true,
    
    /**
     * STRUCTURED LOGGING
     * Detailed logging for troubleshooting and auditing
     * Required for: Schools needing audit trails (Allegiant)
     * Adds: log(func, msg, lvl) structured logging
     * Usage: Set to true to enable diagnostic logging in AdminImport
     */
    structuredLogging: false,
    
    /**
     * UNENROLLMENT AUTOMATION
     * Automatic archival and Monday.com integration for unenrolled students
     * Required for: Schools using Monday.com workflow tracking
     * Adds: Automatic student archival, Monday.com task creation, "Student Archive" sheet
     * File: modules/UnenrollmentAutomation.gs
     */
    unenrollmentAutomation: false,
    
    /**
     * SC CLASSROOM GROUPS
     * Special needs classroom with wide grade range
     * Required for: Schools with SC programs (Adelante, Sankofa)
     * Adds: SC Classroom sheet generation and tracking
     * Configuration: MIXED_GRADE_CONFIG.scClassroom
     */
    scClassroomGroups: false,
    
    /**
     * CO-TEACHING SUPPORT
     * Partner group tracking for co-taught classes
     * Required for: Schools with co-teaching model (Sankofa)
     * Adds: getPartnerGroup(), isCoTeachingGroup(), co-teaching pair management
     * Configuration: MIXED_GRADE_CONFIG.coTeaching
     */
    coTeachingSupport: false,
    
    /**
     * DYNAMIC BRANDING
     * Enables sheet logo insertion and custom color schemes
     * Required for: Schools with strong brand identity (Adelante, CHAW)
     * Adds: loadSchoolBranding(), insertSheetLogo(), applySheetBranding()
     * Dependencies: Branding configuration in SITE_CONFIG.branding
     * Extension: AdelanteBrandingExtensions.gs, CHAWBrandingExtensions.gs
     */
    dynamicBranding: false,
    
    /**
     * SKILL AVERAGES ANALYTICS
     * Adds skill-based performance metrics to dashboard
     * Required for: Schools tracking skill mastery (CCA)
     * Adds: calculateSkillAverages(), renderSkillAveragesRow()
     * Dashboard: Additional "Skill Averages" row on School Summary
     * Extension: CCASkillsExtensions.gs
     */
    skillAveragesAnalytics: false,
    
    /**
     * DIAGNOSTIC TOOLS
     * Testing and validation utilities for troubleshooting
     * Required for: Schools needing advanced diagnostics
     * Adds: testGroupSheetStructure(), validation utilities
     * Menu: "System Tools" > "Run Diagnostics"
     */
    diagnosticTools: false,
    
    /**
     * LESSON ARRAY TRACKING
     * Tracks lessons as arrays for batch operations
     * Required for: Most schools (default: ON)
     * Adds: updateGroupArrayByLessonName()
     * Performance: Optimizes multi-lesson updates
     */
    lessonArrayTracking: true,
    
    /**
     * STUDENT NORMALIZATION
     * Auto-normalize student name fields (capitalization, spacing)
     * Required for: Schools with data quality needs (Adelante)
     * Adds: normalizeStudent() validation
     * Extension: AdelanteBrandingExtensions.gs (normalizeStudent function)
     */
    studentNormalization: false,
    
    /**
     * DYNAMIC STUDENT ROSTER
     * Allow dynamic addition of students to tracking sheets
     * Required for: Schools managing rosters mid-year (Allegiant, GlobalPrep, CCA)
     * Adds: addStudentToSheet() in Phase2 tracking
     */
    dynamicStudentRoster: false,
    
    /**
     * UFLI MAP QUEUE
     * Deferred UFLI MAP updates via sync queue for faster form submissions
     * Required for: Schools using queued UFLI MAP processing (most schools)
     * Adds: addToSyncQueue(), processSyncQueue() workflow
     * Menu: "Sync & Performance" > "Process UFLI MAP Queue Now"
     */
    ufliMapQueue: true,
    
    /**
     * SYNC QUEUE PROCESSING
     * Periodic processing of queued UFLI MAP updates (hourly trigger)
     * Required for: Schools using queued sync (most schools)
     * Adds: setupSyncQueueTrigger(), disableSyncQueueTrigger()
     * Menu: "Sync & Performance" > "Enable/Disable Hourly UFLI Sync"
     */
    syncQueueProcessing: true,
    
    /**
     * NIGHTLY SYNC AUTOMATION
     * Full nightly sync trigger for complete data reconciliation
     * Required for: Schools needing overnight data refresh (Adelante, Allegiant, Sankofa, CHAW)
     * Adds: setupNightlySyncTrigger(), removeNightlySyncTrigger()
     * Menu: "Sync & Performance" > "Enable/Disable Nightly Full Sync"
     */
    nightlySyncAutomation: true,
    
    /**
     * SYNC STATUS MONITORING
     * Dashboard for viewing sync queue status and trigger health
     * Required for: Schools needing sync visibility (Adelante, CHAW)
     * Adds: showSyncStatus() dialog
     * Menu: "Sync & Performance" > "Check Sync Status"
     */
    syncStatusMonitoring: false,
    
    /**
     * FORMULA REPAIR TOOLS
     * Grade Summary formula refresh and student formula update utilities
     * Required for: Schools with complex formula dependencies (CCA)
     * Adds: refreshGradeSummaryFormulas(), updateFormulasForNewStudents()
     * Menu: "System Tools" > "Repair All Formulas"
     */
    formulaRepairTools: false,
    
    /**
     * STUDENT EDIT CAPABILITY
     * In-sheet student record editing (name, grade, status changes)
     * Required for: Schools managing student data directly (Allegiant, GlobalPrep, CCA)
     * Adds: editStudentRecord(), updateStudentStatus() in student management
     */
    studentEditCapability: false
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE MODULE CONFIGURATION
// School-specific settings for each feature module
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mixed Grade Support Configuration
 * Only used if features.mixedGradeSupport = true
 */
const MIXED_GRADE_CONFIG = {
  // Enable mixed grades
  enabled: false, // Set to true if you combine grades in groups
  
  // Sheet format type
  sheetFormat: "STANDARD", // "STANDARD" or "SANKOFA"
  
  // Mixed grade combinations (object mapping sheet names to grade arrays)
  // Example: { "G6 to G8 Groups": ["G6", "G7", "G8"], "KG and G1 Groups": ["KG", "G1"] }
  combinations: {},
  
  // Group naming pattern
  namingPattern: "NUMBERED_TEACHER", // "NUMBERED_TEACHER", "NUMBERED", or "ALPHA"
  
  // SC Classroom configuration (special needs classroom)
  // Note: Enable/disable is controlled via SITE_CONFIG.features.scClassroomGroups
  // Current implementation uses a fixed "SC Classroom" sheet name
  scClassroom: {
    gradeRange: [], // e.g., ["G1", "G2", "G3", "G4"] or ["G1", "G2", "G3", "G4", "G5"]
    hasSubGroups: true,
    sheetName: "SC Classroom"
  },
  
  // Co-teaching configuration (partner group tracking)
  // Note: Enable/disable is controlled via SITE_CONFIG.features.coTeachingSupport
  // Partner group column is defined by GROUP_CONFIG_COLS.PARTNER_GROUP in the unified module
  coTeaching: {
    partnerGroupColumn: 0  // 1-based column index for partner group (0 = disabled)
  }
};

/**
 * Coaching Dashboard Configuration
 * Only used if features.coachingDashboard = true
 */
const COACHING_CONFIG = {
  // Dashboard sheet name
  dashboardSheet: "Weekly Coaching Dashboard",
  
  // Auto-refresh schedule
  autoRefresh: true,
  
  // Lookback period for metrics (weeks)
  lookbackWeeks: 4
};

/**
 * Tutoring System Configuration
 * Only used if features.tutoringSystem = true
 */
const TUTORING_CONFIG = {
  // Tutoring sheet names
  progressLog: "Tutoring Progress Log",
  summary: "Tutoring Summary",
  
  // Lesson categories
  categories: {
    ufliReteach: "UFLI Reteach",
    comprehension: "Comprehension",
    other: "Other"
  }
};

/**
 * Grant Reporting Configuration
 * Only used if features.grantReporting = true
 */
const GRANT_CONFIG = {
  // Grant report sheet name
  reportSheet: "Mind Trust Summary",
  
  // Reporting window (days)
  lookbackDays: 14,
  
  // Performance thresholds
  gapThreshold: 50,      // Skills below this % = gap
  criticalThreshold: 25, // Skills below this % = critical gap
  
  // Auto-schedule reports
  autoSchedule: false,
  scheduleFrequency: 14 // Days between reports
};

/**
 * Growth Highlighter Configuration
 * Only used if features.growthHighlighter = true
 */
const GROWTH_CONFIG = {
  // Highlight color
  highlightColor: '#FFF59D', // Light yellow
  
  // Target group for highlighting
  targetGroup: 'Unenrolled or Finished Sequence'
};

/**
 * Admin Import Configuration
 * Only used if features.adminImport = true
 */
const IMPORT_CONFIG = {
  // Import sheet names
  stagingSheet: "Import Staging",
  exceptionsSheet: "Import Exceptions",
  historicalSheet: "Small Group Historical"
};

/**
 * Unenrollment Automation Configuration
 * Only used if features.unenrollmentAutomation = true
 */
const UNENROLLMENT_CONFIG = {
  // Archive settings
  archiveSheet: "Student Archive",
  autoDeleteFromGroups: true,
  
  // Monday.com integration
  createMondayTask: true,
  mondayBoardId: "", // Set your Monday.com board ID
  
  // Audit logging
  enableAuditLog: true
};

/**
 * Progress Tracking Configuration
 * Settings for Phase2_ProgressTracking_Unified.gs module
 */
const PROGRESS_TRACKING_CONFIG = {
  // Sheet names for progress tracking
  schoolSummary: "School Summary",
  smallGroupProgress: "Small Group Progress",
  ufliMap: "UFLI MAP",
  skillsTracker: "Skills Tracker",
  gradeSummary: "Grade Summary",
  pacingReport: "Pacing Report",
  groupConfig: "Group Config",
  
  // Dashboard configuration
  dashboardMetrics: {
    showGrowthMetrics: true,
    showDistributionBands: true,
    showSkillAverages: false, // Controlled by skillAveragesAnalytics flag
    showPacingAnalysis: true
  },
  
  // Formula repair settings
  autoRepairFormulas: false,  // Set to true to auto-repair on updates
  
  // Progress history settings
  trackHistory: true,
  historyLookbackDays: 90
};

/**
 * Sync & Queue Configuration
 * Settings for UFLI MAP sync queue and nightly automation
 * Only used if features.ufliMapQueue or features.syncQueueProcessing = true
 */
const SYNC_CONFIG = {
  // UFLI MAP sync queue sheet name
  syncQueueSheet: "UFLI Sync Queue",

  // Hourly sync queue trigger interval (minutes)
  syncIntervalMinutes: 60,

  // Nightly full sync trigger hour (0-23, spreadsheet timezone)
  nightlySyncHour: 2,

  // Maximum entries to process per sync run
  batchSize: 200,

  // Status monitoring sheet name
  statusSheet: "Sync Status"
};

/**
 * Branding Configuration
 * School-level visual identity settings (mirrors SITE_CONFIG.branding for
 * standalone access by modules that do not read SITE_CONFIG directly).
 * Only used if features.dynamicBranding = true
 */
const BRANDING_CONFIG = (function() {
  const b = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.branding) || {};
  return {
    // School display name
    schoolName: b.schoolName || "Your School Name",

    // Short name used in menu titles
    shortName: b.shortName || "",

    // Tagline displayed in wizard and reports
    tagline: b.tagline || "Innovate. Educate. Empower.",

    // Google Drive file ID for the school logo
    logoUrl: b.logoUrl || "",

    // Primary header background color
    primaryColor: b.primaryColor || "#B8E6DC",

    // Wizard header gradient start
    headerGradientStart: b.headerGradientStart || "#4A90E2",

    // Wizard header gradient end
    headerGradientEnd: b.headerGradientEnd || "#357ABD",

    // Secondary accent color for sidebars and highlights
    accentColor: b.accentColor || "#4A90A4"
  };
})();

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Checks if a specific feature is enabled
 * @param {string} featureName - Name of the feature (e.g., 'mixedGradeSupport')
 * @returns {boolean} True if feature is enabled
 */
function isFeatureEnabled(featureName) {
  return SITE_CONFIG.features[featureName] === true;
}

/**
 * Gets branding configuration for UI templates
 * Used by HTML files with <?= getBranding().property ?> tokens
 * @returns {Object} Branding configuration
 */
function getBranding() {
  return SITE_CONFIG.branding || {
    schoolName: "UFLI Master System",
    shortName: "",
    tagline: "Innovate. Educate. Empower.",
    logoUrl: "",
    primaryColor: "#B8E6DC",
    headerGradientStart: "#4A90E2",
    headerGradientEnd: "#357ABD",
    accentColor: "#4A90A4"
  };
}

/**
 * Gets the configuration object for a specific feature
 * @param {string} featureName - Name of the feature
 * @returns {Object} Configuration object for the feature
 */
function getFeatureConfig(featureName) {
  const configMap = {
    mixedGradeSupport: MIXED_GRADE_CONFIG,
    coachingDashboard: COACHING_CONFIG,
    tutoringSystem: TUTORING_CONFIG,
    grantReporting: GRANT_CONFIG,
    growthHighlighter: GROWTH_CONFIG,
    adminImport: IMPORT_CONFIG,
    unenrollmentAutomation: UNENROLLMENT_CONFIG,
    progressTracking: PROGRESS_TRACKING_CONFIG,
    ufliMapQueue: SYNC_CONFIG,
    syncQueueProcessing: SYNC_CONFIG,
    nightlySyncAutomation: SYNC_CONFIG,
    syncStatusMonitoring: SYNC_CONFIG,
    dynamicBranding: BRANDING_CONFIG
  };
  
  return configMap[featureName] || {};
}

/**
 * Returns all enabled features
 * @returns {Array<string>} Array of enabled feature names
 */
function getEnabledFeatures() {
  return Object.keys(SITE_CONFIG.features).filter(feature => 
    SITE_CONFIG.features[feature] === true
  );
}

/**
 * Returns the effective menu name for the top-level UFLI menu.
 * Uses menuCustomization.menuName if set, otherwise falls back to
 * the school short name or "UFLI Tools".
 * @returns {string} Menu name
 */
function getMenuName() {
  const custom = (SITE_CONFIG.menuCustomization || {}).menuName;
  if (custom) return custom;
  const short = (SITE_CONFIG.branding || {}).shortName;
  return short || "UFLI Tools";
}

/**
 * Returns the display label and icon for a feature menu item.
 * Checks menuCustomization.featureLabels first, then uses the provided defaults.
 * @param {string} featureName - Feature flag name
 * @param {string} defaultLabel - Default label text
 * @param {string} defaultIcon - Default emoji icon
 * @returns {{label: string, icon: string}}
 */
function getFeatureMenuLabel(featureName, defaultLabel, defaultIcon) {
  const overrides = ((SITE_CONFIG.menuCustomization || {}).featureLabels || {})[featureName];
  return {
    label: (overrides && overrides.label) || defaultLabel,
    icon: (overrides && overrides.icon) || defaultIcon
  };
}

/**
 * Detects whether the current site is a Pre-K–only deployment.
 * A site is Pre-K–only when the preKOnlyMode feature flag is true.
 * @returns {boolean}
 */
function isPreKOnlySite() {
  return SITE_CONFIG.features.preKOnlyMode === true;
}

/**
 * Returns true when the site was migrated from a legacy configuration format.
 * Useful for gating backward-compatible behavior.
 * @returns {boolean}
 */
function isLegacyUpgrade() {
  var tracking = SITE_CONFIG.versionTracking || {};
  return !!(tracking.legacyConfigFormat);
}

/**
 * Returns the version tracking metadata for this site.
 * @returns {{previousVersions: Array<string>, upgradeDate: string, legacyConfigFormat: string}}
 */
function getVersionTracking() {
  return SITE_CONFIG.versionTracking || { previousVersions: [], upgradeDate: "", legacyConfigFormat: "" };
}
