# Module Boundaries: API → Logic → IO Structure

> **Version:** 1.0 (Modularity Refactor)  
> **Last Updated:** February 2026  
> **Purpose:** Documents the API, Business Logic, and I/O boundaries for every module in the system.  
> **Audience:** Developers maintaining or extending the UFLI Master System.

---

## Overview

The UFLI Master System follows a three-layer architecture for each module:

| Layer | Description | Testable in Node.js? | GAS APIs Used? |
|-------|-------------|---------------------|----------------|
| **API** | Menu entry points, dialog launchers, navigation functions | ❌ No | ✅ Yes (SpreadsheetApp.getUi, HtmlService) |
| **Logic** | Pure business calculations, data transformations, validation | ✅ Yes | ❌ No |
| **IO** | Sheet reads/writes, formatting, logging, external API calls | ❌ No | ✅ Yes (SpreadsheetApp, Logger, UrlFetchApp) |

**Design Principle:** Logic functions accept all data as parameters (dependency injection) and return computed results. IO functions orchestrate by reading sheets → calling Logic → writing results.

---

## Core Modules

### SharedConstants.gs
**Role:** Canonical UFLI curriculum constants — single source of truth.

| Layer | Functions / Constants |
|-------|---------------------|
| **Logic** | `LESSON_LABELS` (128 entries), `SKILL_SECTIONS` (16 sections), `REVIEW_LESSONS` (23 lessons), `REVIEW_LESSONS_SET`, `PERFORMANCE_THRESHOLDS`, `STATUS_LABELS`, `getPerformanceStatus(percentage)` |
| **IO** | *(none)* |
| **API** | *(none)* |

**Key Principle:** No other file should redefine these constants. All modules reference SharedConstants.

---

### SharedEngine_Core.gs (Pure Logic)
**Role:** All pure business logic for progress calculations.

| Layer | Functions |
|-------|----------|
| **Logic — Lesson Arrays** | `FOUNDATIONAL_LESSONS`, `G1_MINIMUM_LESSONS`, `G1_CURRENT_YEAR_LESSONS`, `G2_MINIMUM_LESSONS`, `G2_CURRENT_YEAR_LESSONS`, `G4_MINIMUM_LESSONS`, `ALL_NON_REVIEW_LESSONS` |
| **Logic — Grade Metrics** | `SHARED_GRADE_METRICS` |
| **Logic — Core Helpers** | `getLessonColumnIndex(lessonNum, LAYOUT)`, `getLessonStatus(row, lessonNum, LAYOUT)`, `isReviewLesson(lessonNum)`, `partitionLessonsByReview(lessons)`, `checkGateway(row, reviewLessons, LAYOUT)` |
| **Logic — Calculations** | `calculateBenchmark(mapRow, lessonIndices, denominator, LAYOUT)`, `calculateSectionPercentage(mapRow, sectionLessons, isInitialAssessment, LAYOUT)`, `calculatePreKScores(row, headers, PREK_CONFIG)`, `countYsInColumns(row, headers, pattern)` |
| **Logic — Utilities** | `getColumnLetter(columnNumber)`, `extractLessonNumber(lessonText)`, `normalizeStudent(student)`, `getLastLessonColumn(LAYOUT)` |
| **Logic — Merging** | `createMergedRow(currentRow, initialRow)` |
| **Logic — Statistics** | `computeStudentStats({ mapData, preKData, preKHeaders, initialData, config })` → `{ skillsOutput, summaryOutput }` |

**Dependency Injection Pattern:** Every function receives `LAYOUT`, `PREK_CONFIG`, or full `config` as a parameter — no global reads.

---

### SharedEngine_IO.gs (I/O Layer)
**Role:** Sheet access, logging, and orchestration of updateAllStats.

| Layer | Functions |
|-------|----------|
| **IO — Sheet Utilities** | `getOrCreateSheet(ss, sheetName, clearIfExists)` |
| **IO — Logging** | `log(functionName, message, level)` |
| **IO — Orchestrator** | `updateAllStats(ss, mapData, config)` — reads sheets → calls `computeStudentStats()` → writes results |

**Key Pattern:** `updateAllStats` is a thin I/O wrapper: it reads 3 sheets, delegates all computation to `computeStudentStats()` (pure logic), then writes 2 sheets.

---

