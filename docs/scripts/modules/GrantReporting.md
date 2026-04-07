# GrantReporting.gs (Module)

## 📋 Overview
**Feature Flag:** `SITE_CONFIG.features.grantReporting`

`GrantReporting.gs` generates the **Mind Trust Grant — Tutoring Outcomes Summary**, a formatted multi-section report sheet required by the Mind Trust tutoring grant funder. The report covers a configurable lookback window (default 14 days) and synthesises data from six source sheets into five standardised grant metrics.

Plain-English summary: *A coordinator opens the spreadsheet, chooses Grant Reports > Generate Mind Trust Summary, enters (or accepts) an end date, and the module creates a new "Mind Trust Summary" sheet with five labelled sections: attendance rates, baseline-vs-current skill data, growth percentages, identified skill gaps, and instructional adjustments. The report can also be scheduled to run automatically on a 14-day cycle.*

---

## 📜 Business Rules

### Reporting Window
- All **session-based data** (attendance, tutoring log entries) is filtered to a `LOOKBACK_DAYS`-day window ending at the user-supplied report date (default 14 days).
- **Snapshot data** (Grade Summary, Skills Tracker) reflects the current state at time of run — it is not date-filtered.

### Data Sources by Section
| Section | Primary Sheet(s) |
|---|---|
| 1. Attendance Rate | Tutoring Progress Log, Small Group Progress, SGPArchive |
| 2. Baseline vs Current | Grade Summary (Initial % → Total %) |
| 3. Growth Percentages | Grade Summary (AG% columns), School Summary |
| 4. Skill Gaps | Skills Tracker, Grade Summary |
| 5. Instructional Adjustments | Derived from Section 4 gaps + benchmark status |

### Skill Gap Thresholds
- Skills below `GAP_THRESHOLD` (50 %) → flagged as a gap.
- Skills below `CRITICAL_THRESHOLD` (25 %) → flagged as a critical gap (stronger red highlight).

### Tutoring Student List
- Students are sourced from the *G3 Groups* sheet by scanning for groups whose name contains `"tutoring"`.
- If no tutoring groups are found, falls back to all students in Grade Summary.

### Scheduling
- Only one scheduled trigger (`generateMindTrustSummaryScheduled`) may exist at a time; the UI warns and confirms before replacing an existing trigger.
- The cycle start date is persisted in Script Properties under key `MT_CYCLE_START`.
- When running from a time-based trigger (no UI), confirmation alert is suppressed and only logged.

---

## 📥 Data Inputs
| Input | Source Sheet | Notes |
|---|---|---|
| Tutoring student list | `G3 Groups` | Groups with "tutoring" in name |
| Baseline and current skills | `Grade Summary` | Columns: foundPct, minGradePct, fullGradePct, 16 × skill triplets |
| Skill mastery % | `Skills Tracker` | One column per skill section |
| Whole-group attendance | `Small Group Progress`, `SGPArchive` | Date-filtered |
| Tutoring attendance / sessions | `Tutoring Progress Log` | Date-filtered |
| Aggregate school metrics | `School Summary` | Snapshot |
| Report end date | User prompt or system clock | `generateMindTrustSummary()` or scheduled |

---

## 📤 Outputs
| Output | Description |
|---|---|
| Sheet: *Mind Trust Summary* | Created or fully replaced on each run; moved to position 2 |
| Section 1 — Attendance | Per-student session counts, present/absent, attendance % |
| Section 2 — Baseline vs Current | Initial %, current %, delta for foundational / min / full grade skills |
| Section 3 — Growth | AG% per skill section; school-level aggregate growth from School Summary |
| Section 4 — Skill Gaps | Per-student skill mastery % with gap/critical-gap highlighting |
| Section 5 — Instructional Adjustments | AI-derived recommendations based on lowest skill and benchmark |
| Completion alert | Shown to user with window dates and section list (suppressed in trigger mode) |

---

## 🔗 Dependencies

### Feature Flag
`SITE_CONFIG.features.grantReporting === true`

### Depends On (calls into)
| File / Symbol | Purpose |
|---|---|
| `SpreadsheetApp`, `ScriptApp`, `PropertiesService`, `Utilities`, `Session` | GAS built-in services |
| `MT_CONFIG` (module-local) | All configuration: sheet names, thresholds, colours, skill sections |
| Internal `_` helpers | Data gathering and section writing (see Function Reference) |

### Used By (called from)
| File | Context |
|---|---|
| `ModuleLoader.gs` → `buildFeatureMenu()` | Registers *Grant Reports* submenu: Generate, Schedule, Remove |
| `SetupWizard.gs` / `onOpen_Example.gs` | Menu items invoke `generateMindTrustSummary()`, `scheduleMindTrustReport()`, `removeMindTrustTrigger()` |
| GAS Time-Based Trigger | `generateMindTrustSummaryScheduled()` every 14 days |

---

## ⚙️ Function Reference

### `generateMindTrustSummary()`
**Description:** Interactive entry point. Prompts the user for a reporting end date (defaults to today), validates the input, sets time to end-of-day, and calls `generateMindTrustSummaryCore_()`.

