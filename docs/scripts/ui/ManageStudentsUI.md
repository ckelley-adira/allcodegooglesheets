# ManageStudentsUI.html (UI Template)

## 📋 Overview

`ManageStudentsUI.html` is a **student roster management dialog** (max 900 px wide) that provides full CRUD operations on the student roster. It is opened from the UFLI system menu and displayed as a Google Sheets dialog.

On load the dialog fetches all students and displays them in a scrollable table. Users can:
- **View** the full roster (Name, Grade, Teacher, Group).
- **Select** a row to enable Edit and Delete actions.
- **Add** a new student via a modal form.
- **Edit** a selected student's details in the same modal form.
- **Delete** a selected student (with a `confirm()` prompt).

The modal is reused for both Add and Edit modes, with the title and hidden fields adjusted accordingly. Branding colors (`getBranding().primaryColor`) are applied to section headers, sticky table headers, selected row highlight, and modal header.

---

## 📜 Business Rules

- **Required fields:** Name, Grade, and Teacher are required for both Add and Edit. Group is optional. Missing required fields show an inline validation alert inside the modal.
- **Delete confirmation:** A native `window.confirm()` dialog shows the student's name before deletion proceeds. Cancelling stops the deletion.
- **Selection-gated actions:** Edit and Delete buttons are disabled until a row is selected. They re-disable after any operation that refreshes the list.
- **Post-operation refresh:** After a successful save or delete, the entire student list is reloaded from the server to ensure data consistency.
- **Edit identity:** The `rowIndex` and `originalName` hidden fields are sent with edits so the server can locate the exact row to update even if the name changes.

---

## 📥 Data Inputs

### Form Fields (Modal)

| Field ID | Type | Purpose |
|----------|------|---------|
| `rowIndex` | `hidden` | Spreadsheet row index of the student being edited (`null` for new) |
| `originalName` | `hidden` | Student's original name (to locate the row even if name changes) |
| `name` | `text` | Student's full name (required) |
| `grade` | `text` | Grade code, e.g., `K`, `1`, `2` (required) |
| `teacher` | `text` | Teacher's name (required) |
| `group` | `text` | Group assignment (optional) |

### Data Loaded from Server via `google.script.run`

| Call | When | Returns |
|------|------|---------|
| `getStudentRosterData()` | `window.onload` and after each save/delete | `Array<{ name, grade, teacher, group, rowIndex }>` — full student roster |

### Template Variables

- `<?= getBranding().primaryColor ?>` — Applied to section header background, modal header background, selected-row highlight, input hover/focus borders, and loader spinner color.
- `<?= getBranding().logoUrl ?>` — School logo (hidden if not configured).
- `<?= getBranding().tagline ?>` — School tagline.

---

## 📤 Outputs

### `saveStudent(student)` — Add or Edit
```js
{
  rowIndex: number | null,   // null = new student; number = row to update
  originalName: string,      // Original name for row lookup on edit
  name: string,
  grade: string,
  teacher: string,
  group: string
}
```
**On success:** Closes modal and calls `loadStudents()` to refresh the list.
**On failure:** Shows error in modal alert, re-enables Save button.

### `deleteStudent(student)` — Delete
```js
{ name, grade, teacher, group, rowIndex }
```
**On success:** Calls `loadStudents()` to refresh the list.
**On failure:** Shows a native `alert()` with the error message; re-enables Delete button.

---

## 🔗 Dependencies

### Server Functions Called (`google.script.run`)

| Function | Purpose |
|----------|---------|
| `getStudentRosterData()` | Load full student roster |
| `saveStudent(student)` | Add new student or update existing student by row index |
| `deleteStudent(student)` | Remove student from all sheets |

### Called From (which .gs opens this HTML)

- **`gold-standard-template/SetupWizard.gs`** — line 1296:
  ```js
  HtmlService.createHtmlOutputFromFile('ManageStudentsUI')
  ```

---

## ⚙️ Client-Side JavaScript Functions

### Global State

```js
let studentData = [];         // Current roster array from server
let selectedStudent = null;   // Currently selected student object
```

---

### `loadStudents()`
**Description:** Shows the loader, hides the student table, then calls `google.script.run.getStudentRosterData()`. On success, calls `onStudentsLoaded()`. On failure, writes the error message into the loader element.
**Parameters:** none
**Returns:** void

