# MixedGradeSupport.gs

## 📋 Overview

`MixedGradeSupport.gs` is an optional feature module (`features.mixedGradeSupport = true`) that extends the UFLI tracking system to support schools where students are grouped across multiple grade levels based on skill level rather than grade. It lives in `gold-standard-template/modules/MixedGradeSupport.gs`.

**Role in the system:** Standard UFLI deployments have one sheet per grade (e.g., "KG Groups", "G1 Groups"). Mixed-grade sites instead have sheets that span multiple grades (e.g., "G6 to G8 Groups", "SC Classroom"). This module replaces several standard progress-engine functions with mixed-grade-aware equivalents:

| Standard Function (replaced) | Mixed-Grade Replacement |
|-------------------------------|------------------------|
| `getGroupsForForm()` | `getGroupsForForm_MixedGrade()` |
| `getLessonsAndStudentsForGroup()` | `getLessonsAndStudentsForGroup_MixedGrade()` |
| `updateGroupArrayByLessonName()` | `updateGroupArrayByLessonName_MixedGrade()` |
| `scanGradeSheetsForPacing()` | `scanGradeSheetsForPacing_MixedGrade()` |
| `repairAllGroupSheetFormatting()` | `repairAllGroupSheetFormatting_MixedGrade()` |
| `updateSchoolSummary()` | `updateSchoolSummary_MixedGrade()` |

**Sheet format support:** Two layout formats are handled:
- **STANDARD** – group name in column A as a merged header row, followed by a "Student Name" sub-header row, then a lesson-name row, then student data rows. Created by the Setup Wizard.
- **SANKOFA** – legacy layout from Sankofa school; "Student Name" header rows with the group name appearing in column D on the next row.

**Version:** 4.0 – Modular Architecture (Phase 4)

---

## 📜 Business Rules

- **Feature gate:** All primary logic checks `ENABLE_MIXED_GRADES` (derived from `isFeatureEnabled('mixedGradeSupport')`). If false, functions fall back to standard single-grade behaviour.
- **Sheet format is global:** `SHEET_FORMAT` is a module-level constant (`"STANDARD"` or `"SANKOFA"`). Every function branches on this value. **Both formats cannot coexist in the same deployment.**
- **Group discovery priority:** `getGroupsForForm_MixedGrade()` reads groups from the "Group Configuration" sheet first (most reliable), then also scans group sheets to catch any groups not registered there.
- **SC Classroom special handling:** Groups prefixed `"SC Classroom"` are always routed to the "SC Classroom" sheet. This sheet now uses the standard multi-group format.
- **Pre-K groups handled separately:** Any group name containing `"prek"` (case-insensitive) is routed to `getLessonsAndStudentsForPreKGroup()`, which reads from a "Pre-K Data" sheet (data starts at row 6).
- **Best-entry / status update:** `updateGroupArrayByLessonName_MixedGrade()` writes a status value directly into the in-memory data cache (`cache.dirty = true`). The cache must be flushed to the sheet by the calling sync function.
- **Lesson matching:** Lesson name matching uses both exact string match and lesson-number extraction via `extractLessonNumber()` (from Phase2). This handles variant label formats.
- **Natural sort:** Group lists are sorted using `naturalSort()`, which orders numerically prefixed names correctly (e.g., `1 - Smith` < `2 - Jones` < `10 - Adams`).
- **Student distribution thresholds (School Summary):**
  - 🟢 On Track: pass rate ≥ 70%
  - 🟡 Monitor: 50% ≤ pass rate < 70%
  - 🔴 Alert: pass rate < 50%
- **Grade header:** On mixed-grade sites, the School Summary omits the "N groups" count from grade headers.

---

## 📥 Data Inputs

