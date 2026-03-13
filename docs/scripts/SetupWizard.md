# SetupWizard.gs

## 📋 Overview

**Version:** 4.0 — Phase 3: Canonical Wizard & SiteConfig Template  
**File size:** ~113 KB  
**Location:** `gold-standard-template/SetupWizard.gs`

This file is the **entry point and control center** for the UFLI Master System in Google Sheets. It owns:

1. **Onboarding** — the multi-step Setup Wizard UI that configures a greenfield or re-deployed site (school name, grades, students, teachers, groups, features, branding, layout)
2. **Menu** — the `onOpen()` trigger that builds the "Adira Reads Progress Report" Google Sheets menu, dynamically shaped by feature flags
3. **Student Management** — CRUD operations for the student roster, propagated to all master sheets
4. **Group Management** — group count reconfiguration per grade, with automatic group sheet rebuild and roster cleanup
5. **Report Generation** — custom columnar reports written to new sheets
6. **Lesson Entry Form** — server-side data functions for the web app (form selects, existing data reads, save)
7. **Trigger Management** — nightly sync scheduling via GAS time-based triggers
8. **Pre-K Assessment** — server-side data functions for Pre-K student/sequence/skill lookup and save
9. **Utility Helpers** — shared logging, date formatting, result objects, and validation

**In the system flow:**
- First run: `onOpen()` shows only "Start Setup Wizard" → `startSetupWizard()` → wizard collects data → `saveConfiguration()` creates configuration sheets and calls `generateSystemSheets()` in `Phase2_ProgressTracking.gs`
- Daily use: `saveLessonData()` is called by the lesson entry web app to log data and trigger targeted sheet updates
- Maintenance: menu items route to student/group management dialogs or call repair functions in `Phase2_ProgressTracking.gs`

---

## 📜 Business Rules

### System Configuration State
- The system is considered **unconfigured** if the `Site Configuration` sheet is absent or the school name cell (row 2, col B) is blank
- In the unconfigured state, `onOpen()` shows only "Start Setup Wizard"; all other menu items are hidden
- Configuration is finalized by `saveConfiguration()`, which runs all six step validators before writing any data

### Grade Levels
Supported values: `"PreK"`, `"KG"`, `"G1"` through `"G8"` (10 levels total).

### Group Sizing Recommendations
| Setting | Value |
|---------|-------|
| Minimum size | 4 students |
| Maximum size | 10 students |
| Ideal size | 6 students |
- `calculateGroupRecommendations()` uses `ideal=6` to compute the recommended group count
- `autoBalanceStudents()` distributes students round-robin across groups for a grade

### Group Naming Convention
- 1 group for a grade: `"[Grade] Group"` (e.g., `"G2 Group"`)
- Multiple groups: `"[Grade] Group 1"`, `"[Grade] Group 2"`, etc.
- SC Classroom groups: prefixed with `"SC Classroom"` (handled specially in sync functions)

### Student Field Requirements (Wizard Validation)
- Step 1: `schoolName` must be non-empty
- Step 2: `gradesServed` must contain at least one grade
- Step 3: Each student must have `name`, `grade`, `teacher`; student's grade must be in `gradesServed`
- Step 4: Each teacher must have `name` and at least one `grade`; teacher's grade must be in `gradesServed`
- Step 5: Each group must have `grade` and `count ≥ 1`; if grade mixing is enabled, at least one combination must be defined
- Step 6: Always valid (feature selection has no required fields)

### Save Logic — `saveLessonData()`
| Grade | Path |
|-------|------|
| PreK | Direct write to `Pre-K Data` matrix by column header match |
| Tutoring group | Routed to `saveTutoringData()` in `TutoringSystem.gs` |
| K–8 standard | Log to `Small Group Progress` → targeted group sheet update → queue UFLI MAP update |
- Status `U` (unenrolled) is never written to tracking sheets; it is logged to the `Exception Log` sheet
- Co-teaching mode (feature flag: `coTeachingSupport`): logged under the primary group; group sheet is dual-written by source group; source group tracked in column G of Small Group Progress
- UFLI MAP updates use a deferred sync queue rather than immediate writes (reduces save time from ~16s to ~3–4s)
- Unenrolled students are logged to an `Exception Log` sheet (auto-created if absent)

### Grade-Based Lesson Ranges (for `getLessonsForGrade()`)
| Grade | Lesson Range |
|-------|-------------|
| KG | L1–L34 |
| G1 | L35–L68 |
| G2+ | L69–L128 |
| All others | L1–L128 |

### Branding Defaults
| Setting | Default |
|---------|---------|
| Primary color | `#00838F` (teal) |
| Secondary color | `#FFB300` (amber) |
| Logo File ID | `""` (none) |

### Sheet Layout Defaults
| Setting | Default |
|---------|---------|
| Header row count | 5 |
| Group format | `"standard"` |
| Include SC Classroom | `false` |
| Data start row | 6 |
| Lesson column offset | 5 |

### Configuration Sheet Protection
`Site Configuration` and `Feature Settings` sheets are protected with warning-only mode after creation.

### Nightly Sync Trigger
- Scheduled at midnight (`atHour(0)`) in the script's timezone
- `setupNightlySyncTrigger()` removes any existing triggers for `runFullSyncDeferred` before creating a new one (ensures only one trigger exists)

---

## 📥 Data Inputs