### SharedEngine.gs (Original Monolith)
**Role:** Backward-compatible monolith containing both Core and IO functions.  
**Status:** Retained for backward compatibility. New code should import from `_Core` and `_IO` split.

---

### UnifiedConfig.gs
**Role:** Runtime configuration resolver — single source of config truth.

| Layer | Functions |
|-------|----------|
| **Logic** | `GRADE_RANGE_MODELS` (5 presets), `getUnifiedConfig()` → full config object, `getGradeRangeModels()`, `getDefaultGradesForModel(modelId)`, `validateUnifiedConfig(config)` |
| **IO** | *(reads from `SITE_CONFIG` global — defined at file scope, not a sheet read)* |

---

## Feature Modules

### CoachingDashboard.gs
**Feature Flag:** `SITE_CONFIG.features.coachingDashboard`

| Layer | Functions |
|-------|----------|
| **API** | `openWeeklyDashboard()`, `refreshWeeklyDashboard()` |
| **Logic** | `bucketByWeek_(data)`, `getISOWeekKey_(date)`, `weekKeyToDate_(weekKey)`, `buildWeeklyRows_(weekBuckets, weekKeys, allGroups)` |
| **IO** | `getAllGroupNamesForDashboard_(ss)`, `writeWeeklySheet_(sheet, rows, weekKeys)`, `applyChangeConditionalFormatting_(sheet, rowCount)`, `applyWeekSeparators_(sheet, rows)`, `applyNoDataStyling_(sheet, rows)`, `writeWeeklyEmptyState_(sheet)` |

---

### TutoringSystem.gs
**Feature Flag:** `SITE_CONFIG.features.tutoringSystem`

| Layer | Functions |
|-------|----------|
| **API** | `goToTutoringSummary()`, `goToTutoringLog()`, `syncTutoringProgress()` |
| **Logic** | `isTutoringGroup(groupName)`, `categorizeTutoringLesson(lessonName)`, `safeSetNumberFormat(sheet, row, col, numRows, format)` |
| **IO** | `createTutoringSheets()`, `createTutoringProgressLogSheet(ss)`, `createTutoringSummarySheet(ss)`, `saveLessonData(formObject)`, `savePreKData(formObject)`, `saveTutoringData(formObject)`, `saveStandardUFLIData(formObject)`, `syncAllProgress()`, `getPrimaryGroupForStudent(studentName)`, `getStudentCombinedProgress(studentName)` |
| **Testing** | `testTutoringSystem()` |

---

### GrowthHighlighter.gs
**Feature Flag:** `SITE_CONFIG.features.growthHighlighter`

| Layer | Functions |
|-------|----------|
| **API** | `ghShowSidebar()`, `ghAddMenu()`, `ghRunHighlighter(options)` |
| **Logic** | `ghGetGrowthInfo(row, minGrowth)`, `ghParseNumericValue(value)` |
| **IO** | `ghGetSheetInfo()`, `ghClearAllHighlights()`, `ghExportResults(students)` |

---

### GrantReporting.gs
**Feature Flag:** `SITE_CONFIG.features.grantReporting`

| Layer | Functions |
|-------|----------|
| **API** | `generateMindTrustSummary()`, `scheduleMindTrustReport()`, `removeMindTrustTrigger()` |
| **Logic** | `generateRecommendation_(lowestSkill, lowestPct, benchmark, gapSkills)`, `parseNum_(val)`, `toDate_(val)`, `tallySGPAttendance_(sheet, counts, studentNames, dateRange)` |
| **IO** | `generateMindTrustSummaryScheduled()`, `generateMindTrustSummaryCore_(reportDate)`, `getExistingMTTrigger_()`, `getTutoringStudentList_(ss)`, `getGradeSummaryData_(ss)`, `getSkillsTrackerData_(ss)`, `getAttendanceData_(ss, tutoringStudents, dateRange)`, `getTutoringLogData_(ss, dateRange)`, `getSchoolSummaryMetrics_(ss)`, `writeReportHeader_(...)`, `writeDataSourceNote_(...)`, `writeSection1_Attendance_(...)`, `writeSection2_BaselineVsCurrent_(...)`, `writeSection3_Growth_(...)`, `writeSection4_SkillGaps_(...)`, `writeSection5_InstructionalAdjustments_(...)`, `writeSectionHeader_(...)`, `writeHeaderRow_(...)` |

