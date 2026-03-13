# PreKSetupWizard.html (Pre-K UI Template)

## 📋 Overview
A 7-step site onboarding wizard for the **Adira Reads PreK and Pre-School Program**. Administrators run this wizard once per site to configure a new Google Sheets deployment. Each step collects a distinct category of setup data. On completion, all collected data is sent to the server in a single call that provisions the entire spreadsheet configuration.

**When shown:** Opened by an administrator from the Apps Script menu (via `PreKMainCode.gs`) when setting up a new site for the first time.

**User experience:** A visually stepped form (progress bar with 7 numbered steps) guides the user through Site Info → Programs → Groups → Students → Staff → Schedule → Review & Submit. Navigation buttons allow forward/backward movement. Step 1 (Site Name) is the only hard-required field before advancing. A full-page loading overlay appears during the server submission, replaced by a success screen on completion.

---

## 📜 Business Rules
- **Site Name** (Step 1) is the only mandatory field validated before advancing. The wizard blocks forward navigation with an `alert()` if it is empty.
- **Program selection** (Step 2) requires at least one program checkbox checked. Defaults to `['Pre-K']` if none are selected at data-collection time.
- **Student roster** (Step 4) requires at least one named student before the final submission can proceed.
- Group name inputs default to alphabetic labels ("Group A", "Group B", …) but are fully editable.
- Student dropdowns for group and program assignment are refreshed automatically when the user enters Step 4, reflecting any changes made in earlier steps.
- `sessions-per-week` × `session-duration` is computed and displayed read-only as "Weekly Instructional Minutes" (Step 6).
- The **Review step** (Step 7) shows a live summary of all entered data before submission; it is read-only and populated by `populateSummary()`.
- On successful setup the wizard replaces all step content with a success screen and hides navigation buttons. The only action available is closing the dialog.

---

## 📥 Data Inputs

### Step 1 — Site Information
| Field ID | Type | Purpose |
|---|---|---|
| `site-name` | text (required) | Name of the program site |
| `site-code` | text | Optional branch/location code (e.g., "E10") |
| `site-phone` | tel | Contact phone number |
| `site-address` | text | Full street address |
| `coordinator-name` | text | Site coordinator full name |
| `coordinator-email` | email | Coordinator email address |

### Step 2 — Programs
| Field ID | Type | Purpose |
|---|---|---|
| `program-prek` | checkbox | Enable Pre-K Program (checked by default) |
| `program-preschool` | checkbox | Enable Pre-School Program |
| `academic-year` | select | Academic year (2024-2025 / 2025-2026 / 2026-2027) |
| `start-date` | date | Program start date (defaults to today) |

### Step 3 — Groups
| Field ID | Type | Purpose |
|---|---|---|
| `num-groups` | select | Number of groups (1–10, default 3) |
| `.group-name` (dynamic) | text | Name for each group (auto-labeled A, B, …) |

### Step 4 — Students
| Field | Type | Purpose |
|---|---|---|
| `.student-name` (dynamic) | text | Student full name |
| `.student-group` (dynamic) | select | Group assignment (options drawn from Step 3) |
| `.student-program` (dynamic) | select | Program assignment (Pre-K or Pre-School) |
| `bulk-students` | textarea | Bulk import: one student name per line |

### Step 5 — Staff
| Field | Type | Purpose |
|---|---|---|
| `.teacher-name` (dynamic) | text | Teacher full name |
| `.teacher-email` (dynamic) | email | Teacher email (optional) |
| `.tutor-name` (dynamic) | text | Tutor/volunteer name |
| `bulk-tutors` | textarea | Bulk import: one name per line (add as teacher or tutor) |

### Step 6 — Schedule
| Field ID | Type | Purpose |
|---|---|---|
| `sessions-per-week` | select | 1–5 sessions per week (default 2) |
| `session-duration` | select | 30 / 45 / 60 / 90 minutes (default 45) |
| `total-minutes` | text (readonly) | Calculated weekly minutes |
| `time-mon` … `time-fri` | time | Optional session times per weekday |
| `schedule-notes` | textarea | Free-text scheduling notes |

### Data Loaded from Server
None — this wizard is entirely user-driven. No `google.script.run` calls are made until final submission.

---

## 📤 Outputs

### On Submit (`submitWizard()`)
All form data is collected into a structured object by `collectWizardData()` and sent to the server:

```
google.script.run
  .withSuccessHandler(onSetupSuccess)
  .withFailureHandler(onSetupError)
  .setupNewSite(data)
```

The `data` object contains:
```json
{
  "site": { "name", "code", "address", "phone", "coordinatorName", "coordinatorEmail" },
  "programs": { "selected": [...], "academicYear", "startDate" },
  "groups": ["Group A", "Group B", ...],
  "students": [{ "name", "group", "program" }, ...],
  "teachers": ["Name", ...],
  "tutors": ["Name", ...],
  "schedule": {
    "sessionsPerWeek", "sessionDuration",
    "times": { "mon", "tue", "wed", "thu", "fri" },
    "notes"
  }
}
```

### On Success
`onSetupSuccess(result)` hides navigation, shows the success screen, and displays `result.message`.

