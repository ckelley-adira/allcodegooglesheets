/**
 * SharedEngine.test.js — Unit tests for SharedEngine.gs
 *
 * Covers every pure function exported from SharedEngine.gs:
 *   - getLessonColumnIndex, getLessonStatus, isReviewLesson
 *   - partitionLessonsByReview, checkGateway
 *   - calculateBenchmark, calculateSectionPercentage
 *   - calculatePreKScores, countYsInColumns
 *   - getColumnLetter, extractLessonNumber, normalizeStudent
 *   - getLastLessonColumn, createMergedRow
 *   - Grade metric arrays (FOUNDATIONAL_LESSONS, etc.)
 *   - SHARED_GRADE_METRICS
 */

const { loadGasModules } = require('./helpers/loadGasModules');
const { DEFAULT_LAYOUT, buildStudentRow, PREK_HEADERS, PREK_CONFIG } = require('./fixtures/testData');

let ctx;

beforeAll(() => {
  ({ ctx } = loadGasModules());
});

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('getColumnLetter', () => {
  test('returns A for column 1', () => {
    expect(ctx.getColumnLetter(1)).toBe('A');
  });

  test('returns Z for column 26', () => {
    expect(ctx.getColumnLetter(26)).toBe('Z');
  });

  test('returns AA for column 27', () => {
    expect(ctx.getColumnLetter(27)).toBe('AA');
  });

  test('returns AZ for column 52', () => {
    expect(ctx.getColumnLetter(52)).toBe('AZ');
  });

  test('returns empty string for column 0', () => {
    expect(ctx.getColumnLetter(0)).toBe('');
  });
});

describe('extractLessonNumber', () => {
  test('extracts number from standard label', () => {
    expect(ctx.extractLessonNumber('UFLI L42 ff, ll, ss, zz')).toBe(42);
  });

  test('extracts from L1', () => {
    expect(ctx.extractLessonNumber('UFLI L1 a/ā/')).toBe(1);
  });

  test('extracts from L128', () => {
    expect(ctx.extractLessonNumber('UFLI L128 Affixes Review 2')).toBe(128);
  });

  test('returns null for empty input', () => {
    expect(ctx.extractLessonNumber('')).toBeNull();
    expect(ctx.extractLessonNumber(null)).toBeNull();
    expect(ctx.extractLessonNumber(undefined)).toBeNull();
  });

  test('returns null for non-matching text', () => {
    expect(ctx.extractLessonNumber('Comprehension')).toBeNull();
  });
});

describe('normalizeStudent', () => {
  test('trims whitespace from name', () => {
    const result = ctx.normalizeStudent({ name: '  John Smith  ', grade: 'G1' });
    expect(result.name).toBe('John Smith');
    expect(result.grade).toBe('G1');
  });

  test('preserves other properties', () => {
    const result = ctx.normalizeStudent({ name: 'Alice', teacher: 'Jones', extra: 123 });
    expect(result.name).toBe('Alice');
    expect(result.teacher).toBe('Jones');
    expect(result.extra).toBe(123);
  });

  test('handles null/undefined name', () => {
    expect(ctx.normalizeStudent({ name: null }).name).toBe('');
    expect(ctx.normalizeStudent({ name: undefined }).name).toBe('');
  });
});