---

### MixedGradeSupport.gs
**Feature Flag:** `SITE_CONFIG.features.mixedGradeSupport`

| Layer | Functions |
|-------|----------|
| **API** | `repairAllGroupSheetFormatting_MixedGrade()`, `testMixedGradeConfig()`, `createMixedGradeGroupSheets(ss, wizardData)`, `updateSchoolSummary_MixedGrade()`, `debugGroupLoading()` |
| **Logic** | `getSheetNameForGrade(grade)`, `isGroupHeader_Standard(cellValue, data, rowIndex)`, `getGroupFromSankofaRow(data, rowIndex)`, `getLessonsAndStudents_Sankofa(data, groupName)`, `getLessonsAndStudents_Standard(data, groupName)`, `getGroupsForMixedSheet(wizardData, grades)`, `naturalSort(a, b)` *(defined twice — line 1347, line 1600)*, `getGradeHeaderText_MixedGrade(grade, studentCount)`, `getDefaultGradeMetrics()`, `formatPercent(value)`, `formatGrowth(value)`, `formatDate(date)` |
| **IO** | `getSheetNameForGroup(groupName)`, `getGroupsForForm_MixedGrade()`, `getLessonsAndStudentsForGroup_MixedGrade(groupName)`, `getLessonsAndStudentsForSCClassroom()`, `getLessonsAndStudentsForMixedGradeGroup(groupName, sheetName)`, `getLessonsAndStudentsFromGradeSheets(groupName)`, `getLessonsAndStudentsForPreKGroup(groupName)`, `updateGroupArrayByLessonName_MixedGrade(...)`, `updateGroupArray_Sankofa(...)`, `updateGroupArray_Standard(...)`, `scanGradeSheetsForPacing_MixedGrade(ss, lookups, progressMap)`, `processPacing_Sankofa(...)`, `processPacing_SCClassroom(...)`, `processPacing_Standard(...)`, `formatSheet_Sankofa(sheet, data, lastCol)`, `formatSheet_Standard(sheet, data, lastCol)`, `createMixedGradeSheet(ss, sheetName, groupNames, allStudents)`, `getGroupsAndSheets_MixedGrade()`, `buildGroupPerformanceSection_MixedGrade(ss)`, `getSiteName(ss)`, `getGradesFromConfig(configSheet)`, `buildGradeMetrics(ss)`, `applySchoolSummaryFormatting_MixedGrade(sheet, gradeCount)`, `renderMixedGradeGroupTable(sheet, row, pacingData)` |

⚠️ **Known Issues:** `naturalSort()` is defined twice within this file (lines 1347, 1600).

---

### UnenrollmentAutomation.gs
**Feature Flag:** `SITE_CONFIG.features.unenrollmentAutomation`

| Layer | Functions |
|-------|----------|
| **API** | `manualArchiveStudent()`, `setupUnenrollmentAutomation()`, `goToArchiveSheet()`, `goToAuditLog()` |
| **Logic** | `escapeGraphQL_(str)` |
| **IO** | `getMondayApiKey_()`, `createMondayTask(data)`, `testMondayConnection()`, `createArchiveSheet_(ss)`, `collectStudentData_(ss, studentName)`, `writeToArchive_(archiveSheet, data)`, `writeArchiveHeaders()`, `deleteFromGroupSheet_(ss, studentName, groupName, gradeSheet)`, `deleteFromSourceSheets_(ss, studentName)`, `logArchiveAction_(data, results)`, `archiveUnenrolledStudent(data)`, `logUnenrolledStudent(data)` |

---

### AdminImport.gs
**Feature Flag:** `SITE_CONFIG.features.adminImport`

| Layer | Functions |
|-------|----------|
| **API** | `addAdminMenu()`, `showImportDialog()`, `goToExceptionsSheet()`, `clearImportStaging()`, `refreshGradeSummaryFormulas()` |
| **Logic** | `parseGridFormat(csvData)`, `parseRowFormat(csvData)`, `parseCSVLine(line)`, `sanitizeCellValue(value)`, `normalizeStudentName(name)`, `validateRow(rowNum, name, date, group, lesson, status, lookup)`, `buildStudentRowLookup(sheet)`, `buildBestEntryMap(validRows, studentLookup)` |
| **IO** | `getImportDialogHtml()`, `importCsvToStaging(csvData, importType)`, `getOrCreateAdminSheet(ss, sheetName)`, `validateImportData()`, `buildStudentLookup(ss)`, `applyValidationFormatting(sheet, lastRow)`, `createExceptionsReport(ss, exceptions)`, `processImportData()`, `processInitialAssessmentImport(ss, bestEntries, studentLookup)`, `processLessonProgressImport(ss, bestEntries, studentLookup)`, `createInitialAssessmentSheet(ss, mapSheet)`, `applyMapUpdates(sheet, updates)`, `repairSheetFormatting(sheet)`, `archiveToHistorical(ss, validRows, studentLookup, importType)` |

