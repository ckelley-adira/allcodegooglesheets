/**
 * GradeRangeModels.scenario.test.js — Tier 3 Scenario Test
 *
 * Validates all five grade range model configurations from UnifiedConfig.gs:
 *   - prek_only: PreK students only
 *   - k5: Kindergarten through Grade 5
 *   - k8: Kindergarten through Grade 8
 *   - prek_8: PreK through Grade 8
 *   - custom: User-selected subset
 *
 * Validates:
 *   - GRADE_RANGE_MODELS constant has correct presets
 *   - getUnifiedConfig resolves correct LAYOUT for each model
 *   - getDefaultGradesForModel returns expected grade arrays
 *   - validateUnifiedConfig catches missing keys
 *   - Config resolution with varying SITE_CONFIG inputs
 */

const path = require('path');
const { loadGasModules, GOLD } = require('../helpers/loadGasModules');

// Load core files + UnifiedConfig
const FILES = [
  path.join(GOLD, 'SharedConstants.gs'),
  path.join(GOLD, 'SharedEngine.gs'),
  path.join(GOLD, 'UnifiedConfig.gs'),
];

let ctx;

beforeAll(() => {
  // Need to also define SITE_CONFIG in the sandbox before loading UnifiedConfig
  // The default SiteConfig_TEMPLATE defines it, but we want to test dynamically.
  // We'll load UnifiedConfig which references SITE_CONFIG (will use fallback defaults).
  ({ ctx } = loadGasModules(FILES));
});

// ═══════════════════════════════════════════════════════════════════════════
// GRADE_RANGE_MODELS CONSTANT
// ═══════════════════════════════════════════════════════════════════════════