### Sheets Read
| Sheet | Purpose |
|-------|---------|
| `Site Configuration` | School name, grades served, grade mixing, branding, layout, version |
| `Student Roster` | Student name, grade, teacher, group (4 columns) |
| `Teacher Roster` | Teacher name, grade assignments |
| `Group Configuration` | Grade → count mappings; group-level student counts |
| `Feature Settings` | Enabled/disabled state for each feature option |
| `UFLI MAP` | Teacher lookups by group name; student rows for update/add/delete |
| `Grade Summary` | Grade values for `getExistingGrades()` dynamic detection |
| `Skills Tracker` | Updated when students are added/removed |
| `Pre-K Data` | Pre-K student-to-group mapping and letter assessment data |
| `PreK Pacing` | Pre-K sequence definitions and skill columns |
| `[Grade] Groups` (e.g., `KG Groups`) | Lesson form data reads via `getExistingLessonData()` |
| `Small Group Progress` | Lesson entry appends |
| `Sync Queue` | Pending UFLI MAP update count (for `showSyncStatus()`) |

### Constants / Config Consumed
- `SHEET_NAMES` — `CONFIG`, `STUDENT_ROSTER`, `TEACHER_ROSTER`, `GROUP_CONFIG`, `FEATURES`
- `SHEET_NAMES_V2` — `UFLI_MAP`, `SKILLS`, `GRADE_SUMMARY` (from `Phase2_ProgressTracking.gs` flat namespace)
- `SHEET_NAMES_PREK` — `DATA` (from `Phase2_ProgressTracking.gs` flat namespace)
- `ROSTER_LAYOUT` — `DATA_START_ROW=6`
- `CONFIG_LAYOUT` — row/column mapping for the `Site Configuration` sheet
- `LAYOUT` — `COL_CURRENT_LESSON`, `COL_FIRST_LESSON` (from `Phase2_ProgressTracking.gs`)
- `PREK_CONFIG` — `HEADER_ROW`, `DATA_START_ROW`
- `GRADE_OPTIONS` — 10 grade levels
- `FEATURE_OPTIONS` — 13 optional features with `id`, `name`, `description`, `category`
- `RECOMMENDED_GROUP_SIZE` — `{ min: 4, max: 10, ideal: 6 }`
- `COLORS` — shared color constants (from `Phase2_ProgressTracking.gs` flat namespace)
- `SITE_CONFIG.features` — feature flags for dynamic menu construction
- `LESSON_LABELS` — lesson display names (from `SharedConstants.gs`)

### User Interactions
- **Setup Wizard** modal dialog (900×700 px): 6-step multi-page wizard collecting school name, grades, students, teachers, groups, and features
- **Manage Students** modal dialog (800×600 px): roster CRUD
- **Manage Groups** modal dialog (600×500 px): group count editor
- **Generate Reports** modal dialog (700×600 px): column/filter selector
- **Lesson Entry Form** standalone web app (served via `doGet()`): `LessonEntryForm.html`
- Menu confirmation dialogs (via `SpreadsheetApp.getUi().alert()`) for destructive operations

---

## 📤 Outputs

### Sheets Created / Modified
| Sheet | Trigger |
|-------|---------|
| `Site Configuration` | `createConfigurationSheet()` — all wizard settings, protected |
| `Student Roster` | `createStudentRosterSheet()` — student list |
| `Teacher Roster` | `createTeacherRosterSheet()` — teacher list |
| `Group Configuration` | `createGroupConfigSheet()` — group names with counts |
| `Feature Settings` | `createFeatureSettingsSheet()` — feature enable/disable, protected |
| `UFLI MAP` | `addStudentToSheet()` / `updateStudentInSheet()` / `deleteStudentFromSheet()` |
| `Skills Tracker` | Same as above; formulas set via `addSkillFormulasForRow()` |
| `Grade Summary` | Same as above; formulas set via `addGradeSummaryFormulasForRow()` |
| `[Grade] Groups` | `createGradeGroupSheets()` — rebuilt when groups change |
| `Small Group Progress` | `saveLessonData()` — appends lesson log rows |
| `Exception Log` | `logUnenrolledStudents()` — auto-created; appends unenrolled student rows |
| `Report - [timestamp]` | `buildReport()` — new sheet per report run |

### UI Outputs
- `onOpen()` — builds "Adira Reads Progress Report" menu in Google Sheets UI
- `startSetupWizard()` / `openSettings()` — shows 900×700 modal dialog
- `manageStudents()` — shows 800×600 modal dialog
- `manageGroups()` — shows 600×500 modal dialog
- `generateReports()` — shows 700×600 modal dialog
- `doGet(e)` — returns `LessonEntryForm` HTML output for standalone web app
- `showSyncStatus()` — alert showing hourly/nightly trigger status and pending queue count
- `showTriggerStatus()` — delegates to `showSyncStatus()`
- `setupNightlySyncTrigger()` / `removeNightlySyncTrigger()` — alert confirmations
- `recalculateAllStatsNow()` — confirmation dialog + toast + completion alert

