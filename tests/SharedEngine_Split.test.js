/**
 * SharedEngine_Split.test.js — Validates the SharedEngine_Core.gs + SharedEngine_IO.gs
 * split produces identical results to the original SharedEngine.gs.
 *
 * Ensures:
 *   1. API surface parity: every function from the monolith is available in the split
 *   2. Constants parity: all grade-metric arrays and SHARED_GRADE_METRICS are identical
 *   3. computeStudentStats(): the NEW pure function works correctly for all grade bands
 *   4. Result equivalence: key calculations return the same values in both contexts
 */

const { loadGasModules, GAS_FILES, GAS_FILES_SPLIT } = require('./helpers/loadGasModules');
const { DEFAULT_LAYOUT, buildStudentRow, buildPreKRow, PREK_HEADERS, PREK_CONFIG } = require('./fixtures/testData');

let orig; // context loaded from original SharedEngine.gs
let split; // context loaded from SharedEngine_Core.gs + SharedEngine_IO.gs

beforeAll(() => {
  ({ ctx: orig } = loadGasModules(GAS_FILES));
  ({ ctx: split } = loadGasModules(GAS_FILES_SPLIT));
});

// Helper: build a config object for computeStudentStats
function makeConfig(overrides = {}) {
  return {
    LAYOUT: DEFAULT_LAYOUT,
    PREK_CONFIG: PREK_CONFIG,
    GRADE_METRICS: undefined, // uses SHARED_GRADE_METRICS fallback
    SHEET_NAMES_V2: {
      UFLI_MAP: 'UFLI MAP',
      SKILLS: 'Skills Tracker',
      GRADE_SUMMARY: 'Grade Summary',
      INITIAL_ASSESSMENT: 'Initial Assessment',
    },
    SHEET_NAMES_PREK: { DATA: 'Pre-K Data' },
    ...overrides,
  };
}