describe('getLastLessonColumn', () => {
  test('calculates correct column for default layout', () => {
    // COL_FIRST_LESSON=6, TOTAL_LESSONS=128 → last column = 133
    const result = ctx.getLastLessonColumn(DEFAULT_LAYOUT);
    expect(result).toBe(ctx.getColumnLetter(133));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CORE HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('getLessonColumnIndex', () => {
  test('returns correct index for lesson 1', () => {
    expect(ctx.getLessonColumnIndex(1, DEFAULT_LAYOUT)).toBe(5); // offset 5 + 1 - 1
  });

  test('returns correct index for lesson 128', () => {
    expect(ctx.getLessonColumnIndex(128, DEFAULT_LAYOUT)).toBe(132);
  });
});

describe('getLessonStatus', () => {
  test('returns Y for a passed lesson', () => {
    const row = buildStudentRow({ lessons: { 1: 'Y' } });
    expect(ctx.getLessonStatus(row, 1, DEFAULT_LAYOUT)).toBe('Y');
  });

  test('returns N for a failed lesson', () => {
    const row = buildStudentRow({ lessons: { 1: 'N' } });
    expect(ctx.getLessonStatus(row, 1, DEFAULT_LAYOUT)).toBe('N');
  });

  test('returns empty string for blank lesson', () => {
    const row = buildStudentRow();
    expect(ctx.getLessonStatus(row, 1, DEFAULT_LAYOUT)).toBe('');
  });

  test('normalises lowercase y to Y', () => {
    const row = buildStudentRow({ lessons: { 5: 'y' } });
    expect(ctx.getLessonStatus(row, 5, DEFAULT_LAYOUT)).toBe('Y');
  });

  test('trims whitespace', () => {
    const row = buildStudentRow({ lessons: { 10: ' Y ' } });
    expect(ctx.getLessonStatus(row, 10, DEFAULT_LAYOUT)).toBe('Y');
  });

  test('returns empty for out-of-bounds index', () => {
    const shortRow = ['Name', 'G1', 'Teacher', 'Group', ''];
    expect(ctx.getLessonStatus(shortRow, 128, DEFAULT_LAYOUT)).toBe('');
  });
});

describe('isReviewLesson', () => {
  test('returns true for known review lessons', () => {
    const reviews = [35, 36, 37, 39, 40, 41, 49, 53, 57, 59, 62, 71, 76, 79, 83, 88, 92, 97, 128];
    for (const num of reviews) {
      expect(ctx.isReviewLesson(num)).toBe(true);
    }
  });

  test('returns false for non-review lessons', () => {
    const nonReviews = [1, 2, 10, 42, 50, 100, 127];
    for (const num of nonReviews) {
      expect(ctx.isReviewLesson(num)).toBe(false);
    }
  });
});

describe('partitionLessonsByReview', () => {
  test('correctly partitions a mixed list', () => {
    const input = [1, 2, 35, 36, 42, 49, 50];
    const result = ctx.partitionLessonsByReview(input);
    expect(result.reviews).toEqual([35, 36, 49]);
    expect(result.nonReviews).toEqual([1, 2, 42, 50]);
  });

  test('handles empty array', () => {
    const result = ctx.partitionLessonsByReview([]);
    expect(result.reviews).toEqual([]);
    expect(result.nonReviews).toEqual([]);
  });

  test('handles all-review list', () => {
    const result = ctx.partitionLessonsByReview([35, 36, 37]);
    expect(result.reviews).toEqual([35, 36, 37]);
    expect(result.nonReviews).toEqual([]);
  });

  test('handles all-non-review list', () => {
    const result = ctx.partitionLessonsByReview([1, 2, 3]);
    expect(result.reviews).toEqual([]);
    expect(result.nonReviews).toEqual([1, 2, 3]);
  });
});

describe('checkGateway', () => {
  test('gateway passes when all reviews are Y', () => {
    const row = buildStudentRow({ lessons: { 49: 'Y', 53: 'Y' } });
    const result = ctx.checkGateway(row, [49, 53], DEFAULT_LAYOUT);
    expect(result.assigned).toBe(true);
    expect(result.allPassed).toBe(true);
    expect(result.gatewayPassed).toBe(true);
  });

  test('gateway fails when any review is N', () => {
    const row = buildStudentRow({ lessons: { 49: 'Y', 53: 'N' } });
    const result = ctx.checkGateway(row, [49, 53], DEFAULT_LAYOUT);
    expect(result.assigned).toBe(true);
    expect(result.allPassed).toBe(false);
    expect(result.gatewayPassed).toBe(false);
  });

  test('gateway not assigned when all reviews are blank', () => {
    const row = buildStudentRow();
    const result = ctx.checkGateway(row, [49, 53], DEFAULT_LAYOUT);
    expect(result.assigned).toBe(false);
    expect(result.allPassed).toBe(true);
    expect(result.gatewayPassed).toBe(false);
  });

  test('single review Y passes gateway', () => {
    const row = buildStudentRow({ lessons: { 49: 'Y' } });
    const result = ctx.checkGateway(row, [49], DEFAULT_LAYOUT);
    expect(result.gatewayPassed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CORE CALCULATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('calculateSectionPercentage', () => {
  // Section: Digraphs = [42,43,44,45,46,47,48,49,50,51,52,53]
  // Reviews in Digraphs: 49, 53
  // Non-reviews in Digraphs: 42,43,44,45,46,47,48,50,51,52 (10 lessons)

  test('initial assessment counts only non-review Ys (no gateway)', () => {
    const digraphLessons = ctx.SKILL_SECTIONS['Digraphs'];
    // Pass 5 of 10 non-review lessons, plus reviews
    const lessons = { 42: 'Y', 43: 'Y', 44: 'Y', 45: 'Y', 46: 'Y', 49: 'Y', 53: 'Y' };
    const row = buildStudentRow({ lessons });
    const pct = ctx.calculateSectionPercentage(row, digraphLessons, true, DEFAULT_LAYOUT);
    expect(pct).toBe(50); // 5/10 = 50%
  });

  test('ongoing with gateway passed returns 100%', () => {
    const digraphLessons = ctx.SKILL_SECTIONS['Digraphs'];
    // Only need reviews to pass — all reviews Y
    const lessons = { 42: 'Y', 49: 'Y', 53: 'Y' };
    const row = buildStudentRow({ lessons });
    const pct = ctx.calculateSectionPercentage(row, digraphLessons, false, DEFAULT_LAYOUT);
    expect(pct).toBe(100);
  });

  test('ongoing without gateway counts actual Ys', () => {
    const digraphLessons = ctx.SKILL_SECTIONS['Digraphs'];
    // Reviews not all passed, so fall back to counting
    const lessons = { 42: 'Y', 43: 'Y', 44: 'N', 49: 'N' };
    const row = buildStudentRow({ lessons });
    const pct = ctx.calculateSectionPercentage(row, digraphLessons, false, DEFAULT_LAYOUT);
    expect(pct).toBe(20); // 2/10 = 20%
  });

  test('returns empty string for section with no non-reviews', () => {
    const pct = ctx.calculateSectionPercentage(buildStudentRow(), [], false, DEFAULT_LAYOUT);
    expect(pct).toBe('');
  });

  test('returns 0 when no lessons attempted', () => {
    const digraphLessons = ctx.SKILL_SECTIONS['Digraphs'];
    const row = buildStudentRow();
    const pct = ctx.calculateSectionPercentage(row, digraphLessons, false, DEFAULT_LAYOUT);
    expect(pct).toBe(0);
  });
});

describe('calculateBenchmark', () => {
  test('returns 0 for empty lessonIndices', () => {
    const row = buildStudentRow();
    expect(ctx.calculateBenchmark(row, [], 0, DEFAULT_LAYOUT)).toBe(0);
  });

  test('returns 0 for null lessonIndices', () => {
    const row = buildStudentRow();
    expect(ctx.calculateBenchmark(row, null, 0, DEFAULT_LAYOUT)).toBe(0);
  });

  test('calculates based on actual Ys when gateway not passed', () => {
    // Use just the foundational lessons (1-34)
    const lessons = {};
    // Pass 17 of 34 foundational lessons (all non-review)
    for (let i = 1; i <= 17; i++) lessons[i] = 'Y';
    const row = buildStudentRow({ lessons });
    const pct = ctx.calculateBenchmark(row, ctx.FOUNDATIONAL_LESSONS, 34, DEFAULT_LAYOUT);
    // FOUNDATIONAL_LESSONS = [1..34], no review lessons in that set
    // 17/34 = 50%
    expect(pct).toBe(50);
  });

  test('gateway logic grants full section credit', () => {
    // Digraphs section: lessons 42-53, reviews 49, 53
    // If reviews pass, all 10 non-reviews get credit
    const digraphLessons = ctx.SKILL_SECTIONS['Digraphs']; // [42..53]
    const lessons = { 49: 'Y', 53: 'Y' }; // Only reviews passed
    const row = buildStudentRow({ lessons });
    const pct = ctx.calculateBenchmark(row, digraphLessons, 10, DEFAULT_LAYOUT);
    // Gateway passed → all 10 non-reviews count → 10/10 = 100%
    expect(pct).toBe(100);
  });

  test('calculates KG foundational benchmark correctly', () => {
    const lessons = {};
    // Pass all 34 lessons
    for (let i = 1; i <= 34; i++) lessons[i] = 'Y';
    const row = buildStudentRow({ grade: 'KG', lessons });
    const metrics = ctx.SHARED_GRADE_METRICS['KG'].foundational;
    const pct = ctx.calculateBenchmark(row, metrics.lessons, metrics.denominator, DEFAULT_LAYOUT);
    expect(pct).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('countYsInColumns', () => {
  test('counts Y matches in columns containing pattern', () => {
    const headers = PREK_HEADERS;
    const row = ['Student', 'PreK', '', '', 'Y', 'Y', 'N', 'Y', '', 'Y', 'Y', 'N', 'Y'];
    expect(ctx.countYsInColumns(row, headers, 'Name')).toBe(2);  // A Name=Y, B Name=Y, C Name=N
    expect(ctx.countYsInColumns(row, headers, 'Sound')).toBe(2); // A Sound=Y, B Sound='', C Sound=Y
    expect(ctx.countYsInColumns(row, headers, 'Form')).toBe(2);  // A Form=Y, B Form=N, C Form=Y
  });

  test('returns 0 when no matches', () => {
    const row = new Array(PREK_HEADERS.length).fill('');
    expect(ctx.countYsInColumns(row, PREK_HEADERS, 'Name')).toBe(0);
  });
});

describe('calculatePreKScores', () => {
  test('calculates correct percentages with all Ys', () => {
    // 3 Name, 3 Sound, 3 Form all Y
    const row = ['Student', 'PreK', '', '', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y'];
    const scores = ctx.calculatePreKScores(row, PREK_HEADERS, PREK_CONFIG);
    // formY=3, nameY=3, soundY=3
    expect(scores.foundational).toBe(Math.round((3 / 26) * 100)); // 12
    expect(scores.minGrade).toBe(Math.round((6 / 52) * 100));     // 12
    expect(scores.fullGrade).toBe(Math.round((9 / 78) * 100));    // 12
  });

  test('returns 0 for no Ys', () => {
    const row = ['Student', 'PreK', '', '', '', '', '', '', '', '', '', '', ''];
    const scores = ctx.calculatePreKScores(row, PREK_HEADERS, PREK_CONFIG);
    expect(scores.foundational).toBe(0);
    expect(scores.minGrade).toBe(0);
    expect(scores.fullGrade).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MERGED ROW
// ═══════════════════════════════════════════════════════════════════════════

describe('createMergedRow', () => {
  test('preserves Y from initial when current is blank', () => {
    const current = ['Name', 'G1', '', '', '', '', ''];  // lesson 1 blank
    const initial = ['Name', 'G1', '', '', '', 'Y', '']; // lesson 1 Y
    const merged = ctx.createMergedRow(current, initial);
    expect(merged[5]).toBe('Y');
  });

  test('keeps current Y even if initial is blank', () => {
    const current = ['Name', 'G1', '', '', '', 'Y', ''];
    const initial = ['Name', 'G1', '', '', '', '',  ''];
    const merged = ctx.createMergedRow(current, initial);
    expect(merged[5]).toBe('Y');
  });

  test('returns current row unchanged when initial is null', () => {
    const current = ['Name', 'G1', '', '', '', 'N', ''];
    const merged = ctx.createMergedRow(current, null);
    expect(merged).toEqual(current);
  });

  test('preserves Y from initial when current is N', () => {
    const current = ['Name', 'G1', '', '', '', 'N', ''];
    const initial = ['Name', 'G1', '', '', '', 'Y', ''];
    const merged = ctx.createMergedRow(current, initial);
    expect(merged[5]).toBe('Y');
  });

  test('does not modify the original current array', () => {
    const current = ['Name', 'G1', '', '', '', '', ''];
    const initial = ['Name', 'G1', '', '', '', 'Y', ''];
    const original = [...current];
    ctx.createMergedRow(current, initial);
    expect(current).toEqual(original);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GRADE METRIC ARRAYS
// ═══════════════════════════════════════════════════════════════════════════

describe('Grade metric lesson arrays', () => {
  test('FOUNDATIONAL_LESSONS contains lessons 1-34', () => {
    expect(ctx.FOUNDATIONAL_LESSONS).toHaveLength(34);
    expect(ctx.FOUNDATIONAL_LESSONS[0]).toBe(1);
    expect(ctx.FOUNDATIONAL_LESSONS[33]).toBe(34);
  });

  test('G1_MINIMUM_LESSONS has 44 lessons', () => {
    expect(ctx.G1_MINIMUM_LESSONS).toHaveLength(44);
  });

  test('G2_MINIMUM_LESSONS has 56 lessons', () => {
    expect(ctx.G2_MINIMUM_LESSONS).toHaveLength(56);
  });

  test('G4_MINIMUM_LESSONS has 103 lessons', () => {
    expect(ctx.G4_MINIMUM_LESSONS).toHaveLength(103);
  });

  test('ALL_NON_REVIEW_LESSONS excludes all 23 review lessons', () => {
    expect(ctx.ALL_NON_REVIEW_LESSONS).toHaveLength(128 - 23);
    for (const num of ctx.ALL_NON_REVIEW_LESSONS) {
      expect(ctx.REVIEW_LESSONS_SET.has(num)).toBe(false);
    }
  });

  test('no review lessons appear in G1_MINIMUM_LESSONS', () => {
    for (const num of ctx.G1_MINIMUM_LESSONS) {
      expect(ctx.REVIEW_LESSONS_SET.has(num)).toBe(false);
    }
  });
});

describe('SHARED_GRADE_METRICS', () => {
  test('covers PreK through G8', () => {
    const expected = ['PreK', 'KG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];
    expect(Object.keys(ctx.SHARED_GRADE_METRICS).sort()).toEqual(expected.sort());
  });

  test('each grade has three benchmark types', () => {
    for (const [grade, metrics] of Object.entries(ctx.SHARED_GRADE_METRICS)) {
      expect(metrics).toHaveProperty('foundational');
      expect(metrics).toHaveProperty('minimum');
      expect(metrics).toHaveProperty('currentYear');
      expect(metrics.foundational).toHaveProperty('lessons');
      expect(metrics.foundational).toHaveProperty('denominator');
    }
  });

  test('G4-G8 share the same configuration', () => {
    const g4 = ctx.SHARED_GRADE_METRICS['G4'];
    for (const grade of ['G5', 'G6', 'G7', 'G8']) {
      expect(ctx.SHARED_GRADE_METRICS[grade].minimum.denominator).toBe(g4.minimum.denominator);
      expect(ctx.SHARED_GRADE_METRICS[grade].currentYear.denominator).toBe(g4.currentYear.denominator);
    }
  });
});