### On Error
`onSetupError(error)` hides the loading overlay and shows an `alert()` with the error message.

---

## 🔗 Dependencies

### Server Functions Called (`google.script.run`)
| Function | When Called | Purpose |
|---|---|---|
| `setupNewSite(data)` | `submitWizard()` | Provisions all site sheets with wizard data |

### Called From
- **`PreKMainCode.gs`** — opens this dialog from the Apps Script menu when setting up a new Pre-K site.

---

## ⚙️ Client-Side JavaScript Functions

### `initializeProgramOptions()`
**Description:** Adds click-toggle behavior to program checkbox cards so clicking the card label toggles the visual `selected` class in sync with the underlying checkbox.  
**Parameters:** none  
**Returns:** void

### `updateTotalMinutes()`
**Description:** Reads `sessions-per-week` and `session-duration` selects and writes the computed weekly minutes (and hours) into the read-only `total-minutes` input.  
**Parameters:** none  
**Returns:** void

### `updateGroupsList()`
**Description:** Regenerates the dynamic group-name input list based on the current value of the `num-groups` select. Defaults names to "Group A", "Group B", etc.  
**Parameters:** none  
**Returns:** void

### `addStudent()`
**Description:** Appends a new student row (name input, group select, program select, remove button) to the `#students-list` container. Populates selects from current group/program state.  
**Parameters:** none  
**Returns:** void

### `bulkAddStudents()`
**Description:** Reads the `bulk-students` textarea, splits on newlines, and calls the equivalent of `addStudent()` for each name found. Clears the textarea afterward.  
**Parameters:** none  
**Returns:** void

### `addTeacher()`
**Description:** Appends a teacher row (name + email inputs, remove button) to `#teachers-list`.  
**Parameters:** none  
**Returns:** void

### `addTutor()`
**Description:** Appends a tutor row (name input, remove button) to `#tutors-list`.  
**Parameters:** none  
**Returns:** void

### `bulkAddStaff(type)`
**Description:** Reads the `bulk-tutors` textarea and creates rows in either the teachers list or the tutors list depending on `type`.  
**Parameters:**
- `type` (string): `'teachers'` or `'tutors'`  
**Returns:** void

### `getGroupNames()`
**Description:** Collects current values of all `.group-name` inputs and returns them as an array.  
**Parameters:** none  
**Returns:** `string[]` — array of group name strings

### `getSelectedPrograms()`
**Description:** Returns an array of checked program values (`'Pre-K'`, `'Pre-School'`). Falls back to `['Pre-K']` if nothing is checked.  
**Parameters:** none  
**Returns:** `string[]`

### `nextStep()`
**Description:** Validates the current step via `validateStep()` then advances to the next step via `setStep()`.  
**Parameters:** none  
**Returns:** void

### `prevStep()`
**Description:** Navigates to the previous step if `currentStep > 1`.  
**Parameters:** none  
**Returns:** void

### `setStep(step)`
**Description:** Transitions the wizard to the given step number. Updates progress bar styling, shows/hides the correct step content panel, toggles Prev/Next/Submit button visibility, calls `populateSummary()` on step 7, and calls `refreshStudentDropdowns()` on step 4.  
**Parameters:**
- `step` (number): Target step number (1–7)  
**Returns:** void

### `validateStep(step)`
**Description:** Client-side validation gate called before advancing. Step 1 requires a non-empty site name. Step 2 requires at least one program selected. All other steps pass without restriction.  
**Parameters:**
- `step` (number): The step number to validate  
**Returns:** `boolean` — `true` if valid, `false` (with alert) if not

### `refreshStudentDropdowns()`
**Description:** Re-renders group and program `<select>` elements inside each existing student row to reflect the latest group names and selected programs from Steps 2–3. Preserves previously selected values when still valid.  
**Parameters:** none  
**Returns:** void

### `populateSummary()`
**Description:** Reads all form values and populates the Step 7 review summary lists: `#summary-site`, `#summary-programs`, `#summary-groups`, `#summary-staff`, and `#summary-schedule`.  
**Parameters:** none  
**Returns:** void

### `collectWizardData()`
**Description:** Harvests all form inputs into a single structured object. Only students with non-empty names are included. Teachers and tutors with empty names are filtered out.  
**Parameters:** none  
**Returns:** `object` — the complete wizard data payload (see Outputs section for shape)

### `submitWizard()`
**Description:** Calls `collectWizardData()`, validates at least one student exists, shows the loading overlay, and calls `google.script.run.setupNewSite(data)`.  
**Parameters:** none  
**Returns:** void

### `onSetupSuccess(result)`
**Description:** Success handler for `setupNewSite`. Hides loading overlay, shows the success step, hides nav buttons, marks all progress steps complete, and displays `result.message`.  
**Parameters:**
- `result` (object): Server response with a `message` property  
**Returns:** void

### `onSetupError(error)`
**Description:** Failure handler for `setupNewSite`. Hides loading overlay and shows an alert with the error message.  
**Parameters:**
- `error` (object|string): Error thrown by the server function  
**Returns:** void
