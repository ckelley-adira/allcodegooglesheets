# Phase2_ProgressTracking.gs

## 📋 Overview

**Version:** 6.0 — Phase 7D Unified  
**File size:** ~108 KB  
**Location:** `gold-standard-template/Phase2_ProgressTracking.gs`

This is the **core progress tracking engine** for the UFLI Master System. It handles everything that happens _after_ data is entered by a teacher: syncing the Small Group Progress log to master sheets, calculating skill mastery percentages, maintaining the School Summary Dashboard, generating pacing reports, and providing repair/maintenance utilities.

The file consolidates six previously school-specific implementations (Adelante, Allegiant, Sankofa, GlobalPrep, CCA, CHAW) into a single parameterized module. All school-specific branding is delegated to extension files; this file focuses on universal tracking logic.

**In the system flow:**
1. Teacher submits lesson data via the web form (`SetupWizard.gs → saveLessonData()`)
2. Data lands in **Small Group Progress** sheet (the raw log)
3. `syncSmallGroupProgress()` (this file) reads the log and fans out updates to UFLI MAP, Grade Group sheets, Skills Tracker, and Grade Summary
4. `updateSchoolSummary()` (this file) renders the visual dashboard from those sheets

---

## 📜 Business Rules

### Lesson Status Values
- **Y** = Passed / Yes (green, `#d4edda`)
- **N** = Not Passed / No (red, `#f8d7da`)
- **A** = Absent (yellow, `#fff3cd`)
- **U** = Unenrolled (logged to Exception Log, not written to tracker sheets)
- **Blank** = Not yet attempted

### Score Calculation
- Percentage = `(Y count) / (Y + N count) × 100`, **rounded to nearest integer**
- **Absent (`A`) records are excluded from the denominator** — absence never penalizes a score
- Review lessons (gateway tests) are excluded from skill section percentage denominators; they are treated as pass/fail gates
- Pacing rates (dashboard) use total responses `(Y + N + A)` as denominator so all three rates sum to 100%

### Performance Thresholds (from `SharedConstants.gs`)
| Status | Threshold |
|--------|-----------|
| On Track | ≥ 80% (`PERFORMANCE_THRESHOLDS.ON_TRACK`) |
| Progressing | 50–79% (`PERFORMANCE_THRESHOLDS.NEEDS_SUPPORT`) |
| Needs Support | < 50% |

Student distribution bands on the School Summary Dashboard use **Min Grade Skills %** (column F of Grade Summary) as the benchmark score.

### Current Lesson Tracking
- Current Lesson = the **highest lesson number** ever attempted by the student (not the most recent date)
- If the same lesson is submitted again with a "reteach" suffix, the reteach label is preserved
- The `Current Lesson` value is stored as the full lesson label (e.g., `"UFLI L15 reteach"`)

### Group Sheet Structure (Expected Layout)
```
Row 1–2:   Empty spacers
Row 3:     "Instructional Sequence" + dates (manually filled)
Row 4+:    Group blocks, each containing:
             ├── Group Header row  (e.g., "G3 Group 1")
             ├── Column Headers    ("Student Name", "Lesson 1", ...)
             ├── Lesson Names      (e.g., "", "UFLI L101", "UFLI L102", ...)
             ├── Student data rows (A = student name, B+ = Y/N/A)
             └── Spacer row
```

### Group Performance Status (Dashboard)
| Status | Condition |
|--------|-----------|
| 🟢 Strong | Pass rate ≥ 85% |
| ✅ Good | Pass rate ≥ 70%, absent rate ≤ 10% |
| 🟡 Watch | Pass rate 50–69% OR absent rate 10–15% |
| 🔴 Alert | Pass rate < 50% OR absent rate > 15% |

### Pre-K Denominators
| Metric | Denominator |
|--------|-------------|
| Form (motor) | 26 letters |
| Name + Sound (literacy) | 52 items |
| Full K-readiness | 78 items |

### Pacing Time Estimates
Each lesson is estimated at **60 minutes** of instruction. Expected Time = `assigned lessons × 60`. Actual Time = `tracked lessons × 60`.

### Mixed-Grade Support
When `ENABLE_MIXED_GRADES` is truthy and `MIXED_GRADE_CONFIG` is defined, `syncSmallGroupProgress()` and `updatePacingReports()` delegate to mixed-grade variants (`scanGradeSheetsForPacing_MixedGrade`, `updateGroupArrayByLessonName_MixedGrade`). If those functions are absent, the standard scanner is used as fallback.

---

## 📥 Data Inputs