### Return Values (called from HTML via `google.script.run`)
- `getWizardData()` → complete wizard data object
- `saveConfiguration(wizardData)` → `{ success, message }`
- `getStudentRosterData()` → `Array<{ rowIndex, name, grade, teacher, group }>`
- `saveStudent(studentObject)` → `{ success, message }`
- `deleteStudent(studentObject)` → `{ success, message }`
- `getGroupsData()` → `Array<{ grade, label, studentCount, groupCount }>`
- `saveGroups(newGroupConfig)` → `{ success, message }`
- `getReportOptions()` → `{ options, filterOptions }`
- `buildReport(selectedColumns, filters)` → `{ success, message }`
- `getGroupsForForm()` → Array of group names
- `getLessonsAndStudentsForGroup(groupName)` → lesson/student data for form
- `getLessonsForGrade(grade)` → `Array<{ id, name }>`
- `getExistingLessonData(gradeSheet, groupName, lessonName)` → `{ studentName: "Y"|"N"|"A"|"U" }`
- `saveLessonData(formData)` → `{ success, message }`
- `getPreKStudentsByGroup(groupName)` → `Array<{ name, group }>`
- `getPreKSequences(groupName)` → `Array<{ sequenceName, letters, columnIndex }>`
- `getPreKAssessmentData(studentName, groupName, sequenceName)` → `{ lessons: [], currentData: {} }`
- `savePreKAssessmentData(formData)` → `{ success, message }`

---

## 🔗 Dependencies

### Depends On (calls into)

| File | Functions / Constants Used |
|------|---------------------------|
| `Phase2_ProgressTracking.gs` | `generateSystemSheets()`, `createPacingReports()`, `syncSmallGroupProgress()`, `updateSchoolSummary()`, `updatePacingReports()`, `SHEET_NAMES_V2`, `LAYOUT`, `PREK_CONFIG`, `COLORS`, `extractLessonNumber()`, `getSheetNameForGroup()` (via GAS flat namespace) |
| `SharedConstants.gs` | `LESSON_LABELS`, `PERFORMANCE_THRESHOLDS` (via GAS flat namespace) |
| `SiteConfig_TEMPLATE.gs` | `SITE_CONFIG.features`, `isFeatureEnabled()` |
| `modules/ModuleLoader.gs` | `buildFeatureMenu()` (called in `onOpen()`), `addToSyncQueue()` (called in `saveLessonData()`) |
| `modules/MixedGradeSupport.gs` | `getGroupsForForm_MixedGrade()`, `getLessonsAndStudentsForGroup_MixedGrade()`, `ENABLE_MIXED_GRADES`, `MIXED_GRADE_CONFIG`, `isFeatureEnabled()` (optional; used when mixed grades enabled) |
| `modules/TutoringSystem.gs` | `isTutoringGroup()`, `saveTutoringData()` (optional; used when tutoring groups are detected) |

### Used By (called from)

| File | Calls |
|------|-------|
| `Phase2_ProgressTracking.gs` | `getWizardData()`, `getExistingGrades()`, `getSheetDataAsMap()`, `addStudentToSheet()`, `updateStudentInSheet()` (via GAS flat namespace) |
| `LessonEntryForm.html` | `getGroupsForForm()`, `getLessonsAndStudentsForGroup()`, `getLessonsForGrade()`, `getExistingLessonData()`, `saveLessonData()`, `getPreKStudentsByGroup()`, `getPreKSequences()`, `getPreKAssessmentData()`, `savePreKAssessmentData()` (via `google.script.run`) |
| `SetupWizardUI.html` | `getWizardData()`, `saveConfiguration()`, `calculateGroupRecommendations()`, `autoBalanceStudents()`, `validateStep1()` through `validateStep6()` (via `google.script.run`) |
| `ManageStudentsUI.html` | `getStudentRosterData()`, `saveStudent()`, `deleteStudent()` (via `google.script.run`) |
| `ManageGroupsUI.html` | `getGroupsData()`, `saveGroups()` (via `google.script.run`) |
| `GenerateReportsUI.html` | `getReportOptions()`, `buildReport()` (via `google.script.run`) |
| GAS `onOpen` trigger | `onOpen()` (automatic) |
| GAS `doGet` trigger | `doGet(e)` (web app request) |
| GAS time-based trigger | `runFullSyncDeferred()` (scheduled) |

---

## ⚙️ Function Reference

### Constants

#### `SYSTEM_VERSION`
String `"4.0"` — written to `Site Configuration` sheet on setup.

#### `SHEET_NAMES`
Configuration sheet name constants: `CONFIG = "Site Configuration"`, `STUDENT_ROSTER = "Student Roster"`, `TEACHER_ROSTER = "Teacher Roster"`, `GROUP_CONFIG = "Group Configuration"`, `FEATURES = "Feature Settings"`.

#### `GRADE_OPTIONS`
Array of 10 grade objects `{ value, label }` for PreK through G8.

#### `FEATURE_OPTIONS`
Array of 13 feature objects `{ id, name, description, implementedBy?, category, defaultOn? }`. Categories: `"advanced"`, `"standard"`, `"integration"`, `"system"`. IDs: `coachingDashboard`, `tutoring`, `grantReporting`, `growthHighlights`, `adminImport`, `unenrollmentAutomation`, `pacingSheets`, `parentReports`, `exceptionReports`, `mondayIntegration`, `enhancedSecurity`, `structuredLogging`, `scClassroomGroups`, `coTeachingSupport`.

#### `RECOMMENDED_GROUP_SIZE`
`{ min: 4, max: 10, ideal: 6 }`.

#### `SHEET_LAYOUT_OPTIONS`
Array of 5 layout option objects for the wizard: `standard`, `condensed`, `expanded`, `sankofa`, `prek`.

#### `CONFIG_LAYOUT`
Centralized row/column constants for reading and writing the `Site Configuration` sheet. Sub-objects: `SITE_CONFIG` (rows 1–33), `ROSTER` (`{ TITLE_ROW:1, INSTRUCTIONS_ROW:2, HEADER_ROW:4, DATA_START_ROW:6 }`), `COLS` (`{ LABEL:1, VALUE:2 }`).

