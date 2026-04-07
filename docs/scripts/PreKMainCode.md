# PreKMainCode.gs

## 📋 Overview

`PreKMainCode.gs` is the complete backend engine for the **Pre-K (HWT – Handwriting Without Tears) subsystem**, a self-contained literacy tracking system for Pre-Kindergarten students. It lives at `gold-standard-template/PreKMainCode.gs` and is activated when `SITE_CONFIG.features.preKSystem === "hwt"`.

**Role in the system:** This file is a parallel system to the main K–8 UFLI tracking engine. It manages two Pre-K programmes:

| Programme | Assessment type | Sheet | Header format |
|-----------|----------------|-------|---------------|
| **Pre-K** | Letter Form + Letter Name + Letter Sound for A–Z | `Pre-K` | `A-Form`, `A-Name`, `A-Sound`, `B-Form`, … |
| **Pre-School** | Letter Sound only for A–Z | `Pre-School` | `Letter Sound A`, `Letter Sound B`, … |

The file also acts as a **web app** (`doGet()`), serving four HTML portals:
- `?page=teacher` — Teacher assessment entry portal
- `?page=tutor` — Tutor session logging portal
- `?page=dashboard` — Program overview dashboard
- `?page=setup` — Site Setup Wizard
- (default) — Portal landing page

**Key constants defined at top of file:**

| Constant | Value | Purpose |
|----------|-------|---------|
| `ROSTER_SHEET_NAME` | `"Roster"` | Student name/group/program list |
| `PRE_SCHOOL_SHEET_NAME` | `"Pre-School"` | Pre-School letter sound data |
| `PRE_K_SHEET_NAME` | `"Pre-K"` | Pre-K form/name/sound data |
| `PACING_SHEET_NAME` | `"Pacing"` | Group progress summary |
| `SUMMARY_SHEET_NAME` | `"Skill Summary Page"` | Aggregated per-student metrics |
| `TUTOR_SHEET_NAME` | `"Tutors"` | Staff roster |
| `TUTOR_LOG_SHEET_NAME` | `"Tutor Log"` | Session-by-session log |
| `SEQUENCE_SHEET_NAME` | `"Instructional Sequence"` | HWT letter teaching order |
| `TOTAL_LESSONS` | `26` | Total letters in the curriculum |
| `TEMPLATE_DOC_ID` | Google Doc ID | Parent report template |
| `REPORT_FOLDER_ID` | Google Drive Folder ID | Output folder for generated reports |

> ⚠️ **Sheet layout note:** All sheets created by this file use **row 1 = headers, row 2+ = data**. This differs from the main K–8 system default (headers row 5, data row 6).

---

## 📜 Business Rules

- **Two programmes, one tracker:** A student is assigned to either `"Pre-K"` or `"Pre-School"` in the Roster. All scoring and reporting logic branches on this programme field.
- **Assessment values:** `Y` (passed/mastered), `N` (not mastered), `A` (absent), or blank (not yet assessed). In-progress and cumulative percentages treat blank as unassessed (excluded from denominator).
- **Scoring formulas:**
  - *In-Progress* = `Y_count / (Y_count + N_count)` — fraction of what has been assessed that was passed (blanks excluded)
  - *Cumulative* = `Y_count / TOTAL_LESSONS` — fraction of all 26 lessons mastered
  - Both are stored as decimals (0–1); displayed as percentages by number format `"0.0%"`
