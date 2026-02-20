/**
 * TutoringSystem.test.js — Unit tests for pure functions in TutoringSystem.gs
 *
 * Covers: isTutoringGroup(), categorizeTutoringLesson()
 */

const { loadGasModules } = require('./helpers/loadGasModules');

let ctx;

beforeAll(() => {
  ({ ctx } = loadGasModules());
});

// ─── isTutoringGroup ────────────────────────────────────────────────────

describe('isTutoringGroup', () => {
  test('returns true when "tutoring" appears in group name', () => {
    expect(ctx.isTutoringGroup('G3 Group 1 Tutoring Galdamez')).toBe(true);
  });

  test('is case-insensitive', () => {
    expect(ctx.isTutoringGroup('G3 TUTORING Group')).toBe(true);
    expect(ctx.isTutoringGroup('g3 tutoring group')).toBe(true);
  });

  test('returns false for non-tutoring group', () => {
    expect(ctx.isTutoringGroup('G3 Group 1 Galdamez')).toBe(false);
  });

  test('returns false for empty/null input', () => {
    expect(ctx.isTutoringGroup('')).toBe(false);
    expect(ctx.isTutoringGroup(null)).toBe(false);
    expect(ctx.isTutoringGroup(undefined)).toBe(false);
  });
});

// ─── categorizeTutoringLesson ───────────────────────────────────────────

describe('categorizeTutoringLesson', () => {
  test('categorizes standard UFLI lesson as "UFLI New"', () => {
    const result = ctx.categorizeTutoringLesson('UFLI L42');
    expect(result.type).toBe('UFLI New');
    expect(result.lessonNum).toBe(42);
  });

  test('categorizes reteach lesson as "UFLI Reteach"', () => {
    const result = ctx.categorizeTutoringLesson('UFLI L42 reteach');
    expect(result.type).toBe('UFLI Reteach');
    expect(result.lessonNum).toBe(42);
  });

  test('categorizes comprehension lesson', () => {
    const result = ctx.categorizeTutoringLesson('Comprehension');
    expect(result.type).toBe('Comprehension');
    expect(result.lessonNum).toBeNull();
  });

  test('categorizes unknown lesson as "Other"', () => {
    const result = ctx.categorizeTutoringLesson('Some Other Activity');
    expect(result.type).toBe('Other');
    expect(result.lessonNum).toBeNull();
  });

  test('handles null/empty input', () => {
    expect(ctx.categorizeTutoringLesson(null).type).toBe('Other');
    expect(ctx.categorizeTutoringLesson('').type).toBe('Other');
    expect(ctx.categorizeTutoringLesson(undefined).type).toBe('Other');
  });

  test('handles lesson number with suffix (e.g., L41c)', () => {
    const result = ctx.categorizeTutoringLesson('UFLI L41c');
    expect(result.type).toBe('UFLI New');
    expect(result.lessonNum).toBe(41);
  });

  test('handles lesson without UFLI prefix', () => {
    const result = ctx.categorizeTutoringLesson('L42');
    expect(result.type).toBe('UFLI New');
    expect(result.lessonNum).toBe(42);
  });
});
