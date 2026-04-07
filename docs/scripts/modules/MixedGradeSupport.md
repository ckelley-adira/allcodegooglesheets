# MixedGradeSupport.gs (Module)

## 📋 Overview
**Feature Flag:** `SITE_CONFIG.features.mixedGradeSupport`

`MixedGradeSupport.gs` extends the UFLI Master System to support schools that group students by **skill level across multiple grade levels** (e.g., K+G1, G2+G3, G6+G7+G8) rather than by a single grade. It replaces or augments several functions from `Phase2_ProgressTracking.gs` and `SetupWizard.gs` to handle multi-grade sheet layouts.

Plain-English summary: *In a standard UFLI deployment each grade has its own groups sheet. In a mixed-grade deployment, two or more grade levels share a single sheet (e.g., "G6 to G8 Groups"). This module provides all the routing, form-population, sync, pacing, formatting, and sheet-creation logic needed to make that work transparently. It supports two physical sheet formats: **STANDARD** (group name in column A, followed by a "Student Name" row) and **SANKOFA** (group name in column D of the row following a "Student Name" header).*

> **Note:** This is the **module version** at `gold-standard-template/modules/MixedGradeSupport.gs`. It differs from any root-level `MixedGradeSupport.gs` and is activated exclusively through the `mixedGradeSupport` feature flag.

---

## 📜 Business Rules

### Sheet Formats
| Format | Group header location | Used for |
|---|---|---|
| `STANDARD` | Column A, merged cell above "Student Name" row | New sheets created by Setup Wizard |
| `SANKOFA` | Column D of the row immediately after a "Student Name" header | Legacy Sankofa-format sheets |

### Group Routing
- `getSheetNameForGroup()` first checks for `"SC Classroom"` prefix, then searches `MIXED_GRADE_CONFIG` sheets by scanning for the group name, then falls back to standard `"<grade> Groups"` naming, then performs a last-resort scan of all group sheets.
- A lesson entry form call to `getLessonsAndStudentsForGroup_MixedGrade()` dispatches to `getLessonsAndStudents_Sankofa()` or `getLessonsAndStudents_Standard()` based on `SHEET_FORMAT`.
- `getGroupsForForm_MixedGrade()` reads groups from *Group Configuration* first (authoritative), then supplements from all group sheets, Pre-K Data, and standard grade sheets.

### Mixed-Grade Config
- `MIXED_GRADE_CONFIG` is a static default map `{ sheetName: [grades] }` that is **overridden at runtime** by the Site Configuration sheet (row 16: "Allow Grade Mixing" + "Mixed Grade Combinations").
- Grade combinations are stored as `"G6+G7+G8, G1+G2+G3+G4"` (comma-separated, `+`-joined).

### Backward Compatibility
- `ENABLE_MIXED_GRADES` is a module-level constant that reads `isFeatureEnabled('mixedGradeSupport')` at load time. Legacy callers that reference this constant directly continue to work.
- `getLessonsAndStudentsForSCClassroom()` and `processPacing_SCClassroom()` are deprecated and redirect to the Standard format handlers.

### Natural Sort
Group names starting with a number (e.g., `"1 - Jones"`, `"12 - Smith"`) are sorted numerically by leading digit, then lexicographically, via `naturalSort()`.

---

## 📥 Data Inputs
| Input | Source | Notes |
|---|---|---|
| `MIXED_GRADE_CONFIG` | Module constant + Site Configuration sheet (runtime override) | `{ sheetName: grades[] }` |
| `SHEET_FORMAT` | Module constant (`"STANDARD"` or `"SANKOFA"`) | Change once per deployment |
| Group sheets | Sheets matching `MIXED_GRADE_CONFIG` keys or `"<grade> Groups"` pattern | Scanned for group blocks |
| Group Configuration sheet | Sheet: `"Group Configuration"` | Authoritative group list for form |
| Pre-K Data sheet | Sheet: `"Pre-K Data"` | Column B = Pre-K group name |
| `lookups` parameter | Caller-provided | `{ studentCountByGroup: Map, teacherByGroup: Map }` |
| `progressMap` parameter | Caller-provided | `Map<"groupName|lessonNum", {Y,N,A,lastDate}>` |
| `wizardData` | Setup Wizard form data | `{ students: [{name, grade, group}] }` |

---

