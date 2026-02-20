// ═══════════════════════════════════════════════════════════════════════════
// TEST SITE CONFIGURATION - Used during integration test runs
// ═══════════════════════════════════════════════════════════════════════════
// Version: 1.0 - Tier 2 Integration Testing
// Last Updated: February 2026
//
// PURPOSE:
// This file provides a test-only SITE_CONFIG that mirrors the production
// SiteConfig_TEMPLATE.gs structure. It is loaded into the test Apps Script
// project INSTEAD of the real SiteConfig_TEMPLATE.gs, so integration tests
// can control feature flags and layout parameters deterministically.
//
// NOTE: When deploying to the test project via clasp, include this file
// and EXCLUDE the production SiteConfig_TEMPLATE.gs.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Test Site Configuration — starts with a core-only baseline.
 * Individual test suites swap feature flags at runtime via
 * applyTestScenario() before exercising code under test.
 */
const SITE_CONFIG = {
  schoolName: "Integration Test School",
  systemVersion: "7.0",
  gradeRangeModel: "k5",
  gradesServed: ["KG", "G1", "G2", "G3", "G4", "G5"],

  layout: {
    headerRowCount: 5,
    dataStartRow: 6,
    lessonColumnOffset: 5,
    lessonsPerGroupSheet: 12,
    groupFormat: "standard",
    includeSCClassroom: false
  },

  branding: {
    schoolName: "Integration Test School",
    shortName: "ITS",
    tagline: "Test. Verify. Ship.",
    logoUrl: "",
    primaryColor: "#2c5282",
    secondaryColor: "#e2e8f0",
    accentColor: "#38a169"
  },

  features: {
    // Core modules
    mixedGradeSupport: false,
    coachingDashboard: false,
    tutoringSystem: false,
    grantReporting: false,
    growthHighlighter: false,
    adminImport: false,
    unenrollmentAutomation: false,

    // Pre-K (false | "light" | "hwt")
    preKSystem: false,

    // Sync flags
    syncQueueProcessing: false,
    nightlySyncAutomation: false,
    syncStatusMonitoring: false,

    // System flags
    enhancedSecurity: true,
    structuredLogging: false,
    scClassroomGroups: false,
    coTeachingSupport: false
  }
};

/**
 * Apply a fixture scenario to the global SITE_CONFIG at runtime.
 * This allows tests to switch between scenarios without reloading.
 * @param {string} scenarioKey - Key from FIXTURE_SCENARIOS
 */
function applyTestScenario(scenarioKey) {
  const scenario = FIXTURE_SCENARIOS[scenarioKey];
  if (!scenario) throw new Error('Unknown test scenario: ' + scenarioKey);

  SITE_CONFIG.schoolName = scenario.schoolName;
  SITE_CONFIG.gradeRangeModel = scenario.gradeRangeModel;

  // Keep gradesServed in sync with the active scenario so getUnifiedConfig()
  // resolves the correct grades.
  if (scenario.gradesServed) {
    SITE_CONFIG.gradesServed = scenario.gradesServed.slice();
  } else {
    SITE_CONFIG.gradesServed = [];
  }

  const featureKeys = Object.keys(scenario.features);
  for (let i = 0; i < featureKeys.length; i++) {
    SITE_CONFIG.features[featureKeys[i]] = scenario.features[featureKeys[i]];
  }
}

/**
 * Reset SITE_CONFIG to the core-only baseline (all optional features off).
 */
function resetTestConfig() {
  applyTestScenario('coreOnly');
}
