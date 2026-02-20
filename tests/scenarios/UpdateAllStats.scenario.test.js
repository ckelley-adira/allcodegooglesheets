/**
 * UpdateAllStats.scenario.test.js — Tier 3 Scenario Test
 *
 * End-to-end validation of the updateAllStats statistics engine.
 * Validates row-by-row correctness of Skills Tracker and Grade Summary
 * outputs against hand-computed expected values.
 *
 * Covers:
 *   - Skills Tracker: 16 skill section percentages per student
 *   - Grade Summary: Foundational%, Min%, CurrentYear%, Status
 *   - Gateway logic at scale (review lessons grant section credit)
 *   - PreK score integration (Form, Name+Sound, Full denominators)
 *   - Empty sheet handling
 *   - Single-student edge cases
 */

const path = require('path');
const { loadGasModules, GOLD } = require('../helpers/loadGasModules');
const {
  buildMapRow,
  buildPreKDataRow,
  createMockSpreadsheet,
  buildSchoolConfig,
  DEFAULT_LAYOUT,
  PREK_HEADERS,
  PREK_CONFIG,
} = require('./fixtures/schoolSimulationData');

const FILES = [
  path.join(GOLD, 'SharedConstants.gs'),
  path.join(GOLD, 'SharedEngine.gs'),
];

let ctx;

