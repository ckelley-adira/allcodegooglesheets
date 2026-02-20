/**
 * SharedConstants.test.js — Unit tests for SharedConstants.gs
 *
 * Covers: LESSON_LABELS, SKILL_SECTIONS, REVIEW_LESSONS, REVIEW_LESSONS_SET,
 *         PERFORMANCE_THRESHOLDS, STATUS_LABELS, getPerformanceStatus()
 */

const path = require('path');
const { loadGasModules, GOLD } = require('./helpers/loadGasModules');

// Load only SharedConstants for isolated testing
const FILES = [path.join(GOLD, 'SharedConstants.gs')];
let ctx;

beforeAll(() => {
  ({ ctx } = loadGasModules(FILES));
});

// ─── LESSON_LABELS ──────────────────────────────────────────────────────

describe('LESSON_LABELS', () => {
  test('contains exactly 128 lessons', () => {
    expect(Object.keys(ctx.LESSON_LABELS)).toHaveLength(128);
  });

  test('first lesson is L1', () => {
    expect(ctx.LESSON_LABELS[1]).toMatch(/^UFLI L1 /);
  });

  test('last lesson is L128', () => {
    expect(ctx.LESSON_LABELS[128]).toMatch(/L128/);
  });

  test('every label starts with "UFLI L"', () => {
    for (let i = 1; i <= 128; i++) {
      expect(ctx.LESSON_LABELS[i]).toMatch(/^UFLI L\d+/);
    }
  });
});

// ─── SKILL_SECTIONS ─────────────────────────────────────────────────────

describe('SKILL_SECTIONS', () => {
  test('contains exactly 16 sections', () => {
    expect(Object.keys(ctx.SKILL_SECTIONS)).toHaveLength(16);
  });

  test('all lesson numbers are between 1 and 128', () => {
    for (const [section, lessons] of Object.entries(ctx.SKILL_SECTIONS)) {
      for (const num of lessons) {
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(128);
      }
    }
  });

  test('every lesson 1–128 appears in exactly one section', () => {
    const seen = new Set();
    for (const lessons of Object.values(ctx.SKILL_SECTIONS)) {
      for (const num of lessons) {
        expect(seen.has(num)).toBe(false);
        seen.add(num);
      }
    }
    // All 128 lessons covered
    expect(seen.size).toBe(128);
  });
});

// ─── REVIEW_LESSONS ─────────────────────────────────────────────────────

describe('REVIEW_LESSONS', () => {
  test('contains 23 review lessons', () => {
    expect(ctx.REVIEW_LESSONS).toHaveLength(23);
  });

  test('all review lesson numbers are within 1–128', () => {
    for (const num of ctx.REVIEW_LESSONS) {
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(128);
    }
  });

  test('REVIEW_LESSONS_SET matches the array', () => {
    expect(ctx.REVIEW_LESSONS_SET.size).toBe(ctx.REVIEW_LESSONS.length);
    for (const num of ctx.REVIEW_LESSONS) {
      expect(ctx.REVIEW_LESSONS_SET.has(num)).toBe(true);
    }
  });
});

// ─── PERFORMANCE_THRESHOLDS & STATUS_LABELS ─────────────────────────────

describe('PERFORMANCE_THRESHOLDS', () => {
  test('ON_TRACK is 80', () => {
    expect(ctx.PERFORMANCE_THRESHOLDS.ON_TRACK).toBe(80);
  });

  test('NEEDS_SUPPORT is 50', () => {
    expect(ctx.PERFORMANCE_THRESHOLDS.NEEDS_SUPPORT).toBe(50);
  });
});

describe('STATUS_LABELS', () => {
  test('has the expected three labels', () => {
    expect(ctx.STATUS_LABELS.ON_TRACK).toBe('On Track');
    expect(ctx.STATUS_LABELS.NEEDS_SUPPORT).toBe('Needs Support');
    expect(ctx.STATUS_LABELS.INTERVENTION).toBe('Intervention');
  });
});

// ─── getPerformanceStatus() ─────────────────────────────────────────────

describe('getPerformanceStatus', () => {
  test('returns "On Track" for >= 80', () => {
    expect(ctx.getPerformanceStatus(80)).toBe('On Track');
    expect(ctx.getPerformanceStatus(100)).toBe('On Track');
    expect(ctx.getPerformanceStatus(95)).toBe('On Track');
  });

  test('returns "Needs Support" for 50–79', () => {
    expect(ctx.getPerformanceStatus(50)).toBe('Needs Support');
    expect(ctx.getPerformanceStatus(79)).toBe('Needs Support');
    expect(ctx.getPerformanceStatus(65)).toBe('Needs Support');
  });

  test('returns "Intervention" for < 50', () => {
    expect(ctx.getPerformanceStatus(49)).toBe('Intervention');
    expect(ctx.getPerformanceStatus(0)).toBe('Intervention');
    expect(ctx.getPerformanceStatus(25)).toBe('Intervention');
  });
});
