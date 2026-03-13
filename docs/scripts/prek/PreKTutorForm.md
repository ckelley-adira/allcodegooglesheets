# PreKTutorForm.html (Pre-K UI Template)

## 📋 Overview
A mobile-optimized **Tutor Session Tracker** for the MZA PreK Program. Tutors and volunteers use this form during one-on-one sessions to record letter-level assessments (Letter Form, Letter Name, Letter Sound) for individual Pre-K students, or to mark a student absent.

**When shown:** Opened as a web app page within the Pre-K Portal (via `PreKMainCode.gs`). It is the "Tutor" tab in the portal navigation bar.

**User experience:**
1. Tutor selects their own name from a dropdown populated on load.
2. Tutor selects a student (enabled after tutor is chosen).
3. Session options appear: **Start Lesson** or **Mark Absent**.
4. If **Start Lesson**: the tutor picks a letter from a smart dropdown (suggested "Needs Work" letters shown first, then all available letters).
5. An assessment card appears with Y/N toggle buttons for three skills: Letter Form, Letter Name, Letter Sound.
6. The tutor taps **Save Session** (sticky footer button), which submits data to the server.
7. On success the form resets for the next letter; if the save was an absence the form resets fully.

The UI is fully touch-friendly, includes haptic feedback (`navigator.vibrate`), and supports keyboard shortcuts (Y/N/1/2 for quick status entry, Ctrl+S to save).

---

## 📜 Business Rules
- The **student dropdown is disabled** until a tutor name is selected.
- Session options (Start Lesson / Mark Absent) are not visible until a student is selected.
- The lesson dropdown prioritizes letters flagged "Needs Work" in a separate optgroup, then lists all available letters.
- At least one skill status (Form, Name, or Sound) must be selected before saving; otherwise an error is shown.
- After a **lesson save** (`showSuccess` receives a non-absent message) the form resets only to letter selection (`resetForNextLetter()`), keeping tutor and student context.
- After an **absence save** (`showSuccess` receives a message containing `"absent"`) the form resets completely (`resetStudent()`).
- The save button is **disabled** while a save is in progress and re-enabled on error.
- Status messages auto-clear after 5 seconds.
- Portal navigation links load other pages by fetching the web app URL from the server and redirecting `window.top`.

---

## 📥 Data Inputs

### Step 1 — Tutor Selection
| Element ID | Type | Purpose |
|---|---|---|
| `tutor-select` | `<select>` | Tutor's own name; options loaded from server on DOMContentLoaded |

### Step 2 — Student Selection
| Element ID | Type | Purpose |
|---|---|---|
| `student-select` | `<select>` | Student name; disabled until tutor selected; options loaded from server on DOMContentLoaded |

### Step 3 — Letter Selection
| Element ID | Type | Purpose |
|---|---|---|
| `lesson-select` | `<select>` | Letter to assess; populated by server based on student + program |

### Step 4 — Assessment Card (dynamically generated)
| Element | Type | Purpose |
|---|---|---|
| `lesson-letter` (hidden input) | hidden | Stores the selected letter value |
| `.lesson-group[data-skill="Form"]` buttons | Y/N toggle | Letter Form assessment status |
| `.lesson-group[data-skill="Name"]` buttons | Y/N toggle | Letter Name assessment status |
| `.lesson-group[data-skill="Sound"]` buttons | Y/N toggle | Letter Sound assessment status |

### Data Loaded from Server via `google.script.run`
| Server Function | Handler | Data Returned |
|---|---|---|
| `getTutorNames()` | `populateTutors(tutors)` | `string[]` — list of tutor names |
| `getStudentRoster()` | `cacheStudents(students)` | `Array<{name, program}>` — all students |
| `getTutorLessonList(studentName, program)` | `populateTutorLessonList(data)` | `{needsWork: string[], otherLetters: string[]}` |
| `getWebAppUrl()` | anonymous inline | `string` — base web app URL for navigation |

---

## 📤 Outputs

### Mark Absent (`markAbsent()`)
```
google.script.run
  .withSuccessHandler(showSuccess)
  .withFailureHandler(showError)
  .saveTutorAbsence({ tutor, student })
```

### Save Session (`saveData()`)
```
google.script.run
  .withSuccessHandler(showSuccess)
  .withFailureHandler(showError)
  .saveTutorSession({
    tutor,
    student,
    program,
    lesson,
    formStatus,   // "Y" | "N" | ""
    nameStatus,   // "Y" | "N" | ""
    soundStatus   // "Y" | "N" | ""
  })
```

### Navigation (`navigateToPortal(page)`)
```
google.script.run
  .withSuccessHandler(function(url) { window.top.location.href = url + '?page=' + page })
  .getWebAppUrl()
```

---

## 🔗 Dependencies

### Server Functions Called (`google.script.run`)
| Function | Called In | Purpose |
|---|---|---|
| `getWebAppUrl()` | `navigateToPortal(page)` | Fetches base URL for portal navigation |
| `getTutorNames()` | `DOMContentLoaded` | Populates tutor dropdown |
| `getStudentRoster()` | `DOMContentLoaded` | Caches full student list with program info |
| `getTutorLessonList(name, program)` | `loadTutorLessonList()`, `resetForNextLetter()` | Gets suggested + all available letters for student |
| `saveTutorAbsence(data)` | `markAbsent()` | Records absence for tutor/student pair |
| `saveTutorSession(data)` | `saveData()` | Saves letter assessment results |

