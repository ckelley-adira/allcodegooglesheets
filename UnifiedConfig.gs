// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED CONFIGURATION RESOLVER - PHASE 7 LOGIC LAYER UNIFICATION
// Resolves all school-specific constants from SITE_CONFIG
// ═══════════════════════════════════════════════════════════════════════════
// Version: 7.0 - UNIFIED SCHOOL SITE TEMPLATE
// Last Updated: February 2026
//
// PURPOSE:
// This module eliminates per-school copies of Phase2_ProgressTracking.gs by
// resolving all school-specific constants (LAYOUT, SHEET_NAMES_V2, PREK_CONFIG,
// COLORS, GRADE_METRICS) from the SITE_CONFIG object. Schools no longer need
// their own Phase2 file — they configure everything through the SetUpWizard
// and SiteConfig_TEMPLATE.gs, then use UnifiedPhase2_ProgressTracking.gs.
//
// DEPENDENCIES:
// - SiteConfig_TEMPLATE.gs: SITE_CONFIG with layout, gradeRangeModel, features
// - SharedConstants.gs: SKILL_SECTIONS, REVIEW_LESSONS, etc.
// - SharedEngine.gs: SHARED_GRADE_METRICS, calculation functions
//
// USAGE:
// const config = getUnifiedConfig();
// // config.LAYOUT, config.SHEET_NAMES_V2, config.PREK_CONFIG, config.COLORS
// // are all resolved from SITE_CONFIG — no per-school hardcoding needed.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Grade range model presets.
 * Each preset defines the default grades served and relevant features.
 */
const GRADE_RANGE_MODELS = {
  PREK_ONLY: {
    id: 'prek_only',
    label: 'Pre-K Only',
    defaultGrades: ['PreK'],
    description: 'Handwriting Without Tears curriculum only (Pre-K students)'
  },
  K5: {
    id: 'k5',
    label: 'K–5 Elementary',
    defaultGrades: ['KG', 'G1', 'G2', 'G3', 'G4', 'G5'],
    description: 'Standard elementary school configuration (Kindergarten through 5th Grade)'
  },
  K8: {
    id: 'k8',
    label: 'K–8 Full Range',
    defaultGrades: ['KG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'],
    description: 'Full K-8 school with all grade levels'
  },
  PREK_8: {
    id: 'prek_8',
    label: 'Pre-K through 8',
    defaultGrades: ['PreK', 'KG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'],
    description: 'Full Pre-K through 8th Grade with dual-curriculum support'
  },
  CUSTOM: {
    id: 'custom',
    label: 'Custom',
    defaultGrades: [],
    description: 'Select individual grade levels manually'
  }
};

/**
 * Resolves the unified configuration for the current school deployment.
 * This is the SINGLE function that replaces per-school constant definitions.
 *
 * @returns {Object} Complete school configuration object with:
 *   - LAYOUT: Sheet layout constants (DATA_START_ROW, HEADER_ROW_COUNT, etc.)
 *   - SHEET_NAMES_V2: System sheet names
 *   - SHEET_NAMES_PREK: Pre-K sheet names
 *   - SHEET_NAMES_PACING: Pacing sheet names
 *   - PREK_CONFIG: Pre-K configuration
 *   - COLORS: UI color constants
 *   - GRADE_METRICS: Grade benchmark metrics (from SharedEngine or overrides)
 *   - gradeRangeModel: Selected grade range model ID
 *   - gradesServed: Array of active grade codes
 *   - schoolName: School display name
 */