### Sheets Read
| Sheet | Purpose |
|-------|---------|
| `Small Group Progress` | Raw lesson log: date, teacher, group, student, lesson, status |
| `UFLI MAP` | Master student × lesson grid (128 lesson columns, starting at col F) |
| `Skills Tracker` | 16 skill section percentage columns per student |
| `Grade Summary` | Benchmark metrics (Foundational %, Min Grade %, Full Grade %, Status) |
| `Initial Assessment` | Initial lesson statuses used to calculate growth |
| `Pacing Dashboard` | Dashboard rows used by School Summary |
| `Group Configuration` | Student counts per group (for pacing lookups) |
| `Site Configuration` | School name, grades served |
| `[Grade] Groups` (e.g., `KG Groups`, `G3 Groups`) | Per-grade group × lesson matrices |
| `SC Classroom` | Special-needs classroom sheet (if feature enabled) |
| `Pre-K Data` | Pre-K letter assessments matrix |
| `PreK Pacing` | Pre-K instructional sequences and skill types |

### Constants / Config Consumed
- `LAYOUT` — `DATA_START_ROW=6`, `COL_FIRST_LESSON=6`, `COL_CURRENT_LESSON=5`, `TOTAL_LESSONS=128`, `LESSONS_PER_GROUP_SHEET=12`
- `LESSON_LABELS` — all 128 lesson labels (from `SharedConstants.gs`)
- `SKILL_SECTIONS` — 16 skill sections with lesson arrays (from `SharedConstants.gs`)
- `REVIEW_LESSONS_SET` — set of 23 review lesson numbers (from `SharedConstants.gs`)
- `PERFORMANCE_THRESHOLDS` — `ON_TRACK=80`, `NEEDS_SUPPORT=50` (from `SharedConstants.gs`)
- `SHARED_GRADE_METRICS` (aliased as `GRADE_METRICS`) — per-grade foundational/min/full benchmark lesson sets
- `SITE_CONFIG.features` — feature flags: `diagnosticTools`, `lessonArrayTracking`, `dynamicStudentRoster`, `studentNormalization`, `mixedGradeSupport`
- `ENABLE_MIXED_GRADES`, `MIXED_GRADE_CONFIG` — mixed-grade site configuration (optional)
- `PREK_CONFIG` — header/data rows and denominators for Pre-K

### Function Parameters (Key Entry Points)
- `generateSystemSheets(ss, wizardData)` — requires `wizardData.students[]`, `wizardData.groups[]`
- `syncSmallGroupProgress()` — reads all data from spreadsheet; no parameters
- `updateSchoolSummary()` — no parameters; reads from live sheets
- `renderGradeCard(sheet, startRow, grade, students, groups, initialData, overrideCount)` — takes pre-loaded data arrays

---

## 📤 Outputs

### Sheet Modifications
| Sheet | What Gets Written |
|-------|-------------------|
| `UFLI MAP` | Lesson status cells (Y/N/A), Current Lesson column |
| `Skills Tracker` | Skill section percentage values (cols E+) |
| `Grade Summary` | Foundational %, Min Grade %, Full Grade %, Benchmark Status, per-section AG% triplets |
| `[Grade] Groups` | Student status cells (Y/N/A) per lesson column |
| `Pacing Dashboard` | 13-column rows per group: Group, Teacher, Students, Assigned/Tracked lessons, Pacing %, Highest Lesson, Last Entry, Expected/Actual Time, Pass/NotPassed/Absent rates |
| `Pacing Log` | 12-column rows per group-lesson: Group, Teacher, Lesson Slot, UFLI Lesson, Student Count, Y/N/A counts, Pass%/NotPassed%/Absent%, Last Date |
| `School Summary` | Visual dashboard: header, grade cards, metrics rows, distribution bars, group performance tables |
| `Exception Log` | One row per unenrolled student: Date, Type="Unenrolled", Group, Lesson, Student |

### UI Dialogs / Alerts
- `regenerateSystemSheets()` — confirmation dialog before destructive operation
- `fixMissingTeachers()` — alert showing count of fixed rows
- `repairSkillsTrackerFormulas()`, `repairGradeSummaryFormulas()`, `repairCurrentLessonFormulas()`, `repairAllFormulas()`, `repairUFLIMapFormatting()`, `repairAllGroupSheetFormatting()` — completion alerts
- `updateAllProgress()` — "Update Complete" alert

### Return Values
- `generateSystemSheets()` → `{ success: boolean, error?: string }`
- `updateSchoolSummary()` → void (writes directly to sheet)
- `syncSmallGroupProgress()` → void
- `updatePacingReports()` → void

---

## 🔗 Dependencies

### Depends On (calls into)

