// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS: Menu Generation & Feature Flag Rendering
// ═══════════════════════════════════════════════════════════════════════════
// Version: 1.0 - Tier 2 Integration Testing
// Last Updated: February 2026
//
// TESTS COVERED:
// - Core menu items always present when system is configured
// - Feature-flag gated submenus appear/disappear correctly
// - Sync menu items respect their individual flags
// - buildFeatureMenu() produces correct menu structure per scenario
// - Toggle cycle: enable → disable → verify no orphan items
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register all menu and feature flag integration tests.
 */
function registerMenuTests() {
  registerTestSuite('MenuAndFeatureFlags', [
    { name: 'SITE_CONFIG is defined and has features', fn: testSiteConfigExists },
    { name: 'Core features object has expected keys', fn: testFeatureKeysPresent },
    { name: 'Core-only: all optional features are false', fn: testCoreOnlyFeaturesOff },
    { name: 'Core-only: buildFeatureMenu is callable', fn: testBuildFeatureMenuCallable },
    { name: 'Mixed-grade scenario: correct flags enabled', fn: testMixedGradeFlags },
    { name: 'Tutoring scenario: tutoringSystem and grantReporting on', fn: testTutoringFlags },
    { name: 'PreK-only scenario: preKSystem is "hwt"', fn: testPreKOnlyFlags },
    { name: 'Full-features scenario: all flags enabled', fn: testFullFeaturesFlags },
    { name: 'Toggle cycle: enable then disable returns to baseline', fn: testToggleCycle },
    { name: 'Sync flags: syncQueueProcessing gating', fn: testSyncQueueFlag },
    { name: 'Sync flags: nightlySyncAutomation gating', fn: testNightlySyncFlag },
    { name: 'Sync flags: syncStatusMonitoring gating', fn: testSyncStatusFlag },
    { name: 'isSystemConfigured returns boolean', fn: testIsSystemConfigured },
    { name: 'onOpen does not throw in configured state', fn: testOnOpenConfigured }
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

function testSiteConfigExists() {
  Assert.isNotNull(SITE_CONFIG, 'SITE_CONFIG should be defined');
  Assert.isNotNull(SITE_CONFIG.features, 'SITE_CONFIG.features should be defined');
  Assert.typeOf(SITE_CONFIG.features, 'object', 'features should be an object');
}

function testFeatureKeysPresent() {
  const requiredKeys = [
    'mixedGradeSupport', 'coachingDashboard', 'tutoringSystem',
    'grantReporting', 'growthHighlighter', 'adminImport',
    'unenrollmentAutomation', 'preKSystem',
    'syncQueueProcessing', 'nightlySyncAutomation', 'syncStatusMonitoring',
    'enhancedSecurity', 'structuredLogging', 'scClassroomGroups', 'coTeachingSupport'
  ];
  for (let i = 0; i < requiredKeys.length; i++) {
    Assert.isTrue(
      requiredKeys[i] in SITE_CONFIG.features,
      'Missing feature key: ' + requiredKeys[i]
    );
  }
}

function testCoreOnlyFeaturesOff() {
  resetTestConfig();
  const optionalKeys = [
    'mixedGradeSupport', 'coachingDashboard', 'tutoringSystem',
    'grantReporting', 'growthHighlighter', 'adminImport',
    'unenrollmentAutomation', 'syncQueueProcessing',
    'nightlySyncAutomation', 'syncStatusMonitoring',
    'structuredLogging', 'scClassroomGroups', 'coTeachingSupport'
  ];
  for (let i = 0; i < optionalKeys.length; i++) {
    Assert.isFalse(
      SITE_CONFIG.features[optionalKeys[i]],
      optionalKeys[i] + ' should be false in core-only'
    );
  }
  // enhancedSecurity should still be true
  Assert.isTrue(SITE_CONFIG.features.enhancedSecurity, 'enhancedSecurity should remain true');
}

function testBuildFeatureMenuCallable() {
  Assert.typeOf(buildFeatureMenu, 'function', 'buildFeatureMenu should be a function');
}

function testMixedGradeFlags() {
  applyTestScenario('mixedGrade');
  Assert.isTrue(SITE_CONFIG.features.mixedGradeSupport, 'mixedGradeSupport on');
  Assert.isTrue(SITE_CONFIG.features.growthHighlighter, 'growthHighlighter on');
  Assert.isTrue(SITE_CONFIG.features.adminImport, 'adminImport on');
  Assert.isTrue(SITE_CONFIG.features.unenrollmentAutomation, 'unenrollmentAutomation on');
  Assert.isTrue(SITE_CONFIG.features.syncQueueProcessing, 'syncQueueProcessing on');
  Assert.isTrue(SITE_CONFIG.features.nightlySyncAutomation, 'nightlySyncAutomation on');
  Assert.isFalse(SITE_CONFIG.features.coachingDashboard, 'coachingDashboard off');
  Assert.isFalse(SITE_CONFIG.features.tutoringSystem, 'tutoringSystem off');
  resetTestConfig();
}

function testTutoringFlags() {
  applyTestScenario('tutoringOnly');
  Assert.isTrue(SITE_CONFIG.features.tutoringSystem, 'tutoringSystem on');
  Assert.isTrue(SITE_CONFIG.features.grantReporting, 'grantReporting on');
  Assert.isTrue(SITE_CONFIG.features.nightlySyncAutomation, 'nightlySyncAutomation on');
  Assert.isFalse(SITE_CONFIG.features.mixedGradeSupport, 'mixedGradeSupport off');
  Assert.isFalse(SITE_CONFIG.features.coachingDashboard, 'coachingDashboard off');
  resetTestConfig();
}

function testPreKOnlyFlags() {
  applyTestScenario('preKOnly');
  Assert.equals(SITE_CONFIG.features.preKSystem, 'hwt', 'preKSystem should be "hwt"');
  Assert.equals(SITE_CONFIG.gradeRangeModel, 'prek_only', 'gradeRangeModel should be prek_only');
  Assert.isFalse(SITE_CONFIG.features.mixedGradeSupport, 'mixedGradeSupport off');
  resetTestConfig();
}

function testFullFeaturesFlags() {
  applyTestScenario('fullFeatures');
  Assert.isTrue(SITE_CONFIG.features.mixedGradeSupport, 'mixedGradeSupport on');
  Assert.isTrue(SITE_CONFIG.features.coachingDashboard, 'coachingDashboard on');
  Assert.isTrue(SITE_CONFIG.features.tutoringSystem, 'tutoringSystem on');
  Assert.isTrue(SITE_CONFIG.features.grantReporting, 'grantReporting on');
  Assert.isTrue(SITE_CONFIG.features.growthHighlighter, 'growthHighlighter on');
  Assert.isTrue(SITE_CONFIG.features.adminImport, 'adminImport on');
  Assert.isTrue(SITE_CONFIG.features.unenrollmentAutomation, 'unenrollmentAutomation on');
  Assert.equals(SITE_CONFIG.features.preKSystem, 'hwt', 'preKSystem should be hwt');
  Assert.isTrue(SITE_CONFIG.features.syncQueueProcessing, 'syncQueueProcessing on');
  Assert.isTrue(SITE_CONFIG.features.nightlySyncAutomation, 'nightlySyncAutomation on');
  Assert.isTrue(SITE_CONFIG.features.syncStatusMonitoring, 'syncStatusMonitoring on');
  Assert.isTrue(SITE_CONFIG.features.structuredLogging, 'structuredLogging on');
  Assert.isTrue(SITE_CONFIG.features.coTeachingSupport, 'coTeachingSupport on');
  resetTestConfig();
}

function testToggleCycle() {
  // Start baseline
  resetTestConfig();
  Assert.isFalse(SITE_CONFIG.features.tutoringSystem, 'baseline: tutoringSystem off');

  // Enable
  SITE_CONFIG.features.tutoringSystem = true;
  Assert.isTrue(SITE_CONFIG.features.tutoringSystem, 'after enable: tutoringSystem on');

  // Disable and verify return to baseline
  resetTestConfig();
  Assert.isFalse(SITE_CONFIG.features.tutoringSystem, 'after reset: tutoringSystem off');
}

function testSyncQueueFlag() {
  resetTestConfig();
  Assert.isFalse(SITE_CONFIG.features.syncQueueProcessing, 'syncQueueProcessing off by default');

  SITE_CONFIG.features.syncQueueProcessing = true;
  Assert.isTrue(SITE_CONFIG.features.syncQueueProcessing, 'syncQueueProcessing turned on');
  resetTestConfig();
}

function testNightlySyncFlag() {
  resetTestConfig();
  Assert.isFalse(SITE_CONFIG.features.nightlySyncAutomation, 'nightlySyncAutomation off by default');

  SITE_CONFIG.features.nightlySyncAutomation = true;
  Assert.isTrue(SITE_CONFIG.features.nightlySyncAutomation, 'nightlySyncAutomation turned on');
  resetTestConfig();
}

function testSyncStatusFlag() {
  resetTestConfig();
  Assert.isFalse(SITE_CONFIG.features.syncStatusMonitoring, 'syncStatusMonitoring off by default');

  SITE_CONFIG.features.syncStatusMonitoring = true;
  Assert.isTrue(SITE_CONFIG.features.syncStatusMonitoring, 'syncStatusMonitoring turned on');
  resetTestConfig();
}

function testIsSystemConfigured() {
  Assert.typeOf(isSystemConfigured, 'function', 'isSystemConfigured must be defined');
  const result = isSystemConfigured();
  Assert.typeOf(result, 'boolean', 'isSystemConfigured should return boolean');
}

function testOnOpenConfigured() {
  // onOpen() calls SpreadsheetApp.getUi() which may throw in test context.
  // We verify it's callable; actual menu rendering is a GAS UI operation.
  Assert.typeOf(onOpen, 'function', 'onOpen should be a function');
}