- **Pre-K scoring is per-skill:** Form, Name, and Sound are each calculated independently using the same formula. The Skill Summary Page has 6 Pre-K columns (Form In-Progress, Form Cumulative, Name In-Progress, Name Cumulative, Sound In-Progress, Sound Cumulative).
- **Pre-School scoring is single-skill:** Only Letter Sound matters. Columns C and D of the Skill Summary Page.
- **Instructional sequences (HWT):** The default sequence follows the Handwriting Without Tears (HWT) letter-introduction order in 7 sets (Set 1: A,M,S,T; Set 2: C,O,G,Q; etc.). Schools may override this by populating the "Instructional Sequence" sheet (headers: Sequence Name, Letters, Notes; data row 2+).
- **Tutor session logging:** Every `saveTutorSession()` call appends a row to Tutor Log AND updates the student's data sheet. If the student is not found in the data sheet, the log entry is still saved.
- **Absence recording:** `saveTutorAbsence()` appends a Tutor Log row with "Absent" in the Notes column; no data sheet is updated.
- **"Needs work" identification:** Letters where a student scored "N" for Name or Sound (Pre-K) or Letter Sound (Pre-School) are surfaced by `getNeedsWorkLetters()` for tutor prioritisation.
- **Parent report merge fields:** Template doc must contain `{{StudentName}}`, `{{Program}}`, `{{PS_Mastery}}`, `{{PS_Cumulative}}`, `{{PK_Form_Mastery}}`, `{{PK_Form_Cumulative}}`, `{{PK_Name_Mastery}}`, `{{PK_Name_Cumulative}}`, `{{PK_Sound_Mastery}}`, `{{PK_Sound_Cumulative}}`.
- **Progress colour thresholds (Pacing sheet):**
  - ≥ 80%: light green (`#d9ead3`)
  - ≥ 50%: light yellow (`#fff2cc`)
  - ≥ 20%: light orange (`#fce5cd`)
  - < 20%: light red (`#f4cccc`)
- **Dashboard mastery distribution:**
  - Mastered: ≥ 80% in-progress mastery
  - Progressing: 50–79%
  - Beginning: < 50%

---

## 📥 Data Inputs

| Source | Detail |
|--------|--------|
| `Roster` sheet | Col A = Name, Col B = Group, Col C = Program; headers row 1, data row 2+ |
| `Pre-K` sheet | Col A = Name, cols B+ = A-Form/A-Name/A-Sound/…; headers row 1, data row 2+ |
| `Pre-School` sheet | Col A = Name, cols B+ = Letter Sound A/…/Z; headers row 1, data row 2+ |
| `Skill Summary Page` | Columns C–J; read by dashboard, report generators, and pacing functions |
| `Instructional Sequence` sheet | Sequence Name (col A), Letters (col B); headers row 1, data row 2+ |
| `Tutors` sheet | Col A = Name; headers row 1, data row 2+ |
| `Tutor Log` sheet | Timestamp/Tutor/Student/Program/Letter/Form/Name/Sound/Notes |
| Web app `?page=` parameter | Routes the `doGet()` handler to the correct HTML file |
| Setup Wizard form data | JSON object `{ site, programs, schedule, students, teachers, tutors, groups }` |
| `TEMPLATE_DOC_ID` constant | Google Doc ID for parent report template |
| `REPORT_FOLDER_ID` constant | Google Drive Folder ID for report output |

---

## 📤 Outputs

| Output | Description |
|--------|-------------|
| `Skill Summary Page` sheet | Rebuilt by `calculateAllSummaries()`: per-student programme + 8 skill percentage columns |
| `Pacing` sheet | Rebuilt by `fixPacingSheetWithProgress()`: per-group current letter, Form/Name/Sound/Pre-School/Overall percentages with colour coding |
| `Pre-K` / `Pre-School` sheets | Updated by `saveAssessmentData()` and `saveTutorSession()` |
| `Tutor Log` sheet | Appended by `saveTutorSession()` and `saveTutorAbsence()` |
| `Roster` sheet | Written/cleared by `setupRosterSheet()` |
| `Tutors` sheet | Written/cleared by `setupTutorsSheet()` |
| `Site Config` sheet | Written by `setupSiteConfig()` |
| `Instructional Sequence` sheet | Created by `createInstructionalSequenceSheet()` or `setupInstructionalSequence()` |
| Google Doc parent reports | Created in Drive by `generateParentReports()` — one doc per student |
| Google Drive CSV file | Created (and later trashed) by `createCSVDownload()` |
| HTML web app pages | Served by `doGet()` to teacher/tutor/dashboard/setup portals |
| UI alerts | Progress, success, error messages throughout |

---

## 🔗 Dependencies

### Depends On (calls into)