| Source | Detail |
|--------|--------|
| Mixed-grade group sheets | Sheets named per `MIXED_GRADE_CONFIG` (e.g., "G6 to G8 Groups") |
| Standard grade sheets | Sheets matching `^(PreK|KG|G[1-8]) Groups$` |
| "SC Classroom" sheet | Special-needs classroom with multi-group standard format |
| "Pre-K Data" sheet | Pre-K student/group data; data starts at row 6 |
| "Group Configuration" sheet | Column A = group names starting after "Group Name" header |
| "Student Roster" sheet | Grade column used by `buildGradeMetrics()` |
| "UFLI MAP" sheet | Lesson data read by `buildGradeMetrics()` |
| "Site Configuration" sheet | "School Name" row read by `getSiteName()` |
| "Pacing Dashboard" sheet | Pass rate and teacher metrics for group performance section |
| `SITE_CONFIG` / `LAYOUT` | `LAYOUT.LESSONS_PER_GROUP_SHEET`, `COLORS`, `LAYOUT.LESSON_COLUMN_OFFSET` |
| `MIXED_GRADE_CONFIG` (local const) | Default grade-to-sheet mapping; overridden by site configuration sheet at runtime |
| `SANKOFA_COLUMNS` (local const) | Column indices for Sankofa format (0-indexed) |
| Wizard data object | `{ students: [{name, grade, group}] }` — passed to sheet-creation functions |

---

## 📤 Outputs

| Output | Description |
|--------|-------------|
| Lesson entry form data | `getGroupsForForm_MixedGrade()` returns sorted group-name array for dropdown |
| `{lessons, students}` objects | Returned to the lesson entry form by `getLessonsAndStudentsForGroup_MixedGrade()` |
| In-memory cache updates | `updateGroupArrayByLessonName_MixedGrade()` modifies `cache.values` and sets `cache.dirty = true` |
| Pacing dashboard data | `scanGradeSheetsForPacing_MixedGrade()` returns `{ dashboardRows, logRows }` |
| Conditional formatting | `repairAllGroupSheetFormatting_MixedGrade()` writes Y/N/A colour rules to all group sheets |
| Mixed-grade group sheets | `createMixedGradeGroupSheets()` creates/clears and populates group sheets |
| "School Summary" sheet | `updateSchoolSummary_MixedGrade()` rebuilds the entire sheet with grade sections and group performance table |
| Logger output | Extensive `Logger.log()` calls throughout for debugging |

---

## 🔗 Dependencies

### Depends On (calls into)

| File | Functions Used |
|------|---------------|
| `Phase2_ProgressTracking.gs` | `extractLessonNumber()`, `applyStatusConditionalFormatting()`, `createMergedHeader()` |
| `SharedConstants.gs` / `SharedEngine.gs` | `LAYOUT`, `COLORS` constants |
| `SetupWizard.gs` | `createGradeGroupSheets()` (called as fallback when mixed grades disabled), `normalizeStudent()` |
| `SiteConfig_TEMPLATE.gs` | `isFeatureEnabled('mixedGradeSupport')` via `ENABLE_MIXED_GRADES` constant |
| GAS built-ins | `SpreadsheetApp`, `Logger` |

### Used By (called from)

| File | How |
|------|-----|
| `modules/ModuleLoader.gs` | Module auto-loaded when `features.mixedGradeSupport = true` |
| `SetupWizard.gs` | `createMixedGradeGroupSheets()` called instead of `createGradeGroupSheets()` when flag is enabled |
| `Phase2_ProgressTracking.gs` | Mixed-grade replacement functions called instead of standard equivalents |
| `LessonEntryForm.html` | `getGroupsForForm_MixedGrade()` and `getLessonsAndStudentsForGroup_MixedGrade()` called via `google.script.run` |

---

## ⚙️ Function Reference

### `getSheetNameForGrade(grade)`
**Description:** Returns the sheet name that contains groups for the given grade. If mixed grades are enabled, searches `MIXED_GRADE_CONFIG` for a sheet that includes the grade. Falls back to the standard `"<grade> Groups"` pattern.
**Parameters:**
- `grade` (string): Grade code (e.g., `"KG"`, `"G1"`, `"G6"`)

**Returns:** `(string)` Sheet name (e.g., `"G6 to G8 Groups"` or `"KG Groups"`)

---

### `getSheetNameForGroup(groupName)`
**Description:** Locates the sheet that contains a specific group by name. Uses a priority lookup chain: SC Classroom prefix → standard single-grade pattern (if mixed grades disabled) → scan all mixed-grade sheets for group header → scan all standard grade sheets → last-resort scan of every group sheet.
**Parameters:**
- `groupName` (string): The group name to locate (e.g., `"1 - T. Jones"`, `"KG Group 1"`)

