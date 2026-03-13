# AdminImport.gs (Module)

## 📋 Overview
**Feature Flag:** `SITE_CONFIG.features.adminImport`

`AdminImport.gs` provides a full **historical data import pipeline** for the UFLI Master System. It is used by admins or data coordinators to bulk-load existing lesson data (from a prior system or spreadsheet) into the live UFLI tracking sheets, with validation, exception reporting, and archival built in.

Plain-English summary: *A coordinator pastes or uploads CSV data into an import dialog, chooses whether it is Initial Assessment (baseline) or Lesson Progress (growth) data, runs validation to surface any name mismatches or bad statuses, then clicks Process Import. Valid rows are written to the UFLI MAP (and Initial Assessment sheet for baseline imports), archived to a historical log, and stats are recalculated. Invalid rows are reported in an Exceptions sheet for manual review.*

> **Note:** This is the **module version** located at `gold-standard-template/modules/AdminImport.gs`. It is distinct from any root-level `AdminImport.gs` file and is activated exclusively through the `adminImport` feature flag.

---

## 📜 Business Rules

### Import Types
| Type | What it writes | Use case |
|---|---|---|
| `initial-grid` | UFLI MAP + Initial Assessment sheet | Migrating from a legacy grid-style MAP |
| `initial-row` | UFLI MAP + Initial Assessment sheet | Baseline data in row format |
| `progress` | UFLI MAP only | Ongoing lesson progress catch-up |

### "Best Entry" Deduplication
When multiple rows exist for the same (student, lesson) pair, the import keeps only the single best entry by `STATUS_PRIORITY`: `Y` (3) > `N` (2) > `A` (1). This prevents a passing entry from being overwritten by a later absent entry.

### Validation Rules (in `validateRow()`)
- Student name must not be empty and must exist in the Student Roster.
- Lesson must resolve to a valid lesson number via `extractLessonNumber()`.
- Status must be one of `Y`, `N`, `A` (case-insensitive).

### Formula Injection Prevention
`sanitizeCellValue()` prefixes any cell value beginning with `=`, `+`, `-`, `@`, tab, or carriage return with a single quote to prevent formula injection attacks.

### Post-Import Stats Refresh
Both `processInitialAssessmentImport()` and `processLessonProgressImport()` call `updateAllStats(ss)` from `Phase2_ProgressTracking.gs` after writing data, ensuring Grade Summary and Skills Tracker are immediately recalculated.

### Import Type Persistence
The selected import type is stored in Document Properties (`CURRENT_IMPORT_TYPE`) between the "Upload" and "Process" steps, so the user does not need to re-select it.

---

## 📥 Data Inputs
| Input | Source | Notes |
|---|---|---|
| CSV data string | Import dialog (user upload or paste) | Grid or row format |
| Import type | User radio-button selection in dialog | `initial-grid`, `initial-row`, `progress` |
| Student Roster | `SHEET_NAMES.STUDENT_ROSTER` | Used for name validation |
| UFLI MAP | `SHEET_NAMES_V2.UFLI_MAP` | Target for lesson progress writes |
| `LAYOUT` constants | `SharedConstants.gs` | `DATA_START_ROW`, `LESSON_COLUMN_OFFSET`, `COL_FIRST_LESSON`, `TOTAL_LESSONS` |
| `extractLessonNumber()` | `Phase2_ProgressTracking.gs` | Parses lesson numbers from labels |
| Document Properties | `CURRENT_IMPORT_TYPE` key | Persists import type between steps |

---

## 📤 Outputs
| Output | Description |
|---|---|
| Sheet: *Import Staging* | Cleared and rebuilt with imported rows + validation status column |
| Sheet: *Import Exceptions* | Cleared and rebuilt; rows with validation errors |
| Sheet: *UFLI MAP* | Lesson status values written per valid import row |
| Sheet: *Initial Assessment* | Copied from UFLI MAP (first import); lesson values written for baseline imports |
| Sheet: *Small Group Historical* | Cumulative archive of every processed import batch |
| Recalculated stats | `updateAllStats()` triggered after each successful process run |
| Import dialog UI | HTML modal opened by `showImportDialog()` |

---

## 🔗 Dependencies

### Feature Flag
`SITE_CONFIG.features.adminImport === true`

### Depends On (calls into)
| File / Symbol | Purpose |
|---|---|
| `Phase2_ProgressTracking.gs` → `updateAllStats()` | Recalculates all stats after import |
| `Phase2_ProgressTracking.gs` → `extractLessonNumber()` | Parses lesson numbers from CSV headers / lesson labels |
| `Phase2_ProgressTracking.gs` → `applyStatusConditionalFormatting()` | Re-applies Y/N/A conditional formats in `repairSheetFormatting()` |
| `SharedConstants.gs` → `SHEET_NAMES`, `SHEET_NAMES_V2`, `LAYOUT`, `COLORS` | Sheet name and layout constants |
| `SpreadsheetApp`, `PropertiesService` (GAS built-ins) | Sheet access and import type persistence |

