# AdminImport.gs

## 📋 Overview

This document covers the root-level `gold-standard-template/AdminImport.gs` file, which provides bulk data import capabilities for migrating historical assessment records into the UFLI tracking system. It is distinct from the separate module-level file at `gold-standard-template/modules/AdminImport.gs`.

**Role in the system:** When a school switches to this system mid-year or needs to load prior-year data, admins use this module to import either **Initial Assessment** (baseline) data or **Lesson Progress** (growth) data from a CSV file. The workflow is:

1. Open the import dialog → paste or upload CSV
2. Data is parsed and written to a "staging" sheet
3. Admin runs validation → exceptions are flagged in a separate sheet
4. Admin reviews exceptions, then runs Process Import
5. Valid rows are written to UFLI MAP and (for initial assessments) an Initial Assessment snapshot sheet
6. An archive copy is appended to a historical log sheet
7. Stats are recalculated via `updateAllStats()` from Phase2

**Version:** 4.0 – Modular Architecture (Phase 4)

---

## 📜 Business Rules

- **Import types:** Two mutually exclusive types per import session:
  - `Initial Assessment` – baseline scores; written to both UFLI MAP and a cloned "Initial Assessment" sheet
  - `Lesson Progress` – growth data; written to UFLI MAP only
- **CSV formats supported:**
  - *Row format* – one row per student/lesson combination: `Student, Date, Group, Lesson, Status`
  - *Grid format* – student-per-row with lesson columns (e.g., `UFLI L1`, `UFLI L2`, …); date defaults to today
- **Valid status values:** `Y` (passed), `N` (not passed), `A` (absent) — case-insensitive on input, stored upper-case
- **Best-entry deduplication:** If the same student/lesson pair appears multiple times across valid rows, the highest-priority status wins: `Y > N > A`
- **Validation rules per row:**
  - Student name must be non-empty and exist in the Student Roster sheet
  - Lesson must parse to a valid lesson number via `extractLessonNumber()`
  - Status must be `Y`, `N`, or `A`
- **Formula injection prevention:** All cell values are passed through `sanitizeCellValue()` before being written. Strings starting with `=`, `+`, `-`, `@`, tab, or CR are prefixed with a single quote; null bytes are stripped; length is capped at 32,767 characters.
- **No partial commits:** Only rows flagged `✓ Valid` in the staging sheet are processed; rows marked `✗ Error` are skipped.
- **Post-import recalculation:** After every successful import, `updateAllStats(ss)` is called from `Phase2_ProgressTracking.gs` to refresh all skill and grade summary statistics.
- **Staging cleared only on explicit request:** The "Clear Import Staging" action wipes both the staging and exceptions sheets and removes the stored import type from Document Properties.

---

## 📥 Data Inputs

| Source | Detail |
|--------|--------|
| CSV text (dialog) | Pasted or file-uploaded; row or grid format |
| `Import Staging` sheet | Written by `importCsvToStaging()`, read by `validateImportData()` and `processImportData()` |
| `Student Roster` sheet | Column A, from `LAYOUT.DATA_START_ROW` — used to build the student name lookup |
| `UFLI MAP` sheet | Row lookup by normalised student name; updated during process |
| `Initial Assessment` sheet | Created from UFLI MAP clone on first initial-type import |
| `SITE_CONFIG` / `LAYOUT` | `LAYOUT.DATA_START_ROW`, `LAYOUT.LESSON_COLUMN_OFFSET`, `LAYOUT.COL_CURRENT_LESSON`, `LAYOUT.COL_FIRST_LESSON`, `LAYOUT.TOTAL_LESSONS` |
| Document Properties | `CURRENT_IMPORT_TYPE` — persists import type across validate/process calls |

**User interactions:**
- Selecting import type (Initial Assessment vs Lesson Progress) in the dialog
- Uploading a CSV file or pasting CSV text
- Confirming the "Process Import" action (YES/NO alert)
- Clicking "Validate", "Process", "Clear Staging", "View Exceptions", or "Refresh Grade Summary" from the Admin Tools menu