## 📤 Outputs
| Output | Description |
|---|---|
| Array of group names | `getGroupsForForm_MixedGrade()` → sorted group list for lesson entry form |
| `{lessons, students}` object | `getLessonsAndStudentsForGroup_MixedGrade()` → populates form dropdowns |
| Updated cache (`dirty=true`) | `updateGroupArrayByLessonName_MixedGrade()` → marks in-memory data changed |
| `{dashboardRows, logRows}` | `scanGradeSheetsForPacing_MixedGrade()` → written to Pacing Dashboard + Log |
| Formatted group sheets | `repairAllGroupSheetFormatting_MixedGrade()` → Y/N/A conditional formatting applied |
| New mixed-grade sheets | `createMixedGradeGroupSheets()` → creates STANDARD-format sheets per wizard data |
| School Summary section | `buildGroupPerformanceSection_MixedGrade()` → group performance block |
| School Summary sheet | `updateSchoolSummary_MixedGrade()` → fully rebuilt school-level summary |
| `{groups, groupsBySheet}` | `getGroupsAndSheets_MixedGrade()` → grouped by sheet for advanced form UI |

---

## 🔗 Dependencies

### Feature Flag
`SITE_CONFIG.features.mixedGradeSupport === true`

### Depends On (calls into)
| File / Symbol | Purpose |
|---|---|
| `UnifiedConfig.gs` → `isFeatureEnabled()` | Sets `ENABLE_MIXED_GRADES` at load time |
| `Phase2_ProgressTracking.gs` → `extractLessonNumber()` | Parse lesson numbers during pacing scan |
| `Phase2_ProgressTracking.gs` → `applyStatusConditionalFormatting()` | Applied by `formatSheet_*` and `repairAllGroupSheetFormatting_MixedGrade()` |
| `Phase2_ProgressTracking.gs` → `buildDashboardRow()` | Constructs pacing dashboard row objects |
| `Phase2_ProgressTracking.gs` → `createGradeGroupSheets()` | Fallback when `ENABLE_MIXED_GRADES` is false |
| `SharedConstants.gs` → `LAYOUT` | `DATA_START_ROW`, `LESSONS_PER_GROUP_SHEET` |
| `SpreadsheetApp` (GAS built-in) | All sheet operations |

### Used By (called from)
| File | Context |
|---|---|
| `ModuleLoader.gs` → `getGradeList()`, `getSheetNameForGradeCode()` | Grade-to-sheet routing |
| `Phase2_ProgressTracking.gs` → `syncSmallGroupProgress()` | Replaces standard pacing/update functions |
| `SetupWizard.gs` → `saveConfiguration()` | Calls `createMixedGradeGroupSheets()` instead of standard sheet creation |
| `LessonEntryForm.html` | Calls `getGroupsForForm_MixedGrade()` and `getLessonsAndStudentsForGroup_MixedGrade()` |

---

## ⚙️ Function Reference

### `getSheetNameForGrade(grade)`
**Description:** Returns the physical sheet name for a given grade code. Checks `MIXED_GRADE_CONFIG` for any sheet that includes this grade; falls back to `"<grade> Groups"`.

**Parameters:**
- `grade` (string): Grade code (e.g., `"G6"`, `"KG"`).

**Returns:** (string) Sheet name.

---

### `getSheetNameForGroup(groupName)`
**Description:** Resolves a group name to its physical sheet name. Handles SC Classroom prefix, MIXED_GRADE_CONFIG scan (for both STANDARD and SANKOFA formats), standard grade-prefix fallback, and a last-resort full-spreadsheet scan.

**Parameters:**
- `groupName` (string): Group name (e.g., `"1 - T. Jones"`, `"G3 Group 1"`).

**Returns:** (string|null) Sheet name, or `null` if not found.

---

### `isGroupHeader_Standard(cellValue, data, rowIndex)`
**Description:** Returns `true` if `cellValue` matches a STANDARD format group header: contains `"Group"` (but not `"Student"`) followed by a `"Student Name"` row, **or** matches a `"N - Teacher"` numbered pattern followed by a `"Student Name"` row.

**Parameters:**
- `cellValue` (string): The cell value to test.
- `data` (Array\<Array\>): Full sheet data array.
- `rowIndex` (number): 0-based row index of `cellValue`.

**Returns:** (boolean)

---

### `getGroupFromSankofaRow(data, rowIndex)`
**Description:** In SANKOFA format, checks if the row at `rowIndex` is a `"Student Name"` header and, if so, returns the group name from column D of the next row.

**Parameters:**
- `data` (Array\<Array\>): Full sheet data array.
- `rowIndex` (number): 0-based index to check.

**Returns:** (string|null) Group name, or `null`.

---

