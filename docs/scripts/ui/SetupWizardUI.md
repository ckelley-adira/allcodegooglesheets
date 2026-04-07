# SetupWizardUI.html (UI Template)

## 📋 Overview

`SetupWizardUI.html` is a **9-step guided setup wizard** rendered as a Google Sheets dialog (900 px wide). It walks a site administrator through full initial configuration of the UFLI Master System: school identity, grade levels, student roster import, teacher roster import, group structure, optional feature selection, branding, sheet layout, and a final review/confirmation. The wizard accumulates all choices in a single `wizardData` object and submits everything to the server in one call at the end.

Header colors, focus-ring colors, and button backgrounds are all driven by `getBranding()` template expressions (`<?= getBranding().headerGradientStart ?>`) so the wizard self-brands to the school's palette before it opens.

---

## 📜 Business Rules

| Step | Rule |
|------|------|
| 1 – School | `schoolName` is required; cannot proceed without a non-empty value. |
| 2 – Grades | At least one grade level must be checked. A Grade Range Model preset (`prek_only`, `k5`, `k8`, `prek_8`, `custom`) auto-selects checkboxes; manually toggling any checkbox switches the model back to `custom`. |
| 3 – Students | Student roster is required (cannot be empty). Every student must have Name, Grade, and Teacher. Each student's grade value must match one of the grades selected in Step 2; mismatches block progression. Raw grade strings are normalised (e.g., `"K"` → `"KG"`, `"1st"` → `"G1"`, `"Pre-K"` → `"PreK"`) before validation. |
| 4 – Teachers | Teacher roster is required. Every teacher must have a Name and at least one Grade Assignment. Each grade assignment must be in the selected grades served. |
| 5 – Groups | At least one grade must have ≥ 1 group. If "Allow mixed-grade groups" is selected, at least one combination string must be provided. Group counts are pre-filled from server-calculated recommendations (6-10 students/group target). |
| 6 – Features | No required selection; all features are optional. `enhancedSecurity` is defaulted ON. |
| 7 – Branding | Primary and secondary hex colors are validated against `/^#[0-9A-Fa-f]{6}$/` before being written to the color picker. Logo File ID is optional. |
| 8 – Layout | `dataStartRow` defaults to `headerRowCount + 1` (default 6). `lessonColumnOffset` defaults to 5. Both are numeric and bounded (min 2/max 20). |
| 9 – Review | Displays a full summary. "Complete Setup" is disabled during the server call to prevent double-submission. |

---

## 📥 Data Inputs

### Form Fields

**Step 1 – School**
| Field ID | Type | Purpose |
|----------|------|---------|
| `schoolName` | `text` | School name printed on all reports |

**Step 2 – Grades**
| Field ID | Type | Purpose |
|----------|------|---------|
| `gradeRangeModel` | `select` | Preset model: `custom`, `prek_only`, `k5`, `k8`, `prek_8` |
| `grade_<value>` (dynamic) | `checkbox` | One per grade option: PreK, KG, G1–G8 |

**Step 3 – Students**
| Field ID | Type | Purpose |
|----------|------|---------|
| `studentFile` | `file` | CSV/TSV/TXT roster file |
| `studentPaste` | `textarea` | Paste-in roster (tab or comma separated) |

**Step 4 – Teachers**
| Field ID | Type | Purpose |
|----------|------|---------|
| `teacherFile` | `file` | CSV/TSV/TXT teacher roster |
| `teacherPaste` | `textarea` | Paste-in teacher data |

**Step 5 – Groups**
| Field ID | Type | Purpose |
|----------|------|---------|
| `groupCount_<grade>` (dynamic) | `number` | Number of groups per grade level |
| `mixNo` / `mixYes` | `radio` | Whether to allow mixed-grade groups |
| `mixedCombinations` | `text` | Comma-separated combinations (e.g., `KG+G1, G2+G3`) |

**Step 6 – Features**
| Field ID | Type | Purpose |
|----------|------|---------|
| `feature_<id>` (dynamic) | `checkbox` | Toggles each optional feature on/off |

