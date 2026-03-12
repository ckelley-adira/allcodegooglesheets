# SharedEngine_IO.gs

## 📋 Overview

`SharedEngine_IO.gs` is the **I/O layer split** of `SharedEngine.gs` (Version 3.0, Modularity Refactor). It is a deliberately thin module containing only the three functions that interact with Google Apps Script APIs: sheet creation/access, logging, and the statistics update orchestrator.

**Design principle:** No business logic lives here. All computation is delegated to `SharedEngine_Core.gs`. This file's sole responsibilities are:
1. Reading raw data arrays from spreadsheet sheets.
2. Calling `computeStudentStats()` (pure logic) with those arrays.
3. Writing the returned output arrays back to the appropriate sheets.

Because this file calls `SpreadsheetApp`, `Logger`, and other GAS APIs, it **cannot** be tested in Node.js and must be validated via integration tests or manual QA in the live GAS environment.

---

## 📜 Business Rules

This file enforces no business rules directly — all rules are in `SharedEngine_Core.gs`. The orchestration rules it does implement are:

- **Data loading order:** UFLI MAP data is loaded first (or accepted as a pre-loaded parameter to allow callers to pass cached data). Pre-K Data and Initial Assessment data are always loaded fresh from their sheets.
- **Null-safe sheet access:** If a sheet does not exist, an empty array is used as the data — processing continues without error.
- **Write targets:** Skills Tracker rows are written starting at `LAYOUT.DATA_START_ROW`, column 1. Grade Summary rows are written to the same starting row in their sheet. Rows are written in a single `setValues()` call per sheet.
- **Pre-K header row:** Read from `PREK_CONFIG.HEADER_ROW` (1-based index).
- **`getOrCreateSheet()` clear behavior:** Defaults to clearing the sheet on retrieval, ensuring stale data is always replaced.

---

## 📥 Data Inputs

| Source | Description |
|---|---|
| `UFLI MAP` sheet | Primary K–8 student progress data (read via `getDataRange().getValues()`) |
| `Pre-K Data` sheet | HWT Pre-K assessment data (read via `getDataRange().getValues()`) |
| `Initial Assessment` sheet | Baseline scores for growth suppression |
| `config.SHEET_NAMES_V2` | Sheet name constants (`UFLI_MAP`, `SKILLS`, `GRADE_SUMMARY`, `INITIAL_ASSESSMENT`) |
| `config.SHEET_NAMES_PREK` | Pre-K sheet name constant (`DATA`) |
| `config.LAYOUT` | `DATA_START_ROW`, used to offset sheet write targets |
| `config.PREK_CONFIG` | `HEADER_ROW` for reading the Pre-K header row |
| `mapData` parameter | Optional pre-loaded UFLI MAP array (skips sheet read if provided) |

---

## 📤 Outputs

| Output | Description |
|---|---|
| `Skills Tracker` sheet | Populated with computed section-percentage rows starting at `LAYOUT.DATA_START_ROW` |
| `Grade Summary` sheet | Populated with benchmark % and status rows starting at `LAYOUT.DATA_START_ROW` |
| `Logger` entries | One INFO log after completion: `"Updated N student records (Skills + Summary)"` |
| Sheet object (from `getOrCreateSheet`) | Returns the located or newly created GAS Sheet object |

---

## 🔗 Dependencies

### Depends On (calls into)
| File | Items Used |
|---|---|
| `SharedEngine_Core.gs` | `computeStudentStats()`, `createMergedRow()` (and indirectly all calculation functions) |
| `SharedConstants.gs` | `SKILL_SECTIONS` (via `computeStudentStats()`), `getPerformanceStatus()` |
| GAS Runtime | `SpreadsheetApp` (via the `ss` parameter), `Logger.log()` |

### Used By (called from)
| File | Usage |
|---|---|
| `Phase2_ProgressTracking.gs` | Calls `updateAllStats(ss, mapData, config)` to refresh Skills Tracker and Grade Summary |
| `SetupWizard.gs` | May call `getOrCreateSheet()` during sheet initialization |

---

## ⚙️ Function Reference

### `getOrCreateSheet(ss, sheetName, clearIfExists)`
**Description:** Retrieves a sheet by name from the given spreadsheet. If the sheet does not exist, it is created with `insertSheet()`. If it does exist and `clearIfExists` is `true` (the default), the sheet's content is cleared before returning.  
**Parameters:**
- `ss` (Spreadsheet): GAS Spreadsheet object (e.g., from `SpreadsheetApp.getActiveSpreadsheet()`).
- `sheetName` (string): The name of the sheet to get or create.
- `clearIfExists` (boolean, default `true`): Whether to clear the sheet's content if it already exists.

**Returns:** (Sheet) The GAS Sheet object, ready for data operations.

---

### `log(functionName, message, level)`
**Description:** Writes a structured log message to the GAS `Logger` in the format `[LEVEL] functionName: message`. Intended as a lightweight logging wrapper that can be extended with additional backends (e.g., writing to a log sheet) in the future.  
**Parameters:**
- `functionName` (string): Name of the calling function, included in the log prefix.
- `message` (string): Human-readable log message.
- `level` (string, default `'INFO'`): Log severity — `'INFO'`, `'WARN'`, or `'ERROR'`.

**Returns:** `undefined`

---

### `updateAllStats(ss, mapData, config)`
**Description:** I/O orchestrator for the full statistics refresh pipeline. Performs three sequential phases:

**Phase 1 — Read:**  
- Reads (or uses the provided) UFLI MAP data.  
- Reads Pre-K Data and extracts the header row.  
- Reads Initial Assessment data.

**Phase 2 — Compute (no I/O):**  
- Calls `computeStudentStats({ mapData, preKData, preKHeaders, initialData, config })` from `SharedEngine_Core.gs`.  
- All business logic and benchmark calculations happen inside this pure function.

**Phase 3 — Write:**  
- Writes `skillsOutput` to the Skills Tracker sheet via `setValues()`.  
- Writes `summaryOutput` to the Grade Summary sheet via `setValues()`.  
- Logs the number of student records updated.

**Parameters:**
- `ss` (Spreadsheet): GAS Spreadsheet object.
- `mapData` (Array\<Array\>|null): Optional pre-loaded UFLI MAP data. Pass `null` to read from the sheet.
- `config` (Object): Configuration object containing:
  - `SHEET_NAMES_V2` (Object): Must include `UFLI_MAP`, `SKILLS`, `GRADE_SUMMARY`, `INITIAL_ASSESSMENT`.
  - `SHEET_NAMES_PREK` (Object): Must include `DATA`.
  - `LAYOUT` (Object): Must include `DATA_START_ROW`.
  - `PREK_CONFIG` (Object): Must include `HEADER_ROW`.

**Returns:** `undefined` (writes directly to sheets and logs).