| File | Functions Called |
|------|----------------|
| `SharedEngine.gs` | `getLessonStatus()`, `calculateSectionPercentage()`, `getOrCreateSheet()`, `partitionLessonsByReview()`, `updateAllStats()` |
| `SharedConstants.gs` | `LESSON_LABELS`, `SKILL_SECTIONS`, `REVIEW_LESSONS`, `REVIEW_LESSONS_SET`, `PERFORMANCE_THRESHOLDS`, `STATUS_LABELS`, `SHARED_GRADE_METRICS`, `getPerformanceStatus()` |
| `SetupWizard.gs` | `getWizardData()`, `getExistingGrades()`, `getSheetDataAsMap()`, `addStudentToSheet()`, `updateStudentInSheet()` (via GAS flat namespace) |
| `SiteConfig_TEMPLATE.gs` | `SITE_CONFIG.features`, `isFeatureEnabled()` |
| `modules/MixedGradeSupport.gs` | `scanGradeSheetsForPacing_MixedGrade()`, `updateGroupArrayByLessonName_MixedGrade()`, `renderMixedGradeGroupTable()`, `getSheetNameForGroup()`, `getGroupsForForm_MixedGrade()`, `getLessonsAndStudentsForGroup_MixedGrade()` (optional; used when `ENABLE_MIXED_GRADES` is set) |
| `modules/TutoringSystem.gs` | `isTutoringGroup()`, `saveTutoringData()` (optional; used when tutoring groups are detected) |
| `modules/ModuleLoader.gs` | `addToSyncQueue()` (optional; fast-save queue) |

### Used By (called from)

| File | Calls |
|------|-------|
| `SetupWizard.gs` | `generateSystemSheets()`, `createPacingReports()`, `syncSmallGroupProgress()` (via `saveConfiguration()`), `updateSchoolSummary()`, `updateAllProgress()` |
| `SetupWizard.gs` | `goToSchoolSummary()` (menu item) |
| `modules/ModuleLoader.gs` | `repairAllFormulas()`, `fixMissingTeachers()`, `repairUFLIMapFormatting()` (via System Tools submenu) |
| GAS time-based trigger | `runFullSyncDeferred()` (nightly or hourly) |
| Menu items | `updateAllProgress()`, `goToSchoolSummary()`, `regenerateSystemSheets()`, `testGroupSheetStructure()` |

---

## ⚙️ Function Reference

### Constants

#### `SHEET_NAMES_V2`
Sheet name constants for the six core tracking sheets: `SMALL_GROUP_PROGRESS`, `UFLI_MAP`, `SKILLS`, `GRADE_SUMMARY`, `INITIAL_ASSESSMENT`, `SCHOOL_SUMMARY`.

#### `SHEET_NAMES_PREK`
Sheet name constant for Pre-K: `DATA = "Pre-K Data"`.

#### `PREK_CONFIG`
Pre-K layout constants: `TOTAL_LETTERS=26`, `HEADER_ROW=5`, `DATA_START_ROW=6`, `FORM_DENOMINATOR=26`, `NAME_SOUND_DENOMINATOR=52`, `FULL_DENOMINATOR=78`.

#### `SHEET_NAMES_PACING`
Pacing sheet names: `DASHBOARD = "Pacing Dashboard"`, `LOG = "Pacing Log"`.

#### `LAYOUT`
Column layout for system sheets: `DATA_START_ROW=6`, `HEADER_ROW_COUNT=5`, `LESSON_COLUMN_OFFSET=5`, `TOTAL_LESSONS=128`, `LESSONS_PER_GROUP_SHEET=12`, `COL_STUDENT_NAME=1`, `COL_GRADE=2`, `COL_TEACHER=3`, `COL_GROUP=4`, `COL_CURRENT_LESSON=5`, `COL_FIRST_LESSON=6`.

#### `COLORS`
Hex color constants for sheet formatting: `Y="#d4edda"`, `N="#f8d7da"`, `A="#fff3cd"`, `HEADER_BG="#4A90E2"`, etc.

#### `DASHBOARD_COLORS`
Dashboard-specific colors: `HEADER_BG="#1a73e8"`, `ON_TRACK="#34a853"`, `PROGRESSING="#fbbc04"`, `AT_RISK="#ea4335"`, etc.

#### `COLS`
0-based column index maps for `SMALL_GROUP_PROGRESS`, `UFLI_MAP`, `SKILLS`, and `GRADE_SUMMARY` sheets (used when reading via `getValues()`).

#### `GRADE_METRICS`
Alias for `SHARED_GRADE_METRICS` (defined in `SharedConstants.gs`). Provides per-grade lesson sets for foundational/minimum/current-year benchmarks. Falls back to `{}` if `SHARED_GRADE_METRICS` is not defined.

