# GenerateReportsUI.html (UI Template)

## 📋 Overview

`GenerateReportsUI.html` is a **report configuration dialog** (max 750 px wide) that lets users choose which data columns to include in a generated report and optionally narrow the report to a specific grade, group, or individual student. It is opened from the UFLI system menu as a Google Sheets dialog.

The available columns are loaded dynamically from the server and grouped into three checkbox categories:
1. **Student Information** — identifying columns (name, grade, teacher, group, etc.)
2. **Progress Metrics** — lesson completion and benchmark data
3. **Skill Section Mastery (%)** — per-skill-section AG% columns

Users configure filters (All Grades / All Groups / All Students) and then click "Generate Report" to build the report sheet on the server. The dialog auto-closes 2 seconds after a successful generation.

Branding is applied via `getBranding().primaryColor` for section headers, input borders, and the loader spinner.

---

## 📜 Business Rules

- **At least one column required:** If no checkboxes are checked when "Generate Report" is clicked, validation blocks submission with a "Please select at least one column" error alert.
- **Filter defaults to All:** Each filter dropdown defaults to `'ALL'`. Passing `'ALL'` to the server means no filtering is applied for that dimension.
- **Default columns:** Options returned by the server may have `default: true`; these are pre-checked when the dialog opens.
- **Empty category hiding:** If a category (student, progress, or skills) returns zero options, its entire section is hidden.
- **Loading state:** The Generate button is disabled and relabelled "Generating…" while the server call is in progress.
- **Auto-close on success:** The dialog closes after 2 seconds on a successful response.

---

## 📥 Data Inputs

### Form Fields

| Field ID | Type | Purpose |
|----------|------|---------|
| `filterGrade` | `select` | Filter report to a single grade (default: All Grades) |
| `filterGroup` | `select` | Filter to a specific group (default: All Groups) |
| `filterStudent` | `select` | Filter to a single student (default: All Students) |
| Checkboxes in `#studentOptions` (dynamic) | `checkbox` | Toggle student info columns (name, grade, teacher, etc.) |
| Checkboxes in `#progressOptions` (dynamic) | `checkbox` | Toggle progress metric columns |
| Checkboxes in `#skillOptions` (dynamic) | `checkbox` | Toggle skill section mastery % columns |

### Data Loaded from Server via `google.script.run`

| Call | When | Returns |
|------|------|---------|
| `getReportOptions()` | `window.onload` | `{ options: { student[], progress[], skills[] }, filterOptions: { grades[], groups[], students[] } }` |

Each option entry has `{ id, name, default? }`.
Each filter entry is either a plain string or `{ value, label }`.

### Template Variables

- `<?= getBranding().primaryColor ?>` — Applied to section headers, checkbox hover borders, dropdown hover/focus borders, and the loader spinner.
- `<?= getBranding().logoUrl ?>` — School logo (hidden if not configured).
- `<?= getBranding().tagline ?>` — School tagline.

---

## 📤 Outputs

### `buildReport(selectedColumns, filters)` — called on "Generate Report"

```js
selectedColumns: [
  { id: string, name: string, ... }   // checked option objects
],
filters: {
  grade: string,    // 'ALL' or specific grade
  group: string,    // 'ALL' or specific group
  student: string   // 'ALL' or specific student name
}
```

**On success (`response.success === true`):** Shows a success alert and closes dialog after 2 seconds.
**On success with error (`response.success === false`):** Delegates to `onReportFailure()`.
**On failure:** Re-enables the Generate button and shows a danger alert.

---

## 🔗 Dependencies

### Server Functions Called (`google.script.run`)

| Function | Purpose |
|----------|---------|
| `getReportOptions()` | Load available column options and filter dropdown values |
| `buildReport(selectedColumns, filters)` | Generate the report sheet with chosen columns and filters |

### Called From (which .gs opens this HTML)

- **`gold-standard-template/SetupWizard.gs`** — line 1615:
  ```js
  HtmlService.createHtmlOutputFromFile('GenerateReportsUI')
  ```

---

## ⚙️ Client-Side JavaScript Functions

### Global State

```js
let allOptions = {};        // { student[], progress[], skills[] }
let allFilterOptions = {};  // { grades[], groups[], students[] }
```

---

### `onOptionsLoaded(data)`
**Description:** Success handler for `getReportOptions()`. Stores the received data in `allOptions` and `allFilterOptions`. Calls `populateCheckboxes()` for each of the three column categories, calls `populateFilterDropdowns()`, then hides the loader and shows `#reportOptions`.
**Parameters:**
- `data` (`{ options, filterOptions }`): Column options and filter values from the server
**Returns:** void

---

### `populateCheckboxes(containerId, options)`
**Description:** Renders one checkbox item per option into the specified container. Each checkbox stores its option data object in a `._data` property for later retrieval. If `options` is empty or null, the container's parent section is hidden. Options with `default: true` are pre-checked.
**Parameters:**
- `containerId` (string): ID of the target `<div>` container (`'studentOptions'`, `'progressOptions'`, or `'skillOptions'`)
- `options` (Array\<{id, name, default?}\>): Column option objects
**Returns:** void

---

### `populateFilterDropdowns()`
**Description:** Calls `populateSelect()` for each of the three filter dropdowns, passing the appropriate filter option array and "All…" default text.
**Parameters:** none
**Returns:** void

---

### `populateSelect(elementId, options, allText)`
**Description:** Clears the target `<select>` and repopulates it: first with an "All" option (value `'ALL'`), then one option per entry in `options`. Each entry may be a plain string or `{ value, label }` object.
**Parameters:**
- `elementId` (string): ID of the `<select>` element
- `options` (Array\<string | {value, label}\>): Filter option values
- `allText` (string): Label for the "All" default option (e.g., `'All Grades'`)
**Returns:** void

---

### `onFailure(error)`
**Description:** Failure handler for `getReportOptions()`. Hides the loader and shows a danger alert with the error message.
**Parameters:**
- `error` (Error): GAS failure error object
**Returns:** void

---

### `generateReport()`
**Description:** Validates that at least one checkbox is checked (shows error alert if not). Collects checked option `._data` objects into `selectedColumns[]`. Reads the three filter dropdown values into a `filters` object. Calls `setLoading(true)`, shows an in-progress alert, then calls `google.script.run.buildReport(selectedColumns, filters)`.
**Parameters:** none
**Returns:** void

---

### `onReportSuccess(response)`
**Description:** Success handler for `buildReport()`. If `response.success` is true, shows a success alert and closes the dialog after 2 seconds. Otherwise, delegates to `onReportFailure()`.
**Parameters:**
- `response` (`{ success: boolean, message: string }`): Server response
**Returns:** void

---

### `onReportFailure(error)`
**Description:** Re-enables the Generate button via `setLoading(false)` and shows a danger alert.
**Parameters:**
- `error` (Error): Error object
**Returns:** void

---

### `setLoading(isLoading)`
**Description:** Disables/enables the Generate button and toggles its label between `'Generate Report'` and `'Generating...'`.
**Parameters:**
- `isLoading` (boolean): Whether the generation is in progress
**Returns:** void

---

### `showAlert(message, type, noAutoHide)`
**Description:** Sets `#alert` element text and CSS class (`alert-danger` or `alert-success`) and shows it. Unless `noAutoHide` is true, auto-dismisses after 5 seconds (only if the message is unchanged).
**Parameters:**
- `message` (string): Alert text
- `type` (string): `'danger'` or `'success'`
- `noAutoHide` (boolean, optional): Prevent auto-dismiss
**Returns:** void