function getUnifiedConfig() {
  // Read layout settings from SITE_CONFIG (set by wizard, defaults if missing)
  const siteLayout = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.layout) || {};
  const siteGrades = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.gradeRangeModel) || 'custom';
  const siteName = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.schoolName) || 'UFLI School';

  // Resolve header row count (default: 5 for standard layout)
  const headerRowCount = siteLayout.headerRowCount || 5;

  // DATA_START_ROW = headerRowCount + 1 (data starts after headers)
  const dataStartRow = siteLayout.dataStartRow || (headerRowCount + 1);

  // Resolve LAYOUT from wizard-configured settings
  const LAYOUT_RESOLVED = {
    DATA_START_ROW: dataStartRow,
    HEADER_ROW_COUNT: headerRowCount,
    LESSON_COLUMN_OFFSET: siteLayout.lessonColumnOffset || 5,
    TOTAL_LESSONS: 128,
    LESSONS_PER_GROUP_SHEET: siteLayout.lessonsPerGroupSheet || 12,

    // Column indices (1-based for Sheet API)
    COL_STUDENT_NAME: 1,
    COL_GRADE: 2,
    COL_TEACHER: 3,
    COL_GROUP: 4,
    COL_CURRENT_LESSON: 5,
    COL_FIRST_LESSON: 6
  };

  // Standard system sheet names (same across all schools)
  const SHEET_NAMES_V2_RESOLVED = {
    SMALL_GROUP_PROGRESS: "Small Group Progress",
    UFLI_MAP: "UFLI MAP",
    SKILLS: "Skills Tracker",
    GRADE_SUMMARY: "Grade Summary",
    INITIAL_ASSESSMENT: "Initial Assessment",
    SCHOOL_SUMMARY: "School Summary"
  };

  // Pre-K sheet names and configuration (same across all schools)
  const SHEET_NAMES_PREK_RESOLVED = {
    DATA: "Pre-K Data"
  };

  const PREK_CONFIG_RESOLVED = {
    TOTAL_LETTERS: 26,
    HEADER_ROW: headerRowCount,
    DATA_START_ROW: dataStartRow,
    FORM_DENOMINATOR: 26,
    NAME_SOUND_DENOMINATOR: 52,
    FULL_DENOMINATOR: 78
  };

  // Pacing sheet names
  const SHEET_NAMES_PACING_RESOLVED = {
    DASHBOARD: "Pacing Dashboard",
    LOG: "Pacing Log"
  };

  // UI colors (can be customized via branding)
  const branding = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.branding) || {};
  const COLORS_RESOLVED = {
    Y: "#d4edda",
    N: "#f8d7da",
    A: "#fff3cd",
    HEADER_BG: branding.primaryColor || "#4A90E2",
    HEADER_FG: "#FFFFFF",
    TITLE_BG: branding.accentColor || "#ADD8E6",
    TITLE_FG: "#000000",
    SUB_HEADER_BG: "#f8f9fa",
    PLACEHOLDER_FG: "#999999"
  };

  // Resolve active grades from model or custom selection
  const modelDef = Object.values(GRADE_RANGE_MODELS).find(m => m.id === siteGrades);
  const gradesServed = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.gradesServed)
    ? SITE_CONFIG.gradesServed
    : (modelDef ? modelDef.defaultGrades : []);

  // Grade metrics — use SharedEngine's SHARED_GRADE_METRICS (no per-school override needed)
  const GRADE_METRICS_RESOLVED = (typeof SHARED_GRADE_METRICS !== 'undefined')
    ? SHARED_GRADE_METRICS
    : {};

  // Feature flags — read directly from SITE_CONFIG.features
  const features = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.features) || {};

  return {
    LAYOUT: LAYOUT_RESOLVED,
    SHEET_NAMES_V2: SHEET_NAMES_V2_RESOLVED,
    SHEET_NAMES_PREK: SHEET_NAMES_PREK_RESOLVED,
    SHEET_NAMES_PACING: SHEET_NAMES_PACING_RESOLVED,
    PREK_CONFIG: PREK_CONFIG_RESOLVED,
    COLORS: COLORS_RESOLVED,
    GRADE_METRICS: GRADE_METRICS_RESOLVED,
    features: features,
    gradeRangeModel: siteGrades,
    gradesServed: gradesServed,
    schoolName: siteName
  };
}

/**
 * Returns the list of available grade range models for the wizard UI
 * @returns {Array<Object>} Array of grade range model definitions
 */
function getGradeRangeModels() {
  return Object.values(GRADE_RANGE_MODELS).map(model => ({
    id: model.id,
    label: model.label,
    description: model.description,
    defaultGrades: model.defaultGrades
  }));
}

/**
 * Returns the default grades for a given grade range model
 * @param {string} modelId - Grade range model ID (e.g., 'k5', 'k8')
 * @returns {Array<string>} Array of grade codes
 */
function getDefaultGradesForModel(modelId) {
  const model = Object.values(GRADE_RANGE_MODELS).find(m => m.id === modelId);
  return model ? model.defaultGrades : [];
}

/**
 * Validates that a unified config object has all required properties
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validation result {valid: boolean, missing: string[]}
 */
function validateUnifiedConfig(config) {
  const requiredKeys = ['LAYOUT', 'SHEET_NAMES_V2', 'PREK_CONFIG', 'COLORS'];
  const missing = requiredKeys.filter(key => !config || !config[key]);

  const requiredLayoutKeys = ['DATA_START_ROW', 'HEADER_ROW_COUNT', 'LESSON_COLUMN_OFFSET', 'TOTAL_LESSONS'];
  if (config && config.LAYOUT) {
    requiredLayoutKeys.forEach(key => {
      if (config.LAYOUT[key] === undefined || config.LAYOUT[key] === null) {
        missing.push('LAYOUT.' + key);
      }
    });
  }

  return {
    valid: missing.length === 0,
    missing: missing
  };
}
