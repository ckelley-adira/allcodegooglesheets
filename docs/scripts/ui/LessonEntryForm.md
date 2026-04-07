# LessonEntryForm.html (UI Template)

## 📋 Overview

`LessonEntryForm.html` is a **4-step sequential data-entry form** rendered as a Google Sheets dialog (max 800 px wide, responsive). It is the primary tool teachers use to record daily UFLI lesson results for a single group session.

The user experience is linear and self-disclosing:
1. **Select Grade** — choose the grade-level sheet (e.g., "KG & G1").
2. **Select Group** — choose a specific intervention group; disabled until a grade is chosen.
3. **Select Lesson** — choose the UFLI lesson taught; hidden until a group is loaded.
4. **Mark Student Status** — per-student Y/N/A/U buttons with bulk-action helpers; hidden until a group is loaded.

Selecting a lesson pre-populates any existing Y/N/A/U data for that lesson, allowing teachers to review and correct prior entries. The form uses the "TILT Design System" CSS (`--tilt-cream`, `--tilt-mint`, etc.) and is branded via `getBranding()` template expressions.

---

## 📜 Business Rules

- **Grade-first cascade:** The group dropdown is disabled until a grade sheet is selected. Lesson and student sections remain hidden until a group is selected.
- **Lesson pre-population:** When a lesson is chosen, existing per-student data is fetched from the sheet and pre-selected on the status buttons. An "Editing existing lesson data" banner is shown when editing.
- **Status values:** Each student may be marked `Y` (Yes/Passed), `N` (No/Did Not Pass), `A` (Absent), or `U` (Unenrolled). Only one status per student may be selected.
- **Submission validation:**
  - A group must be selected.
  - A lesson must be selected.
  - At least one student must have a status set.
- **Unenrolled tracking:** Students marked `U` are collected separately and reported in the save result as flagged for unenrollment.
- **Teacher name extraction:** The teacher's name is inferred from the group name pattern `"Group N - T. Name"` and stored in a hidden field, then included in the submitted payload.
- **Group sorting:** Groups are sorted by grade order then by group number (e.g., KG Group 1, KG Group 2, G1 Group 1…).
- **Success auto-clear:** After a successful save, all student status selections are cleared so the teacher can begin the next group entry. Success messages auto-dismiss after 5 seconds.

---

## 📥 Data Inputs

### Form Fields

| Field / Element ID | Type | Purpose |
|--------------------|------|---------|
| `grade-select` | `select` | Choose grade-level sheet; triggers `onGradeSelected()` |
| `group-select` | `select` | Choose intervention group; disabled until grade chosen; triggers `onGroupSelected()` |
| `lesson-select` | `select` | Choose UFLI lesson; triggers `onLessonSelected()` |
| `teacher-name` | `hidden` | Auto-populated from group name; included in submission payload |
| `status-<index>` (dynamic) | `hidden` | One per student; stores the chosen Y/N/A/U value |
| Status buttons (dynamic) | `button` | Visual Y / N / A / U toggles rendered per student in `#student-list` |

### Data Loaded from Server via `google.script.run`

| Call | When | Returns |
|------|------|---------|
| `getGroupsAndSheets_MixedGrade()` | On `DOMContentLoaded` | `{ groups[], groupsBySheet: { [sheetName]: groupName[] } }` — all available grade sheets and groups |
| `getLessonsAndStudentsForGroup(groupName)` | After group selection | `{ lessons[{ name }], students[] }` — available lessons and enrolled students for the selected group |
| `getExistingLessonData(gradeSheet, groupName, lessonName)` | After lesson selection | `{ [studentName]: 'Y'|'N'|'A'|'U' }` — prior status entries for that lesson |

### Template Variables

- `<?= getBranding().schoolName ?>` — School name shown in the page header.
- `<?= getBranding().tagline ?>` — School tagline shown below the school name.

---

## 📤 Outputs

### `saveLessonData(formData)` — called on submit

The server function receives a single `formData` object:
```js
{
  gradeSheet: string,          // Selected sheet name
  groupName: string,           // Selected group name
  lessonName: string,          // Selected lesson name
  teacherName: string,         // Extracted from group name
  studentStatuses: [           // Only students with a status set
    { name: string, status: 'Y'|'N'|'A'|'U' }
  ],
  unenrolledStudents: string[] // Names of students marked 'U'
}
```

**On success:** shows a success message (including unenrolled count if any), clears all status selections.
**On failure:** shows an error alert; re-enables the submit button.

---

## 🔗 Dependencies

### Server Functions Called (`google.script.run`)

| Function | Purpose |
|----------|---------|
| `getGroupsAndSheets_MixedGrade()` | Load all available grade sheets and groups |
| `getLessonsAndStudentsForGroup(groupName)` | Load lessons and student roster for selected group |
| `getExistingLessonData(gradeSheet, groupName, lessonName)` | Fetch existing Y/N/A/U data for a lesson |
| `saveLessonData(formData)` | Persist lesson entry data to the sheet |

### Called From (which .gs opens this HTML)

- **`gold-standard-template/SetupWizard.gs`** — line 441:
  ```js
  HtmlService.createHtmlOutputFromFile('LessonEntryForm')
  ```

---

## ⚙️ Client-Side JavaScript Functions