### `getGroupsForForm_MixedGrade()`
**Description:** Collects all group names for the lesson entry form dropdown. Priority: (1) Group Configuration sheet, (2) mixed-grade sheets (SANKOFA or STANDARD scan), (3) standard grade sheets, (4) Pre-K Data sheet. Returns a `naturalSort`-ed, deduplicated array.

**Parameters:** None.

**Returns:** (Array\<string\>) Sorted group names.

---

### `getLessonsAndStudentsForGroup_MixedGrade(groupName)`
**Description:** Returns the lesson list and student list for a given group. Routes to PreK helper, mixed-grade sheet helper, Sankofa parser, or Standard parser based on group name and `SHEET_FORMAT`.

**Parameters:**
- `groupName` (string): Group name from the lesson entry form.

**Returns:** (Object) `{ lessons: Array<{id, name}>, students: string[] }` or `{ error: string }`

---

### `getLessonsAndStudentsForSCClassroom()`
**Description:** **Deprecated.** SC Classroom now uses STANDARD multi-group format. Calls the STANDARD scanner and returns the first group found.

**Parameters:** None.

**Returns:** (Object) `{ lessons, students }` or `{ error }`.

---

### `getLessonsAndStudentsForMixedGradeGroup(groupName, sheetName)`
**Description:** Reads the specified mixed-grade sheet and delegates to `getLessonsAndStudents_Standard()`. Falls back to `getLessonsAndStudentsFromGradeSheets()` if the sheet is not found.

**Parameters:**
- `groupName` (string): Group name.
- `sheetName` (string): Expected sheet name (e.g., `"G6 to G8 Groups"`).

**Returns:** (Object) `{ lessons, students }` or `{ error }`.

---

### `getLessonsAndStudentsFromGradeSheets(groupName)`
**Description:** Searches all standard-pattern grade sheets (`"<grade> Groups"`) for the group, returning the first match found.

**Parameters:**
- `groupName` (string): Group name.

**Returns:** (Object) `{ lessons, students }` or `{ error }`.

---

### `getLessonsAndStudents_Sankofa(data, groupName)`
**Description:** Parses SANKOFA-format sheet data for a specific group. Finds the group's lesson row (column E onward) and collects student names from subsequent rows where column D matches the group name.

**Parameters:**
- `data` (Array\<Array\>): Full sheet data.
- `groupName` (string): Target group name.

**Returns:** (Object) `{ lessons: Array<{id, name}>, students: string[] }`

---

### `getLessonsAndStudents_Standard(data, groupName)`
**Description:** Parses STANDARD-format sheet data for a specific group. Locates the group header, reads lesson names from the sub-header row (row after "Student Name"), and collects student rows. Detects optional Grade column (column B).

**Parameters:**
- `data` (Array\<Array\>): Full sheet data.
- `groupName` (string): Target group name.

**Returns:** (Object) `{ lessons: Array<{id, name}>, students: string[] }`

---

### `getLessonsAndStudentsForPreKGroup(groupName)`
**Description:** Reads the *Pre-K Data* sheet and returns students whose column B group name matches `groupName`. Returns an empty lessons array (Pre-K lessons are not UFLI-numbered).

**Parameters:**
- `groupName` (string): Pre-K group name.

**Returns:** (Object) `{ lessons: [], students: string[] }`

---

### `updateGroupArrayByLessonName_MixedGrade(groupSheetsData, groupName, studentName, lessonName, status)`
**Description:** Replacement for `updateGroupArrayByLessonName()`. Finds the correct sheet in the `groupSheetsData` cache for this group (SANKOFA: scans column D; STANDARD: scans column A), then delegates to the appropriate format updater. Sets `cache.dirty = true` when a cell is changed.

**Parameters:**
- `groupSheetsData` (Object): Cache map `{ sheetName: { values, dirty } }`.
- `groupName` (string): Target group name.
- `studentName` (string): Student name (uppercased for matching).
- `lessonName` (string): Lesson name (uppercased for matching).
- `status` (string): `"Y"`, `"N"`, or `"A"`.

**Returns:** (void)

---

### `updateGroupArray_Sankofa(cache, data, groupName, studentName, lessonName, status)`
**Description:** Updates a cell in SANKOFA-format data. Finds the group's lesson header row, locates the lesson column by exact match or lesson number, then finds and updates the student's status cell. Sets `cache.dirty = true`.

**Parameters:**
- `cache` (Object): Sheet cache entry `{ values, dirty }`.
- `data` (Array\<Array\>): Mutable values array from the cache.
- `groupName`, `studentName`, `lessonName`, `status` (string): As described above.

**Returns:** (void)

---