| File | Functions / APIs Used |
|------|----------------------|
| GAS built-ins | `SpreadsheetApp`, `HtmlService`, `DriveApp`, `DocumentApp`, `ScriptApp`, `Utilities`, `Session`, `Logger` |
| `prek/PreKIndex.html` | Served by `doGet()` as `'Index'` for `?page=teacher` |
| `prek/PreKTutorForm.html` | Served by `doGet()` as `'TutorForm'` for `?page=tutor` |
| `prek/PreKDashboard.html` | Served by `doGet()` as `'Dashboard'` for `?page=dashboard` |
| `prek/PreKSetupWizard.html` | Served by `doGet()` as `'SetupWizard'` for `?page=setup` |
| `prek/PreKPortal.html` | Served by `doGet()` as `'Portal'` for default route |
| `prek/PreKParentReport.html` | Loaded by `generateEnhancedParentReports()` as `'ParentReport'` |

### Used By (called from)

| File | How |
|------|-----|
| `modules/ModuleLoader.gs` | `openPreKPortal()`, `openPreKDashboard()`, `openPreKTutorForm()`, `generatePreKParentReports()` exposed in HWT Pre-K submenu |
| `prek/PreKIndex.html` | `getGroups()`, `getStudentsByGroup()`, `getStudentAssessmentData()`, `saveAssessmentData()`, `getSequences()`, `getLessonsForSequence()`, `getFilteredAssessmentData()` via `google.script.run` |
| `prek/PreKTutorForm.html` | `getTutorNames()`, `getStudentRoster()`, `getNeedsWorkLetters()`, `getTutorLessonList()`, `saveTutorSession()`, `saveTutorAbsence()` via `google.script.run` |
| `prek/PreKDashboard.html` | `getDashboardData()`, `exportProgressCSV()` via `google.script.run` |
| `prek/PreKSetupWizard.html` | `setupNewSite()`, `getWebAppUrl()` via `google.script.run` |
| `prek/PreKPortal.html` | `getWebAppUrl()` via `google.script.run` |

---

## ⚙️ Function Reference

### `createPreSchoolSheet()`
**Description:** Quick-fix utility. Creates the "Pre-School" sheet if it does not exist, with a header row: Name, Letter Sound A–Z. Applies dark blue header formatting.
**Parameters:** None
**Returns:** `void`

---

### `fixPreSchoolHeaders()`
**Description:** Quick-fix utility. Updates existing "Pre-School" sheet headers to the canonical `"Letter Sound A"` through `"Letter Sound Z"` format and auto-resizes columns.
**Parameters:** None
**Returns:** `void`

---

### `fixSummaryHeaders()`
**Description:** Quick-fix utility. Writes the 10 correct column headers to the "Skill Summary Page" and reformats.
**Parameters:** None
**Returns:** `void`

---

### `fixCalculateSummaries()`
**Description:** Alias for `calculateAllSummaries()`. Retained for backward compatibility via the Quick Fixes menu.
**Parameters:** None
**Returns:** `void`

---

### `fixUpdatePacingSheet()`
**Description:** Alias for `fixPacingSheetWithProgress()`. Retained for backward compatibility.
**Parameters:** None
**Returns:** `void`

---

### `fixPacingSheetWithProgress()`
**Description:** Rebuilds the Pacing sheet with actual student progress data. For each group: counts assessments from Pre-K (Form/Name/Sound) and Pre-School (Letter Sound) sheets, calculates per-skill and overall percentages, determines the "current letter" from the furthest assessed letter, and colour-codes cells based on progress thresholds.
**Parameters:** None
**Returns:** `void`

---

### `getProgressColor(percentage)`
**Description:** Maps a progress percentage to a background hex colour: ≥80% → `#d9ead3` (green), ≥50% → `#fff2cc` (yellow), ≥20% → `#fce5cd` (orange), <20% → `#f4cccc` (red).
**Parameters:**
- `percentage` (number): Progress value 0–100

**Returns:** `(string)` Hex colour string

---

### `createAllMissingSheets()`
**Description:** Creates any sheets that are missing from the expected set: Pre-K, Pre-School, Skill Summary Page, Tutors, Tutor Log, Roster, Pacing. Sets up headers and formatting on each. Reports created sheet names in an alert.
**Parameters:** None
**Returns:** `void`

---

### `setupInstructionalSequence()`
**Description:** Entry point for creating the Instructional Sequence sheet. Delegates to `createInstructionalSequenceSheet()`.
**Parameters:** None
**Returns:** `void`