**Step 7 – Branding**
| Field ID | Type | Purpose |
|----------|------|---------|
| `primaryColor` | `color` | Color picker for primary/header color |
| `primaryColorHex` | `text` | Hex string synced to color picker |
| `secondaryColor` | `color` | Color picker for accent color |
| `secondaryColorHex` | `text` | Hex string synced to color picker |
| `logoFileId` | `text` | Google Drive file ID for school logo |

**Step 8 – Layout**
| Field ID | Type | Purpose |
|----------|------|---------|
| `headerRowCount` | `select` | Number of header rows (3–10; default 5) |
| `groupFormat` | `select` | Layout style: `standard`, `condensed`, `expanded`, `sankofa` |
| `includeSCClassroom` | `checkbox` | Add SC Classroom tracking column |
| `dataStartRow` | `number` | First data row (default 6) |
| `lessonColumnOffset` | `number` | Column where lesson data starts (default 5) |

### Data Loaded from Server

- **`getWizardData()`** — Called on `window.onload`. Returns previously saved wizard state: `{ schoolName, gradeRangeModel, gradesServed[], students[], teachers[], groups[], gradeMixing, features, branding, sheetLayout }`. Pre-populates all fields to support re-opening the wizard to edit existing config.
- **`calculateGroupRecommendations(wizardData)`** — Called when Step 5 becomes active. Returns a map of `{ [grade]: { recommended, studentCount, message } }` used to pre-fill group count inputs.

### Template Variables

- `<?= getBranding().headerGradientStart ?>` — Primary brand color injected by GAS into CSS and HTML attributes.
- `<?= getBranding().headerGradientEnd ?>` — Secondary brand color used for hover states.

---

## 📤 Outputs

- **`saveConfiguration(wizardData)`** — Called on "Complete Setup". Passes the entire `wizardData` object to the server. On success the dialog closes automatically after 2 seconds.
- On success the server creates all grade/group sheets, writes config, and configures the workbook.
- Error messages are displayed inline in `#alertContainer` without closing the dialog.

---

## 🔗 Dependencies

### Server Functions Called (`google.script.run`)

| Function | Step | Purpose |
|----------|------|---------|
| `getWizardData()` | Init | Load existing config to pre-populate all fields |
| `calculateGroupRecommendations(wizardData)` | Step 5 | Calculate recommended group counts from student roster |
| `saveConfiguration(wizardData)` | Step 9 | Persist all settings and build the workbook |

### Called From (which .gs opens this HTML)

- **`gold-standard-template/SetupWizard.gs`** — function at line 454:
  ```js
  HtmlService.createHtmlOutputFromFile('SetupWizardUI')
  ```

---

## ⚙️ Client-Side JavaScript Functions

### Global State

```js
let currentStep = 1;          // Active wizard step (1–9)
const totalSteps = 9;
const wizardData = { ... };   // Accumulated form state passed to server on submit
const GRADE_OPTIONS = [ ... ]; // Pre-K through G8 value/label pairs
const FEATURE_OPTIONS = [ ... ]; // 14 feature definitions with id, name, description, category
```

---

### `initializeBrandingInputs()`
**Description:** Attaches `input` event listeners to both color pickers so that changing a color picker updates its corresponding hex text field and `wizardData.branding` simultaneously.
**Parameters:** none
**Returns:** void

---

### `syncColorFromHex(type)`
**Description:** Reads the hex text input for the given type (`'primary'` or `'secondary'`), validates the format (`#RRGGBB`), then synchronises the color picker element and `wizardData.branding`.
**Parameters:**
- `type` (string): `'primary'` or `'secondary'`
**Returns:** void

---

### `initializeGradeCheckboxes()`
**Description:** Dynamically renders one checkbox per entry in `GRADE_OPTIONS` into `#gradesCheckboxes`. Each checkbox calls `onGradeCheckboxChange()` on change.
**Parameters:** none
**Returns:** void

---

### `applyGradeRangePreset()`
**Description:** Called by the `gradeRangeModel` select's `onchange`. If a non-`custom` model is selected, checks/unchecks grade checkboxes to match `GRADE_RANGE_PRESETS[model]`, then calls `updateGradesServed()`.
**Parameters:** none
**Returns:** void

---

### `onGradeCheckboxChange()`
**Description:** Called when any grade checkbox changes. Updates `wizardData.gradesServed` via `updateGradesServed()`, then switches the `gradeRangeModel` select back to `'custom'` if the checked grades no longer match the current preset.
**Parameters:** none
**Returns:** void