---

### Formatting & Display Helpers

### `createHeader(sheet, row, text, width, options)`
**Description:** Writes a non-merged header row. Sets background color across `width` columns but places text only in column 1. Preferred over `createMergedHeader()`.  
**Parameters:**
- `sheet` (Sheet): Target sheet
- `row` (number): Row number
- `text` (string): Header text
- `width` (number): Number of columns to color
- `options` (Object): Optional — `background`, `fontColor`, `fontWeight`, `fontSize`, `fontFamily`, `fontStyle`, `horizontalAlignment`  
**Returns:** void

---

### `createMergedHeader(sheet, row, text, width, options)`
**Description:** ⚠️ **DEPRECATED** — use `createHeader()` instead. Merges cells across `width` columns and sets text. Kept for backward compatibility.  
**Parameters:** Same as `createHeader()`.  
**Returns:** void

---

### `applyStatusConditionalFormatting(sheet, startRow, startCol, numRows, numCols)`
**Description:** Applies Y/N/A conditional formatting rules (green/red/yellow backgrounds) to a range of cells. Skips if `numRows` or `numCols` is ≤ 0. Avoids duplicate rules by filtering existing rules for the same range.  
**Parameters:**
- `sheet` (Sheet): Target sheet
- `startRow` (number): First row of the range (1-based)
- `startCol` (number): First column of the range (1-based)
- `numRows` (number): Height of range
- `numCols` (number): Width of range  
**Returns:** void

---

### `applySheetBranding(sheet, title, subtitle, width)`
**Description:** Applies standard title/subtitle header rows to a sheet without school-specific branding. Row 1 gets a light blue title, row 2 gets an italic subtitle, and the full sheet font is set to Calibri. For school-specific branding (logos, custom colors), see extension files.  
**Parameters:**
- `sheet` (Sheet): Target sheet
- `title` (string): Row 1 title text
- `subtitle` (string): Row 2 subtitle text
- `width` (number): Number of columns for background  
**Returns:** void

---

### `normalizeStudent(student)`
**Description:** Trims whitespace from all four student fields (`name`, `grade`, `teacher`, `group`). Feature-flagged: returns the original object unchanged if `SITE_CONFIG.features.studentNormalization === false`.  
**Parameters:**
- `student` (Object): Student object with optional string fields  
**Returns:** (Object) Normalized student with trimmed string fields

---

### `setColumnHeaders(sheet, row, headers)`
**Description:** Writes an array of header values to a row with blue background (`COLORS.HEADER_BG`), white text, bold weight, and Calibri font.  
**Parameters:**
- `sheet` (Sheet): Target sheet
- `row` (number): Row number (1-based)
- `headers` (Array\<string\>): Header label values  
**Returns:** void

---

### `calculatePercentage(mapRow, lessonIndices)`
**Description:** Calculates the percentage of lessons passed (Y) out of attempted (Y or N) for a set of lesson indices. Absent (`A`) and blank cells are excluded from both numerator and denominator. Returns `""` if no lessons have been attempted.  
**Parameters:**
- `mapRow` (Array): Full row data from UFLI MAP (0-based)
- `lessonIndices` (Array\<number\>): Lesson numbers to include in calculation  
**Returns:** (number|string) Integer percentage 0–100, or `""` if nothing attempted

---

### System Sheet Generation

### `generateSystemSheets(ss, wizardData)`
**Description:** Orchestrates creation of all five tracking sheets: Small Group Progress, UFLI MAP, Skills Tracker, Grade Summary, and Grade Group sheets. Runs `syncSmallGroupProgress()` at the end to populate initial data if any exists. Called by `saveConfiguration()` in `SetupWizard.gs`.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `wizardData` (Object): Must include `wizardData.students[]` array  
**Returns:** (Object) `{ success: boolean, error?: string }`

---

### `createSmallGroupProgressSheet(ss)`
**Description:** Creates or recreates the `Small Group Progress` log sheet with branding, column headers (Date, Teacher, Group Name, Student Name, Lesson Number, Status), column widths, and 5 frozen header rows.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet  
**Returns:** void

---

### `createUFLIMapSheet(ss, wizardData)`
**Description:** Creates or recreates the `UFLI MAP` sheet with 133 columns (5 metadata + 128 lesson columns). Populates student rows from `wizardData.students`. Applies Y/N/A conditional formatting to all lesson cells.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `wizardData` (Object): Must include `students[]`  
**Returns:** void

---

### `createSkillsSheet(ss, wizardData)`
**Description:** Creates or recreates the `Skills Tracker` sheet with one percentage column per skill section (16 sections from `SKILL_SECTIONS`). Populates student rows.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `wizardData` (Object): Must include `students[]`  
**Returns:** void

