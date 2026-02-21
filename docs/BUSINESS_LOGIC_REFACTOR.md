# Business Logic Refactor: SharedEngine Split Record

> **Version:** 1.0  
> **Date:** February 2026  
> **Issue:** Modularity Improvements: Business Logic Refactor and Testability  
> **PR Branch:** `copilot/refactor-business-logic-modularity`

---

## Summary

This document records the refactoring of `SharedEngine.gs` into two files:
- **SharedEngine_Core.gs** — Pure business logic (testable in Node.js)
- **SharedEngine_IO.gs** — Google Apps Script I/O (sheet access, logging)

The original `SharedEngine.gs` is retained for backward compatibility.

---

## Motivation

Before this refactor, `SharedEngine.gs` contained both pure calculations and GAS-dependent I/O in a single 664-line file. This made it impossible to:

1. Test the statistics pipeline (`updateAllStats`) without mocking SpreadsheetApp
2. Identify which functions are safe to call from tests vs. which need GAS
3. Add new calculation logic without risking I/O side effects

---

## What Changed

### New File: SharedEngine_Core.gs

Contains ALL pure business logic extracted from SharedEngine.gs, plus a new function `computeStudentStats()`.

#### Functions Moved to Core (unchanged logic)

| Function | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `getLessonColumnIndex` | `(lessonNum, LAYOUT)` | `number` | Column index for a lesson |
| `getLessonStatus` | `(row, lessonNum, LAYOUT)` | `string` | Y/N/blank from a row |
| `isReviewLesson` | `(lessonNum)` | `boolean` | Check if lesson is a review |
| `partitionLessonsByReview` | `(lessons)` | `{reviews, nonReviews}` | Split by review status |
| `checkGateway` | `(row, reviewLessons, LAYOUT)` | `{assigned, allPassed, gatewayPassed}` | Gateway test evaluation |
| `calculateBenchmark` | `(mapRow, lessonIndices, denominator, LAYOUT)` | `number` | Benchmark % with gateway |
| `calculateSectionPercentage` | `(mapRow, sectionLessons, isInitialAssessment, LAYOUT)` | `number\|string` | Section % with gateway |
| `calculatePreKScores` | `(row, headers, PREK_CONFIG)` | `{foundational, minGrade, fullGrade}` | HWT Pre-K scores |
| `countYsInColumns` | `(row, headers, pattern)` | `number` | Count Y matches |
| `getColumnLetter` | `(columnNumber)` | `string` | Column number to letter |
| `extractLessonNumber` | `(lessonText)` | `number\|null` | Parse lesson number |
| `normalizeStudent` | `(student)` | `object` | Trim whitespace |
| `getLastLessonColumn` | `(LAYOUT)` | `string` | Last lesson column letter |
| `createMergedRow` | `(currentRow, initialRow)` | `array` | Preserve Y values from either source |

#### Constants Moved to Core (unchanged values)

| Constant | Type | Description |
|----------|------|-------------|
| `FOUNDATIONAL_LESSONS` | `Array<number>` | Lessons 1-34 |
| `G1_MINIMUM_LESSONS` | `Array<number>` | 44 lessons (1-34 + digraphs) |
| `G1_CURRENT_YEAR_LESSONS` | `Array<number>` | Lessons 35-62 minus reviews |
| `G2_MINIMUM_LESSONS` | `Array<number>` | 56 lessons |
| `G2_CURRENT_YEAR_LESSONS` | `Array<number>` | Lesson 38 + 63-83 minus reviews |
| `G4_MINIMUM_LESSONS` | `Array<number>` | 103 lessons |
| `ALL_NON_REVIEW_LESSONS` | `Array<number>` | 105 lessons (128 - 23 reviews) |
| `SHARED_GRADE_METRICS` | `Object` | PreK through G8 metrics |

#### New Function: `computeStudentStats(params)`

This is the pure-logic core extracted from `updateAllStats()`. It receives all data as parameters and returns computed arrays.

**Signature:**
```javascript
function computeStudentStats({
  mapData,       // Array<Array> — UFLI MAP sheet data
  preKData,      // Array<Array> — Pre-K Data sheet data
  preKHeaders,   // Array — Pre-K header row
  initialData,   // Array<Array> — Initial Assessment data
  config         // Object — { LAYOUT, PREK_CONFIG, GRADE_METRICS? }
}) → { skillsOutput: Array<Array>, summaryOutput: Array<Array> }
```

**What it does:**
1. Builds initial assessment lookup map from `initialData`
2. Processes K-8 students: merges rows → calculates skills + benchmarks
3. Processes Pre-K students: calculates HWT scores
4. Returns `{ skillsOutput, summaryOutput }` arrays

