// ═══════════════════════════════════════════════════════════════════════════
// SITE CONFIGURATION TEMPLATE
// Instructions for configuring optional feature modules
// ═══════════════════════════════════════════════════════════════════════════
// Version: 4.0 - MODULAR ARCHITECTURE
// Last Updated: February 2026
//
// PURPOSE:
// This template defines all optional feature modules available in the UFLI
// Master System. Each feature can be enabled/disabled via feature flags.
//
// USAGE:
// 1. Copy this template to your school's setup wizard
// 2. Set feature flags to true/false in SITE_CONFIG.features
// 3. Features are automatically activated/deactivated in menus, dialogs, and triggers
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
  systemVersion: "4.0",
  
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