#### `ROSTER_LAYOUT`
Alias for `CONFIG_LAYOUT.ROSTER` — used throughout the file as the roster data layout. `DATA_START_ROW=6`.

---

### Utility Functions

### `logMessage(functionName, message, level)`
**Description:** Standardized logging wrapper that prefixes messages with `[LEVEL] [functionName]`.  
**Parameters:**
- `functionName` (string): Calling function name
- `message` (string): Log message
- `level` (string, default=`'INFO'`): `'INFO'`, `'WARN'`, or `'ERROR'`  
**Returns:** void

---

### `formatDateSafe(date, format)`
**Description:** Formats a Date using the spreadsheet's own timezone (falls back to script timezone). Wraps `Utilities.formatDate()`.  
**Parameters:**
- `date` (Date): Date to format
- `format` (string): Format string (e.g., `"yyyy-MM-dd HH:mm"`)  
**Returns:** (string) Formatted date string

---

### `createResult(success, message, data)`
**Description:** Creates a standardized result object. Omits the `data` property entirely when `data` is null.  
**Parameters:**
- `success` (boolean): Whether the operation succeeded
- `message` (string): Human-readable result message
- `data` (any, default=null): Optional payload  
**Returns:** (Object) `{ success, message, data? }`

---

### `validateRequiredProps(obj, requiredProps)`
**Description:** Validates that all required property names exist on an object and are non-empty strings.  
**Parameters:**
- `obj` (Object): Object to validate
- `requiredProps` (Array\<string\>): Property names that must be present and non-empty  
**Returns:** (Object) `{ valid: boolean, missing: string[] }`

---

### `getTeacherForGroup(groupName)`
**Description:** Looks up the teacher for a group. For `"PreK"` groups, reads from `Pre-K Data` sheet (column D for group, column C for teacher). For all others, reads from `UFLI MAP`. This is the single source of truth for teacher lookups.  
**Parameters:**
- `groupName` (string): Group name to look up  
**Returns:** (string) Teacher name or `""` if not found

---

### Menu Integration

### `onOpen()`
**Description:** GAS `onOpen` trigger. Checks if the system is configured. If not, renders a minimal menu with only "Start Setup Wizard". If configured, builds the full menu including: primary actions (School Summary, Generate Reports), management items (Manage Students, Manage Groups), a "Sync & Performance" submenu (feature-flag gated), feature module menus via `buildFeatureMenu()`, and a "System Tools" submenu (formula repair, formatting repair, archive tools).  
**Parameters:** none  
**Returns:** void

---

### `isSystemConfigured()`
**Description:** Checks whether the `Site Configuration` sheet exists and has a non-empty school name in row 2, column B.  
**Parameters:** none  
**Returns:** (boolean) `true` if configured

---

### Web App Entry Point

### `doGet(e)`
**Description:** GAS `doGet` trigger. Serves the `LessonEntryForm.html` file as an HTML web app with default X-Frame options.  
**Parameters:**
- `e` (Object): GAS event object from web request  
**Returns:** (HtmlOutput) `LessonEntryForm` page titled `"UFLI Lesson Data Entry"`

---

### Setup Wizard — Launchers

### `startSetupWizard()`
**Description:** Opens the `SetupWizardUI.html` as a 900×700 modal dialog titled "Setup Wizard".  
**Parameters:** none  
**Returns:** void

---

### `openSettings()`
**Description:** Alias for `startSetupWizard()`. Bound to "System Settings" menu item.  
**Parameters:** none  
**Returns:** void

---

### Setup Wizard — Data Handlers

### `getWizardData()`
**Description:** Reads all current configuration from the spreadsheet and returns a complete wizard data object. If the `Site Configuration` sheet does not exist, returns a default object with empty values and default layout/branding settings.  
**Parameters:** none  
**Returns:** (Object) `{ schoolName, gradeRangeModel, gradesServed, students, teachers, groups, gradeMixing, features, branding, sheetLayout }`

---

### `getExistingBranding(configSheet)`
**Description:** Reads primary color, secondary color, and logo file ID from the `Site Configuration` sheet. Falls back to defaults (`#00838F`, `#FFB300`, `""`) on error.  
**Parameters:**
- `configSheet` (Sheet): The `Site Configuration` sheet  
**Returns:** (Object) `{ primaryColor, secondaryColor, logoFileId }`

---

### `getExistingSheetLayout(configSheet)`
**Description:** Reads header row count, group format, SC classroom flag, data start row, and lesson column offset from the `Site Configuration` sheet. Falls back to defaults on error.  
**Parameters:**
- `configSheet` (Sheet): The `Site Configuration` sheet  
**Returns:** (Object) `{ headerRowCount, groupFormat, includeSCClassroom, dataStartRow, lessonColumnOffset }`

---

### `getExistingGrades(configSheet)`
**Description:** Dynamically reads the unique grade values from column B of `Grade Summary` rather than using a hardcoded list. Sorts grades in canonical order (`PreK`, `KG`, `G1`–`G8`). Falls back to all 10 grades if the sheet is absent or empty.  
**Parameters:**
- `configSheet` (Sheet): The `Site Configuration` sheet (not directly used — kept for API consistency)  
**Returns:** (Array\<string\>) Sorted array of grade codes

---