beforeAll(() => {
  ({ ctx } = loadGasModules(FILES));
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function runStats(mapData, preKData, initialData, configOverrides) {
  const config = buildSchoolConfig(configOverrides);
  const sheetData = {
    'Pre-K Data': preKData || [],
    'Initial Assessment': initialData || [],
    'Skills Tracker': [],
    'Grade Summary': [],
  };
  const { ss, captured } = createMockSpreadsheet(sheetData);
  ctx.updateAllStats(ss, mapData, config);

  return {
    skillsOutput: (captured['Skills Tracker'] || [])[0]?.values || [],
    summaryOutput: (captured['Grade Summary'] || [])[0]?.values || [],
  };
}

function buildMapDataWithHeaders(studentRows) {
  const headerRows = [];
  for (let i = 0; i < DEFAULT_LAYOUT.HEADER_ROW_COUNT; i++) {
    headerRows.push(new Array(DEFAULT_LAYOUT.LESSON_COLUMN_OFFSET + 128).fill(''));
  }
  return [...headerRows, ...studentRows];
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE STUDENT — HAND-VERIFIED CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('Single KG student — foundational only', () => {
  let result;

  beforeAll(() => {
    // KG student with lessons 1-17 passed (50% of 34 foundational)
    const lessons = {};
    for (let i = 1; i <= 17; i++) lessons[i] = 'Y';
    const student = { name: 'KG Test', grade: 'KG', teacher: 'Smith', group: 'Group 1' };
    const row = buildMapRow(student, lessons);
    const mapData = buildMapDataWithHeaders([row]);
    result = runStats(mapData, [], []);
  });

  test('summary has 1 row', () => {
    expect(result.summaryOutput).toHaveLength(1);
  });

  test('foundational % = 50 (17/34)', () => {
    // KG foundational: lessons 1-34, denominator 34
    // 17 non-review lessons passed out of 34
    expect(result.summaryOutput[0][4]).toBe(50);
  });

  test('minimum % = 50 (same as foundational for KG)', () => {
    // KG minimum uses same lessons/denominator as foundational
    expect(result.summaryOutput[0][5]).toBe(50);
  });

  test('status is Needs Support (50% = threshold)', () => {
    expect(result.summaryOutput[0][7]).toBe('Needs Support');
  });
});

describe('Single G1 student — gateway in benchmark vs skills tracker', () => {
  let result;

  beforeAll(() => {
    // G1 student: pass all foundational (1-34) + digraph reviews (49, 53)
    // Note: G1_MINIMUM_LESSONS excludes review lessons 49 & 53, so the
    // gateway does NOT fire inside calculateBenchmark for the Grade Summary.
    // However, calculateSectionPercentage (Skills Tracker) uses the full
    // section array which includes reviews, so the gateway DOES fire there.
    const lessons = {};
    for (let i = 1; i <= 34; i++) lessons[i] = 'Y';
    lessons[49] = 'Y';
    lessons[53] = 'Y';
    const student = { name: 'G1 Gateway Test', grade: 'G1', teacher: 'Jones', group: 'Group 1' };
    const row = buildMapRow(student, lessons);
    const mapData = buildMapDataWithHeaders([row]);
    result = runStats(mapData, [], []);
  });

  test('summary foundational % = 100 (all 34 passed)', () => {
    expect(result.summaryOutput[0][4]).toBe(100);
  });

  test('minimum % = 77 (34 of 44 non-review benchmark lessons passed; no gateway in benchmark)', () => {
    // G1_MINIMUM_LESSONS = [1-34, 42-48, 50-52] = 44 non-review lessons
    // Reviews 49,53 are excluded from the benchmark array, so gateway can't fire
    // Student only passed 1-34 (34 of 44) = 77%
    expect(result.summaryOutput[0][5]).toBe(77);
  });

  test('status is Needs Support (77% >= 50 but < 80)', () => {
    expect(result.summaryOutput[0][7]).toBe('Needs Support');
  });

  test('skills tracker digraph section = 100% (gateway fires on full section)', () => {
    // calculateSectionPercentage uses [42-53] including reviews 49,53
    // Both reviews Y → gateway passes → 100% section credit
    const skillSections = Object.keys(ctx.SKILL_SECTIONS);
    const digraphIdx = skillSections.indexOf('Digraphs');
    expect(result.skillsOutput[0][4 + digraphIdx]).toBe(100);
  });
});

describe('Single G1 student — gateway fails (review N)', () => {
  let result;

  beforeAll(() => {
    const lessons = {};
    for (let i = 1; i <= 34; i++) lessons[i] = 'Y';
    // Pass digraph non-reviews 42-48, but review 49 = N
    for (let i = 42; i <= 48; i++) lessons[i] = 'Y';
    lessons[49] = 'N'; // Review fails
    lessons[53] = 'Y'; // Other review passes
    const student = { name: 'G1 No Gateway', grade: 'G1', teacher: 'Jones', group: 'Group 1' };
    const row = buildMapRow(student, lessons);
    const mapData = buildMapDataWithHeaders([row]);
    result = runStats(mapData, [], []);
  });

  test('digraph section falls back to counting actual Ys', () => {
    // Gateway fails (49=N), so count actual Y's in non-reviews
    // Non-reviews in digraphs: 42,43,44,45,46,47,48,50,51,52 (10 total)
    // Passed: 42-48 = 7 of 10 = 70%
    const skillSections = Object.keys(ctx.SKILL_SECTIONS);
    const digraphIdx = skillSections.indexOf('Digraphs');
    expect(result.skillsOutput[0][4 + digraphIdx]).toBe(70);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREK INTEGRATION — SEPARATE PROCESSING PATH
// ═══════════════════════════════════════════════════════════════════════════

describe('PreK student processing', () => {
  let result;

  beforeAll(() => {
    // K-8 student + PreK via Pre-K Data sheet
    const kgLessons = {};
    for (let i = 1; i <= 10; i++) kgLessons[i] = 'Y';
    const kgRow = buildMapRow(
      { name: 'KG Kid', grade: 'KG', teacher: 'Smith', group: 'Group 1' },
      kgLessons
    );
    const mapData = buildMapDataWithHeaders([kgRow]);

    // PreK data: 1 header row + 1 student
    // Use PREK_CONFIG from buildSchoolConfig (HEADER_ROW=5, DATA_START_ROW=6)
    // But for this test, Pre-K Data has header at row 1 and data starting at row 2
    // We need to adjust the config to match our fixture
    const preKRow = buildPreKDataRow(
      { name: 'PreK Kid', grade: 'PreK', teacher: 'Rivera', group: 'PreK AM' },
      { nameY: 2, soundY: 1, formY: 3 }
    );
    const preKData = [PREK_HEADERS, preKRow];

    result = runStats(mapData, preKData, [], {
      PREK_CONFIG: {
        TOTAL_LETTERS: 26,
        HEADER_ROW: 1,
        DATA_START_ROW: 2,
        FORM_DENOMINATOR: 26,
        NAME_SOUND_DENOMINATOR: 52,
        FULL_DENOMINATOR: 78,
      },
    });
  });

  test('output includes both K-8 and PreK students', () => {
    expect(result.summaryOutput.length).toBe(2);
    const grades = result.summaryOutput.map(r => r[1]);
    expect(grades).toContain('KG');
    expect(grades).toContain('PreK');
  });

  test('PreK student has correct foundational % (Form)', () => {
    const preKRow = result.summaryOutput.find(r => r[1] === 'PreK');
    // formY=3 / 26 = 11.5% → Math.round = 12%
    expect(preKRow[4]).toBe(12);
  });

  test('PreK student has correct minGrade % (Name+Sound)', () => {
    const preKRow = result.summaryOutput.find(r => r[1] === 'PreK');
    // (nameY=2 + soundY=1) / 52 = 3/52 = 5.77% → Math.round = 6%
    expect(preKRow[5]).toBe(6);
  });

  test('PreK student has correct fullGrade % (all three)', () => {
    const preKRow = result.summaryOutput.find(r => r[1] === 'PreK');
    // (2 + 1 + 3) / 78 = 6/78 = 7.69% → Math.round = 8%
    expect(preKRow[6]).toBe(8);
  });

  test('PreK student skills tracker sections are all blank', () => {
    const preKSkills = result.skillsOutput.find(r => r[1] === 'PreK');
    expect(preKSkills).toBeDefined();
    // Columns 4-19 (16 sections) should be blank
    for (let i = 4; i < 20; i++) {
      expect(preKSkills[i]).toBe('');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY DATA HANDLING
// ═══════════════════════════════════════════════════════════════════════════

describe('Empty data handling', () => {
  test('empty UFLI MAP produces no output', () => {
    const emptyMap = buildMapDataWithHeaders([]);
    const result = runStats(emptyMap, [], []);
    expect(result.summaryOutput).toHaveLength(0);
    expect(result.skillsOutput).toHaveLength(0);
  });

  test('rows with blank names are skipped', () => {
    const blankRow = new Array(DEFAULT_LAYOUT.LESSON_COLUMN_OFFSET + 128).fill('');
    const mapData = buildMapDataWithHeaders([blankRow]);
    const result = runStats(mapData, [], []);
    expect(result.summaryOutput).toHaveLength(0);
  });

  test('student with no lessons attempted gets 0% benchmarks', () => {
    const student = { name: 'Empty Student', grade: 'G1', teacher: 'Smith', group: 'G1' };
    const row = buildMapRow(student, {});
    const mapData = buildMapDataWithHeaders([row]);
    const result = runStats(mapData, [], []);

    expect(result.summaryOutput).toHaveLength(1);
    expect(result.summaryOutput[0][4]).toBe(0); // foundational
    expect(result.summaryOutput[0][5]).toBe(0); // minimum
    expect(result.summaryOutput[0][7]).toBe('Intervention'); // 0% → Intervention
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-STUDENT — LARGE CLASS SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Large class simulation (30 students)', () => {
  let result;

  beforeAll(() => {
    const rows = [];
    for (let i = 1; i <= 30; i++) {
      const lessons = {};
      // Simulate varying performance: student i passes first i*4 lessons
      const maxLesson = Math.min(i * 4, 128);
      for (let l = 1; l <= maxLesson; l++) {
        lessons[l] = 'Y';
      }
      rows.push(buildMapRow(
        { name: `Student ${i}`, grade: 'G2', teacher: 'Garcia', group: `G2 Group ${Math.ceil(i / 10)}` },
        lessons
      ));
    }
    const mapData = buildMapDataWithHeaders(rows);
    result = runStats(mapData, [], []);
  });

  test('all 30 students appear in output', () => {
    expect(result.summaryOutput).toHaveLength(30);
    expect(result.skillsOutput).toHaveLength(30);
  });

  test('students are ordered correctly (same as input)', () => {
    expect(result.summaryOutput[0][0]).toBe('Student 1');
    expect(result.summaryOutput[29][0]).toBe('Student 30');
  });

  test('student performance increases with more lessons', () => {
    // Student 1 has 4 lessons, Student 30 has 120 lessons
    // Foundational %: Student 1 < Student 30
    expect(result.summaryOutput[0][4]).toBeLessThan(result.summaryOutput[29][4]);
  });

  test('high-performing students reach On Track status', () => {
    // Student 30: 120 lessons passed
    // G2 minimum: 56 lessons — many passed
    expect(result.summaryOutput[29][7]).toBe('On Track');
  });

  test('low-performing students are in Intervention', () => {
    // Student 1: only 4 lessons passed
    // G2 minimum: 56 lessons — 4/56 << 50%
    expect(result.summaryOutput[0][7]).toBe('Intervention');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GRADE-SPECIFIC METRIC VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Grade-specific metrics', () => {
  test('G4-G8 students use the same denominators', () => {
    const grades = ['G4', 'G5', 'G6', 'G7', 'G8'];
    const rows = grades.map(g => buildMapRow(
      { name: `${g} Student`, grade: g, teacher: 'T', group: 'Grp' },
      // All pass lessons 1-34
      Object.fromEntries(Array.from({ length: 34 }, (_, i) => [i + 1, 'Y']))
    ));
    const mapData = buildMapDataWithHeaders(rows);
    const result = runStats(mapData, [], []);

    // All should have identical foundational % (34/34 = 100%)
    for (const row of result.summaryOutput) {
      expect(row[4]).toBe(100); // foundational
    }

    // All should have the same minimum % (34 out of 103 non-review minimum lessons)
    const minPcts = result.summaryOutput.map(r => r[5]);
    expect(new Set(minPcts).size).toBe(1); // all same
  });

  test('unrecognized grade gets empty metrics', () => {
    const row = buildMapRow(
      { name: 'Unknown Grade', grade: 'G99', teacher: 'T', group: 'Grp' },
      { 1: 'Y', 2: 'Y' }
    );
    const mapData = buildMapDataWithHeaders([row]);
    const result = runStats(mapData, [], []);

    expect(result.summaryOutput).toHaveLength(1);
    // No GRADE_METRICS for G99 → empty values
    expect(result.summaryOutput[0][4]).toBe('');
    expect(result.summaryOutput[0][5]).toBe('');
    expect(result.summaryOutput[0][6]).toBe('');
    expect(result.summaryOutput[0][7]).toBe('');
  });
});