### Used By (called from)
| File | Context |
|---|---|
| `ModuleLoader.gs` → `buildFeatureMenu()` | Registers *Admin Tools* submenu with all import menu items |
| `AdminImport.html` (implicit) | Client-side form calls `importCsvToStaging()` via `google.script.run` |

---

## ⚙️ Function Reference

### `addAdminMenu()`
**Description:** Creates a standalone *🔐 Admin Tools* top-level menu (not a submenu). Use this if `buildFeatureMenu()` is not being used; otherwise the same items are registered by `ModuleLoader.gs`.

**Parameters:** None.

**Returns:** (void)

---

### `showImportDialog()`
**Description:** Opens the import modal dialog (650 × 600 px) by rendering the HTML returned from `getImportDialogHtml()`.

**Parameters:** None.

**Returns:** (void)

---

### `getImportDialogHtml()`
**Description:** Returns the full HTML string for the import dialog. The dialog has three steps: (1) select import type (grid/row initial assessment or lesson progress), (2) view format example, (3) upload CSV or paste text. Client-side JavaScript sends data to `importCsvToStaging()` via `google.script.run`.

**Parameters:** None.

**Returns:** (string) Full HTML document string.

---

### `importCsvToStaging(csvData, importType)`
**Description:** Parses the raw CSV string using the appropriate parser (`parseGridFormat` or `parseRowFormat`), writes rows to the *Import Staging* sheet with headers and a *Validation Status* column (initially `"Pending"`), stores the import type in Document Properties, and navigates to the staging sheet.

**Parameters:**
- `csvData` (string): Raw CSV content as a string.
- `importType` (string): One of `'initial-grid'`, `'initial-row'`, `'progress'`.

**Returns:** (Object) `{ success: boolean, message: string }`

---

### `parseGridFormat(csvData)`
**Description:** Parses a grid-format CSV (one row per student, lessons in columns). Identifies lesson columns by calling `extractLessonNumber()` on each header. Converts each non-empty `Y/N/A` cell into a row-format record `[studentName, today, '', 'UFLI L<n>', status]`.

**Parameters:**
- `csvData` (string): Raw CSV string.

**Returns:** (Array\<Array\>) Row-format records `[name, date, group, lesson, status]`.

---

### `parseRowFormat(csvData)`
**Description:** Parses a row-format CSV. Validates that all required columns (Student, Date, Group, Lesson, Status) are present. Returns an array of 5-element rows.

**Parameters:**
- `csvData` (string): Raw CSV string with header row.

**Returns:** (Array\<Array\>) Row-format records `[name, date, group, lesson, status]`.

---

### `parseCSVLine(line)`
**Description:** Parses a single CSV line respecting quoted fields and both comma and tab delimiters. Applies `sanitizeCellValue()` to each parsed token.

**Parameters:**
- `line` (string): A single line from a CSV file.

**Returns:** (Array\<string\>) Parsed cell values.

---

### `getOrCreateAdminSheet(ss, sheetName)`
**Description:** Returns an existing sheet by name, or creates a new blank sheet if it does not exist.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `sheetName` (string): Target sheet name.

**Returns:** (Sheet)

---

### `sanitizeCellValue(value)`
**Description:** Sanitises a cell value to prevent formula injection. Converts the value to a string, truncates to 32,767 characters, prefixes dangerous leading characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with a single quote, and removes null bytes.

**Parameters:**
- `value` (any): Raw cell value.

**Returns:** (string) Safe string value.

---

### `validateImportData()`
**Description:** Reads all rows from the *Import Staging* sheet, validates each row using `validateRow()`, writes `"✓ Valid"` or `"✗ Error"` to column G, applies conditional formatting, and generates the *Import Exceptions* report. Shows a summary alert with valid/error counts.

**Parameters:** None.

**Returns:** (void)

---

### `buildStudentLookup(ss)`
**Description:** Builds a `Map` from normalised student name → original cased name from the Student Roster sheet. Used by validation to detect name mismatches.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.

**Returns:** (Map\<string, string\>)

---

### `normalizeStudentName(name)`
**Description:** Lowercases, trims, and collapses internal whitespace in a student name for fuzzy matching.

**Parameters:**
- `name` (string): Raw name string.

**Returns:** (string) Normalised name.

---

### `validateRow(rowNum, name, date, group, lesson, status, lookup)`
**Description:** Validates a single staging row. Returns an array of exception objects (empty array = valid). Checks: name present and in roster; lesson parseable; status is Y/N/A.

**Parameters:**
- `rowNum` (number): 1-based row number (for exception reporting).
- `name`, `date`, `group`, `lesson`, `status` (string): Cell values from staging row.
- `lookup` (Map): Output of `buildStudentLookup()`.

**Returns:** (Array\<Object\>) Exception objects `{ row, studentName, issueType, details, rawData }`.

---

