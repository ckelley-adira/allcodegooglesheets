/**
 * SchoolLifecycle.scenario.test.js — Tier 3 Scenario Test
 *
 * Simulates the full lifecycle of a K-8 school through an entire academic year:
 *   Phase 1: Beginning of Year — initial data entry, baseline stats
 *   Phase 2: Mid-Year — progress updates, gateway checks
 *   Phase 3: End of Year — final stats, growth validation
 *
 * Validates:
 *   - updateAllStats produces correct Skills Tracker output
 *   - updateAllStats produces correct Grade Summary output
 *   - Performance statuses match expected thresholds
 *   - Growth suppression works (merged rows preserve Y values)
 *   - Multi-grade school handles all grades correctly
 */

const path = require('path');
const { loadGasModules, GOLD } = require('../helpers/loadGasModules');
const {
  STUDENTS,
  PERFORMANCE_PROFILES,
  generateMapData,
  generatePreKData,
  generateInitialAssessmentData,
  createMockSpreadsheet,
  buildSchoolConfig,
} = require('./fixtures/schoolSimulationData');

// Load core + engine modules (order matters)
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

/**
 * Runs updateAllStats with mock spreadsheet and captures output.
 *
 * @param {Array} mapData - UFLI MAP data
 * @param {Array} preKData - Pre-K data (with header row)
 * @param {Array} initialData - Initial Assessment data
 * @param {Object} configOverrides - Config overrides
 * @returns {{ skillsOutput: Array, summaryOutput: Array }}
 */
function runStatsSimulation(mapData, preKData, initialData, configOverrides = {}) {
  const config = buildSchoolConfig(configOverrides);

  // Build sheet data for the mock spreadsheet
  const sheetData = {
    'Pre-K Data': preKData || [],
    'Initial Assessment': initialData || [],
    'Skills Tracker': [],
    'Grade Summary': [],
  };

  const { ss, captured } = createMockSpreadsheet(sheetData);

  // Run the stats engine
  ctx.updateAllStats(ss, mapData, config);

  // Extract captured output
  const skillsWrites = captured['Skills Tracker'] || [];
  const summaryWrites = captured['Grade Summary'] || [];

  return {
    skillsOutput: skillsWrites.length > 0 ? skillsWrites[0].values : [],
    summaryOutput: summaryWrites.length > 0 ? summaryWrites[0].values : [],
  };
}

/**
 * Finds a student's row in the output by name.
 */
