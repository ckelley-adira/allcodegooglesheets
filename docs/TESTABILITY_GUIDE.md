# Testability Guide: Writing Testable Code in Google Apps Script

> **Version:** 1.0 (Modularity Refactor)  
> **Last Updated:** February 2026  
> **Purpose:** Patterns and practices for writing GAS code that can be unit-tested in Node.js.  
> **Audience:** Developers contributing to the UFLI Master System.

---

## Table of Contents

1. [The Challenge](#the-challenge)
2. [Dependency Injection Pattern](#dependency-injection-pattern)
3. [Pure Function Extraction](#pure-function-extraction)
4. [The Three-Layer Pattern](#the-three-layer-pattern)
5. [Test Infrastructure](#test-infrastructure)
6. [Writing New Tests](#writing-new-tests)
7. [Common Pitfalls](#common-pitfalls)
8. [Refactoring Checklist](#refactoring-checklist)

---

## The Challenge

Google Apps Script has no built-in test framework and runs in a server-side environment with proprietary APIs (`SpreadsheetApp`, `Logger`, `HtmlService`). Code that directly calls these APIs cannot be tested in Node.js.

**Solution:** Separate pure business logic from GAS I/O, test the logic layer in Node.js with Jest.

```
┌─────────────────────────┐
│  GAS Environment Only    │  ← Can't test in Node.js
│  SpreadsheetApp.get...   │
│  Logger.log(...)         │
│  HtmlService.create...   │
└────────┬────────────────┘
         │ calls
┌────────▼────────────────┐
│  Pure Business Logic     │  ← CAN test in Node.js
│  calculateBenchmark()    │
│  computeStudentStats()   │
│  partitionLessonsByReview│
└─────────────────────────┘
```

---

## Dependency Injection Pattern

**Rule:** Functions that need configuration should accept it as a parameter, not read globals.

### ❌ Bad: Reading globals
```javascript
// Reads LAYOUT from GAS flat namespace — not testable
function getLessonStatus(row, lessonNum) {
  const idx = LAYOUT.LESSON_COLUMN_OFFSET + lessonNum - 1;
  return row[idx] ? row[idx].toString().toUpperCase().trim() : "";
}
```

### ✅ Good: Accepting config as parameter
```javascript
// Accepts LAYOUT as parameter — fully testable
function getLessonStatus(row, lessonNum, LAYOUT) {
  const idx = LAYOUT.LESSON_COLUMN_OFFSET + lessonNum - 1;
  if (idx < row.length) {
    const val = row[idx];
    return val ? val.toString().toUpperCase().trim() : "";
  }
  return "";
}
```

### ✅ Good: Full config object for complex functions
```javascript
// computeStudentStats accepts ALL data as params — zero global reads
function computeStudentStats({ mapData, preKData, preKHeaders, initialData, config }) {
  const LAYOUT = config.LAYOUT;
  const PREK_CONFIG = config.PREK_CONFIG;
  const GRADE_METRICS = config.GRADE_METRICS || SHARED_GRADE_METRICS;
  // ... pure computation, returns { skillsOutput, summaryOutput }
}
```

---

## Pure Function Extraction

When you have a function that mixes I/O and computation, extract the computation:

### Before: Mixed function
```javascript
function updateSchoolSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();        // IO
  const data = ss.getSheetByName("Grade Summary")          // IO
    .getDataRange().getValues();
  
  // Business logic mixed with IO
  const totals = {};
  for (const row of data) {
    const grade = row[1];
    if (!totals[grade]) totals[grade] = { count: 0, sum: 0 };
    totals[grade].count++;
    totals[grade].sum += row[5];                            // Logic
  }
  
  const sheet = getOrCreateSheet(ss, "School Summary");     // IO
  // ... write to sheet                                     // IO
}
```

### After: Separated into Logic + IO
```javascript
// LOGIC (testable) — in SharedEngine_Core.gs or module's logic section
function aggregateGradeMetrics(data, dataStartRow) {
  const totals = {};
  for (let i = dataStartRow - 1; i < data.length; i++) {
    const row = data[i];
    const grade = row[1];
    if (!totals[grade]) totals[grade] = { count: 0, sum: 0 };
    totals[grade].count++;
    totals[grade].sum += row[5];
  }
  return totals;
}

// IO (orchestrator) — in SharedEngine_IO.gs or module's IO section
function updateSchoolSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = ss.getSheetByName("Grade Summary").getDataRange().getValues();
  
  const totals = aggregateGradeMetrics(data, LAYOUT.DATA_START_ROW);  // Pure call
  
  const sheet = getOrCreateSheet(ss, "School Summary");
  // ... write totals to sheet
}
```

---

## The Three-Layer Pattern

Every module should follow this structure:

### Layer 1: API (Entry Points)
```javascript
// Called from GAS menus — thin wrappers
function openWeeklyDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  refreshWeeklyDashboard();
  const sheet = ss.getSheetByName(WEEKLY_DASHBOARD_SHEET);
  if (sheet) ss.setActiveSheet(sheet);
}
```

### Layer 2: Logic (Pure Functions)
```javascript
// Testable in Node.js — no GAS APIs
function bucketByWeek_(data) {
  const buckets = {};
  for (const row of data) {
    const weekKey = getISOWeekKey_(row[0]);
    if (!buckets[weekKey]) buckets[weekKey] = [];
    buckets[weekKey].push(row);
  }
  return buckets;
}
```

### Layer 3: IO (Sheet Operations)
```javascript
// Reads/writes sheets — NOT testable in Node.js
function writeWeeklySheet_(sheet, rows, weekKeys) {
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  // ... formatting ...
}
```

---

## Test Infrastructure

### VM-Based GAS Loader

The test system uses a Node.js VM context that replicates GAS's flat global scope:

```
tests/helpers/loadGasModules.js
├── Evaluates .gs files in a shared VM context
├── Stubs GAS APIs (SpreadsheetApp, Logger, etc.)
├── Exports const values via bridge script
└── Returns ctx object with all globals
```

**Usage:**
```javascript
const { loadGasModules, GAS_FILES_SPLIT } = require('./helpers/loadGasModules');
let ctx;
beforeAll(() => {
  ({ ctx } = loadGasModules(GAS_FILES_SPLIT));
});

test('calculates benchmark', () => {
  expect(ctx.calculateBenchmark(row, lessons, 34, layout)).toBe(50);
});
```

### File Load Order
```
GAS_FILES:       SharedConstants.gs → SharedEngine.gs → TutoringSystem.gs
GAS_FILES_SPLIT: SharedConstants.gs → SharedEngine_Core.gs → SharedEngine_IO.gs → TutoringSystem.gs
```

### Exposing Constants

GAS `const` declarations are lexically scoped in VM contexts. The loader uses an export bridge to expose them:

```javascript
// In loadGasModules.js
const CONST_NAMES = ['LESSON_LABELS', 'SKILL_SECTIONS', 'REVIEW_LESSONS', ...];
const EXPORT_BRIDGE = CONST_NAMES
  .map(n => `if (typeof ${n} !== 'undefined') this.${n} = ${n};`)
  .join('\n');
```

**If you add a new `const` to a .gs file and need test access:** Add its name to `CONST_NAMES` in `loadGasModules.js`.

### Test Fixtures

Fixtures are in `tests/fixtures/testData.js`:

```javascript
const { DEFAULT_LAYOUT, buildStudentRow, buildPreKRow, PREK_HEADERS, PREK_CONFIG,
        COMPUTE_STATS_CONFIG, buildMapDataWithHeaders } = require('./fixtures/testData');
```

- `DEFAULT_LAYOUT` — Standard 5-header-row, offset-5 layout
- `buildStudentRow({ name, grade, teacher, group, lessons })` — Creates a row array
- `COMPUTE_STATS_CONFIG` — Full config object for computeStudentStats
- `buildMapDataWithHeaders(studentRows)` — Wraps student rows with 5 empty header rows

---

## Writing New Tests

### Step 1: Identify the pure function
Find or extract the logic function you want to test.

### Step 2: Create test file
```javascript
// tests/MyModule.test.js
const { loadGasModules } = require('./helpers/loadGasModules');
const { DEFAULT_LAYOUT, buildStudentRow } = require('./fixtures/testData');

let ctx;
beforeAll(() => {
  // Load your module in the GAS context
  const path = require('path');
  const GOLD = path.resolve(__dirname, '..', 'gold-standard-template');
  ({ ctx } = loadGasModules([
    path.join(GOLD, 'SharedConstants.gs'),
    path.join(GOLD, 'SharedEngine_Core.gs'),
    path.join(GOLD, 'modules', 'YourModule.gs'),
  ]));
});

describe('yourPureFunction', () => {
  test('handles normal input', () => {
    expect(ctx.yourPureFunction(input)).toBe(expected);
  });
  
  test('handles edge case', () => {
    expect(ctx.yourPureFunction(null)).toBe(defaultValue);
  });
});
```

### Step 3: Run tests
```bash
# Run specific test file
npx jest tests/MyModule.test.js --verbose

# Run all tests
npm test
```

---

## Common Pitfalls

### 1. GAS APIs in Logic Functions
```javascript
// ❌ SpreadsheetApp reference makes this untestable
function getStudentCount() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName("Roster").getLastRow() - 5;
}

// ✅ Accept data as parameter
function getStudentCount(rosterData, dataStartRow) {
  return rosterData.filter((row, i) => i >= dataStartRow - 1 && row[0]).length;
}
```

### 2. Forgetting to Add Constants to Export Bridge
```javascript
// In your .gs file:
const MY_NEW_CONSTANT = { ... };

// In loadGasModules.js — ADD to CONST_NAMES:
const CONST_NAMES = [
  ...,
  'MY_NEW_CONSTANT',  // ← Add this
];
```

### 3. Using `var` Instead of `const`/`let` for Functions
```javascript
// ❌ `var` functions ARE sandbox properties but can be overwritten
var myFunc = function() { ... };

// ✅ `function` declarations are automatically available in VM context
function myFunc() { ... }
```

### 4. Relying on GAS Global State
```javascript
// ❌ Reads from GAS global — untestable
function getGrade() {
  return SITE_CONFIG.gradesServed[0];
}

// ✅ Accepts config parameter
function getGrade(config) {
  return config.gradesServed[0];
}
```

---

## Refactoring Checklist

When refactoring existing code for testability:

- [ ] **Identify pure logic** in the function (calculations, transformations, validation)
- [ ] **Extract to a new function** that accepts all data as parameters
- [ ] **Return results** instead of writing to sheets directly
- [ ] **Keep the original function** as a thin IO wrapper that calls the new pure function
- [ ] **Add the pure function to tests** in the appropriate test file
- [ ] **Add new constants to CONST_NAMES** in `loadGasModules.js` if needed
- [ ] **Run `npx jest --verbose`** to verify all tests pass
- [ ] **Run `node gold-standard-template/validate_shared_constants.js`** to verify integration

---

## Quick Reference: Test Commands

```bash
# Run all tests (unit + scenario)
npm test

# Run with verbose output
npx jest --verbose

# Run a single test file
npx jest tests/SharedEngine.test.js

# Run scenario tests only
npx jest tests/scenarios/

# Run with coverage
npx jest --coverage

# Validate shared constants integration
node gold-standard-template/validate_shared_constants.js
```

---

*This guide is maintained as part of the modularity refactor. Update when test infrastructure changes.*