// Helper: build mapData with 5 empty header rows then data rows at index 5+
function buildMapData(studentRows) {
  const headers = Array.from({ length: 5 }, () => new Array(133).fill(''));
  return [...headers, ...studentRows];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. API SURFACE PARITY
// ═══════════════════════════════════════════════════════════════════════════

describe('API Surface Parity — split exposes every original function', () => {
  const sharedFunctions = [
    'getLessonColumnIndex',
    'getLessonStatus',
    'isReviewLesson',
    'partitionLessonsByReview',
    'checkGateway',
    'calculateBenchmark',
    'calculateSectionPercentage',
    'calculatePreKScores',
    'countYsInColumns',
    'getColumnLetter',
    'extractLessonNumber',
    'normalizeStudent',
    'getLastLessonColumn',
    'createMergedRow',
    'getOrCreateSheet',
    'log',
  ];

  test.each(sharedFunctions)('%s is a function in the split context', (fnName) => {
    expect(typeof split[fnName]).toBe('function');
  });

  test('computeStudentStats is available ONLY in split (new pure function)', () => {
    expect(typeof split.computeStudentStats).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. CONSTANTS PARITY
// ═══════════════════════════════════════════════════════════════════════════

describe('Constants Parity — split exposes identical constant values', () => {
  const arrayConstants = [
    'FOUNDATIONAL_LESSONS',
    'G1_MINIMUM_LESSONS',
    'G1_CURRENT_YEAR_LESSONS',
    'G2_MINIMUM_LESSONS',
    'G2_CURRENT_YEAR_LESSONS',
    'G4_MINIMUM_LESSONS',
    'ALL_NON_REVIEW_LESSONS',
  ];

  test.each(arrayConstants)('%s exists and matches original', (name) => {
    expect(split[name]).toBeDefined();
    expect(split[name]).toEqual(orig[name]);
  });

  test('SHARED_GRADE_METRICS keys and denominators match original', () => {
    expect(Object.keys(split.SHARED_GRADE_METRICS).sort())
      .toEqual(Object.keys(orig.SHARED_GRADE_METRICS).sort());

    for (const grade of Object.keys(orig.SHARED_GRADE_METRICS)) {
      const o = orig.SHARED_GRADE_METRICS[grade];
      const s = split.SHARED_GRADE_METRICS[grade];
      expect(s.foundational.denominator).toBe(o.foundational.denominator);
      expect(s.minimum.denominator).toBe(o.minimum.denominator);
      expect(s.currentYear.denominator).toBe(o.currentYear.denominator);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. computeStudentStats UNIT TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('computeStudentStats', () => {
  test('single KG student — all 34 foundational lessons passed → 100%', () => {
    const lessons = {};
    for (let i = 1; i <= 34; i++) lessons[i] = 'Y';
    const studentRow = buildStudentRow({ name: 'KG Student', grade: 'KG', lessons });
    const mapData = buildMapData([studentRow]);

    const { skillsOutput, summaryOutput } = split.computeStudentStats({
      mapData,
      preKData: [],
      preKHeaders: [],
      initialData: [],
      config: makeConfig(),
    });

    expect(summaryOutput).toHaveLength(1);
    // KG: foundational = 34/34 = 100%, minimum = 34/34 = 100%, currentYear = 34/34 = 100%
    expect(summaryOutput[0][0]).toBe('KG Student');
    expect(summaryOutput[0][4]).toBe(100); // foundational
    expect(summaryOutput[0][5]).toBe(100); // minimum
    expect(summaryOutput[0][6]).toBe(100); // currentYear
    expect(summaryOutput[0][7]).toBe('On Track');

    // Skills output should also have 1 row with metadata + 16 skill section percentages
    expect(skillsOutput).toHaveLength(1);
    expect(skillsOutput[0]).toHaveLength(4 + Object.keys(split.SKILL_SECTIONS).length);
  });

  test('G1 student with gateway — digraph reviews Y → skills section 100%', () => {
    // Pass all foundational lessons (1-34) + digraph reviews 49, 53
    const lessons = {};
    for (let i = 1; i <= 34; i++) lessons[i] = 'Y';
    lessons[49] = 'Y';
    lessons[53] = 'Y';
    const studentRow = buildStudentRow({ name: 'G1 Gateway', grade: 'G1', lessons });
    const mapData = buildMapData([studentRow]);

    const { skillsOutput, summaryOutput } = split.computeStudentStats({
      mapData,
      preKData: [],
      preKHeaders: [],
      initialData: [],
      config: makeConfig(),
    });

    expect(summaryOutput).toHaveLength(1);

    // Skills output: Digraphs is the 4th section (index 3), so skillsOutput[0][4+3] = index 7
    // Gateway passed (reviews 49,53 both Y) → calculateSectionPercentage returns 100%
    expect(skillsOutput[0][4 + 3]).toBe(100); // Digraphs section = 100%

    // Summary: G1 minimum benchmark (G1_MINIMUM_LESSONS) excludes review lessons,
    // so gateway doesn't apply in calculateBenchmark — only actual Ys count
    // 34 foundational Y / 44 total = 77%
    expect(summaryOutput[0][5]).toBe(77); // minimum
  });

  test('PreK student from Pre-K Data sheet — HWT scores calculated', () => {
    // All 3 Name=Y, 3 Sound=Y, 3 Form=Y
    const preKRow = ['PreK Kid', 'PreK', 'Teacher', 'Group',
      'Y', 'Y', 'Y',  // A/B/C Name
      'Y', 'Y', 'Y',  // A/B/C Sound
      'Y', 'Y', 'Y',  // A/B/C Form
    ];
    const preKData = [PREK_HEADERS, preKRow]; // header row 1, data row 2

    const { summaryOutput, skillsOutput } = split.computeStudentStats({
      mapData: [],
      preKData,
      preKHeaders: PREK_HEADERS,
      initialData: [],
      config: makeConfig(),
    });

    expect(summaryOutput).toHaveLength(1);
    expect(summaryOutput[0][0]).toBe('PreK Kid');
    // foundational = formY(3) / 26 = 12%
    expect(summaryOutput[0][4]).toBe(Math.round((3 / 26) * 100));
    // minGrade = (nameY(3) + soundY(3)) / 52 = 12%
    expect(summaryOutput[0][5]).toBe(Math.round((6 / 52) * 100));
    // fullGrade = (3 + 3 + 3) / 78 = 12%
    expect(summaryOutput[0][6]).toBe(Math.round((9 / 78) * 100));

    // Skills row should have blank percentages (PreK doesn't use UFLI sections)
    expect(skillsOutput).toHaveLength(1);
    const sectionValues = skillsOutput[0].slice(4);
    sectionValues.forEach(v => expect(v).toBe(''));
  });

  test('empty data — no students produces empty output', () => {
    const mapData = buildMapData([]); // 5 header rows, no data rows

    const { skillsOutput, summaryOutput } = split.computeStudentStats({
      mapData,
      preKData: [],
      preKHeaders: [],
      initialData: [],
      config: makeConfig(),
    });

    expect(skillsOutput).toHaveLength(0);
    expect(summaryOutput).toHaveLength(0);
  });

  test('mixed K-8 + PreK students — both processed', () => {
    const kgLessons = {};
    for (let i = 1; i <= 10; i++) kgLessons[i] = 'Y';
    const kgRow = buildStudentRow({ name: 'KG Mix', grade: 'KG', lessons: kgLessons });

    const g2Lessons = {};
    for (let i = 1; i <= 20; i++) g2Lessons[i] = 'Y';
    const g2Row = buildStudentRow({ name: 'G2 Mix', grade: 'G2', lessons: g2Lessons });

    const mapData = buildMapData([kgRow, g2Row]);

    const preKRow = ['PreK Mix', 'PreK', '', '', 'Y', '', '', 'Y', '', '', 'Y', '', ''];
    const preKData = [PREK_HEADERS, preKRow];

    const { skillsOutput, summaryOutput } = split.computeStudentStats({
      mapData,
      preKData,
      preKHeaders: PREK_HEADERS,
      initialData: [],
      config: makeConfig(),
    });

    // 2 UFLI students + 1 PreK = 3 total
    expect(skillsOutput).toHaveLength(3);
    expect(summaryOutput).toHaveLength(3);
    expect(summaryOutput[0][0]).toBe('KG Mix');
    expect(summaryOutput[1][0]).toBe('G2 Mix');
    expect(summaryOutput[2][0]).toBe('PreK Mix');
  });

  test('initial assessment merge — Y preserved from initial', () => {
    // Current: lesson 1 blank, lesson 2 Y
    // Initial: lesson 1 Y, lesson 2 blank
    const currentRow = buildStudentRow({ name: 'Merge Kid', grade: 'KG', lessons: { 2: 'Y' } });
    const initialRow = buildStudentRow({ name: 'Merge Kid', grade: 'KG', lessons: { 1: 'Y' } });

    const mapData = buildMapData([currentRow]);
    const initialData = buildMapData([initialRow]);

    const { summaryOutput } = split.computeStudentStats({
      mapData,
      preKData: [],
      preKHeaders: [],
      initialData,
      config: makeConfig(),
    });

    expect(summaryOutput).toHaveLength(1);
    // Merged row should have both lesson 1 and 2 as Y → 2/34 foundational
    expect(summaryOutput[0][4]).toBe(Math.round((2 / 34) * 100));
  });

  test('PreK students in UFLI MAP are skipped (grade="PreK")', () => {
    const prekInMap = buildStudentRow({ name: 'PreK In Map', grade: 'PreK', lessons: { 1: 'Y' } });
    const kgRow = buildStudentRow({ name: 'KG Real', grade: 'KG', lessons: { 1: 'Y' } });
    const mapData = buildMapData([prekInMap, kgRow]);

    const { summaryOutput, skillsOutput } = split.computeStudentStats({
      mapData,
      preKData: [],
      preKHeaders: [],
      initialData: [],
      config: makeConfig(),
    });

    // Only KG student should appear — PreK row in UFLI MAP is skipped
    expect(summaryOutput).toHaveLength(1);
    expect(summaryOutput[0][0]).toBe('KG Real');
    expect(skillsOutput).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. RESULT EQUIVALENCE — original vs split produce identical results
// ═══════════════════════════════════════════════════════════════════════════

describe('Result Equivalence — original and split produce identical output', () => {
  test('getLessonColumnIndex returns same values', () => {
    for (const lesson of [1, 34, 42, 128]) {
      expect(split.getLessonColumnIndex(lesson, DEFAULT_LAYOUT))
        .toBe(orig.getLessonColumnIndex(lesson, DEFAULT_LAYOUT));
    }
  });

  test('getLessonStatus returns same values on identical rows', () => {
    const row = buildStudentRow({ lessons: { 1: 'Y', 10: 'N', 50: 'y', 128: ' Y ' } });
    for (const lesson of [1, 5, 10, 50, 128]) {
      expect(split.getLessonStatus(row, lesson, DEFAULT_LAYOUT))
        .toBe(orig.getLessonStatus(row, lesson, DEFAULT_LAYOUT));
    }
  });

  test('isReviewLesson agrees for all 128 lessons', () => {
    for (let i = 1; i <= 128; i++) {
      expect(split.isReviewLesson(i)).toBe(orig.isReviewLesson(i));
    }
  });

  test('partitionLessonsByReview returns identical partitions', () => {
    const input = [1, 2, 35, 36, 42, 49, 50, 128];
    expect(split.partitionLessonsByReview(input)).toEqual(orig.partitionLessonsByReview(input));
  });

  test('checkGateway returns identical result', () => {
    const row = buildStudentRow({ lessons: { 49: 'Y', 53: 'Y' } });
    expect(split.checkGateway(row, [49, 53], DEFAULT_LAYOUT))
      .toEqual(orig.checkGateway(row, [49, 53], DEFAULT_LAYOUT));
  });

  test('calculateBenchmark returns identical results for KG foundational', () => {
    const lessons = {};
    for (let i = 1; i <= 17; i++) lessons[i] = 'Y';
    const row = buildStudentRow({ grade: 'KG', lessons });
    const metrics = orig.SHARED_GRADE_METRICS['KG'].foundational;

    expect(split.calculateBenchmark(row, metrics.lessons, metrics.denominator, DEFAULT_LAYOUT))
      .toBe(orig.calculateBenchmark(row, metrics.lessons, metrics.denominator, DEFAULT_LAYOUT));
  });

  test('calculateSectionPercentage returns identical results for Digraphs', () => {
    const digraphs = orig.SKILL_SECTIONS['Digraphs'];
    const row = buildStudentRow({ lessons: { 42: 'Y', 43: 'Y', 44: 'Y', 49: 'Y', 53: 'N' } });

    expect(split.calculateSectionPercentage(row, digraphs, false, DEFAULT_LAYOUT))
      .toBe(orig.calculateSectionPercentage(row, digraphs, false, DEFAULT_LAYOUT));

    expect(split.calculateSectionPercentage(row, digraphs, true, DEFAULT_LAYOUT))
      .toBe(orig.calculateSectionPercentage(row, digraphs, true, DEFAULT_LAYOUT));
  });

  test('calculatePreKScores returns identical results', () => {
    const row = ['Student', 'PreK', '', '', 'Y', 'Y', 'N', 'Y', '', 'Y', 'Y', 'N', 'Y'];
    expect(split.calculatePreKScores(row, PREK_HEADERS, PREK_CONFIG))
      .toEqual(orig.calculatePreKScores(row, PREK_HEADERS, PREK_CONFIG));
  });

  test('getColumnLetter returns identical results', () => {
    for (const col of [1, 26, 27, 52, 133]) {
      expect(split.getColumnLetter(col)).toBe(orig.getColumnLetter(col));
    }
  });

  test('createMergedRow returns identical results', () => {
    const current = ['Name', 'G1', '', '', '', '', 'Y'];
    const initial = ['Name', 'G1', '', '', '', 'Y', ''];
    expect(split.createMergedRow(current, initial))
      .toEqual(orig.createMergedRow(current, initial));
  });
});
