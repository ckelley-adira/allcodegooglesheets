/**
 * FeatureToggles.scenario.test.js — Tier 3 Scenario Test
 *
 * Validates feature flag combinations matching real partner site configurations.
 * Tests that:
 *   - Core system works when all features are disabled
 *   - Partner site A (Mixed + Growth + Import + Unenrollment) config is valid
 *   - Partner site B (Tutoring + Grants) config is valid
 *   - Partner site C (Mixed + Coaching) config is valid
 *   - Full features config resolves correctly
 *   - PreK tri-state flag (false | "light" | "hwt") behaves correctly
 *   - Feature flags don't affect core calculation logic
 *   - Stats output is identical regardless of feature flag state
 *
 * QA Checklist references:
 *   - "Core System Testing (All Features Disabled)"
 *   - "Test Configuration 1–3: Partner Sites"
 *   - "Toggle Testing"
 *   - "PreK System Mode"
 */

const path = require('path');
const { loadGasModules, GOLD } = require('../helpers/loadGasModules');
const {
  generateMapData,
  generatePreKData,
  createMockSpreadsheet,
  buildSchoolConfig,
  PARTNER_CONFIGS,
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
// HELPER
// ═══════════════════════════════════════════════════════════════════════════

function runStatsWithFeatures(features, mapData, preKData) {
  const config = buildSchoolConfig({ features });
  const sheetData = {
    'Pre-K Data': preKData || [],
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
// CORE ONLY — ALL FEATURES DISABLED
// ═══════════════════════════════════════════════════════════════════════════

describe('Core Only — All Features Disabled', () => {
  let result;

  beforeAll(() => {
    const mapData = generateMapData('moy');
    result = runStatsWithFeatures(PARTNER_CONFIGS.coreOnly.features, mapData, []);
  });

  test('produces valid summary output', () => {
    expect(result.summaryOutput.length).toBeGreaterThan(0);
  });

  test('produces valid skills output', () => {
    expect(result.skillsOutput.length).toBeGreaterThan(0);
  });

  test('all students have valid status labels', () => {
    const validStatuses = ['On Track', 'Needs Support', 'Intervention', ''];
    for (const row of result.summaryOutput) {
      expect(validStatuses).toContain(row[7]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PARTNER SITE A — Mixed + Growth + Import + Unenrollment
// ═══════════════════════════════════════════════════════════════════════════

describe('Partner Site A — Mixed + Growth + Import + Unenrollment', () => {
  let result;

  beforeAll(() => {
    const mapData = generateMapData('moy');
    result = runStatsWithFeatures(PARTNER_CONFIGS.siteA.features, mapData, []);
  });

  test('feature flags do not affect calculation output', () => {
    // Stats output should be identical to core-only
    const coreResult = runStatsWithFeatures({}, generateMapData('moy'), []);
    expect(result.summaryOutput.length).toBe(coreResult.summaryOutput.length);
    // Each student should have the same benchmark percentages
    for (let i = 0; i < result.summaryOutput.length; i++) {
      expect(result.summaryOutput[i][4]).toBe(coreResult.summaryOutput[i][4]); // foundational
      expect(result.summaryOutput[i][5]).toBe(coreResult.summaryOutput[i][5]); // minimum
      expect(result.summaryOutput[i][6]).toBe(coreResult.summaryOutput[i][6]); // currentYear
      expect(result.summaryOutput[i][7]).toBe(coreResult.summaryOutput[i][7]); // status
    }
  });

  test('config object correctly includes feature flags', () => {
    const config = buildSchoolConfig({ features: PARTNER_CONFIGS.siteA.features });
    expect(config.features.mixedGradeSupport).toBe(true);
    expect(config.features.growthHighlighter).toBe(true);
    expect(config.features.adminImport).toBe(true);
    expect(config.features.unenrollmentAutomation).toBe(true);
    expect(config.features.syncQueueProcessing).toBe(true);
    expect(config.features.nightlySyncAutomation).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PARTNER SITE B — Tutoring + Grants
// ═══════════════════════════════════════════════════════════════════════════

describe('Partner Site B — Tutoring + Grants', () => {
  let result;

  beforeAll(() => {
    const mapData = generateMapData('eoy');
    result = runStatsWithFeatures(PARTNER_CONFIGS.siteB.features, mapData, []);
  });

  test('produces valid output with tutoring + grant features', () => {
    expect(result.summaryOutput.length).toBeGreaterThan(0);
  });

  test('config flags are correctly set', () => {
    const config = buildSchoolConfig({ features: PARTNER_CONFIGS.siteB.features });
    expect(config.features.tutoringSystem).toBe(true);
    expect(config.features.grantReporting).toBe(true);
    expect(config.features.nightlySyncAutomation).toBe(true);
    expect(config.features.coachingDashboard).toBeUndefined();
    expect(config.features.mixedGradeSupport).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PARTNER SITE C — Mixed + Coaching
// ═══════════════════════════════════════════════════════════════════════════

describe('Partner Site C — Mixed + Coaching', () => {
  test('config flags are correctly set', () => {
    const config = buildSchoolConfig({ features: PARTNER_CONFIGS.siteC.features });
    expect(config.features.mixedGradeSupport).toBe(true);
    expect(config.features.coachingDashboard).toBe(true);
    expect(config.features.syncStatusMonitoring).toBe(true);
    expect(config.features.tutoringSystem).toBeUndefined();
  });

  test('stats output is valid', () => {
    const mapData = generateMapData('moy');
    const result = runStatsWithFeatures(PARTNER_CONFIGS.siteC.features, mapData, []);
    expect(result.summaryOutput.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FULL FEATURES — ALL ENABLED
// ═══════════════════════════════════════════════════════════════════════════

describe('Full Features — All Enabled', () => {
  test('all features enabled does not break stats calculation', () => {
    const mapData = generateMapData('eoy');
    const preKData = generatePreKData('eoy');
    const result = runStatsWithFeatures(PARTNER_CONFIGS.fullFeatures.features, mapData, preKData);
    expect(result.summaryOutput.length).toBeGreaterThan(0);
  });

  test('preKSystem set to "hwt" is stored correctly', () => {
    const config = buildSchoolConfig({ features: PARTNER_CONFIGS.fullFeatures.features });
    expect(config.features.preKSystem).toBe('hwt');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREK TRI-STATE FLAG
// ═══════════════════════════════════════════════════════════════════════════

describe('PreK System Tri-State Flag', () => {
  test('preKSystem: false — no PreK features', () => {
    const config = buildSchoolConfig({ features: { preKSystem: false } });
    expect(config.features.preKSystem).toBe(false);
  });

  test('preKSystem: "light" — basic Pre-K tracking', () => {
    const config = buildSchoolConfig({ features: { preKSystem: 'light' } });
    expect(config.features.preKSystem).toBe('light');
  });

  test('preKSystem: "hwt" — full HWT system', () => {
    const config = buildSchoolConfig({ features: { preKSystem: 'hwt' } });
    expect(config.features.preKSystem).toBe('hwt');
  });

  test('PreK students processed when Pre-K Data sheet exists', () => {
    const mapData = generateMapData('moy');
    const preKData = generatePreKData('moy');
    const config = buildSchoolConfig({
      features: { preKSystem: 'hwt' },
      PREK_CONFIG: {
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
    const summary = (captured['Grade Summary'] || [])[0]?.values || [];

    // Should include PreK students
    const preKRows = summary.filter(r => r[1] === 'PreK');
    expect(preKRows.length).toBeGreaterThan(0);
  });

  test('PreK students NOT processed when Pre-K Data sheet is absent', () => {
    const mapData = generateMapData('moy');
    const config = buildSchoolConfig({ features: { preKSystem: false } });
    const sheetData = {
      // No 'Pre-K Data' sheet
      'Initial Assessment': [],
      'Skills Tracker': [],
      'Grade Summary': [],
    };
    const { ss, captured } = createMockSpreadsheet(sheetData);
    ctx.updateAllStats(ss, mapData, config);
    const summary = (captured['Grade Summary'] || [])[0]?.values || [];

    // No PreK students should appear
    const preKRows = summary.filter(r => r[1] === 'PreK');
    expect(preKRows.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TOGGLE CYCLE — Enable/Disable Without Breaking
// ═══════════════════════════════════════════════════════════════════════════

describe('Toggle Cycle — Enable/Disable', () => {
  const mapData = generateMapData('moy');

  test('start disabled → enable → disable cycle produces consistent results', () => {
    // All disabled
    const r1 = runStatsWithFeatures({}, mapData, []);
    // Enable coaching
    const r2 = runStatsWithFeatures({ coachingDashboard: true }, mapData, []);
    // Back to disabled
    const r3 = runStatsWithFeatures({}, mapData, []);

    // r1 and r3 should be identical (toggling doesn't change data)
    expect(r1.summaryOutput.length).toBe(r3.summaryOutput.length);
    for (let i = 0; i < r1.summaryOutput.length; i++) {
      expect(r1.summaryOutput[i]).toEqual(r3.summaryOutput[i]);
    }
    // r2 should also have the same core stats
    expect(r2.summaryOutput.length).toBe(r1.summaryOutput.length);
  });
});
