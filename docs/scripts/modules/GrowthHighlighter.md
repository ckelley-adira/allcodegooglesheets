# GrowthHighlighter.gs (Module)

## 📋 Overview
**Feature Flag:** `SITE_CONFIG.features.growthHighlighter`

`GrowthHighlighter.gs` is a lightweight sidebar utility that visually identifies students in the *"Unenrolled or Finished Sequence"* group who still show measurable growth in one or more of the 16 UFLI skill-section AG% columns on the active Grade Summary sheet. It highlights their name cell in yellow (or a user-chosen colour) so coaches can quickly see which exited students warrant a re-enrolment conversation or continued monitoring.

Plain-English summary: *Open the sidebar from the Growth Highlighter menu, choose a minimum growth threshold and highlight colour, then click Run. The utility scans every student in the "Unenrolled or Finished Sequence" group, checks each of the 16 AG% columns, and highlights the name cell for any student whose AG% exceeds the threshold. Results can be exported to a dedicated sheet.*

---

## 📜 Business Rules
1. Only students whose **Group column (column D)** exactly matches `"Unenrolled or Finished Sequence"` (case-insensitive) are evaluated.
2. A student is highlighted if **at least one** AG% column value exceeds the `minGrowth` threshold (default 0, meaning any positive value qualifies).
3. AG% values may be stored as raw numbers (e.g., `0.42`) or as percentage strings (e.g., `"42%"`); `ghParseNumericValue()` handles both.
4. Before applying new highlights, all existing highlights on the name column are cleared (background reset to `null`).
5. The 16 AG% column indices are **hard-coded** in `GH_AG_COLUMNS` (0-based indices 9, 12, 15 … 54) matching the fixed Grade Summary column layout.
6. The export sheet (*Growth Highlight Export*) is always cleared and rebuilt from the latest scan results — it is not cumulative.

---

## 📥 Data Inputs
| Input | Source | Notes |
|---|---|---|
| Active sheet data | `SpreadsheetApp.getActiveSheet()` | Expected to be a Grade Summary sheet |
| Student group values | Column D (index 3), rows from `GH_CONFIG.DATA_START_ROW` | Filtered to `TARGET_GROUP` |
| AG% values | 16 columns at fixed 0-based indices in `GH_AG_COLUMNS` | Values may be number or `"n%"` string |
| `options.color` | Sidebar user input | Highlight hex colour; defaults to `'#FFF59D'` |
| `options.minGrowth` | Sidebar user input | Numeric threshold; defaults to `0` |
| `students` parameter | Client-side sidebar | Array of result objects for export |

---

## 📤 Outputs
| Output | Description |
|---|---|
| Name column background | Highlighted cells in column A for qualifying students on the active sheet |
| Cleared backgrounds | All name column highlights reset before each run |
| Sidebar result object | `{ success, results: { highlighted[], scanned, targetGroupCount }, message }` |
| Sheet: *Growth Highlight Export* | Created or cleared; one row per highlighted student with growth area details |

---

## 🔗 Dependencies

### Feature Flag
`SITE_CONFIG.features.growthHighlighter === true`

### Depends On (calls into)
| File / Symbol | Purpose |
|---|---|
| `HtmlService` (GAS built-in) | Loads `GrowthHighlighterSidebar.html` |
| `SpreadsheetApp` (GAS built-in) | Sheet read/write operations |
| `GH_CONFIG` (module-local) | Row/column layout constants |
| `GH_AG_COLUMNS` (module-local) | Fixed AG% column index map |

### Used By (called from)
| File | Context |
|---|---|
| `ModuleLoader.gs` → `buildFeatureMenu()` | Registers `ghShowSidebar` in the *Growth Highlighter* submenu |
| `GrowthHighlighterSidebar.html` | Client-side calls via `google.script.run` to `ghGetSheetInfo()`, `ghRunHighlighter()`, `ghClearAllHighlights()`, `ghExportResults()` |

---

## ⚙️ Function Reference

### `ghShowSidebar()`
**Description:** Opens the Growth Highlighter sidebar (`GrowthHighlighterSidebar.html`) at 350 px width with the title *"Growth Highlighter"*.

**Parameters:** None.

**Returns:** (void)

---

### `ghAddMenu()`
**Description:** Creates a standalone *🔍 Growth Highlighter* top-level menu item pointing to `ghShowSidebar`. Provided as a fallback for schools that have not yet integrated into the `buildFeatureMenu()` flow.

**Parameters:** None.

**Returns:** (void)

---

### `ghGetSheetInfo()`
**Description:** Returns metadata about the active sheet for display in the sidebar: sheet name, total data rows, count of students in the target group, and the number of AG% columns being scanned.

**Parameters:** None.

**Returns:** (Object) `{ sheetName: string, totalRows: number, targetGroupCount: number, agColumnCount: number }`

---

### `ghRunHighlighter(options)`
**Description:** Main highlight function. Reads all data rows from the active sheet, filters to students in the target group, checks each AG% column for values exceeding `options.minGrowth`, highlights qualifying name cells, and returns a detailed result object. Clears all existing name-column highlights before applying new ones.

**Parameters:**
- `options` (Object):
  - `color` (string): Background hex colour for highlights (default `'#FFF59D'`).
  - `minGrowth` (number): Minimum AG% to qualify as growth (default `0`).

**Returns:** (Object) `{ success: boolean, results: { highlighted: Array<{row, name, grade, teacher, group, growthAreas, maxGrowth}>, scanned: number, targetGroupCount: number }, message: string }`

---

### `ghGetGrowthInfo(row, minGrowth)`
**Description:** Evaluates a single data row against all 16 AG% column positions. Returns which skill areas show growth above `minGrowth` and the maximum growth value found.

**Parameters:**
- `row` (Array): A single row of sheet values (0-indexed).
- `minGrowth` (number): Minimum threshold for a column value to count as growth.

**Returns:** (Object) `{ hasGrowth: boolean, areas: Array<{name, value}>, maxGrowth: number }`

---

### `ghParseNumericValue(value)`
**Description:** Converts a cell value to a number. Handles raw numbers directly, strips `"%"` from percentage strings, and returns `0` for empty or non-parseable values.

**Parameters:**
- `value` (number|string|any): Raw cell value.

**Returns:** (number)

---

### `ghClearAllHighlights()`
**Description:** Resets the background colour of all cells in the name column (column A) from `DATA_START_ROW` to the last row, effectively removing any previous highlight pass.

**Parameters:** None.

**Returns:** (Object) `{ success: true, message: string }`

---

### `ghExportResults(students)`
**Description:** Creates (or clears) a sheet named *"Growth Highlight Export"* and writes one row per highlighted student with columns: Row, Student Name, Grade, Teacher, Group, Growth Areas (comma-joined skill names), Max Growth %. Auto-resizes all columns.

**Parameters:**
- `students` (Array\<Object\>): The `highlighted` array from `ghRunHighlighter()` results.

**Returns:** (Object) `{ success: true, message: string }`