---

### `createGradeSummarySheet(ss, wizardData)`
**Description:** Creates or recreates the `Grade Summary` sheet with columns for Foundational %, Min Grade %, Full Grade %, Benchmark Status, and triplets (Initial %, AG%, Total %) for each of the 16 skill sections. Populates student rows.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `wizardData` (Object): Must include `students[]`  
**Returns:** void

---

### `createGradeGroupSheets(ss, wizardData)`
**Description:** Iterates over `wizardData.groups`, groups them by grade, then calls `createSingleGradeSheet()` for each grade (e.g., `KG Groups`, `G1 Groups`).  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `wizardData` (Object): Must include `groups[]` and `students[]`  
**Returns:** void

---

### `createSingleGradeSheet(ss, sheetName, groupNames, allStudents)`
**Description:** Creates or recreates a `[Grade] Groups` sheet. Layout: rows 1–2 are empty spacers; row 3 is the "Instructional Sequence" label row; from row 4, each group block has: header row, column headers, lesson name sub-header, student data rows (with Y/N/A formatting), and a spacer row. Students are filtered from `allStudents` by group assignment.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `sheetName` (string): Sheet name (e.g., `"G3 Groups"`)
- `groupNames` (Array\<string\>): List of group names for this grade
- `allStudents` (Array\<Object\>): Full student roster  
**Returns:** void

---

### Pacing Reports

### `createPacingReports(ss)`
**Description:** Creates or recreates the `Pacing Dashboard` and `Pacing Log` sheets with headers, column definitions, and 5 frozen rows each.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet  
**Returns:** void

---

### `updatePacingReports()`
**Description:** Refreshes pacing data by reading UFLI MAP and Small Group Progress, building lookup maps, scanning all grade sheets via `scanGradeSheetsForPacing()` (or the mixed-grade variant), writing results to dashboard and log sheets, and applying number formatting.  
**Parameters:** none  
**Returns:** void

---

### `buildStudentLookups(mapSheet)`
**Description:** Builds two Maps: `studentCountByGroup` (group name → student count) and `teacherByGroup` (group name → teacher name). If `mapSheet` is provided, reads directly from it; otherwise reads from `Group Configuration` (for counts) and `Grade Summary` (for teachers).  
**Parameters:**
- `mapSheet` (Sheet, optional): UFLI MAP sheet, or `null` to use config sheets  
**Returns:** (Object) `{ studentCountByGroup: Map, teacherByGroup: Map }`

---

### `buildProgressHistory(progressSheet)`
**Description:** Reads the entire `Small Group Progress` sheet and builds a Map keyed by `"groupName|lessonNum"`. Each entry contains `{ Y, N, A, lastDate, recentTeacher }` counts. Used by pacing report generation.  
**Parameters:**
- `progressSheet` (Sheet): The Small Group Progress sheet  
**Returns:** (Map) Progress statistics keyed by `"group|lessonNum"`

---

### `scanGradeSheetsForPacing(ss, lookups, progressMap)`
**Description:** Iterates over all sheets matching `^(PreK|KG|G[1-8]) Groups$`. For each group block found within those sheets, reads the lesson name sub-header row and looks up progress data to build dashboard and log rows.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `lookups` (Object): Result from `buildStudentLookups()`
- `progressMap` (Map): Result from `buildProgressHistory()`  
**Returns:** (Object) `{ dashboardRows: Array[], logRows: Array[] }`

---

### `buildDashboardRow(group, teacher, count, dash)`
**Description:** Constructs a 13-element array for one row of the Pacing Dashboard from accumulated lesson statistics. Calculates expected/actual instructional time (60 min/lesson), pacing %, pass rate, not-passed rate, and absent rate. All rates stored as decimals.  
**Parameters:**
- `group` (string): Group name
- `teacher` (string): Teacher name
- `count` (number): Student count
- `dash` (Object): `{ assigned, tracked, pass, fail, absent, lastEntry, highestLessonName }`  
**Returns:** (Array) 13-element row array

---

### `renderGroupTable(sheet, row, groups)`
**Description:** Renders a 7-column group performance table on the School Summary dashboard. Columns: Group, Grade, Students, Pacing%, PassRate, AbsentRate, Status. Applies number formatting, alternating row colors, and a flagged-groups summary row if any groups have `🔴 Alert` status.  
**Parameters:**
- `sheet` (Sheet): Target sheet
- `row` (number): Starting row
- `groups` (Array\<Array\>): Pacing dashboard rows (13-element arrays)  
**Returns:** (number) Next available row after the table

---

### Data Writing Utilities