**Returns:** `(string|null)` Sheet name, or `null` if not found

---

### `isGroupHeader_Standard(cellValue, data, rowIndex)`
**Description:** Tests whether a cell value in the STANDARD format represents a group header. A cell qualifies if it contains "Group" (but not "Student") and the next row's column A is "Student Name", or if it matches the `"N - Name"` numbered-teacher pattern.
**Parameters:**
- `cellValue` (string): Cell content to test
- `data` (Array<Array>): Full sheet data array
- `rowIndex` (number): 0-based row index of the cell

**Returns:** `(boolean)` `true` if the cell is a group header

---

### `getGroupFromSankofaRow(data, rowIndex)`
**Description:** In SANKOFA format, checks if a row at `rowIndex` is a "Student Name" header row and returns the group name found in column D of the next row. Returns `null` if not a group boundary.
**Parameters:**
- `data` (Array<Array>): Full sheet data array
- `rowIndex` (number): 0-based row index to inspect

**Returns:** `(string|null)` Group name, or `null`

---

### `getGroupsForForm_MixedGrade()`
**Description:** Collects all group names for the Lesson Entry Form dropdown. Reads from the "Group Configuration" sheet first, then scans all mixed-grade and standard grade sheets, and also reads "Pre-K Data" groups from column B. Deduplicates and sorts using `naturalSort()`. Handles both STANDARD and SANKOFA formats.
**Parameters:** None
**Returns:** `(Array<string>)` Sorted array of unique group names

---

### `getLessonsAndStudentsForGroup_MixedGrade(groupName)`
**Description:** Main entry point for fetching lessons and students for the lesson entry form. Routes to sub-handlers based on group name: Pre-K groups → `getLessonsAndStudentsForPreKGroup()`, G6-to-G8 groups → `getLessonsAndStudentsForMixedGradeGroup()`, others → sheet lookup then format-specific parser.
**Parameters:**
- `groupName` (string): Group name

**Returns:** `(Object)` `{ lessons: [{id, name}], students: [string] }` or `{ error: string }`

---

### `getLessonsAndStudentsForSCClassroom()`
**Description:** **Deprecated.** SC Classroom now uses the standard multi-group format. This function logs a warning and falls back to scanning the SC Classroom sheet for the first STANDARD-format group header.
**Parameters:** None
**Returns:** `(Object)` `{ lessons, students }` or `{ error: string }`

---

### `getLessonsAndStudentsForMixedGradeGroup(groupName, sheetName)`
**Description:** Fetches lessons and students from the specified mixed-grade sheet. If the sheet is not found, falls back to `getLessonsAndStudentsFromGradeSheets()`.
**Parameters:**
- `groupName` (string): Group name to locate within the sheet
- `sheetName` (string): Name of the sheet to read (e.g., `"G6 to G8 Groups"`)

**Returns:** `(Object)` `{ lessons, students }` or `{ error: string }`

---

### `getLessonsAndStudentsFromGradeSheets(groupName)`
**Description:** Searches all sheets matching `^(PreK|KG|G[1-8]) Groups$` for the given group name using STANDARD format detection.
**Parameters:**
- `groupName` (string): Group name to search for

**Returns:** `(Object)` `{ lessons, students }` or `{ error: string }`

---

### `getLessonsAndStudents_Sankofa(data, groupName)`
**Description:** Parses SANKOFA-format sheet data to extract lessons (from the row after the "Student Name" header that identifies this group in column D) and students (rows in the block where column D matches the group name).
**Parameters:**
- `data` (Array<Array>): Full sheet data
- `groupName` (string): Target group name

**Returns:** `(Object)` `{ lessons: [{id, name}], students: [string] }` — students sorted alphabetically

---

### `getLessonsAndStudents_Standard(data, groupName)`
**Description:** Parses STANDARD-format sheet data to extract lessons (from the sub-header row containing "UFLI"-prefixed cell values) and students (rows between the group block and the next group header). Detects optional Grade column in column B to adjust lesson start column.
**Parameters:**
- `data` (Array<Array>): Full sheet data
- `groupName` (string): Target group name