---

### `createInstructionalSequenceSheet(ss)`
**Description:** Creates the "Instructional Sequence" sheet with the default HWT 7-set sequence (Set 1: A,M,S,T through Set 7: Y,Z) plus explanatory notes. Applies formatting and frozen rows.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet

**Returns:** `void`

---

### `doGet(e)`
**Description:** Web app entry point. Routes the request to the appropriate HTML file based on `e.parameter.page`: `"teacher"` → `Index.html`, `"tutor"` → `TutorForm.html`, `"dashboard"` → `Dashboard.html`, `"setup"` → `SetupWizard.html`, default → `Portal.html`.
**Parameters:**
- `e` (Object): GAS web app event object with `parameter.page`

**Returns:** `(HtmlOutput)` Configured HTML output with viewport meta tag

---

### `getWebAppUrl()`
**Description:** Returns the deployed web app URL. Called from portal HTML pages to enable cross-page navigation.
**Parameters:** None
**Returns:** `(string)` Web app URL from `ScriptApp.getService().getUrl()`

---

### `onOpen()`
**Description:** Creates the "TILT Adira Reads PreK Program" custom menu with items: Site Setup Wizard, Update Summary Page, Update Pacing Progress, Export Progress Report (CSV), Generate Parent Reports, Demo & Testing submenu (Generate Test Data, Clear All Data), Quick Fixes submenu.
**Parameters:** None
**Returns:** `void`

---

### `openDashboard()`
**Description:** Opens the Program Overview Dashboard (`?page=dashboard`) in a new browser tab via a mini modal.
**Parameters:** None
**Returns:** `void`

---

### `openSetupWizard()`
**Description:** Opens the Site Setup Wizard HTML file as a 900×700 modal dialog.
**Parameters:** None
**Returns:** `void`

---

### `calculateAllSummaries()`
**Description:** Rebuilds the "Skill Summary Page" for every student in the Roster. For Pre-School students: calculates In-Progress and Cumulative percentages across 26 Letter Sound columns. For Pre-K students: calculates the same metrics separately for Form, Name, and Sound skills. Writes all 10 metric columns for each student in a single batch write. Formats columns C–J as `"0.0%"`.
**Parameters:** None
**Returns:** `void`

---

### `calculateScores(studentDataRow, headers, skillFilter)`
**Description:** Calculates In-Progress (`Y / (Y + N)`) and Cumulative (`Y / 26`) scores for a student data row. If `skillFilter` is provided (e.g., `"-Form"`), only columns whose header ends with that suffix are counted.
**Parameters:**
- `studentDataRow` (Array): Full data row for one student (index 0 = name, 1+ = skill values)
- `headers` (Array|null): Header row for the sheet (required when `skillFilter` is set)
- `skillFilter` (string|null): Suffix to filter headers by (e.g., `" - Form"`)

**Returns:** `(Object)` `{ inProgress: number, cumulative: number }` (both 0–1 decimals)

---

### `updatePacingSheetFormatting()`
**Description:** Alias for `fixPacingSheetWithProgress()`. Provided for backward compatibility.
**Parameters:** None
**Returns:** `void`

---

### `buildLessonNames(letters, isPreK)`
**Description:** Builds lesson name arrays from a letters array. For Pre-K: produces `["A-Form", "A-Name", "A-Sound", ...]`; for Pre-School: produces `["Letter Sound A", ...]`.
**Parameters:**
- `letters` (Array<string>): Array of letter strings (e.g., `["A", "M", "S", "T"]`)
- `isPreK` (boolean): `true` = Pre-K format, `false` = Pre-School format

**Returns:** `(Array<string>)` Array of lesson name strings

---

### `isStudentAssessedForSet(studentName, studentDataMap, headers, requiredLessons)`
**Description:** Checks whether a student has a non-blank assessment value (`Y`, `N`, or `A`) for every lesson in the required set. Returns `false` if any lesson is blank or if the student is not in the data map.
**Parameters:**
- `studentName` (string): Student name
- `studentDataMap` (Map): Name → data row map
- `headers` (Array): Sheet header row
- `requiredLessons` (Array<string>): Lesson names that must all have values

