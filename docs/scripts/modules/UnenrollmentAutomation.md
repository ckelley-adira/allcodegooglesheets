# UnenrollmentAutomation.gs (Module)

## 📋 Overview
**Feature Flag:** `SITE_CONFIG.features.unenrollmentAutomation`

`UnenrollmentAutomation.gs` automates the workflow for unenrolled students. When a student is marked as `"U"` (unenrolled), the module:
1. Creates a task in **Monday.com** to initiate the student-exit workflow.
2. Archives the student's **complete row data** (3 rows: Initial Assessment, UFLI MAP, Grade Summary) to the *Student Archive* sheet.
3. Deletes the student from their group sheet and from all source tracking sheets.
4. Writes an audit log entry.

Plain-English summary: *Instead of manually finding and deleting a student across 4+ sheets, a coordinator triggers one function. The student's historical data is preserved in a colour-coded archive, a Monday.com task is opened for the operations team, and the student disappears cleanly from the live tracking sheets. An audit log records every action taken.*

---

## 📜 Business Rules
1. **Archive structure:** Every archived student occupies exactly 3 rows (one for each source sheet). Row 1 has archive date, student name, group, source label, Monday.com task ID, and archivist name; rows 2–3 have source label only. Original row data starts at column H.
2. **Best-effort archival:** The module continues past individual sheet failures. If a student is not found in one source sheet, archival from the other sheets still proceeds; partial success is still reported as success (`results.actions.length > 0`).
3. **Monday.com API key** must be stored in Script Properties as `MONDAY_API_KEY`. The module throws a descriptive error if the key is missing; it never reads the key from code.
4. **Automatic deletion** is controlled by `ARCHIVE_CONFIG.autoDeleteFromGroups` (default `true`). When `true`, the student row is deleted from both the grade group sheet and all source sheets.
5. **Audit log** is created automatically on first archive operation if it does not exist.
6. `logUnenrolledStudent()` is the integration point called by save functions when status `"U"` is detected. It combines the log entry and the full archive operation.
7. GraphQL strings are sanitised via `escapeGraphQL_()` before being sent to the Monday.com API.
8. The archive sheet has frozen rows (4) and frozen columns (7) so metadata is always visible when scrolling wide source data.

---

## 📥 Data Inputs
| Input | Source | Notes |
|---|---|---|
| Student data | `data` object parameter | `{ studentName, groupName, gradeSheet, teacherName, [lessonName] }` |
| `MONDAY_API_KEY` | Script Properties | Retrieved by `getMondayApiKey_()` |
| Initial Assessment rows | Sheet: `'Initial Assessment'` | Searched by student name |
| UFLI MAP rows | Sheet: `'UFLI MAP'` | Searched by student name |
| Grade Summary rows | Sheet: `'Grade Summary'` | Searched by student name |
| `MONDAY_CONFIG` (module-local) | Hard-coded board/group/column IDs | Override in `SiteConfig_TEMPLATE.gs` feature config |
| `ARCHIVE_CONFIG` (module-local) | Sheet names, deletion/audit flags | Configure per-school |
| `UNENROLLED_REPORT_CONFIG` | Imported from `SiteConfig_TEMPLATE.gs` or `UnifiedConfig.gs` | Provides `schoolName`, `unenrolledLogSheetName` |

---

## 📤 Outputs
| Output | Description |
|---|---|
| Monday.com task | Created via GraphQL mutation; returns item ID |
| Sheet: *Student Archive* | 3 rows per student appended; created if missing |
| Deleted rows | Student removed from group sheet + Initial Assessment, UFLI MAP, Grade Summary |
| Sheet: *Archive Audit Log* | One row per archive operation; created if missing |
| Unenrolled log sheet | One row per unenrolled event; status updated after archive attempt |
| Return value `{success, actions, errors, mondayTaskId}` | From `archiveUnenrolledStudent()` |

---

## 🔗 Dependencies

### Feature Flag
`SITE_CONFIG.features.unenrollmentAutomation === true`

### Depends On (calls into)
| File / Symbol | Purpose |
|---|---|
| `UrlFetchApp` (GAS built-in) | Monday.com GraphQL API calls |
| `PropertiesService` (GAS built-in) | Stores/reads `MONDAY_API_KEY` |
| `SpreadsheetApp` (GAS built-in) | All sheet operations |
| `UnifiedConfig.gs` → `UNENROLLED_REPORT_CONFIG` | School name and log sheet name |
| `MONDAY_CONFIG` (module-local) | API endpoint, board ID, column IDs |
| `ARCHIVE_CONFIG` (module-local) | Source sheet names, deletion flags |

### Used By (called from)
| File | Context |
|---|---|
| `Phase2_ProgressTracking.gs` | Calls `logUnenrolledStudent()` when status `"U"` is saved |
| `SetupWizard.gs` | Can call `setupUnenrollmentAutomation()` during onboarding |

---

## ⚙️ Function Reference

### `getMondayApiKey_()`
**Description:** (Private) Retrieves the Monday.com API key from Script Properties. Throws a descriptive error (with navigation instructions) if the key is not set, preventing any API call from using a blank or default key.

**Parameters:** None.

**Returns:** (string) The API key.

---

### `createMondayTask(data)`
**Description:** Creates a new item in the configured Monday.com board via GraphQL mutation. Sets the item name (student name), date column, school column, group column, and initial status (`"Working on it"`). Returns the item ID on success.

**Parameters:**
- `data` (Object):
  - `studentName` (string): Used as the Monday.com item name.
  - `groupName` (string): Populates the group column.
  - `gradeSheet` (string): Grade level for context.
  - `date` (Date): Unenrollment date; defaults to `new Date()`.