### Called From
- **`PreKMainCode.gs`** — serves this file as the "Tutor" page of the Pre-K web app portal.

---

## ⚙️ Client-Side JavaScript Functions

### `navigateToPortal(page)`
**Description:** Fetches the web app URL from the server and redirects `window.top` to the specified portal page. Navigates to the root if `page` is empty.  
**Parameters:**
- `page` (string): Portal page identifier (e.g., `'teacher'`, `'dashboard'`, or `''` for home)  
**Returns:** void

### `populateTutors(tutors)`
**Description:** Success handler for `getTutorNames()`. Replaces the `tutor-select` options with the returned list, then hides the loader.  
**Parameters:**
- `tutors` (string[]): List of tutor name strings  
**Returns:** void

### `cacheStudents(students)`
**Description:** Success handler for `getStudentRoster()`. Stores the full student array in the module-level `studentRoster` variable and populates the `student-select` dropdown. Enables the dropdown if a tutor is already selected.  
**Parameters:**
- `students` (Array<{name: string, program: string}>): Full student roster  
**Returns:** void

### `resetStudent()`
**Description:** Resets all UI state below the tutor dropdown: disables student select, clears its value, hides session options, lesson select, assessment area, and save button. Clears `currentStudent`.  
**Parameters:** none  
**Returns:** void

### `showSessionOptions()`
**Description:** `onchange` handler for `student-select`. Sets `currentStudent` from the cached `studentRoster`, shows the session-options area (Start Lesson / Mark Absent buttons), and hides lesson/assessment areas.  
**Parameters:** none  
**Returns:** void

### `loadTutorLessonList()`
**Description:** Validates `currentStudent`, shows a loader, hides session options, and calls `getTutorLessonList(studentName, program)` on the server.  
**Parameters:** none  
**Returns:** void

### `populateTutorLessonList(data)`
**Description:** Success handler for `getTutorLessonList()`. Rebuilds the `lesson-select` dropdown with two optgroups: "Suggested (Needs Work)" and "All Available Letters". Shows the lesson select area.  
**Parameters:**
- `data` (object): `{ needsWork: string[], otherLetters: string[] }`  
**Returns:** void

### `showLessonCard()`
**Description:** `onchange` handler for `lesson-select`. Dynamically builds the assessment card HTML (selected-letter display, three skill groups with Y/N buttons) inside `#assessment-area`, then shows the area and the sticky save button. Clears the area if no letter is selected.  
**Parameters:** none  
**Returns:** void

### `toggleButton(buttonEl)`
**Description:** Handles Y/N skill button selection. Clicking an already-active button deselects it. Clicking the other button deselects siblings and activates itself. Triggers haptic feedback (`navigator.vibrate(10)`) on mobile.  
**Parameters:**
- `buttonEl` (HTMLElement): The clicked `.status-btn` button element  
**Returns:** void

### `markAbsent()`
**Description:** Validates that a tutor and student are selected, shows loader, hides session options, and calls `saveTutorAbsence({ tutor, student })` on the server.  
**Parameters:** none  
**Returns:** void

### `saveData()`
**Description:** Collects assessment results from all three skill group buttons, validates at least one skill has a status, disables the save button, shows loader, and calls `saveTutorSession(data)` on the server.  
**Parameters:** none  
**Returns:** void

### `resetForNextLetter()`
**Description:** After a successful lesson save, resets the assessment area and save button without clearing tutor/student context. Resets the lesson dropdown and re-calls `getTutorLessonList()` to refresh "Needs Work" suggestions.  
**Parameters:** none  
**Returns:** void

### `updateCardState(id, hasVal)`
**Description:** Adds or removes the `has-value` CSS class on the card with the given `id`, used for visual state indication.  
**Parameters:**
- `id` (string): Element ID of the card  
- `hasVal` (boolean): Whether the card has a value selected  
**Returns:** void

### `showLoader(msg)`
**Description:** Shows the full-page loader overlay with the provided message text. Also clears any existing status messages.  
**Parameters:**
- `msg` (string): Loading message to display  
**Returns:** void

### `hideLoader()`
**Description:** Hides the loader overlay.  
**Parameters:** none  
**Returns:** void

### `showError(err)`
**Description:** Hides loader, re-enables the save button, restores session options area if a student is selected, and displays the error message in the status container with `'error'` type.  
**Parameters:**
- `err` (Error|string): The error to display  
**Returns:** void

### `showSuccess(message)`
**Description:** Hides loader and displays a success status message. If the message contains `"absent"`, calls `resetStudent()` after 2 seconds. Otherwise calls `resetForNextLetter()` immediately. Wrapped in try/catch with a fallback to `resetStudent()`.  
**Parameters:**
- `message` (string): Success message from server  
**Returns:** void

### `showStatus(msg, type)`
**Description:** Injects a styled status message `<div>` into `#status-container`. Auto-clears after 5 seconds via `clearStatus()`.  
**Parameters:**
- `msg` (string): Message text  
- `type` (string): CSS class type — `'info'`, `'error'`, or `'success'` (default `'info'`)  
**Returns:** void

### `clearStatus()`
**Description:** Empties the `#status-container` element.  
**Parameters:** none  
**Returns:** void

### `addKeyboardSupport()`
**Description:** Attaches a `keydown` listener to the document for keyboard shortcuts: Y/1 = select Yes, N/2 = select No, ArrowRight/Left = navigate between Y/N buttons within the focused group. Ctrl+S / Cmd+S triggers the save button if it is visible and enabled.  
**Parameters:** none  
**Returns:** void
