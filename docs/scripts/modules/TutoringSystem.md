# TutoringSystem.gs (Module)

## 📋 Overview
**Feature Flag:** `SITE_CONFIG.features.tutoringSystem`

`TutoringSystem.gs` implements a **dual-track progress tracking system** that keeps whole-group UFLI instruction and small-group tutoring interventions in separate data streams while ensuring both ultimately feed the master UFLI MAP for unified reporting. It is designed for schools that run parallel tutoring programs (reteach, comprehension, other interventions) alongside the standard UFLI whole-group sequence.

Plain-English summary: *When a teacher submits a lesson for a tutoring group, the form data is written to two places: (1) the Small Group Progress sheet — so the lesson flows into the UFLI MAP just like any other lesson, and (2) the Tutoring Progress Log — so tutoring-specific metrics (reteach pass rate, comprehension count, etc.) are tracked separately. A sync function then aggregates the log into the Tutoring Summary sheet.*

---

## 📜 Business Rules
1. **Routing logic in `saveLessonData()`:**
   - Groups containing the word `"tutoring"` (case-insensitive) → `saveTutoringData()`.
   - Groups prefixed `"PreK"` → `savePreKData()`.
   - All others → `saveStandardUFLIData()`.
2. **Tutoring data is written to both tracks:** Small Group Progress (for UFLI MAP sync) *and* the Tutoring Progress Log (for intervention analytics). Standard UFLI data is written only to Small Group Progress.
3. **Lesson categorisation rules (in `categorizeTutoringLesson()`):**
   - Contains `"comprehension"` → type `"Comprehension"`.
   - Matches `/L\d+/` and contains `"reteach"` → type `"UFLI Reteach"`.
   - Matches `/L\d+/` without `"reteach"` → type `"UFLI New"`.
   - Anything else → type `"Other"`.
4. **Pass rate calculation:** Only `Y` and `N` statuses count as attempts; `A` (absent) inflates *sessions* but not the pass-rate denominator.
5. **Tutoring Summary columns** (13 total): Student Name, Grade, Primary Group, Tutoring Groups, Total Sessions, UFLI Reteach Count, Reteach Pass %, Comprehension Count, Comp Pass %, Other Count, Other Pass %, Overall Pass %, Last Session.
6. **Format crash prevention:** All `setNumberFormat()` calls on the Summary sheet are wrapped in `safeSetNumberFormat()`, which silently skips typed columns to avoid the *"You can't set the number format"* GAS error.
7. Both the Tutoring Progress Log and the Tutoring Summary sheets are auto-created on first sync if they do not exist.

---

## 📥 Data Inputs
| Input | Source | Notes |
|---|---|---|
| `formObject` | Lesson entry form (client-side) | `{groupName, lessonName, teacherName, studentStatuses}` |
| Small Group Progress rows | `SHEET_NAMES_V2.SMALL_GROUP_PROGRESS` | Read during sync for aggregation |
| Tutoring Progress Log rows | `SHEET_NAMES_TUTORING.PROGRESS_LOG` | 7 columns per row |
| Student Roster | `SHEET_NAMES.STUDENT_ROSTER` | For grade and primary group lookup during sync |
| Grade Summary | `SHEET_NAMES_V2.GRADE_SUMMARY` | For combined progress report |
| Pre-K Data matrix | `SHEET_NAMES_PREK.DATA` | Written directly for Pre-K groups |
| Layout constants | `LAYOUT.DATA_START_ROW`, `PREK_CONFIG.*` | From `SharedConstants.gs` |

---

## 📤 Outputs
| Output | Description |
|---|---|
| Sheet: *Tutoring Progress Log* | Append-only log; one row per student-lesson-session |
| Sheet: *Tutoring Summary* | Rebuilt on each sync; one row per tutoring student |
| Sheet: *Small Group Progress* | Tutoring data appended alongside standard UFLI data |
| Sheet: *Pre-K Data* | Cell values written directly for Pre-K submissions |
| Return value `{success, message}` | Returned to the client-side form after every save |
| Logger entries | Debug output from all major operations |

---

## 🔗 Dependencies

### Feature Flag
`SITE_CONFIG.features.tutoringSystem === true`

### Depends On (calls into)
| File / Symbol | Purpose |
|---|---|
| `Phase2_ProgressTracking.gs` → `syncSmallGroupProgress()` | Called after every save to propagate data to UFLI MAP |
| `SharedConstants.gs` → `SHEET_NAMES_V2`, `SHEET_NAMES`, `SHEET_NAMES_PREK` | Sheet name constants |
| `SharedConstants.gs` → `LAYOUT` | `DATA_START_ROW` for roster lookups |
| `SharedConstants.gs` → `PREK_CONFIG` | Header row and data start for Pre-K |
| `SpreadsheetApp` (GAS built-in) | All sheet read/write operations |

### Used By (called from)
| File | Context |
|---|---|
| `ModuleLoader.gs` → `buildFeatureMenu()` | Registers *Tutoring* submenu items |
| `LessonEntryForm.html` (client-side) | Calls `saveLessonData()` via `google.script.run` |
| `SetupWizard.gs` | Can call `createTutoringSheets()` during initial setup |

---

## ⚙️ Function Reference

### `safeSetNumberFormat(sheet, row, col, numRows, format)`
**Description:** Applies a number format to a single-column range, silently swallowing GAS *"Typed Column"* errors. Use in place of direct `setNumberFormat()` calls on the Tutoring Summary sheet.

**Parameters:**
- `sheet` (Sheet): Target sheet.
- `row` (number): Starting row (1-based).
- `col` (number): Column index (1-based).
- `numRows` (number): Number of rows to format.
- `format` (string): GAS number format string (e.g., `"0%"`).