### `writeDataToSheet(ss, sheetName, data, startRow)`
**Description:** Clears existing data starting at `startRow` and writes `data` (array of arrays) to the sheet. No-op if the sheet doesn't exist.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `sheetName` (string): Target sheet name
- `data` (Array\<Array\>): Rows to write
- `startRow` (number): Row to start writing at  
**Returns:** void

---

### `formatPacingSheet(ss, sheetName, percentCols, absCol, dataStartRow)`
**Description:** Applies `"0%"` number format to specified columns and `"0"` format to an absolute-value column.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `sheetName` (string): Sheet name
- `percentCols` (Array\<number\>): Column indices to format as percentage
- `absCol` (number): Column index to format as integer (0 to skip)
- `dataStartRow` (number, default=6): First data row  
**Returns:** void

---

### Sync Engine

### `syncSmallGroupProgress()`
**Description:** The main sync function. Reads all data from `Small Group Progress` and `UFLI MAP` in two large bulk reads ("big gulp"), lazily loads only the grade group sheets that are actually referenced in the progress data, then processes every log row to: (A) update UFLI MAP in-memory, (B) update group sheet arrays by exact lesson name match (handling Comprehension/Fluency/non-UFLI lessons), (C) track the highest lesson per student for the Current Lesson column. After processing, writes all changes back in two bulk writes ("big dump"). Chains to `updateAllStats()` from `SharedEngine.gs`.  
**Parameters:** none  
**Returns:** void

---

### `updateGroupArrayByLessonName(groupSheetsData, groupName, studentName, lessonName, status)`
**Description:** Updates a student's status cell in the in-memory group sheet cache by matching the exact lesson name in the sub-header row. Supports both exact name matching and lesson-number fallback matching. Marks the cache entry as `dirty` if a change is made.  
**Parameters:**
- `groupSheetsData` (Object): Cache of loaded group sheet data (`{ sheetName: { sheet, values, dirty } }`)
- `groupName` (string): Group name to locate
- `studentName` (string): Student name to update
- `lessonName` (string): Full lesson name to match in sub-header
- `status` (string): Y, N, or A  
**Returns:** void

---

### `updateGroupArrayInMemory(groupSheetsData, groupName, studentName, lessonNum, status)`
**Description:** Older variant that matches by lesson **number** (not full name). Used when exact lesson name matching is not needed. Otherwise identical to `updateGroupArrayByLessonName()`.  
**Parameters:**
- `groupSheetsData` (Object): Cache of loaded group sheet data
- `groupName` (string): Group name
- `studentName` (string): Student name
- `lessonNum` (number): Lesson number (1–128)
- `status` (string): Y, N, or A  
**Returns:** void

---

### `updateStatsForNewStudents()`
**Description:** Triggers a full `syncSmallGroupProgress()` to recalculate stats for all students, including newly added ones.  
**Parameters:** none  
**Returns:** void

---

### `updateAllProgress()`
**Description:** Calls `syncSmallGroupProgress()` then `updatePacingReports()` and shows a completion alert.  
**Parameters:** none  
**Returns:** void

---

### School Summary Dashboard

### `updateSchoolSummary()`
**Description:** Clears and rebuilds the `School Summary` sheet. Reads student data from Grade Summary, pacing data from Pacing Dashboard, initial data from Initial Assessment, and grade counts from Group Configuration. Renders the header, then one grade card per configured grade. If `ENABLE_MIXED_GRADES` is set, also calls `renderMixedGradeGroupTable()`.  
**Parameters:** none  
**Returns:** void

---

### `renderDashboardHeader(sheet, schoolName)`
**Description:** Renders the 5-row dashboard header: row 1 = main title bar (blue), row 2 = school name + update date, row 3 = merged description text (italic), row 4 = divider line, row 5 = spacer.  
**Parameters:**
- `sheet` (Sheet): School Summary sheet
- `schoolName` (string): School name to display  
**Returns:** (number) Next available row (6)

---

### `renderGradeCard(sheet, startRow, grade, students, groups, initialData, overrideCount)`
**Description:** Renders a complete grade-level summary card consisting of: grade header row, metrics row (growth table), student distribution bars, and optionally a group performance table (if groups are present and mixed grades are disabled). Returns the next available row.  
**Parameters:**
- `sheet` (Sheet): Target sheet
- `startRow` (number): Starting row
- `grade` (string): Grade code (e.g., `"G2"`)
- `students` (Array\<Array\>): Student rows from Grade Summary
- `groups` (Array\<Array\>): Pacing Dashboard rows for this grade
- `initialData` (Map): Initial Assessment data by student name
- `overrideCount` (number, default=null): Override displayed student count  
**Returns:** (number) Next available row after the card

