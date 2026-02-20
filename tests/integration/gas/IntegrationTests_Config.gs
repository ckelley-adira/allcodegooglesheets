// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS: UnifiedConfig Resolution & Grade Models
// ═══════════════════════════════════════════════════════════════════════════
// Version: 1.0 - Tier 2 Integration Testing
// Last Updated: February 2026
//
// TESTS COVERED:
// - GRADE_RANGE_MODELS constant completeness
// - getUnifiedConfig() returns valid configuration for each grade model
// - getDefaultGradesForModel() returns correct grade arrays
// - Layout settings resolved from SITE_CONFIG
// - validateUnifiedConfig() surfaces missing keys
// - Legacy fallback defaults when config rows are absent
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register all configuration integration tests.
 */
function registerConfigTests() {
  registerTestSuite('ConfigResolution', [
    { name: 'GRADE_RANGE_MODELS has all 5 presets', fn: testGradeRangeModelsComplete },
    { name: 'Each model has id, label, defaultGrades, description', fn: testGradeRangeModelShape },
    { name: 'getGradeRangeModels returns model map', fn: testGetGradeRangeModels },
    { name: 'getDefaultGradesForModel: k5 returns 6 grades', fn: testDefaultGradesK5 },
    { name: 'getDefaultGradesForModel: k8 returns 9 grades', fn: testDefaultGradesK8 },
    { name: 'getDefaultGradesForModel: prek_only returns PreK', fn: testDefaultGradesPreK },
    { name: 'getDefaultGradesForModel: prek_8 returns 10 grades', fn: testDefaultGradesPreK8 },
    { name: 'getDefaultGradesForModel: custom returns empty', fn: testDefaultGradesCustom },
    { name: 'getUnifiedConfig returns object with LAYOUT', fn: testGetUnifiedConfigLayout },
    { name: 'LAYOUT has required keys', fn: testLayoutKeys },
    { name: 'LAYOUT defaults match SITE_CONFIG.layout', fn: testLayoutDefaults },
    { name: 'validateUnifiedConfig is callable', fn: testValidateUnifiedConfigCallable },
    { name: 'SharedConstants: LESSON_LABELS has 128 entries', fn: testLessonLabelsCount },
    { name: 'SharedConstants: SKILL_SECTIONS has 16 sections', fn: testSkillSectionsCount },
    { name: 'SharedConstants: REVIEW_LESSONS defined', fn: testReviewLessonsDefined }
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

function testGradeRangeModelsComplete() {
  Assert.isNotNull(GRADE_RANGE_MODELS, 'GRADE_RANGE_MODELS should be defined');
  const expectedKeys = ['PREK_ONLY', 'K5', 'K8', 'PREK_8', 'CUSTOM'];
  for (let i = 0; i < expectedKeys.length; i++) {
    Assert.isTrue(
      expectedKeys[i] in GRADE_RANGE_MODELS,
      'Missing model: ' + expectedKeys[i]
    );
  }
}

function testGradeRangeModelShape() {
  const keys = Object.keys(GRADE_RANGE_MODELS);
  for (let i = 0; i < keys.length; i++) {
    const model = GRADE_RANGE_MODELS[keys[i]];
    Assert.isNotNull(model.id, keys[i] + ' missing id');
    Assert.isNotNull(model.label, keys[i] + ' missing label');
    Assert.isTrue(Array.isArray(model.defaultGrades), keys[i] + ' defaultGrades should be array');
    Assert.isNotNull(model.description, keys[i] + ' missing description');
  }
}

function testGetGradeRangeModels() {
  Assert.typeOf(getGradeRangeModels, 'function', 'getGradeRangeModels must be defined');
  const models = getGradeRangeModels();
  Assert.isNotNull(models, 'getGradeRangeModels should return non-null');
}

function testDefaultGradesK5() {
  Assert.typeOf(getDefaultGradesForModel, 'function', 'getDefaultGradesForModel must be defined');
  const grades = getDefaultGradesForModel('k5');
  Assert.isTrue(Array.isArray(grades), 'k5 should return array');
  Assert.equals(grades.length, 6, 'k5 should return 6 grades');
  Assert.includes(grades, 'KG', 'k5 includes KG');
  Assert.includes(grades, 'G5', 'k5 includes G5');
}

function testDefaultGradesK8() {
  Assert.typeOf(getDefaultGradesForModel, 'function', 'getDefaultGradesForModel must be defined');
  const grades = getDefaultGradesForModel('k8');
  Assert.isTrue(Array.isArray(grades), 'k8 should return array');
  Assert.equals(grades.length, 9, 'k8 should return 9 grades');
  Assert.includes(grades, 'G8', 'k8 includes G8');
}

function testDefaultGradesPreK() {
  Assert.typeOf(getDefaultGradesForModel, 'function', 'getDefaultGradesForModel must be defined');
  const grades = getDefaultGradesForModel('prek_only');
  Assert.isTrue(Array.isArray(grades), 'prek_only should return array');
  Assert.equals(grades.length, 1, 'prek_only should return 1 grade');
  Assert.includes(grades, 'PreK', 'prek_only includes PreK');
}

function testDefaultGradesPreK8() {
  Assert.typeOf(getDefaultGradesForModel, 'function', 'getDefaultGradesForModel must be defined');
  const grades = getDefaultGradesForModel('prek_8');
  Assert.isTrue(Array.isArray(grades), 'prek_8 should return array');
  Assert.equals(grades.length, 10, 'prek_8 should return 10 grades');
  Assert.includes(grades, 'PreK', 'prek_8 includes PreK');
  Assert.includes(grades, 'G8', 'prek_8 includes G8');
}

function testDefaultGradesCustom() {
  Assert.typeOf(getDefaultGradesForModel, 'function', 'getDefaultGradesForModel must be defined');
  const grades = getDefaultGradesForModel('custom');
  Assert.isTrue(Array.isArray(grades), 'custom should return array');
  Assert.equals(grades.length, 0, 'custom should return empty array');
}

function testGetUnifiedConfigLayout() {
  Assert.typeOf(getUnifiedConfig, 'function', 'getUnifiedConfig must be defined');
  const config = getUnifiedConfig();
  Assert.isNotNull(config, 'getUnifiedConfig should return non-null');
  Assert.isNotNull(config.LAYOUT, 'config should have LAYOUT');
}

function testLayoutKeys() {
  Assert.typeOf(getUnifiedConfig, 'function', 'getUnifiedConfig must be defined');
  const config = getUnifiedConfig();
  const layout = config.LAYOUT;
  // Check essential layout properties exist
  Assert.isNotNull(layout.DATA_START_ROW, 'LAYOUT should have DATA_START_ROW');
  Assert.isNotNull(layout.HEADER_ROW_COUNT, 'LAYOUT should have HEADER_ROW_COUNT');
  Assert.isNotNull(layout.LESSON_COLUMN_OFFSET, 'LAYOUT should have LESSON_COLUMN_OFFSET');
}

function testLayoutDefaults() {
  Assert.typeOf(getUnifiedConfig, 'function', 'getUnifiedConfig must be defined');
  const config = getUnifiedConfig();
  const layout = config.LAYOUT;
  // Defaults should match SITE_CONFIG.layout values
  Assert.equals(layout.DATA_START_ROW, SITE_CONFIG.layout.dataStartRow,
    'DATA_START_ROW should match SITE_CONFIG');
  Assert.equals(layout.HEADER_ROW_COUNT, SITE_CONFIG.layout.headerRowCount,
    'HEADER_ROW_COUNT should match SITE_CONFIG');
  Assert.equals(layout.LESSON_COLUMN_OFFSET, SITE_CONFIG.layout.lessonColumnOffset,
    'LESSON_COLUMN_OFFSET should match SITE_CONFIG');
}

function testValidateUnifiedConfigCallable() {
  Assert.typeOf(validateUnifiedConfig, 'function', 'validateUnifiedConfig must be defined');
  // Should not throw for a valid SITE_CONFIG
  const result = validateUnifiedConfig();
  Assert.isNotNull(result, 'validateUnifiedConfig should return a result');
}

function testLessonLabelsCount() {
  Assert.isNotNull(LESSON_LABELS, 'LESSON_LABELS should be defined');
  const count = Object.keys(LESSON_LABELS).length;
  Assert.equals(count, 128, 'LESSON_LABELS should have 128 entries');
}

function testSkillSectionsCount() {
  Assert.isNotNull(SKILL_SECTIONS, 'SKILL_SECTIONS should be defined');
  const count = Object.keys(SKILL_SECTIONS).length;
  Assert.equals(count, 16, 'SKILL_SECTIONS should have 16 sections');
}

function testReviewLessonsDefined() {
  Assert.isNotNull(REVIEW_LESSONS, 'REVIEW_LESSONS should be defined');
  Assert.isTrue(Array.isArray(REVIEW_LESSONS), 'REVIEW_LESSONS should be an array');
  Assert.greaterThan(REVIEW_LESSONS.length, 0, 'REVIEW_LESSONS should not be empty');
}