**Design Decision:** `computeStudentStats` was extracted from `updateAllStats` to enable testing the entire statistics pipeline without any sheet access. The IO wrapper `updateAllStats` now reads sheets → calls `computeStudentStats` → writes results.

---

### New File: SharedEngine_IO.gs

Contains only the GAS-dependent functions.

| Function | GAS APIs Used | Purpose |
|----------|--------------|---------|
| `getOrCreateSheet(ss, sheetName, clearIfExists)` | `ss.getSheetByName()`, `ss.insertSheet()`, `sheet.clear()` | Get or create a named sheet |
| `log(functionName, message, level)` | `Logger.log()` | Structured logging |
| `updateAllStats(ss, mapData, config)` | `ss.getSheetByName()`, `sheet.getDataRange().getValues()`, `sheet.getRange().setValues()` | Read sheets → compute → write results |

**`updateAllStats` refactored flow:**
```
1. READ: UFLI MAP, Pre-K Data, Initial Assessment  → sheet data arrays
2. COMPUTE: computeStudentStats(params)             → { skillsOutput, summaryOutput }
3. WRITE: Skills Tracker, Grade Summary             → setValues()
```

---

## Function Classification: All Modules

The following table classifies EVERY function across ALL modules into API, Logic, or IO layer.

### SharedConstants.gs (141 lines)

| Classification | Functions |
|---------------|-----------|
| **Logic** | `getPerformanceStatus(percentage)` |
| **Constants** | `LESSON_LABELS`, `SKILL_SECTIONS`, `REVIEW_LESSONS`, `REVIEW_LESSONS_SET`, `PERFORMANCE_THRESHOLDS`, `STATUS_LABELS` |

### SharedEngine_Core.gs (639 lines)

| Classification | Count | Functions |
|---------------|-------|-----------|
| **Logic** | 15 | All functions listed above + `computeStudentStats` |
| **Constants** | 8 | All lesson arrays + `SHARED_GRADE_METRICS` |
| **IO** | 0 | — |

### SharedEngine_IO.gs (148 lines)

| Classification | Count | Functions |
|---------------|-------|-----------|
| **IO** | 3 | `getOrCreateSheet`, `log`, `updateAllStats` |
| **Logic** | 0 | — |

### CoachingDashboard.gs

| Classification | Count | Functions |
|---------------|-------|-----------|
| **API** | 2 | `openWeeklyDashboard`, `refreshWeeklyDashboard` |
| **Logic** | 4 | `bucketByWeek_`, `getISOWeekKey_`, `weekKeyToDate_`, `buildWeeklyRows_` |
| **IO** | 6 | `getAllGroupNamesForDashboard_`, `writeWeeklySheet_`, `applyChangeConditionalFormatting_`, `applyWeekSeparators_`, `applyNoDataStyling_`, `writeWeeklyEmptyState_` |

### TutoringSystem.gs

| Classification | Count | Functions |
|---------------|-------|-----------|
| **API** | 3 | `goToTutoringSummary`, `goToTutoringLog`, `syncTutoringProgress` |
| **Logic** | 3 | `isTutoringGroup`, `categorizeTutoringLesson`, `safeSetNumberFormat` |
| **IO** | 10 | `createTutoringSheets`, `createTutoringProgressLogSheet`, `createTutoringSummarySheet`, `saveLessonData`, `savePreKData`, `saveTutoringData`, `saveStandardUFLIData`, `syncAllProgress`, `getPrimaryGroupForStudent`, `getStudentCombinedProgress` |
| **Test** | 1 | `testTutoringSystem` |

### GrowthHighlighter.gs

| Classification | Count | Functions |
|---------------|-------|-----------|
| **API** | 3 | `ghShowSidebar`, `ghAddMenu`, `ghRunHighlighter` |
| **Logic** | 2 | `ghGetGrowthInfo`, `ghParseNumericValue` |
| **IO** | 3 | `ghGetSheetInfo`, `ghClearAllHighlights`, `ghExportResults` |

### GrantReporting.gs

| Classification | Count | Functions |
|---------------|-------|-----------|
| **API** | 3 | `generateMindTrustSummary`, `scheduleMindTrustReport`, `removeMindTrustTrigger` |
| **Logic** | 4 | `generateRecommendation_`, `parseNum_`, `toDate_`, `tallySGPAttendance_` |
| **IO** | 18 | All `get*Data_`, `write*` functions |

### MixedGradeSupport.gs

