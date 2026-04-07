# ManageGroupsUI.html (UI Template)

## 📋 Overview

`ManageGroupsUI.html` is a **single-screen dialog** (max 650 px wide) that lets a site administrator view and change the number of intervention groups per grade level. It loads the current group/grade configuration, displays a table showing each grade's student count and current group count, and allows the admin to edit the group count for any grade. Saving triggers a full sheet rebuild on the server.

The UI uses the school's `getBranding().primaryColor` for section headers and input focus rings. School logo and tagline are rendered if configured.

---

## 📜 Business Rules

- **Destructive operation warning:** On load, after rendering the group rows, a persistent warning alert is shown: *"Changing group counts and saving will rebuild all grade-level group sheets. Student group assignments may be cleared if their group no longer exists."* This alert does not auto-dismiss.
- **Empty config guard:** If the server returns zero grades, an error alert is shown ("No grades are configured… Please run the Setup Wizard.") and no rows are rendered.
- **Group count input:** Each grade row has a `number` input with `min="0"`. A value of 0 is valid (no groups for that grade). Non-numeric values are coerced to 0.
- **Loading state:** The Save button is disabled and relabelled "Saving…" during the server call to prevent double-submission.
- **Auto-close on success:** The dialog closes automatically 2 seconds after a successful save.
- **Cancel button:** `google.script.host.close()` is called directly via `onclick` — no confirmation required.

---

## 📥 Data Inputs

### Form Fields

| Element | Type | Purpose |
|---------|------|---------|
| `grade_<grade>` (dynamic) | `number` (min 0) | Number of groups for this grade level |

### Data Loaded from Server via `google.script.run`

| Call | When | Returns |
|------|------|---------|
| `getGroupsData()` | `window.onload` | `Array<{ grade, label, studentCount, groupCount }>` — one entry per configured grade |

### Template Variables

- `<?= getBranding().primaryColor ?>` — Applied to the section header background, input hover/focus borders, and the loader spinner.
- `<?= getBranding().logoUrl ?>` — If set, renders the school logo in the header; otherwise the `<img>` is hidden.
- `<?= getBranding().tagline ?>` — Tagline displayed under the page title.

---

## 📤 Outputs

### `saveGroups(newGroupConfig)` — called on "Save & Rebuild Sheets"

The server function receives an array:
```js
[
  { grade: string, count: number },
  ...
]
```

**On success:** Shows a success alert and closes the dialog after 2 seconds.
**On failure:** Re-enables the Save button and shows an error alert.

---

## 🔗 Dependencies

### Server Functions Called (`google.script.run`)

| Function | Purpose |
|----------|---------|
| `getGroupsData()` | Load current grade/group configuration with student counts |
| `saveGroups(newGroupConfig)` | Persist updated group counts and trigger sheet rebuild |

### Called From (which .gs opens this HTML)

- **`gold-standard-template/SetupWizard.gs`** — line 1466:
  ```js
  HtmlService.createHtmlOutputFromFile('ManageGroupsUI')
  ```

---

## ⚙️ Client-Side JavaScript Functions

### Global State

```js
let groupData = []; // Array of grade objects loaded from server
```

---

### `onDataLoaded(data)`
**Description:** Success handler for `getGroupsData()`. Stores the result in `groupData`. If the array is empty, shows an error directing the admin to the Setup Wizard. Otherwise, renders one grid row per grade into `#groupRows` (showing grade label, student count, and an editable group count input), hides the loader, shows the group list, and displays the destructive-operation warning alert.
**Parameters:**
- `data` (Array\<{grade, label, studentCount, groupCount}\>): Grade configuration from server
**Returns:** void

---

### `onFailure(error)`
**Description:** Failure handler for `getGroupsData()`. Hides the loader and shows the error message as a danger alert.
**Parameters:**
- `error` (Error): GAS failure error object
**Returns:** void

---

### `saveChanges()`
**Description:** Disables the Save button (shows "Saving…"), shows an in-progress alert, maps `groupData` to a `newGroupConfig` array by reading each `grade_<grade>` input's current value, and calls `google.script.run.saveGroups(newGroupConfig)`.
**Parameters:** none
**Returns:** void

---

### `onSaveSuccess(response)`
**Description:** Success handler for `saveGroups()`. If `response.success` is true, shows a success alert and schedules `google.script.host.close()` after 2 seconds. If `response.success` is false, delegates to `onSaveFailure()`.
**Parameters:**
- `response` (`{ success: boolean, message: string }`): Server response
**Returns:** void

---

### `onSaveFailure(error)`
**Description:** Failure/error handler for `saveGroups()`. Re-enables the Save button via `setLoading(false)` and shows the error message as a danger alert.
**Parameters:**
- `error` (Error): Error object with `.message` property
**Returns:** void

---

### `setLoading(isLoading)`
**Description:** Toggles the Save button's disabled state and label between `'Save & Rebuild Sheets'` (normal) and `'Saving...'` (loading).
**Parameters:**
- `isLoading` (boolean): Whether the save operation is in progress
**Returns:** void

---

### `showAlert(message, type, noAutoHide)`
**Description:** Sets `#alert` element text and CSS class (`alert-danger`, `alert-success`, `alert-warning`). If `noAutoHide` is falsy, auto-dismisses after 5 seconds (only if the message text hasn't changed, preventing dismissal of a newer alert).
**Parameters:**
- `message` (string): Alert text
- `type` (string): `'danger'`, `'success'`, or `'warning'`
- `noAutoHide` (boolean, optional): If true, the alert persists indefinitely
**Returns:** void