### Global State

```js
let allGroups = [];        // All groups across all sheets
let groupsBySheet = {};    // { sheetName: [groupName, ...] }
let currentStudents = [];  // Students in currently selected group
let currentLessons = [];   // Lessons available for current group
```

---

### `loadGradesAndGroups()`
**Description:** Entry point called on `DOMContentLoaded`. Calls `google.script.run.getGroupsAndSheets_MixedGrade()`. On success, stores the results in `allGroups` and `groupsBySheet`, then calls `populateGradeDropdown()`. On failure, shows an error alert.
**Parameters:** none
**Returns:** void

---

### `populateGradeDropdown(sheetNames)`
**Description:** Clears and repopulates `#grade-select` with options derived from `sheetNames`. Sheet names are sorted by the first grade code they contain, using a `GRADE_ORDER` constant (`PreK`=0 … `G8`=9). Display text strips `" Groups"` and reformats separators (e.g., `"KG and G1 Groups"` → `"KG & G1"`).
**Parameters:**
- `sheetNames` (string[]): Array of grade-level sheet names from the server
**Returns:** void

---

### `onGradeSelected()`
**Description:** `onchange` handler for `#grade-select`. Calls `resetGroupSelection()`, then populates `#group-select` with groups belonging to the selected sheet. Groups are sorted by grade order then by group number. Enables the group dropdown.
**Parameters:** none
**Returns:** void

---

### `resetGroupSelection()`
**Description:** Hides `#lesson-section` and `#student-section`, disables `#submit-btn`, empties the student list and lesson dropdown, and resets `currentStudents` / `currentLessons` to empty arrays.
**Parameters:** none
**Returns:** void

---

### `onGroupSelected()`
**Description:** `onchange` handler for `#group-select`. Shows the loader spinner, then calls `google.script.run.getLessonsAndStudentsForGroup(groupName)`. On success: hides loader, populates lessons and students, extracts teacher name from the group name, reveals lesson and student sections, and enables the submit button. On failure: hides loader and shows an error alert.
**Parameters:** none
**Returns:** void

---

### `populateLessons(lessons)`
**Description:** Clears and repopulates `#lesson-select` with one `<option>` per lesson object.
**Parameters:**
- `lessons` (Array\<{name: string}\>): Lesson objects from the server
**Returns:** void

---

### `onLessonSelected()`
**Description:** `onchange` handler for `#lesson-select`. If a valid lesson and group are selected, shows a loading state in the student list and calls `google.script.run.getExistingLessonData(gradeSheet, groupName, lessonName)`. On success: calls `populateStudents()` with the existing data map. On failure: calls `populateStudents()` with an empty map (graceful degradation).
**Parameters:** none
**Returns:** void

---

### `populateStudents(students, existingData)`
**Description:** Clears and rebuilds `#student-list`. For each student, renders a table row with four status buttons (Y, N, A, U) and a hidden `status-<index>` input. If `existingData` contains a value for the student, the corresponding button is pre-selected. Prepends an "Editing existing lesson data" banner row when `existingData` is non-empty.
**Parameters:**
- `students` (string[]): Array of student name strings
- `existingData` (object): Map of `{ studentName: 'Y'|'N'|'A'|'U' }`, may be empty
**Returns:** void

---

### `setStatus(index, status, button)`
**Description:** Updates `#status-<index>` hidden input to `status`, removes `selected` class from all sibling status buttons in the row, and adds `selected` to `button`.
**Parameters:**
- `index` (number): Student row index (0-based)
- `status` (string): Status code — `'Y'`, `'N'`, `'A'`, or `'U'`
- `button` (HTMLButtonElement): The clicked status button element
**Returns:** void

---

### `setAllStatus(status)`
**Description:** Sets all `status-<index>` hidden inputs to `status`, then updates button styling for every student row: removes `selected` from all buttons and adds `selected` to the button matching the target status class.
**Parameters:**
- `status` (string): Status code — `'Y'`, `'N'`, or `'A'`
**Returns:** void

---

### `clearAllStatus()`
**Description:** Sets all `status-<index>` inputs to `''` and removes `selected` from all status buttons.
**Parameters:** none
**Returns:** void

---

### `submitLessonData()`
**Description:** Validates that a group and lesson are selected and that at least one student has a status. Collects `studentStatuses[]` and `unenrolledStudents[]` from the hidden inputs. Disables the submit button with "Saving…" text, then calls `google.script.run.saveLessonData(formData)`. On success: re-enables the button, shows a success message (appending unenrolled count if any), and calls `clearAllStatus()`. On failure: re-enables the button and shows an error alert.
**Parameters:** none
**Returns:** void

---

### `showAlert(message, type)`
**Description:** Sets `#alert` element text and CSS class (`success` or `error`). Success alerts auto-dismiss after 5 seconds.
**Parameters:**
- `message` (string): Message text
- `type` (string): `'success'` or `'error'`
**Returns:** void

---

### `escapeHtml(text)`
**Description:** Sanitises a string for safe insertion into HTML by temporarily assigning it as `textContent` to a `<div>` and reading back `innerHTML`.
**Parameters:**
- `text` (string): Raw user-facing text (e.g., student name)
**Returns:** (string) HTML-escaped string