**Returns:** `(boolean)` `true` if fully assessed for the set

---

### `generateParentReports()`
**Description:** Generates a Google Doc parent report for every student in the Skill Summary Page. Copies `TEMPLATE_DOC_ID` to `REPORT_FOLDER_ID`, then performs mail-merge text replacements for all 10 metric fields. Shows a progress alert before starting and a completion alert with the count of files created.
**Parameters:** None
**Returns:** `void`

---

### `getGroups()`
**Description:** Returns the unique, sorted list of group names from column B of the Roster sheet. Used by the Teacher Portal dropdown.
**Parameters:** None
**Returns:** `(Array<string>)` Sorted group names; empty array on error

---

### `getStudentsByGroup(groupName)`
**Description:** Returns all students in a group as `{ name, program }` objects, sorted by name.
**Parameters:**
- `groupName` (string): Group to filter by

**Returns:** `(Array<Object>)` Array of `{ name: string, program: string }`

---

### `getStudentAssessmentData(studentName, program)`
**Description:** Returns all lesson names (from headers) and the student's current assessment values as a `{ lessonName: value }` map. Reads from "Pre-K" or "Pre-School" based on programme.
**Parameters:**
- `studentName` (string): Student name
- `program` (string): `'Pre-K'` or `'Pre-School'`

**Returns:** `(Object)` `{ lessons: Array<string>, currentData: Object<string, string> }`

---

### `saveAssessmentData(data)`
**Description:** Writes assessment values from the form back to the student's row in the appropriate data sheet. Reads the entire row, updates the relevant columns by header name lookup, then writes the full row back in a single operation.
**Parameters:**
- `data` (Object): `{ studentName: string, program: string, assessments: Object<lessonName, status> }`

**Returns:** `(string)` Success message or error string

---

### `getSequences(groupName)`
**Description:** Returns the list of instructional sequences from the "Instructional Sequence" sheet. Falls back to the built-in HWT 7-set default if the sheet doesn't exist or is empty. The `groupName` parameter is accepted for signature compatibility but is not currently used.
**Parameters:**
- `groupName` (string): Group name (unused; reserved for future per-group sequences)

**Returns:** `(Array<Object>)` Array of `{ sequenceName: string, letters: string }`

---

### `getDefaultSequences()`
**Description:** Returns the built-in HWT instructional sequence: 7 sets covering all 26 letters in the canonical HWT teaching order.
**Parameters:** None
**Returns:** `(Array<Object>)` Array of `{ sequenceName: string, letters: string }`

---

### `getLessonsForSequence(groupName, sequenceName)`
**Description:** Determines the programme for the group (by looking up a student in that group from the Roster), then generates the lesson name list for the given sequence's letters using `buildLessonNames()`.
**Parameters:**
- `groupName` (string): Group name (used to determine programme type)
- `sequenceName` (string): Sequence name (e.g., `"Set 1"`)

**Returns:** `(Array<string>)` Ordered lesson names for the sequence (e.g., `["A-Form","A-Name","A-Sound","M-Form",…]`)

---

### `getFilteredAssessmentData(studentName, program, groupName, sequenceName)`
**Description:** Combines `getLessonsForSequence()` and `getStudentAssessmentData()` to return only the lessons belonging to the specified sequence, along with the student's current values.
**Parameters:**
- `studentName` (string): Student name
- `program` (string): `'Pre-K'` or `'Pre-School'`
- `groupName` (string): Group name (for programme detection)
- `sequenceName` (string): Selected sequence name

**Returns:** `(Object)` `{ lessons: Array<string>, currentData: Object }`

---

### `getTutorNames()`
**Description:** Returns the unique, sorted list of tutor names from column A of the "Tutors" sheet.
**Parameters:** None
**Returns:** `(Array<string>)` Sorted tutor names; empty array on error

---

### `getStudentRoster()`
**Description:** Returns all students from the Roster as `{ name, program }` objects, sorted by name.
**Parameters:** None
**Returns:** `(Array<Object>)` Array of `{ name: string, program: string }`

---

