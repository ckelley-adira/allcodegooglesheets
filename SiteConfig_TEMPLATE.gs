// ═══════════════════════════════════════════════════════════════════════════
// SITE CONFIGURATION TEMPLATE
// Universal configuration object for ANY Adira network school deployment
// ═══════════════════════════════════════════════════════════════════════════
// Version: 4.0 - CANONICAL TEMPLATE
// Last Updated: February 2026
//
// PURPOSE:
// This template defines the SITE_CONFIG object that drives ALL system behavior.
// The Setup Wizard populates this configuration, and all engine functions
// (sheet creation, dashboards, reports) read from it dynamically.
//
// USAGE:
// 1. The Setup Wizard creates this configuration through guided questions
// 2. All system functions read settings from SITE_CONFIG
// 3. No hardcoded school-specific values in engine code
// 4. Supports greenfield deployments and major-rewrite scenarios
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SITE_CONFIG - The single source of truth for all school-specific settings
 * 
 * This object is populated by the Setup Wizard and stored in the "Site Configuration" sheet.
 * All system functions must read from this configuration rather than using hardcoded values.
 */
const SITE_CONFIG = {
  
  // ═══════════════════════════════════════════════════════════════════════
  // BASIC SCHOOL INFORMATION
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * School/Organization name
   * @type {string}
   * @example "Adelante Preparatory Academy"
   */
  schoolName: "",
  
  /**
   * Deployment type identifier
   * @type {string}
   * @options "standard" | "charter-network" | "district-partnership" | "custom"
   */
  deploymentType: "standard",
  
  /**
   * System version (auto-populated by wizard)
   * @type {string}
   */
  version: "4.0",
  
  /**
   * Last configuration update timestamp
   * @type {Date}
   */
  lastUpdated: null,
  
  // ═══════════════════════════════════════════════════════════════════════
  // GRADE LEVEL CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Grades served by this school
   * @type {Array<string>}
   * @options "PreK" | "KG" | "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7" | "G8"
   * @example ["PreK", "KG", "G1", "G2", "G3"]
   */
  gradesServed: [],
  
  /**
   * Mixed grade support configuration
   * Allows students from different grade levels in the same intervention group
   */
  mixedGradeSupport: {
    /**
     * Enable mixed-grade grouping
     * @type {boolean}
     * @default false
     */
    enabled: false,
    
    /**
     * Allowed grade combinations for mixed groups
     * @type {Array<string>}
     * @example ["KG-G1", "G1-G2", "G2-G3"]
     */
    allowedCombinations: [],
    
    /**
     * Mixed group naming format
     * @type {string}
     * @options "hyphenated" | "slash" | "combined"
     * @example "hyphenated" → "KG-G1 Group A"
     */
    namingFormat: "hyphenated"
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // FEATURE MODULES
  // Enable/disable optional functionality based on school needs
  // ═══════════════════════════════════════════════════════════════════════
  
  features: {
    /**
     * Coaching Dashboard - Weekly coaching-focused progress visualization
     * Shows AG% growth by skill section, color-coded performance indicators
     * @type {boolean}
     * @default false
     * @implementedBy SankofaCoachView.gs, SankofaWeeklyCoachingDashboard.gs
     */
    coachingDashboard: false,
    
    /**
     * Tutoring System - Dual-track progress (whole-group + tutoring interventions)
     * Separates classroom instruction from 1-on-1/small group tutoring
     * @type {boolean}
     * @default false
     * @implementedBy GlobalPrepTutoringSystem.gs
     */
    tutoring: false,
    
    /**
     * Grant Reporting - Specialized reports for grant compliance/outcomes
     * Generates funder-specific data exports and progress summaries
     * @type {boolean}
     * @default false
     * @implementedBy GlobalPrepMindTrustReport.gs
     */
    grantReporting: false,
    
    /**
     * Growth Highlights - Visual growth indicators on student sheets
     * Highlights improvements in AG% and section mastery
     * @type {boolean}
     * @default false
     * @implementedBy AdelanteGrowthHighlighter.gs
     */
    growthHighlights: false,
    
    /**
     * Admin Import - Bulk student/group data import from external sources
     * Validates and processes CSV/spreadsheet imports with exception handling
     * @type {boolean}
     * @default false
     * @implementedBy AdelanteAdminImport.gs, AllegiantAdminImport.gs
     */
    adminImport: false,
    
    /**
     * Unenrollment Automation - Automatic archiving of exited students
     * Moves inactive students to archive with data preservation
     * @type {boolean}
     * @default false
     * @implementedBy AdelanteUnenrollmentAutomation.gs
     */
    unenrollmentAutomation: false,
    
    /**
     * Pacing Sheets - Curriculum pacing monitoring vs. schedule
     * Tracks group progress against expected lesson completion dates
     * @type {boolean}
     * @default true
     */
    pacingSheets: true,
    
    /**
     * Parent Reports - Parent-friendly progress reports
     * Generates simplified, jargon-free reports for families
     * @type {boolean}
     * @default true
     */
    parentReports: true,
    
    /**
     * Monday.com Integration - Export data to Monday.com boards
     * Syncs progress data to project management system
     * @type {boolean}
     * @default false
     */
    mondayIntegration: false,
    
    /**
     * Exception Reports - Flag students needing intervention
     * Identifies students below benchmarks or showing regression
     * @type {boolean}
     * @default true
     */
    exceptionReports: true
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // SHEET LAYOUT OPTIONS
  // Customize sheet structure to match school workflows
  // ═══════════════════════════════════════════════════════════════════════
  
  sheetLayout: {
    /**
     * Number of header rows before student data begins
     * @type {number}
     * @default 5
     * @range 3-10
     */
    headerRowCount: 5,
    
    /**
     * Group sheet format style
     * @type {string}
     * @options "standard" | "condensed" | "expanded" | "sankofa"
     * 
     * - "standard": Traditional layout with group name in column D
     * - "condensed": Minimal layout for small displays
     * - "expanded": Additional metadata columns
     * - "sankofa": "Student Name" header rows + group name in column D (co-teaching format)
     */
    groupFormat: "standard",
    
    /**
     * Include Self-Contained (SC) classroom designation
     * Adds SC classroom identifier to group sheets for special ed integration
     * @type {boolean}
     * @default false
     */
    includeSCClassroom: false,
    
    /**
     * Data start row (calculated from headerRowCount)
     * @type {number}
     * @calculated
     */
    get dataStartRow() {
      return this.headerRowCount + 1;
    },
    
    /**
     * Student sheet columns to include
     * @type {Array<string>}
     * @default ["name", "grade", "teacher", "group", "startDate", "currentLesson", "ag_percent"]
     */
    studentColumns: ["name", "grade", "teacher", "group", "startDate", "currentLesson", "ag_percent"],
    
    /**
     * Group sheet columns to include
     * @type {Array<string>}
     * @default ["lesson", "date", "status", "notes"]
     */
    groupColumns: ["lesson", "date", "status", "notes"]
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // BRANDING & STYLING
  // Customize appearance with school colors and logo
  // ═══════════════════════════════════════════════════════════════════════
  
  branding: {
    /**
     * Primary brand color (hex code)
     * Used for headers, buttons, and primary UI elements
     * @type {string}
     * @format #RRGGBB
     * @default "#00838F"
     */
    primaryColor: "#00838F",
    
    /**
     * Secondary brand color (hex code)
     * Used for accents, highlights, and secondary UI elements
     * @type {string}
     * @format #RRGGBB
     * @default "#FFB300"
     */
    secondaryColor: "#FFB300",
    
    /**
     * School logo Google Drive File ID
     * Logo displayed on reports and dashboards
     * @type {string}
     * @default ""
     * @example "1A2B3C4D5E6F7G8H9I0J"
     */
    logoFileId: "",
    
    /**
     * Report header style
     * @type {string}
     * @options "minimal" | "standard" | "branded"
     */
    reportHeaderStyle: "standard"
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // ADVANCED OPTIONS
  // Technical settings for optimization and customization
  // ═══════════════════════════════════════════════════════════════════════
  
  advanced: {
    /**
     * Enable batch write optimization for form submissions
     * Uses single setValues() calls instead of multiple setValue()
     * @type {boolean}
     * @default true
     * @performance ~90% faster form submissions when enabled
     */
    batchWriteOptimization: true,
    
    /**
     * Sync queue processing mode
     * @type {string}
     * @options "immediate" | "hourly" | "nightly" | "manual"
     * @default "hourly"
     */
    syncMode: "hourly",
    
    /**
     * Recommended group size constraints
     */
    groupSize: {
      min: 4,
      max: 10,
      ideal: 6
    },
    
    /**
     * Auto-archive inactive students after N days
     * @type {number}
     * @default 30
     * @requires features.unenrollmentAutomation = true
     */
    autoArchiveAfterDays: 30,
    
    /**
     * Enable debug logging
     * @type {boolean}
     * @default false
     */
    debugLogging: false
  }
};

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS FOR READING SITE_CONFIG
// ═══════════════════════════════════════════════════════════════════════

/**
 * Gets the current site configuration from the Site Configuration sheet
 * @returns {Object} The SITE_CONFIG object populated with current values
 */
function getSiteConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName("Site Configuration");
  
  if (!configSheet) {
    // Return default config if sheet doesn't exist (pre-setup state)
    return JSON.parse(JSON.stringify(SITE_CONFIG));
  }
  
  // Read configuration from sheet and populate SITE_CONFIG structure
  const config = JSON.parse(JSON.stringify(SITE_CONFIG)); // Deep copy
  
  try {
    // Basic information
    config.schoolName = configSheet.getRange(2, 2).getValue() || "";
    config.version = configSheet.getRange(20, 2).getValue() || "4.0";
    config.lastUpdated = configSheet.getRange(21, 2).getValue();
    
    // Grades served
    config.gradesServed = [];
    const gradeOptions = ["PreK", "KG", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"];
    for (let i = 0; i < gradeOptions.length; i++) {
      const isEnabled = configSheet.getRange(5 + i, 2).getValue();
      if (isEnabled === true || isEnabled === "TRUE") {
        config.gradesServed.push(gradeOptions[i]);
      }
    }
    
    // Mixed grade support
    config.mixedGradeSupport.enabled = configSheet.getRange(17, 2).getValue() === true;
    const combinations = configSheet.getRange(18, 2).getValue();
    config.mixedGradeSupport.allowedCombinations = combinations ? 
      combinations.toString().split(',').map(c => c.trim()) : [];
    
    // Branding
    config.branding.primaryColor = configSheet.getRange(24, 2).getValue() || "#00838F";
    config.branding.secondaryColor = configSheet.getRange(25, 2).getValue() || "#FFB300";
    config.branding.logoFileId = configSheet.getRange(26, 2).getValue() || "";
    
    // Features (read from Feature Settings sheet)
    const featureSheet = ss.getSheetByName("Feature Settings");
    if (featureSheet) {
      const featureData = featureSheet.getRange(6, 1, 20, 2).getValues();
      featureData.forEach(row => {
        const featureId = row[0];
        const enabled = row[1] === true || row[1] === "TRUE";
        
        // Map feature IDs to config structure
        const featureMap = {
          "coachingDashboard": "coachingDashboard",
          "tutoring": "tutoring",
          "grantReporting": "grantReporting",
          "growthHighlights": "growthHighlights",
          "adminImport": "adminImport",
          "unenrollmentAutomation": "unenrollmentAutomation",
          "pacingSheets": "pacingSheets",
          "parentReports": "parentReports",
          "mondayIntegration": "mondayIntegration",
          "exceptionReports": "exceptionReports"
        };
        
        if (featureMap[featureId]) {
          config.features[featureMap[featureId]] = enabled;
        }
      });
    }
    
    // Sheet layout options (if extended config sheet exists)
    // For now, use defaults - can be extended in future versions
    
    return config;
    
  } catch (error) {
    Logger.log("[getSiteConfig] Error reading configuration: " + error.toString());
    return JSON.parse(JSON.stringify(SITE_CONFIG)); // Return default on error
  }
}

/**
 * Checks if a specific feature is enabled
 * @param {string} featureName - Name of the feature (e.g., "coachingDashboard")
 * @returns {boolean} True if feature is enabled
 */
function isFeatureEnabled(featureName) {
  const config = getSiteConfig();
  return config.features[featureName] === true;
}

/**
 * Gets a specific configuration value by path
 * @param {string} path - Dot-notation path to config value (e.g., "branding.primaryColor")
 * @returns {*} The configuration value
 */
function getConfigValue(path) {
  const config = getSiteConfig();
  return path.split('.').reduce((obj, key) => obj?.[key], config);
}

// ═══════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Validates the site configuration for completeness and correctness
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validation result {valid: boolean, errors: Array<string>}
 */
function validateSiteConfig(config) {
  const errors = [];
  
  // Required fields
  if (!config.schoolName || config.schoolName.trim() === "") {
    errors.push("School name is required");
  }
  
  if (!config.gradesServed || config.gradesServed.length === 0) {
    errors.push("At least one grade level must be selected");
  }
  
  // Branding validation
  if (config.branding.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(config.branding.primaryColor)) {
    errors.push("Primary color must be a valid hex color code (e.g., #00838F)");
  }
  
  if (config.branding.secondaryColor && !/^#[0-9A-Fa-f]{6}$/.test(config.branding.secondaryColor)) {
    errors.push("Secondary color must be a valid hex color code (e.g., #FFB300)");
  }
  
  // Mixed grade validation
  if (config.mixedGradeSupport.enabled && 
      (!config.mixedGradeSupport.allowedCombinations || 
       config.mixedGradeSupport.allowedCombinations.length === 0)) {
    errors.push("Mixed grade combinations must be specified when mixed grade support is enabled");
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}