### `applyValidationFormatting(sheet, lastRow)`
**Description:** Applies green conditional formatting to rows with `"✓ Valid"` and red formatting to rows with `"✗ Error"` in the Validation Status column.

**Parameters:**
- `sheet` (Sheet): The Import Staging sheet.
- `lastRow` (number): Last data row.

**Returns:** (void)

---

### `createExceptionsReport(ss, exceptions)`
**Description:** Clears and rebuilds the *Import Exceptions* sheet with one row per exception: Row, Student Name, Issue Type, Details, Raw Data.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `exceptions` (Array\<Object\>): Exception objects from `validateImportData()`.

**Returns:** (void)

---

### `goToExceptionsSheet()`
**Description:** Navigates the active sheet to *Import Exceptions*.

**Parameters:** None.

**Returns:** (void)

---

### `processImportData()`
**Description:** Reads valid rows from the *Import Staging* sheet, builds the best-entry map, dispatches to the appropriate import processor, archives the batch to *Small Group Historical*, and shows a completion summary. Prompts for confirmation before writing.

**Parameters:** None.

**Returns:** (void)

---

### `processInitialAssessmentImport(ss, bestEntries, studentLookup)`
**Description:** Writes best-entry lesson statuses to both the *UFLI MAP* and the *Initial Assessment* sheet. Creates the Initial Assessment sheet (as a copy of UFLI MAP with cleared lesson data) if it does not exist. Calls `updateAllStats()` after writing.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `bestEntries` (Map): Output of `buildBestEntryMap()`.
- `studentLookup` (Map): Output of `buildStudentLookup()`.

**Returns:** (Object) `{ processedCount: number, skippedCount: number }`

---

### `processLessonProgressImport(ss, bestEntries, studentLookup)`
**Description:** Writes best-entry lesson statuses to the *UFLI MAP* only. Calls `updateAllStats()` after writing.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `bestEntries` (Map): Output of `buildBestEntryMap()`.
- `studentLookup` (Map): Output of `buildStudentLookup()`.

**Returns:** (Object) `{ processedCount: number, skippedCount: number }`

---

### `createInitialAssessmentSheet(ss, mapSheet)`
**Description:** Copies the UFLI MAP sheet, renames it *Initial Assessment*, sets the title cell to `"INITIAL ASSESSMENT - BASELINE DATA"`, and clears all lesson data cells (preserving student names). Returns the new sheet.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `mapSheet` (Sheet): The UFLI MAP sheet.

**Returns:** (Sheet)

---

### `buildStudentRowLookup(sheet)`
**Description:** Builds a `Map` from normalised student name → row number (1-based) by scanning column A from `DATA_START_ROW`.

**Parameters:**
- `sheet` (Sheet): A student-row sheet (UFLI MAP or Initial Assessment).

**Returns:** (Map\<string, number\>)

---

### `buildBestEntryMap(validRows, studentLookup)`
**Description:** Collapses multiple entries for the same (student, lesson) pair into the single best-status entry using `STATUS_PRIORITY`. Returns a `Map` keyed by `"normName|lessonNum"`.

**Parameters:**
- `validRows` (Array\<Array\>): Valid staging rows from `processImportData()`.
- `studentLookup` (Map): Name normalisation map.

**Returns:** (Map\<string, {studentName, lessonNum, status, priority}\>)

---

### `applyMapUpdates(sheet, updates)`
**Description:** Applies a list of `{row, col, value}` cell updates to a sheet. Groups updates by row but writes each cell individually.

**Parameters:**
- `sheet` (Sheet): Target sheet.
- `updates` (Array\<Object\>): `[{ row, col, value }]`

**Returns:** (void)

---

### `repairSheetFormatting(sheet)`
**Description:** Re-applies Y/N/A conditional formatting to the sheet using `applyStatusConditionalFormatting()` from Phase 2, if that function is available. No-op otherwise.

**Parameters:**
- `sheet` (Sheet): Target sheet (UFLI MAP or Initial Assessment).

**Returns:** (void)

---

### `archiveToHistorical(ss, validRows, studentLookup, importType)`
**Description:** Appends all valid rows from the current import batch to the *Small Group Historical* sheet, tagged with the import date and type. Creates the sheet with headers if it does not exist.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `validRows` (Array\<Array\>): Valid rows from the staging sheet.
- `studentLookup` (Map): Used to resolve canonical student names.
- `importType` (string): `'initial'` or `'progress'`.

**Returns:** (void)

---

### `clearImportStaging()`
**Description:** Clears both the *Import Staging* and *Import Exceptions* sheets after confirming with the user, and removes the `CURRENT_IMPORT_TYPE` Document Property.

**Parameters:** None.

**Returns:** (void)

---

### `refreshGradeSummaryFormulas()`
**Description:** Calls `updateAllStats(ss)` from `Phase2_ProgressTracking.gs` to force a full recalculation of all statistics. Provides a fallback manual-recalc path outside the normal import workflow.

**Parameters:** None.

**Returns:** (void)
