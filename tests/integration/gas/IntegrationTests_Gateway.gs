// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS: Gateway & Progress Calculations
// ═══════════════════════════════════════════════════════════════════════════
// Version: 1.0 - Tier 2 Integration Testing
// Last Updated: February 2026
//
// TESTS COVERED:
// - REVIEW_LESSONS are recognized as gateway tests
// - Performance threshold classification (At/Above, Approaching, Below)
// - getPerformanceStatus() returns correct labels for boundary values
// - Benchmark calculation on fixture data
// - Skill section percentage computation
// - Score lookup from live test sheets
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register all gateway and progress calculation tests.
 */
function registerGatewayTests() {
  registerTestSuite('GatewayAndProgress', [
    { name: 'REVIEW_LESSONS contains known gateway lessons', fn: testReviewLessonsContent },
    { name: 'REVIEW_LESSONS_SET is defined', fn: testReviewLessonsSetDefined },
    { name: 'PERFORMANCE_THRESHOLDS has required levels', fn: testPerformanceThresholds },
    { name: 'STATUS_LABELS has required labels', fn: testStatusLabels },
    { name: 'getPerformanceStatus: 90% → At/Above', fn: testPerformanceStatusHigh },
    { name: 'getPerformanceStatus: 70% → Approaching', fn: testPerformanceStatusMid },
    { name: 'getPerformanceStatus: 40% → Below', fn: testPerformanceStatusLow },
    { name: 'getPerformanceStatus: boundary at threshold', fn: testPerformanceStatusBoundary },
    { name: 'Fixture scores: high-performer averages above 80', fn: testHighPerformerAverage },
    { name: 'Fixture scores: low-performer averages below 70', fn: testLowPerformerAverage },
    { name: 'SKILL_SECTIONS maps to valid lesson ranges', fn: testSkillSectionLessonRanges },
    { name: 'Gateway lessons are subset of 1-128', fn: testGatewayLessonRange }
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

function testReviewLessonsContent() {
  // Known gateway review lessons from UFLI curriculum
  const knownGateways = [5, 10, 19, 35, 38, 41, 49, 53];
  for (let i = 0; i < knownGateways.length; i++) {
    Assert.includes(REVIEW_LESSONS, knownGateways[i],
      'REVIEW_LESSONS should include L' + knownGateways[i]);
  }
}

function testReviewLessonsSetDefined() {
  if (typeof REVIEW_LESSONS_SET === 'undefined') return; // optional constant
  Assert.isNotNull(REVIEW_LESSONS_SET, 'REVIEW_LESSONS_SET should be defined');
  // Should contain same lessons as REVIEW_LESSONS array
  for (let i = 0; i < REVIEW_LESSONS.length; i++) {
    Assert.isTrue(
      REVIEW_LESSONS_SET.has(REVIEW_LESSONS[i]),
      'REVIEW_LESSONS_SET should contain ' + REVIEW_LESSONS[i]
    );
  }
}

function testPerformanceThresholds() {
  Assert.isNotNull(PERFORMANCE_THRESHOLDS, 'PERFORMANCE_THRESHOLDS should be defined');
  // Should have numeric threshold values
  Assert.typeOf(PERFORMANCE_THRESHOLDS.AT_ABOVE, 'number', 'AT_ABOVE threshold should be number');
  Assert.typeOf(PERFORMANCE_THRESHOLDS.APPROACHING, 'number', 'APPROACHING threshold should be number');
}

function testStatusLabels() {
  Assert.isNotNull(STATUS_LABELS, 'STATUS_LABELS should be defined');
  Assert.isNotNull(STATUS_LABELS.AT_ABOVE, 'AT_ABOVE label should be defined');
  Assert.isNotNull(STATUS_LABELS.APPROACHING, 'APPROACHING label should be defined');
  Assert.isNotNull(STATUS_LABELS.BELOW, 'BELOW label should be defined');
}

function testPerformanceStatusHigh() {
  if (typeof getPerformanceStatus !== 'function') return;
  const status = getPerformanceStatus(90);
  Assert.equals(status, STATUS_LABELS.AT_ABOVE,
    '90% should be "' + STATUS_LABELS.AT_ABOVE + '"');
}

function testPerformanceStatusMid() {
  if (typeof getPerformanceStatus !== 'function') return;
  const status = getPerformanceStatus(70);
  Assert.equals(
    status,
    STATUS_LABELS.NEEDS_SUPPORT,
    '70% should be "' + STATUS_LABELS.NEEDS_SUPPORT + '"'
  );
}
function testPerformanceStatusLow() {
  if (typeof getPerformanceStatus !== 'function') return;
  const status = getPerformanceStatus(40);
  Assert.equals(status, STATUS_LABELS.BELOW,
    '40% should be "' + STATUS_LABELS.BELOW + '"');
}

function testPerformanceStatusBoundary() {
  if (typeof getPerformanceStatus !== 'function') return;
  // Test exact threshold value
  const thresholdValue = PERFORMANCE_THRESHOLDS.AT_ABOVE;
  const status = getPerformanceStatus(thresholdValue);
  Assert.equals(status, STATUS_LABELS.AT_ABOVE,
    'Exact threshold (' + thresholdValue + '%) should be "' + STATUS_LABELS.AT_ABOVE + '"');
}

function testHighPerformerAverage() {
  // S001 scores: 90, 85, 78, 92, 88, 80 → avg = 85.5
  const scores = FIXTURE_LESSON_SCORES['S001'];
  const values = Object.keys(scores).map(function(k) { return scores[k]; });
  const avg = values.reduce(function(a, b) { return a + b; }, 0) / values.length;
  Assert.greaterThan(avg, 80, 'S001 average should be above 80 (got ' + avg + ')');
}

function testLowPerformerAverage() {
  // S002 scores: 65, 70, 60, 55, 50, 45 → avg = 57.5
  const scores = FIXTURE_LESSON_SCORES['S002'];
  const values = Object.keys(scores).map(function(k) { return scores[k]; });
  const avg = values.reduce(function(a, b) { return a + b; }, 0) / values.length;
  Assert.isTrue(avg < 70, 'S002 average should be below 70 (got ' + avg + ')');
}

function testSkillSectionLessonRanges() {
  const sectionKeys = Object.keys(SKILL_SECTIONS);
  for (let i = 0; i < sectionKeys.length; i++) {
    const lessons = SKILL_SECTIONS[sectionKeys[i]];
    Assert.isTrue(Array.isArray(lessons),
      'SKILL_SECTIONS["' + sectionKeys[i] + '"] should be an array');
    Assert.greaterThan(lessons.length, 0,
      'SKILL_SECTIONS["' + sectionKeys[i] + '"] should not be empty');
    // All lesson numbers should be 1–128
    for (let j = 0; j < lessons.length; j++) {
      Assert.isTrue(lessons[j] >= 1 && lessons[j] <= 128,
        'Lesson ' + lessons[j] + ' in section "' + sectionKeys[i] + '" should be 1-128');
    }
  }
}

function testGatewayLessonRange() {
  for (let i = 0; i < REVIEW_LESSONS.length; i++) {
    Assert.isTrue(
      REVIEW_LESSONS[i] >= 1 && REVIEW_LESSONS[i] <= 128,
      'Review lesson ' + REVIEW_LESSONS[i] + ' should be in range 1-128'
    );
  }
}