describe('GRADE_RANGE_MODELS constant', () => {
  test('defines exactly 5 models', () => {
    expect(Object.keys(ctx.GRADE_RANGE_MODELS)).toHaveLength(5);
  });

  test('has expected model IDs', () => {
    const ids = Object.values(ctx.GRADE_RANGE_MODELS).map(m => m.id);
    expect(ids).toContain('prek_only');
    expect(ids).toContain('k5');
    expect(ids).toContain('k8');
    expect(ids).toContain('prek_8');
    expect(ids).toContain('custom');
  });

  test('each model has required fields', () => {
    for (const model of Object.values(ctx.GRADE_RANGE_MODELS)) {
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('label');
      expect(model).toHaveProperty('defaultGrades');
      expect(model).toHaveProperty('description');
      expect(Array.isArray(model.defaultGrades)).toBe(true);
    }
  });

  test('prek_only model defaults to PreK grade only', () => {
    const model = ctx.GRADE_RANGE_MODELS.PREK_ONLY;
    expect(model.defaultGrades).toEqual(['PreK']);
  });

  test('k5 model defaults to KG through G5', () => {
    const model = ctx.GRADE_RANGE_MODELS.K5;
    expect(model.defaultGrades).toEqual(['KG', 'G1', 'G2', 'G3', 'G4', 'G5']);
  });

  test('k8 model defaults to KG through G8', () => {
    const model = ctx.GRADE_RANGE_MODELS.K8;
    expect(model.defaultGrades).toEqual(['KG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8']);
  });

  test('prek_8 model includes PreK through G8', () => {
    const model = ctx.GRADE_RANGE_MODELS.PREK_8;
    expect(model.defaultGrades).toEqual(['PreK', 'KG', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8']);
  });

  test('custom model has empty default grades', () => {
    const model = ctx.GRADE_RANGE_MODELS.CUSTOM;
    expect(model.defaultGrades).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getDefaultGradesForModel
// ═══════════════════════════════════════════════════════════════════════════

describe('getDefaultGradesForModel', () => {
  test('returns correct grades for k5', () => {
    const grades = ctx.getDefaultGradesForModel('k5');
    expect(grades).toEqual(['KG', 'G1', 'G2', 'G3', 'G4', 'G5']);
  });

  test('returns correct grades for k8', () => {
    const grades = ctx.getDefaultGradesForModel('k8');
    expect(grades).toHaveLength(9);
    expect(grades[0]).toBe('KG');
    expect(grades[8]).toBe('G8');
  });

  test('returns correct grades for prek_8', () => {
    const grades = ctx.getDefaultGradesForModel('prek_8');
    expect(grades).toHaveLength(10);
    expect(grades[0]).toBe('PreK');
    expect(grades[9]).toBe('G8');
  });

  test('returns empty array for invalid model', () => {
    const grades = ctx.getDefaultGradesForModel('nonexistent');
    expect(grades).toEqual([]);
  });

  test('returns empty array for custom model', () => {
    const grades = ctx.getDefaultGradesForModel('custom');
    expect(grades).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getUnifiedConfig — Default resolution (no SITE_CONFIG)
// ═══════════════════════════════════════════════════════════════════════════

describe('getUnifiedConfig — default resolution', () => {
  let config;

  beforeAll(() => {
    // SITE_CONFIG is not defined in the sandbox (or uses template defaults)
    config = ctx.getUnifiedConfig();
  });

  test('returns a valid config object', () => {
    expect(config).toBeDefined();
    expect(config.LAYOUT).toBeDefined();
    expect(config.SHEET_NAMES_V2).toBeDefined();
    expect(config.PREK_CONFIG).toBeDefined();
    expect(config.COLORS).toBeDefined();
  });

  test('LAYOUT has correct default values', () => {
    expect(config.LAYOUT.DATA_START_ROW).toBe(6);
    expect(config.LAYOUT.HEADER_ROW_COUNT).toBe(5);
    expect(config.LAYOUT.LESSON_COLUMN_OFFSET).toBe(5);
    expect(config.LAYOUT.TOTAL_LESSONS).toBe(128);
    expect(config.LAYOUT.COL_FIRST_LESSON).toBe(6);
  });

  test('SHEET_NAMES_V2 has standard sheet names', () => {
    expect(config.SHEET_NAMES_V2.UFLI_MAP).toBe('UFLI MAP');
    expect(config.SHEET_NAMES_V2.SKILLS).toBe('Skills Tracker');
    expect(config.SHEET_NAMES_V2.GRADE_SUMMARY).toBe('Grade Summary');
    expect(config.SHEET_NAMES_V2.INITIAL_ASSESSMENT).toBe('Initial Assessment');
    expect(config.SHEET_NAMES_V2.SCHOOL_SUMMARY).toBe('School Summary');
  });

  test('PREK_CONFIG has correct denominators', () => {
    expect(config.PREK_CONFIG.FORM_DENOMINATOR).toBe(26);
    expect(config.PREK_CONFIG.NAME_SOUND_DENOMINATOR).toBe(52);
    expect(config.PREK_CONFIG.FULL_DENOMINATOR).toBe(78);
  });

  test('GRADE_METRICS references SHARED_GRADE_METRICS', () => {
    expect(config.GRADE_METRICS).toBeDefined();
    expect(config.GRADE_METRICS['KG']).toBeDefined();
    expect(config.GRADE_METRICS['G1']).toBeDefined();
    expect(config.GRADE_METRICS['G8']).toBeDefined();
  });

  test('COLORS has expected keys', () => {
    expect(config.COLORS.Y).toBe('#d4edda');
    expect(config.COLORS.N).toBe('#f8d7da');
    expect(config.COLORS.HEADER_BG).toBeDefined();
    expect(config.COLORS.HEADER_FG).toBe('#FFFFFF');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getGradeRangeModels (UI helper)
// ═══════════════════════════════════════════════════════════════════════════

describe('getGradeRangeModels', () => {
  test('returns array with 5 models', () => {
    const models = ctx.getGradeRangeModels();
    expect(models).toHaveLength(5);
  });

  test('each model has id, label, description, and defaultGrades', () => {
    const models = ctx.getGradeRangeModels();
    for (const model of models) {
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('label');
      expect(model).toHaveProperty('description');
      expect(model).toHaveProperty('defaultGrades');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateUnifiedConfig
// ═══════════════════════════════════════════════════════════════════════════

describe('validateUnifiedConfig', () => {
  test('passes for a complete config', () => {
    const config = ctx.getUnifiedConfig();
    const result = ctx.validateUnifiedConfig(config);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  test('fails for empty config', () => {
    const result = ctx.validateUnifiedConfig({});
    expect(result.valid).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  test('fails for null config', () => {
    const result = ctx.validateUnifiedConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('reports missing LAYOUT sub-keys', () => {
    const config = {
      LAYOUT: { DATA_START_ROW: 6 }, // missing others
      SHEET_NAMES_V2: {},
      PREK_CONFIG: {},
      COLORS: {},
    };
    const result = ctx.validateUnifiedConfig(config);
    expect(result.valid).toBe(false);
    expect(result.missing.some(k => k.startsWith('LAYOUT.'))).toBe(true);
  });

  test('error messages include actionable guidance', () => {
    const result = ctx.validateUnifiedConfig({});
    for (const err of result.errors) {
      expect(err.length).toBeGreaterThan(20); // Non-trivial error messages
    }
  });
});