---

### `initializeFeaturesList()`
**Description:** Groups `FEATURE_OPTIONS` by category (advanced, standard, integration, system) and renders labelled sections of feature checkboxes into `#featuresList`. Features with `defaultOn: true` are pre-checked. Calls `updateFeatures()` to sync `wizardData.features`.
**Parameters:** none
**Returns:** void

---

### `renderFeature(feature, container)` *(inner)*
**Description:** Inner helper used by `initializeFeaturesList`. Creates and appends a single feature checkbox row (with name and description) to the given container.
**Parameters:**
- `feature` (object): Entry from `FEATURE_OPTIONS`
- `container` (HTMLElement): DOM element to append to
**Returns:** void

---

### `applyGradeRangeModel()`
**Description:** Applies the Phase 7 `GRADE_RANGE_MODEL_PRESETS` map. Called by the `gradeRangeModel` select. If model is not `'custom'`, sets each grade checkbox's `checked` state to match the preset and calls `updateGradesServed()`.
**Parameters:** none
**Returns:** void

---

### `loadExistingData()`
**Description:** Calls `google.script.run.getWizardData()` on page load. On success, populates every form field with the returned saved config, including branding colors, layout settings, feature flags, student/teacher previews, and grade selections.
**Parameters:** none
**Returns:** void

---

### `updateGradesServed()`
**Description:** Reads all checked grade checkboxes in `#gradesCheckboxes` and writes their values to `wizardData.gradesServed[]`.
**Parameters:** none
**Returns:** void

---

### `updateFeatures()`
**Description:** Iterates all elements with IDs starting with `feature_` and writes `{ featureId: boolean }` into `wizardData.features`.
**Parameters:** none
**Returns:** void

---

### `getCurrentStepNumber()`
**Description:** Returns the logical step number (1–9) for the current wizard position via `stepOrder[currentStep - 1]`.
**Parameters:** none
**Returns:** (number) Current step number

---

### `nextStep()`
**Description:** Validates the current step, saves its data, increments `currentStep`, and calls `updateStepDisplay()`. If on the last data-entry step (step 8), also calls `showConfirmation()` to render Step 9.
**Parameters:** none
**Returns:** void

---

### `previousStep()`
**Description:** Decrements `currentStep` (minimum 1) and calls `updateStepDisplay()`.
**Parameters:** none
**Returns:** void

---

### `validateCurrentStep()`
**Description:** Runs step-specific validation logic via a `switch` on `getCurrentStepNumber()`. Returns `{ valid: boolean, message?: string }`. Validates required fields, grade matching for students/teachers, group counts, and hex color formats.
**Parameters:** none
**Returns:** `{ valid: boolean, message: string }` — `valid: true` if step passes; otherwise `valid: false` with a human-readable `message`.

---

### `saveCurrentStepData()`
**Description:** No-op placeholder — all data saving occurs as a side-effect inside `validateCurrentStep()`.
**Parameters:** none
**Returns:** void

---

### `updateStepDisplay()`
**Description:** Updates the progress bar width, step indicator classes (`active`/`completed`), shows/hides step content panels, toggles Prev/Next button visibility and labels, and calls `populateGroupInputsWithRecommendations()` when entering Step 5.
**Parameters:** none
**Returns:** void

---

### `populateGroupInputsWithRecommendations()`
**Description:** Clears and rebuilds the `#groupsPerGrade` container. Calls `google.script.run.calculateGroupRecommendations(wizardData)` and renders one number input per selected grade, pre-filled with the server recommendation or any existing value.
**Parameters:** none
**Returns:** void

---

### `getGradeLabel(gradeValue)`
**Description:** Looks up the human-readable label for a grade value in `GRADE_OPTIONS`.
**Parameters:**
- `gradeValue` (string): Internal grade code, e.g., `'KG'`, `'G1'`
**Returns:** (string) Label string, e.g., `'Kindergarten'`, `'1st Grade'`; falls back to `gradeValue` if not found

---

### `toggleMixedGradeInput()`
**Description:** Shows or hides `#mixedGradeInput` based on the `mixYes` radio button state.
**Parameters:** none
**Returns:** void