### `getExistingStudents()`
**Description:** Reads all student rows (name, grade, teacher, group) from the `Student Roster` sheet starting at `DATA_START_ROW`.  
**Parameters:** none  
**Returns:** (Array\<Object\>) `[{ name, grade, teacher, group }]`, empty array if no sheet or no data

---

### `getExistingTeachers()`
**Description:** Reads all teacher rows (name, comma-separated grade assignments) from the `Teacher Roster` sheet.  
**Parameters:** none  
**Returns:** (Array\<Object\>) `[{ name, grades: string[] }]`, empty array if no sheet or no data

---

### `getExistingGroups()`
**Description:** Reads all group rows (grade, count) from the `Group Configuration` sheet.  
**Parameters:** none  
**Returns:** (Array\<Object\>) `[{ grade, count }]`, empty array if no sheet or no data

---

### `getExistingGradeMixing(configSheet)`
**Description:** Reads the `Allow Grade Mixing` and `Mixed Grade Combinations` values from the `Site Configuration` sheet.  
**Parameters:**
- `configSheet` (Sheet): The `Site Configuration` sheet  
**Returns:** (Object) `{ allowed: boolean, combinations: string[] }`

---

### `getExistingFeatures()`
**Description:** Reads the enabled state (TRUE/FALSE) for each feature in `FEATURE_OPTIONS` from the `Feature Settings` sheet.  
**Parameters:** none  
**Returns:** (Object) `{ featureId: boolean }` for each feature

---

### Smart Group Recommendations

### `calculateGroupRecommendations(wizardData)`
**Description:** For each grade in `wizardData.gradesServed`, counts students in that grade and calculates recommended, minimum, and maximum group counts based on `RECOMMENDED_GROUP_SIZE` (ideal=6, min=4, max=10).  
**Parameters:**
- `wizardData` (Object): Must include `gradesServed[]` and `students[]`  
**Returns:** (Object) Grade code → `{ studentCount, recommended, min, max, averageSize, message }`

---

### `autoBalanceStudents(wizardData)`
**Description:** Distributes students across groups using round-robin assignment. Supports three scenarios: (1) standard single-grade groups, (2) mixed-grade groups when `mixedGradeSupport` feature is enabled and `MIXED_GRADE_CONFIG` defines combinations, (3) Pre-K groups (same as single-grade). Students already assigned to a group are skipped. Returns an updated copy of `wizardData` with `group` fields populated.  
**Parameters:**
- `wizardData` (Object): Complete wizard data with `students[]` and `groups[]`  
**Returns:** (Object) Updated wizard data with student group assignments

---

### Validation Functions

### `validateStep1(data)`
**Description:** Validates that `data.schoolName` is non-empty.  
**Parameters:**
- `data` (Object): Wizard data object  
**Returns:** (Object) `createResult()` result — `{ success: boolean, message: string }`

---

### `validateStep2(data)`
**Description:** Validates that `data.gradesServed` contains at least one grade.  
**Parameters:**
- `data` (Object): Wizard data object  
**Returns:** (Object) `createResult()` result

---

### `validateStep3(data)`
**Description:** Validates that `data.students` is non-empty, each student has `name`/`grade`/`teacher`, and each student's grade is in `data.gradesServed`.  
**Parameters:**
- `data` (Object): Wizard data object  
**Returns:** (Object) `createResult()` result with row number in message on failure

---

### `validateStep4(data)`
**Description:** Validates that `data.teachers` is non-empty, each teacher has a name and at least one grade, and all teacher grades are in `data.gradesServed`.  
**Parameters:**
- `data` (Object): Wizard data object  
**Returns:** (Object) `createResult()` result

---

### `validateStep5(data)`
**Description:** Validates that `data.groups` is non-empty, each group has a grade and count ≥ 1, and if grade mixing is enabled, at least one combination is defined.  
**Parameters:**
- `data` (Object): Wizard data object  
**Returns:** (Object) `createResult()` result

---

### `validateStep6(data)`
**Description:** Always returns success. Feature selection has no required fields.  
**Parameters:**
- `data` (Object): Wizard data object  
**Returns:** (Object) `createResult(true, "Valid")`

---

### Save Configuration

### `saveConfiguration(wizardData)`
**Description:** Runs all six step validators, then creates configuration sheets (`Site Configuration`, `Student Roster`, `Teacher Roster`, `Group Configuration`, `Feature Settings`, `Pacing Reports`), calls `generateSystemSheets()` from `Phase2_ProgressTracking.gs`, and rebuilds the menu via `onOpen()`. Returns a failure result if any validation fails; throws on sheet creation errors.  
**Parameters:**
- `wizardData` (Object): Complete wizard data from the UI  
**Returns:** (Object) `createResult()` result — `{ success, message }`

---

### Configuration Sheet Creation

### `createConfigurationSheet(ss, data)`
**Description:** Creates or clears the `Site Configuration` sheet. Writes all wizard settings in a label/value format (column A = label, column B = value): school name, grade range model, grades served (one row per grade with TRUE/FALSE), grade mixing, system version, last updated, branding, and sheet layout options. Applies header formatting and protection.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `data` (Object): Complete wizard data  
**Returns:** void

---

### `createStudentRosterSheet(ss, data)`
**Description:** Creates or clears the `Student Roster` sheet. Writes title/subtitle headers, column headers (Name, Grade, Teacher, Group) at row 5, and all student rows starting at row 6. Sets column widths and freezes 5 header rows.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `data` (Object): Must include `students[]`  
**Returns:** void

---