### `saveTutorSession(data)`
**Description:** Two-step save: (1) appends a row to Tutor Log with timestamp, tutor, student, programme, letter, Form/Name/Sound statuses, and empty notes; (2) updates the student's row in the Pre-K or Pre-School sheet. If the student is not found in the data sheet, the log is still saved and a partial-success message is returned.
**Parameters:**
- `data` (Object): `{ tutor, student, program, lesson, formStatus, nameStatus, soundStatus }`

**Returns:** `(string)` Success or error message

---

### `saveTutorAbsence(data)`
**Description:** Appends a Tutor Log row with "Absent" in the Notes column. Does not update any data sheet.
**Parameters:**
- `data` (Object): `{ tutor: string, student: string }`

**Returns:** `(string)` Success or error message

---

### `getNeedsWorkLetters(studentName, program)`
**Description:** Finds letters where the student scored "N" on Name or Sound (Pre-K) or Letter Sound (Pre-School). Returns a sorted array of letter strings (e.g., `["A", "C", "G"]`). Used to populate the "Needs Work" priority section in the tutor dropdown.
**Parameters:**
- `studentName` (string): Student name
- `program` (string): `'Pre-K'` or `'Pre-School'`

**Returns:** `(Array<string>)` Sorted letters needing work

---

### `getTutorLessonList(studentName, program)`
**Description:** Builds a smart lesson list for the tutor dropdown: "needs work" letters come first, followed by all remaining letters.
**Parameters:**
- `studentName` (string): Student name
- `program` (string): `'Pre-K'` or `'Pre-School'`

**Returns:** `(Object)` `{ needsWork: Array<string>, otherLetters: Array<string> }`

---

### `getDashboardData()`
**Description:** Aggregates all data needed for the Program Overview Dashboard: total students, programme breakdown (Pre-School/Pre-K counts), average mastery, average letters assessed, group count, mastery distribution (Mastered/Progressing/Beginning), Pre-K skill averages (Form/Name/Sound), per-group average progress, and full student list sorted by progress descending. Returns `getEmptyDashboardData()` if the roster is empty.
**Parameters:** None
**Returns:** `(Object)` Full dashboard data structure with `stats`, `programBreakdown`, `masteryDistribution`, `skillsProgress`, `groupProgress`, and `students`

---

### `getEmptyDashboardData()`
**Description:** Returns a zeroed-out dashboard data structure used when no student data exists.
**Parameters:** None
**Returns:** `(Object)` Dashboard data structure with all zeros and empty arrays

---

### `createCSVDownload(csvContent, fileName)`
**Description:** Creates a temporary CSV file in Google Drive, sets sharing to "anyone with link can view", waits 60 seconds (for download), then trashes the file. Returns the download URL.
**Parameters:**
- `csvContent` (string): CSV content string
- `fileName` (string): Desired filename

**Returns:** `(string|null)` Download URL or `null` on error

---

### `exportProgressCSV()`
**Description:** Calls `getDashboardData()`, builds a CSV with columns: Student Name, Group, Program, Progress %, Mastery %, and saves the file to Google Drive. Shows an alert with the file URL.
**Parameters:** None
**Returns:** `void`

---

### `setupNewSite(data)`
**Description:** Main wizard completion handler. Orchestrates: `setupSiteConfig()`, `setupRosterSheet()`, `setupTutorsSheet()`, `setupPacingSheet()`, `initializeDataSheets()`, creates Instructional Sequence sheet, renames spreadsheet to `"PreK Tracker - {siteName}"`. Returns a result object with formatted HTML message.
**Parameters:**
- `data` (Object): `{ site: {name,code,address,phone,coordinatorName,coordinatorEmail}, programs: {selected, academicYear, startDate}, schedule: {sessionsPerWeek, sessionDuration, times, notes}, students: [], teachers: [], tutors: [], groups: [] }`

**Returns:** `(Object)` `{ success: boolean, message: string }`

---

### `setupSiteConfig(ss, site, programs, schedule)`
**Description:** Creates or replaces the "Site Config" sheet with site name, code, address, phone, coordinator, programme configuration, academic year, schedule (sessions/week, duration, weekly minutes, session times by day), and notes.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `site` (Object): Site identity fields
- `programs` (Object): `{ selected: Array<string>, academicYear, startDate }`
- `schedule` (Object): `{ sessionsPerWeek, sessionDuration, times: {mon,tue,wed,thu,fri}, notes }`

