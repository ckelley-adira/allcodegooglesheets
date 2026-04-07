# PreKPortal.html (Pre-K UI Template)

## 📋 Overview
The Teacher Tracker interface for Pre-K and Pre-School students. Displayed as the `?page=teacher` web app page. Teachers use this to record per-student assessments for three skills (Letter Form, Letter Name, Letter Sound for Pre-K; Letter Sound only for Pre-School) across configurable letter sequences. The workflow is a cascading 4-step selection: Group → Student → Sequence → Assessment card. Each letter is scored with Y (Yes / mastered), N (No / not yet), or A (N/A).

## 📜 Business Rules
- Cascading dependency chain: selecting a group enables the student dropdown; selecting a student loads sequences; selecting a sequence loads the assessment card. Each upstream change resets all downstream selections.
- Student objects carry a `program` property that determines which skill columns are shown/saved.
- Lesson icon is inferred from lesson name: names containing "Form" → ✏️, "Name" → 🔤, "Sound" → 🔊, otherwise 📝.
- Toggle behavior: clicking an already-active button deselects it (clears the value); clicking a different button deselects others and selects the new one.
- Save is disabled until a sequence is loaded; it re-enables after a successful save (which also reloads the assessment to reflect persisted values).
- Haptic feedback (`navigator.vibrate(10)`) is triggered on button toggle if supported by the device.
- Keyboard shortcuts on assessment buttons: `Y`/`1` → Yes, `N`/`2` → No, `A`/`3` → N/A, Arrow keys navigate between buttons, `Ctrl+S`/`Cmd+S` triggers save.
- After a successful save, the assessment area is reloaded via `loadFilteredLessons()` to show updated values.

## 📥 Data Inputs

### Dropdown Selectors (UI)
| Field | ID | Type | Purpose |
|-------|----|------|---------|
| Group | `group-select` | `<select>` | Filter students by learning group |
| Student | `student-select` | `<select>` | Select the student to assess; disabled until group chosen |
| Sequence | `sequence-select` | `<select>` | Select a letter sequence; disabled until student chosen |

### Assessment Card
Dynamically built per lesson. Each lesson item has three toggle buttons: **Y**, **N**, **A**.

### Data Loaded from Server
| Function | Data Returned |
|----------|--------------|
| `getGroups()` | Array of group name strings |
| `getStudentsByGroup(groupVal)` | Array of `{ name, program }` objects |
| `getSequences(currentGroup)` | Array of `{ sequenceName, letters }` objects |
| `getFilteredAssessmentData(studentName, program, group, sequenceVal)` | `{ lessons: string[], currentData: { [lessonName]: 'Y'|'N'|'A'|'' } }` |

## 📤 Outputs
| Action | Result |
|--------|--------|
| Save button click | Calls `saveAssessmentData({ studentName, program, assessments })` |
| Successful save | Success toast shown; assessment reloads with updated values |
| Portal nav links | `getWebAppUrl()` called; `window.top` redirected |

## 🔗 Dependencies
### Server Functions Called (`google.script.run`)
| Function | Purpose |
|----------|---------|
| `getWebAppUrl()` | Retrieve web app base URL for portal navigation |
| `getGroups()` | Load list of group names for the group dropdown |
| `getStudentsByGroup(groupVal)` | Load students belonging to the selected group |
| `getSequences(currentGroup)` | Load letter sequences available for the current group |
| `getFilteredAssessmentData(studentName, program, group, sequenceVal)` | Load lesson list and existing assessment data for the selected student/sequence |
| `saveAssessmentData(dataObject)` | Persist Y/N/A assessment values to the sheet |

### Called From (which .gs opens this HTML)
- `PreKMainCode.gs` — serves this page when `?page=teacher` is in the web app URL.

## ⚙️ Client-Side JavaScript Functions

### `navigateToPortal(page)`
**Description:** Fetches the web app URL and redirects `window.top` to the specified portal page.
**Parameters:**
- `page` (string): Page identifier; empty string for home
**Returns:** void

### `loadGroups()`
**Description:** Shows loader and calls `getGroups()` on the server to populate the group dropdown.
**Parameters:** none
**Returns:** void

### `loadStudents()`
**Description:** Triggered by group dropdown change. Resets student/sequence dropdowns, then calls `getStudentsByGroup(groupVal)`.
**Parameters:** none (reads `#group-select` value)
**Returns:** void