---

## 📤 Outputs

| Output | Description |
|--------|-------------|
| `Import Staging` sheet | Parsed rows with headers + `Import Type` and `Validation Status` columns; conditional formatting (green = valid, red = error) |
| `Import Exceptions` sheet | Tabular report of every validation error: row number, student name, issue type, details, raw data |
| `UFLI MAP` sheet | Lesson status cells updated for each valid student/lesson pair |
| `Initial Assessment` sheet | Created (if needed) and updated — a snapshot of baseline scores |
| `Small Group Historical` sheet | Appended with all valid import rows plus import date/type metadata |
| Stats recalculation | `updateAllStats(ss)` writes refreshed skill averages and grade summaries |
| UI alerts | Validation summary counts; process confirmation; completion summary |

---

## 🔗 Dependencies

### Depends On (calls into)

| File | Functions Used |
|------|---------------|
| `Phase2_ProgressTracking.gs` | `updateAllStats(ss)`, `extractLessonNumber(lesson)`, `applyStatusConditionalFormatting(sheet, startRow, startCol, numRows, numCols)` |
| `SharedConstants.gs` / `SharedEngine.gs` | `LAYOUT`, `SHEET_NAMES`, `SHEET_NAMES_V2`, `COLORS` constants |
| GAS built-ins | `SpreadsheetApp`, `HtmlService`, `PropertiesService`, `Logger` |

### Used By (called from)

| File | How |
|------|-----|
| `modules/ModuleLoader.gs` | `addAdminMenu()` is called when `features.adminImport = true` to add "🔐 Admin Tools" submenu |
| `onOpen_Example.gs` / `SetupWizard.gs` | `addAdminMenu()` is invoked conditionally at spreadsheet open |

---

## ⚙️ Function Reference

### `addAdminMenu()`
**Description:** Builds and adds the "🔐 Admin Tools" submenu to the spreadsheet UI. Contains items: Open Import Dialog, Validate Import Data, Process Import, Clear Import Staging, View Import Exceptions, Refresh Grade Summary Values.
**Parameters:** None
**Returns:** `void`

---

### `showImportDialog()`
**Description:** Opens the import dialog as a 650×600 modal. Renders the HTML returned by `getImportDialogHtml()`.
**Parameters:** None
**Returns:** `void`

---

### `getImportDialogHtml()`
**Description:** Returns the full HTML string for the import dialog UI. Includes import-type selector (Initial Assessment grid/row vs Lesson Progress), file upload area, CSV textarea, format examples, and action buttons that call `importCsvToStaging()` via `google.script.run`.
**Parameters:** None
**Returns:** `(string)` Complete HTML document string

---

### `importCsvToStaging(csvData, importType)`
**Description:** Parses raw CSV text according to the specified format and writes rows to the "Import Staging" sheet. Sets headers, applies column widths, stores import type in Document Properties, and activates the staging sheet.
**Parameters:**
- `csvData` (string): Raw CSV text from the dialog (pasted or file-read)
- `importType` (string): One of `'initial-grid'`, `'initial-row'`, `'progress'`

**Returns:** `(Object)` `{ success: boolean, message: string }`

---

### `parseGridFormat(csvData)`
**Description:** Parses a student-per-row CSV where columns are lesson names (e.g., `UFLI L1`). Uses `extractLessonNumber()` to identify lesson columns. Outputs one row per student/lesson/status combination; skips blank statuses. Date defaults to today.
**Parameters:**
- `csvData` (string): Raw CSV text in grid format

**Returns:** `(Array<Array>)` Array of `[studentName, date, '', lessonLabel, status]` rows

---

### `parseRowFormat(csvData)`
**Description:** Parses a row-per-assessment CSV with required columns: `student`, `date`, `group`, `lesson`, `status`. Column matching is case-insensitive substring. Status is normalised to upper-case.
**Parameters:**
- `csvData` (string): Raw CSV text in row format