### `createTeacherRosterSheet(ss, data)`
**Description:** Creates or clears the `Teacher Roster` sheet. Writes title/subtitle headers, column headers (Teacher Name, Grade Assignment(s)) at row 5, and all teacher rows starting at row 6. Grade assignments are joined as comma-separated strings.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `data` (Object): Must include `teachers[]`  
**Returns:** void

---

### `createGroupConfigSheet(ss, data)`
**Description:** Creates or clears the `Group Configuration` sheet. Writes column headers (Group Name, Grade, # of Groups, Students) at row 5, a totals row at row 6, and individual group rows starting at row 8. Groups are sorted in canonical grade order. Student counts per group are computed from the student roster.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `data` (Object): Must include `groups[]` and `students[]`  
**Returns:** void

---

### `createFeatureSettingsSheet(ss, data)`
**Description:** Creates or clears the `Feature Settings` sheet. Writes column headers (Feature, Enabled, Description) at row 5, and one row per feature in `FEATURE_OPTIONS` starting at row 6. Applies protection.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `data` (Object): Must include `features` object  
**Returns:** void

---

### `protectSheet(sheet)`
**Description:** Applies warning-only protection to a sheet with description `"System Configuration - Protected"`. Users can still edit but receive a warning.  
**Parameters:**
- `sheet` (Sheet): Sheet to protect  
**Returns:** void

---

### Manage Students

### `manageStudents()`
**Description:** Opens the `ManageStudentsUI.html` as an 800×600 modal dialog.  
**Parameters:** none  
**Returns:** void

---

### `getStudentRosterData()`
**Description:** Reads all student rows from `Student Roster` (starting at `DATA_START_ROW`) and returns them with row indices for in-place editing.  
**Parameters:** none  
**Returns:** (Array\<Object\>) `[{ rowIndex, name, grade, teacher, group }]`; throws on error

---

### `saveStudent(studentObject)`
**Description:** Saves a student to the roster. If `studentObject.rowIndex` is present, updates that row in-place and propagates name/grade/teacher/group changes to `UFLI MAP`, `Skills Tracker`, and `Grade Summary`. Otherwise appends a new row and adds the student to all master sheets. Rebuilds grade group sheets after any change.  
**Parameters:**
- `studentObject` (Object): `{ rowIndex?, originalName?, name, grade, teacher, group }`  
**Returns:** (Object) `createResult()` result

---

### `deleteStudent(studentObject)`
**Description:** Removes the student by name from `Student Roster`, `UFLI MAP`, `Skills Tracker`, and `Grade Summary`. Rebuilds grade group sheets.  
**Parameters:**
- `studentObject` (Object): Must include `name`  
**Returns:** (Object) `createResult()` result

---

### Student Sync Helpers

### `updateStudentInSheet(ss, sheetName, studentName, studentData)`
**Description:** Finds a student row by name match in column A (starting at `DATA_START_ROW`) and overwrites the first 4 columns with `studentData`.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `sheetName` (string): Sheet to update
- `studentName` (string): Name to find (original name before any rename)
- `studentData` (Array): `[name, grade, teacher, group]`  
**Returns:** void

---

### `addStudentToSheet(ss, sheetName, studentData)`
**Description:** Appends a new student row to a sheet with all existing columns preserved as blank beyond column 4. For `UFLI MAP`, sets the Current Lesson formula via `buildCurrentLessonFormula()`. For `Skills Tracker`, calls `addSkillFormulasForRow()`. For `Grade Summary`, calls `addGradeSummaryFormulasForRow()`.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `sheetName` (string): Sheet to add to
- `studentData` (Array): `[name, grade, teacher, group]`  
**Returns:** void

---

### `deleteStudentFromSheet(ss, sheetName, studentName)`
**Description:** Finds a student row by name match and deletes that entire row from the sheet.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `sheetName` (string): Sheet to modify
- `studentName` (string): Student name to find and delete  
**Returns:** void

---

### Manage Groups

### `manageGroups()`
**Description:** Opens the `ManageGroupsUI.html` as a 600×500 modal dialog.  
**Parameters:** none  
**Returns:** void

---

### `getGroupsData()`
**Description:** Returns per-grade data for the Manage Groups UI: grade code, display label, student count, and current group count.  
**Parameters:** none  
**Returns:** (Array\<Object\>) `[{ grade, label, studentCount, groupCount }]`; throws on error

---

### `saveGroups(newGroupConfig)`
**Description:** Saves new group configuration. Steps: (1) updates `Group Configuration` sheet, (2) deletes all existing `[Grade] Groups` sheets, (3) recreates grade group sheets, (4) clears group assignments in `Student Roster` for students now in non-existent groups, (5) syncs group changes to master tracking sheets via `syncStudentGroupsToTrackers()`.  
**Parameters:**
- `newGroupConfig` (Array\<Object\>): `[{ grade, count }]`  
**Returns:** (Object) `createResult()` result

---

### `syncStudentGroupsToTrackers(ss)`
**Description:** Reads the current `Student Roster` and propagates grade/teacher/group changes to `UFLI MAP`, `Skills Tracker`, and `Grade Summary`. Only writes to sheets where something actually changed.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet  
**Returns:** void

---

### Generate Reports

### `generateReports()`
**Description:** Opens the `GenerateReportsUI.html` as a 700×600 modal dialog.  
**Parameters:** none  
**Returns:** void

---

### `getReportOptions()`
**Description:** Builds the available column options and filter options for the report generator. Student columns are from the roster (name, grade, teacher, group). Progress columns are from UFLI MAP and Grade Summary (current lesson, benchmark status, skill percentages). Skills columns are dynamically discovered from the Skills Tracker headers. Filter options include all grades, groups, and students.  
**Parameters:** none  
**Returns:** (Object) `{ options: { student, progress, skills }, filterOptions: { grades, groups, students } }`

---

### `buildReport(selectedColumns, filters)`
**Description:** Generates a report by joining data from multiple sheets for each filtered student. Writes the report to a new sheet named `"Report - [timestamp]"`, applies header formatting, freezes row 1, and auto-resizes columns. Activates the new sheet.  
**Parameters:**
- `selectedColumns` (Array\<Object\>): Column definitions `[{ name, sheet, col }]`
- `filters` (Object): `{ grade: string|'ALL', group: string|'ALL', student: string|'ALL' }`  
**Returns:** (Object) `createResult()` result

---

### `getSheetDataAsMap(ss, sheetName)`
**Description:** Reads a sheet's entire data range and returns a Map keyed by column A (student name). Data rows start at `ROSTER_LAYOUT.DATA_START_ROW`. Canonical implementation — shared across both `SetupWizard.gs` and `Phase2_ProgressTracking.gs` via GAS flat namespace.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `sheetName` (string): Sheet to read  
**Returns:** (Map) Student name string → full row array

---

### Web App — Lesson Form Data

### `getGroupsForForm()`
**Description:** Delegates to `getGroupsForForm_MixedGrade()` from `MixedGradeSupport.gs`. Returns the list of groups for the lesson entry form's group dropdown.  
**Parameters:** none  
**Returns:** Array of group names (or objects, depending on mixed-grade implementation)

---

### `getGroupsFromConfiguration()`
**Description:** Reads group names directly from the `Group Configuration` sheet and generates all group names based on grade/count pairs. Returns a sorted array of group name strings.  
**Parameters:** none  
**Returns:** (Array\<string\>) Sorted group names; throws if `Group Configuration` sheet is missing

---

### `getLessonsAndStudentsForGroup(groupName)`
**Description:** Delegates to `getLessonsAndStudentsForGroup_MixedGrade()`. Returns lesson sequence and student list for the given group, for display in the lesson entry form.  
**Parameters:**
- `groupName` (string): Group name selected in the form  
**Returns:** Lesson/student data object (shape defined by `MixedGradeSupport.gs`)

---

### `getLessonsForGrade(grade)`
**Description:** Returns an array of lesson objects for a grade's lesson range. For `"KG"` returns L1–L34, `"G1"` returns L35–L68, `"G2"` and above returns L69–L128, all others return L1–L128. Uses `LESSON_LABELS` for display names when available.  
**Parameters:**
- `grade` (string): Grade code  
**Returns:** (Array\<Object\>) `[{ id: number, name: string }]`

---

### `getExistingLessonData(gradeSheet, groupName, lessonName)`
**Description:** Reads Y/N/A/U values for a specific group × lesson combination from the appropriate grade group sheet. **Tolerant matching**: ignores the `gradeSheet` parameter and derives the correct sheet name from the group name itself (fixes a known form bug where the wrong sheet name is passed). Supports 2-argument calling convention `(groupName, lessonName)`. Uses multi-strategy group matching (exact → contains → partial → base name) and lesson matching (exact → lesson number → partial).  
**Parameters:**
- `gradeSheet` (string|null): Sheet name hint from form (may be wrong; corrected internally)
- `groupName` (string): Group name to find
- `lessonName` (string): Lesson name to match  
**Returns:** (Object) `{ studentName: "Y"|"N"|"A"|"U" }` for students with recorded values

---

### `extractLessonNumber(lessonText)`
**Description:** Extracts a numeric lesson ID (1–128) from various text formats: `"UFLI L5"`, `"Lesson 5"`, `"L5"`, `"5"`, `"UFLI L5 VC&CVC Words"`, etc. Returns `null` for non-matching input or numbers outside 1–128.  
**Parameters:**
- `lessonText` (string|null|undefined): Text to parse  
**Returns:** (number|null) Lesson number 1–128, or `null`

---

### `saveLessonData(formData)`
**Description:** Main save handler for the lesson entry form. Routes by grade/group type: Pre-K → direct matrix write; tutoring group → `saveTutoringData()`; K–8 → three-step fast save (log to Small Group Progress → targeted group sheet update → queue UFLI MAP update). Handles co-teaching mode (dual group sheet write). Logs unenrolled students to Exception Log. Returns elapsed time in the success message.  
**Parameters:**
- `formData` (Object): `{ gradeSheet, groupName, lessonName, teacherName, studentStatuses: [{name, status, sourceGroup?}], unenrolledStudents?, isCoTeaching?, partnerGroup?, primaryGroup? }`  
**Returns:** (Object) `{ success: boolean, message: string }`

---

### `updateGroupSheetTargeted(ss, gradeSheetName, groupName, lessonName, studentStatuses)`
**Description:** Performs a targeted batch update to a group sheet. Uses `TextFinder` to locate the group header, then scans the next 3 rows for the lesson column (by exact name or lesson number), and batch-reads/writes only the affected student cells. Works for both standard (Col A) and Sankofa (Col D) layouts.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `gradeSheetName` (string): Grade sheet name (e.g., `"G3 Groups"`)
- `groupName` (string): Group name to find
- `lessonName` (string): Lesson column to update
- `studentStatuses` (Array\<Object\>): `[{ name, status }]`  
**Returns:** void

---

### `updateUFLIMapTargeted(mapSheet, studentStatuses, lessonNum, timestamp)`
**Description:** Optimized targeted update of `UFLI MAP` for a specific lesson and set of students. Batch-reads student names, lesson column, and Current Lesson column; updates only affected rows; batch-writes both columns in two API calls. Current Lesson is only updated if the new lesson number is ≥ the existing lesson number.  
**Parameters:**
- `mapSheet` (Sheet): UFLI MAP sheet object
- `studentStatuses` (Array\<Object\>): `[{ name, status }]`
- `lessonNum` (number): Lesson number (1–128)
- `timestamp` (Date): Submission timestamp (not currently written to sheet)  
**Returns:** void

---

### `logUnenrolledStudents(ss, groupName, lessonName, students, timestamp)`
**Description:** Logs unenrolled student names to the `Exception Log` sheet. Auto-creates the sheet with headers if absent. Appends one row per student: `[Date, "Unenrolled", groupName, lessonName, studentName]`.  
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `groupName` (string): Group name
- `lessonName` (string): Lesson name
- `students` (Array\<string\>): Student names
- `timestamp` (Date): Submission timestamp  
**Returns:** void

---

### Deferred Sync

### `runFullSyncDeferred()`
**Description:** Full system sync intended for nightly or on-demand use. Calls `syncSmallGroupProgress()`, `updatePacingReports()`, and `updateSchoolSummary()` in sequence. Logs elapsed time.  
**Parameters:** none  
**Returns:** (Object) `{ success: boolean, elapsed?: number, error?: string }`

---

### `recalculateAllStatsNow()`
**Description:** Prompts the user for confirmation, shows a "please wait" toast, calls `runFullSyncDeferred()`, then shows a completion alert with elapsed time. Bound to "Recalculate All Stats Now" menu item.  
**Parameters:** none  
**Returns:** void

---

### Trigger Management

### `setupNightlySyncTrigger()`
**Description:** Removes any existing `runFullSyncDeferred` triggers, then creates a new time-based trigger to run at midnight (`atHour(0)`) every day in the script's timezone. Shows a confirmation alert.  
**Parameters:** none  
**Returns:** void

---

### `removeNightlySyncTrigger()`
**Description:** Finds and deletes all GAS triggers whose handler is `"runFullSyncDeferred"`. Shows an alert if triggers were removed.  
**Parameters:** none  
**Returns:** void

---

### `showTriggerStatus()`
**Description:** Alias for `showSyncStatus()`.  
**Parameters:** none  
**Returns:** void

---

### `showSyncStatus()`
**Description:** Shows an alert with the current status of both the hourly UFLI MAP sync trigger (checks for `processSyncQueue` handler) and the nightly full sync trigger (`runFullSyncDeferred`), plus the count of pending items in the `Sync Queue` sheet.  
**Parameters:** none  
**Returns:** void

---

### Pre-K Assessment Functions

### `getPreKStudentsByGroup(groupName)`
**Description:** Reads the `Pre-K Data` sheet to find students belonging to a given PreK group. Supports flexible matching: exact group name, base group name (strips trailing numbers), and containment matching. Returns students sorted alphabetically.  
**Parameters:**
- `groupName` (string): PreK group name (e.g., `"PreK Group 1"`)  
**Returns:** (Array\<Object\>) `[{ name, group }]`, empty array on error

---

### `getPreKSequences(groupName)`
**Description:** Reads the `PreK Pacing` sheet to find the instructional sequences assigned to a group. Sequences are defined in pairs of columns (letters, dates). Returns sequence name, letter list, and column index.  
**Parameters:**
- `groupName` (string): PreK group name  
**Returns:** (Array\<Object\>) `[{ sequenceName, letters, columnIndex }]`, empty array on error

---

### `getPreKAssessmentData(studentName, groupName, sequenceName)`
**Description:** Builds the full list of lesson keys for a sequence (`letter + " - " + skill` for each letter × skill combination), then reads the student's current values for those keys from `Pre-K Data`.  
**Parameters:**
- `studentName` (string): Student full name
- `groupName` (string): PreK group name
- `sequenceName` (string): Sequence name (e.g., `"Sequence 1"`)  
**Returns:** (Object) `{ lessons: string[], currentData: { lessonKey: value } }`

---

### `getPreKSkillsForGroup(groupName)`
**Description:** Reads the skills column from `PreK Pacing` to determine which assessment types (Form, Name, Sound) a group uses. Defaults to `['Form', 'Name', 'Sound']` if the pacing sheet is absent or the group is not found.  
**Parameters:**
- `groupName` (string): PreK group name  
**Returns:** (Array\<string\>) Skills list (e.g., `["Form", "Name", "Sound"]`)

---

### `savePreKAssessmentData(formData)`
**Description:** Saves Pre-K assessment values for a student. Finds the student's row in `Pre-K Data` by exact name match, then writes each `{ lessonName: value }` pair to the correct column using a header-to-column index map built from the header row.  
**Parameters:**
- `formData` (Object): `{ studentName, groupName, assessments: { lessonKey: value } }`  
**Returns:** (Object) `{ success: boolean, message: string }`

---

### Test Functions

### `testPreKFunctions()`
**Description:** Manual test runner that calls `getPreKStudentsByGroup()`, `getPreKSequences()`, and related functions with hard-coded test values and logs the results. For developer use only.  
**Parameters:** none  
**Returns:** void