**Parameters:** None.

**Returns:** (void)

---

### `generateMindTrustSummaryScheduled()`
**Description:** Trigger entry point. Uses the current date automatically (end-of-day) and calls `generateMindTrustSummaryCore_()`. Called by the time-based trigger every `LOOKBACK_DAYS` days.

**Parameters:** None.

**Returns:** (void)

---

### `scheduleMindTrustReport()`
**Description:** Creates a time-based trigger to run `generateMindTrustSummaryScheduled()` every 14 days at 6 AM. If a trigger already exists, confirms replacement. Prompts for the first run date; if today, runs the report immediately. Persists cycle start in Script Properties.

**Parameters:** None.

**Returns:** (void)

---

### `removeMindTrustTrigger()`
**Description:** Finds and deletes the scheduled `generateMindTrustSummaryScheduled` trigger, and removes the `MT_CYCLE_START` Script Property. Shows an alert if no trigger exists.

**Parameters:** None.

**Returns:** (void)

---

### `getExistingMTTrigger_()`
**Description:** (Private) Searches all project triggers and returns the trigger whose handler function is `"generateMindTrustSummaryScheduled"`, or `null` if none exists.

**Parameters:** None.

**Returns:** (Trigger|null)

---

### `generateMindTrustSummaryCore_(reportDate)`
**Description:** (Private) Core report generation logic. Validates required sheets exist, creates/clears the output sheet, gathers all data, and orchestrates the five section writers. Moves the output sheet to position 2 in the tab bar.

**Parameters:**
- `reportDate` (Date): End date of the reporting window (set to 23:59:59).

**Returns:** (void)

---

### `getTutoringStudentList_(ss)`
**Description:** (Private) Reads the *G3 Groups* sheet and extracts students assigned to groups whose name contains `"tutoring"`. Falls back to all students in Grade Summary if no tutoring groups are found. Returns a deduplicated, name-sorted array.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.

**Returns:** (Array\<Object\>) `[{ name: string, tutoringGroup: string }]`

---

### `getGradeSummaryData_(ss)`
**Description:** (Private) Reads all student rows from the *Grade Summary* sheet into a map keyed by student name. Captures grade, teacher, group, foundational %, min-grade %, full-grade %, benchmark status, and all 16 skill section triplets (initial, AG%, total).

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.

**Returns:** (Object) `{ studentName: { grade, teacher, group, foundPct, minGradePct, fullGradePct, benchmarkStatus, skills } }`

---

### `getSkillsTrackerData_(ss)`
**Description:** (Private) Reads the *Skills Tracker* sheet into a map keyed by student name, capturing mastery % for each of the 16 skill sections.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.

**Returns:** (Object) `{ studentName: { skillName: number } }`

---

### `getAttendanceData_(ss, tutoringStudents, dateRange)`
**Description:** (Private) Tallies attendance (present/absent/total sessions) for each tutoring student from Small Group Progress and SGPArchive, filtered to `dateRange`. Attendance = (Y + N) / (Y + N + A) × 100.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `tutoringStudents` (Array\<Object\>): Output of `getTutoringStudentList_()`.
- `dateRange` (Object): `{ start: Date, end: Date }`

**Returns:** (Object) `{ studentName: { sessions, present, absent, attendancePct } }`

---

### `tallySGPAttendance_(sheet, counts, studentNames, dateRange)`
**Description:** (Private) Iterates rows in a Small Group Progress-style sheet and increments present/absent counters for students in `studentNames` whose row date falls within `dateRange`.

**Parameters:**
- `sheet` (Sheet): SGP or SGPArchive sheet.
- `counts` (Object): Mutable counts map — modified in place.
- `studentNames` (Set\<string\>): Set of tutoring student names.
- `dateRange` (Object): `{ start: Date, end: Date }`

**Returns:** (void)

---

### `getTutoringLogData_(ss, dateRange)`
**Description:** (Private) Reads the *Tutoring Progress Log* filtered to `dateRange`. Returns session counts, pass/fail/absent tallies, and pass percentages per student, plus total-window and all-time session counts.

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.
- `dateRange` (Object): `{ start: Date, end: Date }`

**Returns:** (Object) `{ students, totalSessions, totalAllTime, hasData }`

---

### `getSchoolSummaryMetrics_(ss)`
**Description:** (Private) Reads aggregate metrics from the *School Summary* sheet: school name, update timestamp, foundational/min/full-grade initial+current+growth %, and benchmark category counts (On Track, Progressing, Needs Support).

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet.

**Returns:** (Object) School-level metrics with sensible defaults if the sheet is missing.

---

### `writeReportHeader_(out, row, metrics, tutoringStudents, dateRange)`
**Description:** (Private) Writes the report title, school/grade subtitle, reporting window banner, and a summary statistics row (total students, date range).

**Parameters:**
- `out` (Sheet): Output sheet.
- `row` (number): Starting row number.
- `metrics` (Object): Output of `getSchoolSummaryMetrics_()`.
- `tutoringStudents` (Array): Output of `getTutoringStudentList_()`.
- `dateRange` (Object): `{ start, end }`.