**Returns:** `void`

---

### `setupRosterSheet(ss, students)`
**Description:** Creates or clears the Roster sheet (keeping headers). Writes student data: Name (col A), Group (col B), Program (col C). Auto-resizes columns.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `students` (Array<Object>): Array of `{ name, group, program }`

**Returns:** `void`

---

### `setupTutorsSheet(ss, teachers, tutors)`
**Description:** Creates or clears the "Tutors" sheet. Writes all teachers with role "Teacher" followed by tutors with role "Tutor". Columns: Name, Role.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `teachers` (Array<string>): Teacher names
- `tutors` (Array<string>): Tutor names

**Returns:** `void`

---

### `setupPacingSheet(ss, groups, students)`
**Description:** Creates or clears the Pacing sheet. Writes header row (Group, Current Letter, Student Count) then one row per group with an initial current letter of "A" and the computed student count.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `groups` (Array<string>): Group names
- `students` (Array<Object>): All students (used to count per group)

**Returns:** `void`

---

### `initializeDataSheets(ss, selectedPrograms)`
**Description:** Creates all system sheets that do not already exist. For `'Pre-K'`: creates "Pre-K" sheet with headers `Name, A-Form, A-Name, A-Sound, B-Form, …`. For `'Pre-School'`: creates "Pre-School" sheet with headers `Name, Letter Sound A, …`. Also creates "Skill Summary Page" and "Tutor Log" if missing.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `selectedPrograms` (Array<string>): e.g., `["Pre-K", "Pre-School"]`

**Returns:** `void`

---

### `generateTestData()`
**Description:** Demo data generator. After confirmation, creates a full demo site "Central Library Branch" with 24 students (4 groups), 3 teachers, 6 tutors, sample Pre-K and Pre-School assessment data, 20 sample tutor log entries, and recalculates all summaries. Renames the spreadsheet to include "(DEMO)".
**Parameters:** None
**Returns:** `void`

---

### `generateSampleAssessments(ss, students)`
**Description:** Populates Pre-K and Pre-School data sheets with randomised but realistic assessment data (65–95% mastery rate, 8–26 letters completed per student). Also generates 20 sample Tutor Log entries spread over 2 weeks.
**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet
- `students` (Array<Object>): Array of `{ name, group, program }`

**Returns:** `void`

---

### `clearAllData()`
**Description:** After confirmation, clears all data (keeping headers) from Roster, Pre-K, Pre-School, Skill Summary Page, Tutor Log, Tutors, and Pacing sheets. Deletes the Site Config sheet. Resets the spreadsheet name to `"PreK Assessment Tracker"`.
**Parameters:** None
**Returns:** `void`

---

### `generateEnhancedParentReports()`
**Description:** Generates styled HTML parent reports (instead of Doc-based reports) for all students. Uses `ParentReport.html` as the template, replaces merge variables in the HTML, saves each as an HTML file in `REPORT_FOLDER_ID` (creating a new timestamped folder if the configured one does not exist).
**Parameters:** None
**Returns:** `void`

---

### `getParentReportPreview(studentName)`
**Description:** Returns a data object used by the Dashboard to preview a single student's parent report metrics without generating a file.
**Parameters:**
- `studentName` (string): Student name

**Returns:** `(Object)` `{ studentName, program, date, formMastery, nameMastery, soundMastery, overallMastery, … }` or `{ error: string }`

---

### `openPreKPortal()`
**Description:** Opens the Pre-K portal landing page (default `doGet()` route) in a new browser tab via a mini modal.
**Parameters:** None
**Returns:** `void`

---

### `openPreKDashboard()`
**Description:** Delegates to `openDashboard()`. Entry point for the HWT Pre-K submenu item.
**Parameters:** None
**Returns:** `void`

---

### `openPreKTutorForm()`
**Description:** Opens the tutor entry portal (`?page=tutor`) in a new browser tab via a mini modal.
**Parameters:** None
**Returns:** `void`

---

### `generatePreKParentReports()`
**Description:** Delegates to `generateParentReports()`. Entry point for the HWT Pre-K submenu item.
**Parameters:** None
**Returns:** `void`