---

### `renderMetricsRow(sheet, row, growth, bands, pace, totalStudents)`
**Description:** Renders a 4-column metrics table showing Foundational, Min Grade, and Full Grade skill averages with Initial/Current/Growth columns. Growth values are color-coded green (>+5%), red (<0%), or default. Returns the next row after the section.  
**Parameters:**
- `sheet` (Sheet): Target sheet
- `row` (number): Starting row
- `growth` (Object): Result from `calculateGrowthMetrics()`
- `bands` (Object): Result from `calculateDistributionBands()`
- `pace` (Object): Result from `calculateGradePacing()`
- `totalStudents` (number): Total student count for the grade  
**Returns:** (number) Next available row

---

### `renderDistributionSection(sheet, row, bands, totalStudents)`
**Description:** Renders three distribution progress bars: On Track (80%+), Progressing (50–79%), Needs Support (<50%). Each bar shows student count and percentage.  
**Parameters:**
- `sheet` (Sheet): Target sheet
- `row` (number): Starting row
- `bands` (Object): `{ onTrack, progressing, atRisk }` counts
- `totalStudents` (number): Total students  
**Returns:** (number) Next available row

---

### `renderProgressBar(sheet, row, label, count, total, accentColor, bgColor)`
**Description:** Renders a single progress bar row. Column 1 = label text; columns 2–4 are merged and display `"N students (XX%)"` in the accent color with a conditional format background; column 5 = filled/half/empty circle indicator.  
**Parameters:**
- `sheet` (Sheet): Target sheet
- `row` (number): Row number
- `label` (string): Bar label
- `count` (number): Students in this band
- `total` (number): Total students
- `accentColor` (string): Hex color for text and indicator
- `bgColor` (string): Hex color for background fill  
**Returns:** (number) `row + 1`

---

### Calculation Helpers

### `calculateGrowthMetrics(students, initialData, grade)`
**Description:** Calculates average initial, current, and growth percentages for the three benchmark tiers (Foundational, Min Grade, Full Grade) across all students in a grade. Uses `GRADE_METRICS` to identify which lessons belong to each tier. Reads current values from Grade Summary columns 4–6 (0-based) and calculates initial values from Initial Assessment data.  
**Parameters:**
- `students` (Array\<Array\>): Student rows from Grade Summary
- `initialData` (Map): Student name → Initial Assessment row
- `grade` (string): Grade code used to look up `GRADE_METRICS`  
**Returns:** (Object) `{ foundInitialAvg, foundCurrentAvg, foundGrowth, minInitialAvg, minCurrentAvg, minGrowth, fullInitialAvg, fullCurrentAvg, fullGrowth, initialAvg, currentAvg, growth }`

---

### `calculateBenchmarkFromRow(row, lessonIndices, denominator)`
**Description:** Simple benchmark calculation for Initial Assessment data. Counts `Y` values only among non-review lessons (review lessons are excluded via `partitionLessonsByReview()`). Does not apply gateway logic. The `denominator` parameter is unused but kept for API compatibility.  
**Parameters:**
- `row` (Array): Student's row data from Initial Assessment
- `lessonIndices` (Array\<number\>): Lesson numbers to include
- `denominator` (number): Unused — kept for API compatibility  
**Returns:** (number) Integer percentage 0–100

---

### `calculateDistributionBands(students)`
**Description:** Counts students into three performance bands based on **Min Grade Skills %** (index 5 in Grade Summary row). Uses `PERFORMANCE_THRESHOLDS.ON_TRACK` (80) and `PERFORMANCE_THRESHOLDS.NEEDS_SUPPORT` (50).  
**Parameters:**
- `students` (Array\<Array\>): Student rows from Grade Summary  
**Returns:** (Object) `{ onTrack, progressing, atRisk }`

---

### `calculateGradePacing(groups)`
**Description:** Calculates the average pacing percentage across all groups by averaging their pacing % values (index 5 in pacing dashboard row). Groups with 0% pacing are excluded.  
**Parameters:**
- `groups` (Array\<Array\>): Pacing Dashboard rows  
**Returns:** (Object) `{ assigned: 0, completed: 0, pacing: number }` where `pacing` is 0–100 integer

---

### Maintenance & Repair Utilities

### `regenerateSystemSheets()`
**Description:** Prompts for confirmation, then recreates all system tracking sheets (UFLI MAP, Skills, Grade Summary, Grade Group sheets, Pacing Reports) and runs a full sync. Preserves Small Group Progress data.  
**Parameters:** none  
**Returns:** void

---