### `loadSequencesForGroup()`
**Description:** Triggered by student dropdown change. Resolves the student object from `studentList`, then calls `getSequences(currentGroup)`.
**Parameters:** none (reads `#student-select` value)
**Returns:** void

### `loadFilteredLessons()`
**Description:** Triggered by sequence dropdown change (and called after a successful save). Calls `getFilteredAssessmentData()` with the current student, program, group, and sequence.
**Parameters:** none (reads `#sequence-select` value)
**Returns:** void

### `populateGroups(groups)`
**Description:** Fills the group `<select>` with options from the groups array.
**Parameters:**
- `groups` (string[]): Array of group name strings
**Returns:** void

### `populateStudents(students)`
**Description:** Stores the student list in the module-level `studentList` variable and fills the student `<select>`.
**Parameters:**
- `students` (array): Array of `{ name, program }` objects
**Returns:** void

### `populateSequences(sequences)`
**Description:** Fills the sequence `<select>` with options. Option text format: `"SequenceName: letters"`.
**Parameters:**
- `sequences` (array): Array of `{ sequenceName, letters }` objects
**Returns:** void

### `clearAssessmentArea()`
**Description:** Resets the assessment area to the placeholder HTML, hides the save button container, and disables the save button.
**Parameters:** none
**Returns:** void

### `buildForm(data)`
**Description:** Builds the assessment card grid from server data. Creates one `createButtonGroup()` per lesson and shows the save button.
**Parameters:**
- `data` (object): `{ lessons: string[], currentData: { [lessonName]: string } }`
**Returns:** void

### `createButtonGroup(fullName, labelText, currentVal)`
**Description:** Creates a single assessment item div containing a label with an emoji icon and a Y/N/A button group.
**Parameters:**
- `fullName` (string): The lesson's internal identifier (used as `data-lesson` attribute)
- `labelText` (string): Display label for the lesson
- `currentVal` (string): Previously saved value (`'Y'`, `'N'`, `'A'`, or `''`)
**Returns:** HTMLDivElement

### `createButton(val, txt, lName, currentVal)`
**Description:** Creates a single status toggle button with ARIA role/checked attributes. Pre-activates if `val === currentVal`.
**Parameters:**
- `val` (string): Button value — `'Y'`, `'N'`, or `'A'`
- `txt` (string): Display text — `'Yes'`, `'No'`, or `'N/A'`
- `lName` (string): Lesson name (used for aria-label)
- `currentVal` (string): Currently saved value for pre-selection
**Returns:** HTMLButtonElement

### `toggleButtonSelection(btnEl)`
**Description:** Handles button clicks — deselects if already active; otherwise clears siblings and activates the clicked button. Triggers haptic feedback if available.
**Parameters:**
- `btnEl` (HTMLButtonElement): The button element that was clicked
**Returns:** void

### `saveData()`
**Description:** Collects all Y/N/A values from the assessment grid, builds the data payload, and calls `saveAssessmentData()` on the server.
**Parameters:** none
**Returns:** void

### `updateCardState(id, hasVal)`
**Description:** Adds or removes the `has-value` CSS class on a card element to indicate whether it has a selection.
**Parameters:**
- `id` (string): DOM element ID
- `hasVal` (boolean): Whether a value is selected
**Returns:** void

### `showLoader(msg)`, `hideLoader()`
**Description:** Show or hide the full-page loading spinner overlay with a message.
**Parameters:** `msg` (string) — loader message text (showLoader only)
**Returns:** void

### `showError(err)`
**Description:** Hides loader, displays an error status message, and re-enables controls.
**Parameters:**
- `err` (Error | string): Error to display
**Returns:** void

### `showSuccess(msg)`
**Description:** Hides loader, shows a success toast, re-enables save button, and reloads the assessment.
**Parameters:**
- `msg` (string): Success message from server
**Returns:** void

### `showStatus(msg, type)`, `clearStatus()`
**Description:** Show/clear a status message in `#status-container`. Auto-clears after 5 seconds.
**Parameters:** `msg` (string), `type` (string, default `'info'`) — CSS class modifier
**Returns:** void

### `addKeyboardSupport()`
**Description:** Attaches a `keydown` listener enabling Y/N/A keyboard shortcuts and Ctrl+S save shortcut when assessment buttons are focused.
**Parameters:** none
**Returns:** void