### `updateGroupArray_Standard(cache, data, groupName, studentName, lessonName, status)`
**Description:** Updates a cell in STANDARD-format data. Locates the group header row, reads the sub-header row for the lesson column, then finds and updates the student's status cell. Sets `cache.dirty = true`.

**Parameters:**
- `cache` (Object): Sheet cache entry `{ values, dirty }`.
- `data` (Array\<Array\>): Mutable values array from the cache.
- `groupName`, `studentName`, `lessonName`, `status` (string): As described above.

**Returns:** (void)

---

### `scanGradeSheetsForPacing_MixedGrade(ss, lookups, progressMap)`
**Description:** Replacement for `scanGradeSheetsForPacing()`. Builds the list of sheets to scan (mixed-grade + SC Classroom + standard grade sheets) and dispatches each to the appropriate pacing processor (`processPacing_Sankofa` or `processPacing_Standard`).

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `lookups` (Object): `{ studentCountByGroup: Map, teacherByGroup: Map }`.
- `progressMap` (Map): `"groupName|lessonNum" → {Y,N,A,lastDate}`.

**Returns:** (Object) `{ dashboardRows: Array, logRows: Array }`

---

### `processPacing_Sankofa(sheetData, lookups, progressMap, dashboardRows, logRows)`
**Description:** Processes pacing data from a SANKOFA-format sheet. For each group block found, reads lesson columns, cross-references `progressMap`, and pushes rows into `dashboardRows` and `logRows`.

**Parameters:**
- `sheetData` (Array\<Array\>): Full sheet values.
- `lookups`, `progressMap`, `dashboardRows`, `logRows`: See `scanGradeSheetsForPacing_MixedGrade`.

**Returns:** (void)

---

### `processPacing_SCClassroom(sheetData, lookups, progressMap, dashboardRows, logRows)`
**Description:** **Deprecated.** Redirects to `processPacing_Standard()`.

**Parameters:** Same as `processPacing_Sankofa`.

**Returns:** (void)

---

### `processPacing_Standard(sheetData, lookups, progressMap, dashboardRows, logRows)`
**Description:** Processes pacing data from a STANDARD-format sheet. For each group header found, reads the lesson sub-header row (row `i+2`), cross-references `progressMap`, and pushes rows into `dashboardRows` and `logRows`.

**Parameters:** Same as `processPacing_Sankofa`.

**Returns:** (void)

---

### `repairAllGroupSheetFormatting_MixedGrade()`
**Description:** Replacement for `repairAllGroupSheetFormatting()`. Clears and re-applies Y/N/A conditional formatting to all mixed-grade and standard-grade sheets. Shows a completion alert with the number of groups formatted.

**Parameters:** None.

**Returns:** (void)

---

### `formatSheet_Sankofa(sheet, data, lastCol)`
**Description:** Applies `applyStatusConditionalFormatting()` to all student data regions in a SANKOFA-format sheet.

**Parameters:**
- `sheet` (Sheet): The group sheet.
- `data` (Array\<Array\>): Full sheet values.
- `lastCol` (number): Last used column.

**Returns:** (number) Count of groups formatted.

---

### `formatSheet_Standard(sheet, data, lastCol)`
**Description:** Applies `applyStatusConditionalFormatting()` to all student data regions in a STANDARD-format sheet.

**Parameters:**
- `sheet` (Sheet): The group sheet.
- `data` (Array\<Array\>): Full sheet values.
- `lastCol` (number): Last used column.

**Returns:** (number) Count of groups formatted.

---

### `createMixedGradeGroupSheets(ss, wizardData)`
**Description:** Replacement for `createGradeGroupSheets()` during Setup Wizard onboarding. For each entry in `MIXED_GRADE_CONFIG`, collects groups from `wizardData.students` for the relevant grades and creates a STANDARD-format sheet. Falls through to `createGradeGroupSheets()` if `ENABLE_MIXED_GRADES` is false.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `wizardData` (Object): `{ students: [{name, grade, group}] }`.

**Returns:** (void)

---

### `getGroupsForMixedSheet(wizardData, grades)`
**Description:** Extracts the deduplicated, sorted list of group names from `wizardData.students` whose grade is in `grades`.

**Parameters:**
- `wizardData` (Object): Wizard form data.
- `grades` (Array\<string\>): Grades for this mixed sheet.

**Returns:** (Array\<string\>) Sorted group names.

---

### `createMixedGradeSheet(ss, sheetName, groupNames, allStudents)`
**Description:** Creates or clears a STANDARD-format mixed-grade sheet with one block per group (group header row → "Student Name" sub-header → lesson row → student rows). Applies base formatting.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `sheetName` (string): Target sheet name.
- `groupNames` (Array\<string\>): Groups to include.
- `allStudents` (Array\<Object\>): All wizard students (filtered by group membership inside function).