**Returns:** `(Array<Array>)` Array of `[name, date, group, lesson, status]` rows

---

### `parseCSVLine(line)`
**Description:** Tokenises a single CSV line, handling double-quoted fields and comma/tab delimiters. Calls `sanitizeCellValue()` on each token.
**Parameters:**
- `line` (string): Single line of CSV text

**Returns:** `(Array<string>)` Array of sanitised cell values

---

### `getOrCreateAdminSheet(ss, sheetName)`
**Description:** Returns the sheet with the given name, creating it if it does not exist.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `sheetName` (string): Target sheet name

**Returns:** `(Sheet)` Existing or newly created sheet

---

### `sanitizeCellValue(value)`
**Description:** Sanitises a value before writing to a sheet cell. Converts to string, enforces 32,767-character limit, prefixes formula-injection characters (`=`, `+`, `-`, `@`, tab, CR) with a single quote, and removes null bytes.
**Parameters:**
- `value` (any): The raw value to sanitise

**Returns:** `(string)` Safe string value

---

### `validateImportData()`
**Description:** Reads all rows from the staging sheet, runs each through `validateRow()`, writes `✓ Valid` or `✗ Error` to column G, applies conditional formatting, creates/updates the exceptions report, and shows a summary alert.
**Parameters:** None
**Returns:** `void`

---

### `buildStudentLookup(ss)`
**Description:** Builds a `Map<normalisedName, originalName>` from the Student Roster sheet starting at `LAYOUT.DATA_START_ROW`. Used for name matching during validation and processing.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet

**Returns:** `(Map<string, string>)` Normalised-name → original-name map

---

### `normalizeStudentName(name)`
**Description:** Converts a student name to lower-case, trims whitespace, and collapses internal spaces. Used for case/spacing-insensitive matching.
**Parameters:**
- `name` (string): Raw student name

**Returns:** `(string)` Normalised name

---

### `validateRow(rowNum, name, date, group, lesson, status, lookup)`
**Description:** Validates a single staging row. Checks: non-empty name, name exists in roster lookup, lesson parses to a valid number, and status is `Y`, `N`, or `A`.
**Parameters:**
- `rowNum` (number): 1-based row number in staging sheet (for error reporting)
- `name` (string): Student name
- `date` (string): Date value (not validated for format)
- `group` (string): Group name (not validated currently)
- `lesson` (string): Lesson label (e.g., `UFLI L5`)
- `status` (string): Status value
- `lookup` (Map): Result of `buildStudentLookup()`

**Returns:** `(Array<Object>)` Array of exception objects `{ row, studentName, issueType, details, rawData }`; empty if valid

---

### `applyValidationFormatting(sheet, lastRow)`
**Description:** Adds conditional format rules to the Validation Status column (G): green background for rows containing "Valid", red for "Error".
**Parameters:**
- `sheet` (Sheet): Import Staging sheet
- `lastRow` (number): Last row with data

**Returns:** `void`

---

### `createExceptionsReport(ss, exceptions)`
**Description:** Clears and rebuilds the "Import Exceptions" sheet with columns: Row, Student Name, Issue Type, Details, Raw Data. Writes "No exceptions found" if the array is empty.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `exceptions` (Array<Object>): Array of exception objects from `validateRow()`

**Returns:** `void`

---

### `goToExceptionsSheet()`
**Description:** Navigates to (activates) the "Import Exceptions" sheet.
**Parameters:** None
**Returns:** `void`

---

### `processImportData()`
**Description:** Orchestrates the full import commit. Reads valid rows from staging, prompts the user to confirm, builds the best-entry map, calls the appropriate import processor (`processInitialAssessmentImport` or `processLessonProgressImport`), archives to historical, and shows a completion alert.
**Parameters:** None
**Returns:** `void`