**Returns:** (number) Next available row number.

---

### `writeDataSourceNote_(out, row, tutoringLogData, dateRange)`
**Description:** (Private) Writes a note block documenting which sheets were used as data sources and the total session counts for the window vs. all-time.

**Parameters:**
- `out` (Sheet): Output sheet.
- `row` (number): Starting row.
- `tutoringLogData` (Object): Output of `getTutoringLogData_()`.
- `dateRange` (Object): `{ start, end }`.

**Returns:** (number) Next available row number.

---

### `writeSection1_Attendance_(out, row, tutoringStudents, attendanceData, tutoringLogData, dateRange)`
**Description:** (Private) Writes Section 1: per-student whole-group attendance and tutoring session counts/pass rates for the reporting window.

**Parameters:**
- `out` (Sheet): Output sheet.
- `row` (number): Starting row.
- `tutoringStudents`, `attendanceData`, `tutoringLogData`, `dateRange`: Data from corresponding gatherer functions.

**Returns:** (number) Next available row number.

---

### `writeSection2_BaselineVsCurrent_(out, row, tutoringStudents, gradeSummary)`
**Description:** (Private) Writes Section 2: per-student foundational/min/full-grade initial %, current %, and computed change.

**Parameters:**
- `out` (Sheet): Output sheet.
- `row` (number): Starting row.
- `tutoringStudents` (Array): Tutoring student list.
- `gradeSummary` (Object): Output of `getGradeSummaryData_()`.

**Returns:** (number) Next available row number.

---

### `writeSection3_Growth_(out, row, tutoringStudents, gradeSummary, schoolMetrics)`
**Description:** (Private) Writes Section 3: per-student AG% for each skill section, plus school-level aggregate growth from School Summary.

**Parameters:**
- `out` (Sheet): Output sheet.
- `row` (number): Starting row.
- `tutoringStudents`, `gradeSummary`, `schoolMetrics`: Data from corresponding gatherers.

**Returns:** (number) Next available row number.

---

### `writeSection4_SkillGaps_(out, row, tutoringStudents, skillsData)`
**Description:** (Private) Writes Section 4: per-student skill mastery % for all 16 sections, with gap (< 50 %) and critical-gap (< 25 %) conditional highlighting.

**Parameters:**
- `out` (Sheet): Output sheet.
- `row` (number): Starting row.
- `tutoringStudents` (Array): Tutoring student list.
- `skillsData` (Object): Output of `getSkillsTrackerData_()`.

**Returns:** (number) Next available row number.

---

### `writeSection5_InstructionalAdjustments_(out, row, tutoringStudents, skillsData, gradeSummary)`
**Description:** (Private) Writes Section 5: for each tutoring student, identifies the lowest-mastery skill gap and calls `generateRecommendation_()` to produce an instructional adjustment suggestion.

**Parameters:**
- `out` (Sheet): Output sheet.
- `row` (number): Starting row.
- `tutoringStudents`, `skillsData`, `gradeSummary`: Data from corresponding gatherers.

**Returns:** (number) Next available row number.

---

### `generateRecommendation_(lowestSkill, lowestPct, benchmark, gapSkills)`
**Description:** (Private) Returns a plain-English instructional recommendation string based on the student's lowest-mastery skill, benchmark status, and the full list of gap skills.

**Parameters:**
- `lowestSkill` (string): Name of the skill with the lowest mastery %.
- `lowestPct` (number): Mastery percentage for that skill.
- `benchmark` (string): Benchmark category (e.g., `"On Track"`, `"Needs Support"`).
- `gapSkills` (Array\<string\>): All skills below `GAP_THRESHOLD`.

**Returns:** (string) A 1–3 sentence instructional recommendation.

---

### `writeSectionHeader_(out, row, title, subtitle)`
**Description:** (Private) Writes a formatted section header row with a section title (blue background) and an optional subtitle row.

**Parameters:**
- `out` (Sheet): Output sheet.
- `row` (number): Starting row.
- `title` (string): Section title text.
- `subtitle` (string): Optional subtitle; pass `""` to skip.

**Returns:** (number) Next available row number.

---

### `writeHeaderRow_(out, row, headers, numCols)`
**Description:** (Private) Writes a formatted table header row with bold text and a light-blue background.

**Parameters:**
- `out` (Sheet): Output sheet.
- `row` (number): Row number.
- `headers` (Array\<string\>): Column header labels.
- `numCols` (number): Total column span for the header area.

**Returns:** (number) Next available row number.

---

### `parseNum_(val)`
**Description:** (Private) Parses a cell value to a number. Returns `0` for empty/non-numeric values.

**Parameters:**
- `val` (any): Raw cell value.

**Returns:** (number)

---

### `toDate_(val)`
**Description:** (Private) Converts a cell value (Date object, date string, or serial number) to a JavaScript `Date`. Returns `null` if the value cannot be parsed.

**Parameters:**
- `val` (any): Raw cell value.

**Returns:** (Date|null)