### `fixMissingTeachers()`
**Description:** Scans the Small Group Progress sheet for rows where teacher is blank or "Unknown Teacher", looks up the correct teacher from UFLI MAP by group name, and back-fills the teacher column. Shows a count of fixed rows.  
**Parameters:** none  
**Returns:** void

---

### `repairSkillsTrackerFormulas()`
**Description:** Re-runs `updateAllStats()` to recalculate all Skills Tracker values from UFLI MAP data. Shows completion alert.  
**Parameters:** none  
**Returns:** void

---

### `repairGradeSummaryFormulas()`
**Description:** Re-runs `updateAllStats()` to recalculate all Grade Summary values. Shows completion alert.  
**Parameters:** none  
**Returns:** void

---

### `repairAllFormulas()`
**Description:** Alias for a full `syncSmallGroupProgress()` — recalculates all sheets. Shows completion alert.  
**Parameters:** none  
**Returns:** void

---

### `repairCurrentLessonFormulas()`
**Description:** Re-runs `syncSmallGroupProgress()` to recalculate Current Lesson column values. Shows completion alert.  
**Parameters:** none  
**Returns:** void

---

### `repairUFLIMapFormatting()`
**Description:** Clears all conditional formatting from the UFLI MAP sheet and reapplies Y/N/A color rules to the entire lesson data range.  
**Parameters:** none  
**Returns:** void

---

### `repairAllGroupSheetFormatting()`
**Description:** Iterates all `[Grade] Groups` sheets, finds each group block by detecting "Group" headers followed by "Student Name" rows, and re-applies Y/N/A conditional formatting to the student data cells. Shows a completion alert with count of groups formatted.  
**Parameters:** none  
**Returns:** void

---

### `addSkillFormulasForRow(sheet, row)`
**Description:** **Placeholder** — legacy compatibility function. Data is now populated by `updateAllProgress()` rather than sheet formulas. No-op.  
**Parameters:**
- `sheet` (Sheet): Skills Tracker sheet
- `row` (number): Row number  
**Returns:** void

---

### `addGradeSummaryFormulasForRow(sheet, row, studentObj)`
**Description:** **Placeholder** — legacy compatibility function. Data is now populated by `updateAllProgress()` rather than sheet formulas. No-op.  
**Parameters:**
- `sheet` (Sheet): Grade Summary sheet
- `row` (number): Row number
- `studentObj` (Object): Student data object  
**Returns:** void

---

### Feature-Flagged Functions

### `testGroupSheetStructure()`
**Description:** Diagnostic tool (requires `SITE_CONFIG.features.diagnosticTools = true`). Logs structure information for all grade group sheets to the Apps Script Logger.  
**Parameters:** none  
**Returns:** void (throws if `diagnosticTools` is disabled)

---

### Navigation & Debugging

### `goToSchoolSummary()`
**Description:** Activates the School Summary sheet. If the sheet doesn't exist, calls `updateSchoolSummary()` to create it first.  
**Parameters:** none  
**Returns:** void

---

### `debugSchoolSummary()`
**Description:** Logs Grade Summary sheet existence, row count, and first three data rows. Also logs the total student count and per-grade student counts from the data map. For developer use.  
**Parameters:** none  
**Returns:** void

---

### `debugPacingData()`
**Description:** Logs the full header row (row 5) and first data row (row 6) of the Pacing Dashboard sheet with index annotations. For developer use.  
**Parameters:** none  
**Returns:** void

---

### `getGradeCountsFromConfig(ss)`
**Description:** Reads the `Group Configuration` sheet (rows 8+) to sum the student count per grade from column D. Used by `updateSchoolSummary()` to show correct enrollment counts even when Grade Summary hasn't been synced.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet  
**Returns:** (Object) Grade code → total student count

---

### `testGetExistingLessonData()`
**Description:** Manual test runner. Hard-coded test values (edit before running) call `debugGetExistingLessonData()` and log the full result. For developer use only.  
**Parameters:** none  
**Returns:** void

---

### `debugGetExistingLessonData(gradeSheet, groupName, lessonName)`
**Description:** Verbose debug version of `getExistingLessonData()` that logs every match/mismatch decision with ✓/⚠️/❌ prefixes. Logs all groups found in the sheet and the final result summary.  
**Parameters:**
- `gradeSheet` (string): Sheet name to inspect
- `groupName` (string): Group name to find
- `lessonName` (string): Lesson name to find  
**Returns:** (Object) `{ studentName: "Y"|"N"|"A"|"U" }` for matching entries

---

### `listAllSheetsAndGroups()`
**Description:** Logs all sheets whose names contain "Groups" or "Classroom", showing the first few group header rows found in each. For developer use to verify sheet structure.  
**Parameters:** none  
**Returns:** void