**Returns:** (void)

---

### `isTutoringGroup(groupName)`
**Description:** Returns `true` if `groupName` contains the substring `"tutoring"` (case-insensitive). Used by `saveLessonData()` to route form submissions.

**Parameters:**
- `groupName` (string): Group name from the lesson entry form.

**Returns:** (boolean)

---

### `categorizeTutoringLesson(lessonName)`
**Description:** Classifies a lesson name into one of four tutoring types: `"UFLI Reteach"`, `"UFLI New"`, `"Comprehension"`, or `"Other"`. Also extracts the lesson number for UFLI-type lessons.

**Parameters:**
- `lessonName` (string): Lesson name as submitted (e.g., `"UFLI L42 reteach"`, `"Comprehension"`).

**Returns:** (Object) `{ type: string, lessonNum: number|null }`

---

### `getPrimaryGroupForStudent(studentName)`
**Description:** Looks up a student's primary (non-tutoring) group from the Student Roster sheet. Returns an empty string if the student or sheet is not found.

**Parameters:**
- `studentName` (string): Exact student name as it appears in the roster.

**Returns:** (string) Primary group name, or `""`.

---

### `createTutoringSheets()`
**Description:** Orchestrates creation of both tutoring sheets by calling `createTutoringProgressLogSheet()` and `createTutoringSummarySheet()`. Safe to call multiple times — existing sheets are cleared and rebuilt.

**Parameters:** None.

**Returns:** (void)

---

### `createTutoringProgressLogSheet(ss)`
**Description:** Creates (or clears and rebuilds) the *Tutoring Progress Log* sheet with a title row, subtitle row, and 7 column headers: Date, Teacher, Tutoring Group, Student Name, Lesson Type, Lesson Detail, Status. Applies column widths and freezes header rows.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.

**Returns:** (void)

---

### `createTutoringSummarySheet(ss)`
**Description:** Creates (or clears and rebuilds) the *Tutoring Summary* sheet with a title row, subtitle row, and 13 column headers for aggregated student metrics. Applies column widths and freezes header rows.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.

**Returns:** (void)

---

### `saveLessonData(formObject)`
**Description:** **Master save router.** Inspects the group name and dispatches to `savePreKData()`, `saveTutoringData()`, or `saveStandardUFLIData()` based on routing rules. This function is the primary entry point called from the lesson entry form.

**Parameters:**
- `formObject` (Object): `{ groupName: string, lessonName: string, teacherName: string, studentStatuses: Array<{name, status}> }`

**Returns:** (Object) `{ success: boolean, message: string }`

---

### `savePreKData(formObject)`
**Description:** Writes lesson status values directly into the Pre-K Data matrix sheet by matching student names (rows) to lesson column headers.

**Parameters:**
- `formObject` (Object): Same shape as `saveLessonData()`.

**Returns:** (Object) `{ success: boolean, message: string }`

---

### `saveTutoringData(formObject)`
**Description:** Writes to *both* the Small Group Progress sheet (so UFLI MAP is updated) and the Tutoring Progress Log (for intervention analytics). Calls `syncSmallGroupProgress()` after writing.

**Parameters:**
- `formObject` (Object): Same shape as `saveLessonData()`.

**Returns:** (Object) `{ success: boolean, message: string }`

---

### `saveStandardUFLIData(formObject)`
**Description:** Appends rows to the Small Group Progress sheet and triggers `syncSmallGroupProgress()`. Used for all non-tutoring, non-Pre-K groups.

**Parameters:**
- `formObject` (Object): Same shape as `saveLessonData()`.

**Returns:** (Object) `{ success: boolean, message: string }`

---

### `goToTutoringSummary()`
**Description:** Navigates the active sheet to *Tutoring Summary*. Shows an alert if the sheet does not yet exist.

**Parameters:** None.

**Returns:** (void)

---

### `goToTutoringLog()`
**Description:** Navigates the active sheet to *Tutoring Progress Log*. Shows an alert if the sheet does not yet exist.

**Parameters:** None.

**Returns:** (void)

---

### `syncTutoringProgress()`
**Description:** Reads all rows from the *Tutoring Progress Log*, aggregates session counts and pass rates by student, cross-references the Student Roster for grade and primary group, and writes the aggregated results to the *Tutoring Summary* sheet. Formats pass-rate columns as percentages using `safeSetNumberFormat()`.

**Parameters:** None.

**Returns:** (void)

---

### `syncAllProgress()`
**Description:** Master sync: calls `syncSmallGroupProgress()` (Phase 2 engine) then `syncTutoringProgress()`. Displays a completion alert. Tutoring sync errors are caught and logged without blocking the UFLI sync.

**Parameters:** None.

**Returns:** (void)

---

### `getStudentCombinedProgress(studentName)`
**Description:** Reads both the Grade Summary (UFLI metrics) and the Tutoring Summary (intervention metrics) and merges them into a combined data structure keyed by student name. Pass `null` for `studentName` to return data for all students.

**Parameters:**
- `studentName` (string|null): Exact student name, or `null` for all students.

**Returns:** (Array\<Object\>) Each object contains `name`, `grade`, `primaryGroup`, `ufli` (foundational/min/full/benchmark), and `tutoring` (sessions, pass rates, last session).

---

### `testTutoringSystem()`
**Description:** Developer test function. Logs results for group detection, lesson categorisation, and sheet creation. Run manually from the Apps Script editor to verify the module is functioning correctly.

**Parameters:** None.

**Returns:** (void)