**Returns:** `(Object)` `{ lessons: [{id, name}], students: [string] }` — students sorted alphabetically

---

### `getLessonsAndStudentsForPreKGroup(groupName)`
**Description:** Reads "Pre-K Data" sheet (data starts at row 6). Returns students whose column B matches the group name. Returns no lessons (Pre-K uses its own assessment flow).
**Parameters:**
- `groupName` (string): Pre-K group name

**Returns:** `(Object)` `{ lessons: [], students: [string] }` or `{ error: string }`

---

### `updateGroupArrayByLessonName_MixedGrade(groupSheetsData, groupName, studentName, lessonName, status)`
**Description:** Updates the in-memory group sheet cache for the given student/lesson/status. Scans all cached sheets to locate the group (SANKOFA: column D; STANDARD: column A), then delegates to the format-specific update function.
**Parameters:**
- `groupSheetsData` (Object): Cache of `{ sheetName: { values, sheet, dirty } }` objects
- `groupName` (string): Group name
- `studentName` (string): Student name (will be upper-cased for matching)
- `lessonName` (string): Lesson name (will be upper-cased for matching)
- `status` (string): `'Y'`, `'N'`, or `'A'`

**Returns:** `void`

---

### `updateGroupArray_Sankofa(cache, data, groupName, studentName, lessonName, status)`
**Description:** Finds the lesson column in the SANKOFA group block and the matching student row (verifying column D equals `groupName`), then writes the status into the cache data array and marks `cache.dirty = true`.
**Parameters:**
- `cache` (Object): Single sheet cache entry `{ values, sheet, dirty }`
- `data` (Array<Array>): Sheet data (same as `cache.values`)
- `groupName` (string): Target group name
- `studentName` (string): Upper-cased student name
- `lessonName` (string): Upper-cased lesson name
- `status` (string): Status to write

**Returns:** `void`

---

### `updateGroupArray_Standard(cache, data, groupName, studentName, lessonName, status)`
**Description:** Finds the group header row in STANDARD format, locates the lesson column in the sub-header row (2 rows after the group header), then finds the student row and writes the status into the cache.
**Parameters:**
- `cache` (Object): Single sheet cache entry `{ values, sheet, dirty }`
- `data` (Array<Array>): Sheet data
- `groupName` (string): Target group name
- `studentName` (string): Upper-cased student name
- `lessonName` (string): Upper-cased lesson name
- `status` (string): Status to write

**Returns:** `void`

---

### `scanGradeSheetsForPacing_MixedGrade(ss, lookups, progressMap)`
**Description:** Scans all mixed-grade sheets and standard grade sheets to build pacing dashboard and log rows. Routes each sheet to `processPacing_Sankofa()` or `processPacing_Standard()` based on `SHEET_FORMAT`.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `lookups` (Object): `{ studentCountByGroup: Map, teacherByGroup: Map }`
- `progressMap` (Map): Pre-built map of `"groupName|lessonNum"` → `{ Y, N, A, lastDate }`

**Returns:** `(Object)` `{ dashboardRows: Array, logRows: Array }`

---

### `processPacing_Sankofa(sheetData, lookups, progressMap, dashboardRows, logRows)`
**Description:** Processes pacing metrics for a single sheet in SANKOFA format. For each group block, accumulates pass/fail/absent counts per lesson and builds dashboard summary rows. Pushes results into the provided `dashboardRows` and `logRows` arrays.
**Parameters:**
- `sheetData` (Array<Array>): Full sheet data values
- `lookups` (Object): `{ studentCountByGroup, teacherByGroup }`
- `progressMap` (Map): Lesson-level stats
- `dashboardRows` (Array): Mutated — summary rows are pushed here
- `logRows` (Array): Mutated — detail rows are pushed here

**Returns:** `void`

---

### `processPacing_SCClassroom(sheetData, lookups, progressMap, dashboardRows, logRows)`
**Description:** Stub delegating SC Classroom pacing to `processPacing_Standard()`. SC Classroom now uses the standard multi-group format.
**Parameters:** Same as `processPacing_Sankofa()`
**Returns:** `void`

---