---

### ModuleLoader.gs
**Role:** Dynamic menu builder driven by SITE_CONFIG.features.

| Layer | Functions |
|-------|----------|
| **API** | `buildFeatureMenu(ui, baseMenu)`, `initializeFeatureModules()` |
| **Logic** | `getGradeList(gradeCode)`, `getSheetNameForGradeCode(gradeCode)`, `getEnabledFeaturesDisplay()` |

---

## Dependency Graph

```
SharedConstants.gs                          (constants — no deps)
    ↓
SharedEngine_Core.gs                        (pure logic — depends on SharedConstants)
    ↓
SharedEngine_IO.gs                          (I/O — depends on Core + Constants)
    ↓
UnifiedConfig.gs                            (config resolver — depends on SharedEngine for SHARED_GRADE_METRICS)
    ↓
SiteConfig_TEMPLATE.gs                      (config definition — depends on nothing)
    ↓
Phase2_ProgressTracking.gs                  (progress engine — depends on SharedEngine, SharedConstants)
    ↓
┌─────────────────────────────────────────────────────────┐
│  Feature Modules (each depends on core + Phase2)         │
│  CoachingDashboard │ TutoringSystem │ GrantReporting     │
│  GrowthHighlighter │ AdminImport   │ UnenrollmentAuto   │
│  MixedGradeSupport │ ModuleLoader                       │
└─────────────────────────────────────────────────────────┘
    ↓
SetupWizard.gs                              (orchestration — depends on Phase2, modules)
```

---

## Testing Coverage by Layer

| Layer | Test Tier | Framework | Location |
|-------|-----------|-----------|----------|
| **Logic** (pure functions) | Tier 1 — Unit Tests | Jest + VM loader | `tests/*.test.js` |
| **Logic** (statistics pipeline) | Tier 1 — Scenario Tests | Jest + VM loader | `tests/scenarios/*.test.js` |
| **IO** (sheet operations) | Tier 2 — Integration Tests | GAS + IntegrationTestRunner | `tests/integration/gas/*.gs` |
| **API** (menu/dialog entry points) | Tier 3 — Manual QA | Manual checklist | `docs/QA_CHECKLIST.md` |

### Current Test Counts

| Test File | Tests | Coverage Area |
|-----------|-------|---------------|
| SharedConstants.test.js | 16 | Constants validation |
| SharedEngine.test.js | 57 | All pure Core functions |
| SharedEngine_Split.test.js | 42 | Split parity + computeStudentStats |
| TutoringSystem.test.js | 11 | isTutoringGroup, categorizeTutoringLesson |
| SchoolLifecycle.scenario.test.js | 20 | BOY→MOY→EOY simulation |
| GradeRangeModels.scenario.test.js | 25 | All 5 grade range models |
| FeatureToggles.scenario.test.js | 16 | Feature flag combinations |
| UpdateAllStats.scenario.test.js | 24 | E2E stats computation |
| PreKIntegration.scenario.test.js | 16 | Pre-K HWT integration |
| **Total** | **232** | |

---

## How to Determine a Function's Layer

Use this decision tree:

1. **Does it call SpreadsheetApp, Logger, HtmlService, UrlFetchApp, PropertiesService, or Session?**
   - Yes → **IO Layer**
   - No → continue

2. **Does it create UI menus, open dialogs, or navigate sheets?**
   - Yes → **API Layer**
   - No → continue

3. **Does it accept all inputs as parameters and return a deterministic result?**
   - Yes → **Logic Layer** ✅ (testable in Node.js)
   - No → Refactor to accept parameters (dependency injection)

---

*This document is maintained as part of the modularity refactor. Update when adding new modules or functions.*