**Returns:** (Object) `{ success: boolean, itemId: string|undefined, message: string }`

---

### `escapeGraphQL_(str)`
**Description:** (Private) Escapes backslashes, double-quotes, and newline characters in a string for safe embedding in a GraphQL query literal.

**Parameters:**
- `str` (string): Input string.

**Returns:** (string) Escaped string.

---

### `testMondayConnection()`
**Description:** Sends a query to the Monday.com API to fetch the configured board's name, groups, and column definitions. Displays the result in an alert dialog. Use to verify API key and board ID during setup.

**Parameters:** None.

**Returns:** (void)

---

### `createArchiveSheet_(ss)`
**Description:** (Private) Gets or creates the *Student Archive* sheet. If the sheet exists with more than 5 rows, returns it unchanged (to preserve existing archive data). Otherwise, writes title, subtitle, column-reference note, index headers, and configures frozen rows/columns.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.

**Returns:** (Sheet) The archive sheet.

---

### `collectStudentData_(ss, studentName)`
**Description:** (Private) Reads the *Initial Assessment*, *UFLI MAP*, and *Grade Summary* sheets, finds the student's row in each, and returns the full row data and header data for each source.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `studentName` (string): Exact student name to search for.

**Returns:** (Object) `{ initialAssessment: {found, rowData, headers, rowIndex}, ufliMap: {...}, gradeSummary: {...} }`

---

### `writeToArchive_(archiveSheet, data)`
**Description:** (Private) Appends 1–3 rows to the archive sheet for the student (one per found source sheet). Metadata columns A–F contain archive date, name, group, source label, Monday.com task ID, and archivist name. Original source data starts at column H. Applies colour-coded row backgrounds. Draws a medium border below the last row for the student.

**Parameters:**
- `archiveSheet` (Sheet): The *Student Archive* sheet.
- `data` (Object): Combined object with `studentName`, `groupName`, `teacherName`, `archiveDate`, `mondayTaskId`, and the three source data sub-objects.

**Returns:** (number) Row number where the archive block started.

---

### `writeArchiveHeaders()`
**Description:** Appends a column-reference section at the bottom of the archive sheet showing the original column header rows from each source sheet. Useful for interpreting archived data. Triggered manually or from setup.

**Parameters:** None.

**Returns:** (void)

---

### `deleteFromGroupSheet_(ss, studentName, groupName, gradeSheet)`
**Description:** (Private) Finds the student's row in the grade group sheet (determined from `gradeSheet` or by parsing `groupName`) and deletes it. Scans from bottom to top to avoid row index shifting.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `studentName` (string): Exact student name.
- `groupName` (string): Used to derive the grade prefix if `gradeSheet` is not provided.
- `gradeSheet` (string|null): Explicit sheet name override.

**Returns:** (Object) `{ success: boolean, message?: string }`

---

### `deleteFromSourceSheets_(ss, studentName)`
**Description:** (Private) Iterates over all source sheets in `ARCHIVE_CONFIG.sourceSheets` and deletes the student's row from each. Returns a results array for audit logging.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `studentName` (string): Exact student name.

**Returns:** (Array\<Object\>) `[{ sheet: string, success: boolean, message?: string }]`

---

### `logArchiveAction_(data, results)`
**Description:** (Private) Appends one row to the *Archive Audit Log* sheet (created if missing) recording the timestamp, student name, group, completed actions, errors, and Monday.com task ID.

**Parameters:**
- `data` (Object): Original unenrollment data (`studentName`, `groupName`).
- `results` (Object): Output of `archiveUnenrolledStudent()` (`actions`, `errors`, `mondayTaskId`).

**Returns:** (void)

---

### `archiveUnenrolledStudent(data)`
**Description:** **Main archive orchestrator.** Executes the full seven-step workflow: (1) get/create archive sheet, (2) collect source data, (3) create Monday.com task, (4) write to archive, (5) delete from group sheet, (6) delete from source sheets, (7) write audit log. Returns a results object summarising all actions and errors.

**Parameters:**
- `data` (Object): `{ studentName, groupName, gradeSheet, teacherName }`

**Returns:** (Object) `{ success, studentName, actions: string[], mondayTaskId: string|null, errors: string[] }`

---

### `logUnenrolledStudent(data)`
**Description:** **Integration entry point** — called by `Phase2_ProgressTracking.gs` when a student is saved with status `"U"`. Appends a row to the unenrolled log sheet, triggers `archiveUnenrolledStudent()`, then updates the log row with the outcome (Archived / Error).

**Parameters:**
- `data` (Object): `{ studentName, groupName, gradeSheet, teacherName, lessonName }`

**Returns:** (Object) `{ success, message, details }`

---

### `manualArchiveStudent()`
**Description:** Interactive dialog to manually archive a student by name and group. Prompts for both values, shows a confirmation listing what will happen, then calls `archiveUnenrolledStudent()`. Useful for students already marked `"U"` who were not auto-archived.

**Parameters:** None.

**Returns:** (void)

---

### `setupUnenrollmentAutomation()`
**Description:** One-time interactive setup wizard. Creates the archive sheet, prompts for the Monday.com API key (if not already stored), and confirms the board/group ID configuration. Advises running `testMondayConnection()` afterward.

**Parameters:** None.

**Returns:** (void)

---

### `goToArchiveSheet()`
**Description:** Navigates the active sheet to *Student Archive*, creating it first if it does not exist.

**Parameters:** None.

**Returns:** (void)

---

### `goToAuditLog()`
**Description:** Navigates the active sheet to *Archive Audit Log*. Shows an alert if no audit log has been created yet.

**Parameters:** None.

**Returns:** (void)
