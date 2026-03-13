# GrowthHighlighterSidebar.html (UI Template)

## 📋 Overview

`GrowthHighlighterSidebar.html` is a **Google Sheets sidebar** (compact, full-height) that identifies students in the "Unenrolled or Finished Sequence" group who show unexpected positive growth in their AG% (Above Grade %) scores. It belongs to the optional **Growth Highlighter** feature module.

On opening, the sidebar loads statistics about the currently active sheet (total student rows, number of AG% columns, and how many students are in the target group). The user can then:

1. **Run the highlighter** — scans unenrolled/finished-sequence students for any AG% improvement that meets or exceeds a configurable minimum threshold, and applies a selected highlight color to matching rows in the sheet.
2. **Clear highlights** — removes all applied highlight colors.
3. **Export results** — saves the list of highlighted students to a separate sheet.

Results are displayed inline in a scrollable student list with growth badge and growth areas. The sidebar uses Google-style minimal UI and accent colors from `getBranding().accentColor`.

---

## 📜 Business Rules

- **Target group is fixed:** Only students in the "Unenrolled or Finished Sequence" group are scanned. This is not configurable from the sidebar UI.
- **Minimum growth threshold:** The `minGrowth` number input defaults to `0` (any positive growth qualifies). Users may set a higher percentage to filter for more significant growth.
- **Highlight color:** Defaults to `#FFF59D` (light yellow). User can change via a color picker.
- **Run button disabling:** The Run button is disabled while the scan is in progress to prevent concurrent operations.
- **Result states:**
  - Students found: green summary banner + scrollable student list.
  - No students found: amber "All Clear" summary banner; list is hidden.
  - Server error/no valid sheet: amber notice banner; list is hidden.
- **Growth areas display:** Up to 3 growth areas (skill section names) are shown per student, with `+N more` if there are additional ones.
- **Export guard:** If `lastResults` is empty, `alert()` is shown instead of calling the server.
- **Sheet info refresh:** After each highlighter run, `loadSheetInfo()` is called to refresh the stats panel.

---

## 📥 Data Inputs

### Form Fields

| Field ID | Type | Purpose |
|----------|------|---------|
| `minGrowth` | `number` (0–100) | Minimum AG% growth required to highlight a student |
| `highlightColor` | `color` | Hex color to apply to matching student rows (default `#FFF59D`) |

### Data Loaded from Server via `google.script.run`

| Call | When | Returns |
|------|------|---------|
| `ghGetSheetInfo()` | `DOMContentLoaded` and after each run | `{ totalRows, agColumnCount, targetGroupCount }` |

### Template Variables

- `<?= getBranding().accentColor ?>` — Applied to the header gradient, section titles, info value text, checkbox accent, primary button background, secondary button border/text, and the loader spinner.

---

## 📤 Outputs

### `ghRunHighlighter(options)` — Run scan and apply highlights
```js
options: {
  minGrowth: number,  // From #minGrowth input
  color: string       // Hex color from #highlightColor picker
}
```
**Returns:** `{ success: boolean, message: string, results: { highlighted: StudentResult[] } }`

Each `StudentResult`:
```js
{
  name: string,
  row: number,
  grade: string,
  teacher: string,
  group: string,
  maxGrowth: number,       // Highest AG% improvement found
  growthAreas: [{ name }]  // Skill sections with growth
}
```

**On success:** Renders the results panel. Calls `loadSheetInfo()`.
**On failure:** Shows a native `alert()` with the error.

### `ghClearAllHighlights()` — Remove all highlights
**Returns:** `{ message: string }`
Shows a "Cleared" summary panel.

### `ghExportResults(lastResults)` — Export highlighted students
**Returns:** `{ message: string }`
Shows a native `alert()` with the result message.

---

## 🔗 Dependencies

### Server Functions Called (`google.script.run`)

| Function | Purpose |
|----------|---------|
| `ghGetSheetInfo()` | Get stats for the current sheet (student count, AG% columns, target group count) |
| `ghRunHighlighter(options)` | Scan students and apply row highlights |
| `ghClearAllHighlights()` | Remove all highlight colors from the sheet |
| `ghExportResults(lastResults)` | Export highlighted student list to a new sheet |

### Called From (which .gs opens this HTML)

- **`gold-standard-template/modules/GrowthHighlighter.gs`** — line 58:
  ```js
  HtmlService.createHtmlOutputFromFile('GrowthHighlighterSidebar')
  ```

---

## ⚙️ Client-Side JavaScript Functions

### Global State

```js
let lastResults = []; // Last set of highlighted StudentResult objects; used for export
```

---

### `loadSheetInfo()`
**Description:** Calls `google.script.run.ghGetSheetInfo()` with `displaySheetInfo` as the success handler and `showError` as the failure handler.
**Parameters:** none
**Returns:** void

---

### `displaySheetInfo(info)`
**Description:** Renders the `#sheetInfo` section with a 2-column info grid showing total student rows, AG% column count, and the target group student count.
**Parameters:**
- `info` (`{ totalRows: number, agColumnCount: number, targetGroupCount: number }`): Sheet stats from server
**Returns:** void

---

### `runHighlighter()`
**Description:** Reads `minGrowth` and `highlightColor` inputs into an `options` object. Disables the Run button, shows the loading panel, hides the results panel, then calls `google.script.run.ghRunHighlighter(options)` with `displayResults` / `showError` handlers.
**Parameters:** none
**Returns:** void

---

### `displayResults(response)`
**Description:** Re-enables the Run button and hides the loading panel. If `response.success` is false, shows an amber warning panel with `response.message` and hides the student list. If successful: saves `response.results.highlighted` to `lastResults`, shows a green summary banner (or amber "All Clear" if empty), and if students were found, renders the student list with name, row/grade/teacher/group details, max growth badge, and up to 3 growth area names (with `+N more` overflow). Calls `loadSheetInfo()` to refresh stats.
**Parameters:**
- `response` (`{ success: boolean, message: string, results: { highlighted: StudentResult[] } }`): Highlighter run result
**Returns:** void

---

### `clearHighlights()`
**Description:** Shows the loading panel and calls `google.script.run.ghClearAllHighlights()`. On success: hides the loading panel, shows the results panel with a "Cleared" summary, and hides the student list. On failure: delegates to `showError()`.
**Parameters:** none
**Returns:** void

---

### `exportResults()`
**Description:** If `lastResults` is empty, shows a native `alert('No results to export.')`. Otherwise, shows the loading panel and calls `google.script.run.ghExportResults(lastResults)`. On success: hides the loading panel and shows a native `alert()` with the result message. On failure: delegates to `showError()`.
**Parameters:** none
**Returns:** void

---

### `showError(error)`
**Description:** Re-enables the Run button, hides the loading panel, and shows a native `alert('Error: ' + error.message)`.
**Parameters:**
- `error` (Error): GAS failure error object
**Returns:** void