**Returns:** (void)

---

### `naturalSort(a, b)`
**Description:** Comparator for sorting strings that begin with numbers numerically (e.g., `"1 - Jones"` before `"2 - Smith"` before `"10 - Lee"`), then lexicographically.

**Parameters:**
- `a`, `b` (string): Strings to compare.

**Returns:** (number) Negative, zero, or positive for sort ordering.

---

### `testMixedGradeConfig()`
**Description:** Developer diagnostic. Logs `ENABLE_MIXED_GRADES`, `SHEET_FORMAT`, the full `MIXED_GRADE_CONFIG`, grade-to-sheet mapping for all grades PreK–G6, and the complete group list from `getGroupsForForm_MixedGrade()`.

**Parameters:** None.

**Returns:** (void)

---

### `getGroupsAndSheets_MixedGrade()`
**Description:** Returns all groups organised by sheet name — useful for an advanced lesson entry form UI that groups the dropdown by sheet. Scans mixed-grade sheets, standard grade sheets, and SC Classroom.

**Parameters:** None.

**Returns:** (Object) `{ groups: string[], groupsBySheet: { sheetName: string[] } }`

---

### `buildGroupPerformanceSection_MixedGrade(ss)`
**Description:** Reads all group sheets (mixed + standard) and builds the group performance section data for the School Summary sheet, returning an array of section rows.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.

**Returns:** (Array\<Array\>) Section rows for `updateSchoolSummary_MixedGrade()`.

---

### `getGradeHeaderText_MixedGrade(grade, studentCount)`
**Description:** Returns the display text for a grade header in the School Summary (e.g., `"Grade 3 (12 students)"`), handling mixed-grade sheet name formatting.

**Parameters:**
- `grade` (string): Grade code.
- `studentCount` (number): Number of students in this grade.

**Returns:** (string) Formatted header text.

---

### `updateSchoolSummary_MixedGrade()`
**Description:** Replacement for `updateSchoolSummary()`. Rebuilds the *School Summary* sheet with grade-level and group-level performance metrics for mixed-grade sites. Calls `buildGradeMetrics()` and `buildGroupPerformanceSection_MixedGrade()`.

**Parameters:** None.

**Returns:** (void)

---

### `getDefaultGradeMetrics()`
**Description:** Returns a default metrics object with zeroed/empty values used as a fallback when grade data is unavailable.

**Parameters:** None.

**Returns:** (Object) Default grade metrics shape.

---

### `formatPercent(value)` / `formatGrowth(value)` / `formatDate(date)`
**Description:** Utility formatters for displaying percentages, growth values (with `+`/`-` prefix), and dates in the School Summary.

**Parameters:**
- `value` (number): Numeric value.
- `date` (Date): Date value.

**Returns:** (string) Formatted string.

---

### `getSiteName(ss)`
**Description:** Reads the site name from the Site Configuration sheet or falls back to the spreadsheet name.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.

**Returns:** (string)

---

### `getGradesFromConfig(configSheet)`
**Description:** Reads the list of enabled grades from the Site Configuration sheet.

**Parameters:**
- `configSheet` (Sheet): The configuration sheet.

**Returns:** (Array\<string\>) Grade codes.

---

### `buildGradeMetrics(ss)`
**Description:** Reads Grade Summary data and computes per-grade aggregate metrics (student count, foundational/min/full-grade averages, benchmark distribution).

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.

**Returns:** (Object) `{ gradeCode: metrics }` map.

---

### `applySchoolSummaryFormatting_MixedGrade(sheet, gradeCount)`
**Description:** Applies formatting (fonts, borders, column widths, freeze) to the School Summary sheet after data is written.

**Parameters:**
- `sheet` (Sheet): The School Summary sheet.
- `gradeCount` (number): Number of grade sections written.

**Returns:** (void)

---

### `renderMixedGradeGroupTable(sheet, row, pacingData)`
**Description:** Renders a formatted pacing table for a mixed-grade group section in the School Summary sheet.

**Parameters:**
- `sheet` (Sheet): School Summary sheet.
- `row` (number): Starting row.
- `pacingData` (Array): Group pacing rows.

**Returns:** (number) Next available row.

---

### `debugGroupLoading()`
**Description:** Developer diagnostic. Logs the complete output of `getGroupsForForm_MixedGrade()` with timing, and tests `getLessonsAndStudentsForGroup_MixedGrade()` for the first group found.

**Parameters:** None.

**Returns:** (void)