---

### `processInitialAssessmentImport(ss, bestEntries, studentLookup)`
**Description:** Applies best-entry statuses to both the UFLI MAP and the Initial Assessment snapshot sheet (creating the snapshot if needed), repairs conditional formatting on both sheets, and triggers `updateAllStats()`.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `bestEntries` (Map): Result of `buildBestEntryMap()`
- `studentLookup` (Map): Result of `buildStudentLookup()`

**Returns:** `(Object)` `{ processedCount: number, skippedCount: number }`

---

### `processLessonProgressImport(ss, bestEntries, studentLookup)`
**Description:** Applies best-entry statuses to the UFLI MAP only, repairs conditional formatting, and triggers `updateAllStats()`.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `bestEntries` (Map): Result of `buildBestEntryMap()`
- `studentLookup` (Map): Result of `buildStudentLookup()`

**Returns:** `(Object)` `{ processedCount: number, skippedCount: number }`

---

### `createInitialAssessmentSheet(ss, mapSheet)`
**Description:** Creates a new "Initial Assessment" sheet as a copy of UFLI MAP, sets a title in cell A1, and clears all lesson data cells (preserving student names) starting at `LAYOUT.DATA_START_ROW`.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `mapSheet` (Sheet): UFLI MAP sheet to copy from

**Returns:** `(Sheet)` Newly created Initial Assessment sheet

---

### `buildStudentRowLookup(sheet)`
**Description:** Builds a `Map<normalisedName, rowNumber>` from column A of the given sheet starting at `LAYOUT.DATA_START_ROW`. Used for locating which row to update for each student.
**Parameters:**
- `sheet` (Sheet): A tracking sheet (UFLI MAP or Initial Assessment)

**Returns:** `(Map<string, number>)` Normalised-name → 1-based row number map

---

### `buildBestEntryMap(validRows, studentLookup)`
**Description:** Iterates all valid staging rows and keeps only the highest-priority status (`Y > N > A`) for each student/lesson pair (keyed as `normalisedName|lessonNum`).
**Parameters:**
- `validRows` (Array<Array>): Filtered staging rows where Validation Status contains "Valid"
- `studentLookup` (Map): Normalised-name → original-name map

**Returns:** `(Map<string, Object>)` Key: `"normName|lessonNum"` → `{ studentName, lessonNum, status, priority }`

---

### `applyMapUpdates(sheet, updates)`
**Description:** Writes an array of `{ row, col, value }` updates to a sheet, grouped by row.
**Parameters:**
- `sheet` (Sheet): Target sheet
- `updates` (Array<Object>): Array of `{ row: number, col: number, value: string }`

**Returns:** `void`

---

### `repairSheetFormatting(sheet)`
**Description:** Re-applies Y/N/A conditional formatting to a sheet by calling `applyStatusConditionalFormatting()` from Phase2, if available.
**Parameters:**
- `sheet` (Sheet): Sheet to repair

**Returns:** `void`

---

### `archiveToHistorical(ss, validRows, studentLookup, importType)`
**Description:** Appends all valid import rows to the "Small Group Historical" sheet, prefixed with the current timestamp and import type label. Creates sheet headers on first use.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `validRows` (Array<Array>): Staging rows that passed validation
- `studentLookup` (Map): Normalised-name → original-name map
- `importType` (string): `'initial'` or `'progress'`

**Returns:** `void`

---

### `clearImportStaging()`
**Description:** After user confirmation, clears both the Import Staging and Import Exceptions sheets (restoring column headers on staging), and deletes the `CURRENT_IMPORT_TYPE` document property.
**Parameters:** None
**Returns:** `void`

---

### `refreshGradeSummaryFormulas()`
**Description:** Triggers a full stats recalculation by calling `updateAllStats(ss)` from Phase2. This replaces the prior approach of writing volatile formulas. Shows a success alert on completion.
**Parameters:** None
**Returns:** `void`