function findStudentRow(output, studentName) {
  return output.find(row => row[0] === studentName);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: BEGINNING OF YEAR
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 1: Beginning of Year — Baseline Assessment', () => {
  let result;

  beforeAll(() => {
    const mapData = generateMapData('boy');
    const preKData = generatePreKData('boy');
    result = runStatsSimulation(mapData, preKData, []);
  });

  test('produces output for all K-8 students', () => {
    const k8Students = STUDENTS.filter(s => s.grade !== 'PreK');
    expect(result.summaryOutput.length).toBeGreaterThanOrEqual(k8Students.length);
  });

  test('each student row has correct metadata columns', () => {
    for (const row of result.summaryOutput) {
      expect(row[0]).toBeTruthy(); // Name
      expect(row[1]).toBeTruthy(); // Grade
    }
  });

  test('high-performing KG student has non-zero foundational %', () => {
    const row = findStudentRow(result.summaryOutput, 'KG Student A');
    expect(row).toBeDefined();
    // KG foundational = lessons 1-34, denominator 34
    // BOY high = 10 lessons passed, 10/34 = 29%
    expect(row[4]).toBeGreaterThan(0); // foundational %
  });

  test('low-performing G1 student has lower benchmarks than high-performing', () => {
    const highRow = findStudentRow(result.summaryOutput, 'G1 Student A');
    const lowRow = findStudentRow(result.summaryOutput, 'G1 Student C');
    expect(highRow).toBeDefined();
    expect(lowRow).toBeDefined();
    // High: 10 lessons, Low: 3 lessons — high should have higher foundational %
    expect(highRow[4]).toBeGreaterThan(lowRow[4]);
  });

  test('Skills Tracker has 16 section columns per student', () => {
    // Metadata (4 cols) + 16 skill sections
    if (result.skillsOutput.length > 0) {
      expect(result.skillsOutput[0].length).toBe(20);
    }
  });

  test('Grade Summary has correct column count (4 meta + 4 metrics)', () => {
    if (result.summaryOutput.length > 0) {
      // Name, Grade, Teacher, Group, Foundational%, Min%, CurrentYear%, Status
      expect(result.summaryOutput[0].length).toBe(8);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: MID-YEAR PROGRESS
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 2: Mid-Year — Progress Updates', () => {
  let result;

  beforeAll(() => {
    const mapData = generateMapData('moy');
    const preKData = generatePreKData('moy');
    const initialData = generateInitialAssessmentData();
    result = runStatsSimulation(mapData, preKData, initialData);
  });

  test('high-performing G1 student shows progression', () => {
    const row = findStudentRow(result.summaryOutput, 'G1 Student A');
    expect(row).toBeDefined();
    // MOY high G1: lessons 1-62 passed with all reviews Y
    // Foundational: 34/34 = 100%
    expect(row[4]).toBe(100); // foundational
    // Minimum: G1 min includes 1-34 + digraphs (44 non-review lessons)
    expect(row[5]).toBeGreaterThan(50);
  });

  test('mid-performing G2 student shows moderate progress', () => {
    const row = findStudentRow(result.summaryOutput, 'G2 Student A');
    expect(row).toBeDefined();
    // MOY high G2: lots of lessons passed
    expect(row[4]).toBeGreaterThan(0);
  });

  test('low-performing student has lower status than high-performing', () => {
    const highRow = findStudentRow(result.summaryOutput, 'G1 Student A');
    const lowRow = findStudentRow(result.summaryOutput, 'G1 Student C');
    expect(highRow).toBeDefined();
    expect(lowRow).toBeDefined();
    // Compare minimum grade %
    expect(highRow[5]).toBeGreaterThan(lowRow[5]);
  });

  test('performance status labels are valid', () => {
    const validStatuses = ['On Track', 'Needs Support', 'Intervention', ''];
    for (const row of result.summaryOutput) {
      expect(validStatuses).toContain(row[7]);
    }
  });

  test('gateway logic applies — high performer with all reviews Y gets section credit', () => {
    // G1 Student A (high, MOY): lessons 1-62 all Y including reviews
    const skillsRow = findStudentRow(result.skillsOutput, 'G1 Student A');
    expect(skillsRow).toBeDefined();
    // First section (Single Consonants & Vowels) should be 100% (all non-reviews passed)
    expect(skillsRow[4]).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: END OF YEAR
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 3: End of Year — Final Assessment', () => {
  let result;

  beforeAll(() => {
    const mapData = generateMapData('eoy');
    const preKData = generatePreKData('eoy');
    const initialData = generateInitialAssessmentData();
    result = runStatsSimulation(mapData, preKData, initialData);
  });

  test('high-performing students reach On Track status', () => {
    const row = findStudentRow(result.summaryOutput, 'G4 Student A');
    expect(row).toBeDefined();
    // EOY high G4: lessons 1-128 all Y — should be 100% foundational
    expect(row[4]).toBe(100);
    // Status should be On Track (min % >= 80)
    expect(row[7]).toBe('On Track');
  });

  test('low-performing G8 student may be in Intervention', () => {
    const row = findStudentRow(result.summaryOutput, 'G8 Student A');
    expect(row).toBeDefined();
    // EOY low G8: limited lessons, many N's
    // G8 minimum includes 1-34 + 42-110 = 103 lessons
    // Low performer only reaches L62 with some N's
    expect(['Needs Support', 'Intervention']).toContain(row[7]);
  });

  test('all students have valid benchmark percentages (0-100)', () => {
    for (const row of result.summaryOutput) {
      const foundational = row[4];
      const minimum = row[5];
      const currentYear = row[6];
      if (typeof foundational === 'number') {
        expect(foundational).toBeGreaterThanOrEqual(0);
        expect(foundational).toBeLessThanOrEqual(100);
      }
      if (typeof minimum === 'number') {
        expect(minimum).toBeGreaterThanOrEqual(0);
        expect(minimum).toBeLessThanOrEqual(100);
      }
      if (typeof currentYear === 'number') {
        expect(currentYear).toBeGreaterThanOrEqual(0);
        expect(currentYear).toBeLessThanOrEqual(100);
      }
    }
  });

  test('EOY outputs include all K-8 students (may include PreK if sheet exists)', () => {
    // K-8 students are always present; PreK students are added only if
    // a Pre-K Data sheet exists in the mock spreadsheet
    const k8Count = STUDENTS.filter(s => s.grade !== 'PreK').length;
    expect(result.summaryOutput.length).toBeGreaterThanOrEqual(k8Count);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROWTH SUPPRESSION (MERGED ROW LOGIC)
// ═══════════════════════════════════════════════════════════════════════════

describe('Growth Suppression — Initial Assessment Merge', () => {
  test('skills never decrease when initial assessment data is provided', () => {
    // BOY: student has lesson 1-10 passed
    // MOY: same student but lesson 5 is now N (regression)
    // With growth suppression, merged row preserves lesson 5 as Y
    const boyData = generateMapData('boy');
    const moyData = generateMapData('moy');

    const boyResult = runStatsSimulation(boyData, [], []);
    const moyResult = runStatsSimulation(moyData, [], boyData);

    const boyRow = findStudentRow(boyResult.summaryOutput, 'KG Student A');
    const moyRow = findStudentRow(moyResult.summaryOutput, 'KG Student A');

    expect(boyRow).toBeDefined();
    expect(moyRow).toBeDefined();

    // MOY should be >= BOY for foundational % (growth suppression)
    expect(moyRow[4]).toBeGreaterThanOrEqual(boyRow[4]);
  });

  test('updateAllStats without initial data still works', () => {
    const mapData = generateMapData('moy');
    const result = runStatsSimulation(mapData, [], []);

    expect(result.summaryOutput.length).toBeGreaterThan(0);
    // All students should still have valid data
    for (const row of result.summaryOutput) {
      expect(row[0]).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-GRADE COVERAGE
// ═══════════════════════════════════════════════════════════════════════════

describe('Multi-Grade Coverage — All Grades Present', () => {
  let result;

  beforeAll(() => {
    const mapData = generateMapData('eoy');
    result = runStatsSimulation(mapData, [], []);
  });

  test('students from KG through G8 appear in output', () => {
    const gradesInOutput = new Set(result.summaryOutput.map(r => r[1]));
    expect(gradesInOutput.has('KG')).toBe(true);
    expect(gradesInOutput.has('G1')).toBe(true);
    expect(gradesInOutput.has('G2')).toBe(true);
    expect(gradesInOutput.has('G3')).toBe(true);
    expect(gradesInOutput.has('G4')).toBe(true);
    expect(gradesInOutput.has('G5')).toBe(true);
    expect(gradesInOutput.has('G6')).toBe(true);
    expect(gradesInOutput.has('G7')).toBe(true);
    expect(gradesInOutput.has('G8')).toBe(true);
  });

  test('G4-G8 use same metric denominators', () => {
    // G4-G8 share the same SHARED_GRADE_METRICS config
    const g4Row = findStudentRow(result.summaryOutput, 'G4 Student A');
    const g6Row = findStudentRow(result.summaryOutput, 'G6 Student A');
    expect(g4Row).toBeDefined();
    expect(g6Row).toBeDefined();
    // Both high performers, same denominators → should have equal foundational %
    expect(g4Row[4]).toBe(g6Row[4]);
  });

  test('each grade has the correct number of students', () => {
    const gradeCount = {};
    for (const row of result.summaryOutput) {
      gradeCount[row[1]] = (gradeCount[row[1]] || 0) + 1;
    }
    expect(gradeCount['KG']).toBe(2);
    expect(gradeCount['G1']).toBe(3);
    expect(gradeCount['G2']).toBe(2);
    expect(gradeCount['G3']).toBe(2);
    expect(gradeCount['G4']).toBe(1);
    expect(gradeCount['G5']).toBe(1);
    expect(gradeCount['G6']).toBe(1);
    expect(gradeCount['G7']).toBe(1);
    expect(gradeCount['G8']).toBe(1);
  });
});