---

### `onStudentsLoaded(data)`
**Description:** Stores `data` in `studentData`. Clears and rebuilds `#studentTableBody` with one `<tr>` per student (Name, Grade, Teacher, Group columns). Each row gets an `onclick` handler calling `selectRow()`. Hides the loader, shows the table, and calls `clearSelection()`.
**Parameters:**
- `data` (Array\<{name, grade, teacher, group, rowIndex}\>): Student roster from server
**Returns:** void

---

### `onFailure(error)`
**Description:** Writes `'Error: ' + error.message` into the `#loader` element text.
**Parameters:**
- `error` (Error): GAS failure error object
**Returns:** void

---

### `selectRow(rowElement, student)`
**Description:** Removes `selected` class from all `#studentTableBody` rows, adds `selected` to `rowElement`, sets `selectedStudent = student`, and enables the Edit and Delete buttons.
**Parameters:**
- `rowElement` (HTMLTableRowElement): The clicked table row
- `student` (object): Student data object `{ name, grade, teacher, group, rowIndex }`
**Returns:** void

---

### `clearSelection()`
**Description:** Sets `selectedStudent = null`, removes `selected` from all student rows, and disables the Edit and Delete buttons.
**Parameters:** none
**Returns:** void

---

### `openModal(student)`
**Description:** Prepares and shows the modal. If `student` is provided (edit mode): sets modal title to "Edit Student" and populates all fields. If `student` is `null` (add mode): sets title to "Add New Student" and clears all fields. Always calls `clearAlerts()` before opening.
**Parameters:**
- `student` (object | null): Student to edit, or `null` to add a new student
**Returns:** void

---

### `closeModal()`
**Description:** Sets `#modalBackdrop` display to `'none'`.
**Parameters:** none
**Returns:** void

---

### `editSelected()`
**Description:** If `selectedStudent` is set, calls `openModal(selectedStudent)`.
**Parameters:** none
**Returns:** void

---

### `saveStudent()`
**Description:** Reads all modal form fields into a student object. Validates that name, grade, and teacher are non-empty (shows inline modal alert on failure). Calls `setModalLoading(true)`, then calls `google.script.run.saveStudent(student)`.
**Parameters:** none
**Returns:** void

---

### `onSaveSuccess(response)`
**Description:** Success handler for `saveStudent()`. Calls `setModalLoading(false)`, `closeModal()`, and `loadStudents()`.
**Parameters:**
- `response` (object): Server response (not inspected; any successful return triggers reload)
**Returns:** void

---

### `onSaveFailure(error)`
**Description:** Failure handler for `saveStudent()`. Calls `setModalLoading(false)` and shows the error in the modal alert.
**Parameters:**
- `error` (Error): GAS failure error object
**Returns:** void

---

### `deleteSelected()`
**Description:** If `selectedStudent` is set, shows a `window.confirm()` with the student's name. On confirmation: disables Delete button (shows "Deleting…"), then calls `google.script.run.deleteStudent(selectedStudent)`.
**Parameters:** none
**Returns:** void

---

### `onDeleteSuccess(response)`
**Description:** Resets the Delete button text and calls `loadStudents()` to refresh the roster.
**Parameters:**
- `response` (object): Server response (not inspected)
**Returns:** void

---

### `onDeleteFailure(error)`
**Description:** Shows a native `alert()` with the error message and re-enables the Delete button.
**Parameters:**
- `error` (Error): GAS failure error object
**Returns:** void

---

### `setModalLoading(isLoading)`
**Description:** Disables/enables the modal's Save button and toggles its label between `'Save Student'` and `'Saving...'`.
**Parameters:**
- `isLoading` (boolean): Whether the save operation is in progress
**Returns:** void

---

### `showAlert(message, type, elementId)`
**Description:** Finds the element with the given `elementId`, sets its text, CSS class (`alert-danger` or `alert-success`), and makes it visible.
**Parameters:**
- `message` (string): Alert text
- `type` (string): `'danger'` or `'success'`
- `elementId` (string): ID of the target alert element
**Returns:** void

---

### `clearAlerts()`
**Description:** Hides the `#alert` element inside the modal.
**Parameters:** none
**Returns:** void
