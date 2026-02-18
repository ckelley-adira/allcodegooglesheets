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
  // Determines which grades this school serves and Pre-K inclusion
  // Options: "prek_only", "k5", "k8", "prek_8", "custom"
  // ═══════════════════════════════════════════════════════════════════════════
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
  // ═══════════════════════════════════════════════════════════════════════════
  layout: {
    headerRowCount: 5,          // Number of header rows (3-10)
    dataStartRow: 6,            // First data row = headerRowCount + 1
    lessonColumnOffset: 5,      // 0-based offset to first lesson column (default 5 = col F)
    lessonsPerGroupSheet: 12,   // Lesson columns shown on each group sheet
    groupFormat: "standard",    // "standard", "condensed", "expanded", "sankofa"
    includeSCClassroom: false   // Add Self-Contained Classroom column
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BRANDING
  // Visual identity and styling for all UI components
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
  // FEATURE FLAGS
  // Set to true to enable, false to disable
  // ═══════════════════════════════════════════════════════════════════════════
  features: {
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
     * UNENROLLMENT AUTOMATION
     * Automatic archival and Monday.com integration for unenrolled students
     * Required for: Schools using Monday.com workflow tracking
     * Adds: Automatic student archival, Monday.com task creation, "Student Archive" sheet
     * File: modules/UnenrollmentAutomation.gs
     */
    unenrollmentAutomation: false
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
  
  // Mixed grade combinations (comma-separated)
  // Example: "G6+G7+G8, G1+G2+G3+G4"
  combinations: "",
  
  // Group naming pattern
  namingPattern: "NUMBERED_TEACHER" // "NUMBERED_TEACHER", "NUMBERED", or "ALPHA"
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
    unenrollmentAutomation: UNENROLLMENT_CONFIG
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