| Classification | Count | Functions |
|---------------|-------|-----------|
| **API** | 5 | `repairAllGroupSheetFormatting_MixedGrade`, `testMixedGradeConfig`, `createMixedGradeGroupSheets`, `updateSchoolSummary_MixedGrade`, `debugGroupLoading` |
| **Logic** | 12 | `getSheetNameForGrade`, `isGroupHeader_Standard`, `getGroupFromSankofaRow`, `getLessonsAndStudents_Sankofa`, `getLessonsAndStudents_Standard`, `getGroupsForMixedSheet`, `naturalSort` ×2, `getGradeHeaderText_MixedGrade`, `getDefaultGradeMetrics`, `formatPercent`, `formatGrowth`, `formatDate` |
| **IO** | 24 | All sheet-reading/writing functions |

### UnenrollmentAutomation.gs

| Classification | Count | Functions |
|---------------|-------|-----------|
| **API** | 4 | `manualArchiveStudent`, `setupUnenrollmentAutomation`, `goToArchiveSheet`, `goToAuditLog` |
| **Logic** | 1 | `escapeGraphQL_` |
| **IO** | 12 | All sheet/API functions |

### AdminImport.gs

| Classification | Count | Functions |
|---------------|-------|-----------|
| **API** | 5 | `addAdminMenu`, `showImportDialog`, `goToExceptionsSheet`, `clearImportStaging`, `refreshGradeSummaryFormulas` |
| **Logic** | 8 | `parseGridFormat`, `parseRowFormat`, `parseCSVLine`, `sanitizeCellValue`, `normalizeStudentName`, `validateRow`, `buildStudentRowLookup`, `buildBestEntryMap` |
| **IO** | 13 | All sheet-reading/writing functions |

### ModuleLoader.gs

| Classification | Count | Functions |
|---------------|-------|-----------|
| **API** | 2 | `buildFeatureMenu`, `initializeFeatureModules` |
| **Logic** | 3 | `getGradeList`, `getSheetNameForGradeCode`, `getEnabledFeaturesDisplay` |

---

## Aggregate Metrics

| Category | Function Count | Testable in Node.js? |
|----------|---------------|---------------------|
| **Logic (Pure)** | 52 | ✅ Yes |
| **IO (Sheet Access)** | 89 | ❌ No |
| **API (Entry Points)** | 27 | ❌ No |
| **Test/Debug** | 2 | N/A |
| **Total** | 170 | 31% testable |

**Goal:** Increase testable percentage by extracting more pure logic from IO functions (especially in MixedGradeSupport and Phase2_ProgressTracking).

---

## Test Coverage for This Refactor

| Test File | Tests Added | What It Validates |
|-----------|-------------|-------------------|
| `SharedEngine_Split.test.js` | 42 | API parity, constants parity, computeStudentStats, result equivalence |

All 232 existing tests continue to pass unchanged.

---

## Files Changed

| File | Change |
|------|--------|
| `gold-standard-template/SharedEngine_Core.gs` | **NEW** — Pure logic extracted from SharedEngine.gs + computeStudentStats |
| `gold-standard-template/SharedEngine_IO.gs` | **NEW** — I/O functions from SharedEngine.gs |
| `gold-standard-template/SharedEngine.gs` | **UNCHANGED** — Retained for backward compatibility |
| `tests/SharedEngine_Split.test.js` | **NEW** — 42 tests for split validation |
| `tests/helpers/loadGasModules.js` | **MODIFIED** — Added GAS_FILES_SPLIT export |
| `tests/fixtures/testData.js` | **MODIFIED** — Added COMPUTE_STATS_CONFIG, buildMapDataWithHeaders |
| `gold-standard-template/validate_shared_constants.js` | **MODIFIED** — Validates split files |
| `docs/MODULE_BOUNDARIES.md` | **NEW** — API/Logic/IO documentation |
| `docs/TESTABILITY_GUIDE.md` | **NEW** — Testing patterns guide |
| `docs/BUSINESS_LOGIC_REFACTOR.md` | **NEW** — This document |
| `docs/DIVERGENCE_ANALYSIS.md` | **NEW** — Cross-file overlap analysis |

---

## Related Documents

- [MODULE_BOUNDARIES.md](MODULE_BOUNDARIES.md) — API → Logic → IO per module
- [TESTABILITY_GUIDE.md](TESTABILITY_GUIDE.md) — Dependency injection patterns
- [DIVERGENCE_ANALYSIS.md](DIVERGENCE_ANALYSIS.md) — Cross-file duplication analysis
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture overview

---

*This record is part of the modularity refactor initiative.*
