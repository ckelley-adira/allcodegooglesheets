/**
 * PreKIntegration.scenario.test.js — Tier 3 Scenario Test
 *
 * Validates the Pre-K tracking subsystem in both standalone and mixed modes:
 *   - PreK-only school (prek_only grade model)
 *   - Mixed PreK + K-8 school (prek_8 grade model)
 *   - HWT denominator calculations (Form/26, Name+Sound/52, Full/78)
 *   - PreK students excluded from UFLI MAP processing
 *   - PreK students included via Pre-K Data sheet processing
 *   - Growth progression across BOY → MOY → EOY
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

function buildMapDataWithHeaders(studentRows) {
  const headerRows = [];
  for (let i = 0; i < DEFAULT_LAYOUT.HEADER_ROW_COUNT; i++) {
    headerRows.push(new Array(DEFAULT_LAYOUT.LESSON_COLUMN_OFFSET + 128).fill(''));
  }
  return [...headerRows, ...studentRows];
}

function runStatsWithPreK(mapRows, preKRows, configOverrides = {}) {
  const mapData = buildMapDataWithHeaders(mapRows);
  const preKData = preKRows.length > 0 ? [PREK_HEADERS, ...preKRows] : [];
  const config = buildSchoolConfig({
    ...configOverrides,
    PREK_CONFIG: configOverrides.PREK_CONFIG || {
      TOTAL_LETTERS: 26,
      HEADER_ROW: 1,
      DATA_START_ROW: 2,
      FORM_DENOMINATOR: 26,
      NAME_SOUND_DENOMINATOR: 52,
      FULL_DENOMINATOR: 78,
    },
  });

  const sheetData = {
    'Pre-K Data': preKData,
    'Initial Assessment': [],
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

// ═══════════════════════════════════════════════════════════════════════════
// PREK-ONLY SCHOOL
// ═══════════════════════════════════════════════════════════════════════════

describe('PreK-Only School Scenario', () => {
  let result;

  beforeAll(() => {
    // No K-8 students — only Pre-K students via Pre-K Data sheet
    const preKRows = [
      buildPreKDataRow({ name: 'Alice A', teacher: 'Rivera' }, { nameY: 3, soundY: 3, formY: 3 }),
      buildPreKDataRow({ name: 'Bobby B', teacher: 'Rivera' }, { nameY: 1, soundY: 1, formY: 1 }),
      buildPreKDataRow({ name: 'Carla C', teacher: 'Rivera' }, { nameY: 0, soundY: 0, formY: 0 }),
    ];

    result = runStatsWithPreK([], preKRows, {
      gradeRangeModel: 'prek_only',
      gradesServed: ['PreK'],
      features: { preKSystem: 'hwt' },
    });
  });

  test('all 3 PreK students appear in summary', () => {
    expect(result.summaryOutput).toHaveLength(3);
  });

  test('all students are labeled as PreK', () => {
    for (const row of result.summaryOutput) {
      expect(row[1]).toBe('PreK');
    }
  });

  test('top performer has correct HWT scores', () => {
    const alice = result.summaryOutput.find(r => r[0] === 'Alice A');
    // formY=3 → foundational = 3/26 = 12%
    expect(alice[4]).toBe(12);
    // nameY=3 + soundY=3 → minGrade = 6/52 = 12%
    expect(alice[5]).toBe(12);
    // 3+3+3 = 9/78 → fullGrade = 12%
    expect(alice[6]).toBe(12);
  });

  test('mid performer has proportional scores', () => {
    const bobby = result.summaryOutput.find(r => r[0] === 'Bobby B');
    // formY=1 → 1/26 = 4%
    expect(bobby[4]).toBe(4);
    // 1+1 = 2/52 = 4%
    expect(bobby[5]).toBe(4);
    // 1+1+1 = 3/78 = 4%
    expect(bobby[6]).toBe(4);
  });

  test('zero performer has 0% across all metrics', () => {
    const carla = result.summaryOutput.find(r => r[0] === 'Carla C');
    expect(carla[4]).toBe(0);
    expect(carla[5]).toBe(0);
    expect(carla[6]).toBe(0);
  });

  test('PreK skills tracker sections are all blank', () => {
    for (const row of result.skillsOutput) {
      for (let col = 4; col < 20; col++) {
        expect(row[col]).toBe('');
      }
    }
  });

  test('performance status reflects fullGrade %', () => {
    // Alice: fullGrade=12% → Intervention (< 50%)
    const alice = result.summaryOutput.find(r => r[0] === 'Alice A');
    expect(alice[7]).toBe('Intervention');
    // Carla: fullGrade=0% → Intervention
    const carla = result.summaryOutput.find(r => r[0] === 'Carla C');
    expect(carla[7]).toBe('Intervention');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MIXED PREK + K-8 SCHOOL
// ═══════════════════════════════════════════════════════════════════════════

describe('Mixed PreK + K-8 School Scenario', () => {
  let result;

  beforeAll(() => {
    // K-8 students in UFLI MAP
    const kgLessons = {};
    for (let i = 1; i <= 34; i++) kgLessons[i] = 'Y';
    const kgRow = buildMapRow(
      { name: 'KG Student', grade: 'KG', teacher: 'Smith', group: 'KG Group 1' },
      kgLessons
    );

    // PreK student on UFLI MAP — should be SKIPPED (PreK handled separately)
    const preKMapRow = buildMapRow(
      { name: 'PreK On Map', grade: 'PreK', teacher: 'Rivera', group: 'PreK AM' },
      { 1: 'Y', 2: 'Y' }
    );

    // PreK students in Pre-K Data
    const preKDataRows = [
      buildPreKDataRow({ name: 'PreK Data Student', teacher: 'Rivera' }, { nameY: 2, soundY: 2, formY: 2 }),
    ];

    result = runStatsWithPreK([kgRow, preKMapRow], preKDataRows, {
      gradeRangeModel: 'prek_8',
      gradesServed: ['PreK', 'KG'],
      features: { preKSystem: 'hwt' },
    });
  });

  test('KG student appears in output', () => {
    const kgRows = result.summaryOutput.filter(r => r[1] === 'KG');
    expect(kgRows).toHaveLength(1);
  });

  test('PreK student from UFLI MAP is SKIPPED', () => {
    // updateAllStats skips PreK-graded rows in UFLI MAP
    const preKOnMap = result.summaryOutput.find(r => r[0] === 'PreK On Map');
    expect(preKOnMap).toBeUndefined();
  });

  test('PreK student from Pre-K Data sheet appears', () => {
    const preKData = result.summaryOutput.find(r => r[0] === 'PreK Data Student');
    expect(preKData).toBeDefined();
    expect(preKData[1]).toBe('PreK');
  });

  test('PreK and K-8 students have correct benchmarks', () => {
    const kgRow = result.summaryOutput.find(r => r[1] === 'KG');
    const preKRow = result.summaryOutput.find(r => r[1] === 'PreK');

    // KG: 34/34 = 100% foundational
    expect(kgRow[4]).toBe(100);

    // PreK: formY=2 → 2/26 = 8%
    expect(preKRow[4]).toBe(8);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREK GROWTH PROGRESSION (BOY → MOY → EOY)
// ═══════════════════════════════════════════════════════════════════════════

describe('PreK Growth Progression', () => {
  function runPreKPhase(counts) {
    const preKRows = [
      buildPreKDataRow({ name: 'Progressing Kid', teacher: 'Rivera' }, counts),
    ];
    return runStatsWithPreK([], preKRows);
  }

  test('scores increase from BOY → MOY → EOY', () => {
    const boy = runPreKPhase({ nameY: 0, soundY: 0, formY: 1 });
    const moy = runPreKPhase({ nameY: 1, soundY: 1, formY: 2 });
    const eoy = runPreKPhase({ nameY: 3, soundY: 3, formY: 3 });

    const boyFull = boy.summaryOutput[0][6];
    const moyFull = moy.summaryOutput[0][6];
    const eoyFull = eoy.summaryOutput[0][6];

    expect(moyFull).toBeGreaterThan(boyFull);
    expect(eoyFull).toBeGreaterThan(moyFull);
  });

  test('maximum possible PreK score is ~12% per metric (3/26, 6/52, 9/78)', () => {
    // With our 3-column fixture, max is 3 Y's per category
    const maxResult = runPreKPhase({ nameY: 3, soundY: 3, formY: 3 });
    const row = maxResult.summaryOutput[0];
    // form: 3/26 = 12%
    expect(row[4]).toBe(12);
    // name+sound: 6/52 = 12%
    expect(row[5]).toBe(12);
    // full: 9/78 = 12%
    expect(row[6]).toBe(12);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('PreK edge cases', () => {
  test('empty Pre-K Data sheet produces no PreK output', () => {
    const result = runStatsWithPreK([], []);
    const preKRows = result.summaryOutput.filter(r => r[1] === 'PreK');
    expect(preKRows).toHaveLength(0);
  });

  test('PreK student with blank name is skipped', () => {
    const blankRow = buildPreKDataRow({ name: '', teacher: 'Rivera' }, { nameY: 1, soundY: 1, formY: 1 });
    const result = runStatsWithPreK([], [blankRow]);
    expect(result.summaryOutput).toHaveLength(0);
  });

  test('mixed school with no Pre-K Data sheet processes K-8 only', () => {
    const kgRow = buildMapRow(
      { name: 'KG Only', grade: 'KG', teacher: 'Smith', group: 'KG' },
      { 1: 'Y', 2: 'Y', 3: 'Y' }
    );
    const config = buildSchoolConfig({
      gradeRangeModel: 'prek_8',
      features: { preKSystem: 'hwt' },
    });
    const sheetData = {
      'Initial Assessment': [],
      'Skills Tracker': [],
      'Grade Summary': [],
      // No 'Pre-K Data' entry
    };
    const mapData = buildMapDataWithHeaders([kgRow]);
    const { ss, captured } = createMockSpreadsheet(sheetData);
    ctx.updateAllStats(ss, mapData, config);

    const summary = (captured['Grade Summary'] || [])[0]?.values || [];
    expect(summary).toHaveLength(1);
    expect(summary[0][1]).toBe('KG');
  });
});