---

### `handleStudentImport(event)`
**Description:** `onchange` handler for `#studentFile`. Uses `FileReader` to read the selected CSV/TSV file as text and passes it to `parseStudentData()`.
**Parameters:**
- `event` (Event): File input change event
**Returns:** void

---

### `processStudentPaste()`
**Description:** Reads `#studentPaste` textarea value and passes it to `parseStudentData()`. Shows a warning alert if the textarea is empty.
**Parameters:** none
**Returns:** void

---

### `parseStudentData(text)`
**Description:** Parses tab- or comma-delimited text (with header row) into student objects. Auto-detects column positions by searching header names for `'name'`, `'grade'`, `'teacher'`, `'group'`. Calls `normalizeGrade()` on each grade value. Saves result to `wizardData.students` and calls `showStudentPreview()`.
**Parameters:**
- `text` (string): Raw CSV/TSV text including headers
**Returns:** void

---

### `normalizeGrade(grade)`
**Description:** Normalises a raw grade string to the system's canonical format. Handles common variations: `"K"` / `"KG"` / `"Kinder"` → `"KG"`, `"Pre-K"` / `"PK"` → `"PreK"`, `"1"` / `"1st"` / `"G1"` → `"G1"`, etc. Returns the trimmed original string if no pattern matches.
**Parameters:**
- `grade` (string): Raw grade value from import
**Returns:** (string) Normalized grade code (`'PreK'`, `'KG'`, `'G1'`…`'G8'`)

---

### `showStudentPreview(students)`
**Description:** Renders a preview table of the first 5 students in `#studentPreviewTable` and shows the total count in `#studentCount`. Unhides `#studentPreview`.
**Parameters:**
- `students` (Array\<object\>): Array of `{ name, grade, teacher, group }` objects
**Returns:** void

---

### `handleTeacherImport(event)`
**Description:** `onchange` handler for `#teacherFile`. Reads the file as text and passes it to `parseTeacherData()`.
**Parameters:**
- `event` (Event): File input change event
**Returns:** void

---

### `processTeacherPaste()`
**Description:** Reads `#teacherPaste` and calls `parseTeacherData()`. Shows a warning if the textarea is empty.
**Parameters:** none
**Returns:** void

---

### `parseTeacherData(text)`
**Description:** Parses tab- or comma-delimited text into teacher objects. Auto-detects `'name'` and `'grade'` columns. Grade assignments are split by comma to support multi-grade teachers. Saves to `wizardData.teachers` and calls `showTeacherPreview()`.
**Parameters:**
- `text` (string): Raw CSV/TSV text including headers
**Returns:** void

---

### `showTeacherPreview(teachers)`
**Description:** Renders a preview table of the first 5 teachers into `#teacherPreviewTable` and displays the total count in `#teacherCount`. Unhides `#teacherPreview`.
**Parameters:**
- `teachers` (Array\<object\>): Array of `{ name, grades[] }` objects
**Returns:** void

---

### `showConfirmation()`
**Description:** Builds and injects a full HTML summary of all `wizardData` fields into `#confirmationSummary`. Changes the Next button to "Complete Setup ✓" (`btn-success`) and sets its `onclick` to `completeSetup`. Updates the progress bar to 100% and marks all step indicators as completed.
**Parameters:** none
**Returns:** void

---

### `completeSetup()`
**Description:** Disables Prev/Next buttons, shows a "Setting up…" info alert, then calls `google.script.run.saveConfiguration(wizardData)`. On success, shows a success alert and closes the dialog after 2 seconds. On failure, re-enables buttons and shows the error message.
**Parameters:** none
**Returns:** void

---

### `showAlert(message, type)`
**Description:** Renders an alert `<div>` with the appropriate Bootstrap-style class (`alert-info`, `alert-success`, `alert-danger`, `alert-warning`) inside `#alertContainer` and smooth-scrolls it into view.
**Parameters:**
- `message` (string): Alert text
- `type` (string): Alert variant — `'info'`, `'success'`, `'danger'`, `'warning'`
**Returns:** void

---

### `clearAlert()`
**Description:** Empties `#alertContainer`.
**Parameters:** none
**Returns:** void