### `processPacing_Standard(sheetData, lookups, progressMap, dashboardRows, logRows)`
**Description:** Processes pacing metrics for a single sheet in STANDARD format. Iterates group headers, collects per-lesson stats from `progressMap`, and builds dashboard summary rows.
**Parameters:** Same as `processPacing_Sankofa()`
**Returns:** `void`

---

### `repairAllGroupSheetFormatting_MixedGrade()`
**Description:** Iterates all mixed-grade and standard grade sheets, clears existing conditional format rules, and re-applies Y/N/A colour formatting to each group's student data range via `applyStatusConditionalFormatting()`. Shows a completion alert.
**Parameters:** None
**Returns:** `void`

---

### `formatSheet_Sankofa(sheet, data, lastCol)`
**Description:** Applies Y/N/A conditional formatting to each group block in a SANKOFA-format sheet. Returns a count of groups formatted.
**Parameters:**
- `sheet` (Sheet): Target sheet
- `data` (Array<Array>): Sheet data values
- `lastCol` (number): Last column index (1-based) used for formatting range width

**Returns:** `(number)` Count of groups formatted

---

### `formatSheet_Standard(sheet, data, lastCol)`
**Description:** Applies Y/N/A conditional formatting to each group block in a STANDARD-format sheet. Returns a count of groups formatted.
**Parameters:**
- `sheet` (Sheet): Target sheet
- `data` (Array<Array>): Sheet data values
- `lastCol` (number): Last column index

**Returns:** `(number)` Count of groups formatted

---

### `createMixedGradeGroupSheets(ss, wizardData)`
**Description:** Creates mixed-grade group sheets in STANDARD format for all grade combinations in `MIXED_GRADE_CONFIG`. Falls back to `createGradeGroupSheets()` if mixed grades are disabled.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `wizardData` (Object): Wizard data `{ students: [{name, grade, group}] }`

**Returns:** `void`

---

### `getGroupsForMixedSheet(wizardData, grades)`
**Description:** Filters the wizard students list to those whose grade is in the provided grades array, then returns a deduplicated, naturally-sorted list of group names.
**Parameters:**
- `wizardData` (Object): Wizard data with `students` array
- `grades` (Array<string>): Grade codes to include (e.g., `["G6", "G7", "G8"]`)

**Returns:** `(Array<string>)` Sorted group names for this sheet

---

### `createMixedGradeSheet(ss, sheetName, groupNames, allStudents)`
**Description:** Creates or clears a mixed-grade group sheet in STANDARD format. Writes an "Instructional Sequence" row, then for each group: a merged group header, a "Student Name" column-headers row, a lesson sub-header row, and student data rows (or placeholder). Applies Y/N/A conditional formatting to student data. Column A is 200px wide; top 3 rows are frozen.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `sheetName` (string): Target sheet name
- `groupNames` (Array<string>): Group names to populate
- `allStudents` (Array<Object>): Full wizard student list

**Returns:** `void`

---

### `naturalSort(a, b)`
**Description:** Comparator for sorting strings that may start with a number (e.g., `"1 - Smith"`). Sorts by leading integer first, then lexicographically.
**Parameters:**
- `a` (string): First string
- `b` (string): Second string

**Returns:** `(number)` Negative, zero, or positive

---

### `testMixedGradeConfig()`
**Description:** Diagnostic function. Logs current configuration (`ENABLE_MIXED_GRADES`, `SHEET_FORMAT`, `MIXED_GRADE_CONFIG`), tests `getSheetNameForGrade()` for all grade codes, and invokes `getGroupsForForm_MixedGrade()` to list discovered groups.
**Parameters:** None
**Returns:** `void`

---

### `getGroupsAndSheets_MixedGrade()`
**Description:** Returns all groups organised by sheet name. Scans mixed-grade sheets for STANDARD-format group headers (where next row A = "Student Name"). Returns `{ groups: [allGroupNames], groupsBySheet: {sheetName: [groups]} }`. Used by `LessonEntryForm_MixedGrade.html`.
**Parameters:** None
**Returns:** `(Object)` `{ groups: Array<string>, groupsBySheet: Object }`

---

### `buildGroupPerformanceSection_MixedGrade(ss)`
**Description:** Builds the "Group Performance" section rows for the School Summary. Reads group metrics from the Pacing Dashboard sheet (if available), counts students per group from sheet data, determines status emoji (🟢/🟡/🔴) based on pass rate thresholds (≥70%, 50–70%, <50%), and appends an alert summary if any groups are 🔴.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet

**Returns:** `(Array<Array>)` Rows ready to be written to the School Summary sheet

---

### `getGradeHeaderText_MixedGrade(grade, studentCount)`
**Description:** Returns a formatted grade header string (e.g., `"G6  •  28 students"`) without group count for mixed-grade sites.
**Parameters:**
- `grade` (string): Grade code
- `studentCount` (number): Number of students in this grade

**Returns:** `(string)` Formatted header text

---

### `updateSchoolSummary_MixedGrade()`
**Description:** Complete replacement for `updateSchoolSummary()` for mixed-grade sites. Builds and writes the full School Summary sheet: dashboard title, site name, description, per-grade Growth & Pacing section (Foundational/Min/Full skill metrics), Student Distribution section (On Track/Progressing/Needs Support), and Group Performance table. Calls `applySchoolSummaryFormatting_MixedGrade()` after writing.
**Parameters:** None
**Returns:** `void`

---

### `getDefaultGradeMetrics()`
**Description:** Returns a zeroed-out grade metrics object used as a fallback when no actual data is available.
**Parameters:** None
**Returns:** `(Object)` `{ studentCount, foundInitial, foundCurrent, foundGrowth, minInitial, …, needsSupportPct }`

---

### `formatPercent(value)`
**Description:** Formats a decimal (0–1) as a rounded percentage string (e.g., `0.75` → `"75%"`). Returns `"0%"` for non-numeric input.
**Parameters:**
- `value` (number): Decimal value

**Returns:** `(string)` Percentage string

---

### `formatGrowth(value)`
**Description:** Formats a decimal growth value with a leading `+` for positive values (e.g., `0.05` → `"+5%"`).
**Parameters:**
- `value` (number): Decimal growth value

**Returns:** `(string)` Growth string with sign

---

### `formatDate(date)`
**Description:** Formats a Date object as `"M/D/YYYY"`.
**Parameters:**
- `date` (Date): Date to format

**Returns:** `(string)` Formatted date string

---

### `getSiteName(ss)`
**Description:** Reads the school name from the "Site Configuration" sheet (looks for a row where column A = "School Name"). Falls back to the spreadsheet name prefix before " - ".
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet

**Returns:** `(string)` School name

---

### `getGradesFromConfig(configSheet)`
**Description:** Parses grade codes from the "Group Configuration" sheet's grade column (column B). Handles comma-separated grade values. Returns grades sorted in canonical order (PreK, KG, G1–G8). Falls back to a default list if the sheet is null.
**Parameters:**
- `configSheet` (Sheet|null): Group Configuration sheet

**Returns:** `(Array<string>)` Sorted grade codes

---

### `buildGradeMetrics(ss)`
**Description:** Builds per-grade student count metrics from the Student Roster sheet. Reads the grade column, counts students per grade, and returns a Map with zeroed-out performance metrics (actual skill percentages require data from UFLI MAP — noted as a TODO).
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet

**Returns:** `(Map<string, Object>)` Grade code → metrics object

---

### `applySchoolSummaryFormatting_MixedGrade(sheet, gradeCount)`
**Description:** Applies visual formatting to the School Summary sheet: large bold title, bold site name, bold "Group Performance" header row, and bold column sub-headers.
**Parameters:**
- `sheet` (Sheet): School Summary sheet
- `gradeCount` (number): Number of grade sections (used for layout calculations)

**Returns:** `void`

---

### `renderMixedGradeGroupTable(sheet, row, pacingData)`
**Description:** Renders a group performance table onto the specified sheet starting at the given row, using pacing data for metrics. Applies colour-coded formatting based on performance.
**Parameters:**
- `sheet` (Sheet): Target sheet
- `row` (number): Starting row (1-based)
- `pacingData` (Object): Pacing metrics for groups

**Returns:** `void`

---

### `debugGroupLoading()`
**Description:** Diagnostic function. Calls `getGroupsForForm_MixedGrade()` and logs each group name found. Useful for verifying group discovery without running a full refresh.
**Parameters:** None
**Returns:** `void`
